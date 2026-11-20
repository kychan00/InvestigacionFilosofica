import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE =
  process.env.MOBILE_UI_BASE_URL ||
  "http://127.0.0.1:4173/";

const FIREBASE_PREFIX =
  "https://www.gstatic.com/firebasejs/13.3.0/";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"]
});

await mkdir("artifacts/profile-bootstrap", { recursive: true });

const page = await browser.newPage({
  viewport: { width: 1280, height: 800 }
});

const pageErrors = [];
page.on("pageerror", error => {
  pageErrors.push(String(error?.stack || error?.message || error));
});

const appStub = `
export function initializeApp(config) {
  return { config };
}
`;

const authStub = `
export const browserLocalPersistence = { kind: "local" };

const user = {
  uid: "profile-smoke-user",
  displayName: "Sesión de prueba",
  email: "perfil@example.test",
  photoURL: "",
  providerData: [{ providerId: "google.com" }],
  emailVerified: true,
  reload() {
    globalThis.__profileReloadCalls =
      (globalThis.__profileReloadCalls || 0) + 1;
    return new Promise(() => {});
  }
};

export function getAuth() {
  const auth = {
    currentUser: user,
    languageCode: "es",
    authStateReady: async () => {}
  };
  globalThis.__profileMockAuth = auth;
  return auth;
}

export async function setPersistence() {
  return true;
}

export function onAuthStateChanged(auth, callback) {
  queueMicrotask(() => callback(auth.currentUser));
  return () => {};
}

export async function signOut(auth) {
  auth.currentUser = null;
}

export async function updateProfile(target, changes) {
  Object.assign(target, changes || {});
}
`;

const firestoreStub = `
export function getFirestore() {
  return { kind: "firestore-mock" };
}

export function doc(...parts) {
  return { kind: "doc", parts };
}

export function collection(...parts) {
  return { kind: "collection", parts };
}

export function query(ref, ...constraints) {
  return { kind: "query", ref, constraints };
}

export function orderBy(field, direction) {
  return { field, direction };
}

export function serverTimestamp() {
  return { mockTimestamp: true };
}

export function getDoc() {
  globalThis.__profileFirestoreReadCalls =
    (globalThis.__profileFirestoreReadCalls || 0) + 1;
  return new Promise(() => {});
}

export async function getDocs() {
  return { docs: [] };
}

export function onSnapshot(ref, callback) {
  queueMicrotask(() => callback({ docs: [] }));
  return () => {};
}

export async function setDoc() {}
export async function updateDoc() {}
export async function deleteDoc() {}
`;

await page.route("**/*", async route => {
  const url = route.request().url();

  if (url === FIREBASE_PREFIX + "firebase-app.js") {
    await route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: appStub
    });
    return;
  }

  if (url === FIREBASE_PREFIX + "firebase-auth.js") {
    await route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: authStub
    });
    return;
  }

  if (url === FIREBASE_PREFIX + "firebase-firestore.js") {
    await route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: firestoreStub
    });
    return;
  }

  if (url.startsWith(BASE)) {
    await route.continue();
    return;
  }

  await route.abort();
});

try {
  await page.goto(new URL("perfil.html", BASE).href, {
    waitUntil: "domcontentloaded"
  });

  await page.waitForFunction(() => {
    const body = document.body;
    const workspace = document.querySelector("#profile-workspace");
    const loading = document.querySelector("#profile-loading");

    return (
      !body.classList.contains("profile-auth-pending") &&
      workspace &&
      workspace.hidden === false &&
      loading &&
      loading.hidden === true
    );
  }, null, { timeout: 3000 });

  const state = await page.evaluate(() => ({
    pending:
      document.body.classList.contains("profile-auth-pending"),
    loadingHidden:
      document.querySelector("#profile-loading")?.hidden,
    gateHidden:
      document.querySelector("#profile-gate")?.hidden,
    workspaceHidden:
      document.querySelector("#profile-workspace")?.hidden,
    displayName:
      document.querySelector("#profile-display-name")?.textContent?.trim(),
    reloadCalls:
      globalThis.__profileReloadCalls || 0,
    firestoreReadCalls:
      globalThis.__profileFirestoreReadCalls || 0
  }));

  assert.equal(
    state.pending,
    false,
    "Verified local sessions must leave the pending bootstrap state"
  );
  assert.equal(
    state.loadingHidden,
    true,
    "The private-profile loading screen must be dismissed"
  );
  assert.equal(
    state.workspaceHidden,
    false,
    "The workspace must render before Firestore profile metadata resolves"
  );
  assert.equal(
    state.gateHidden,
    true,
    "A verified session must not fall back to the login gate"
  );
  assert.equal(
    state.displayName,
    "Sesión de prueba",
    "Auth identity should render while Firestore hydration is pending"
  );
  assert.equal(
    state.reloadCalls,
    0,
    "Already-verified users must not block startup on user.reload()"
  );
  assert.ok(
    state.firestoreReadCalls >= 1,
    "Profile hydration should still begin in the background"
  );

  assert.deepEqual(
    pageErrors,
    [],
    "Profile bootstrap should not raise browser errors"
  );

  await page.screenshot({
    path: "artifacts/profile-bootstrap/verified-session-nonblocking.png",
    fullPage: true,
    animations: "disabled"
  });

  process.stdout.write(
    "profile bootstrap OK: verified session renders while Firestore is pending\n"
  );
} finally {
  await browser.close();
}

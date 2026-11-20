import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Firestore private research rules require verified ownership", () => {
  const rules = read("firestore.rules");

  assert.match(rules, /request\.auth\.uid\s*==\s*userId/);
  assert.match(rules, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(rules, /match \/users\/\{userId\}/);
  assert.doesNotMatch(rules, /allow\s+(?:read|write|read, write):\s*if\s*true/);
});

test("manual works are explicitly separated from the public corpus", () => {
  const profile = read("js/profile.js");
  const data = read("js/user-data.js");
  const page = read("perfil.html");

  assert.match(profile, /origin:\s*"private-user-entry"/);
  assert.match(profile, /privateOnly:\s*true/);
  assert.match(data, /origin\s*=\s*"public-engine"/);
  assert.match(page, /no se publica/i);
  assert.match(page, /no entra al corpus/i);
});

test("dedicated auth page contains required authentication flows", () => {
  const auth = read("js/auth-page.js");
  const page = read("auth/index.html");
  const css = read("css/auth.css");

  assert.match(auth, /createUserWithEmailAndPassword/);
  assert.match(auth, /signInWithEmailAndPassword/);
  assert.match(auth, /GoogleAuthProvider/);
  assert.match(auth, /signInWithPopup/);
  assert.match(auth, /sendEmailVerification/);
  assert.match(auth, /sendPasswordResetEmail/);
  assert.match(page, /data-mode-tab="login"/);
  assert.match(page, /data-mode-tab="register"/);
  assert.match(page, /google-mark/);
  assert.match(css, /hero-school-athens\.jpg/);
  assert.match(page, /dominio público/i);
});

test("public search emits private save actions without importing Firestore", () => {
  const app = read("js/app.js");

  assert.match(app, /data-save-work-id/);
  assert.match(app, /data-save-author/);
  assert.match(app, /research-library:save-work/);
  assert.match(app, /research-library:save-author/);
  assert.doesNotMatch(
    app,
    /firebase-firestore\.js|from "\.\/firebase-client\.js"/
  );
});

test("profile workspace supports projects, subprojects and a private atlas", () => {
  const profile = read("js/profile.js");
  const page = read("perfil.html");

  assert.match(profile, /createProject/);
  assert.match(profile, /createSubproject/);
  assert.match(profile, /data-project-work-subproject/);
  assert.match(profile, /drawProjectAtlas/);
  assert.match(page, /id="project-atlas"/);
  assert.match(page, /Agregar trabajo que no existe en el motor/);
});

test("normalized work identifiers survive library to project moves", () => {
  const data = read("js/user-data.js");

  assert.match(data, /existingNormalizedId/);
  assert.match(data, /\["public-engine", "private-user-entry"\]/);
  assert.match(data, /for \(const childCollection of \["subprojects", "works"\]\)/);
});

test("new browser modules parse as JavaScript", () => {
  const files = [
    "js/firebase-config.js",
    "js/firebase-client.js",
    "js/user-data.js",
    "js/account-menu.js",
    "js/auth-page.js",
    "js/profile.js"
  ];

  for (const file of files) {
    const result = spawnSync(
      process.execPath,
      ["--check", join(root, file)],
      { encoding: "utf8" }
    );

    assert.equal(
      result.status,
      0,
      `${file} failed syntax check:\n${result.stderr || result.stdout}`
    );
  }
});

test("account menu loads without blocking critical navigation or theme code", () => {
  const theme = read("js/theme.js");
  const menu = read("js/mobile-site-menu.js");

  assert.doesNotMatch(theme, /^import "\.\/account-menu\.js";/);
  assert.doesNotMatch(menu, /^import "\.\/account-menu\.js";/);
  assert.match(theme, /void import\("\.\/account-menu\.js"\)/);
  assert.match(menu, /void import\("\.\/account-menu\.js"\)/);
});

test("Firebase browser SDK version is pinned consistently", () => {
  for (const file of [
    "js/firebase-client.js",
    "js/user-data.js",
    "js/auth-page.js",
    "js/profile.js"
  ]) {
    assert.match(read(file), /firebasejs\/13\.3\.0\//);
  }
});


test("Firebase production configuration is present and Auth uses Spanish", () => {
  const config = read("js/firebase-config.js");
  const client = read("js/firebase-client.js");

  assert.match(config, /projectId:\s*"investigacion-filosofica"/);
  assert.match(config, /authDomain:\s*"investigacion-filosofica\.firebaseapp\.com"/);
  assert.match(config, /apiKey:\s*"[^"]+"/);
  assert.match(config, /appId:\s*"[^"]+"/);
  assert.match(client, /auth\.languageCode\s*=\s*"es"/);
});


test("account dock yields to the site menu and modals", () => {
  const css = read("css/account.css");

  assert.match(css, /body\.site-menu-open \.account-dock\s*\{/);
  assert.match(css, /body\.site-menu-open \.account-dock[\s\S]*?pointer-events:\s*none/);
  assert.match(css, /body\.modal-open \.account-dock[\s\S]*?pointer-events:\s*none/);
});


test("public account dock is navigation-only and has no auth modal", () => {
  const account = read("js/account-menu.js");
  const css = read("css/account.css");

  assert.doesNotMatch(account, /^import\s+[\s\S]*firebase-auth\.js/m);
  assert.doesNotMatch(account, /auth-dialog|account-panel/);
  assert.match(account, /auth\/index\.html/);
  assert.match(account, /import\("\.\/firebase-client\.js"\)/);
  assert.match(account, /research-library:save-work/);
  assert.doesNotMatch(css, /\.auth-dialog|\.account-panel/);
});


test("authentication is a dedicated philosophical page, not a modal", () => {
  const page = read("auth/index.html");
  const css = read("css/auth.css");
  const account = read("js/account-menu.js");

  assert.match(page, /Cuenta de investigación/);
  assert.match(page, /La Escuela de Atenas/);
  assert.match(page, /Cuenta mínima, investigación privada/);
  assert.match(css, /\.auth-layout/);
  assert.match(css, /url\("\.\.\/assets\/hero-school-athens\.jpg"\)/);
  assert.doesNotMatch(account, /aria-modal|role="dialog"/);
});


test("account dock uses a progressive-enhancement link and mounts once", () => {
  const account = read("js/account-menu.js");

  assert.match(account, /<a[\s\S]*class="account-trigger"/);
  assert.match(account, /href="\$\{authUrl\("login"\)\}"/);
  assert.match(account, /data-research-account-dock/);
  assert.match(account, /document\.querySelector\([\s\S]*data-research-account-dock/);
  assert.match(account, /export\s*\{[\s\S]*authUrl,[\s\S]*navigateToAuth/);
});

test("account dock label and toast animate without layout motion", () => {
  const css = read("css/account.css");
  const account = read("js/account-menu.js");

  assert.match(css, /\.account-trigger-label\s*\{/);
  assert.match(css, /\.account-toast\.is-visible\s*\{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.account-trigger-label[\s\S]*display:\s*none/);
  assert.match(account, /requestAnimationFrame\(/);
  assert.match(account, /aria-busy/);
  assert.match(account, /dataset\.originalText/);
});

test("account dock keeps Firebase lazy until a private save action", () => {
  const account = read("js/account-menu.js");

  assert.doesNotMatch(account, /^import\s+[\s\S]*firebase-client\.js/m);
  assert.doesNotMatch(account, /^import\s+[\s\S]*user-data\.js/m);
  assert.match(account, /import\("\.\/firebase-client\.js"\)/);
  assert.match(account, /import\("\.\/user-data\.js"\)/);
});

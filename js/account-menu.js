const SITE_ROOT = new URL("../", import.meta.url);
const href = path => new URL(path, SITE_ROOT).href;

const PENDING_KEY = "research-pending-save-v1";
const RETURN_KEY = "research-auth-return-v1";

let runtimePromise = null;
let toastTimer = null;

function ensureStylesheet() {
  if (document.querySelector('link[data-account-styles]')) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href("css/account.css?v=20261120-auth-page-v2");
  link.dataset.accountStyles = "";
  document.head.append(link);
}

function personIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="8" r="3.5"></circle>
      <path d="M5.5 20c.6-4 2.7-6.2 6.5-6.2s5.9 2.2 6.5 6.2"></path>
    </svg>
  `;
}

function authUrl(mode = "login") {
  const url = new URL("auth/index.html", SITE_ROOT);
  url.searchParams.set("mode", mode === "register" ? "register" : "login");
  return url.href;
}

function goToAuth(mode = "login") {
  location.href = authUrl(mode);
}

function stagePending(type, payload) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ type, payload }));
    sessionStorage.setItem(RETURN_KEY, location.href);
  } catch {
    // La autenticación seguirá funcionando aunque sessionStorage no esté disponible.
  }
}

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import("./firebase-client.js"),
      import("./user-data.js")
    ]).then(([client, data]) => ({ ...client, ...data }));
  }

  return runtimePromise;
}

async function verifiedUser(runtime) {
  if (!runtime.firebaseReady() || !runtime.auth) return null;

  await runtime.persistenceReady;

  if (typeof runtime.auth.authStateReady === "function") {
    await runtime.auth.authStateReady();
  }

  const user = runtime.auth.currentUser;
  return user?.emailVerified ? user : null;
}

ensureStylesheet();

const dock = document.createElement("div");
dock.className = "account-dock";
dock.innerHTML = `
  <button
    class="account-trigger"
    type="button"
    aria-label="Cuenta de investigación"
    title="Cuenta de investigación"
  >
    ${personIcon()}
  </button>
`;

const toast = document.createElement("div");
toast.className = "account-toast";
toast.hidden = true;
toast.setAttribute("role", "status");
toast.setAttribute("aria-live", "polite");

document.body.append(dock, toast);

const trigger = dock.querySelector(".account-trigger");

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

trigger.addEventListener("click", () => {
  goToAuth("login");
});

window.addEventListener("research-account:open", event => {
  goToAuth(event.detail?.mode || "login");
});

window.addEventListener("research-library:save-work", async event => {
  const work = event.detail?.work;
  const sourceButton = event.detail?.trigger;

  try {
    const runtime = await loadRuntime();
    const user = await verifiedUser(runtime);

    if (!user) {
      stagePending("work", work);
      goToAuth("login");
      return;
    }

    if (sourceButton) {
      sourceButton.disabled = true;
      sourceButton.textContent = "Guardando…";
    }

    await runtime.saveLibraryWork(user.uid, work, {
      origin: "public-engine",
      privateOnly: false
    });

    if (sourceButton) {
      sourceButton.textContent = "Guardada";
      sourceButton.dataset.saved = "true";
    }

    showToast("Obra guardada en su biblioteca privada.");
  } catch (error) {
    console.error(error);

    if (sourceButton) {
      sourceButton.disabled = false;
      sourceButton.textContent = "Guardar";
    }

    showToast("No fue posible guardar la obra.");
  }
});

window.addEventListener("research-library:save-author", async event => {
  const author = event.detail?.author;
  const sourceButton = event.detail?.trigger;

  try {
    const runtime = await loadRuntime();
    const user = await verifiedUser(runtime);

    if (!user) {
      stagePending("author", author);
      goToAuth("login");
      return;
    }

    if (sourceButton) {
      sourceButton.disabled = true;
      sourceButton.textContent = "Guardando…";
    }

    await runtime.saveAuthor(user.uid, author);

    if (sourceButton) {
      sourceButton.textContent = "Guardado";
      sourceButton.dataset.saved = "true";
    }

    showToast("Autor guardado en su espacio privado.");
  } catch (error) {
    console.error(error);

    if (sourceButton) {
      sourceButton.disabled = false;
      sourceButton.textContent = "Guardar autor";
    }

    showToast("No fue posible guardar el autor.");
  }
});

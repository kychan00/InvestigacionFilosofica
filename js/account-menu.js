const AUTH_HINT_KEY = "research-auth-verified-v1";

function hasVerifiedAuthHint() {
  try {
    const raw = localStorage.getItem(AUTH_HINT_KEY);
    if (!raw) return false;
    const value = JSON.parse(raw);
    return value?.verified === true;
  } catch {
    return false;
  }
}

function markVerifiedAuthHint() {
  try {
    localStorage.setItem(
      AUTH_HINT_KEY,
      JSON.stringify({
        verified: true,
        updatedAt: Date.now()
      })
    );
  } catch {
    // Firebase sigue siendo la fuente real de autenticación.
  }
}

function clearVerifiedAuthHint() {
  try {
    localStorage.removeItem(AUTH_HINT_KEY);
  } catch {
    // No bloquear la navegación por storage.
  }
}

const SITE_ROOT = new URL("../", import.meta.url);

const PENDING_KEY = "research-pending-save-v1";
const RETURN_KEY = "research-auth-return-v1";

let runtimePromise = null;
let toastTimer = null;

function siteUrl(path) {
  return new URL(path, SITE_ROOT).href;
}

function authUrl(mode = "login") {
  const url = new URL("auth/index.html", SITE_ROOT);
  url.searchParams.set("mode", mode === "register" ? "register" : "login");
  return url.href;
}

function navigateToAuth(mode = "login") {
  window.location.assign(authUrl(mode));
}

function ensureStylesheet() {
  if (document.querySelector("link[data-account-styles]")) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = siteUrl("css/account.css?v=20261120-corpus-save-v3");
  link.dataset.accountStyles = "";
  document.head.append(link);
}

function personIcon() {
  return `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.65"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="8" r="3.5"></circle>
      <path d="M5.5 20c.6-4 2.7-6.2 6.5-6.2s5.9 2.2 6.5 6.2"></path>
    </svg>
  `;
}

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import("./firebase-client.js"),
      import("./user-data.js")
    ]).then(([client, data]) => ({
      ...client,
      ...data
    }));
  }

  return runtimePromise;
}

async function getVerifiedUser(runtime) {
  if (!runtime?.firebaseReady?.() || !runtime.auth) {
    return null;
  }

  await runtime.persistenceReady;

  if (typeof runtime.auth.authStateReady === "function") {
    await runtime.auth.authStateReady();
  }

  const user = runtime.auth.currentUser;

  if (user?.emailVerified) {
    markVerifiedAuthHint();
    return user;
  }

  clearVerifiedAuthHint();
  return null;
}

function stagePendingAction(type, payload) {
  if (!payload) return false;

  try {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        type,
        payload,
        createdAt: Date.now()
      })
    );

    sessionStorage.setItem(RETURN_KEY, window.location.href);
    return true;
  } catch (error) {
    console.warn(
      "No se pudo conservar temporalmente la acción de investigación.",
      error
    );
    return false;
  }
}

function createToast() {
  const toast = document.createElement("div");
  toast.className = "account-toast";
  toast.hidden = true;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.setAttribute("aria-atomic", "true");
  return toast;
}

function showToast(toast, message) {
  if (!toast) return;

  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");

    window.setTimeout(() => {
      toast.hidden = true;
    }, 180);
  }, 3400);
}

function isSaveIcon(button) {
  return Boolean(button?.hasAttribute("data-save-icon"));
}

function setSavingState(button, text = "Guardando…") {
  if (!button) return;

  if (isSaveIcon(button)) {
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel =
        button.getAttribute("aria-label") || "Guardar";
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.classList.add("is-saving");
    button.setAttribute("aria-label", text);
    button.title = text;
    return;
  }

  if (!button.dataset.originalText) {
    button.dataset.originalText =
      button.textContent?.trim() || "Guardar";
  }

  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = text;
}

function setSavedState(button, text = "Guardada") {
  if (!button) return;

  button.disabled = true;
  button.removeAttribute("aria-busy");
  button.dataset.saved = "true";

  if (isSaveIcon(button)) {
    button.classList.remove("is-saving");
    button.classList.add("is-saved");
    button.setAttribute("aria-label", "Guardado");
    button.title = "Guardado";
    return;
  }

  button.textContent = text;
}

function restoreButton(button, fallback = "Guardar") {
  if (!button) return;

  button.disabled = false;
  button.removeAttribute("aria-busy");

  if (isSaveIcon(button)) {
    button.classList.remove("is-saving", "is-saved");
    const label = button.dataset.originalLabel || fallback;
    button.setAttribute("aria-label", label);
    button.title = label;
    return;
  }

  button.textContent =
    button.dataset.originalText || fallback;
}

function mountAccountDock() {
  const existing = document.querySelector(
    "[data-research-account-dock]"
  );

  if (existing) {
    return {
      dock: existing,
      toast: document.querySelector(
        "[data-research-account-toast]"
      )
    };
  }

  ensureStylesheet();

  const dock = document.createElement("div");
  dock.className = "account-dock";
  dock.dataset.researchAccountDock = "";

  dock.innerHTML = `
    <a
      class="account-trigger"
      href="${hasVerifiedAuthHint() ? siteUrl("perfil.html") : authUrl("login")}"
      aria-label="Abrir cuenta de investigación"
      title="Cuenta de investigación"
    >
      ${personIcon()}
      <span class="account-trigger-label" aria-hidden="true">
        Espacio personal
      </span>
    </a>
  `;

  const toast = createToast();
  toast.dataset.researchAccountToast = "";

  document.body.append(dock, toast);

  return {
    dock,
    toast
  };
}

const { toast } = mountAccountDock();

window.addEventListener("research-account:open", event => {
  const mode =
    event.detail?.mode === "register"
      ? "register"
      : "login";

  navigateToAuth(mode);
});

window.addEventListener("research-library:save-work", async event => {
  const work = event.detail?.work;
  const sourceButton = event.detail?.trigger;

  if (!work) {
    console.warn("Se solicitó guardar una obra sin datos.");
    return;
  }

  try {
    setSavingState(sourceButton);

    const runtime = await loadRuntime();
    const user = await getVerifiedUser(runtime);

    if (!user) {
      restoreButton(sourceButton);
      stagePendingAction("work", work);
      navigateToAuth("login");
      return;
    }

    await runtime.saveLibraryWork(user.uid, work, {
      origin: "public-engine",
      privateOnly: false
    });

    setSavedState(sourceButton, "Guardada");
    showToast(
      toast,
      "Obra guardada en su biblioteca privada."
    );
  } catch (error) {
    console.error("No fue posible guardar la obra.", error);
    restoreButton(sourceButton, "Guardar");
    showToast(toast, "No fue posible guardar la obra.");
  }
});

window.addEventListener("research-library:save-author", async event => {
  const author = event.detail?.author;
  const sourceButton = event.detail?.trigger;

  if (!author) {
    console.warn("Se solicitó guardar un autor sin datos.");
    return;
  }

  try {
    setSavingState(sourceButton);

    const runtime = await loadRuntime();
    const user = await getVerifiedUser(runtime);

    if (!user) {
      restoreButton(sourceButton, "Guardar autor");
      stagePendingAction("author", author);
      navigateToAuth("login");
      return;
    }

    await runtime.saveAuthor(user.uid, author);

    setSavedState(sourceButton, "Guardado");
    showToast(
      toast,
      "Autor guardado en su espacio privado."
    );
  } catch (error) {
    console.error("No fue posible guardar el autor.", error);
    restoreButton(sourceButton, "Guardar autor");
    showToast(toast, "No fue posible guardar el autor.");
  }
});

export {
  authUrl,
  navigateToAuth
};

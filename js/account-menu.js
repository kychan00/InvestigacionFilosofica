import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
  auth,
  firebaseReady,
  persistenceReady
} from "./firebase-client.js";

import {
  ensureUserProfile,
  saveAuthor,
  saveLibraryWork
} from "./user-data.js";

const SITE_ROOT = new URL("../", import.meta.url);
const href = path => new URL(path, SITE_ROOT).href;

function ensureStylesheet() {
  if (document.querySelector('link[data-account-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href("css/account.css?v=20261120-firebase-profile-v1");
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

function friendlyAuthError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/email-already-in-use": "Ese correo ya está registrado.",
    "auth/invalid-email": "El correo no tiene un formato válido.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/popup-closed-by-user": "Se cerró la ventana de Google antes de terminar.",
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google.",
    "auth/network-request-failed": "No fue posible conectar con Firebase.",
    "auth/too-many-requests": "Demasiados intentos. Intente de nuevo más tarde."
  };
  return messages[code] || error?.message || "No fue posible completar la operación.";
}

ensureStylesheet();

const dock = document.createElement("div");
dock.className = "account-dock";
dock.innerHTML = `
  <button
    class="account-trigger"
    type="button"
    aria-label="Cuenta de investigación"
    aria-expanded="false"
  >
    ${personIcon()}
  </button>

  <section
    class="account-panel"
    aria-label="Cuenta de investigación"
    hidden
  ></section>
`;

const dialog = document.createElement("section");
dialog.className = "auth-dialog";
dialog.hidden = true;
dialog.setAttribute("role", "dialog");
dialog.setAttribute("aria-modal", "true");
dialog.setAttribute("aria-labelledby", "auth-dialog-title");
dialog.innerHTML = `
  <button class="auth-dialog-backdrop" type="button" data-auth-close aria-label="Cerrar"></button>
  <div class="auth-dialog-panel">
    <header class="auth-dialog-head">
      <div>
        <span class="auth-dialog-kicker">Φ / ESPACIO PERSONAL</span>
        <h2 id="auth-dialog-title">Cuenta de investigación</h2>
      </div>
      <button class="auth-dialog-close" type="button" data-auth-close aria-label="Cerrar">×</button>
    </header>

    <div class="auth-tabs" role="tablist" aria-label="Acceso">
      <button class="auth-tab" type="button" role="tab" data-auth-tab="login" aria-selected="true">Login</button>
      <button class="auth-tab" type="button" role="tab" data-auth-tab="register" aria-selected="false">Registro</button>
    </div>

    <section class="auth-pane" data-auth-pane="login">
      <p class="auth-pane-intro">
        Inicie sesión únicamente para guardar obras, autores y proyectos de investigación.
        La búsqueda pública sigue funcionando sin cuenta.
      </p>

      <form class="auth-form" data-login-form>
        <label class="auth-field">
          <span>Correo</span>
          <input type="email" name="email" autocomplete="email" required>
        </label>
        <label class="auth-field">
          <span>Contraseña</span>
          <input type="password" name="password" autocomplete="current-password" required>
        </label>
        <button class="auth-submit" type="submit">Entrar</button>
      </form>

      <div class="auth-helper-row">
        <button class="auth-text-button" type="button" data-reset-password>Olvidé mi contraseña</button>
      </div>

      <div class="auth-separator"><span>o</span></div>
      <button class="auth-google" type="button" data-google-login>Continuar con Google</button>
    </section>

    <section class="auth-pane" data-auth-pane="register" hidden>
      <p class="auth-pane-intro">
        Cree una cuenta para construir una biblioteca y proyectos privados.
        Las entradas manuales que agregue serán visibles únicamente para usted.
      </p>

      <form class="auth-form" data-register-form>
        <label class="auth-field">
          <span>Nombre visible</span>
          <input type="text" name="displayName" autocomplete="name" maxlength="160" required>
        </label>
        <label class="auth-field">
          <span>Correo</span>
          <input type="email" name="email" autocomplete="email" required>
        </label>
        <label class="auth-field">
          <span>Contraseña</span>
          <input type="password" name="password" autocomplete="new-password" minlength="6" required>
        </label>
        <button class="auth-submit" type="submit">Crear cuenta</button>
      </form>

      <div class="auth-separator"><span>o</span></div>
      <button class="auth-google" type="button" data-google-register>Registrarme con Google</button>
    </section>

    <p class="auth-status" data-auth-status aria-live="polite"></p>
  </div>
`;

const toast = document.createElement("div");
toast.className = "account-toast";
toast.hidden = true;
toast.setAttribute("role", "status");
toast.setAttribute("aria-live", "polite");

document.body.append(dock, dialog, toast);

const trigger = dock.querySelector(".account-trigger");
const panel = dock.querySelector(".account-panel");
const status = dialog.querySelector("[data-auth-status]");
let currentUser = null;
let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

function setStatus(message = "", kind = "") {
  status.textContent = message;
  status.classList.toggle("is-error", kind === "error");
  status.classList.toggle("is-success", kind === "success");
}

function closePanel() {
  panel.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
}

function openDialog(mode = "login") {
  closePanel();
  dialog.hidden = false;
  document.body.style.overflow = "hidden";
  setAuthTab(mode);
  setStatus(
    firebaseReady()
      ? ""
      : "Firebase todavía no está configurado en este despliegue.",
    firebaseReady() ? "" : "error"
  );
  const first = dialog.querySelector(
    mode === "register"
      ? '[data-register-form] input'
      : '[data-login-form] input'
  );
  queueMicrotask(() => first?.focus());
}

function closeDialog() {
  dialog.hidden = true;
  document.body.style.overflow = "";
  setStatus("");
}

function setAuthTab(mode) {
  const chosen = mode === "register" ? "register" : "login";

  dialog.querySelectorAll("[data-auth-tab]").forEach(button => {
    button.setAttribute(
      "aria-selected",
      String(button.dataset.authTab === chosen)
    );
  });

  dialog.querySelectorAll("[data-auth-pane]").forEach(pane => {
    pane.hidden = pane.dataset.authPane !== chosen;
  });
}

function avatarMarkup(user) {
  if (user?.photoURL) {
    return `<img src="${user.photoURL.replace(/"/g, "&quot;")}" alt="">`;
  }
  const initial = (user?.displayName || user?.email || "Φ")
    .trim()
    .charAt(0)
    .toUpperCase();
  return `<span>${initial}</span>`;
}

function renderPanel() {
  if (!currentUser) {
    panel.innerHTML = `
      <span class="account-panel-kicker">ESPACIO PERSONAL</span>
      <h2>Su investigación, guardada.</h2>
      <p>
        La cuenta solo se usa para conservar obras, autores y proyectos privados.
        No es necesaria para consultar el archivo público.
      </p>
      <div class="account-panel-actions">
        <button class="account-action is-primary" type="button" data-open-login>Login</button>
        <button class="account-action" type="button" data-open-register>Registro</button>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <span class="account-panel-kicker">SESIÓN ACTIVA</span>
    <div class="account-profile-summary">
      <span class="account-profile-avatar">${avatarMarkup(currentUser)}</span>
      <span class="account-profile-copy">
        <strong>${(currentUser.displayName || "Investigador").replace(/</g, "&lt;")}</strong>
        <small>${(currentUser.email || "").replace(/</g, "&lt;")}</small>
      </span>
    </div>
    <div class="account-panel-actions">
      <a class="account-action is-primary" href="${href("perfil.html")}">Perfil y proyectos</a>
      <a class="account-action" href="${href("perfil.html#biblioteca")}">Biblioteca guardada</a>
      <button class="account-action" type="button" data-sign-out>Cerrar sesión</button>
    </div>
  `;
}

function updateTrigger() {
  trigger.classList.toggle("is-authenticated", Boolean(currentUser));
  trigger.innerHTML = currentUser
    ? `<span class="account-trigger-initial">${(
        currentUser.displayName ||
        currentUser.email ||
        "Φ"
      ).trim().charAt(0).toUpperCase()}</span>`
    : personIcon();

  trigger.setAttribute(
    "aria-label",
    currentUser
      ? "Abrir cuenta de investigación"
      : "Login o registro"
  );

  renderPanel();
}

async function verifiedUserOrReject(user) {
  await user.reload();
  if (!user.emailVerified) {
    await signOut(auth);
    throw new Error(
      "Verifique su correo antes de iniciar sesión. Revise el mensaje que enviamos a su bandeja de entrada."
    );
  }
  return user;
}

async function googleFlow() {
  if (!firebaseReady()) {
    throw new Error("Firebase todavía no está configurado.");
  }
  await persistenceReady;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  await ensureUserProfile(credential.user);
  return credential.user;
}

trigger.addEventListener("click", event => {
  event.stopPropagation();
  const next = panel.hidden;
  panel.hidden = !next;
  trigger.setAttribute("aria-expanded", String(next));
});

document.addEventListener("click", event => {
  if (!dock.contains(event.target)) {
    closePanel();
  }
});

dock.addEventListener("click", async event => {
  const login = event.target.closest("[data-open-login]");
  const register = event.target.closest("[data-open-register]");
  const logout = event.target.closest("[data-sign-out]");

  if (login) openDialog("login");
  if (register) openDialog("register");

  if (logout && auth) {
    await signOut(auth);
    closePanel();
  }
});

dialog.addEventListener("click", event => {
  if (event.target.closest("[data-auth-close]")) {
    closeDialog();
    return;
  }

  const tab = event.target.closest("[data-auth-tab]");
  if (tab) {
    setAuthTab(tab.dataset.authTab);
    setStatus("");
  }
});

dialog.querySelector("[data-login-form]")
  .addEventListener("submit", async event => {
    event.preventDefault();
    if (!firebaseReady()) {
      setStatus("Firebase todavía no está configurado.", "error");
      return;
    }

    const form = new FormData(event.currentTarget);
    setStatus("Comprobando credenciales…");

    try {
      await persistenceReady;
      const credential = await signInWithEmailAndPassword(
        auth,
        String(form.get("email") || "").trim(),
        String(form.get("password") || "")
      );
      await verifiedUserOrReject(credential.user);
      await ensureUserProfile(credential.user);
      setStatus("Sesión iniciada.", "success");
      setTimeout(closeDialog, 500);
    } catch (error) {
      setStatus(friendlyAuthError(error), "error");
    }
  });

dialog.querySelector("[data-register-form]")
  .addEventListener("submit", async event => {
    event.preventDefault();
    if (!firebaseReady()) {
      setStatus("Firebase todavía no está configurado.", "error");
      return;
    }

    const form = new FormData(event.currentTarget);
    setStatus("Creando cuenta…");

    try {
      await persistenceReady;
      const credential = await createUserWithEmailAndPassword(
        auth,
        String(form.get("email") || "").trim(),
        String(form.get("password") || "")
      );

      await updateProfile(credential.user, {
        displayName: String(form.get("displayName") || "").trim()
      });

      await sendEmailVerification(credential.user);
      await signOut(auth);

      setAuthTab("login");
      setStatus(
        "Cuenta creada. Le enviamos un correo de verificación. Verifique su dirección y después inicie sesión.",
        "success"
      );
    } catch (error) {
      setStatus(friendlyAuthError(error), "error");
    }
  });

for (const button of dialog.querySelectorAll(
  "[data-google-login], [data-google-register]"
)) {
  button.addEventListener("click", async () => {
    setStatus("Abriendo Google…");
    try {
      await googleFlow();
      setStatus("Sesión iniciada.", "success");
      setTimeout(closeDialog, 500);
    } catch (error) {
      setStatus(friendlyAuthError(error), "error");
    }
  });
}

dialog.querySelector("[data-reset-password]")
  .addEventListener("click", async () => {
    if (!firebaseReady()) {
      setStatus("Firebase todavía no está configurado.", "error");
      return;
    }

    const loginForm = dialog.querySelector("[data-login-form]");
    const email = loginForm.elements.email.value.trim();

    if (!email) {
      setStatus("Escriba primero su correo en el campo de Login.", "error");
      loginForm.elements.email.focus();
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setStatus(
        "Si ese correo está registrado, recibirá instrucciones para restablecer la contraseña.",
        "success"
      );
    } catch (error) {
      setStatus(friendlyAuthError(error), "error");
    }
  });

window.addEventListener("keydown", event => {
  if (event.key === "Escape" && !dialog.hidden) {
    closeDialog();
  }
});

window.addEventListener("research-account:open", event => {
  openDialog(event.detail?.mode || "login");
});

window.addEventListener("research-library:save-work", async event => {
  const work = event.detail?.work;
  const sourceButton = event.detail?.trigger;

  if (!currentUser) {
    openDialog("login");
    setStatus("Inicie sesión para guardar esta obra.", "error");
    return;
  }

  try {
    if (sourceButton) {
      sourceButton.disabled = true;
      sourceButton.textContent = "Guardando…";
    }

    await saveLibraryWork(currentUser.uid, work, {
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

  if (!currentUser) {
    openDialog("login");
    setStatus("Inicie sesión para guardar este autor.", "error");
    return;
  }

  try {
    if (sourceButton) {
      sourceButton.disabled = true;
      sourceButton.textContent = "Guardando…";
    }

    await saveAuthor(currentUser.uid, author);

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

if (firebaseReady()) {
  onAuthStateChanged(auth, async user => {
    currentUser = user?.emailVerified ? user : null;

    if (currentUser) {
      try {
        await ensureUserProfile(currentUser);
      } catch (error) {
        console.warn("No se pudo sincronizar el perfil.", error);
      }
    }

    updateTrigger();
  });
} else {
  updateTrigger();
}

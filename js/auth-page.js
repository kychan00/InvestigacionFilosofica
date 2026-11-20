import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
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

const PENDING_KEY = "research-pending-save-v1";
const RETURN_KEY = "research-auth-return-v1";

const feedback = document.querySelector("#auth-feedback");
const subtitle = document.querySelector("#auth-subtitle");
const tabs = [...document.querySelectorAll("[data-mode-tab]")];
const views = [...document.querySelectorAll("[data-mode-view]")];
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const forgotButton = document.querySelector("#forgot-password-btn");
const loginGoogle = document.querySelector("#login-google-btn");
const registerGoogle = document.querySelector("#register-google-btn");

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

function setFeedback(message = "", kind = "") {
  feedback.textContent = message;
  feedback.hidden = !message;
  feedback.classList.toggle("is-error", kind === "error");
  feedback.classList.toggle("is-success", kind === "success");
}

function setMode(mode, { updateUrl = true } = {}) {
  const chosen = mode === "register" ? "register" : "login";

  tabs.forEach(tab => {
    tab.classList.toggle("is-active", tab.dataset.modeTab === chosen);
    tab.setAttribute("aria-selected", String(tab.dataset.modeTab === chosen));
  });

  views.forEach(view => {
    view.classList.toggle("is-active", view.dataset.modeView === chosen);
  });

  subtitle.textContent = chosen === "register"
    ? "Cree una cuenta para comenzar a guardar obras, autores y proyectos privados."
    : "Inicie sesión para entrar en su biblioteca y proyectos privados.";

  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set("mode", chosen);
    history.replaceState({}, "", url);
  }

  setFeedback("");
}

function safeReturnUrl() {
  try {
    const stored = sessionStorage.getItem(RETURN_KEY);
    if (!stored) return new URL("../perfil.html", location.href).href;
    const url = new URL(stored, location.href);
    if (url.origin !== location.origin) throw new Error("external-return");
    return url.href;
  } catch {
    return new URL("../perfil.html", location.href).href;
  }
}

async function completePendingSave(user) {
  let pending = null;

  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
  } catch {
    pending = null;
  }

  if (!pending?.type || !pending?.payload) return;

  if (pending.type === "work") {
    await saveLibraryWork(user.uid, pending.payload, {
      origin: "public-engine",
      privateOnly: false
    });
  }

  if (pending.type === "author") {
    await saveAuthor(user.uid, pending.payload);
  }

  sessionStorage.removeItem(PENDING_KEY);
}

async function finishSignIn(user) {
  await user.reload();

  if (!user.emailVerified) {
    await signOut(auth);
    throw new Error(
      "Verifique su correo antes de iniciar sesión. Revise el mensaje de Investigación Filosófica."
    );
  }

  await ensureUserProfile(user);
  await completePendingSave(user);

  const destination = safeReturnUrl();
  sessionStorage.removeItem(RETURN_KEY);
  location.href = destination;
}

async function googleFlow() {
  if (!firebaseReady()) throw new Error("Firebase todavía no está configurado.");

  await persistenceReady;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const credential = await signInWithPopup(auth, provider);
  await ensureUserProfile(credential.user);
  await completePendingSave(credential.user);

  const destination = safeReturnUrl();
  sessionStorage.removeItem(RETURN_KEY);
  location.href = destination;
}

for (const tab of tabs) {
  tab.addEventListener("click", () => setMode(tab.dataset.modeTab));
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  setFeedback("Comprobando credenciales…");

  try {
    if (!firebaseReady()) throw new Error("Firebase todavía no está configurado.");

    await persistenceReady;

    const form = new FormData(loginForm);
    const credential = await signInWithEmailAndPassword(
      auth,
      String(form.get("email") || "").trim(),
      String(form.get("password") || "")
    );

    await finishSignIn(credential.user);
  } catch (error) {
    setFeedback(friendlyAuthError(error), "error");
  }
});

registerForm.addEventListener("submit", async event => {
  event.preventDefault();
  setFeedback("Creando su espacio personal…");

  try {
    if (!firebaseReady()) throw new Error("Firebase todavía no está configurado.");

    await persistenceReady;

    const form = new FormData(registerForm);
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

    setMode("login");
    setFeedback(
      "Cuenta creada. Le enviamos un correo de verificación. Verifique su dirección y después inicie sesión.",
      "success"
    );
  } catch (error) {
    setFeedback(friendlyAuthError(error), "error");
  }
});

forgotButton.addEventListener("click", async () => {
  const email = loginForm.elements.email.value.trim();

  if (!email) {
    setFeedback("Escriba primero su correo en el campo de Login.", "error");
    loginForm.elements.email.focus();
    return;
  }

  try {
    if (!firebaseReady()) throw new Error("Firebase todavía no está configurado.");
    await sendPasswordResetEmail(auth, email);
    setFeedback(
      "Si ese correo está registrado, recibirá instrucciones para restablecer la contraseña.",
      "success"
    );
  } catch (error) {
    setFeedback(friendlyAuthError(error), "error");
  }
});

loginGoogle.addEventListener("click", async () => {
  setFeedback("Abriendo Google…");

  try {
    await googleFlow();
  } catch (error) {
    setFeedback(friendlyAuthError(error), "error");
  }
});

registerGoogle.addEventListener("click", async () => {
  setFeedback("Abriendo Google…");

  try {
    await googleFlow();
  } catch (error) {
    setFeedback(friendlyAuthError(error), "error");
  }
});

const requestedMode = new URLSearchParams(location.search).get("mode");
setMode(requestedMode === "register" ? "register" : "login", { updateUrl: false });

if (!firebaseReady()) {
  setFeedback("Firebase todavía no está configurado en este despliegue.", "error");
} else {
  await persistenceReady;

  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }

  if (auth.currentUser?.emailVerified) {
    await ensureUserProfile(auth.currentUser);
    await completePendingSave(auth.currentUser);
    const destination = safeReturnUrl();
    sessionStorage.removeItem(RETURN_KEY);
    location.replace(destination);
  }
}

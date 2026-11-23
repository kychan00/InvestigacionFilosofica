import { hasVerifiedAuthHint } from "./auth-session-hint.js";
import { createCorpusAppearanceController } from "./corpus-appearance-runtime.js";
import { isCorpusAppearanceRoute } from "./corpus-appearance-policy.js";

const ROOT_PATH = new URL("../", import.meta.url).pathname;

/* Explicit opt-in: no theme controller on tesis, revistas or other pages. */
if (isCorpusAppearanceRoute(window.location.pathname, ROOT_PATH)) {
  const root = document.documentElement;
  const controller = createCorpusAppearanceController({
    pathname: window.location.pathname,
    basePath: ROOT_PATH,
    readPreference(key) {
      return localStorage.getItem(key);
    },
    writePreference(key, value) {
      localStorage.setItem(key, value);
    },
    async readRemoteProfile(uid) {
      const { getUserProfile } = await import("./user-data.js");
      // A slow or unavailable Firestore must not freeze the public search.
      let timer;
      try {
        return await Promise.race([
          getUserProfile(uid),
          new Promise((_, reject) => {
            timer = window.setTimeout(() => reject(new Error("profile-theme-timeout")), 4500);
          })
        ]);
      } finally {
        window.clearTimeout(timer);
      }
    },
    applyShell(shell) {
      root.dataset.corpusShell = shell;
      window.dispatchEvent(new CustomEvent("corpusappearancechange", {
        detail: { shell }
      }));
    },
    onError(error) {
      console.warn("No se pudo sincronizar la apariencia del corpus.", error);
    }
  });

  root.dataset.corpusShell = "default";

  let bootStarted = false;

  async function startVerifiedSessionBridge() {
    if (bootStarted || !hasVerifiedAuthHint()) return;
    bootStarted = true;

    try {
      const [{ auth, persistenceReady, firebaseReady }, { onAuthStateChanged }] =
        await Promise.all([
          import("./firebase-client.js"),
          import("https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js")
        ]);

      await persistenceReady;

      if (!firebaseReady() || !auth) {
        await controller.leaveUser();
        return;
      }

      onAuthStateChanged(auth, user => {
        void controller.enterUser(user);
      }, error => {
        console.warn("No se pudo verificar la sesión de apariencia.", error);
        void controller.leaveUser();
      });
    } catch (error) {
      bootStarted = false; // retry only after an explicit session change
      await controller.leaveUser();
      console.warn("El buscador mantiene el aspecto predeterminado.", error);
    }
  }

  window.addEventListener("storage", event => {
    if (event.key === "research-auth-verified-v1") {
      if (hasVerifiedAuthHint()) {
        void startVerifiedSessionBridge();
      } else {
        void controller.leaveUser();
      }
      return;
    }
    controller.storageChanged(event.key, event.newValue);
  });

  window.addEventListener("research-auth-hint-change", event => {
    if (event.detail?.active === true) {
      void startVerifiedSessionBridge();
    } else {
      void controller.leaveUser();
    }
  });

  // Never hold the first paint, search handlers or results for Firebase.
  if (document.readyState === "complete") {
    void startVerifiedSessionBridge();
  } else {
    window.addEventListener("load", () => {
      void startVerifiedSessionBridge();
    }, { once: true });
  }
}

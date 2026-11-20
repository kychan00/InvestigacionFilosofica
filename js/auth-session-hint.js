const AUTH_HINT_KEY = "research-auth-verified-v1";
const AUTH_HINT_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

function dispatchHintChange(active) {
  window.dispatchEvent(
    new CustomEvent("research-auth-hint-change", {
      detail: { active }
    })
  );
}

export function markVerifiedAuthHint() {
  try {
    localStorage.setItem(
      AUTH_HINT_KEY,
      JSON.stringify({
        verified: true,
        updatedAt: Date.now()
      })
    );
    dispatchHintChange(true);
  } catch {
    // La sesión real sigue perteneciendo a Firebase.
  }
}

export function clearVerifiedAuthHint() {
  try {
    localStorage.removeItem(AUTH_HINT_KEY);
  } catch {
    // No bloquear el cierre de sesión por storage.
  }

  dispatchHintChange(false);
}

export function hasVerifiedAuthHint() {
  try {
    const raw = localStorage.getItem(AUTH_HINT_KEY);
    if (!raw) return false;

    const value = JSON.parse(raw);
    const updatedAt = Number(value?.updatedAt || 0);

    if (
      value?.verified !== true ||
      !updatedAt ||
      Date.now() - updatedAt > AUTH_HINT_MAX_AGE
    ) {
      localStorage.removeItem(AUTH_HINT_KEY);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

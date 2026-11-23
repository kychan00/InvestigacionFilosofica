/**
 * Contrato de apariencia del corpus bibliográfico (fase 0).
 * Solo controla presentación: no modifica datos, búsqueda ni ranking.
 * Sin Firebase ni DOM, para mantener ligero el buscador público.
 */
export const CORPUS_SHELL_DEFAULT = "default";
export const CORPUS_SHELL_IDS = Object.freeze([
  "default", "territory", "marginalia", "observatory"
]);

export function normalizeCorpusShell(value) {
  return CORPUS_SHELL_IDS.includes(value) ? value : CORPUS_SHELL_DEFAULT;
}

/** Solo / o /index.html, también bajo el prefijo de GitHub Pages. */
export function isCorpusAppearanceRoute(pathname, basePath = "/") {
  if (typeof pathname !== "string" ||
      typeof basePath !== "string" ||
      !basePath.startsWith("/")) return false;

  const base = basePath.replace(/\/{2,}/g, "/");
  const root = base.endsWith("/") ? base : base + "/";
  return pathname === root ||
    (root !== "/" && pathname === root.slice(0, -1)) ||
    pathname === root + "index.html";
}

/** Se reutiliza la clave local actual del perfil, separada por UID. */
export function corpusShellAccountKey(uid) {
  const identity = typeof uid === "string" ? uid.trim() : "";
  return identity ? "if:profile-shell:" + identity : null;
}

/**
 * El llamador deberá verificar Firebase Auth antes de invocar esta función.
 * Un hint local NO valida la identidad. Invitados y fallas → Predeterminado.
 */
export function resolveCorpusShell({
  pathname,
  basePath = "/",
  verified = false,
  uid = "",
  readPreference = null
} = {}) {
  if (!isCorpusAppearanceRoute(pathname, basePath) || verified !== true)
    return CORPUS_SHELL_DEFAULT;

  const key = corpusShellAccountKey(uid);
  if (!key || typeof readPreference !== "function")
    return CORPUS_SHELL_DEFAULT;

  try {
    return normalizeCorpusShell(readPreference(key));
  } catch {
    return CORPUS_SHELL_DEFAULT;
  }
}

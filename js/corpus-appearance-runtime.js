import {
  CORPUS_SHELL_DEFAULT,
  corpusShellAccountKey,
  normalizeCorpusShell,
  resolveCorpusShell,
  isCorpusAppearanceRoute
} from "./corpus-appearance-policy.js";

/**
 * Controlador puro: sin DOM, Firebase ni listeners de búsqueda.
 * Los resultados y modales permanecen intactos durante la fase 1.
 */
export function createCorpusAppearanceController({
  pathname = "/",
  basePath = "/",
  readPreference = () => null,
  writePreference = () => {},
  readRemoteProfile = async () => null,
  applyShell = () => {},
  onError = () => {}
} = {}) {
  let revision = 0;
  let activeUid = "";
  let lastApplied = null;

  const display = (rawShell) => {
    const shell = normalizeCorpusShell(rawShell);
    if (lastApplied !== shell) {
      lastApplied = shell;
      applyShell(shell);
    }
    return shell;
  };

  /**
   * Firebase Auth must supply the verified user; the auth hint alone
   * must never be passed as evidence of account identity.
   */
  async function enterUser(user) {
    const current = ++revision;
    const uid = isCorpusAppearanceRoute(pathname, basePath) &&
      user?.emailVerified === true && typeof user?.uid === "string"
      ? user.uid.trim() : "";
    activeUid = uid;
    if (!uid) {
      display(CORPUS_SHELL_DEFAULT);
      return CORPUS_SHELL_DEFAULT;
    }

    const cached = resolveCorpusShell({
      pathname,
      basePath,
      verified: true,
      uid,
      readPreference
    });
    display(cached);

    try {
      const profile = await readRemoteProfile(uid);
      // A logout, account switch or cross-tab preference always wins
      // over an earlier asynchronous Firestore read.
      if (current !== revision || activeUid !== uid) return lastApplied;

      const remote = normalizeCorpusShell(profile?.profileShell);
      if (remote !== cached) display(remote);

      const key = corpusShellAccountKey(uid);
      try { writePreference(key, remote); } catch { /* storage unavailable */ }

      return remote;
    } catch (error) {
      if (current === revision && activeUid === uid) onError(error);
      return lastApplied;
    }
  }

  /**
   * Fires when the profile saves a theme in a different tab of the
   * same origin. Do not read another user's key.
   */
  function storageChanged(key, newValue) {
    if (!activeUid || key !== corpusShellAccountKey(activeUid)) return false;
    ++revision;
    display(newValue);
    return true;
  }

  return {
    enterUser,
    leaveUser: () => enterUser(null),
    storageChanged,
    get activeUid() { return activeUid; },
    get shell() { return lastApplied || CORPUS_SHELL_DEFAULT; }
  };
}

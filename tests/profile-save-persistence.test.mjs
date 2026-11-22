import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync(new URL("../js/profile.js", import.meta.url), "utf8");

const submitStart = script.indexOf('profileSettingsForm.addEventListener("submit", async event => {');
const submitEnd = script.indexOf('\nsettingsBackButton.addEventListener("click"', submitStart);
assert.ok(submitStart >= 0 && submitEnd > submitStart);
const submitSource = script.slice(submitStart, submitEnd);

function createSaveHarness({ initialShell = "observatory", profile = {} } = {}) {
  let handler;
  const written = [];
  const remembered = [];
  const warnings = [];
  const errors = [];
  const timers = [];
  let acknowledge;
  let readCalls = 0;

  const inputs = {
    displayName: "Nueva investigadora",
    institution: "Universidad",
    website: "https://example.org",
    accentColor: "#345678",
    bio: "Estudio filosófico",
    profileShell: initialShell
  };
  const controls = { profileShell: { value: initialShell } };
  const saveButton = {
    disabled: false,
    textContent: "Guardar perfil",
    setAttribute() {},
    removeAttribute() {}
  };
  const status = { textContent: "", classList: { add() {}, remove() {} } };

  const harness = new Function("deps", [
    "let currentUser = { uid: 'test-user', displayName: 'Nombre anterior' };",
    "let currentProfile = { displayName: 'Nombre anterior', profileShell: 'default' };",
    "let profileDocumentSaveRevision = 0;",
    "let profileShellSelectionRevision = 0;",
    "let profileShellSaveQueue = Promise.resolve();",
    "let confirmedProfileShell = 'default';",
    "const profileSettingsForm = { addEventListener: (_, cb) => deps.register(cb), elements: deps.controls };",
    "const profileSaveButton = deps.saveButton;",
    "const profileSaveStatus = deps.status;",
    "const FormData = class { get(name) { return deps.inputs[name]; } };",
    "const updateUserProfileDocument = (_, changes) => deps.write(changes);",
    "const updateAuthProfile = async () => {};",
    "const getUserProfile = () => { deps.trackRead(); throw new Error('stale read'); };",
    "const rememberProfileShell = (_, shell) => deps.remember(shell);",
    "const normalizeProfileShell = shell => ['default', 'territory', 'marginalia', 'observatory'].includes(shell) ? shell : 'default';",
    "const selectedProfileShell = () => deps.controls.profileShell.value;",
    "const fillProfileForm = () => {};",
    "const renderIdentity = () => {};",
    "const setActivePanel = () => {};",
    "const window = { setTimeout: callback => deps.timers.push(callback) };",
    "const console = { warn: (...args) => deps.warn(args), error: (...args) => deps.error(args) };",
    submitSource,
    "return { save: () => deps.getHandler(),",
    "  profile: () => currentProfile, confirmed: () => confirmedProfileShell,",
    "  revision: () => profileDocumentSaveRevision,",
    "  switchWhileSaving: shell => { profileShellSelectionRevision++; deps.controls.profileShell.value = shell; } };"
  ].join("\n"))({
    inputs, controls, saveButton, status, timers,
    register: cb => { handler = cb; },
    getHandler: () => handler,
    trackRead: () => { readCalls++; },
    remember: shell => remembered.push(shell),
    warn: args => warnings.push(args),
    error: args => errors.push(args),
    write: changes => {
      written.push(changes);
      return new Promise(resolve => { acknowledge = resolve; });
    }
  });

  return {
    inputs, saveButton, status, timers, written, remembered, warnings, errors, harness,
    submit: () => handler({ preventDefault() {} }),
    acknowledge: () => acknowledge?.(),
    reads: () => readCalls
  };
}

test("Guardar perfil only confirms after durable write and retains the selected theme", async () => {
  const h = createSaveHarness();
  const saving = h.submit();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(h.saveButton.textContent, "Guardando…");
  assert.equal(h.remembered.length, 0, "cache is not committed before Firebase acknowledgement");
  assert.equal(h.written.length, 1);
  assert.equal(h.written[0].profileShell, "observatory");

  h.acknowledge();
  await saving;
  assert.equal(h.reads(), 0, "a stale immediate read must not clobber the saved profile");
  assert.equal(h.harness.profile().displayName, "Nueva investigadora");
  assert.equal(h.harness.profile().bio, "Estudio filosófico");
  assert.equal(h.harness.profile().profileShell, "observatory");
  assert.equal(h.harness.confirmed(), "observatory");
  assert.deepEqual(h.remembered, ["observatory"]);
  assert.equal(h.saveButton.textContent, "Guardado ✓");
  assert.equal(h.status.textContent, "Cambios guardados en su cuenta.");
  assert.equal(h.harness.revision(), 1);
});

test("a new theme chosen while the full profile is saving is not visually rolled back", async () => {
  const h = createSaveHarness();
  const saving = h.submit();
  await Promise.resolve();
  await Promise.resolve();
  h.harness.switchWhileSaving("territory");
  h.acknowledge();
  await saving;
  assert.equal(h.harness.profile().profileShell, "territory");
  assert.equal(h.harness.confirmed(), "observatory", "only completed writes become confirmed");
});

test("a late hydration response cannot replace a profile already being saved", async () => {
  const start = script.indexOf("async function hydratePrivateProfile(user, attempt = 0) {");
  const end = script.indexOf("\nfunction timestampValue(", start);
  assert.ok(start > 0 && end > start);
  let resolveRemote;
  let filled = 0;
  let rendered = 0;
  const result = new Function("deps", [
    "let currentUser = { uid: 'u1' };",
    "let currentProfile = { displayName: 'Latest', profileShell: 'observatory' };",
    "let profileShellSelectionRevision = 0;",
    "let profileDocumentSaveRevision = 0;",
    "let confirmedProfileShell = 'observatory';",
    "const getUserProfile = () => new Promise(resolve => { deps.resolveRemote = resolve; });",
    "const withTimeout = promise => promise;",
    "const ensureUserProfile = async () => {};",
    "const PROFILE_NETWORK_TIMEOUT_MS = 4500;",
    "const selectedProfileShell = () => 'observatory';",
    "const normalizeProfileShell = value => value;",
    "const rememberProfileShell = () => {};",
    "const fillProfileForm = () => { deps.filled++; };",
    "const renderIdentity = () => { deps.rendered++; };",
    "const window = { setTimeout() {} };",
    "const console = { warn() {} };",
    script.slice(start, end),
    "return { hydratePrivateProfile, changeRevision: () => { profileDocumentSaveRevision++; }, profile: () => currentProfile };"
  ].join("\n"))({
    resolveRemote: resolve => { resolveRemote = resolve; },
    get filled() { return filled; }, set filled(value) { filled = value; },
    get rendered() { return rendered; }, set rendered(value) { rendered = value; }
  });
  // A request was started while the old profile was authoritative.
  const pending = result.hydratePrivateProfile({ uid: "u1" });
  await Promise.resolve();
  result.changeRevision();
  resolveRemote({ profileShell: "default", displayName: "Old" });
  await pending;
  assert.equal(result.profile().displayName, "Latest");
  assert.equal(result.profile().profileShell, "observatory");
  assert.equal(filled, 0);
  assert.equal(rendered, 0);
});

test("full save cannot be falsely reported as failed by Firebase Auth display-name sync", () => {
  assert.match(submitSource, /await updateAuthProfile\(currentUser, \{ displayName \}\)/);
  assert.match(submitSource, /El nombre se guardó en el perfil, pero Auth no se sincronizó/);
  assert.match(submitSource, /Cambios guardados en su cuenta/);
  assert.doesNotMatch(submitSource, /currentProfile = await getUserProfile/);
});

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

test("registered articles theses journals and Latin American philosophers expose private save controls", () => {
  const helper = read("js/public-save-controls.js");
  const articles = read("js/articles.js");
  const thesis = read("js/thesis-demo.js");
  const journals = read("js/journal-page.js");
  const latin = read("js/latin-american-philosophy.js");

  assert.match(helper, /hasVerifiedAuthHint\(\)/);
  assert.match(helper, /research-library:save-work/);
  assert.match(helper, /research-library:save-author/);
  assert.match(articles, /createWorkSaveButton/);
  assert.match(thesis, /createWorkSaveButton/);
  assert.match(journals, /createWorkSaveButton/);
  assert.match(latin, /createAuthorSaveButton/);

  for (const source of [articles, thesis, journals, latin, helper]) {
    assert.doesNotMatch(
      source,
      /firebase-firestore\.js|from "\.\/firebase-client\.js"/
    );
  }
});

test("project authors can be added explicitly and identity decisions persist privately", () => {
  const data = read("js/user-data.js");
  const profile = read("js/profile.js");
  const page = read("perfil.html");

  assert.match(data, /attachAuthorToProject/);
  assert.match(data, /detachAuthorFromProject/);
  assert.match(data, /subscribeProjectAuthors/);
  assert.match(data, /saveAuthorIdentityDecision/);
  assert.match(data, /authorIdentityDecisions/);

  assert.match(profile, /data-author-attach/);
  assert.match(profile, /data-project-author-pin/);
  assert.match(profile, /nextIdentityReviewCandidate/);
  assert.match(profile, /sameTitle|sharedTitle/);
  assert.match(profile, /data-identity-decision="same"/);
  assert.match(profile, /data-identity-decision="different"/);
  assert.match(page, /id="project-identity-review"/);
});

test("project readings expose a persistent visual card catalog", () => {
  const data = read("js/user-data.js");
  const profile = read("js/profile.js");
  const page = read("perfil.html");
  const css = read("css/profile.css");

  assert.match(data, /updateProjectWorkPresentation/);
  assert.match(data, /"default"[\s\S]*"protrepsis"[\s\S]*"sincronia"[\s\S]*"quadripartita"[\s\S]*"thesis"[\s\S]*"author-archive"/);
  assert.match(data, /presentationUpdatedAt/);
  const presentationFunction =
    data.match(/export async function updateProjectWorkPresentation[\s\S]*?return style;/)?.[0] || "";
  const workUpdate =
    presentationFunction.match(/await updateDoc\(\s*projectWorkRef[\s\S]*?\n\s*\);/)?.[0] || "";
  assert.match(workUpdate, /presentationUpdatedAt:\s*serverTimestamp\(\)/);
  assert.doesNotMatch(workUpdate, /\n\s*updatedAt:\s*serverTimestamp\(\)/);

  assert.match(profile, /PROJECT_CARD_STYLES/);
  assert.match(profile, /data-project-work-style/);
  assert.match(profile, /data-card-catalog-style/);
  assert.match(profile, /updateProjectWorkPresentation/);
  assert.match(page, /id="project-card-catalog-dialog"/);
  assert.match(page, /id="project-card-catalog"/);
  assert.match(css, /data-card-style="protrepsis"/);
  assert.match(css, /data-card-style="sincronia"/);
  assert.match(css, /data-card-style="quadripartita"/);
  assert.match(profile, /work\.cardStyle = style/);
  assert.match(profile, /previousStyle/);
});

test("private card catalog uses abstract labels instead of journal names", () => {
  const profile = read("js/profile.js");
  const page = read("perfil.html");
  const css = read("css/profile.css");

  assert.match(profile, /label: "Clásica"/);
  assert.match(profile, /label: "Marginalia"/);
  assert.match(profile, /label: "Estampa"/);
  assert.match(profile, /label: "Cobalto"/);
  assert.match(profile, /label: "Índice"/);
  assert.match(profile, /label: "Dossier"/);
  assert.doesNotMatch(page, /Protrepsis|Sincronía|Quadripartita/);
  assert.doesNotMatch(css, /content:\s*"PROTREPSIS"|content:\s*"SINCRONÍA"|content:\s*"QUADRIPARTITA/);
});

test("saved authors open a private dossier view", () => {
  const profile = read("js/profile.js");
  const page = read("perfil.html");
  const css = read("css/profile.css");

  assert.match(profile, /data-author-open/);
  assert.match(profile, /data-project-author-open/);
  assert.match(profile, /function openSavedAuthorView/);
  assert.match(profile, /allWorksForAuthor/);
  assert.match(page, /id="saved-author-dialog"/);
  assert.match(page, /id="saved-author-dialog-body"/);
  assert.match(css, /\.author-open-button/);
  assert.match(css, /\.author-view-hero/);
  assert.match(css, /\.author-view-works/);
});

test("project workspace hides configuration behind organization controls", () => {
  const page = read("perfil.html");
  const profile = read("js/profile.js");

  assert.match(page, /id="project-settings" class="project-settings"/);
  assert.match(page, /data-project-settings-toggle/);
  assert.match(page, /data-project-view="works"/);
  assert.match(page, /data-project-view="authors"/);
  assert.match(page, /data-project-view="atlas"/);
  assert.match(profile, /setProjectView/);
  assert.match(profile, /activeSubprojectFilter/);
  assert.match(profile, /data-subproject-filter/);
});

test("project and private archive expose work author usage and Excel exports", () => {
  const page = read("perfil.html");
  const profile = read("js/profile.js");

  assert.match(page, /id="project-author-list"/);
  assert.match(page, /id="library-export"/);
  assert.match(page, /id="authors-export"/);
  assert.match(profile, /membershipsForWork/);
  assert.match(profile, /membershipsForAuthor/);
  assert.match(profile, /projectAuthorsFromWorks/);
  assert.match(profile, /application\/vnd\.ms-excel/);
  assert.match(profile, /exportProjectExcel/);
  assert.match(profile, /exportLibraryExcel/);
  assert.match(profile, /exportAuthorsExcel/);
});

test("new projects open their workspace without a second click", () => {
  const profile = read("js/profile.js");

  assert.match(profile, /pendingProjectSelectionId\s*=\s*id/);
  assert.match(profile, /projects\.some\(project => project\.id === id\)/);
  assert.match(profile, /selectProject\(id\)/);
});

test("normalized work identifiers survive library to project moves", () => {
  const data = read("js/user-data.js");

  assert.match(data, /existingNormalizedId/);
  assert.match(data, /\["public-engine", "private-user-entry"\]/);
  assert.match(data, /for \(const childCollection of \["subprojects", "works", "authors"\]\)/);
});

test("new browser modules parse as JavaScript", () => {
  const files = [
    "js/firebase-config.js",
    "js/firebase-client.js",
    "js/user-data.js",
    "js/account-menu.js",
    "js/auth-session-hint.js",
    "js/public-save-controls.js",
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
  assert.match(css, /\.auth-shell/);
  assert.match(css, /url\("\.\.\/assets\/hero-school-athens\.jpg"\)/);
  assert.doesNotMatch(account, /aria-modal|role="dialog"/);
});


test("account dock uses a progressive-enhancement link and mounts once", () => {
  const account = read("js/account-menu.js");

  assert.match(account, /<a[\s\S]*class="account-trigger"/);
  assert.match(account, /hasVerifiedAuthHint\(\) \? siteUrl\("perfil\.html"\) : authUrl\("login"\)/);
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


test("artistic auth keeps Socrates as a visible second layer", () => {
  const page = read("auth/index.html");
  const css = read("css/auth.css");
  const auth = read("js/auth-page.js");

  assert.match(page, /class="auth-socrates"/);
  assert.match(page, /Socrates_transparent\.svg/);
  assert.match(page, /SÓCRATES \/ 1875/);
  assert.match(page, /Wilhelm Meyer/);
  assert.match(css, /\.auth-socrates\.is-loaded/);
  assert.match(css, /font:\s*700 clamp\(40px, 4\.2vw, 62px\)/);
  assert.match(auth, /revealSocrates/);
});

test("artistic auth combines local School of Athens with the Socrates overlay", () => {
  const page = read("auth/index.html");
  const css = read("css/auth.css");

  assert.match(css, /url\("\.\.\/assets\/hero-school-athens\.jpg"\)/);
  assert.match(page, /La Escuela de Atenas/);
  assert.match(page, /Socrates_transparent\.svg/);
  assert.match(css, /mix-blend-mode:\s*multiply/);
});


test("private profile is a panel-based philosophical pinboard", () => {
  const page = read("perfil.html");
  const css = read("css/profile.css");
  const profile = read("js/profile.js");

  assert.match(page, /class="profile-pinboard"/);
  assert.match(page, /data-profile-panel/);
  assert.match(page, /id="profile-gate" class="profile-gate" hidden/);
  assert.match(page, /id="profile-loading"/);
  assert.match(css, /columns:\s*4 270px/);
  assert.match(css, /\.profile-pin-quote/);
  assert.match(css, /\.profile-cover-art/);
  assert.match(profile, /function setActivePanel/);
  assert.doesNotMatch(profile, /new IntersectionObserver/);
});

test("personal accent controls the whole private profile and previews live", () => {
  const css = read("css/profile.css");
  const profile = read("js/profile.js");

  assert.match(css, /--profile-accent:\s*#0f62fe/);
  assert.match(css, /var\(--profile-accent\)/);
  assert.doesNotMatch(css, /--profile-blue:/);
  assert.match(profile, /document\.body\.style\.setProperty\("--profile-accent"/);
  assert.match(profile, /profileSettingsForm\.addEventListener\("input"/);
  assert.match(profile, /applyProfileAccent\(event\.target\.value\)/);
});

test("full profile shell is persistent, live-previewed and keeps default personal color", () => {
  const data = read("js/user-data.js");
  const profile = read("js/profile.js");
  const page = read("perfil.html");
  const css = read("css/profile.css");

  assert.match(page, /name="profileShell" value="default"/);
  assert.match(page, /name="profileShell" value="territory"/);
  assert.match(page, /name="profileShell" value="marginalia"/);
  assert.match(page, />Predeterminado</);
  assert.match(page, />Territorio</);
  assert.match(page, />Marginalia</);
  assert.match(data, /profileShell:\s*"default"/);
  assert.match(data, /\["default", "territory", "marginalia"\]\.includes\(changes\.profileShell\)/);
  assert.match(profile, /function applyProfileShell/);
  assert.match(profile, /document\.body\.dataset\.profileShell = shell/);
  assert.match(profile, /event\.target\?\.name === "profileShell"/);
  assert.match(profile, /selectedProfileShell\(\) === "default"/);
  assert.match(profile, /profileShell: normalizeProfileShell\(data\.get\("profileShell"\)\)/);
  assert.match(css, /data-profile-shell="territory"/);
  assert.match(css, /--territory-paper:/);
  assert.match(css, /\.profile-shell-options/);
  assert.match(css, /\.profile-page\[data-profile-shell="territory"\] \.profile-cover-art/);
  assert.match(css, /\.profile-page\[data-profile-shell="territory"\] \.profile-dialog/);
  assert.match(css, /data-profile-shell="marginalia"/);
  assert.match(css, /--marginalia-bg:/);
  assert.match(css, /--marginalia-serif:/);
  assert.match(css, /data-shell-sample="marginalia"/);
  assert.match(css, /\.profile-page\[data-profile-shell="marginalia"\] \.profile-cover/);
  assert.match(css, /\.profile-page\[data-profile-shell="marginalia"\] \.project-grid/);
  assert.match(css, /\.profile-page\[data-profile-shell="marginalia"\] \.profile-dialog/);
});

test("private profile bootstrap cannot hang on remote auth or Firestore", () => {
  const page = read("perfil.html");
  const profile = read("js/profile.js");

  assert.match(profile, /PROFILE_NETWORK_TIMEOUT_MS/);
  assert.match(profile, /PROFILE_BOOT_WATCHDOG_MS/);
  assert.match(profile, /function withTimeout/);
  assert.match(profile, /refreshVerificationOnlyWhenNeeded/);
  assert.match(profile, /if \(user\?\.emailVerified\) return true/);
  assert.doesNotMatch(profile, /await user\.reload\(\);/);
  assert.match(profile, /showWorkspace\(\);[\s\S]*void hydratePrivateProfile\(user\)/);
  assert.match(profile, /Firebase Auth tardó en emitir el estado inicial/);
  assert.match(page, /profile\.js\?v=20261121-bibliographic-cards-v1/);
});

test("private profile does not flash the login gate for authenticated users", () => {
  const page = read("perfil.html");
  const profile = read("js/profile.js");

  assert.match(page, /class="profile-page profile-auth-pending"/);
  assert.match(page, /id="profile-gate"[^>]*hidden/);
  assert.match(page, /id="profile-workspace"[^>]*hidden/);
  assert.match(profile, /showWorkspace\(\);[\s\S]*void hydratePrivateProfile\(user\)/);
  assert.match(profile, /getUserProfile\(user\.uid\)/);
  assert.match(profile, /loading\.hidden = true/);
});

test("profile avoids scroll repaint triggers and hidden atlas redraws", () => {
  const css = read("css/profile.css");
  const profile = read("js/profile.js");

  assert.doesNotMatch(css, /backdrop-filter/);
  assert.doesNotMatch(profile, /behavior:\s*"smooth"/);
  assert.doesNotMatch(profile, /IntersectionObserver/);
  assert.match(profile, /atlasCanvas\.offsetParent === null/);
  assert.match(profile, /requestAnimationFrame\(drawProjectAtlas\)/);
});


test("profile settings save gives feedback and returns to the private home", () => {
  const page = read("perfil.html");
  const profile = read("js/profile.js");

  assert.match(page, /id="profile-settings-back"/);
  assert.match(page, /id="profile-save-button"/);
  assert.match(page, /id="profile-save-status"/);
  assert.match(profile, /profileSaveButton\.textContent = "Guardando…"/);
  assert.match(profile, /profileSaveButton\.textContent = "Guardado ✓"/);
  assert.match(profile, /setActivePanel\("resumen"/);
  assert.match(profile, /No fue posible guardar los cambios/);
});

test("profile settings has an explicit back action", () => {
  const page = read("perfil.html");
  const profile = read("js/profile.js");

  assert.match(page, /← Volver a mi investigación/);
  assert.match(profile, /settingsBackButton\.addEventListener\("click"/);
});


test("save bookmarks are rendered only with a verified local session hint", () => {
  const app = read("js/app.js");
  const hint = read("js/auth-session-hint.js");

  assert.match(app, /hasVerifiedAuthHint\(\)/);
  assert.match(app, /function renderWorkSaveControl/);
  assert.match(app, /function renderAuthorSaveControl/);
  assert.match(app, /data-save-icon/);
  assert.match(app, /save-bookmark-shape/);
  assert.doesNotMatch(app, />\s*Guardar autor\s*</);
  assert.doesNotMatch(app, />\s*Guardar\s*</);

  assert.match(hint, /research-auth-verified-v1/);
  assert.match(hint, /verified:\s*true/);
  assert.doesNotMatch(hint, /firebase/);
});

test("verified auth hint is created on login and cleared on logout", () => {
  const auth = read("js/auth-page.js");
  const profile = read("js/profile.js");
  const account = read("js/account-menu.js");

  assert.match(auth, /markVerifiedAuthHint\(\)/);
  assert.match(auth, /clearVerifiedAuthHint\(\)/);
  assert.match(profile, /markVerifiedAuthHint\(\)/);
  assert.match(profile, /clearVerifiedAuthHint\(\)/);
  assert.match(account, /clearVerifiedAuthHint\(\)/);
  assert.match(account, /markVerifiedAuthHint\(\)/);
});

test("bookmark save state never replaces the icon with text", () => {
  const account = read("js/account-menu.js");
  const css = read("css/account.css");

  assert.match(account, /function isSaveIcon/);
  assert.match(account, /classList\.add\("is-saved"\)/);
  assert.match(account, /setAttribute\("aria-label", "Guardado"\)/);
  assert.match(css, /\.research-save-button\.is-saved/);
  assert.match(css, /\.save-bookmark-shape/);
  assert.match(css, /width:\s*34px/);
});

test("multiple author cards save the selected author identity", () => {
  const app = read("js/app.js");

  assert.match(app, /data-save-author-index/);
  assert.match(app, /identities\?\.\[Number\(authorIndex\)\]/);
});

test("saved and project authors link to the canonical public author archive", () => {
  const profile = read("js/profile.js");
  const begin = profile.indexOf("function authorSearchUrl(author) {");
  const end = profile.indexOf("\nfunction withTimeout(", begin);
  assert.ok(begin > 0 && end > begin, "Canonical author URL builder must exist");

  // Exercise the real browser-neutral URL builder with saved Firestore records.
  const authorSearchUrl = new Function(
    "URLSearchParams",
    profile.slice(begin, end) + "\nreturn authorSearchUrl;"
  )(URLSearchParams);

  assert.equal(
    authorSearchUrl({
      name: "Georg Wilhelm Friedrich Hegel",
      savedRecords: [{ sourceId: "5110875100" }]
    }),
    "./?view=author&author=Georg+Wilhelm+Friedrich+Hegel&authorId=5110875100#results"
  );
  assert.equal(
    authorSearchUrl({
      name: "Georg Wilhelm Friedrich Hegel",
      savedRecords: [{ sourceId: "https://openalex.org/A5110875100" }]
    }),
    "./?view=author&author=Georg+Wilhelm+Friedrich+Hegel&authorId=5110875100#results"
  );
  assert.equal(
    authorSearchUrl({
      name: "Autora sin ID validado",
      savedRecords: [{ sourceId: "author-hash-from-firestore" }]
    }),
    "./?view=author&author=Autora+sin+ID+validado#results"
  );
  assert.equal(
    authorSearchUrl({
      name: "Autora de proyecto",
      explicitRecords: [{ sourceId: "A1234567890" }]
    }),
    "./?view=author&author=Autora+de+proyecto&authorId=1234567890#results"
  );

  assert.match(profile, /class="author-search-link"/);
  assert.match(profile, /class="author-public-link"/);
  assert.match(profile, /authorSearchUrl\(author\)/);
  assert.match(profile, /Ver obras en el buscador/);
});

test("Marginalia mobile uses compact single-column folios, usable controls and safe navigation", () => {
  const css = read("css/profile.css");
  const page = read("perfil.html");

  assert.match(css, /PROFILE MOBILE EDITORIAL REFINEMENT/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /scroll-snap-type: x proximity/);
  assert.match(css, /scroll-padding-inline: 8px/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(page, /profile\.css\?v=20261120-marginalia-mobile-v3/);
  assert.match(page, /profile\.js\?v=20261120-author-search-v3/);
});


test("private work cards render real abstracts, DOI and source links in all three views", () => {
  const script = read("js/profile.js");
  const start = script.indexOf("function workDoi(work) {");
  const end = script.indexOf("function contrastForAccent(hex) {", start);
  assert.ok(start > 0 && end > start, "Shared bibliographic renderer must exist");

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  const safeUrl = value => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };
  const compact = (value, max = 220) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max
      ? text.slice(0, Math.max(0, max - 1)).trimEnd() + "…"
      : text;
  };
  const renderers = new Function(
    "safeUrl", "escapeHtml", "compact",
    script.slice(start, end) +
      "\nreturn { workDoi, workExternalLinks, renderWorkFicha, workTitleLink };"
  )(safeUrl, escapeHtml, compact);

  const abstract = "Sobre la experiencia y la razón. ".repeat(22) + "<script>alert(1)</script>";
  const work = {
    title: "Experiencia y razón",
    abstract,
    year: 2026,
    type: "journal-article",
    journal: "Protrepsis",
    providers: ["Protrepsis", "OpenAlex"],
    doi: "https://doi.org/10.1234/abc-123",
    referenceUrl: "https://example.org/article"
  };
  const markup = renderers.renderWorkFicha(work);
  assert.match(markup, /Publicación[\s\S]*Protrepsis/);
  assert.match(markup, /Año[\s\S]*2026/);
  assert.match(markup, /Fuentes[\s\S]*OpenAlex/);
  assert.match(markup, /RESUMEN \/ ABSTRACT/);
  assert.match(markup, /class="work-ficha-abstract-text"/);
  assert.match(markup, /<details class="work-ficha-full">/);
  assert.match(markup, /Leer abstract completo/);
  assert.match(markup, /href="https:\/\/doi\.org\/10\.1234\/abc-123"/);
  assert.match(markup, /10\.1234\/abc-123/);
  assert.match(markup, /href="https:\/\/example\.org\/article"/);
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /&lt;script&gt;/);
  assert.match(renderers.workTitleLink(work), /class="work-ficha-title-link"/);

  const missing = renderers.renderWorkFicha({
    title: "Registro sin abstract",
    doi: "no-es-un-doi",
    referenceUrl: "javascript:alert(1)"
  });
  assert.match(missing, /Resumen no disponible/);
  assert.match(missing, /Sin DOI ni enlace de referencia/);
  assert.doesNotMatch(missing, /href="/);

  // The same ficha must be visible in saved library works, project works
  // and related readings in the saved-author dossier (no separate hidden modal).
  assert.match(script, /function renderLibrary\([\s\S]*?renderWorkFicha\(work\)/);
  assert.match(script, /function renderProjectWorks\([\s\S]*?renderWorkFicha\(work\)/);
  assert.match(script, /class="author-view-works"[\s\S]*?renderWorkFicha\(work\)/);
});

test("journal article saves preserve available abstracts and bibliography remains readable on phones", () => {
  const articles = read("js/articles.js");
  const profile = read("perfil.html");
  const articlesPage = read("articulos.html");
  const css = read("css/profile.css");

  assert.match(articles, /function articleSavePayload\(record\)[\s\S]*?abstract:\s*record\.abstract \|\| ""/);
  assert.match(profile, /profile\.css\?v=20261121-bibliographic-cards-v1/);
  assert.match(profile, /profile\.js\?v=20261121-bibliographic-cards-v1/);
  assert.match(articlesPage, /articles\.js\?v=20261121-abstract-save-v1/);
  assert.match(css, /\.work-ficha-facts/);
  assert.match(css, /\.work-ficha-abstract/);
  assert.match(css, /\.work-ficha-links/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.work-ficha-facts/);
  assert.match(css, /overflow-wrap: anywhere/);
});

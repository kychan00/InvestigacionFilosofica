import {
  onAuthStateChanged,
  signOut,
  updateProfile as updateAuthProfile
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
  auth,
  firebaseReady
} from "./firebase-client.js";

import {
  attachAuthorToProject,
  attachWorkToProject,
  createProject,
  createSubproject,
  deleteLibraryWork,
  deleteProject,
  deleteSavedAuthor,
  deleteSubproject,
  detachAuthorFromProject,
  detachWorkFromProject,
  ensureUserProfile,
  getUserProfile,
  saveAuthor,
  saveAuthorIdentityDecision,
  saveLibraryWork,
  subscribeAuthorIdentityDecisions,
  subscribeLibrary,
  subscribeProjectAuthors,
  subscribeProjectWorks,
  subscribeProjects,
  subscribeSavedAuthors,
  subscribeSubprojects,
  updateProject,
  updateProjectWorkPresentation,
  updateSubproject,
  updateUserProfileDocument
} from "./user-data.js";

import {
  clearVerifiedAuthHint,
  markVerifiedAuthHint
} from "./auth-session-hint.js";

import "./account-menu.js";

const loading = document.querySelector("#profile-loading");
const gate = document.querySelector("#profile-gate");
const gateCopy = document.querySelector("#profile-gate-copy");
const gateLogin = document.querySelector("#profile-gate-login");
const workspace = document.querySelector("#profile-workspace");

const avatar = document.querySelector("#profile-avatar");
const displayNameEl = document.querySelector("#profile-display-name");
const personaMeta = document.querySelector("#profile-persona-meta");
const personaBio = document.querySelector("#profile-persona-bio");

const previewAvatar = document.querySelector("#profile-preview-avatar");
const previewName = document.querySelector("#profile-preview-name");
const previewInstitution = document.querySelector("#profile-preview-institution");
const previewBio = document.querySelector("#profile-preview-bio");

const signoutButton = document.querySelector("#profile-signout");
const signoutSecondary = document.querySelector("#profile-signout-secondary");
const settingsBackButton = document.querySelector("#profile-settings-back");
const profileSaveButton = document.querySelector("#profile-save-button");
const profileSaveStatus = document.querySelector("#profile-save-status");

const profilePanels = [...document.querySelectorAll("[data-profile-panel]")];
const profileNavLinks = [...document.querySelectorAll("[data-profile-nav]")];

const metricProjects = document.querySelector("#metric-projects");
const metricWorks = document.querySelector("#metric-works");
const metricAuthors = document.querySelector("#metric-authors");
const metricPrivate = document.querySelector("#metric-private");

const projectCreateForm = document.querySelector("#project-create-form");
const projectGrid = document.querySelector("#project-grid");
const projectDetail = document.querySelector("#project-detail");
const projectDetailHero = document.querySelector("#project-detail-hero");
const projectDetailTitle = document.querySelector("#project-detail-title");
const projectDetailDescription = document.querySelector("#project-detail-description");
const projectEditForm = document.querySelector("#project-edit-form");
const projectSettings = document.querySelector("#project-settings");
const projectSettingsToggle = document.querySelector("[data-project-settings-toggle]");
const projectDetailStats = document.querySelector("#project-detail-stats");
const projectViewButtons = [...document.querySelectorAll("[data-project-view]")];
const projectViewPanels = [...document.querySelectorAll("[data-project-view-panel]")];

const subprojectForm = document.querySelector("#subproject-form");
const subprojectList = document.querySelector("#subproject-list");
const subprojectManageList = document.querySelector("#subproject-manage-list");
const subprojectCancel = document.querySelector("[data-subproject-cancel]");
const subprojectSubmit = document.querySelector("[data-subproject-submit]");

const atlasCanvas = document.querySelector("#project-atlas");
const atlasNote = document.querySelector("#project-atlas-note");
const projectWorkList = document.querySelector("#project-work-list");
const projectAuthorList = document.querySelector("#project-author-list");
const projectIdentityReview = document.querySelector("#project-identity-review");
const projectWorkNote = document.querySelector("#project-work-note");

const manualWorkForm = document.querySelector("#manual-work-form");
const manualWorkProject = document.querySelector("#manual-work-project");
const libraryList = document.querySelector("#library-list");
const savedAuthorList = document.querySelector("#saved-author-list");
const libraryExportButton = document.querySelector("#library-export");
const authorsExportButton = document.querySelector("#authors-export");
const projectExportButton = document.querySelector("[data-project-export]");
const profileSettingsForm = document.querySelector("#profile-settings-form");
const cardCatalogDialog = document.querySelector("#project-card-catalog-dialog");
const cardCatalogGrid = document.querySelector("#project-card-catalog");
const cardCatalogWorkTitle = document.querySelector("#card-catalog-work-title");
const savedAuthorDialog = document.querySelector("#saved-author-dialog");
const savedAuthorDialogBody = document.querySelector("#saved-author-dialog-body");

let currentUser = null;
let currentProfile = null;
let projects = [];
let library = [];
let savedAuthors = [];
let selectedProjectId = "";
let activeProjectView = "works";
let activeSubprojectFilter = "all";
let pendingProjectSelectionId = "";
let subprojects = [];
let projectWorks = [];
let projectAuthors = [];
let identityDecisions = [];
let cardCatalogWorkId = "";
let activeWorkspaceUid = "";

const PROFILE_NETWORK_TIMEOUT_MS = 4500;
const PROFILE_BOOT_WATCHDOG_MS = 8000;
const projectWorkIndex = new Map();
const projectAuthorIndex = new Map();
const projectSubprojectIndex = new Map();
let assignmentProjectSignature = "";
let assignmentUnsubscribers = [];

let unsubscribeProjects = null;
let unsubscribeLibrary = null;
let unsubscribeAuthors = null;
let unsubscribeSubprojects = null;
let unsubscribeProjectWorks = null;
let unsubscribeProjectAuthors = null;
let unsubscribeIdentityDecisions = null;

const PROJECT_CARD_STYLES = [
  {
    id: "default",
    label: "Clásica",
    note: "Composición sobria, clara y documental para una lectura equilibrada.",
    mark: "Φ"
  },
  {
    id: "protrepsis",
    label: "Marginalia",
    note: "Papel cálido, margen de archivo y ritmo tipográfico de cuaderno editorial.",
    mark: "P"
  },
  {
    id: "sincronia",
    label: "Estampa",
    note: "Papel crema, marco cromático y composición inspirada en una pieza postal.",
    mark: "S"
  },
  {
    id: "quadripartita",
    label: "Cobalto",
    note: "Campo cobalto, papel claro y geometría bibliográfica de alto contraste.",
    mark: "Q"
  },
  {
    id: "thesis",
    label: "Índice",
    note: "Ficha institucional contenida, metadatos compactos y lectura directa.",
    mark: "T"
  },
  {
    id: "author-archive",
    label: "Dossier",
    note: "Rail lateral, numeración y composición de expediente bibliográfico.",
    mark: "A"
  }
];

const LEGACY_PROJECT_CARD_STYLE_MAP = {
  archive: "default",
  paper: "protrepsis",
  index: "default",
  folio: "author-archive",
  night: "sincronia",
  signal: "quadripartita"
};

function projectCardStyle(value) {
  const raw = String(value || "").trim();
  const normalized = LEGACY_PROJECT_CARD_STYLE_MAP[raw] || raw;
  return PROJECT_CARD_STYLES.some(style => style.id === normalized)
    ? normalized
    : "default";
}

function projectCardStyleMeta(value) {
  const id = projectCardStyle(value);
  return PROJECT_CARD_STYLES.find(style => style.id === id) || PROJECT_CARD_STYLES[0];
}

function libraryCardStyle(work) {
  const source = [
    work?.journal,
    work?.source,
    work?.sourceName,
    work?.type,
    ...(Array.isArray(work?.providers) ? work.providers : [])
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (source.includes("protrepsis")) return "protrepsis";
  if (source.includes("sincronia")) return "sincronia";
  if (source.includes("quadripartita")) return "quadripartita";
  if (source.includes("tesis") || source.includes("thesis")) return "thesis";
  if (
    source.includes("filosofia latinoamericana") ||
    source.includes("archivo de autor") ||
    source.includes("author archive")
  ) {
    return "author-archive";
  }

  return "default";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function withTimeout(promise, timeoutMs, label = "operation") {
  let timer = 0;

  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error(`${label}-timeout`);
      error.code = "profile/network-timeout";
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout])
    .finally(() => window.clearTimeout(timer));
}

async function refreshVerificationOnlyWhenNeeded(user) {
  if (user?.emailVerified) return true;

  try {
    await withTimeout(
      user.reload(),
      PROFILE_NETWORK_TIMEOUT_MS,
      "auth-reload"
    );
  } catch (error) {
    console.warn(
      "La verificación remota de la sesión tardó demasiado; se conserva el estado local.",
      error
    );
  }

  return Boolean(user?.emailVerified);
}

async function hydratePrivateProfile(user) {
  try {
    let profile = await withTimeout(
      getUserProfile(user.uid),
      PROFILE_NETWORK_TIMEOUT_MS,
      "profile-read"
    );

    if (!profile) {
      await withTimeout(
        ensureUserProfile(user),
        PROFILE_NETWORK_TIMEOUT_MS,
        "profile-create"
      );

      profile = await withTimeout(
        getUserProfile(user.uid),
        PROFILE_NETWORK_TIMEOUT_MS,
        "profile-read-after-create"
      );
    }

    if (currentUser?.uid !== user.uid || !profile) return;

    currentProfile = profile;
    fillProfileForm();
    renderIdentity();
  } catch (error) {
    console.warn(
      "El perfil privado no respondió a tiempo. El espacio continúa disponible con la identidad de la sesión.",
      error
    );
  }
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function keywordsFrom(value) {
  return String(value || "")
    .split(/[,;]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function authorsFrom(value) {
  return String(value || "")
    .split(/;+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(name => ({ name }))
    .slice(0, 30);
}

function authorNames(work) {
  return (work?.authors || [])
    .map(author => typeof author === "string" ? author : author?.name)
    .filter(Boolean);
}

function compact(value, max = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max
    ? text.slice(0, Math.max(0, max - 1)).trimEnd() + "…"
    : text;
}

function contrastForAccent(hex) {
  const normalized = String(hex || "#0f62fe").replace("#", "");
  const safe = /^[0-9a-f]{6}$/i.test(normalized) ? normalized : "0f62fe";
  const channels = [0, 2, 4].map(index => parseInt(safe.slice(index, index + 2), 16) / 255);
  const linear = channels.map(value =>
    value <= .03928
      ? value / 12.92
      : Math.pow((value + .055) / 1.055, 2.4)
  );
  const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  return luminance > .56 ? "#161616" : "#ffffff";
}

function applyProfileAccent(value) {
  const color = /^#[0-9a-f]{6}$/i.test(String(value || ""))
    ? String(value)
    : "#0f62fe";

  document.body.style.setProperty("--profile-accent", color);
  document.body.style.setProperty("--profile-accent-contrast", contrastForAccent(color));
}

function setProfileAccent() {
  applyProfileAccent(currentProfile?.accentColor || "#0f62fe");
}

function stopRealtimeListeners() {
  for (const unsubscribe of [
    unsubscribeProjects,
    unsubscribeLibrary,
    unsubscribeAuthors,
    unsubscribeSubprojects,
    unsubscribeProjectWorks,
    unsubscribeProjectAuthors,
    unsubscribeIdentityDecisions
  ]) {
    if (typeof unsubscribe === "function") unsubscribe();
  }

  for (const unsubscribe of assignmentUnsubscribers) {
    if (typeof unsubscribe === "function") unsubscribe();
  }
  assignmentUnsubscribers = [];
  assignmentProjectSignature = "";
  projectWorkIndex.clear();
  projectAuthorIndex.clear();
  projectSubprojectIndex.clear();

  unsubscribeProjects = null;
  unsubscribeLibrary = null;
  unsubscribeAuthors = null;
  unsubscribeSubprojects = null;
  unsubscribeProjectWorks = null;
  unsubscribeProjectAuthors = null;
  unsubscribeIdentityDecisions = null;
}

function showGate(message, {
  button = true
} = {}) {
  document.body.classList.remove("profile-auth-pending");
  loading.hidden = true;
  gate.hidden = false;
  workspace.hidden = true;
  signoutButton.hidden = true;
  gateCopy.textContent = message;
  gateLogin.hidden = !button;
}

function showWorkspace() {
  document.body.classList.remove("profile-auth-pending");
  loading.hidden = true;
  gate.hidden = true;
  workspace.hidden = false;
  signoutButton.hidden = false;
}

function renderAvatar(target, name) {
  if (!target) return;
  target.innerHTML = "";

  if (currentUser?.photoURL) {
    const image = document.createElement("img");
    image.src = currentUser.photoURL;
    image.alt = "";
    target.append(image);
    return;
  }

  target.textContent = name.trim().charAt(0).toUpperCase() || "Φ";
}

function renderProfilePreview() {
  if (!profileSettingsForm) return;

  const name =
    String(profileSettingsForm.elements.displayName.value || "").trim() ||
    currentProfile?.displayName ||
    currentUser?.displayName ||
    "Investigador";

  const institution =
    String(profileSettingsForm.elements.institution.value || "").trim() ||
    "Sin institución indicada";

  const bio =
    String(profileSettingsForm.elements.bio.value || "").trim() ||
    "Su bio aparecerá aquí como una pequeña nota de autor.";

  previewName.textContent = name;
  previewInstitution.textContent = institution;
  previewBio.textContent = bio;
  renderAvatar(previewAvatar, name);
}

function renderIdentity() {
  const name =
    currentProfile?.displayName ||
    currentUser?.displayName ||
    "Investigador";

  const institution = currentProfile?.institution || "";
  const email = currentUser?.email || "";

  displayNameEl.textContent = name;
  personaMeta.textContent = [institution, email].filter(Boolean).join(" · ") || "Archivo privado";
  personaBio.textContent =
    currentProfile?.bio ||
    "Un espacio privado para guardar preguntas, lecturas y relaciones.";

  renderAvatar(avatar, name);
  setProfileAccent();
  renderProfilePreview();
}

function renderMetrics() {
  metricProjects.textContent = String(projects.length);
  metricWorks.textContent = String(library.length);
  metricAuthors.textContent = String(mergedSavedAuthors().length);
  metricPrivate.textContent = String(
    library.filter(work => work.privateOnly).length
  );
}

function projectById(id) {
  return projects.find(project => project.id === id) || null;
}

function normalizedPersonName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function projectSubprojectById(projectId, subprojectId) {
  return (projectSubprojectIndex.get(projectId) || []).find(
    item => item.id === subprojectId
  ) || null;
}

function membershipsForWork(workId) {
  const memberships = [];
  for (const project of projects) {
    const works = projectWorkIndex.get(project.id) || [];
    const work = works.find(item => item.id === workId);
    if (!work) continue;
    const collection = work.subprojectId
      ? projectSubprojectById(project.id, work.subprojectId)
      : null;
    memberships.push({
      projectId: project.id,
      projectTitle: project.title || "Proyecto",
      subprojectId: work.subprojectId || "",
      subprojectTitle: collection?.title || ""
    });
  }
  return memberships;
}

function identityPairKey(leftName, rightName) {
  return [
    normalizedPersonName(leftName),
    normalizedPersonName(rightName)
  ].filter(Boolean).sort().join("::");
}

function identityDecisionFor(leftName, rightName) {
  const key = identityPairKey(leftName, rightName);
  return identityDecisions.find(decision =>
    identityPairKey(decision.leftName, decision.rightName) === key
  ) || null;
}

function preferredCanonicalName(names = []) {
  return [...new Set(names.filter(Boolean))]
    .sort((a, b) => {
      const tokenDelta =
        normalizedPersonName(b).split(" ").filter(Boolean).length -
        normalizedPersonName(a).split(" ").filter(Boolean).length;
      return tokenDelta || b.length - a.length || a.localeCompare(b, "es");
    })[0] || "Autor";
}

function equivalentNormalizedNames(author) {
  const names = new Set(
    [
      author?.name,
      author?.displayName,
      ...(author?.aliases || []),
      ...(author?.alternateNames || [])
    ]
      .map(normalizedPersonName)
      .filter(Boolean)
  );

  let changed = true;
  while (changed) {
    changed = false;
    for (const decision of identityDecisions) {
      if (decision.same !== true) continue;
      const left = normalizedPersonName(decision.leftName);
      const right = normalizedPersonName(decision.rightName);
      if (names.has(left) && right && !names.has(right)) {
        names.add(right);
        changed = true;
      }
      if (names.has(right) && left && !names.has(left)) {
        names.add(left);
        changed = true;
      }
    }
  }

  return names;
}

function membershipsForAuthor(author) {
  const needles = equivalentNormalizedNames(author);
  if (!needles.size) return [];

  const grouped = new Map();
  for (const project of projects) {
    const works = projectWorkIndex.get(project.id) || [];
    for (const work of works) {
      const hasAuthor = authorNames(work).some(name =>
        needles.has(normalizedPersonName(name))
      );
      if (!hasAuthor) continue;

      const collection = work.subprojectId
        ? projectSubprojectById(project.id, work.subprojectId)
        : null;
      const key = [project.id, work.subprojectId || ""].join("::");
      const previous = grouped.get(key) || {
        projectId: project.id,
        projectTitle: project.title || "Proyecto",
        subprojectId: work.subprojectId || "",
        subprojectTitle: collection?.title || "",
        count: 0,
        explicit: false
      };
      previous.count += 1;
      grouped.set(key, previous);
    }

    const explicitAuthors = projectAuthorIndex.get(project.id) || [];
    for (const projectAuthor of explicitAuthors) {
      const variants = equivalentNormalizedNames(projectAuthor);
      const matches = [...variants].some(name => needles.has(name));
      if (!matches) continue;

      const collection = projectAuthor.subprojectId
        ? projectSubprojectById(project.id, projectAuthor.subprojectId)
        : null;
      const key = [project.id, projectAuthor.subprojectId || ""].join("::");
      const previous = grouped.get(key) || {
        projectId: project.id,
        projectTitle: project.title || "Proyecto",
        subprojectId: projectAuthor.subprojectId || "",
        subprojectTitle: collection?.title || "",
        count: 0,
        explicit: false
      };
      previous.explicit = true;
      grouped.set(key, previous);
    }
  }
  return [...grouped.values()];
}

function visibleProjectWorks() {
  if (activeSubprojectFilter === "all") return [...projectWorks];
  if (activeSubprojectFilter === "unfiled") {
    return projectWorks.filter(work => !work.subprojectId);
  }
  return projectWorks.filter(work => work.subprojectId === activeSubprojectFilter);
}

function visibleProjectAuthors() {
  if (activeSubprojectFilter === "all") return [...projectAuthors];
  if (activeSubprojectFilter === "unfiled") {
    return projectAuthors.filter(author => !author.subprojectId);
  }
  return projectAuthors.filter(author => author.subprojectId === activeSubprojectFilter);
}

function exactProjectAuthorEntries(
  works = visibleProjectWorks(),
  explicitAuthors = visibleProjectAuthors()
) {
  const grouped = new Map();

  const ensure = name => {
    const key = normalizedPersonName(name);
    if (!key) return null;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        name,
        names: new Set([name]),
        count: 0,
        works: [],
        explicitRecords: [],
        savedRecords: [],
        orcids: new Set()
      });
    }
    return grouped.get(key);
  };

  for (const work of works) {
    for (const name of authorNames(work)) {
      const item = ensure(name);
      if (!item) continue;
      item.count += 1;
      if (!item.works.some(existing => existing.id === work.id)) {
        item.works.push(work);
      }
    }
  }

  for (const author of explicitAuthors) {
    const item = ensure(author.name || author.displayName);
    if (!item) continue;
    item.names.add(author.name || author.displayName);
    item.explicitRecords.push(author);
    if (author.orcid) item.orcids.add(String(author.orcid));
    for (const alias of author.alternateNames || []) {
      if (alias) item.names.add(alias);
    }
  }

  for (const author of savedAuthors) {
    const variants = equivalentNormalizedNames(author);
    for (const item of grouped.values()) {
      if (!variants.has(item.key)) continue;
      item.savedRecords.push(author);
      if (author.orcid) item.orcids.add(String(author.orcid));
      for (const alias of author.alternateNames || []) {
        if (alias) item.names.add(alias);
      }
    }
  }

  return grouped;
}

function mergeAuthorIdentityEntries(entries) {
  const keys = [...entries.keys()];
  const parent = new Map(keys.map(key => [key, key]));

  const find = key => {
    let root = parent.get(key) || key;
    while (parent.get(root) && parent.get(root) !== root) {
      root = parent.get(root);
    }
    let current = key;
    while (parent.get(current) && parent.get(current) !== root) {
      const next = parent.get(current);
      parent.set(current, root);
      current = next;
    }
    return root;
  };

  const union = (left, right) => {
    if (!parent.has(left) || !parent.has(right)) return;
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft !== rootRight) parent.set(rootRight, rootLeft);
  };

  for (const decision of identityDecisions) {
    if (decision.same !== true) continue;
    union(
      normalizedPersonName(decision.leftName),
      normalizedPersonName(decision.rightName)
    );
  }

  const merged = new Map();
  for (const [key, item] of entries) {
    const root = find(key);
    const target = merged.get(root) || {
      names: new Set(),
      count: 0,
      works: [],
      explicitRecords: [],
      savedRecords: [],
      orcids: new Set()
    };

    for (const name of item.names) target.names.add(name);
    target.count += item.count;
    for (const work of item.works) {
      if (!target.works.some(existing => existing.id === work.id)) {
        target.works.push(work);
      }
    }
    for (const record of item.explicitRecords) {
      if (!target.explicitRecords.some(existing => existing.id === record.id)) {
        target.explicitRecords.push(record);
      }
    }
    for (const record of item.savedRecords) {
      if (!target.savedRecords.some(existing => existing.id === record.id)) {
        target.savedRecords.push(record);
      }
    }
    for (const orcid of item.orcids) target.orcids.add(orcid);
    merged.set(root, target);
  }

  return [...merged.values()].map(group => {
    const canonicalFromDecision = identityDecisions
      .filter(decision => decision.same === true && decision.canonicalName)
      .find(decision => {
        const left = normalizedPersonName(decision.leftName);
        const right = normalizedPersonName(decision.rightName);
        return [...group.names].some(name => {
          const normalized = normalizedPersonName(name);
          return normalized === left || normalized === right;
        });
      })?.canonicalName;

    const name =
      canonicalFromDecision ||
      preferredCanonicalName([
        ...group.savedRecords.map(record => record.name),
        ...group.explicitRecords.map(record => record.name),
        ...group.names
      ]);

    const aliases = [...group.names].filter(
      alias => normalizedPersonName(alias) !== normalizedPersonName(name)
    );

    return {
      name,
      aliases,
      count: group.count,
      works: group.works,
      explicitRecords: group.explicitRecords,
      savedRecords: group.savedRecords,
      saved: group.savedRecords[0] || null,
      orcid: [...group.orcids][0] || group.savedRecords[0]?.orcid || "",
      explicit: group.explicitRecords.length > 0
    };
  });
}

function projectAuthorsFromWorks(
  works = visibleProjectWorks(),
  explicitAuthors = visibleProjectAuthors()
) {
  return mergeAuthorIdentityEntries(
    exactProjectAuthorEntries(works, explicitAuthors)
  ).sort((a, b) =>
    b.count - a.count ||
    Number(b.explicit) - Number(a.explicit) ||
    a.name.localeCompare(b.name, "es")
  );
}

function namesLookCompatible(leftName, rightName) {
  const left = normalizedPersonName(leftName).split(" ").filter(Boolean);
  const right = normalizedPersonName(rightName).split(" ").filter(Boolean);
  if (left.length < 2 || right.length < 2 || left[0] !== right[0]) return false;

  const [shorter, longer] = left.length <= right.length
    ? [left, right]
    : [right, left];

  return shorter.every(token => longer.includes(token));
}

function normalizedWorkTitle(work) {
  return normalizedPersonName(work?.title);
}

function nextIdentityReviewCandidate() {
  const entries = [...exactProjectAuthorEntries(projectWorks, projectAuthors).values()];

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const left = entries[i];
      const right = entries[j];
      const leftName = preferredCanonicalName([...left.names]);
      const rightName = preferredCanonicalName([...right.names]);

      if (identityDecisionFor(leftName, rightName)) continue;

      const leftTitles = new Map(
        left.works.map(work => [normalizedWorkTitle(work), work.title]).filter(([key]) => key)
      );
      const sharedTitle = right.works
        .map(work => normalizedWorkTitle(work))
        .find(title => title && leftTitles.has(title));

      const sharedOrcid = [...left.orcids].find(orcid => right.orcids.has(orcid));
      const compatible = namesLookCompatible(leftName, rightName);

      if (!sharedOrcid && !(sharedTitle && compatible)) continue;

      return {
        leftName,
        rightName,
        canonicalName: preferredCanonicalName([leftName, rightName]),
        evidence: sharedOrcid
          ? `Comparten el ORCID ${sharedOrcid}.`
          : `Comparten la obra “${leftTitles.get(sharedTitle)}” y sus nombres son compatibles.`
      };
    }
  }

  return null;
}

function mergedSavedAuthors() {
  const grouped = new Map();

  for (const author of savedAuthors) {
    const key = normalizedPersonName(author.name || author.displayName);
    if (!key) continue;
    const item = grouped.get(key) || {
      key,
      name: author.name || author.displayName || "Autor",
      names: new Set(),
      count: 0,
      works: [],
      explicitRecords: [],
      savedRecords: [],
      orcids: new Set()
    };
    item.names.add(author.name || author.displayName || "Autor");
    for (const alias of author.alternateNames || []) item.names.add(alias);
    item.savedRecords.push(author);
    if (author.orcid) item.orcids.add(String(author.orcid));
    grouped.set(key, item);
  }

  return mergeAuthorIdentityEntries(grouped)
    .map(group => ({
      ...group,
      id: group.savedRecords[0]?.id || "",
      documentIds: group.savedRecords.map(record => record.id),
      biography:
        group.savedRecords.find(record => record.biography)?.biography || "",
      wikipediaUrl:
        group.savedRecords.find(record => record.wikipediaUrl)?.wikipediaUrl || "",
      sourceType:
        group.savedRecords.find(record => record.sourceType)?.sourceType || "",
      sourcePage:
        group.savedRecords.find(record => record.sourcePage)?.sourcePage || ""
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function renderProjectStats() {
  if (!projectDetailStats) return;
  const authors = projectAuthorsFromWorks(projectWorks, projectAuthors);
  projectDetailStats.innerHTML = [
    ["Lecturas", projectWorks.length],
    ["Autores", authors.length],
    ["Colecciones", subprojects.length]
  ].map(([label, value]) => `
    <span><strong>${escapeHtml(value)}</strong>${escapeHtml(label)}</span>
  `).join("");
}

function setProjectView(view) {
  activeProjectView = ["works", "authors", "atlas"].includes(view) ? view : "works";
  projectViewButtons.forEach(button => {
    const active = button.dataset.projectView === activeProjectView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  projectViewPanels.forEach(panel => {
    const active = panel.dataset.projectViewPanel === activeProjectView;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  if (activeProjectView === "atlas") {
    requestAnimationFrame(drawProjectAtlas);
  }
}

function syncProjectAssignmentIndex(uid) {
  const signature = projects.map(project => project.id).sort().join("|");
  if (signature === assignmentProjectSignature) return;

  for (const unsubscribe of assignmentUnsubscribers) {
    if (typeof unsubscribe === "function") unsubscribe();
  }
  assignmentUnsubscribers = [];
  projectWorkIndex.clear();
  projectAuthorIndex.clear();
  projectSubprojectIndex.clear();
  assignmentProjectSignature = signature;

  for (const project of projects) {
    assignmentUnsubscribers.push(
      subscribeProjectWorks(uid, project.id, items => {
        projectWorkIndex.set(project.id, items);
        renderProjects();
        renderLibrary();
        renderAuthors();
      })
    );
    assignmentUnsubscribers.push(
      subscribeSubprojects(uid, project.id, items => {
        projectSubprojectIndex.set(project.id, items);
        renderLibrary();
        renderAuthors();
      })
    );
    assignmentUnsubscribers.push(
      subscribeProjectAuthors(uid, project.id, items => {
        projectAuthorIndex.set(project.id, items);
        renderAuthors();
        if (project.id === selectedProjectId) {
          renderProjectAuthors();
          renderProjectStats();
        }
      })
    );
  }
}

function excelSafe(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function downloadExcelTable(filename, rows) {
  const table = rows.map(row =>
    "<tr>" + row.map(cell => `<td>${excelSafe(cell)}</td>`).join("") + "</tr>"
  ).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table>${table}</table></body></html>`;
  const blob = new Blob(["\ufeff", html], {
    type: "application/vnd.ms-excel;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : filename + ".xls";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilePart(value) {
  return String(value || "exportacion")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "exportacion";
}

function exportProjectExcel() {
  const project = projectById(selectedProjectId);
  if (!project) return;
  const rows = [[
    "Tipo", "Proyecto", "Colección", "Título / Autor",
    "Autores", "Año", "DOI", "Estado / cantidad", "Descripción"
  ]];

  rows.push([
    "Proyecto", project.title || "", "", project.title || "",
    "", "", "", project.status || "", project.researchQuestion || project.description || ""
  ]);

  for (const collection of subprojects) {
    rows.push([
      "Colección", project.title || "", collection.title || "",
      collection.title || "", "", "", "", collection.status || "",
      collection.description || ""
    ]);
  }

  for (const work of projectWorks) {
    const collection = subprojects.find(item => item.id === work.subprojectId);
    rows.push([
      "Lectura", project.title || "", collection?.title || "Sin colección",
      work.title || "", authorNames(work).join("; "), work.year || "",
      work.doi || "", work.privateOnly ? "Privada" : "Motor público", work.abstract || ""
    ]);
  }

  for (const author of projectAuthorsFromWorks(projectWorks, projectAuthors)) {
    rows.push([
      "Autor", project.title || "", "", author.name,
      "", "", "", `${author.count} obra(s)`, ""
    ]);
  }

  downloadExcelTable(`proyecto-${safeFilePart(project.title)}.xls`, rows);
}

function exportLibraryExcel() {
  const rows = [[
    "Título", "Autores", "Año", "Tipo", "DOI", "Origen",
    "Proyecto / colección", "Etiquetas", "Abstract"
  ]];

  for (const work of library) {
    const memberships = membershipsForWork(work.id)
      .map(item => item.subprojectTitle
        ? `${item.projectTitle} / ${item.subprojectTitle}`
        : item.projectTitle
      )
      .join("; ");
    rows.push([
      work.title || "", authorNames(work).join("; "), work.year || "",
      work.type || "", work.doi || "", work.privateOnly ? "Entrada privada" : "Motor público",
      memberships, (work.tags || []).join("; "), work.abstract || ""
    ]);
  }

  downloadExcelTable("biblioteca-investigacion.xls", rows);
}

function exportAuthorsExcel() {
  const rows = [["Autor", "ORCID", "Proyectos / colecciones", "Obras relacionadas", "Biografía"]];
  for (const author of mergedSavedAuthors()) {
    const memberships = membershipsForAuthor(author);
    rows.push([
      author.name || "", author.orcid || "",
      memberships.map(item => item.subprojectTitle
        ? `${item.projectTitle} / ${item.subprojectTitle}`
        : item.projectTitle
      ).join("; "),
      memberships.reduce((sum, item) => sum + item.count, 0),
      author.biography || ""
    ]);
  }
  downloadExcelTable("autores-guardados.xls", rows);
}

function renderProjectSelectors() {
  const currentManual = manualWorkProject.value;

  manualWorkProject.innerHTML = [
    '<option value="">Solo biblioteca</option>',
    ...projects.map(project =>
      `<option value="${escapeHtml(project.id)}">${escapeHtml(project.title)}</option>`
    )
  ].join("");

  if (projects.some(project => project.id === currentManual)) {
    manualWorkProject.value = currentManual;
  }
}

function renderProjects() {
  renderMetrics();
  renderProjectSelectors();

  if (!projects.length) {
    projectGrid.innerHTML = `
      <div class="profile-empty">
        Todavía no hay proyectos. Cree el primero y convierta una búsqueda en un espacio de trabajo propio.
      </div>
    `;
    projectDetail.hidden = true;
    selectedProjectId = "";
    return;
  }

  projectGrid.innerHTML = projects.map(project => {
    const keywords = (project.keywords || []).slice(0, 5);
    const color = /^#[0-9a-f]{6}$/i.test(project.color || "")
      ? project.color
      : "#0f62fe";
    const accent = /^#[0-9a-f]{6}$/i.test(project.accentColor || "")
      ? project.accentColor
      : "#8a3ffc";

    return `
      <article
        class="project-card"
        role="button"
        tabindex="0"
        data-project-open="${escapeHtml(project.id)}"
        style="--project-color:${color};--project-accent:${accent}"
      >
        <div>
          <div class="project-card-top">
            <span>${escapeHtml(project.status || "active")}</span>
            <span>${escapeHtml(project.area || "Investigación")}</span>
          </div>
          <h3>${escapeHtml(project.title || "Proyecto sin título")}</h3>
          <p>${escapeHtml(compact(
            project.researchQuestion ||
            project.description ||
            "Sin descripción todavía.",
            180
          ))}</p>
        </div>
        <div class="project-card-keywords">
          ${keywords.length
            ? keywords.map(keyword => `<span>${escapeHtml(keyword)}</span>`).join("")
            : "<span>sin etiquetas</span>"}
        </div>
      </article>
    `;
  }).join("");

  if (
    selectedProjectId &&
    !projects.some(project => project.id === selectedProjectId)
  ) {
    selectedProjectId = "";
    projectDetail.hidden = true;
  } else if (selectedProjectId) {
    renderSelectedProject();
  }
}

function renderSelectedProject() {
  const project = projectById(selectedProjectId);

  if (!project) {
    projectDetail.hidden = true;
    return;
  }

  projectDetail.hidden = false;

  const color = /^#[0-9a-f]{6}$/i.test(project.color || "")
    ? project.color
    : "#0f62fe";
  const accent = /^#[0-9a-f]{6}$/i.test(project.accentColor || "")
    ? project.accentColor
    : "#8a3ffc";

  projectDetailHero.style.setProperty("--project-color", color);
  projectDetailHero.style.setProperty("--project-accent", accent);

  projectDetailTitle.textContent = project.title || "Proyecto";
  projectDetailDescription.textContent =
    project.researchQuestion ||
    project.description ||
    "Proyecto privado de investigación.";

  projectEditForm.elements.title.value = project.title || "";
  projectEditForm.elements.area.value = project.area || "";
  projectEditForm.elements.researchQuestion.value = project.researchQuestion || "";
  projectEditForm.elements.description.value = project.description || "";
  projectEditForm.elements.keywords.value = (project.keywords || []).join(", ");
  projectEditForm.elements.color.value = color;
  projectEditForm.elements.accentColor.value = accent;
  projectEditForm.elements.status.value = project.status || "active";

  renderProjectStats();
  renderSubprojects();
  renderProjectWorks();
  renderProjectAuthors();
  setProjectView(activeProjectView);
  drawProjectAtlas();
}

function selectProject(id) {
  if (!currentUser || !projectById(id)) return;

  selectedProjectId = id;
  activeSubprojectFilter = "all";
  activeProjectView = "works";
  setActivePanel("proyectos", { updateHash: false, scroll: false });
  history.replaceState(null, "", `#proyecto?id=${encodeURIComponent(id)}`);
  renderSelectedProject();

  if (typeof unsubscribeSubprojects === "function") {
    unsubscribeSubprojects();
  }
  if (typeof unsubscribeProjectWorks === "function") {
    unsubscribeProjectWorks();
  }
  if (typeof unsubscribeProjectAuthors === "function") {
    unsubscribeProjectAuthors();
  }

  subprojects = [];
  projectWorks = [];
  projectAuthors = [];
  renderSubprojects();
  renderProjectWorks();
  renderProjectAuthors();
  setProjectView("works");
  if (projectSettings) projectSettings.open = false;

  unsubscribeSubprojects = subscribeSubprojects(
    currentUser.uid,
    selectedProjectId,
    items => {
      subprojects = items;
      renderSubprojects();
      renderProjectWorks();
      renderProjectAuthors();
      drawProjectAtlas();
    }
  );

  unsubscribeProjectWorks = subscribeProjectWorks(
    currentUser.uid,
    selectedProjectId,
    items => {
      projectWorks = items;
      renderSubprojects();
      renderProjectWorks();
      renderProjectAuthors();
      drawProjectAtlas();
    }
  );

  unsubscribeProjectAuthors = subscribeProjectAuthors(
    currentUser.uid,
    selectedProjectId,
    items => {
      projectAuthors = items;
      projectAuthorIndex.set(selectedProjectId, items);
      renderSubprojects();
      renderProjectAuthors();
      renderProjectStats();
      renderAuthors();
    }
  );

  projectDetail.scrollIntoView({
    behavior: "auto",
    block: "start"
  });
}

function resetSubprojectForm() {
  subprojectForm.reset();
  subprojectForm.elements.id.value = "";
  subprojectForm.elements.color.value = "#4589ff";
  subprojectForm.elements.status.value = "active";
  subprojectSubmit.textContent = "Crear colección";
  subprojectCancel.hidden = true;
}

function renderSubprojects() {
  if (
    !["all", "unfiled"].includes(activeSubprojectFilter) &&
    !subprojects.some(item => item.id === activeSubprojectFilter)
  ) {
    activeSubprojectFilter = "all";
  }

  if (!selectedProjectId) {
    subprojectList.innerHTML = "";
    subprojectManageList.innerHTML = "";
    return;
  }

  const countFor = id => projectWorks.filter(work =>
    id === "unfiled" ? !work.subprojectId : work.subprojectId === id
  ).length;
  const authorCountFor = id => projectAuthors.filter(author =>
    id === "unfiled" ? !author.subprojectId : author.subprojectId === id
  ).length;

  const filterCards = [
    {
      id: "all",
      title: "Todo el proyecto",
      description: `${projectWorks.length} lectura(s) · ${projectAuthors.length} autor(es) añadido(s)`,
      color: projectById(selectedProjectId)?.color || "#0f62fe",
      count: projectWorks.length + projectAuthors.length
    },
    ...subprojects.map(item => ({
      id: item.id,
      title: item.title || "Colección",
      description: [
        item.description || "Una línea de trabajo dentro del proyecto.",
        `${countFor(item.id)} lectura(s)`,
        `${authorCountFor(item.id)} autor(es)`
      ].join(" · "),
      color: /^#[0-9a-f]{6}$/i.test(item.color || "") ? item.color : "#4589ff",
      count: countFor(item.id) + authorCountFor(item.id)
    })),
    {
      id: "unfiled",
      title: "Sin colección",
      description: `${countFor("unfiled")} lectura(s) · ${authorCountFor("unfiled")} autor(es) sin colección`,
      color: "#8d8d8d",
      count: countFor("unfiled") + authorCountFor("unfiled")
    }
  ];

  subprojectList.innerHTML = filterCards.map(item => `
    <button
      type="button"
      class="project-collection-card ${activeSubprojectFilter === item.id ? "is-active" : ""}"
      data-subproject-filter="${escapeHtml(item.id)}"
      style="--subproject-color:${escapeHtml(item.color)}"
    >
      <span class="project-collection-count">${escapeHtml(item.count)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(compact(item.description, 120))}</small>
    </button>
  `).join("");

  if (!subprojects.length) {
    subprojectManageList.innerHTML = `
      <p class="project-settings-empty">
        Todavía no hay colecciones. Cree una cuando necesite separar corpus,
        momentos o problemas dentro del proyecto.
      </p>
    `;
  } else {
    subprojectManageList.innerHTML = subprojects.map(item => {
      const color = /^#[0-9a-f]{6}$/i.test(item.color || "")
        ? item.color
        : "#4589ff";
      return `
        <article class="subproject-manage-card" style="--subproject-color:${color}">
          <span></span>
          <div>
            <strong>${escapeHtml(item.title || "Colección")}</strong>
            <small>${escapeHtml(countFor(item.id))} lectura(s) · ${escapeHtml(authorCountFor(item.id))} autor(es) · ${escapeHtml(item.status || "active")}</small>
          </div>
          <div class="subproject-card-actions">
            <button type="button" data-subproject-edit="${escapeHtml(item.id)}">Editar</button>
            <button type="button" data-subproject-delete="${escapeHtml(item.id)}">Eliminar</button>
          </div>
        </article>
      `;
    }).join("");
  }

  renderProjectStats();
}

function renderLibrary() {
  renderMetrics();

  if (!library.length) {
    libraryList.innerHTML = `
      <div class="profile-empty">
        Su biblioteca está vacía. Guarde obras desde el motor o añada una referencia privada.
      </div>
    `;
    return;
  }

  libraryList.innerHTML = library.map(work => {
    const authors = authorNames(work);
    const reference = safeUrl(work.referenceUrl);
    const doiUrl = work.doi ? safeUrl(`https://doi.org/${work.doi}`) : "";
    const tags = (work.tags || []).slice(0, 8);
    const memberships = membershipsForWork(work.id);
    const cardStyle = libraryCardStyle(work);

    return `
      <article
        class="library-card ${work.privateOnly ? "is-private" : ""}"
        data-card-style="${escapeHtml(cardStyle)}"
      >
        <div>
          <div class="library-card-meta">
            ${work.privateOnly
              ? '<span class="private-entry-badge">Entrada privada</span>'
              : '<span>Motor público</span>'}
            ${work.year ? `<span>${escapeHtml(work.year)}</span>` : ""}
            ${work.type ? `<span>${escapeHtml(work.type)}</span>` : ""}
          </div>

          <h3>${escapeHtml(work.title || "Obra sin título")}</h3>

          <p>
            ${escapeHtml(authors.length ? authors.join("; ") : "Autor no indicado")}
            ${work.abstract ? " · " + escapeHtml(compact(work.abstract, 260)) : ""}
          </p>

          <div class="library-card-tags">
            ${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
            ${doiUrl ? `<a href="${escapeHtml(doiUrl)}" target="_blank" rel="noopener noreferrer">DOI ↗</a>` : ""}
            ${reference ? `<a href="${escapeHtml(reference)}" target="_blank" rel="noopener noreferrer">Referencia ↗</a>` : ""}
          </div>

          <div class="library-card-projects">
            ${memberships.length
              ? memberships.map(item => `
                  <span class="project-usage-badge">
                    <b>${escapeHtml(item.projectTitle)}</b>
                    ${item.subprojectTitle ? `<small> / ${escapeHtml(item.subprojectTitle)}</small>` : ""}
                  </span>
                `).join("")
              : '<span class="project-usage-empty">Aún no está en un proyecto</span>'}
          </div>
        </div>

        <div class="library-card-actions">
          <select data-library-project="${escapeHtml(work.id)}" aria-label="Proyecto destino">
            <option value="">Añadir a proyecto…</option>
            ${projects.map(project => {
              const attached = memberships.some(item => item.projectId === project.id);
              return `<option value="${escapeHtml(project.id)}">${attached ? "✓ " : ""}${escapeHtml(project.title)}</option>`;
            }).join("")}
          </select>
          <button type="button" data-library-attach="${escapeHtml(work.id)}">Añadir al proyecto</button>
          <button type="button" data-library-delete="${escapeHtml(work.id)}">Quitar de biblioteca</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderAuthors() {
  renderMetrics();

  const authors = mergedSavedAuthors();

  if (!authors.length) {
    savedAuthorList.innerHTML = `
      <div class="profile-empty">
        Todavía no ha guardado autores desde el archivo.
      </div>
    `;
    return;
  }

  savedAuthorList.innerHTML = authors.map(author => {
    const orcid = author.orcid
      ? safeUrl(String(author.orcid).startsWith("http")
        ? author.orcid
        : `https://orcid.org/${author.orcid}`)
      : "";
    const wikipedia = safeUrl(author.wikipediaUrl);
    const memberships = membershipsForAuthor(author);
    const workCount = memberships.reduce((sum, item) => sum + item.count, 0);
    const explicitProjects = new Set(
      memberships.filter(item => item.explicit).map(item => item.projectId)
    );

    return `
      <article class="author-card">
        <div>
          <span class="profile-kicker">AUTOR GUARDADO</span>
          <h3>${escapeHtml(author.name || "Autor")}</h3>
          ${author.aliases.length
            ? `<p class="author-aliases">También aparece como: ${escapeHtml(author.aliases.join(" · "))}</p>`
            : ""}
          <p>${escapeHtml(compact(author.biography || "Identidad bibliográfica guardada.", 260))}</p>

          <div class="author-project-usage">
            ${memberships.length
              ? memberships.map(item => `
                  <span class="project-usage-badge">
                    <b>${escapeHtml(item.projectTitle)}</b>
                    ${item.subprojectTitle ? `<small> / ${escapeHtml(item.subprojectTitle)}</small>` : ""}
                    ${item.explicit ? "<em>autor añadido</em>" : ""}
                    ${item.count ? `<em>${escapeHtml(item.count)} obra(s)</em>` : ""}
                  </span>
                `).join("")
              : '<span class="project-usage-empty">Todavía no está vinculado a sus proyectos</span>'}
          </div>

          <div class="library-card-tags">
            ${workCount ? `<span>${escapeHtml(workCount)} obra(s) en proyectos</span>` : ""}
            ${orcid ? `<a href="${escapeHtml(orcid)}" target="_blank" rel="noopener noreferrer">ORCID ↗</a>` : ""}
            ${wikipedia ? `<a href="${escapeHtml(wikipedia)}" target="_blank" rel="noopener noreferrer">Biografía ↗</a>` : ""}
          </div>
        </div>

        <div class="author-card-actions">
          <button
            type="button"
            class="author-open-button"
            data-author-open="${escapeHtml(authorViewKey(author))}"
          >
            <span aria-hidden="true">↗</span>
            Abrir ficha
          </button>
          <select data-author-project="${escapeHtml(author.id)}" aria-label="Proyecto destino para este autor">
            <option value="">Añadir a proyecto…</option>
            ${projects.map(project => `
              <option value="${escapeHtml(project.id)}">
                ${explicitProjects.has(project.id) ? "✓ " : ""}${escapeHtml(project.title)}
              </option>
            `).join("")}
          </select>
          <button type="button" data-author-attach="${escapeHtml(author.id)}">Añadir al proyecto</button>
          <button
            type="button"
            data-author-delete="${escapeHtml(author.documentIds.join("|"))}"
          >Quitar</button>
        </div>
      </article>
    `;
  }).join("");
}

function fillProfileForm() {
  profileSettingsForm.elements.displayName.value =
    currentProfile?.displayName ||
    currentUser?.displayName ||
    "";
  profileSettingsForm.elements.institution.value =
    currentProfile?.institution || "";
  profileSettingsForm.elements.website.value =
    currentProfile?.website || "";
  profileSettingsForm.elements.accentColor.value =
    /^#[0-9a-f]{6}$/i.test(currentProfile?.accentColor || "")
      ? currentProfile.accentColor
      : "#0f62fe";
  profileSettingsForm.elements.bio.value =
    currentProfile?.bio || "";

  renderProfilePreview();
}

function renderCardCatalog(work) {
  if (!cardCatalogGrid || !work) return;

  const activeStyle = projectCardStyle(work.cardStyle);
  const sampleTitle = compact(work.title || "Obra sin título", 58);
  const sampleAuthor = compact(authorNames(work).join("; ") || "Autor no indicado", 44);

  cardCatalogGrid.innerHTML = PROJECT_CARD_STYLES.map(style => `
    <button
      type="button"
      class="card-catalog-option ${style.id === activeStyle ? "is-selected" : ""}"
      data-card-catalog-style="${escapeHtml(style.id)}"
      role="listitem"
      aria-pressed="${style.id === activeStyle ? "true" : "false"}"
    >
      <span class="card-catalog-choice">
        <b>${escapeHtml(style.mark)}</b>
        <span>
          <strong>${escapeHtml(style.label)}</strong>
          <small>${escapeHtml(style.note)}</small>
        </span>
      </span>
      <span class="card-catalog-preview" data-preview-style="${escapeHtml(style.id)}">
        <i>${escapeHtml(work.year || "LECTURA")}</i>
        <strong>${escapeHtml(sampleTitle)}</strong>
        <small>${escapeHtml(sampleAuthor)}</small>
        <em>Ver composición</em>
      </span>
    </button>
  `).join("");
}

function openCardCatalog(workId) {
  const work = projectWorks.find(item => item.id === workId);
  if (!work || !cardCatalogDialog) return;

  cardCatalogWorkId = work.id;
  if (cardCatalogWorkTitle) {
    cardCatalogWorkTitle.textContent = work.title || "Obra sin título";
  }
  renderCardCatalog(work);
  cardCatalogDialog.showModal();
  document.body.classList.add("profile-dialog-open", "modal-open");
}

function closeCardCatalog() {
  cardCatalogWorkId = "";
  if (cardCatalogDialog?.open) cardCatalogDialog.close();
  document.body.classList.remove("profile-dialog-open", "modal-open");
}

function authorViewKey(author) {
  return normalizedPersonName(author?.name || author?.displayName);
}

function allWorksForAuthor(author) {
  const needles = equivalentNormalizedNames(author);
  const merged = new Map();

  const addWork = (work, project = null) => {
    if (!work?.id) return;
    const match = authorNames(work).some(name =>
      needles.has(normalizedPersonName(name))
    );
    if (!match) return;

    const key = work.id;
    const existing = merged.get(key) || {
      ...work,
      projectNames: new Set()
    };
    if (project?.title) existing.projectNames.add(project.title);
    merged.set(key, existing);
  };

  for (const work of library) addWork(work);

  for (const project of projects) {
    for (const work of projectWorkIndex.get(project.id) || []) {
      addWork(work, project);
    }
  }

  for (const work of projectWorks) {
    addWork(work, projectById(selectedProjectId));
  }

  return [...merged.values()]
    .map(work => ({
      ...work,
      projectNames: [...work.projectNames]
    }))
    .sort((a, b) =>
      Number(b.year || 0) - Number(a.year || 0) ||
      String(a.title || "").localeCompare(String(b.title || ""), "es")
    );
}

function internalOrExternalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw, window.location.href);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function openSavedAuthorView(key) {
  if (!savedAuthorDialog || !savedAuthorDialogBody) return;

  const saved = mergedSavedAuthors();
  const projectDerived = projectAuthorsFromWorks(projectWorks, projectAuthors);
  const author = [...saved, ...projectDerived].find(item => {
    const variants = new Set([
      authorViewKey(item),
      ...(item.aliases || []).map(normalizedPersonName)
    ]);
    return variants.has(key);
  });
  if (!author) return;

  const works = allWorksForAuthor(author);
  const memberships = membershipsForAuthor(author);
  const orcid = author.orcid
    ? internalOrExternalUrl(
        String(author.orcid).startsWith("http")
          ? author.orcid
          : `https://orcid.org/${author.orcid}`
      )
    : "";
  const wikipedia = internalOrExternalUrl(
    author.wikipediaUrl || author.saved?.wikipediaUrl
  );
  const sourcePage = internalOrExternalUrl(
    author.sourcePage ||
    author.saved?.sourcePage ||
    author.explicitRecords?.find(record => record.sourcePage)?.sourcePage
  );
  const biography =
    author.biography ||
    author.saved?.biography ||
    author.explicitRecords?.find(record => record.biography)?.biography ||
    "Esta identidad está guardada en su archivo, pero todavía no cuenta con una nota biográfica documentada.";
  const monogram = String(author.name || "Φ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "Φ";

  savedAuthorDialogBody.innerHTML = `
    <section class="author-view-hero">
      <div class="author-view-monogram" aria-hidden="true">${escapeHtml(monogram)}</div>
      <div class="author-view-identity">
        <span class="profile-kicker">AUTOR / ARCHIVO PRIVADO</span>
        <h2>${escapeHtml(author.name || "Autor")}</h2>
        ${author.aliases?.length
          ? `<p class="author-view-aliases">También aparece como <strong>${escapeHtml(author.aliases.join(" · "))}</strong></p>`
          : ""}
        <p class="author-view-bio">${escapeHtml(biography)}</p>
        <div class="author-view-links">
          ${orcid ? `<a href="${escapeHtml(orcid)}" target="_blank" rel="noopener noreferrer">ORCID ↗</a>` : ""}
          ${wikipedia ? `<a href="${escapeHtml(wikipedia)}" target="_blank" rel="noopener noreferrer">Biografía ↗</a>` : ""}
          ${sourcePage ? `<a href="${escapeHtml(sourcePage)}">Abrir fuente guardada ↗</a>` : ""}
        </div>
      </div>
      <div class="author-view-metrics">
        <span><strong>${escapeHtml(works.length)}</strong>lecturas</span>
        <span><strong>${escapeHtml(new Set(memberships.map(item => item.projectId)).size)}</strong>proyectos</span>
        <span><strong>${escapeHtml(author.aliases?.length || 0)}</strong>alias</span>
      </div>
    </section>

    <section class="author-view-section">
      <header>
        <span class="profile-kicker">PROYECTOS</span>
        <h3>Presencia en su investigación</h3>
      </header>
      <div class="author-view-projects">
        ${memberships.length
          ? memberships.map(item => `
              <span>
                <strong>${escapeHtml(item.projectTitle)}</strong>
                ${item.subprojectTitle ? `<small>${escapeHtml(item.subprojectTitle)}</small>` : ""}
                ${item.count ? `<em>${escapeHtml(item.count)} lectura(s)</em>` : "<em>autor añadido</em>"}
              </span>
            `).join("")
          : "<p>Todavía no está vinculado a un proyecto.</p>"}
      </div>
    </section>

    <section class="author-view-section">
      <header>
        <span class="profile-kicker">LECTURAS</span>
        <h3>Obras relacionadas en su archivo</h3>
      </header>
      <div class="author-view-works">
        ${works.length
          ? works.map(work => `
              <article>
                <span>${escapeHtml(work.year || "s. f.")}</span>
                <strong>${escapeHtml(work.title || "Obra sin título")}</strong>
                <small>${escapeHtml(work.projectNames?.join(" · ") || (work.privateOnly ? "Entrada privada" : "Biblioteca"))}</small>
              </article>
            `).join("")
          : "<p>No hay lecturas relacionadas todavía.</p>"}
      </div>
    </section>
  `;

  savedAuthorDialog.showModal();
  document.body.classList.add("profile-dialog-open", "modal-open");
}

function closeSavedAuthorView() {
  if (savedAuthorDialog?.open) savedAuthorDialog.close();
  document.body.classList.remove("profile-dialog-open", "modal-open");
}

function renderProjectWorks() {
  if (!selectedProjectId) {
    projectWorkList.innerHTML = "";
    return;
  }

  const works = visibleProjectWorks().sort((a, b) =>
    timestampValue(b.updatedAt) - timestampValue(a.updatedAt)
  );

  if (!works.length) {
    projectWorkList.innerHTML = `
      <div class="profile-empty project-view-empty">
        ${activeSubprojectFilter === "all"
          ? "Añada obras desde su biblioteca para construir este proyecto."
          : "Esta colección todavía no tiene lecturas."}
      </div>
    `;
    projectWorkNote.textContent = "No hay lecturas en esta vista.";
    renderProjectAuthors();
    renderProjectStats();
    return;
  }

  projectWorkNote.textContent =
    `${works.length} lectura${works.length === 1 ? "" : "s"} en esta vista · puede organizarlas por colección.`;

  projectWorkList.innerHTML = works.map((work, index) => {
    const tags = (work.tags || []).slice(0, 5);
    const collection = subprojects.find(item => item.id === work.subprojectId);
    const style = projectCardStyle(work.cardStyle);
    const styleMeta = projectCardStyleMeta(style);
    const folio = String(index + 1).padStart(2, "0");

    return `
      <article
        class="project-work-card"
        data-card-style="${escapeHtml(style)}"
        style="--work-folio:'${escapeHtml(folio)}'"
      >
        <div class="project-work-card-head">
          <div class="project-work-meta">
            <span>${work.privateOnly ? "ENTRADA PRIVADA" : "MOTOR PÚBLICO"}</span>
            ${work.year ? `<span>${escapeHtml(work.year)}</span>` : ""}
            ${collection ? `<span style="--collection-color:${escapeHtml(collection.color || "#4589ff")}">${escapeHtml(collection.title)}</span>` : ""}
          </div>
          <button
            type="button"
            class="project-work-style-button"
            data-project-work-style="${escapeHtml(work.id)}"
            aria-label="Cambiar diseño de ${escapeHtml(work.title || "esta lectura")}"
          >
            <span aria-hidden="true">${escapeHtml(styleMeta.mark)}</span>
            Diseño · ${escapeHtml(styleMeta.label)}
          </button>
        </div>
        <strong class="project-work-title">${escapeHtml(work.title || "Obra")}</strong>
        <small class="project-work-authors">${escapeHtml(authorNames(work).join("; ") || "Autor no indicado")}</small>
        ${work.abstract ? `<p class="project-work-abstract">${escapeHtml(compact(work.abstract, style === "thesis" ? 160 : 220))}</p>` : ""}
        <div class="project-work-tags">
          ${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="project-work-actions">
          <select
            data-project-work-subproject="${escapeHtml(work.id)}"
            aria-label="Colección de esta obra"
          >
            <option value="">Sin colección</option>
            ${subprojects.map(item => `
              <option value="${escapeHtml(item.id)}" ${work.subprojectId === item.id ? "selected" : ""}>
                ${escapeHtml(item.title)}
              </option>
            `).join("")}
          </select>
          <button type="button" data-project-work-remove="${escapeHtml(work.id)}">
            Quitar del proyecto
          </button>
        </div>
      </article>
    `;
  }).join("");

  renderProjectAuthors();
  renderProjectStats();
}

function projectAuthorPayload(author) {
  const source =
    author.saved ||
    author.explicitRecords?.[0] ||
    {};

  return {
    name: author.name,
    displayName: author.name,
    id: source.sourceId || source.id || normalizedPersonName(author.name),
    sourceId: source.sourceId || source.id || "",
    orcid: author.orcid || source.orcid || "",
    biography: source.biography || "",
    wikipediaUrl: source.wikipediaUrl || "",
    alternateNames: author.aliases || []
  };
}

function projectAuthorRenderKey(author) {
  return normalizedPersonName(author.name);
}

function currentProjectAuthorByKey(key) {
  return projectAuthorsFromWorks().find(author => {
    const variants = new Set([
      normalizedPersonName(author.name),
      ...(author.aliases || []).map(normalizedPersonName)
    ]);
    return variants.has(key);
  }) || null;
}

function renderIdentityReview() {
  if (!projectIdentityReview) return;

  const candidate = nextIdentityReviewCandidate();
  if (!candidate) {
    projectIdentityReview.hidden = true;
    projectIdentityReview.innerHTML = "";
    return;
  }

  projectIdentityReview.hidden = false;
  projectIdentityReview.innerHTML = `
    <div class="identity-review-mark" aria-hidden="true">≈</div>
    <div class="identity-review-copy">
      <span class="profile-kicker">REVISIÓN DE IDENTIDAD</span>
      <h4>¿Son la misma persona?</h4>
      <p>
        <strong>${escapeHtml(candidate.leftName)}</strong>
        <span>↔</span>
        <strong>${escapeHtml(candidate.rightName)}</strong>
      </p>
      <small>${escapeHtml(candidate.evidence)}</small>
    </div>
    <div class="identity-review-actions">
      <button type="button" data-identity-decision="same">Sí, unir identidad</button>
      <button type="button" data-identity-decision="different">No, mantener separadas</button>
    </div>
  `;

  projectIdentityReview.dataset.leftName = candidate.leftName;
  projectIdentityReview.dataset.rightName = candidate.rightName;
  projectIdentityReview.dataset.canonicalName = candidate.canonicalName;
}

function renderProjectAuthors() {
  if (!projectAuthorList) return;
  const authors = projectAuthorsFromWorks();

  renderIdentityReview();

  if (!authors.length) {
    projectAuthorList.innerHTML = `
      <div class="profile-empty project-view-empty">
        Esta vista todavía no tiene autores. Puede añadirlos desde “Autores” o incorporar lecturas.
      </div>
    `;
    return;
  }

  projectAuthorList.innerHTML = authors.map(author => {
    const orcid = author.orcid
      ? safeUrl(String(author.orcid).startsWith("http")
        ? author.orcid
        : `https://orcid.org/${author.orcid}`)
      : "";
    const explicit = author.explicitRecords.length > 0;
    const key = projectAuthorRenderKey(author);
    const selectedSubproject = author.explicitRecords[0]?.subprojectId || "";

    let label = "AUTOR EN LA BIBLIOGRAFÍA";
    if (explicit && author.count) label = "AUTOR AÑADIDO · PRESENTE EN LECTURAS";
    else if (explicit) label = "AUTOR AÑADIDO";
    else if (author.saved) label = "AUTOR GUARDADO · PRESENTE EN LECTURAS";

    return `
      <article class="project-author-card">
        <span class="profile-kicker">${label}</span>
        <h4>${escapeHtml(author.name)}</h4>
        ${author.aliases.length
          ? `<p class="project-author-aliases">Unificado con: ${escapeHtml(author.aliases.join(" · "))}</p>`
          : ""}
        <strong>${escapeHtml(author.count)}</strong>
        <small>obra${author.count === 1 ? "" : "s"} en esta vista</small>
        <div class="project-author-titles">
          ${author.works.slice(0, 4).map(work => `<span>${escapeHtml(compact(work.title, 78))}</span>`).join("")}
        </div>
        ${orcid ? `<a href="${escapeHtml(orcid)}" target="_blank" rel="noopener noreferrer">ORCID ↗</a>` : ""}

        <div class="project-author-actions">
          <button
            type="button"
            class="author-open-button"
            data-project-author-open="${escapeHtml(key)}"
          >
            <span aria-hidden="true">↗</span>
            Abrir ficha
          </button>
          ${explicit ? `
            <select
              data-project-author-subproject="${escapeHtml(key)}"
              aria-label="Colección de este autor"
            >
              <option value="">Sin colección</option>
              ${subprojects.map(item => `
                <option value="${escapeHtml(item.id)}" ${selectedSubproject === item.id ? "selected" : ""}>
                  ${escapeHtml(item.title)}
                </option>
              `).join("")}
            </select>
            <button type="button" data-project-author-remove="${escapeHtml(key)}">
              Quitar autor del proyecto
            </button>
          ` : `
            <button type="button" data-project-author-pin="${escapeHtml(key)}">
              Añadir autor al proyecto
            </button>
          `}
          ${author.saved ? "" : `
            <button type="button" data-project-author-save="${escapeHtml(key)}">
              Guardar en mi archivo
            </button>
          `}
        </div>
      </article>
    `;
  }).join("");
}

const STOPWORDS = new Set([
  "para","como","con","por","una","uno","unos","unas","del","las","los",
  "que","sus","sin","sobre","entre","desde","this","that","with","from",
  "the","and","for","into","dans","les","des","une","und","der","die","das",
  "ein","eine","von","zur","zum","est","son","ser","más","mas","pero","porque"
]);

function tokensFor(work) {
  const source = [
    work.title,
    work.abstract,
    ...(work.tags || []),
    ...authorNames(work)
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9\s-]/g, " ");

  return new Set(
    source
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token =>
        token.length > 2 &&
        !STOPWORDS.has(token)
      )
  );
}

function intersectSize(left, right) {
  let count = 0;
  const [small, large] =
    left.size <= right.size ? [left, right] : [right, left];

  for (const item of small) {
    if (large.has(item)) count += 1;
  }

  return count;
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  const intersection = intersectSize(left, right);
  return intersection / (left.size + right.size - intersection);
}

function workSimilarity(left, right) {
  const leftTokens = tokensFor(left);
  const rightTokens = tokensFor(right);
  const lexical = jaccard(leftTokens, rightTokens);

  const leftAuthors = new Set(
    authorNames(left).map(name => name.toLocaleLowerCase("es"))
  );
  const rightAuthors = new Set(
    authorNames(right).map(name => name.toLocaleLowerCase("es"))
  );
  const sharedAuthor = intersectSize(leftAuthors, rightAuthors) > 0;

  const leftTags = new Set(
    (left.tags || []).map(tag => String(tag).toLocaleLowerCase("es"))
  );
  const rightTags = new Set(
    (right.tags || []).map(tag => String(tag).toLocaleLowerCase("es"))
  );
  const sharedTags = intersectSize(leftTags, rightTags);

  return Math.min(
    1,
    lexical +
    (sharedAuthor ? .34 : 0) +
    Math.min(.24, sharedTags * .08)
  );
}

function colorWithAlpha(hex, alpha) {
  const normalized = String(hex || "#0f62fe").replace("#", "");
  const safe = /^[0-9a-f]{6}$/i.test(normalized) ? normalized : "0f62fe";
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawProjectAtlas() {
  if (
    !atlasCanvas ||
    atlasCanvas.offsetParent === null ||
    projectDetail.hidden ||
    !selectedProjectId
  ) return;

  const project = projectById(selectedProjectId);
  const works = visibleProjectWorks().slice(0, 90);
  const rect = atlasCanvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width || 900));
  const height = Math.max(360, Math.round(rect.height || 520));
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  atlasCanvas.width = Math.round(width * dpr);
  atlasCanvas.height = Math.round(height * dpr);

  const context = atlasCanvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const dark = document.documentElement.dataset.theme === "dark";
  const grid = dark ? "rgba(255,255,255,.05)" : "rgba(22,22,22,.05)";
  const text = dark ? "#f4f4f4" : "#161616";
  const muted = dark ? "#a8a8a8" : "#6f6f6f";
  const baseColor = project?.color || "#0f62fe";
  const accentColor = project?.accentColor || "#8a3ffc";

  context.strokeStyle = grid;
  context.lineWidth = 1;

  for (let x = 0; x < width; x += 32) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 0; y < height; y += 32) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  if (!works.length) {
    context.fillStyle = muted;
    context.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textAlign = "center";
    context.fillText(
      "Añada obras al proyecto para construir el Atlas privado.",
      width / 2,
      height / 2
    );
    atlasNote.textContent = "Añada obras al proyecto para construir el mapa.";
    return;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(
    100,
    Math.min(width, height) * .34
  );

  const nodes = works.map((work, index) => {
    const angle =
      (index / Math.max(1, works.length)) * Math.PI * 2 -
      Math.PI / 2;
    const ring =
      works.length <= 12
        ? radius
        : radius * (.56 + (index % 3) * .19);

    const subproject = subprojects.find(
      item => item.id === work.subprojectId
    );

    return {
      work,
      x: centerX + Math.cos(angle * 1.07) * ring,
      y: centerY + Math.sin(angle) * ring,
      r: work.privateOnly ? 9 : 8,
      color:
        subproject?.color ||
        (work.privateOnly ? accentColor : baseColor)
    };
  });

  const edges = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const candidates = [];
    for (let j = i + 1; j < nodes.length; j += 1) {
      const score = workSimilarity(
        nodes[i].work,
        nodes[j].work
      );
      if (score >= .12) {
        candidates.push({ j, score });
      }
    }
    candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .forEach(candidate => {
        edges.push({
          a: i,
          b: candidate.j,
          score: candidate.score
        });
      });
  }

  for (const edge of edges) {
    const a = nodes[edge.a];
    const b = nodes[edge.b];
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.strokeStyle = colorWithAlpha(
      baseColor,
      .08 + edge.score * .42
    );
    context.lineWidth = .6 + edge.score * 2.2;
    context.stroke();
  }

  for (const node of nodes) {
    context.beginPath();
    context.arc(node.x, node.y, node.r + 5, 0, Math.PI * 2);
    context.fillStyle = colorWithAlpha(
      node.color,
      .12
    );
    context.fill();

    context.beginPath();
    context.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    context.fillStyle = node.color;
    context.fill();

    context.strokeStyle = dark ? "#101214" : "#ffffff";
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = text;
    context.textAlign = "center";
    context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    const label = compact(node.work.title || "Obra", 24);
    context.fillText(
      label,
      node.x,
      node.y + node.r + 17
    );
  }

  context.fillStyle = colorWithAlpha(baseColor, .08);
  context.beginPath();
  context.arc(centerX, centerY, 44, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = text;
  context.textAlign = "center";
  context.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText("PROYECTO", centerX, centerY - 2);
  context.fillStyle = muted;
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(
    `${works.length} obra${works.length === 1 ? "" : "s"}`,
    centerX,
    centerY + 15
  );

  atlasNote.textContent =
    `${works.length} obra${works.length === 1 ? "" : "s"} · ${edges.length} relaciones visibles · título, abstract, autor y etiquetas.`;
}

async function loadPrivateWorkspace(user) {
  if (!user?.uid) return;
  if (activeWorkspaceUid === user.uid && !workspace.hidden) return;

  activeWorkspaceUid = user.uid;
  currentUser = user;
  currentProfile = null;
  markVerifiedAuthHint();

  stopRealtimeListeners();

  // Never make the visible workspace depend on a Firestore round trip.
  // Firebase Auth already owns the local session; profile metadata hydrates after paint.
  fillProfileForm();
  renderIdentity();
  showWorkspace();

  const requestedPanel = location.hash.startsWith("#proyecto?")
    ? "proyectos"
    : location.hash.replace(/^#/, "");

  setActivePanel(
    profilePanels.some(panel => panel.id === requestedPanel)
      ? requestedPanel
      : "resumen",
    { updateHash: false, scroll: false }
  );

  unsubscribeProjects = subscribeProjects(
    user.uid,
    items => {
      projects = items;
      syncProjectAssignmentIndex(user.uid);
      renderProjects();
      renderLibrary();
      renderAuthors();

      if (pendingProjectSelectionId && projects.some(project => project.id === pendingProjectSelectionId)) {
        const id = pendingProjectSelectionId;
        pendingProjectSelectionId = "";
        selectProject(id);
        return;
      }

      if (selectedProjectId && projects.some(project => project.id === selectedProjectId) && !unsubscribeProjectWorks) {
        selectProject(selectedProjectId);
        return;
      }

      if (!selectedProjectId && projects.length) {
        const hashProject = new URLSearchParams(
          location.hash.replace(/^#/, "").replace(/^proyecto\?/, "")
        ).get("id");

        if (projects.some(project => project.id === hashProject)) {
          selectProject(hashProject);
        }
      }
    }
  );

  unsubscribeLibrary = subscribeLibrary(
    user.uid,
    items => {
      library = items;
      renderLibrary();
    }
  );

  unsubscribeAuthors = subscribeSavedAuthors(
    user.uid,
    items => {
      savedAuthors = items;
      renderAuthors();
      renderProjectAuthors();
      renderProjectStats();
    }
  );

  unsubscribeIdentityDecisions = subscribeAuthorIdentityDecisions(
    user.uid,
    items => {
      identityDecisions = items;
      renderAuthors();
      renderProjectAuthors();
      renderProjectStats();
    }
  );

  // Profile metadata is useful, but it must never hold the whole private UI hostage.
  void hydratePrivateProfile(user);
}

function setActivePanel(id, {
  updateHash = true,
  scroll = true
} = {}) {
  const target = profilePanels.some(panel => panel.id === id)
    ? id
    : "resumen";

  profilePanels.forEach(panel => {
    const active = panel.id === target;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });

  profileNavLinks.forEach(link => {
    const active = link.dataset.profileNav === target;
    link.classList.toggle("is-active", active);
    link.setAttribute("aria-current", active ? "page" : "false");
  });

  if (updateHash) {
    history.replaceState(null, "", `#${target}`);
  }

  if (target === "proyectos") {
    requestAnimationFrame(drawProjectAtlas);
  }

  if (scroll) {
    document.querySelector(".profile-content")?.scrollIntoView({
      behavior: "auto",
      block: "start"
    });
  }
}

profileNavLinks.forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    setActivePanel(link.dataset.profileNav);
  });
});

document.querySelectorAll("[data-profile-jump]").forEach(button => {
  button.addEventListener("click", () => {
    setActivePanel(button.dataset.profileJump);
  });
});

gateLogin.addEventListener("click", () => {
  window.dispatchEvent(
    new CustomEvent("research-account:open", {
      detail: { mode: "login" }
    })
  );
});

projectCreateForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return;

  const data = new FormData(projectCreateForm);
  const id = await createProject(currentUser.uid, {
    title: data.get("title"),
    area: data.get("area"),
    researchQuestion: data.get("researchQuestion"),
    description: data.get("description"),
    keywords: keywordsFrom(data.get("keywords")),
    color: data.get("color"),
    accentColor: data.get("accentColor"),
    status: data.get("status")
  });

  projectCreateForm.reset();
  projectCreateForm.elements.color.value = "#0f62fe";
  projectCreateForm.elements.accentColor.value = "#8a3ffc";
  projectCreateForm.elements.status.value = "active";

  pendingProjectSelectionId = id;
  if (projects.some(project => project.id === id)) {
    pendingProjectSelectionId = "";
    selectProject(id);
  }
});

projectGrid.addEventListener("click", event => {
  const card = event.target.closest("[data-project-open]");
  if (!card) return;
  selectProject(card.dataset.projectOpen);
});

projectGrid.addEventListener("keydown", event => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest("[data-project-open]");
  if (!card) return;
  event.preventDefault();
  selectProject(card.dataset.projectOpen);
});

projectViewButtons.forEach(button => {
  button.addEventListener("click", () => {
    setProjectView(button.dataset.projectView);
  });
});

subprojectList.addEventListener("click", event => {
  const card = event.target.closest("[data-subproject-filter]");
  if (!card) return;
  activeSubprojectFilter = card.dataset.subprojectFilter || "all";
  renderSubprojects();
  renderProjectWorks();
  renderProjectAuthors();
  drawProjectAtlas();
});

projectSettingsToggle?.addEventListener("click", () => {
  projectSettings.open = !projectSettings.open;
  projectSettingsToggle.setAttribute("aria-expanded", projectSettings.open ? "true" : "false");
  if (projectSettings.open) {
    projectSettings.scrollIntoView({ behavior: "auto", block: "start" });
  }
});

projectSettings?.addEventListener("toggle", () => {
  projectSettingsToggle?.setAttribute("aria-expanded", projectSettings.open ? "true" : "false");
});

projectExportButton?.addEventListener("click", exportProjectExcel);
libraryExportButton?.addEventListener("click", exportLibraryExcel);
authorsExportButton?.addEventListener("click", exportAuthorsExcel);

projectEditForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser || !selectedProjectId) return;

  const data = new FormData(projectEditForm);

  await updateProject(currentUser.uid, selectedProjectId, {
    title: data.get("title"),
    area: data.get("area"),
    researchQuestion: data.get("researchQuestion"),
    description: data.get("description"),
    keywords: keywordsFrom(data.get("keywords")),
    color: data.get("color"),
    accentColor: data.get("accentColor"),
    status: data.get("status")
  });
});

document.querySelector("[data-project-delete]")
  .addEventListener("click", async () => {
    if (!currentUser || !selectedProjectId) return;
    const project = projectById(selectedProjectId);
    if (!project) return;

    const confirmed = confirm(
      `¿Eliminar "${project.title}" y sus subproyectos/obras asociadas? La biblioteca personal no se elimina.`
    );
    if (!confirmed) return;

    const id = selectedProjectId;
    selectedProjectId = "";
    projectDetail.hidden = true;
    await deleteProject(currentUser.uid, id);
  });

subprojectForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser || !selectedProjectId) return;

  const data = new FormData(subprojectForm);
  const id = String(data.get("id") || "");

  const payload = {
    title: data.get("title"),
    description: data.get("description"),
    color: data.get("color"),
    status: data.get("status")
  };

  if (id) {
    await updateSubproject(
      currentUser.uid,
      selectedProjectId,
      id,
      payload
    );
  } else {
    await createSubproject(
      currentUser.uid,
      selectedProjectId,
      payload
    );
  }

  resetSubprojectForm();
});

subprojectCancel.addEventListener("click", resetSubprojectForm);

subprojectManageList.addEventListener("click", async event => {
  const edit = event.target.closest("[data-subproject-edit]");
  const remove = event.target.closest("[data-subproject-delete]");

  if (edit) {
    const item = subprojects.find(
      subproject => subproject.id === edit.dataset.subprojectEdit
    );
    if (!item) return;

    subprojectForm.elements.id.value = item.id;
    subprojectForm.elements.title.value = item.title || "";
    subprojectForm.elements.description.value = item.description || "";
    subprojectForm.elements.color.value =
      /^#[0-9a-f]{6}$/i.test(item.color || "")
        ? item.color
        : "#4589ff";
    subprojectForm.elements.status.value = item.status || "active";
    subprojectSubmit.textContent = "Guardar colección";
    subprojectCancel.hidden = false;
    return;
  }

  if (remove && currentUser && selectedProjectId) {
    const item = subprojects.find(
      subproject => subproject.id === remove.dataset.subprojectDelete
    );
    if (!item) return;

    if (!confirm(`¿Eliminar la colección "${item.title}"?`)) return;

    await deleteSubproject(
      currentUser.uid,
      selectedProjectId,
      item.id
    );
  }
});

manualWorkForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return;

  const data = new FormData(manualWorkForm);
  const projectId = String(data.get("projectId") || "");

  const saved = await saveLibraryWork(
    currentUser.uid,
    {
      title: data.get("title"),
      authors: authorsFrom(data.get("authors")),
      year: data.get("year") || null,
      type: data.get("type"),
      abstract: data.get("abstract"),
      tags: keywordsFrom(data.get("tags")),
      doi: data.get("doi"),
      referenceUrl: data.get("referenceUrl"),
      providers: []
    },
    {
      origin: "private-user-entry",
      privateOnly: true
    }
  );

  if (projectId) {
    await attachWorkToProject(
      currentUser.uid,
      projectId,
      saved
    );
  }

  manualWorkForm.reset();
  manualWorkProject.value = "";
});

libraryList.addEventListener("click", async event => {
  const attach = event.target.closest("[data-library-attach]");
  const remove = event.target.closest("[data-library-delete]");

  if (attach && currentUser) {
    const workId = attach.dataset.libraryAttach;
    const work = library.find(item => item.id === workId);
    const select = libraryList.querySelector(
      `[data-library-project="${CSS.escape(workId)}"]`
    );
    const projectId = select?.value || "";

    if (!work || !projectId) {
      select?.focus();
      return;
    }

    await attachWorkToProject(
      currentUser.uid,
      projectId,
      work
    );

    attach.textContent = "Añadida";
    setTimeout(() => {
      attach.textContent = "Añadir al proyecto";
    }, 1400);
    return;
  }

  if (remove && currentUser) {
    const work = library.find(
      item => item.id === remove.dataset.libraryDelete
    );
    if (!work) return;

    if (!confirm(`¿Quitar "${work.title}" de su biblioteca? Las copias ya añadidas a proyectos se conservarán.`)) {
      return;
    }

    await deleteLibraryWork(currentUser.uid, work.id);
  }
});

savedAuthorList.addEventListener("click", async event => {
  const open = event.target.closest("[data-author-open]");
  const attach = event.target.closest("[data-author-attach]");
  const remove = event.target.closest("[data-author-delete]");

  if (open) {
    openSavedAuthorView(open.dataset.authorOpen || "");
    return;
  }

  if (attach && currentUser) {
    const authors = mergedSavedAuthors();
    const author = authors.find(item => item.id === attach.dataset.authorAttach);
    const select = savedAuthorList.querySelector(
      `[data-author-project="${CSS.escape(attach.dataset.authorAttach)}"]`
    );
    const projectId = select?.value || "";

    if (!author || !projectId) {
      select?.focus();
      return;
    }

    await attachAuthorToProject(
      currentUser.uid,
      projectId,
      projectAuthorPayload(author)
    );

    attach.textContent = "Añadido ✓";
    window.setTimeout(() => {
      attach.textContent = "Añadir al proyecto";
    }, 1400);
    return;
  }

  if (remove && currentUser) {
    const ids = String(remove.dataset.authorDelete || "")
      .split("|")
      .filter(Boolean);
    if (!ids.length) return;

    await Promise.all(
      ids.map(id => deleteSavedAuthor(currentUser.uid, id))
    );
  }
});

projectIdentityReview?.addEventListener("click", async event => {
  const button = event.target.closest("[data-identity-decision]");
  if (!button || !currentUser) return;

  const leftName = projectIdentityReview.dataset.leftName || "";
  const rightName = projectIdentityReview.dataset.rightName || "";
  const canonicalName = projectIdentityReview.dataset.canonicalName || "";
  if (!leftName || !rightName) return;

  const same = button.dataset.identityDecision === "same";
  const buttons = [...projectIdentityReview.querySelectorAll("button")];
  buttons.forEach(item => { item.disabled = true; });

  try {
    await saveAuthorIdentityDecision(currentUser.uid, {
      leftName,
      rightName,
      same,
      canonicalName: same ? canonicalName : ""
    });
  } catch (error) {
    console.error("No fue posible guardar la decisión de identidad.", error);
    buttons.forEach(item => { item.disabled = false; });
  }
});

projectAuthorList.addEventListener("change", async event => {
  const select = event.target.closest("[data-project-author-subproject]");
  if (!select || !currentUser || !selectedProjectId) return;

  const author = currentProjectAuthorByKey(
    select.dataset.projectAuthorSubproject
  );
  if (!author?.explicitRecords?.length) return;

  await Promise.all(
    author.explicitRecords.map(record =>
      attachAuthorToProject(
        currentUser.uid,
        selectedProjectId,
        record,
        { subprojectId: select.value }
      )
    )
  );
});

projectAuthorList.addEventListener("click", async event => {
  const open = event.target.closest("[data-project-author-open]");
  if (open) {
    openSavedAuthorView(open.dataset.projectAuthorOpen || "");
    return;
  }

  if (!currentUser || !selectedProjectId) return;

  const pin = event.target.closest("[data-project-author-pin]");
  const remove = event.target.closest("[data-project-author-remove]");
  const save = event.target.closest("[data-project-author-save]");
  const key =
    pin?.dataset.projectAuthorPin ||
    remove?.dataset.projectAuthorRemove ||
    save?.dataset.projectAuthorSave ||
    "";

  if (!key) return;
  const author = currentProjectAuthorByKey(key);
  if (!author) return;

  if (pin) {
    const subprojectId =
      !["all", "unfiled"].includes(activeSubprojectFilter)
        ? activeSubprojectFilter
        : "";

    await attachAuthorToProject(
      currentUser.uid,
      selectedProjectId,
      projectAuthorPayload(author),
      { subprojectId }
    );
    return;
  }

  if (remove && author.explicitRecords?.length) {
    await Promise.all(
      author.explicitRecords.map(record =>
        detachAuthorFromProject(
          currentUser.uid,
          selectedProjectId,
          record.id
        )
      )
    );
    return;
  }

  if (save) {
    await saveAuthor(
      currentUser.uid,
      projectAuthorPayload(author)
    );
  }
});


projectWorkList.addEventListener("change", async event => {
  const select = event.target.closest("[data-project-work-subproject]");
  if (!select || !currentUser || !selectedProjectId) return;

  const work = projectWorks.find(
    item => item.id === select.dataset.projectWorkSubproject
  );
  if (!work) return;

  await attachWorkToProject(
    currentUser.uid,
    selectedProjectId,
    work,
    {
      subprojectId: select.value
    }
  );
});

projectWorkList.addEventListener("click", async event => {
  const style = event.target.closest("[data-project-work-style]");
  const remove = event.target.closest("[data-project-work-remove]");

  if (style) {
    openCardCatalog(style.dataset.projectWorkStyle || "");
    return;
  }

  if (!remove || !currentUser || !selectedProjectId) return;

  await detachWorkFromProject(
    currentUser.uid,
    selectedProjectId,
    remove.dataset.projectWorkRemove
  );
});

cardCatalogGrid?.addEventListener("click", async event => {
  const option = event.target.closest("[data-card-catalog-style]");
  if (!option || !currentUser || !selectedProjectId || !cardCatalogWorkId) return;

  const style = projectCardStyle(option.dataset.cardCatalogStyle);
  const workId = cardCatalogWorkId;
  const work = projectWorks.find(item => item.id === workId);
  const previousStyle = work?.cardStyle || "default";
  const buttons = [...cardCatalogGrid.querySelectorAll("[data-card-catalog-style]")];
  buttons.forEach(button => {
    button.disabled = true;
    button.classList.toggle(
      "is-selected",
      button.dataset.cardCatalogStyle === style
    );
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.cardCatalogStyle === style)
    );
  });

  // Reflect the choice immediately instead of waiting for Firestore's snapshot.
  if (work) {
    work.cardStyle = style;
    renderProjectWorks();
  }

  try {
    await updateProjectWorkPresentation(
      currentUser.uid,
      selectedProjectId,
      workId,
      { cardStyle: style }
    );
    closeCardCatalog();
  } catch (error) {
    if (work) {
      work.cardStyle = previousStyle;
      renderProjectWorks();
    }
    console.error("No fue posible guardar el diseño de la lectura.", error);
    buttons.forEach(button => { button.disabled = false; });
  }
});

document.querySelector("[data-card-catalog-close]")
  ?.addEventListener("click", closeCardCatalog);

document.querySelector("[data-author-view-close]")
  ?.addEventListener("click", closeSavedAuthorView);

cardCatalogDialog?.addEventListener("close", () => {
  cardCatalogWorkId = "";
  document.body.classList.remove("profile-dialog-open", "modal-open");
});

savedAuthorDialog?.addEventListener("close", () => {
  document.body.classList.remove("profile-dialog-open", "modal-open");
});

profileSettingsForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return;

  const data = new FormData(profileSettingsForm);
  const originalLabel = profileSaveButton.textContent;

  profileSaveButton.disabled = true;
  profileSaveButton.setAttribute("aria-busy", "true");
  profileSaveButton.textContent = "Guardando…";
  profileSaveStatus.textContent = "";
  profileSaveStatus.classList.remove("is-error");

  try {
    await updateUserProfileDocument(currentUser.uid, {
      displayName: data.get("displayName"),
      institution: data.get("institution"),
      website: data.get("website"),
      accentColor: data.get("accentColor"),
      bio: data.get("bio")
    });

    const displayName = String(data.get("displayName") || "").trim();
    if (displayName && displayName !== currentUser.displayName) {
      await updateAuthProfile(currentUser, { displayName });
    }

    currentProfile = await getUserProfile(currentUser.uid);
    fillProfileForm();
    renderIdentity();

    profileSaveButton.textContent = "Guardado ✓";
    profileSaveStatus.textContent = "Cambios guardados.";

    window.setTimeout(() => {
      setActivePanel("resumen", {
        updateHash: true,
        scroll: true
      });

      profileSaveButton.disabled = false;
      profileSaveButton.removeAttribute("aria-busy");
      profileSaveButton.textContent = originalLabel;
      profileSaveStatus.textContent = "";
    }, 480);
  } catch (error) {
    console.error("No se pudo guardar el perfil.", error);

    profileSaveButton.disabled = false;
    profileSaveButton.removeAttribute("aria-busy");
    profileSaveButton.textContent = originalLabel;
    profileSaveStatus.textContent =
      "No fue posible guardar los cambios. Intente de nuevo.";
    profileSaveStatus.classList.add("is-error");
  }
});

settingsBackButton.addEventListener("click", () => {
  setActivePanel("resumen", {
    updateHash: true,
    scroll: true
  });
});

profileSettingsForm.addEventListener("input", event => {
  profileSaveStatus.textContent = "";
  profileSaveStatus.classList.remove("is-error");
  if (event.target?.name === "accentColor") {
    applyProfileAccent(event.target.value);
  }

  if (["displayName", "institution", "bio"].includes(event.target?.name)) {
    renderProfilePreview();
  }
});

async function leavePrivateWorkspace() {
  try {
    await signOut(auth);
    clearVerifiedAuthHint();
  } catch (error) {
    console.error("No se pudo cerrar la sesión.", error);
  }
}

signoutButton.addEventListener("click", leavePrivateWorkspace);
signoutSecondary.addEventListener("click", leavePrivateWorkspace);

let atlasFrame = 0;
function scheduleAtlasDraw() {
  cancelAnimationFrame(atlasFrame);
  atlasFrame = requestAnimationFrame(drawProjectAtlas);
}

window.addEventListener("resize", scheduleAtlasDraw);
window.addEventListener("philosophythemechange", scheduleAtlasDraw);

const resizeObserver = new ResizeObserver(scheduleAtlasDraw);
if (atlasCanvas) resizeObserver.observe(atlasCanvas);

if (!firebaseReady()) {
  clearVerifiedAuthHint();
  showGate(
    "La interfaz está instalada, pero este despliegue todavía no tiene un proyecto Firebase configurado. Añada firebaseConfig para activar cuentas y datos privados."
  );
} else {
  const bootWatchdog = window.setTimeout(() => {
    if (!document.body.classList.contains("profile-auth-pending")) return;

    const fallbackUser = auth?.currentUser;
    if (fallbackUser?.emailVerified) {
      console.warn(
        "Firebase Auth tardó en emitir el estado inicial; usando la sesión local verificada."
      );
      void loadPrivateWorkspace(fallbackUser);
      return;
    }

    showGate(
      "La sesión tardó demasiado en responder. Puede volver a entrar sin perder sus datos privados."
    );
  }, PROFILE_BOOT_WATCHDOG_MS);

  onAuthStateChanged(auth, async user => {
    window.clearTimeout(bootWatchdog);

    stopRealtimeListeners();
    activeWorkspaceUid = "";
    selectedProjectId = "";
    projects = [];
    library = [];
    savedAuthors = [];
    subprojects = [];
    projectWorks = [];

    if (!user) {
      clearVerifiedAuthHint();
      currentUser = null;
      currentProfile = null;
      showGate(
        "Inicie sesión para acceder a obras guardadas, autores, proyectos y atlas privados."
      );
      return;
    }

    const verified = await refreshVerificationOnlyWhenNeeded(user);

    if (!verified) {
      clearVerifiedAuthHint();
      currentUser = null;
      currentProfile = null;
      showGate(
        "Su correo todavía no está verificado. Revise el mensaje de verificación y después inicie sesión."
      );
      return;
    }

    try {
      await loadPrivateWorkspace(user);
    } catch (error) {
      console.error("No se pudo iniciar el espacio privado.", error);

      // Even an unexpected bootstrap error must never leave the user on an infinite loader.
      showGate(
        "No fue posible iniciar su espacio privado. Vuelva a entrar; sus datos permanecen en Firebase."
      );
    }
  });
}

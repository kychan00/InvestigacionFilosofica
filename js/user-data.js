import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

import {
  db,
  firebaseReady
} from "./firebase-client.js";

function requiredDb() {
  if (!firebaseReady() || !db) {
    throw new Error("firebase-not-configured");
  }
  return db;
}

function compactText(value, max = 4000) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeUrl(value) {
  const text = compactText(value, 2000);
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function stringHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function stableDocumentId(prefix, ...parts) {
  const seed = parts
    .map(part => compactText(part, 1000).toLocaleLowerCase("es"))
    .filter(Boolean)
    .join("|");
  const human = seed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${prefix}-${human || "item"}-${stringHash(seed || Date.now())}`;
}

function userRef(uid) {
  return doc(requiredDb(), "users", uid);
}

function userCollection(uid, name) {
  return collection(requiredDb(), "users", uid, name);
}

function projectRef(uid, projectId) {
  return doc(requiredDb(), "users", uid, "projects", projectId);
}

function subprojectRef(uid, projectId, subprojectId) {
  return doc(
    requiredDb(),
    "users",
    uid,
    "projects",
    projectId,
    "subprojects",
    subprojectId
  );
}

function projectWorkRef(uid, projectId, workId) {
  return doc(
    requiredDb(),
    "users",
    uid,
    "projects",
    projectId,
    "works",
    workId
  );
}

export async function ensureUserProfile(user) {
  if (!user?.uid) return null;

  const ref = userRef(user.uid);
  const snapshot = await getDoc(ref);

  const providerIds = (user.providerData || [])
    .map(provider => provider.providerId)
    .filter(Boolean);

  if (!snapshot.exists()) {
    await setDoc(ref, {
      displayName: compactText(user.displayName, 160),
      email: compactText(user.email, 320),
      photoURL: normalizeUrl(user.photoURL),
      bio: "",
      institution: "",
      website: "",
      accentColor: "#0f62fe",
      providerIds,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(ref, {
      email: compactText(user.email, 320),
      photoURL: normalizeUrl(user.photoURL),
      providerIds,
      updatedAt: serverTimestamp()
    });
  }

  return ref;
}

export async function getUserProfile(uid) {
  const snapshot = await getDoc(userRef(uid));
  return snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() }
    : null;
}

export async function updateUserProfileDocument(uid, changes) {
  const allowed = {
    displayName: compactText(changes.displayName, 160),
    bio: compactText(changes.bio, 2000),
    institution: compactText(changes.institution, 300),
    website: normalizeUrl(changes.website),
    accentColor: /^#[0-9a-f]{6}$/i.test(changes.accentColor || "")
      ? changes.accentColor
      : "#0f62fe",
    updatedAt: serverTimestamp()
  };

  await setDoc(
    userRef(uid),
    allowed,
    { merge: true }
  );
}

export function subscribeProjects(uid, callback) {
  const ref = query(
    userCollection(uid, "projects"),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(ref, snapshot => {
    callback(
      snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }))
    );
  });
}

export async function createProject(uid, data) {
  const id = stableDocumentId(
    "project",
    data.title,
    crypto.randomUUID?.() || Date.now()
  );

  await setDoc(projectRef(uid, id), {
    title: compactText(data.title, 240),
    description: compactText(data.description, 2400),
    researchQuestion: compactText(data.researchQuestion, 1200),
    area: compactText(data.area, 300),
    keywords: Array.from(
      new Set(
        (data.keywords || [])
          .map(item => compactText(item, 80))
          .filter(Boolean)
      )
    ).slice(0, 30),
    color: /^#[0-9a-f]{6}$/i.test(data.color || "")
      ? data.color
      : "#0f62fe",
    accentColor: /^#[0-9a-f]{6}$/i.test(data.accentColor || "")
      ? data.accentColor
      : "#8a3ffc",
    status: ["active", "paused", "archived"].includes(data.status)
      ? data.status
      : "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return id;
}

export async function updateProject(uid, projectId, data) {
  await updateDoc(projectRef(uid, projectId), {
    title: compactText(data.title, 240),
    description: compactText(data.description, 2400),
    researchQuestion: compactText(data.researchQuestion, 1200),
    area: compactText(data.area, 300),
    keywords: Array.from(
      new Set(
        (data.keywords || [])
          .map(item => compactText(item, 80))
          .filter(Boolean)
      )
    ).slice(0, 30),
    color: /^#[0-9a-f]{6}$/i.test(data.color || "")
      ? data.color
      : "#0f62fe",
    accentColor: /^#[0-9a-f]{6}$/i.test(data.accentColor || "")
      ? data.accentColor
      : "#8a3ffc",
    status: ["active", "paused", "archived"].includes(data.status)
      ? data.status
      : "active",
    updatedAt: serverTimestamp()
  });
}

export async function deleteProject(uid, projectId) {
  await deleteDoc(projectRef(uid, projectId));
}

export function subscribeSubprojects(uid, projectId, callback) {
  const ref = query(
    collection(
      requiredDb(),
      "users",
      uid,
      "projects",
      projectId,
      "subprojects"
    ),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(ref, snapshot => {
    callback(
      snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }))
    );
  });
}

export async function createSubproject(uid, projectId, data) {
  const id = stableDocumentId(
    "subproject",
    data.title,
    crypto.randomUUID?.() || Date.now()
  );

  await setDoc(subprojectRef(uid, projectId, id), {
    title: compactText(data.title, 240),
    description: compactText(data.description, 1600),
    color: /^#[0-9a-f]{6}$/i.test(data.color || "")
      ? data.color
      : "#4589ff",
    status: ["active", "paused", "archived"].includes(data.status)
      ? data.status
      : "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return id;
}

export async function updateSubproject(uid, projectId, subprojectId, data) {
  await updateDoc(subprojectRef(uid, projectId, subprojectId), {
    title: compactText(data.title, 240),
    description: compactText(data.description, 1600),
    color: /^#[0-9a-f]{6}$/i.test(data.color || "")
      ? data.color
      : "#4589ff",
    status: ["active", "paused", "archived"].includes(data.status)
      ? data.status
      : "active",
    updatedAt: serverTimestamp()
  });
}

export async function deleteSubproject(uid, projectId, subprojectId) {
  await deleteDoc(subprojectRef(uid, projectId, subprojectId));
}

function normalizeAuthor(author) {
  if (typeof author === "string") {
    return { name: compactText(author, 300) };
  }

  return {
    name: compactText(author?.name || author?.displayName, 300),
    id: compactText(author?.id, 500),
    orcid: compactText(author?.orcid, 120)
  };
}

export function normalizeWork(work, {
  origin = "public-engine",
  privateOnly = false
} = {}) {
  const authors = (work?.authors || [])
    .map(normalizeAuthor)
    .filter(author => author.name);

  const doi = compactText(work?.doi, 300)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");

  const referenceUrl =
    normalizeUrl(work?.referenceUrl) ||
    normalizeUrl(work?.urls?.reference) ||
    normalizeUrl(work?.url) ||
    normalizeUrl(work?.openAccess?.url);

  const tags = Array.from(
    new Set(
      [
        ...(work?.tags || []),
        ...(work?.keywords || [])
      ]
        .map(item => compactText(item, 100))
        .filter(Boolean)
    )
  ).slice(0, 40);

  const title = compactText(work?.title, 600);
  const id = stableDocumentId(
    "work",
    doi || work?.id || work?.openalexId || title,
    authors.map(author => author.name).join("|"),
    work?.year
  );

  return {
    id,
    title,
    authors,
    abstract: compactText(work?.abstract, 12000),
    tags,
    year: Number.isFinite(Number(work?.year))
      ? Number(work.year)
      : null,
    type: compactText(work?.type || work?.workType, 120),
    journal: compactText(work?.journal, 500),
    doi,
    referenceUrl,
    providers: Array.from(
      new Set(
        (work?.providers || [])
          .map(item => compactText(item, 120))
          .filter(Boolean)
      )
    ).slice(0, 20),
    sourceRecordId: compactText(work?.id || work?.openalexId, 700),
    origin,
    privateOnly: Boolean(privateOnly)
  };
}

export async function saveLibraryWork(uid, work, options = {}) {
  const normalized = normalizeWork(work, options);

  await setDoc(
    doc(requiredDb(), "users", uid, "library", normalized.id),
    {
      ...normalized,
      savedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return normalized;
}

export async function deleteLibraryWork(uid, workId) {
  await deleteDoc(
    doc(requiredDb(), "users", uid, "library", workId)
  );
}

export function subscribeLibrary(uid, callback) {
  const ref = query(
    userCollection(uid, "library"),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(ref, snapshot => {
    callback(
      snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }))
    );
  });
}

export async function attachWorkToProject(
  uid,
  projectId,
  work,
  {
    subprojectId = ""
  } = {}
) {
  const normalized = normalizeWork(work, {
    origin: work?.origin || "public-engine",
    privateOnly: Boolean(work?.privateOnly)
  });

  await setDoc(
    projectWorkRef(uid, projectId, normalized.id),
    {
      ...normalized,
      subprojectId: compactText(subprojectId, 200),
      addedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await updateDoc(projectRef(uid, projectId), {
    updatedAt: serverTimestamp()
  });

  return normalized;
}

export async function detachWorkFromProject(uid, projectId, workId) {
  await deleteDoc(projectWorkRef(uid, projectId, workId));
  await updateDoc(projectRef(uid, projectId), {
    updatedAt: serverTimestamp()
  });
}

export function subscribeProjectWorks(uid, projectId, callback) {
  const ref = query(
    collection(
      requiredDb(),
      "users",
      uid,
      "projects",
      projectId,
      "works"
    ),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(ref, snapshot => {
    callback(
      snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }))
    );
  });
}

export async function saveAuthor(uid, author) {
  const name = compactText(
    author?.displayName || author?.name,
    300
  );

  const id = stableDocumentId(
    "author",
    author?.orcid || author?.id || name
  );

  await setDoc(
    doc(requiredDb(), "users", uid, "savedAuthors", id),
    {
      id,
      name,
      sourceId: compactText(author?.id, 500),
      orcid: compactText(author?.orcid, 120),
      biography: compactText(author?.biography, 4000),
      wikipediaUrl: normalizeUrl(author?.wikipediaUrl),
      savedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return id;
}

export async function deleteSavedAuthor(uid, authorId) {
  await deleteDoc(
    doc(requiredDb(), "users", uid, "savedAuthors", authorId)
  );
}

export function subscribeSavedAuthors(uid, callback) {
  const ref = query(
    userCollection(uid, "savedAuthors"),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(ref, snapshot => {
    callback(
      snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }))
    );
  });
}

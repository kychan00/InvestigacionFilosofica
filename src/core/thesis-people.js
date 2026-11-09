const HONORIFIC_PATTERN = String.raw`(?:DR(?:A)?|DOCTOR(?:A)?|MTRO|MTRA|MAESTRO|MAESTRA|LIC(?:ENCIAD[OA])?|PROF(?:ESOR|ESORA)?|PH\\.?D)`;

const LEADING_HONORIFICS = new RegExp(
  `^(?:(?:${HONORIFIC_PATTERN})\\.?\\s+)+`,
  "iu",
);

const TITLED_CONJUNCTION = new RegExp(
  `\\s+(?:Y|E|AND|&)\\s+(?=(?:${HONORIFIC_PATTERN})\\.?\\s+)`,
  "giu",
);

const TITLED_SLASH = new RegExp(
  `\\s*\\/\\s*(?=(?:${HONORIFIC_PATTERN})\\.?\\s+)`,
  "giu",
);

export function cleanThesisPersonName(value) {
  return String(value || "")
    .replace(/^[\\s,;|]+|[\\s,;|]+$/g, "")
    .replace(LEADING_HONORIFICS, "")
    .replace(/\\s+/g, " ")
    .trim();
}

export function thesisPersonKey(value) {
  return cleanThesisPersonName(value)
    .normalize("NFKD")
    .replace(/\\p{M}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/[^\\p{L}\\p{N}]+/gu, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function rawPersonValues(value) {
  if (Array.isArray(value)) return value.flatMap(rawPersonValues);
  if (value && typeof value === "object") {
    return rawPersonValues(value.name || value.displayName || "");
  }
  return [String(value || "")];
}

export function splitThesisPeople(value) {
  const people = [];
  const seen = new Set();

  for (const raw of rawPersonValues(value)) {
    if (!raw.trim()) continue;

    const explicit = raw
      .replace(TITLED_SLASH, "\n")
      .split(/\\s*(?:;|\\r?\\n|\\u2022|\\|)\\s*/u)
      .filter(Boolean);

    for (const segment of explicit) {
      const parts = segment
        .split(TITLED_CONJUNCTION)
        .map(cleanThesisPersonName)
        .filter(Boolean);

      for (const name of parts) {
        const key = thesisPersonKey(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        people.push(name);
      }
    }
  }

  return people;
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\\p{M}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/[^\\p{L}\\p{N}]+/gu, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function workIdentity(record, context = {}) {
  if (record?.canonicalWorkId) return String(record.canonicalWorkId);

  const authors = splitThesisPeople(record?.authors);
  return [
    context.institution || record?.institution || "",
    normalizedText(record?.title),
    record?.year || "",
    thesisPersonKey(authors[0] || ""),
  ].join("|");
}

function publicWork(record, context = {}) {
  return {
    id: record?.id || null,
    canonicalWorkId: record?.canonicalWorkId || null,
    title: String(record?.title || "").trim(),
    authors: splitThesisPeople(record?.authors),
    directors: splitThesisPeople(record?.directors),
    year: Number.isFinite(Number(record?.year)) ? Number(record.year) : null,
    program: String(record?.program || "").trim(),
    degree: String(record?.degree || "").trim(),
    unit: String(record?.unit || "").trim(),
    sourceUrl: record?.sourceUrl || null,
    sourceLabel: record?.sourceLabel || null,
    institution: context.institution || record?.institution || "",
    institutionAcronym: context.institutionAcronym || record?.institutionAcronym || "",
    scope: context.scope || "",
    philosophyRole: record?.philosophyRole || null,
    philosophyStatus: record?.philosophyStatus || null,
  };
}

function personEntry(name) {
  return {
    key: thesisPersonKey(name),
    name: cleanThesisPersonName(name),
    aliases: new Set(),
    authored: new Map(),
    directed: new Map(),
  };
}

function addRelationship(index, name, role, record, context) {
  const clean = cleanThesisPersonName(name);
  const key = thesisPersonKey(clean);
  if (!key) return;

  if (!index.has(key)) index.set(key, personEntry(clean));
  const entry = index.get(key);
  entry.aliases.add(clean);

  const identity = workIdentity(record, context);
  const target = role === "authored" ? entry.authored : entry.directed;
  if (!target.has(identity)) target.set(identity, publicWork(record, context));
}

export function buildThesisPeopleIndex(sources = []) {
  const index = new Map();

  for (const source of sources || []) {
    for (const record of source?.records || []) {
      for (const author of splitThesisPeople(record?.authors)) {
        addRelationship(index, author, "authored", record, source);
      }
      for (const director of splitThesisPeople(record?.directors)) {
        addRelationship(index, director, "directed", record, source);
      }
    }
  }

  return index;
}

function sortedWorks(values) {
  return [...values].sort((a, b) =>
    (b.year || 0) - (a.year || 0) ||
    a.title.localeCompare(b.title, "es", { sensitivity: "base" })
  );
}

export function thesisPersonProfile(index, name) {
  const key = thesisPersonKey(name);
  const entry = index?.get?.(key);
  if (!entry) return null;

  const authored = sortedWorks(entry.authored.values());
  const directed = sortedWorks(entry.directed.values());
  const all = [...authored, ...directed];
  const years = all
    .map(work => work.year)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const institutions = [...new Set(all
    .map(work => work.institution || work.institutionAcronym)
    .filter(Boolean))];
  const programs = [...new Set(all.map(work => work.program).filter(Boolean))];

  return {
    key,
    name: entry.name,
    aliases: [...entry.aliases],
    authored,
    directed,
    years,
    yearFrom: years[0] || null,
    yearTo: years.at(-1) || null,
    institutions,
    programs,
    totalRelationships: authored.length + directed.length,
  };
}

export function thesisPersonArchiveBiography(profile) {
  if (!profile) return "";

  const roles = [];
  if (profile.authored.length) {
    roles.push(
      `${profile.authored.length} ${profile.authored.length === 1 ? "tesis como autoría" : "tesis como autoría"}`
    );
  }
  if (profile.directed.length) {
    roles.push(
      `${profile.directed.length} ${profile.directed.length === 1 ? "tesis en dirección académica" : "tesis en dirección académica"}`
    );
  }

  const span = profile.yearFrom && profile.yearTo
    ? profile.yearFrom === profile.yearTo
      ? ` en ${profile.yearFrom}`
      : ` entre ${profile.yearFrom} y ${profile.yearTo}`
    : "";
  const programs = profile.programs.length
    ? ` Los registros se relacionan con ${profile.programs.slice(0, 3).join(", ")}${profile.programs.length > 3 ? " y otros programas" : ""}.`
    : "";

  return `En este archivo, ${profile.name} figura en ${roles.join(" y ") || "registros de tesis"}${span}.${programs} Esta semblanza se limita a relaciones documentadas en los metadatos del archivo y no pretende sustituir una biografía personal verificada.`;
}

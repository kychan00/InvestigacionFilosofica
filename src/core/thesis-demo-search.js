/** Pure, local-only search for the immutable thesis demo bibliography. */
export const PAGE_SIZE = 12;
export const PHILOSOPHY_SCHEMA = "thesis-philosophy-public-index-v1";
export const PHILOSOPHY_REVISION = "2026-11-04.t2cu-v1";

export function normalized(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

function textFor(record) {
  return normalized([
    record.title,
    ...(record.authors || []),
    ...(record.directors || []),
    record.program,
    record.unit,
    record.abstractExcerpt,
    ...(record.keywords || []),
    record.philosophyEvidence,
    record.externalCorroboration?.note,
    record.sourceLabel,
  ].join(" "));
}

export function searchTheses(records, {
  query = "",
  program = "",
  degree = "",
  unit = "",
  fromYear = "",
  toYear = "",
  philosophyRole = "",
} = {}) {
  const terms = normalized(query).split(" ").filter(Boolean);
  const from = fromYear === "" ? null : Number(fromYear);
  const to = toYear === "" ? null : Number(toYear);

  return records.filter(record => {
    if (program && record.program !== program) return false;
    if (degree && record.degree !== degree) return false;
    if (unit && record.unit !== unit) return false;
    if (philosophyRole === "review" && record.philosophyStatus !== "review") return false;
    if (philosophyRole && philosophyRole !== "review" && record.philosophyRole !== philosophyRole) return false;
    if (from !== null && (!Number.isFinite(from) || record.year == null || record.year < from)) return false;
    if (to !== null && (!Number.isFinite(to) || record.year == null || record.year > to)) return false;
    const haystack = textFor(record);
    return terms.every(term => haystack.includes(term));
  });
}

export function pageSlice(records, page, perPage = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(records.length / perPage));
  const validPage = Math.max(1, Math.min(pages, Math.trunc(Number(page)) || 1));
  return {
    page: validPage,
    pages,
    records: records.slice((validPage - 1) * perPage, validPage * perPage),
  };
}

export function filterOptions(records, field) {
  return [...new Set(records.map(record => record[field]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "es"));
}

export function approvedInstitutionalUrl(input) {
  if (!input || typeof input !== "string") return null;
  try {
    const link = new URL(input);
    const host = link.hostname.toLowerCase();
    const hosts = new Set([
      "hdl.handle.net",
      "riudg.udg.mx",
      "www.riudg.udg.mx",
      "biblioteca.udgvirtual.udg.mx",
      "editorial.udg.mx",
      "biblioteca.cucsh.udg.mx",
      "www.biblioteca.cucsh.udg.mx",
      "cucsh.udg.mx",
      "www.cucsh.udg.mx",
    ]);
    if (
      link.protocol !== "https:" ||
      !hosts.has(host) ||
      link.username || link.password ||
      !["", "443"].includes(link.port) ||
      /\.pdf$|\/bitstreams?\/|\/download\/?$/i.test(link.pathname)
    ) return null;
    if (link.pathname && link.pathname !== "/") return link.href;
    if (host === "biblioteca.cucsh.udg.mx" || host === "www.biblioteca.cucsh.udg.mx") {
      const keys = [...link.searchParams.keys()];
      const values = link.searchParams.getAll("q");
      const q = values.length === 1 ? values[0] : "";
      const safeDetail = /^content\/[\p{L}\p{N}._~-]+$/u.test(q);
      if (
        keys.length === 1 &&
        keys[0] === "q" &&
        values.length === 1 &&
        (/^node\/\d+$/i.test(q) || safeDetail)
      ) {
        return link.href;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function approvedReferenceUrl(input) {
  const institutional = approvedInstitutionalUrl(input);
  if (institutional) return institutional;
  if (!input || typeof input !== "string") return null;
  try {
    const link = new URL(input);
    const host = link.hostname.toLowerCase();
    const hosts = new Set([
      "wdg.biblio.udg.mx",
      "mrei.cucea.udg.mx",
      "philpapers.org",
      "www.philpapers.org",
      "philarchive.org",
      "www.philarchive.org",
      "guadalajara.academia.edu",
    ]);
    if (
      link.protocol !== "https:" ||
      !hosts.has(host) ||
      link.username || link.password ||
      !["", "443"].includes(link.port) ||
      /\.pdf$|\/bitstreams?\/|\/download\/?$/i.test(link.pathname)
    ) return null;
    if (link.pathname && link.pathname !== "/") return link.href;
    if (host === "wdg.biblio.udg.mx") return link.href;
    if (host === "mrei.cucea.udg.mx") {
      const values = link.searchParams.getAll("q");
      if (values.length === 1 && values[0] === "tesis") return link.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function validateIndex(payload) {
  if (
    !payload ||
    payload.schemaVersion !== "thesis-demo-index-v1" ||
    payload.sourceRelease !== "thesis-effective-corpus-v2" ||
    payload.referenceOnly !== true ||
    payload.totalIncluded !== 566 ||
    !Array.isArray(payload.records) ||
    payload.records.length !== payload.totalIncluded
  ) {
    throw new Error("El índice bibliográfico no coincide con la release V2 verificada.");
  }
  const ids = new Set();
  for (const record of payload.records) {
    if (
      !record.id?.startsWith("thesis:work:") ||
      ids.has(record.id) ||
      typeof record.title !== "string"
    ) {
      throw new Error("Identidad bibliográfica duplicada o inválida.");
    }
    ids.add(record.id);
    if (record.sourceUrl && !approvedInstitutionalUrl(record.sourceUrl)) {
      throw new Error("El índice contiene un enlace de fuente no institucional.");
    }
  }
  return payload;
}


export function validatePhilosophyIndex(payload) {
  const expectedPrograms = [
    "program:udg:lic-filosofia",
    "program:udg:mae-estudios-filosoficos",
    "program:udg:mae-filosofia-historica",
  ];
  if (
    !payload ||
    payload.schemaVersion !== PHILOSOPHY_SCHEMA ||
    payload.revision !== PHILOSOPHY_REVISION ||
    payload.sourceRelease !== "thesis-effective-corpus-v2" ||
    payload.referenceOnly !== true ||
    payload.canonicalAdmissionMutation !== false ||
    payload.preserveActualProgram !== true ||
    payload.metrics?.records !== 233 ||
    payload.metrics?.byStatus?.include !== 231 ||
    payload.metrics?.byStatus?.review !== 2 ||
    payload.metrics?.actualProgramsRepresented !== 10 ||
    payload.cucshHistoricalInventory?.sourceRows !== 217 ||
    payload.cucshHistoricalInventory?.uniqueBibliographicIdentities !== 216 ||
    payload.cucshHistoricalInventory?.duplicateSourceRowsCollapsed !== 1 ||
    payload.cucshHistoricalInventory?.exactMergesWithT2CT !== 1 ||
    payload.cucshHistoricalInventory?.newPublicReferences !== 215 ||\n    payload.cucshHistoricalInventory?.unknownYearReferences !== 2 ||
    payload.cucshHistoricalInventory?.physicalHoldingsClaimed !== false ||
    !Array.isArray(payload.records) ||
    payload.records.length !== 233 ||
    !Array.isArray(payload.documentedPhilosophyPrograms) ||
    payload.documentedPhilosophyPrograms.length !== 3 ||
    payload.doctoralPolicy?.exactDoctorateProgramPresent !== false
  ) {
    throw new Error("La vista pública de Filosofía no coincide con el contrato T2CU verificado.");
  }
  if (payload.documentedPhilosophyPrograms.map(row => row.programRef).join("|") !== expectedPrograms.join("|")) {
    throw new Error("El conjunto de programas de Filosofía cambió sin revisión.");
  }
  const ids = new Set();
  const roles = new Set([
    "program-core",
    "program-core-candidate",
    "philosophical-content",
    "curated-manual-classification",
  ]);
  for (const record of payload.records) {
    if (
      typeof record.id !== "string" ||
      ids.has(record.id) ||
      typeof record.title !== "string" ||
      !record.title ||
      !Array.isArray(record.authors) ||
      !record.authors.length ||
      !["include", "review"].includes(record.philosophyStatus) ||
      !roles.has(record.philosophyRole) ||
      typeof record.program !== "string" ||
      !record.program
    ) {
      throw new Error("Registro filosófico público inválido o duplicado.");
    }
    ids.add(record.id);
    if (record.sourceUrl && !approvedReferenceUrl(record.sourceUrl)) {
      throw new Error("La vista de Filosofía contiene una fuente no aprobada.");
    }
    if (record.externalCorroboration) {
      const c = record.externalCorroboration;
      if (
        record.philosophyStatus !== "review" ||
        c.identityConfirmed !== false ||
        c.physicalLocationConfirmed !== false ||
        !Array.isArray(c.evidenceUrls) ||
        !c.evidenceUrls.every(approvedReferenceUrl)
      ) {
        throw new Error("La corroboración externa no respeta el contrato REVIEW de T2CT.");
      }
    }
  }
  return payload;
}

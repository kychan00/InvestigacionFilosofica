import { approvedInstitutionalUrl, normalized } from "./thesis-demo-search.js";

export const EDITORIAL_UDG_SCHEMA = "editorial-udg-philosophy-index-v1";
export const EDITORIAL_UDG_REVISION = "2026-11-07.v1";
export const EDITORIAL_UDG_TOTAL = 33;

export function approvedEditorialUdgUrl(input) {
  const safe = approvedInstitutionalUrl(input);
  if (!safe) return null;
  try {
    return new URL(safe).hostname.toLowerCase() === "editorial.udg.mx" ? safe : null;
  } catch {
    return null;
  }
}

function editorialText(record) {
  return normalized([
    record.title,
    ...(record.authors || []),
    ...(record.formats || []),
    record.criterion,
    record.sourceLabel,
    record.publisher,
  ].join(" "));
}

export function searchEditorialUdg(records, {
  query = "",
  origin = "",
  format = "",
} = {}) {
  const terms = normalized(query).split(" ").filter(Boolean);
  return records.filter(record => {
    if (origin && record.origin !== origin) return false;
    if (format && !(record.formats || []).some(item => item === format)) return false;
    const haystack = editorialText(record);
    return terms.every(term => haystack.includes(term));
  });
}

export function editorialFilterOptions(records, field) {
  if (field === "formats") {
    return [...new Set(records.flatMap(record => record.formats || []).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "es"));
  }
  return [...new Set(records.map(record => record[field]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "es"));
}

export function validateEditorialUdgIndex(payload) {
  if (
    !payload ||
    payload.schemaVersion !== EDITORIAL_UDG_SCHEMA ||
    payload.revision !== EDITORIAL_UDG_REVISION ||
    payload.referenceOnly !== true ||
    payload.pdfCopies !== 0 ||
    payload.publisher !== "Editorial Universidad de Guadalajara" ||
    payload.counts?.records !== EDITORIAL_UDG_TOTAL ||
    payload.counts?.officialPhilosophyCategory !== 24 ||
    payload.counts?.verifiedPhilosophicalRelation !== 9 ||
    !Array.isArray(payload.records) ||
    payload.records.length !== EDITORIAL_UDG_TOTAL
  ) {
    throw new Error("El corpus filosófico de Editorial UdeG no coincide con el contrato público V1.");
  }

  const ids = new Set();
  const urls = new Set();
  const allowedOrigins = new Set([
    "official-philosophy-category",
    "verified-philosophical-relation",
  ]);

  for (const record of payload.records) {
    if (
      typeof record.id !== "string" ||
      !record.id.startsWith("editorial-udg:") ||
      ids.has(record.id) ||
      typeof record.title !== "string" ||
      !record.title ||
      !Array.isArray(record.authors) ||
      !record.authors.length ||
      !Array.isArray(record.formats) ||
      !record.formats.length ||
      !allowedOrigins.has(record.origin) ||
      typeof record.criterion !== "string" ||
      !record.criterion ||
      !approvedEditorialUdgUrl(record.sourceUrl) ||
      urls.has(record.sourceUrl)
    ) {
      throw new Error("Registro editorial UdeG inválido, duplicado o fuera de procedencia.");
    }
    ids.add(record.id);
    urls.add(record.sourceUrl);
  }

  return payload;
}

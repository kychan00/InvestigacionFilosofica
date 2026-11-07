import { normalized } from "./thesis-demo-search.js";

export const UGTO_PHILOSOPHY_SCHEMA = "thesis-ugto-philosophy-index-v1";
export const UGTO_PHILOSOPHY_REVISION = "2026-11-07.v1";
export const UGTO_PHILOSOPHY_TOTAL = 59;

export function approvedUgtoRepositoryUrl(input) {
  if (!input || typeof input !== "string") return null;
  try {
    const link = new URL(input);
    const host = link.hostname.toLowerCase();
    if (
      link.protocol !== "https:" ||
      !new Set(["www.repositorio.ugto.mx", "repositorio.ugto.mx"]).has(host) ||
      link.username || link.password ||
      !["", "443"].includes(link.port) ||
      link.search || link.hash ||
      !/^\/handle\/20\.500\.12059\/\d+\/?$/.test(link.pathname)
    ) return null;
    return link.href;
  } catch {
    return null;
  }
}

export function validateUgtoPhilosophyIndex(payload) {
  if (
    !payload ||
    payload.schemaVersion !== UGTO_PHILOSOPHY_SCHEMA ||
    payload.revision !== UGTO_PHILOSOPHY_REVISION ||
    payload.institution !== "Universidad de Guanajuato" ||
    payload.institutionAcronym !== "UG" ||
    payload.referenceOnly !== true ||
    payload.pdfCopies !== 0 ||
    payload.counts?.records !== UGTO_PHILOSOPHY_TOTAL ||
    payload.counts?.licenciatura !== 14 ||
    payload.counts?.maestria !== 35 ||
    payload.counts?.doctorado !== 10 ||
    payload.counts?.separateResearchWorks !== 3 ||
    payload.separateResearchWorks?.records !== 3 ||
    payload.separateResearchWorks?.countedAsTheses !== false ||
    !approvedUgtoRepositoryUrl(payload.separateResearchWorks?.sourceUrl) ||
    !Array.isArray(payload.sourceCollections) ||
    payload.sourceCollections.length !== 3 ||
    !Array.isArray(payload.documentedPhilosophyPrograms) ||
    payload.documentedPhilosophyPrograms.length !== 3 ||
    !Array.isArray(payload.records) ||
    payload.records.length !== UGTO_PHILOSOPHY_TOTAL
  ) {
    throw new Error("El corpus público de Filosofía UG no coincide con el contrato T2DH.");
  }

  const expected = new Map([
    ["Licenciatura", 14],
    ["Maestría", 35],
    ["Doctorado", 10],
  ]);
  for (const collection of payload.sourceCollections) {
    if (!approvedUgtoRepositoryUrl(collection.sourceUrl)) {
      throw new Error("Colección UG fuera del repositorio institucional aprobado.");
    }
  }

  const ids = new Set();
  const handles = new Set();
  const byDegree = new Map([...expected.keys()].map(key => [key, 0]));
  for (const record of payload.records) {
    if (
      typeof record.id !== "string" ||
      !record.id.startsWith("thesis:ugto:") ||
      ids.has(record.id) ||
      typeof record.title !== "string" ||
      !record.title ||
      !Array.isArray(record.authors) ||
      record.authors.length !== 1 ||
      typeof record.authors[0] !== "string" ||
      !record.authors[0] ||
      !Number.isInteger(record.year) ||
      !expected.has(record.degree) ||
      typeof record.program !== "string" ||
      !record.program ||
      record.institution !== "Universidad de Guanajuato" ||
      record.institutionAcronym !== "UG" ||
      record.recordType !== "thesis" ||
      typeof record.handle !== "string" ||
      handles.has(record.handle) ||
      !approvedUgtoRepositoryUrl(record.sourceUrl) ||
      normalized(record.sourceUrl).includes(".pdf") ||
      /\/bitstreams?\/|\/download\/?$/i.test(record.sourceUrl)
    ) {
      throw new Error("Registro de tesis UG inválido, duplicado o fuera de procedencia.");
    }
    ids.add(record.id);
    handles.add(record.handle);
    byDegree.set(record.degree, byDegree.get(record.degree) + 1);
  }

  for (const [degree, total] of expected) {
    if (byDegree.get(degree) !== total) {
      throw new Error("La distribución por grado de UG cambió sin revisión.");
    }
  }
  return payload;
}

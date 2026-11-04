/** Pure, local-only search for the immutable thesis demo bibliography. */
export const PAGE_SIZE = 12;

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
  ].join(" "));
}

export function searchTheses(records, {
  query = "",
  program = "",
  degree = "",
  unit = "",
  fromYear = "",
  toYear = "",
} = {}) {
  const terms = normalized(query).split(" ").filter(Boolean);
  const from = fromYear === "" ? null : Number(fromYear);
  const to = toYear === "" ? null : Number(toYear);

  return records.filter(record => {
    if (program && record.program !== program) return false;
    if (degree && record.degree !== degree) return false;
    if (unit && record.unit !== unit) return false;
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
    const hosts = new Set([
      "hdl.handle.net",
      "riudg.udg.mx",
      "www.riudg.udg.mx",
      "biblioteca.udgvirtual.udg.mx",
    ]);
    if (
      link.protocol !== "https:" ||
      !hosts.has(link.hostname.toLowerCase()) ||
      link.username || link.password ||
      !link.pathname || link.pathname === "/" ||
      /\.pdf$|\/bitstreams?\/|\/download\/?$/i.test(link.pathname)
    ) return null;
    return link.href;
  } catch {
    return null;
  }
}

export function validateIndex(payload) {
  if (
    !payload ||
    payload.schemaVersion !== "thesis-demo-index-v1" ||
    payload.sourceRelease !== "thesis-effective-corpus-v1" ||
    payload.referenceOnly !== true ||
    payload.totalIncluded !== 561 ||
    !Array.isArray(payload.records) ||
    payload.records.length !== payload.totalIncluded
  ) {
    throw new Error("El índice bibliográfico no coincide con la release V1 verificada.");
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

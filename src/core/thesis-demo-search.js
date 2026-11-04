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
      if (keys.length === 1 && keys[0] === "q" && values.length === 1 && /^node\/\d+$/i.test(values[0])) {
        return link.href;
      }
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

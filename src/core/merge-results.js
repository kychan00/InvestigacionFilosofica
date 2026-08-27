import { normalizeText } from "./parser.js";


function normalizeDoi(doi) {
  if (!doi) {
    return null;
  }

  return String(doi)
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .trim()
    .toLowerCase() || null;
}


function resultKey(result) {
  const doi =
    normalizeDoi(
      result.doi
    );

  if (doi) {
    return `doi:${doi}`;
  }

  /*
   * Los IDs propios de cada proveedor NO deben
   * mezclarse entre proveedores.
   */
  if (
    result.id &&
    result.providers?.length === 1
  ) {
    return [
      "provider-id",
      result.providers[0],
      result.id
    ].join(":");
  }

  const title =
    normalizeText(
      result.title || ""
    );

  const year =
    result.year ?? "";

  const firstAuthor =
    result.authors?.[0]?.name
      ? normalizeText(
          result.authors[0].name
        )
      : "";

  return [
    "fallback",
    title,
    year,
    firstAuthor
  ].join(":");
}


function uniqueStrings(values = []) {
  const seen =
    new Set();

  const result = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const key =
      normalizeText(
        String(value)
      );

    if (
      !key ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}


function mergeProviders(
  existing = [],
  incoming = []
) {
  return uniqueStrings([
    ...existing,
    ...incoming
  ]);
}


function mergeMatchedQueries(
  existing = [],
  incoming = []
) {
  const map =
    new Map();

  for (const item of [
    ...existing,
    ...incoming
  ]) {
    const key =
      normalizeText(
        item.query || ""
      );

    if (!key) {
      continue;
    }

    const previous =
      map.get(key);

    if (
      !previous ||
      (item.weight ?? 0) >
      (previous.weight ?? 0)
    ) {
      map.set(
        key,
        structuredClone(item)
      );
    }
  }

  return [...map.values()]
    .sort(
      (a, b) =>
        (b.weight ?? 0) -
        (a.weight ?? 0)
    );
}


function mergeSourceRecords(
  existing = [],
  incoming = []
) {
  const seen =
    new Set();

  const output = [];

  for (const item of [
    ...existing,
    ...incoming
  ]) {
    const key = [
      item.provider || "",
      item.sourceId || "",
      normalizeText(
        item.query || ""
      )
    ].join("|");

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    output.push(
      structuredClone(item)
    );
  }

  return output;
}


function mergeAuthors(
  existing = [],
  incoming = []
) {
  const output = [];
  const seen = new Set();

  for (const author of [
    ...existing,
    ...incoming
  ]) {
    if (!author?.name) {
      continue;
    }

    const key =
      normalizeText(
        author.name
      );

    if (
      !key ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    output.push({
      ...author
    });
  }

  return output;
}


function mergeTopics(
  existing = [],
  incoming = []
) {
  const map =
    new Map();

  for (const topic of [
    ...existing,
    ...incoming
  ]) {
    if (!topic?.name) {
      continue;
    }

    const key =
      normalizeText(
        topic.name
      );

    if (!key) {
      continue;
    }

    const previous =
      map.get(key);

    if (!previous) {
      map.set(
        key,
        structuredClone(topic)
      );

      continue;
    }

    /*
     * Si una fuente tiene score de topic
     * y la otra no, conservamos el más rico.
     */
    if (
      previous.score == null &&
      topic.score != null
    ) {
      previous.score =
        topic.score;
    }

    if (
      !previous.id &&
      topic.id
    ) {
      previous.id =
        topic.id;
    }
  }

  return [...map.values()];
}


function mergeIsbn(
  existing = [],
  incoming = []
) {
  const map =
    new Map();

  for (const isbn of [
    ...existing,
    ...incoming
  ]) {
    if (!isbn) {
      continue;
    }

    const canonical =
      String(isbn)
        .replace(/[-\s]/g, "")
        .toUpperCase();

    if (!canonical) {
      continue;
    }

    if (
      !map.has(canonical)
    ) {
      map.set(
        canonical,
        canonical
      );
    }
  }

  return [...map.values()];
}


function chooseText(
  existing,
  incoming
) {
  if (!existing) {
    return incoming || null;
  }

  if (!incoming) {
    return existing;
  }

  /*
   * Para campos textuales descriptivos como
   * abstract preferimos la versión más completa.
   */
  return String(incoming).length >
    String(existing).length
    ? incoming
    : existing;
}


function mergeOpenAccess(
  existing,
  incoming
) {
  if (!existing) {
    return incoming
      ? structuredClone(incoming)
      : null;
  }

  if (!incoming) {
    return existing;
  }

  return {
    isOpen:
      Boolean(
        existing.isOpen ||
        incoming.isOpen
      ),

    status:
      existing.status ||
      incoming.status ||
      null,

    url:
      existing.url ||
      incoming.url ||
      null
  };
}


function mergeUrls(
  existing = {},
  incoming = {}
) {
  return {
    canonical:
      existing.canonical ||
      incoming.canonical ||
      null,

    doi:
      existing.doi ||
      incoming.doi ||
      null,

    openAccess:
      existing.openAccess ||
      incoming.openAccess ||
      null
  };
}


function mergeOne(
  existing,
  incoming
) {
  existing.providers =
    mergeProviders(
      existing.providers,
      incoming.providers
    );

  existing.matchedQueries =
    mergeMatchedQueries(
      existing.matchedQueries,
      incoming.matchedQueries
    );

  existing.sourceRecords =
    mergeSourceRecords(
      existing.sourceRecords,
      incoming.sourceRecords
    );


  /*
   * Identificadores bibliográficos
   */
  existing.doi =
    existing.doi ||
    incoming.doi ||
    null;

  existing.isbn =
    mergeIsbn(
      existing.isbn,
      incoming.isbn
    );


  /*
   * Responsabilidad intelectual
   */
  existing.authors =
    mergeAuthors(
      existing.authors,
      incoming.authors
    );


  /*
   * Datos bibliográficos básicos.
   *
   * Conservamos el existente cuando ambas
   * fuentes tienen información porque normalmente
   * representa el registro que apareció primero.
   */
  existing.year =
    existing.year ??
    incoming.year ??
    null;

  existing.type =
    existing.type ||
    incoming.type ||
    null;

  existing.language =
    existing.language ||
    incoming.language ||
    null;

  existing.journal =
    existing.journal ||
    incoming.journal ||
    null;

  existing.publisher =
    existing.publisher ||
    incoming.publisher ||
    null;


  /*
   * Información descriptiva
   */
  existing.abstract =
    chooseText(
      existing.abstract,
      incoming.abstract
    );

  existing.topics =
    mergeTopics(
      existing.topics,
      incoming.topics
    );


  /*
   * Métricas.
   *
   * citedBy actualmente sólo es comparable
   * cuando viene de OpenAlex. No sumamos cifras.
   */
  if (
    existing.citedBy == null &&
    incoming.citedBy != null
  ) {
    existing.citedBy =
      incoming.citedBy;
  }


  /*
   * Acceso y enlaces
   */
  existing.openAccess =
    mergeOpenAccess(
      existing.openAccess,
      incoming.openAccess
    );

  existing.urls =
    mergeUrls(
      existing.urls,
      incoming.urls
    );


  /*
   * Clasificación posterior.
   */
  existing.philosophers =
    uniqueStrings([
      ...(existing.philosophers || []),
      ...(incoming.philosophers || [])
    ]);

  existing.traditions =
    uniqueStrings([
      ...(existing.traditions || []),
      ...(incoming.traditions || [])
    ]);

  existing.institutionalLinks =
    [
      ...(
        existing.institutionalLinks ||
        []
      ),
      ...(
        incoming.institutionalLinks ||
        []
      )
    ];


  return existing;
}


export function mergeResults(
  results = []
) {
  const map =
    new Map();

  for (const result of results) {
    const key =
      resultKey(result);

    if (
      !map.has(key)
    ) {
      map.set(
        key,
        structuredClone(result)
      );

      continue;
    }

    mergeOne(
      map.get(key),
      result
    );
  }

  return [...map.values()];
}

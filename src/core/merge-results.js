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


const WORK_TITLE_STOPWORDS =
  new Set([
    "a",
    "an",
    "and",
    "the",
    "of",
    "in",
    "on",
    "for",
    "to",
    "with",
    "from",
    "de",
    "del",
    "la",
    "las",
    "el",
    "los",
    "en",
    "y",
    "por",
    "para",
    "un",
    "una"
  ]);


function normalizedTitle(
  value
) {
  return normalizeText(
    value || ""
  );
}


function comparableTitle(
  value
) {
  return normalizedTitle(
    value
  )
    .replace(
      /\b(tomo|volumen|volume|vol|parte|part|book|libro|band)\s+(?=([0-9]+|[ivxlcdm]+)\b)/gi,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function authorTokens(
  author
) {
  return new Set(
    normalizeText(
      author?.name || ""
    )
      .split(" ")
      .filter(
        token =>
          token.length > 1
      )
  );
}


function titleTokens(
  title,
  authors = []
) {
  const authorTokenSet =
    new Set();

  for (
    const author of authors
  ) {
    for (
      const token of
      authorTokens(author)
    ) {
      authorTokenSet.add(
        token
      );
    }
  }

  return normalizeText(
    title || ""
  )
    .split(" ")
    .filter(
      token =>
        token.length > 1 &&
        !WORK_TITLE_STOPWORDS.has(
          token
        ) &&
        !authorTokenSet.has(
          token
        )
    );
}


function setSimilarity(
  left,
  right
) {
  const a =
    new Set(left);

  const b =
    new Set(right);

  if (
    !a.size ||
    !b.size
  ) {
    return {
      jaccard: 0,
      containment: 0,
      intersection: 0
    };
  }

  let intersection = 0;

  for (
    const token of a
  ) {
    if (
      b.has(token)
    ) {
      intersection += 1;
    }
  }

  const union =
    a.size +
    b.size -
    intersection;

  return {
    intersection,

    jaccard:
      union
        ? intersection /
          union
        : 0,

    containment:
      intersection /
      Math.min(
        a.size,
        b.size
      )
  };
}


function authorSimilarity(
  left = [],
  right = []
) {
  if (
    !left.length ||
    !right.length
  ) {
    return null;
  }

  let best = 0;

  for (
    const a of left
  ) {
    const aTokens =
      [...authorTokens(a)];

    if (!aTokens.length) {
      continue;
    }

    for (
      const b of right
    ) {
      const bTokens =
        [...authorTokens(b)];

      const similarity =
        setSimilarity(
          aTokens,
          bTokens
        );

      best =
        Math.max(
          best,
          similarity.containment,
          similarity.jaccard
        );
    }
  }

  return best;
}


function volumeMarkers(
  title
) {
  const text =
    normalizedTitle(
      title
    );

  if (!text) {
    return [];
  }

  const markers = [];

  const explicit =
    /\b(tomo|volumen|volume|vol|parte|part|book|libro|band)\s+([0-9]+|[ivxlcdm]+)\b/gi;

  for (
    const match of
    text.matchAll(explicit)
  ) {
    markers.push(
      String(
        match[2]
      )
        .toLowerCase()
    );
  }

  const parenthetical =
    String(
      title || ""
    )
      .matchAll(
        /\(([ivxlcdm]+)\)/gi
      );

  for (
    const match of
    parenthetical
  ) {
    markers.push(
      String(
        match[1]
      )
        .toLowerCase()
    );
  }

  return [
    ...new Set(markers)
  ];
}


function volumesCompatible(
  leftTitle,
  rightTitle
) {
  const left =
    volumeMarkers(
      leftTitle
    );

  const right =
    volumeMarkers(
      rightTitle
    );

  if (
    !left.length ||
    !right.length
  ) {
    return true;
  }

  return left.some(
    marker =>
      right.includes(
        marker
      )
  );
}


function titleSimilarity(
  leftTitle,
  rightTitle,
  authors = []
) {
  const left =
    comparableTitle(
      leftTitle
    );

  const right =
    comparableTitle(
      rightTitle
    );

  if (
    !left ||
    !right
  ) {
    return 0;
  }

  if (
    left === right
  ) {
    return 1;
  }

  if (
    !volumesCompatible(
      leftTitle,
      rightTitle
    )
  ) {
    return 0;
  }

  const leftTokens =
    titleTokens(
      leftTitle,
      authors
    );

  const rightTokens =
    titleTokens(
      rightTitle,
      authors
    );

  if (
    Math.min(
      leftTokens.length,
      rightTokens.length
    ) < 3
  ) {
    return 0;
  }

  const similarity =
    setSimilarity(
      leftTokens,
      rightTokens
    );

  if (
    similarity.containment === 1 &&
    similarity.intersection >= 4
  ) {
    return 0.97;
  }

  return (
    similarity.jaccard *
      0.7 +
    similarity.containment *
      0.3
  );
}


function titleVariantsOf(
  result
) {
  return uniqueStrings([
    result.title,
    ...(result.titleVariants || []),
    ...(
      result.workAppearances ||
      []
    ).map(
      appearance =>
        appearance.title
    )
  ]);
}


function yearsOf(
  result
) {
  return [
    ...new Set(
      [
        result.year,
        ...(result.years || []),
        ...(
          result.workAppearances ||
          []
        ).map(
          appearance =>
            appearance.year
        )
      ]
        .map(Number)
        .filter(
          year =>
            Number.isInteger(year) &&
            year > 0
        )
    )
  ].sort(
    (a, b) =>
      a - b
  );
}


function sourceLinkCandidates(
  result
) {
  const links = [];

  const add = (
    url,
    kind,
    provider = null
  ) => {
    if (!url) {
      return;
    }

    links.push({
      url:
        String(url),
      kind,
      provider:
        provider ||
        result.providers?.[0] ||
        null,
      title:
        result.title ||
        null,
      year:
        result.year ??
        null
    });
  };

  add(
    result.urls?.openAccess,
    "open-access"
  );

  add(
    result.urls?.canonical,
    "canonical"
  );

  add(
    result.urls?.landing,
    "landing"
  );

  add(
    result.url,
    "landing"
  );

  if (result.doi) {
    add(
      `https://doi.org/${normalizeDoi(
        result.doi
      )}`,
      "doi"
    );
  } else {
    add(
      result.urls?.doi,
      "doi"
    );
  }

  for (
    const source of
    result.sourceRecords || []
  ) {
    for (
      const relation of
      source.relations || []
    ) {
      if (
        /^https?:\/\//i.test(
          String(relation)
        )
      ) {
        add(
          relation,
          "relation",
          source.provider
        );
      }
    }
  }

  return links;
}


function mergeSourceLinks(
  existing = [],
  incoming = []
) {
  const map =
    new Map();

  for (
    const link of
    [
      ...existing,
      ...incoming
    ]
  ) {
    if (!link?.url) {
      continue;
    }

    const key =
      String(
        link.url
      )
        .trim()
        .toLowerCase();

    if (!key) {
      continue;
    }

    if (
      !map.has(key)
    ) {
      map.set(
        key,
        structuredClone(link)
      );
    }
  }

  return [
    ...map.values()
  ];
}


function appearanceCandidates(
  result
) {
  const records =
    result.sourceRecords?.length
      ? result.sourceRecords
      : (
          result.providers || []
        ).map(
          provider => ({
            provider,
            sourceId: null
          })
        );

  const preferredUrl =
    result.urls?.openAccess ||
    result.urls?.canonical ||
    result.urls?.doi ||
    result.url ||
    null;

  return records.map(
    source => ({
      provider:
        source.provider ||
        result.providers?.[0] ||
        null,

      sourceId:
        source.sourceId ||
        null,

      title:
        result.title ||
        null,

      year:
        result.year ??
        null,

      url:
        preferredUrl,

      doi:
        normalizeDoi(
          result.doi
        )
    })
  );
}


function mergeWorkAppearances(
  existing = [],
  incoming = []
) {
  const map =
    new Map();

  for (
    const appearance of
    [
      ...existing,
      ...incoming
    ]
  ) {
    const key = [
      appearance.provider || "",
      appearance.sourceId || "",
      appearance.url || "",
      normalizedTitle(
        appearance.title
      ),
      appearance.year ?? ""
    ].join("|");

    if (
      !map.has(key)
    ) {
      map.set(
        key,
        structuredClone(
          appearance
        )
      );
    }
  }

  return [
    ...map.values()
  ];
}


function initializeAggregate(
  result
) {
  const copy =
    structuredClone(
      result
    );

  copy.titleVariants =
    titleVariantsOf(
      copy
    );

  copy.years =
    yearsOf(
      copy
    );

  copy.sourceLinks =
    mergeSourceLinks(
      copy.sourceLinks || [],
      sourceLinkCandidates(
        copy
      )
    );

  const preservedAppearances =
    copy.workAppearances || [];

  copy.workAppearances =
    mergeWorkAppearances(
      preservedAppearances,
      preservedAppearances.length
        ? []
        : appearanceCandidates(
            copy
          )
    );

  copy.workAppearanceCount =
    copy.workAppearances.length;

  return copy;
}


function conflictingStrongIds(
  left,
  right
) {
  const leftDoi =
    normalizeDoi(
      left.doi
    );

  const rightDoi =
    normalizeDoi(
      right.doi
    );

  if (
    leftDoi &&
    rightDoi &&
    leftDoi !== rightDoi
  ) {
    return true;
  }

  return false;
}


function sameWork(
  left,
  right
) {
  if (
    conflictingStrongIds(
      left,
      right
    )
  ) {
    return false;
  }

  const leftTitles =
    titleVariantsOf(
      left
    );

  const rightTitles =
    titleVariantsOf(
      right
    );

  if (
    !leftTitles.length ||
    !rightTitles.length
  ) {
    return false;
  }

  const authors = [
    ...(left.authors || []),
    ...(right.authors || [])
  ];

  const authorScore =
    authorSimilarity(
      left.authors,
      right.authors
    );

  let bestTitleScore = 0;
  let exactTitle = false;
  let distinctiveTokenCount = 0;

  for (
    const leftTitle of
    leftTitles
  ) {
    for (
      const rightTitle of
      rightTitles
    ) {
      if (
        !volumesCompatible(
          leftTitle,
          rightTitle
        )
      ) {
        continue;
      }

      const leftNormalized =
        comparableTitle(
          leftTitle
        );

      const rightNormalized =
        comparableTitle(
          rightTitle
        );

      if (
        leftNormalized &&
        leftNormalized ===
          rightNormalized
      ) {
        exactTitle = true;
      }

      const score =
        titleSimilarity(
          leftTitle,
          rightTitle,
          authors
        );

      if (
        score >
        bestTitleScore
      ) {
        bestTitleScore =
          score;

        distinctiveTokenCount =
          Math.min(
            titleTokens(
              leftTitle,
              authors
            ).length,
            titleTokens(
              rightTitle,
              authors
            ).length
          );
      }
    }
  }

  if (
    authorScore !== null &&
    authorScore < 0.67
  ) {
    return false;
  }

  if (
    exactTitle &&
    authorScore !== null
  ) {
    return true;
  }

  if (
    exactTitle &&
    authorScore === null
  ) {
    const leftYears =
      yearsOf(left);

    const rightYears =
      yearsOf(right);

    const sharedYear =
      leftYears.some(
        year =>
          rightYears.includes(
            year
          )
      );

    return (
      sharedYear &&
      distinctiveTokenCount >= 4
    );
  }

  if (
    authorScore !== null &&
    authorScore >= 0.67 &&
    bestTitleScore >= 0.88 &&
    distinctiveTokenCount >= 4
  ) {
    return true;
  }

  return false;
}


export function resultIdentityKey(result) {
  const doi =
    normalizeDoi(
      result.doi
    );

  if (doi) {
    return `doi:${doi}`;
  }

  /*
   * OpenAlex Philosophy y la API oficial
   * representan el mismo namespace OpenAlex.
   */
  const openAlexCandidate = [
    result.openalexId,
    result.openalex_id,
    result.id,
    result.urls?.canonical
  ]
    .map(value => String(value || ""))
    .find(value =>
      /(?:^|openalex[-:/]|\/)(W\d+)/i
        .test(value)
    );

  if (openAlexCandidate) {
    const workId = openAlexCandidate
      .match(
        /(?:^|openalex[-:/]|\/)(W\d+)/i
      )?.[1];

    if (workId) {
      return `openalex:${workId.toLowerCase()}`;
    }
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
   * Identidad de obra y procedencia.
   *
   * Una tarjeta representa una obra; las
   * apariciones de catálogos, ediciones y
   * enlaces permanecen preservadas dentro
   * del agregado.
   */
  existing.titleVariants =
    uniqueStrings([
      ...(existing.titleVariants || []),
      ...titleVariantsOf(
        incoming
      )
    ]);

  existing.years =
    [
      ...new Set([
        ...yearsOf(
          existing
        ),
        ...yearsOf(
          incoming
        )
      ])
    ].sort(
      (a, b) =>
        a - b
    );

  existing.sourceLinks =
    mergeSourceLinks(
      existing.sourceLinks || [],
      [
        ...(incoming.sourceLinks || []),
        ...sourceLinkCandidates(
          incoming
        )
      ]
    );

  existing.workAppearances =
    mergeWorkAppearances(
      existing.workAppearances || [],
      incoming.workAppearances?.length
        ? incoming.workAppearances
        : appearanceCandidates(
            incoming
          )
    );

  existing.workAppearanceCount =
    existing.workAppearances.length;


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
  const strictMap =
    new Map();

  const merged = [];

  for (
    const rawResult of
    results
  ) {
    const incoming =
      initializeAggregate(
        rawResult
      );

    const strictKey =
      resultIdentityKey(
        incoming
      );

    let target =
      strictMap.get(
        strictKey
      ) ||
      null;

    if (!target) {
      target =
        merged.find(
          candidate =>
            sameWork(
              candidate,
              incoming
            )
        ) ||
        null;
    }

    if (!target) {
      merged.push(
        incoming
      );

      strictMap.set(
        strictKey,
        incoming
      );

      continue;
    }

    mergeOne(
      target,
      incoming
    );

    strictMap.set(
      strictKey,
      target
    );
  }

  return merged.map(
    item => {
      item.titleVariants =
        titleVariantsOf(
          item
        );

      item.years =
        yearsOf(
          item
        );

      item.sourceLinks =
        mergeSourceLinks(
          item.sourceLinks || [],
          sourceLinkCandidates(
            item
          )
        );

      item.workAppearances =
        mergeWorkAppearances(
          item.workAppearances || [],
          []
        );

      item.workAppearanceCount =
        item.workAppearances.length;

      return item;
    }
  );
}

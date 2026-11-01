const INDEX_BASE = new URL(
  "../../data/authors/author-index-v2/",
  import.meta.url
);

const WIKIDATA_API =
  "https://www.wikidata.org/w/api.php";

const HUMAN_ENTITY = "Q5";
const BUCKET_COUNT = 1024;
const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_WORK_LIMIT = 50;
const AUTHOR_SHARD_CONCURRENCY = 4;
const AUTHOR_SHARD_ATTEMPTS = 3;
const WIKIDATA_HEADERS = {
  "Api-User-Agent":
    "InvestigacionFilosofica/1.0 " +
    "(https://github.com/kychan00/InvestigacionFilosofica)"
};


function decodeTitleEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };

  return String(value || "")
    .replace(
      /&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
      (match, entity) => {
        if (entity.startsWith("#")) {
          const hexadecimal =
            entity[1]?.toLowerCase() ===
            "x";
          const codePoint = Number.parseInt(
            entity.slice(
              hexadecimal ? 2 : 1
            ),
            hexadecimal ? 16 : 10
          );

          return Number.isFinite(codePoint)
            ? String.fromCodePoint(codePoint)
            : match;
        }

        return named[
          entity.toLowerCase()
        ] || match;
      }
    );
}


export function cleanAuthorWorkTitle(value) {
  let text = String(value || "");

  for (let pass = 0; pass < 2; pass++) {
    text = decodeTitleEntities(text);
  }

  return text
    .replace(
      /<sup\b[^>]*>[\s\S]*?<\/sup>/gi,
      ""
    )
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


export function normalizeAuthorName(
  value
) {
  const words = String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/ß/g, "ss")
    .replace(/ς/g, "σ")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const honorifics = new Set([
    "dr", "dra", "doctor", "doctora", "prof", "profesor",
    "profesora", "lic", "licenciado", "licenciada",
    "mtro", "mtra", "maestro", "maestra", "phd"
  ]);
  while (words.length > 1 && honorifics.has(words[0])) {
    words.shift();
  }
  return words.join(" ");
}

export function cleanAuthorDisplayName(value) {
  return String(value || "").trim()
    .replace(/^(?:(?:Dra?\.?|Doctora?\.?|Prof(?:esor|esora)?\.?|Lic(?:enciado|enciada)?\.?|Mtr[oa]\.?)\s+)+/iu,"")
    .trim();
}


export function authorNameSignature(
  value
) {
  return [
    ...new Set(
      normalizeAuthorName(value)
        .split(" ")
        .filter(Boolean)
    )
  ]
    .sort()
    .join(" ");
}


export function authorBucket(
  value,
  bucketCount = BUCKET_COUNT
) {
  let result = 0x811c9dc5;
  const bytes = new TextEncoder()
    .encode(String(value));

  for (const byte of bytes) {
    result ^= byte;
    result = Math.imul(
      result,
      0x01000193
    ) >>> 0;
  }

  return result % bucketCount;
}


export function looksLikeAuthorQuery(
  value
) {
  const query = String(value || "").trim();

  if (
    query.length < 2 ||
    query.length > 100 ||
    /[?!:;=]/.test(query) ||
    !/^[\p{L}\p{M}\s,.'’-]+$/u.test(query)
  ) {
    return false;
  }

  const tokens = normalizeAuthorName(query)
    .split(" ")
    .filter(Boolean);

  return (
    tokens.length >= 1 &&
    tokens.length <= 6
  );
}


function parseJsonLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}


function abortError() {
  return new DOMException(
    "Author resolution aborted",
    "AbortError"
  );
}


async function fetchWithTimeout(
  url,
  {
    fetchImpl,
    signal,
    timeoutMs,
    responseType = "text",
    headers = {}
  }
) {
  if (signal?.aborted) {
    throw abortError();
  }

  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  signal?.addEventListener(
    "abort",
    relayAbort,
    { once: true }
  );

  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetchImpl(
      url,
      {
        signal: controller.signal,
        headers: {
          Accept:
            responseType === "json"
              ? "application/json"
              : "application/x-ndjson,text/plain",
          ...headers
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return responseType === "json"
          ? null
          : "";
      }

      throw new Error(
        `Author resolver HTTP ${response.status}`
      );
    }

    return responseType === "json"
      ? response.json()
      : response.text();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener(
      "abort",
      relayAbort
    );
  }
}


function createContext(options) {
  return {
    fetchImpl:
      options.fetchImpl || globalThis.fetch,
    signal: options.signal,
    timeoutMs:
      options.timeoutMs ||
      DEFAULT_TIMEOUT_MS,
    indexBase:
      options.indexBase || INDEX_BASE,
    wikidataApi:
      options.wikidataApi ||
      WIKIDATA_API,
    textCache: new Map(),
    aliasCache: new Map()
  };
}


function indexUrl(
  context,
  kind,
  bucket
) {
  return new URL(
    `${kind}/${String(bucket).padStart(4, "0")}.jsonl`,
    context.indexBase
  );
}


async function cachedText(
  context,
  url
) {
  const key = String(url);

  if (!context.textCache.has(key)) {
    context.textCache.set(
      key,
      fetchWithTimeout(
        url,
        context
      ).catch(error => {
        context.textCache.delete(key);
        throw error;
      })
    );
  }

  return context.textCache.get(key);
}


async function aliasCandidates(
  context,
  signature
) {
  if (!signature) {
    return [];
  }

  if (!context.aliasCache.has(signature)) {
    context.aliasCache.set(
      signature,
      cachedText(
        context,
        indexUrl(
          context,
          "aliases",
          authorBucket(signature)
        )
      ).then(text =>
        parseJsonLines(text)
          .filter(row => row.s === signature)
      )
    );
  }

  return context.aliasCache.get(signature);
}


function dedupeCandidates(rows) {
  const output = new Map();

  for (const row of rows) {
    const current = output.get(row.id);

    if (
      !current ||
      row.k === "full"
    ) {
      output.set(row.id, row);
    }
  }

  return [...output.values()]
    .sort(
      (a, b) =>
        (b.cw || 0) - (a.cw || 0) ||
        (b.c || 0) - (a.c || 0) ||
        String(a.n).localeCompare(
          String(b.n),
          "es"
        )
    );
}


export async function findSnapshotAuthorCandidates(query, options = {}) {
  const context = createContext(options);
  const signature = authorNameSignature(query);
  if (!signature) return [];
  const exact = await aliasCandidates(context, signature);
  return dedupeCandidates(exact)
    .filter(row => row.k === "full" || row.k === "given-first-family" ||
      row.k === "suffix" || row.k === "initial")
    .slice(0, 30);
}


function dominantCandidate(rows) {
  if (rows.length === 1) {
    return rows[0];
  }

  if (rows.length < 2) {
    return null;
  }

  const [first, second] = rows;
  const firstWorks = first.cw || 0;
  const secondWorks = second.cw || 0;

  if (
    firstWorks >= 10 &&
    firstWorks >= secondWorks * 5
  ) {
    return first;
  }

  return null;
}


function wikidataUrl(
  context,
  parameters
) {
  const url = new URL(
    context.wikidataApi
  );

  url.search = new URLSearchParams({
    format: "json",
    origin: "*",
    ...parameters
  });

  return url;
}


async function wikidataHumans(
  context,
  query
) {
  const searchPayload =
    await fetchWithTimeout(
      wikidataUrl(
        context,
        {
          action: "wbsearchentities",
          search: query,
          language: "es",
          uselang: "es",
          type: "item",
          limit: "5"
        }
      ),
      {
        ...context,
        responseType: "json",
        headers: WIKIDATA_HEADERS
      }
    );

  const search =
    searchPayload?.search || [];

  if (!search.length) {
    return [];
  }

  const details =
    await fetchWithTimeout(
      wikidataUrl(
        context,
        {
          action: "wbgetentities",
          ids: search
            .map(item => item.id)
            .join("|"),
          props:
            "labels|aliases|descriptions|sitelinks|claims",
          languages: "es|en",
          languagefallback: "1"
        }
      ),
      {
        ...context,
        responseType: "json",
        headers: WIKIDATA_HEADERS
      }
    );

  const entities =
    details?.entities || {};

  return search
    .map((item, rank) => {
      const entity = entities[item.id];
      const instanceOf =
        entity?.claims?.P31 || [];

      const isHuman = instanceOf.some(
        claim =>
          claim?.mainsnak?.datavalue
            ?.value?.id === HUMAN_ENTITY
      );

      if (!isHuman) {
        return null;
      }

      const labels = Object.values(
        entity.labels || {}
      ).map(label => label.value);

      const aliases = Object.values(
        entity.aliases || {}
      ).flatMap(items =>
        items.map(alias => alias.value)
      );

      const names = [
        item.label,
        ...(item.aliases || []),
        ...labels,
        ...aliases
      ].filter(Boolean);

      return {
        id: item.id,
        rank,
        name:
          entity.labels?.es?.value ||
          entity.labels?.en?.value ||
          item.label,
        names: [...new Set(names)],
        description:
          entity.descriptions?.es?.value ||
          entity.descriptions?.en?.value ||
          item.description ||
          null,
        wikipediaUrl:
          entity.sitelinks?.eswiki?.title
            ? `https://es.wikipedia.org/wiki/${encodeURIComponent(
                entity.sitelinks.eswiki.title.replaceAll(" ", "_")
              )}`
            : entity.sitelinks?.enwiki?.title
              ? `https://en.wikipedia.org/wiki/${encodeURIComponent(
                  entity.sitelinks.enwiki.title.replaceAll(" ", "_")
                )}`
              : null
      };
    })
    .filter(Boolean);
}


async function resolveThroughWikidata(
  context,
  query
) {
  const humans = await wikidataHumans(
    context,
    query
  );

  for (const human of humans) {
    const signatures = [
      ...new Set(
        human.names
          .map(authorNameSignature)
          .filter(signature =>
            signature.split(" ").length >= 2
          )
      )
    ].slice(0, 12);

    const matches = dedupeCandidates(
      (
        await Promise.all(
          signatures.map(signature =>
            aliasCandidates(
              context,
              signature
            )
          )
        )
      ).flat()
    );

    if (matches.length === 1) {
      return {
        candidate: matches[0],
        displayName: human.name,
        wikidataId: human.id,
        description: human.description,
        wikipediaUrl: human.wikipediaUrl,
        resolution: "wikidata"
      };
    }

    if (matches.length > 1) {
      const canonicalSignature =
        authorNameSignature(human.name);

      const canonical = matches.filter(
        row =>
          authorNameSignature(row.n) ===
          canonicalSignature
      );
      const canonicalCandidate =
        dominantCandidate(
          dedupeCandidates(canonical)
        );

      if (canonicalCandidate) {
        return {
          candidate: canonicalCandidate,
          displayName: human.name,
          wikidataId: human.id,
          description: human.description,
          wikipediaUrl: human.wikipediaUrl,
          resolution: "wikidata"
        };
      }
    }
  }

  return null;
}


async function authorWorks(
  context,
  candidate,
  displayName,
  limit
) {
  const text = await cachedText(
    context,
    indexUrl(
      context,
      "works",
      authorBucket(String(candidate.id))
    )
  );

  return parseJsonLines(text)
    .filter(row =>
      String(row.id) ===
      String(candidate.id)
    )
    .slice(0, limit)
    .map((row, index) => {
      const workId = `W${row.wid}`;
      const url =
        `https://openalex.org/${workId}`;

      return {
        id: url,
        title:
          cleanAuthorWorkTitle(row.t),
        abstract: "",
        authors: [
          {
            id:
              `https://openalex.org/A${candidate.id}`,
            name: displayName,
            orcid: candidate.o || null
          }
        ],
        year: row.y,
        language: row.l,
        type: row.ty,
        doi: null,
        providers: [
          "OpenAlex Philosophy"
        ],
        urls: {
          landing: url
        },
        openAccess: {
          isOpen: false,
          url: null
        },
        relevanceScore:
          Math.max(90, 100 - index * 0.2),
        relevanceLevel: "Autor",
        retrievalMode: "author-index",
        authorPosition: row.p || null,
        coauthorCount: Number.isInteger(Number(row.co)) ? Number(row.co) : null,
        ranking: {
          author: 100,
          query: 100,
          philosophy: 100,
          discipline: 100,
          consensus: 0,
          bibliography: 100,
          impact: 0
        },
        authorIdentity: {
          id: candidate.id,
          displayName,
          sourceDisplayName: candidate.n,
          orcid: candidate.o || null
        },
        matchedQueries: []
      };
    });
}


function openAlexWorkId(item) {
  const candidates = [
    item?.openalexId,
    item?.openalex_id,
    item?.id,
    item?.urls?.canonical,
    item?.urls?.landing
  ];

  for (const candidate of candidates) {
    const match = String(candidate || "")
      .match(/(?:openalex[-:/]|\/)(W\d+)/i) ||
      String(candidate || "")
        .match(/^(W\d+)$/i);

    if (match) {
      return match[1]
        .slice(1);
    }
  }

  return null;
}


async function authorRowsForBuckets(
  context,
  buckets
) {
  const rows = [];

  for (
    let offset = 0;
    offset < buckets.length;
    offset += AUTHOR_SHARD_CONCURRENCY
  ) {
    const batch = buckets.slice(
      offset,
      offset + AUTHOR_SHARD_CONCURRENCY
    );

    const batchRows = await Promise.all(
      batch.map(async bucket => {
        for (
          let attempt = 1;
          attempt <= AUTHOR_SHARD_ATTEMPTS;
          attempt += 1
        ) {
          try {
            const url = indexUrl(
              context,
              "work-authors",
              bucket
            );

            if (attempt > 1) {
              url.searchParams.set(
                "retry",
                String(attempt - 1)
              );
            }

            return parseJsonLines(
              await cachedText(
                context,
                url
              )
            );
          } catch (error) {
            if (context.signal?.aborted) {
              throw error;
            }

            if (
              attempt ===
              AUTHOR_SHARD_ATTEMPTS
            ) {
              return [];
            }
          }
        }

        return [];
      })
    );

    rows.push(...batchRows.flat());
  }

  return rows;
}


export async function enrichResultsWithRemoteAuthors(
  response,
  options = {}
) {
  const results = response?.results || [];
  const missing = results
    .map(item => ({
      item,
      workId: openAlexWorkId(item)
    }))
    .filter(entry =>
      entry.workId &&
      !(entry.item.authors || []).length
    );

  if (!missing.length) {
    return response;
  }

  const context = createContext(options);
  const buckets = [
    ...new Set(
      missing.map(entry =>
        authorBucket(entry.workId)
      )
    )
  ];

  try {
    const rows =
      await authorRowsForBuckets(
        context,
        buckets
      );

    const byWork = new Map(
      rows.map(row => [
        String(row.wid),
        row.a || []
      ])
    );

    return {
      ...response,
      results: results.map(item => {
        if ((item.authors || []).length) {
          return item;
        }

        const workId = openAlexWorkId(item);
        const authors = byWork.get(
          String(workId || "")
        );

        if (!authors?.length) {
          return item;
        }

        return {
          ...item,
          authors: authors.map(author => ({
            id:
              `https://openalex.org/A${author.id}`,
            name: author.n,
            orcid: author.o || null,
            position: author.p || null,
            isCorresponding:
              Boolean(author.r)
          })),
          authorMetadataSource:
            "OpenAlex snapshot · Hugging Face"
        };
      })
    };
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }

    return response;
  }
}


async function resolvedPayload(
  context,
  selected,
  options
) {
  const works = await authorWorks(
    context,
    selected.candidate,
    selected.displayName,
    options.limit || DEFAULT_WORK_LIMIT
  );

  return {
    status: "resolved",
    resolution: selected.resolution,
    author: {
      id: selected.candidate.id,
      displayName: selected.displayName,
      sourceDisplayName:
        selected.candidate.n,
      orcid:
        selected.candidate.o || null,
      wikidataId:
        selected.wikidataId || null,
      biography:
        selected.description || null,
      wikipediaUrl:
        selected.wikipediaUrl || null,
      corpusWorks:
        selected.candidate.cw || 0
    },
    works
  };
}


export async function resolveRemoteAuthor(
  query,
  options = {}
) {
  if (!looksLikeAuthorQuery(query)) {
    return {
      status: "not-author",
      candidates: [],
      works: []
    };
  }

  const context = createContext(options);
  const signature = authorNameSignature(query);

  try {
    const direct = dedupeCandidates(
      await aliasCandidates(
        context,
        signature
      )
    );

    const full = direct.filter(
      row =>
        row.k === "full" &&
        authorNameSignature(row.n) ===
          signature
    );

    const tokenCount =
      signature.split(" ").length;
    const directIdentity =
      dominantCandidate(full);
    let canonicalSelection = null;

    for (
      const canonicalName of
      options.canonicalNames || []
    ) {
      const canonicalSignature =
        authorNameSignature(canonicalName);

      if (!canonicalSignature) {
        continue;
      }

      const canonicalMatches =
        dedupeCandidates(
          (
            await aliasCandidates(
              context,
              canonicalSignature
            )
          ).filter(row =>
            row.k === "full" &&
            authorNameSignature(row.n) ===
              canonicalSignature
          )
        );

      const canonicalIdentity =
        dominantCandidate(
          canonicalMatches
        );

      if (canonicalIdentity) {
        canonicalSelection = {
          candidate: canonicalIdentity,
          displayName: canonicalName,
          resolution:
            "canonical-catalog"
        };

        if (!options.includeProfile) {
          return resolvedPayload(
            context,
            canonicalSelection,
            options
          );
        }

        break;
      }
    }

    const verifyExternally =
      tokenCount <= 2 ||
      !directIdentity ||
      directIdentity.n?.includes(",");

    if (
      directIdentity &&
      !verifyExternally &&
      !options.includeProfile
    ) {
      return resolvedPayload(
        context,
        {
          candidate: directIdentity,
          displayName: directIdentity.n,
          resolution: "corpus"
        },
        options
      );
    }

    let wikidata = null;
    let wikidataError = null;

    try {
      wikidata =
        await resolveThroughWikidata(
          context,
          options.profileQuery || query
        );
    } catch (error) {
      if (options.signal?.aborted) {
        throw error;
      }

      wikidataError = error;
    }

    if (wikidata) {
      if (
        canonicalSelection &&
        String(
          canonicalSelection.candidate.id
        ) === String(
          wikidata.candidate.id
        )
      ) {
        wikidata.displayName =
          canonicalSelection.displayName;
      }

      return resolvedPayload(
        context,
        wikidata,
        options
      );
    }

    if (canonicalSelection) {
      return resolvedPayload(
        context,
        canonicalSelection,
        options
      );
    }

    if (
      directIdentity &&
      tokenCount > 1
    ) {
      return resolvedPayload(
        context,
        {
          candidate: directIdentity,
          displayName: directIdentity.n,
          resolution: "corpus"
        },
        options
      );
    }

    const candidates = dedupeCandidates(
      tokenCount === 1
        ? direct
        : full.length
          ? full
          : direct
    ).slice(0, 5);

    if (candidates.length) {
      return {
        status: "ambiguous",
        candidates,
        works: []
      };
    }

    if (wikidataError) {
      return {
        status: "unavailable",
        candidates: [],
        works: [],
        error: wikidataError.message
      };
    }

    return {
      status: "none",
      candidates: [],
      works: []
    };
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }

    return {
      status: "unavailable",
      candidates: [],
      works: [],
      error: error.message
    };
  }
}


function uniqueAuthorNames(values) {
  const names = [];
  const seen = new Set();

  for (const value of values) {
    const name = String(value || "")
      .replace(/^[\s,;]+|[\s,;]+$/g, "")
      .trim();
    const normalized = normalizeAuthorName(name);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    names.push(name);
  }

  return names;
}


function canonicalNameForSegment(
  segment,
  canonicalNames,
  used
) {
  const segmentTokens = new Set(
    normalizeAuthorName(segment)
      .split(" ")
      .filter(Boolean)
  );

  let best = null;

  canonicalNames.forEach((name, index) => {
    if (used.has(index)) {
      return;
    }

    const canonicalTokens = new Set(
      normalizeAuthorName(name)
        .split(" ")
        .filter(Boolean)
    );
    const matches = [...segmentTokens]
      .filter(token => canonicalTokens.has(token))
      .length;
    const canonicalLast = [
      ...canonicalTokens
    ].at(-1);
    const reliableMatch =
      matches === segmentTokens.size ||
      matches >= 2 ||
      segmentTokens.has(canonicalLast);

    if (
      reliableMatch &&
      (!best || matches > best.matches)
    ) {
      best = { name, index, matches };
    }
  });

  if (best) {
    used.add(best.index);
    return best.name;
  }

  return null;
}


function matchedAuthorInput(
  segment,
  canonicalName
) {
  if (!canonicalName) {
    return segment;
  }

  const canonicalTokens = new Set(
    normalizeAuthorName(canonicalName)
      .split(" ")
      .filter(Boolean)
  );
  const matched = String(segment)
    .split(/\s+/)
    .filter(token =>
      canonicalTokens.has(
        normalizeAuthorName(token)
      )
    );

  return matched.join(" ") || segment;
}


export function extractRemoteAuthorQueries(
  query,
  canonicalNames = []
) {
  const source = String(query || "").trim();
  const canonical = uniqueAuthorNames(
    canonicalNames
  );
  let segments = source
    .split(/\s+(?:y|e|and|et|und|&)\s+/iu)
    .map(value => value.trim())
    .filter(Boolean);

  if (
    segments.length < 2 &&
    (source.match(/,/g) || []).length >= 2
  ) {
    segments = source
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);
  }

  if (segments.length < 2) {
    if (canonical.length < 2) {
      return [];
    }

    segments = canonical;
  }

  const valid = uniqueAuthorNames(segments)
    .filter(looksLikeAuthorQuery);

  if (valid.length < 2) {
    return [];
  }

  const used = new Set();

  return valid.map(segment => {
    const canonicalName =
      canonicalNameForSegment(
        segment,
        canonical,
        used
      );

    return {
      input:
        matchedAuthorInput(
          segment,
          canonicalName
        ),
      canonicalName
    };
  });
}


export async function resolveRemoteAuthors(
  query,
  options = {}
) {
  const queries = extractRemoteAuthorQueries(
    query,
    options.canonicalNames || []
  );

  if (queries.length < 2) {
    return resolveRemoteAuthor(
      query,
      options
    );
  }

  const identities = await Promise.all(
    queries.map(async item => ({
      input: item.input,
      canonicalName: item.canonicalName,
      ...await resolveRemoteAuthor(
        item.input,
        {
          ...options,
          includeProfile: true,
          profileQuery:
            item.canonicalName ||
            item.input,
          canonicalNames:
            item.canonicalName
              ? [item.canonicalName]
              : []
        }
      )
    }))
  );

  return {
    status: "multiple",
    identities,
    authors: identities
      .filter(item => item.status === "resolved")
      .map(item => item.author),
    works: []
  };
}


export async function resolveRemoteAuthorCandidate(
  candidate,
  options = {}
) {
  if (
    options.includeProfile &&
    candidate?.n
  ) {
    try {
      const profiled =
        await resolveRemoteAuthor(
          candidate.n,
          {
            ...options,
            canonicalNames: [
              candidate.n
            ],
            includeProfile: true
          }
        );

      if (
        profiled.status === "resolved" &&
        String(profiled.author?.id) ===
          String(candidate.id)
      ) {
        return profiled;
      }
    } catch (error) {
      if (options.signal?.aborted) {
        throw error;
      }
    }
  }

  const context = createContext(options);

  return resolvedPayload(
    context,
    {
      candidate,
      displayName: candidate.n,
      resolution: "user"
    },
    options
  );
}


function resultKey(item) {
  const openAlex = [
    item.openalexId,
    item.openalex_id,
    item.id,
    item.urls?.canonical
  ]
    .map(value => String(value || ""))
    .map(value =>
      value.match(
        /(?:^|openalex[-:/]|\/)(W\d+)/i
      )?.[1]
    )
    .find(Boolean);

  if (openAlex) {
    return `openalex:${openAlex.toLowerCase()}`;
  }

  const id = String(item.id || "")
    .toLocaleLowerCase("und")
    .replace(/^https?:\/\/(api\.)?openalex\.org\//, "");

  if (id) {
    return `id:${id}`;
  }

  return `title:${normalizeAuthorName(
    item.title
  )}:${item.year || ""}`;
}


function authorIdentityTerms(identity) {
  const values = [
    identity.input,
    identity.canonicalName,
    identity.author?.displayName,
    identity.author?.sourceDisplayName
  ];

  return uniqueAuthorNames(values)
    .map(normalizeAuthorName)
    .filter(Boolean)
    .sort((a, b) =>
      b.split(" ").length -
      a.split(" ").length
    );
}


function normalizedWordSet(value) {
  return new Set(
    normalizeAuthorName(value)
      .split(" ")
      .filter(Boolean)
  );
}


function containsAuthorTerm(
  wordSet,
  term
) {
  const tokens = term
    .split(" ")
    .filter(Boolean);

  return Boolean(tokens.length) &&
    tokens.every(token =>
      wordSet.has(token)
    );
}


function authorRelationCoverage(
  item,
  identities
) {
  const titleWords = normalizedWordSet(
    item.title
  );
  const allWords = normalizedWordSet([
    item.title,
    item.abstract,
    ...(item.authors || []).map(author =>
      author?.name || author
    )
  ].filter(Boolean).join(" "));
  let coverage = 0;
  let titleCoverage = 0;

  for (const identity of identities) {
    const terms = authorIdentityTerms(identity);

    if (
      terms.some(term =>
        containsAuthorTerm(
          allWords,
          term
        )
      )
    ) {
      coverage += 1;
    }

    if (
      terms.some(term =>
        containsAuthorTerm(
          titleWords,
          term
        )
      )
    ) {
      titleCoverage += 1;
    }
  }

  return {
    coverage,
    titleCoverage
  };
}


function prioritizeMultiAuthorRelations(
  results,
  resolution
) {
  const identities =
    resolution.identities || [];

  return results
    .map((item, index) => ({
      item,
      index,
      ...authorRelationCoverage(
        item,
        identities
      )
    }))
    .sort((a, b) =>
      b.coverage - a.coverage ||
      b.titleCoverage - a.titleCoverage ||
      a.index - b.index
    )
    .map(entry => entry.item);
}


export function augmentWithAuthorResolution(
  response,
  authorResolution
) {
  if (
    authorResolution?.status ===
    "multiple"
  ) {
    return {
      ...response,
      authorResolution,
      results:
        prioritizeMultiAuthorRelations(
          response.results || [],
          authorResolution
        )
    };
  }

  const works =
    authorResolution?.status === "resolved"
      ? authorResolution.works || []
      : [];

  const existingKeys = new Set(
    (response.results || []).map(
      resultKey
    )
  );

  const authorAdditions = works.filter(
    item => !existingKeys.has(
      resultKey(item)
    )
  );

  const seen = new Set();
  const results = [];

  for (const item of [
    ...works,
    ...(response.results || [])
  ]) {
    const key = resultKey(item);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(item);
  }

  const providerCounts = {};

  for (const item of results) {
    for (const provider of item.providers || []) {
      providerCounts[provider] =
        (providerCounts[provider] || 0) + 1;
    }
  }

  return {
    ...response,
    authorResolution,
    results,
    stats: {
      ...(response.stats || {}),
      unique: results.length,
      appearances:
        (response.stats?.appearances || 0) +
        authorAdditions.length,
      providers: providerCounts
    }
  };
}


export function buildExclusiveAuthorResponse(
  response,
  authorResolution
) {
  if (
    authorResolution?.status !==
    "resolved"
  ) {
    return response;
  }

  const seen = new Set();
  const results = [];

  for (
    const item of
    authorResolution.works || []
  ) {
    const key = resultKey(item);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(item);
  }

  const providerCounts = {};

  for (const item of results) {
    for (
      const provider of
      item.providers || []
    ) {
      providerCounts[provider] =
        (providerCounts[provider] || 0) +
        1;
    }
  }

  return {
    ...(response || {}),
    query:
      authorResolution.author.displayName,
    searchMode: "author-only",
    authorOnly: true,
    authorResolution,
    results,
    errors: [],
    stats: {
      unique: results.length,
      appearances: results.length,
      merged: 0,
      multiProvider: 0,
      providers: providerCounts
    }
  };
}

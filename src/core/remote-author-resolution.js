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
const WIKIDATA_HEADERS = {
  "Api-User-Agent":
    "InvestigacionFilosofica/1.0 " +
    "(https://github.com/kychan00/InvestigacionFilosofica)"
};


export function normalizeAuthorName(
  value
) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/ß/g, "ss")
    .replace(/ς/g, "σ")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
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
          props: "labels|aliases|claims",
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
        names: [...new Set(names)]
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

      if (canonical.length === 1) {
        return {
          candidate: canonical[0],
          displayName: human.name,
          wikidataId: human.id,
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
    .filter(row => row.id === candidate.id)
    .slice(0, limit)
    .map((row, index) => {
      const workId = `W${row.wid}`;
      const url =
        `https://openalex.org/${workId}`;

      return {
        id: url,
        title: row.t,
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
    const rows = (
      await Promise.all(
        buckets.map(bucket =>
          cachedText(
            context,
            indexUrl(
              context,
              "work-authors",
              bucket
            )
          ).then(parseJsonLines)
        )
      )
    ).flat();

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
        return resolvedPayload(
          context,
          {
            candidate: canonicalIdentity,
            displayName: canonicalName,
            resolution:
              "canonical-catalog"
          },
          options
        );
      }
    }

    const verifyExternally =
      tokenCount <= 2 ||
      !directIdentity ||
      directIdentity.n?.includes(",");

    if (
      directIdentity &&
      !verifyExternally
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
          query
        );
    } catch (error) {
      if (options.signal?.aborted) {
        throw error;
      }

      wikidataError = error;
    }

    if (wikidata) {
      return resolvedPayload(
        context,
        wikidata,
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


export async function resolveRemoteAuthorCandidate(
  candidate,
  options = {}
) {
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


export function augmentWithAuthorResolution(
  response,
  authorResolution
) {
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

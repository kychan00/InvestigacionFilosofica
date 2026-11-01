import {
  RELATED_WORK_INDEX_SCHEMA_VERSION,
  compactNeighborToRelatedWorkEdge,
  relationShardPath,
  validateCompactRelatedWorkSeed
} from "./related-work-index-format.js";


const DEFAULT_STATIC_METADATA_BASE =
  "https://huggingface.co/datasets/" +
  "CristianPelayo/openalex-philosophy/" +
  "resolve/5a4a195085de54bf607a6c4397092ffb32716dcc/" +
  "semantic-retrieval/v3.3/browser-static-v4/20261010-v4";


function joinUrl(
  base,
  path
) {
  return (
    String(base || "")
      .replace(/\/$/, "") +
    "/" +
    String(path || "")
      .replace(/^\//, "")
  );
}


async function fetchOk(
  fetchImpl,
  url,
  signal
) {
  const response =
    await fetchImpl(
      url,
      {
        signal
      }
    );

  if (!response.ok) {
    throw new Error(
      `Related Work artifact fetch failed (${response.status}): ${url}`
    );
  }

  return response;
}


async function gunzipText(
  response
) {
  if (
    typeof DecompressionStream !==
    "function"
  ) {
    throw new Error(
      "This browser does not support DecompressionStream('gzip')"
    );
  }

  const stream =
    response.body.pipeThrough(
      new DecompressionStream(
        "gzip"
      )
    );

  return await new Response(
    stream
  ).text();
}


function parseJsonLines(
  text
) {
  return String(text || "")
    .split("\n")
    .map(
      line =>
        line.trim()
    )
    .filter(Boolean)
    .map(
      line =>
        JSON.parse(line)
    );
}


function binarySearchSeed(
  rows,
  identity
) {
  let left = 0;
  let right =
    rows.length - 1;

  while (left <= right) {
    const middle =
      Math.floor(
        (left + right) / 2
      );

    const value =
      String(
        rows[middle]?.s ||
        ""
      );

    if (value === identity) {
      return rows[middle];
    }

    if (value < identity) {
      left =
        middle + 1;
    } else {
      right =
        middle - 1;
    }
  }

  return null;
}


function validateManifest(
  manifest
) {
  if (
    !manifest ||
    manifest.schema_version !==
      RELATED_WORK_INDEX_SCHEMA_VERSION
  ) {
    throw new Error(
      "Unsupported Related Work Index manifest"
    );
  }

  const shardCount =
    Number(
      manifest.partition
        ?.shard_count
    );

  if (
    !Number.isInteger(
      shardCount
    ) ||
    shardCount < 1 ||
    shardCount > 256
  ) {
    throw new Error(
      "Related Work Index shard count is invalid"
    );
  }

  if (
    !Array.isArray(
      manifest.shards
    ) ||
    manifest.shards.length !==
      shardCount
  ) {
    throw new Error(
      "Related Work Index shard manifest is incomplete"
    );
  }

  return manifest;
}


function metadataPageNumber(
  vectorId,
  pageSize
) {
  return Math.floor(
    Number(vectorId) /
    Number(pageSize)
  );
}


export class RelatedWorkIndexClient {
  constructor({
    baseUrl,
    metadataBaseUrl =
      DEFAULT_STATIC_METADATA_BASE,
    fetchImpl =
      globalThis.fetch,
    decodeGzipText =
      gunzipText,
    cryptoImpl =
      globalThis.crypto
  } = {}) {
    if (!baseUrl) {
      throw new TypeError(
        "Related Work Index baseUrl is required"
      );
    }

    if (
      typeof fetchImpl !==
      "function"
    ) {
      throw new TypeError(
        "fetch implementation is required"
      );
    }

    this.baseUrl =
      baseUrl;

    this.metadataBaseUrl =
      metadataBaseUrl;

    this.fetchImpl =
      fetchImpl;

    this.decodeGzipText =
      decodeGzipText;

    this.cryptoImpl =
      cryptoImpl;

    this.manifest =
      null;

    this.shardCache =
      new Map();

    this.metadataManifest =
      null;

    this.metadataPageCache =
      new Map();
  }


  async initialize({
    signal
  } = {}) {
    if (this.manifest) {
      return this.manifest;
    }

    const response =
      await fetchOk(
        this.fetchImpl,
        joinUrl(
          this.baseUrl,
          "manifest.json"
        ),
        signal
      );

    const manifest =
      validateManifest(
        await response.json()
      );

    this.manifest =
      manifest;

    return manifest;
  }


  async loadShard(
    identity,
    {
      signal
    } = {}
  ) {
    const manifest =
      await this.initialize({
        signal
      });

    const path =
      await relationShardPath(
        identity,
        {
          shardCount:
            manifest.partition
              .shard_count,

          cryptoImpl:
            this.cryptoImpl
        }
      );

    if (
      this.shardCache.has(
        path
      )
    ) {
      return await this.shardCache.get(
        path
      );
    }

    const record =
      manifest.shards.find(
        item =>
          item.path === path
      );

    if (!record) {
      throw new Error(
        `Related Work shard is absent from manifest: ${path}`
      );
    }

    const pending =
      fetchOk(
        this.fetchImpl,
        joinUrl(
          this.baseUrl,
          path
        ),
        signal
      )
        .then(
          response =>
            this.decodeGzipText(
              response
            )
        )
        .then(
          text => {
            const rows =
              parseJsonLines(
                text
              );

            if (
              rows.length !==
              Number(
                record.seed_count
              )
            ) {
              throw new Error(
                `Related Work shard seed count mismatch: ${path}`
              );
            }

            return rows;
          }
        )
        .catch(
          error => {
            this.shardCache.delete(
              path
            );

            throw error;
          }
        );

    this.shardCache.set(
      path,
      pending
    );

    return await pending;
  }


  async findSeed(
    identity,
    options = {}
  ) {
    const normalized =
      String(
        identity ||
        ""
      ).trim();

    if (!normalized) {
      throw new TypeError(
        "Related Work seed identity is required"
      );
    }

    const rows =
      await this.loadShard(
        normalized,
        options
      );

    const seed =
      binarySearchSeed(
        rows,
        normalized
      );

    if (!seed) {
      return null;
    }

    const validation =
      validateCompactRelatedWorkSeed(
        seed
      );

    if (!validation.ok) {
      throw new Error(
        "Related Work seed failed compact contract: " +
        validation.errors.join(
          ", "
        )
      );
    }

    return seed;
  }


  async getEdges(
    identity,
    {
      limit = 6,
      signal
    } = {}
  ) {
    const seed =
      await this.findSeed(
        identity,
        {
          signal
        }
      );

    if (!seed) {
      return [];
    }

    const safeLimit =
      Math.max(
        0,
        Math.min(
          50,
          Number(limit) || 0
        )
      );

    return seed.n
      .slice(
        0,
        safeLimit
      )
      .map(
        neighbor =>
          compactNeighborToRelatedWorkEdge(
            seed,
            neighbor
          )
      );
  }


  async initializeMetadata({
    signal
  } = {}) {
    if (this.metadataManifest) {
      return this.metadataManifest;
    }

    const response =
      await fetchOk(
        this.fetchImpl,
        joinUrl(
          this.metadataBaseUrl,
          "manifest.json"
        ),
        signal
      );

    const manifest =
      await response.json();

    if (
      manifest.schema_version !==
        "qwen3-browser-semantic-static-artifacts-v4" ||
      !Number.isInteger(
        manifest.metadata
          ?.page_size
      ) ||
      !Array.isArray(
        manifest.metadata
          ?.pages
      )
    ) {
      throw new Error(
        "Unsupported Static V4 metadata manifest"
      );
    }

    this.metadataManifest =
      manifest;

    return manifest;
  }


  async loadMetadataPage(
    page,
    {
      signal
    } = {}
  ) {
    const manifest =
      await this.initializeMetadata({
        signal
      });

    if (
      !Number.isInteger(page) ||
      page < 0 ||
      page >=
        manifest.metadata
          .pages.length
    ) {
      throw new RangeError(
        "Static V4 metadata page is outside manifest bounds"
      );
    }

    if (
      this.metadataPageCache.has(
        page
      )
    ) {
      return await this.metadataPageCache.get(
        page
      );
    }

    const record =
      manifest.metadata
        .pages[page];

    const pending =
      fetchOk(
        this.fetchImpl,
        joinUrl(
          this.metadataBaseUrl,
          record.path
        ),
        signal
      )
        .then(
          response =>
            this.decodeGzipText(
              response
            )
        )
        .then(
          text =>
            new Map(
              parseJsonLines(
                text
              ).map(
                document => [
                  Number(
                    document.vector_id
                  ),
                  document
                ]
              )
            )
        )
        .catch(
          error => {
            this.metadataPageCache.delete(
              page
            );

            throw error;
          }
        );

    this.metadataPageCache.set(
      page,
      pending
    );

    return await pending;
  }


  async hydrateEdges(
    edges,
    {
      signal
    } = {}
  ) {
    if (!edges.length) {
      return [];
    }

    const manifest =
      await this.initializeMetadata({
        signal
      });

    const pageSize =
      manifest.metadata
        .page_size;

    const vectorIds =
      edges.map(
        edge => {
          const semantic =
            edge.evidence.find(
              item =>
                item.class ===
                "semantic"
            );

          return Number(
            semantic
              ?.observedVectorId
          );
        }
      );

    const targetVectorIds =
      edges.map(
        edge => {
          const id =
            String(
              edge.id ||
              ""
            );

          const match =
            id.match(
              /^rw:\d+:(\d+)$/
            );

          return match
            ? Number(
                match[1]
              )
            : null;
        }
      );

    const pages =
      [
        ...new Set(
          targetVectorIds
            .filter(
              Number.isInteger
            )
            .map(
              vectorId =>
                metadataPageNumber(
                  vectorId,
                  pageSize
                )
            )
        )
      ];

    const loaded =
      await Promise.all(
        pages.map(
          page =>
            this.loadMetadataPage(
              page,
              {
                signal
              }
            )
        )
      );

    const documents =
      new Map();

    for (
      const page of loaded
    ) {
      for (
        const [
          vectorId,
          document
        ] of page
      ) {
        documents.set(
          vectorId,
          document
        );
      }
    }

    return edges.map(
      (edge, index) => ({
        edge,

        targetVectorId:
          targetVectorIds[index],

        observedVectorId:
          vectorIds[index],

        document:
          documents.get(
            targetVectorIds[index]
          ) ||
          null
      })
    );
  }
}


export class RelatedWorksResolver {
  constructor({
    client
  } = {}) {
    if (!client) {
      throw new TypeError(
        "RelatedWorksResolver requires a client"
      );
    }

    this.client =
      client;

    this.cache =
      new Map();
  }


  async resolve(
    seed,
    {
      limit = 6,
      hydrate = true,
      signal
    } = {}
  ) {
    const identity =
      String(
        seed?.identity ||
        seed ||
        ""
      ).trim();

    if (!identity) {
      throw new TypeError(
        "Related Works seed identity is required"
      );
    }

    const cacheKey =
      [
        identity,
        limit,
        hydrate
          ? "hydrated"
          : "edges"
      ].join("|");

    if (
      this.cache.has(
        cacheKey
      )
    ) {
      return await this.cache.get(
        cacheKey
      );
    }

    const pending =
      this.#resolveUncached(
        identity,
        {
          limit,
          hydrate,
          signal
        }
      )
        .catch(
          error => {
            this.cache.delete(
              cacheKey
            );

            throw error;
          }
        );

    this.cache.set(
      cacheKey,
      pending
    );

    return await pending;
  }


  async #resolveUncached(
    identity,
    {
      limit,
      hydrate,
      signal
    }
  ) {
    const manifest =
      await this.client.initialize({
        signal
      });

    const edges =
      await this.client.getEdges(
        identity,
        {
          limit,
          signal
        }
      );

    if (!edges.length) {
      return {
        schemaVersion:
          "related-work-response-v1",

        seed: {
          identity
        },

        edges: [],

        items: [],

        coverage: {
          indexed:
            false,

          partial:
            true,

          reason:
            "seed-not-indexed-or-no-eligible-neighbors"
        },

        provenance: {
          indexSchema:
            manifest.schema_version,

          generatorVersion:
            manifest.generator_version,

          source:
            manifest.source
        }
      };
    }

    const items =
      hydrate
        ? await this.client.hydrateEdges(
            edges,
            {
              signal
            }
          )
        : edges.map(
            edge => ({
              edge,
              document:
                null
            })
          );

    return {
      schemaVersion:
        "related-work-response-v1",

      seed: {
        identity
      },

      edges,

      items,

      coverage: {
        indexed:
          true,

        partial:
          true,

        reason:
          "candidate-index-v1a"
      },

      provenance: {
        indexSchema:
          manifest.schema_version,

        generatorVersion:
          manifest.generator_version,

        source:
          manifest.source
      }
    };
  }
}


export {
  DEFAULT_STATIC_METADATA_BASE,
  binarySearchSeed,
  parseJsonLines
};

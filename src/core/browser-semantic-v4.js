import {
  BrowserStaticV4Search
} from "../ai/qwen3-browser-static-v4-search.js";

import {
  normalizeSemanticResponse
} from "./semantic-api.js";


export const BROWSER_STATIC_V4_BASE_URL =
  "https://huggingface.co/datasets/CristianPelayo/openalex-philosophy/resolve/5a4a195085de54bf607a6c4397092ffb32716dcc/semantic-retrieval/v3.3/browser-static-v4/20261010-v4";

const embeddingCache =
  new Map();

let staticSearch =
  null;


export function isBrowserSemanticV4OptIn(
  search = ""
) {
  return new URLSearchParams(
    search
  ).get("semantic") ===
    "browser-v4";
}


function assertNotAborted(
  signal
) {
  if (signal?.aborted) {
    throw new DOMException(
      "The operation was aborted.",
      "AbortError"
    );
  }
}


async function defaultEmbed(
  query,
  onProgress
) {
  if (!embeddingCache.has(query)) {
    embeddingCache.set(
      query,
      import(
        "../../vendor/qwen3-embedding-fp16/qwen3-browser-embedding-fp16.bundle.mjs"
      )
        .then(
          ({ embedQueriesWebGpu }) =>
            embedQueriesWebGpu(
              [
                {
                  query_id:
                    "browser-semantic-v4-query",
                  query
                }
              ],
              {
                onProgress
              }
            )
        )
        .then(
          payload =>
            payload.queries[0]
              .embedding
        )
        .catch(
          error => {
            embeddingCache.delete(
              query
            );

            throw error;
          }
        )
    );
  }

  return await embeddingCache.get(
    query
  );
}


function defaultSearch() {
  if (!staticSearch) {
    staticSearch =
      new BrowserStaticV4Search({
        baseUrl:
          BROWSER_STATIC_V4_BASE_URL
      });
  }

  return staticSearch;
}


export async function searchBrowserSemanticV4(
  query,
  {
    limit = 15,
    filters = {},
    signal,
    onProgress = () => {},
    embedImpl = defaultEmbed,
    searchImpl = defaultSearch()
  } = {}
) {
  assertNotAborted(
    signal
  );

  onProgress({
    stage:
      "embedding"
  });

  const embedding =
    await embedImpl(
      query,
      onProgress
    );

  assertNotAborted(
    signal
  );

  const payload =
    await searchImpl.search(
      embedding,
      {
        limit:
          Math.max(
            1,
            Math.min(
              20,
              Number(limit) ||
                15
            )
          ),
        filters,
        onProgress
      }
    );

  assertNotAborted(
    signal
  );

  return normalizeSemanticResponse({
    query,
    mode:
      "browser-static-v4",
    candidate_count:
      payload.candidate_count,
    reranker_enabled:
      false,
    results:
      payload.results
  });
}

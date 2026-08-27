import {
  parseQuery
} from "./parser.js";

import {
  expandQuery
} from "./expander.js";

import {
  mergeResults
} from "./merge-results.js";

import {
  rankResults
} from "./rank.js";

import {
  searchOpenAlex
} from "../sources/openalex.js";

import {
  searchCrossref
} from "../sources/crossref.js";


function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


const DEFAULT_OPTIONS = {
  maxQueries: 5,

  openAlex: {
    enabled: true,
    perPage: 6
  },

  crossref: {
    enabled: true,
    rows: 6
  },

  delayBetweenExpansions: 600
};


function mergeOptions(
  options = {}
) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,

    openAlex: {
      ...DEFAULT_OPTIONS.openAlex,
      ...(options.openAlex || {})
    },

    crossref: {
      ...DEFAULT_OPTIONS.crossref,
      ...(options.crossref || {})
    }
  };
}


async function searchExpansion(
  expansion,
  options
) {
  const jobs = [];


  if (
    options.openAlex.enabled
  ) {
    jobs.push({
      provider: "OpenAlex",

      promise:
        searchOpenAlex(
          expansion,
          {
            perPage:
              options.openAlex.perPage,

            signal:
              options.signal
          }
        )
    });
  }


  if (
    options.crossref.enabled
  ) {
    jobs.push({
      provider: "Crossref",

      promise:
        searchCrossref(
          expansion,
          {
            rows:
              options.crossref.rows,

            signal:
              options.signal,

            mailto:
              options.crossref.mailto ||
              null
          }
        )
    });
  }


  const settled =
    await Promise.allSettled(
      jobs.map(
        job => job.promise
      )
    );


  const results = [];
  const errors = [];


  for (
    let i = 0;
    i < settled.length;
    i++
  ) {
    const state =
      settled[i];

    const provider =
      jobs[i].provider;


    if (
      state.status ===
      "fulfilled"
    ) {
      results.push(
        ...state.value
      );

      continue;
    }


    /*
     * AbortController no representa un fallo
     * real de la fuente.
     */
    if (
      state.reason?.name ===
      "AbortError"
    ) {
      throw state.reason;
    }


    errors.push({
      provider,

      query:
        expansion.query,

      message:
        state.reason?.message ||
        String(state.reason)
    });
  }


  return {
    results,
    errors
  };
}


export async function searchPhilosophy(
  userQuery,
  philosophyMap,
  options = {}
) {
  const settings =
    mergeOptions(
      options
    );


  const query =
    String(
      userQuery || ""
    ).trim();


  if (!query) {
    return {
      query: "",
      parsed: null,
      expansions: [],
      results: [],
      errors: [],

      stats: {
        appearances: 0,
        unique: 0,
        merged: 0,
        providers: {}
      }
    };
  }


  /*
   * 1. Interpretación filosófica.
   */
  const parsed =
    parseQuery(
      query,
      philosophyMap
    );


  /*
   * 2. Expansión bilingüe/conceptual.
   */
  const expansions =
    expandQuery(
      parsed,
      philosophyMap,
      {
        maxQueries:
          settings.maxQueries
      }
    );


  const rawResults = [];
  const errors = [];


  /*
   * 3. Federación.
   *
   * Dentro de cada expansión:
   * OpenAlex + Crossref van en paralelo.
   *
   * Las expansiones se ejecutan
   * secuencialmente para evitar ráfagas
   * innecesarias a las APIs.
   */
  for (
    let i = 0;
    i < expansions.length;
    i++
  ) {
    if (
      settings.signal?.aborted
    ) {
      throw new DOMException(
        "Search aborted",
        "AbortError"
      );
    }


    const expansion =
      expansions[i];


    const batch =
      await searchExpansion(
        expansion,
        settings
      );


    rawResults.push(
      ...batch.results
    );

    errors.push(
      ...batch.errors
    );


    if (
      typeof settings.onProgress ===
      "function"
    ) {
      settings.onProgress({
        completed:
          i + 1,

        total:
          expansions.length,

        expansion,

        appearances:
          rawResults.length,

        errors:
          errors.length
      });
    }


    if (
      i <
        expansions.length - 1 &&
      settings.delayBetweenExpansions > 0
    ) {
      await sleep(
        settings.delayBetweenExpansions
      );
    }
  }


  /*
   * 4. Fusión entre consultas y proveedores.
   */
  const merged =
    mergeResults(
      rawResults
    );


  /*
   * 5. Ranking filosófico.
   */
  const ranked =
    rankResults(
      merged,
      parsed,
      philosophyMap
    );


  const providerCounts = {};


  for (const item of rawResults) {
    for (
      const provider of
      item.providers || []
    ) {
      providerCounts[provider] =
        (
          providerCounts[provider] ||
          0
        ) + 1;
    }
  }


  return {
    query,

    parsed,

    expansions,

    results:
      ranked,

    errors,

    pagination: {
      batch: 1
    },

    stats: {
      appearances:
        rawResults.length,

      unique:
        merged.length,

      merged:
        rawResults.length -
        merged.length,

      multiProvider:
        ranked.filter(
          item =>
            item.providers.length > 1
        ).length,

      providers:
        providerCounts
    }
  };
}


export async function searchMorePhilosophy(
  previousResponse,
  philosophyMap,
  options = {}
) {
  if (
    !previousResponse ||
    !previousResponse.expansions?.length
  ) {
    throw new Error(
      "No hay una búsqueda previa para ampliar."
    );
  }


  const settings =
    mergeOptions(
      options
    );


  /*
   * batch:
   * 1 = primera búsqueda ya realizada
   * 2 = siguiente página
   * 3 = siguiente...
   */
  const nextBatch =
    (
      previousResponse.pagination
        ?.batch || 1
    ) + 1;


  const newRaw = [];
  const errors = [];


  for (
    let i = 0;
    i <
      previousResponse.expansions.length;
    i++
  ) {
    const expansion =
      previousResponse.expansions[i];


    const jobs = [];


    if (
      settings.openAlex.enabled
    ) {
      jobs.push({
        provider:
          "OpenAlex",

        promise:
          searchOpenAlex(
            expansion,
            {
              perPage:
                settings.openAlex.perPage,

              page:
                nextBatch,

              signal:
                settings.signal
            }
          )
      });
    }


    if (
      settings.crossref.enabled
    ) {
      const rows =
        settings.crossref.rows;

      jobs.push({
        provider:
          "Crossref",

        promise:
          searchCrossref(
            expansion,
            {
              rows,

              offset:
                (
                  nextBatch - 1
                ) * rows,

              signal:
                settings.signal,

              mailto:
                settings.crossref.mailto ||
                null
            }
          )
      });
    }


    const settled =
      await Promise.allSettled(
        jobs.map(
          job =>
            job.promise
        )
      );


    for (
      let j = 0;
      j < settled.length;
      j++
    ) {
      const state =
        settled[j];

      const provider =
        jobs[j].provider;


      if (
        state.status ===
        "fulfilled"
      ) {
        newRaw.push(
          ...state.value
        );
      } else {
        if (
          state.reason?.name ===
          "AbortError"
        ) {
          throw state.reason;
        }

        errors.push({
          provider,

          query:
            expansion.query,

          message:
            state.reason?.message ||
            String(
              state.reason
            )
        });
      }
    }


    if (
      typeof settings.onProgress ===
      "function"
    ) {
      settings.onProgress({
        completed:
          i + 1,

        total:
          previousResponse
            .expansions.length,

        expansion,

        appearances:
          newRaw.length,

        errors:
          errors.length,

        batch:
          nextBatch
      });
    }


    if (
      i <
        previousResponse
          .expansions.length - 1 &&
      settings
        .delayBetweenExpansions > 0
    ) {
      await sleep(
        settings
          .delayBetweenExpansions
      );
    }
  }


  /*
   * previousResponse.results ya contiene
   * registros normalizados y fusionados.
   *
   * Los podemos volver a pasar por
   * mergeResults junto con los nuevos.
   */
  const merged =
    mergeResults([
      ...previousResponse.results,
      ...newRaw
    ]);


  const ranked =
    rankResults(
      merged,
      previousResponse.parsed,
      philosophyMap
    );


  const multiProvider =
    ranked.filter(
      item =>
        item.providers.length > 1
    ).length;


  return {
    ...previousResponse,

    results:
      ranked,

    errors: [
      ...(previousResponse.errors || []),
      ...errors
    ],

    stats: {
      ...previousResponse.stats,

      appearances:
        (
          previousResponse.stats
            .appearances || 0
        ) +
        newRaw.length,

      unique:
        ranked.length,

      merged:
        (
          previousResponse.stats
            .appearances || 0
        ) +
        newRaw.length -
        ranked.length,

      multiProvider
    },

    pagination: {
      batch:
        nextBatch,

      newAppearances:
        newRaw.length
    }
  };
}

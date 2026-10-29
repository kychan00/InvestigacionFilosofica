import {
  mergeResults
} from "./merge-results.js";


function providerCounts(results) {
  const counts = {};

  for (const item of results) {
    for (const provider of item.providers || []) {
      counts[provider] =
        (counts[provider] || 0) + 1;
    }
  }

  return counts;
}


export function combineSemanticWithFederated(
  semanticResponse,
  federatedResponse,
  {
    externalLimit = 20
  } = {}
) {
  const semanticResults =
    semanticResponse?.results || [];
  const federatedResults =
    federatedResponse?.results || [];

  const merged = mergeResults([
    ...semanticResults,
    ...federatedResults
  ]);

  const maximum =
    semanticResults.length +
    Math.max(0, externalLimit);

  const results = merged
    .slice(0, maximum)
    .map((item, index) =>
      index < semanticResults.length
        ? item
        : {
            ...item,
            semanticCompanion: true
          }
    );

  const externalCount = Math.max(
    0,
    results.length - semanticResults.length
  );

  return {
    ...semanticResponse,
    parsed:
      federatedResponse?.parsed ||
      semanticResponse?.parsed,
    expansions:
      federatedResponse?.expansions || [],
    results,
    errors: [
      ...(semanticResponse?.errors || []),
      ...(federatedResponse?.errors || [])
    ],
    stats: {
      appearances: results.length,
      unique: results.length,
      merged:
        semanticResults.length +
        federatedResults.length -
        merged.length,
      multiProvider: results.filter(
        item =>
          (item.providers || []).length > 1
      ).length,
      providers: providerCounts(results)
    },
    searchMode: "semantic",
    semantic: {
      ...(semanticResponse?.semantic || {}),
      federation: {
        enabled: true,
        semanticCount:
          semanticResults.length,
        externalCount,
        sources: [
          "OpenAlex Philosophy",
          "Crossref",
          "Internet Archive",
          "CUCSH Filosofía"
        ],
        openAlexApiEnabled: false,
        rerankerEnabled: false
      }
    }
  };
}

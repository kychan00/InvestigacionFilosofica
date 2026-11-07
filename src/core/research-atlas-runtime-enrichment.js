
import {
  AUTHOR_INDEX_RUNTIME_REVISION,
  enrichResultsWithRemoteAuthors
} from "./remote-author-resolution.js";

import {
  buildResearchAtlasRuntimeAuthorityGraph
} from "./research-atlas-runtime-authority.js";

import {
  buildResearchAtlasAuthorityL1Responses
} from "./research-atlas-runtime-related.js";


export const RESEARCH_ATLAS_RUNTIME_ENRICHMENT_REVISION =
  "2026-11-07.ra10-runtime-enrichment-v1";


export async function enrichResearchAtlasRuntime(
  searchResponse,
  {
    signal = null,
    authorResultLimit = 20,
    maxSeeds = 6,
    maxAuthorsPerSeed = 2,
    worksPerAuthor = 8,
    maxNeighborsPerSeed = 3,
    maxUniqueAuthors = 12,
    concurrency = 4,
    enrichResultsImpl =
      enrichResultsWithRemoteAuthors,
    buildAuthorityGraphImpl =
      buildResearchAtlasRuntimeAuthorityGraph,
    buildRelatedResponsesImpl =
      buildResearchAtlasAuthorityL1Responses
  } = {}
) {
  const enrichedResponse =
    await enrichResultsImpl(
      searchResponse,
      {
        signal,
        resultLimit:
          authorResultLimit
      }
    );

  if (
    signal?.aborted
  ) {
    throw new DOMException(
      "Research Atlas runtime enrichment aborted",
      "AbortError"
    );
  }

  const authorityGraph =
    buildAuthorityGraphImpl(
      enrichedResponse,
      {
        datasetRevision:
          AUTHOR_INDEX_RUNTIME_REVISION
      }
    );

  if (
    signal?.aborted
  ) {
    throw new DOMException(
      "Research Atlas runtime enrichment aborted",
      "AbortError"
    );
  }

  const related =
    await buildRelatedResponsesImpl(
      enrichedResponse,
      authorityGraph,
      {
        signal,
        maxSeeds,
        maxAuthorsPerSeed,
        worksPerAuthor,
        maxNeighborsPerSeed,
        maxUniqueAuthors,
        concurrency
      }
    );

  return {
    revision:
      RESEARCH_ATLAS_RUNTIME_ENRICHMENT_REVISION,
    authorIndexRevision:
      AUTHOR_INDEX_RUNTIME_REVISION,
    response:
      enrichedResponse,
    authorityGraph,
    relatedResponses:
      related.responses,
    diagnostics: {
      authority:
        authorityGraph
          .runtimeDiagnostics ||
        null,
      related:
        related.diagnostics
    }
  };
}

import {
  searchPhilosophy
} from "./search-engine.js";

import {
  searchPublicSemantic
} from "./semantic-api.js";

import {
  combineSemanticWithFederated
} from "./semantic-federation.js";

import {
  enrichResultsWithRemoteAuthors
} from "./remote-author-resolution.js";

import {
  ResearchAtlasAssembler
} from "./research-atlas-assembler.js";

import {
  ResearchAtlasLayoutEngine
} from "./research-atlas-layout.js";

import {
  addResearchAtlasDocumentSimilarity
} from "./research-atlas-document-similarity.js";

import {
  OPENALEX_PHILOSOPHY_HF_REVISION
} from "../sources/openalex-philosophy.js";


export const RESEARCH_ATLAS_LIVE_REVISION =
  "2026-11-07.ra7-v1";


function emptyAuthorityGraph() {
  return {
    schemaVersion:
      "author-authority-graph-v1",
    buildRevision:
      "research-atlas-live-unresolved-only",
    datasetRevision:
      "research-atlas-live-unresolved-only",
    authorities: [],
    mentions: [],
    sourceRecords: [],
    mentionAuthorityLinks: [],
    identifierRegistry: {},
    candidateRegistry: {},
    decisionLedger: {
      decisions: []
    },
    buildMetrics: {}
  };
}


function abortError() {
  return new DOMException(
    "Search aborted",
    "AbortError"
  );
}


function sourceRevisions(
  response,
  mode
) {
  const revisions = {
    openAlexPhilosophy:
      OPENALEX_PHILOSOPHY_HF_REVISION,
    liveIntegration:
      RESEARCH_ATLAS_LIVE_REVISION
  };

  if (
    mode ===
    "semantic-service"
  ) {
    revisions.semanticService =
      response?.semantic
        ?.indexBuildId ||
      response?.semantic
        ?.index_build_id ||
      response?.semantic
        ?.revision ||
      response?.semantic
        ?.corpusRevision ||
      "service-runtime-unversioned";
  }

  return revisions;
}


function safeDepth(value) {
  return Math.max(
    4,
    Math.min(
      30,
      Number(value) ||
      12
    )
  );
}


function safeLimit(value) {
  return Math.max(
    4,
    Math.min(
      40,
      Number(value) ||
      20
    )
  );
}


export class ResearchAtlasLiveSession {
  constructor({
    philosophyMap,
    searchPhilosophyImpl =
      searchPhilosophy,
    searchPublicSemanticImpl =
      searchPublicSemantic,
    combineSemanticImpl =
      combineSemanticWithFederated,
    enrichAuthorsImpl =
      enrichResultsWithRemoteAuthors,
    onUpdate =
      null
  } = {}) {
    if (!philosophyMap) {
      throw new TypeError(
        "ResearchAtlasLiveSession requires philosophyMap"
      );
    }

    this.philosophyMap =
      philosophyMap;

    this.searchPhilosophyImpl =
      searchPhilosophyImpl;

    this.searchPublicSemanticImpl =
      searchPublicSemanticImpl;

    this.combineSemanticImpl =
      combineSemanticImpl;

    this.enrichAuthorsImpl =
      enrichAuthorsImpl;

    this.onUpdate =
      typeof onUpdate ===
      "function"
        ? onUpdate
        : null;

    this.controller =
      null;

    this.runId = 0;

    this.assembler =
      null;

    this.layoutEngine =
      null;

    this.last =
      null;
  }


  cancel() {
    this.controller
      ?.abort();

    this.controller =
      null;
  }


  resetGraph() {
    this.assembler =
      new ResearchAtlasAssembler({
        authorityGraph:
          emptyAuthorityGraph()
      });

    this.layoutEngine =
      new ResearchAtlasLayoutEngine({
        maxExistingDisplacement:
          0.18
      });

    this.last =
      null;
  }


  startRun() {
    this.cancel();

    this.runId +=
      1;

    this.controller =
      new AbortController();

    this.resetGraph();

    return {
      runId:
        this.runId,
      signal:
        this.controller
          .signal
    };
  }


  isCurrent(
    runId
  ) {
    return (
      runId ===
        this.runId &&
      !this.controller
        ?.signal
        ?.aborted
    );
  }


  emit(
    response,
    {
      runId,
      phase,
      mode,
      progress =
        null,
      fallback =
        false
    }
  ) {
    if (
      !this.isCurrent(
        runId
      )
    ) {
      return null;
    }

    const base =
      this.assembler.ingest(
        response,
        {
          searchMode:
            mode,
          state:
            phase ===
            "partial"
              ? "collecting"
              : response
                    .errors
                    ?.length
                ? "partial"
                : "complete",
          sourceRevisions:
            sourceRevisions(
              response,
              mode
            )
        }
      );

    const snapshot =
      addResearchAtlasDocumentSimilarity(
        base
      );

    const layout =
      this.layoutEngine.layout(
        snapshot
      );

    const event = {
      runId,
      phase,
      mode,
      fallback,
      progress,
      response:
        structuredClone(
          response
        ),
      snapshot:
        structuredClone(
          snapshot
        ),
      layout:
        structuredClone(
          layout
        )
    };

    this.last =
      event;

    this.onUpdate
      ?.(
        structuredClone(
          event
        )
      );

    return event;
  }


  async runFederated(
    query,
    {
      depth = 12
    } = {}
  ) {
    const state =
      this.startRun();

    const text =
      String(
        query || ""
      ).trim();

    if (!text) {
      throw new TypeError(
        "Research Atlas query is required"
      );
    }

    const response =
      await this.searchPhilosophyImpl(
        text,
        this.philosophyMap,
        {
          signal:
            state.signal,
          maxQueries:
            5,
          openAlex: {
            enabled:
              false
          },
          openAlexPhilosophy: {
            enabled:
              true,
            rows:
              safeDepth(
                depth
              )
          },
          crossref: {
            enabled:
              true,
            rows:
              safeDepth(
                depth
              )
          },
          internetArchive: {
            enabled:
              true,
            rows:
              Math.min(
                safeDepth(
                  depth
                ),
                12
              )
          },
          cucshFilosofia: {
            enabled:
              true,
            rows:
              Math.min(
                safeDepth(
                  depth
                ),
                12
              )
          },
          onPartialResults:
            partial => {
              if (
                !this.isCurrent(
                  state.runId
                )
              ) {
                return;
              }

              this.emit(
                partial,
                {
                  runId:
                    state.runId,
                  phase:
                    "partial",
                  mode:
                    "traditional",
                  progress:
                    partial.progress
                }
              );
            }
        }
      );

    if (
      !this.isCurrent(
        state.runId
      )
    ) {
      throw abortError();
    }

    const enriched =
      await this.enrichAuthorsImpl(
        response,
        {
          signal:
            state.signal
        }
      );

    if (
      !this.isCurrent(
        state.runId
      )
    ) {
      throw abortError();
    }

    return this.emit(
      enriched,
      {
        runId:
          state.runId,
        phase:
          "complete",
        mode:
          "traditional"
      }
    );
  }


  async runSemantic(
    query,
    {
      limit = 20
    } = {}
  ) {
    const state =
      this.startRun();

    const text =
      String(
        query || ""
      ).trim();

    if (!text) {
      throw new TypeError(
        "Research Atlas query is required"
      );
    }

    const safe =
      safeLimit(
        limit
      );

    const [
      semanticState,
      federatedState
    ] =
      await Promise.allSettled([
        this.searchPublicSemanticImpl(
          text,
          {
            limit:
              safe,
            signal:
              state.signal
          }
        ),
        this.searchPhilosophyImpl(
          text,
          this.philosophyMap,
          {
            signal:
              state.signal,
            maxQueries:
              3,
            openAlex: {
              enabled:
                false
            },
            openAlexPhilosophy: {
              enabled:
                true,
              rows:
                Math.min(
                  safe,
                  10
                )
            },
            cucshFilosofia: {
              enabled:
                true,
              rows:
                Math.min(
                  safe,
                  8
                )
            },
            crossref: {
              enabled:
                true,
              rows:
                Math.min(
                  safe,
                  8
                )
            },
            internetArchive: {
              enabled:
                true,
              rows:
                Math.min(
                  safe,
                  8
                )
            }
          }
        )
      ]);

    if (
      !this.isCurrent(
        state.runId
      )
    ) {
      throw abortError();
    }

    if (
      semanticState.status ===
      "rejected" &&
      semanticState.reason
        ?.name ===
        "AbortError"
    ) {
      throw semanticState.reason;
    }

    if (
      federatedState.status ===
      "rejected" &&
      federatedState.reason
        ?.name ===
        "AbortError"
    ) {
      throw federatedState.reason;
    }

    if (
      federatedState.status !==
      "fulfilled"
    ) {
      throw federatedState.reason;
    }

    let response;
    let mode;
    let fallback =
      false;

    if (
      semanticState.status ===
      "fulfilled"
    ) {
      response =
        this.combineSemanticImpl(
          semanticState.value,
          federatedState.value,
          {
            externalLimit:
              safe
          }
        );

      mode =
        "semantic-service";
    } else {
      response =
        structuredClone(
          federatedState.value
        );

      response.errors = [
        {
          provider:
            "Búsqueda semántica",
          message:
            "El servicio semántico no estuvo disponible; se usó búsqueda federada."
        },
        ...(response.errors || [])
      ];

      mode =
        "traditional";

      fallback =
        true;
    }

    const enriched =
      await this.enrichAuthorsImpl(
        response,
        {
          signal:
            state.signal
        }
      );

    if (
      !this.isCurrent(
        state.runId
      )
    ) {
      throw abortError();
    }

    return this.emit(
      enriched,
      {
        runId:
          state.runId,
        phase:
          "complete",
        mode,
        fallback
      }
    );
  }

  async run(
    query,
    {
      mode =
        "federated",
      depth =
        12,
      limit =
        20
    } = {}
  ) {
    return mode ===
      "semantic"
      ? this.runSemantic(
          query,
          {
            limit
          }
        )
      : this.runFederated(
          query,
          {
            depth
          }
        );
  }
}

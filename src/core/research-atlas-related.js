import {
  RESEARCH_ATLAS_NODE_TYPES,
  RESEARCH_ATLAS_EDGE_TYPES,
  RESEARCH_ATLAS_EVIDENCE_CLASSES,
  RESEARCH_ATLAS_EDGE_STATUS,
  RESEARCH_ATLAS_DISCOVERY_ORIGINS,
  assertResearchAtlasSnapshot
} from "./research-atlas-contract.js";

import {
  researchAtlasWorkNodeId
} from "./research-atlas-assembler.js";

import {
  normalizeRelatedWorkIndexIdentity
} from "./related-work-index-format.js";


export const RESEARCH_ATLAS_RELATED_REVISION =
  "2026-11-07.ra4-v1";


function array(value) {
  return Array.isArray(value)
    ? value
    : value == null
      ? []
      : [value];
}


function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function stableObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [
        key,
        stableObject(value[key])
      ])
  );
}


function stableJson(value) {
  return JSON.stringify(
    stableObject(value)
  );
}


function fnv1a64(value) {
  let hash =
    0xcbf29ce484222325n;

  const prime =
    0x100000001b3n;

  for (
    const byte of
    new TextEncoder().encode(
      String(value || "")
    )
  ) {
    hash ^= BigInt(byte);

    hash =
      BigInt.asUintN(
        64,
        hash * prime
      );
  }

  return hash
    .toString(16)
    .padStart(16, "0");
}


function stableId(prefix, value) {
  return (
    prefix +
    ":" +
    fnv1a64(value)
  );
}


function uniqueStrings(values = []) {
  return [
    ...new Set(
      array(values)
        .flatMap(value =>
          Array.isArray(value)
            ? value
            : [value]
        )
        .map(value =>
          String(value || "")
            .trim()
        )
        .filter(Boolean)
    )
  ].sort();
}


export function normalizeResearchAtlasWorkIdentity(
  identity
) {
  const value =
    String(
      identity || ""
    ).trim();

  if (!value) {
    return "";
  }

  const doi =
    value.match(
      /^doi:(.+)$/i
    );

  if (doi) {
    return (
      "doi:" +
      doi[1]
        .trim()
        .toLowerCase()
    );
  }

  const openAlex =
    value.match(
      /^openalex:W?(\d+)$/i
    );

  if (openAlex) {
    return (
      "openalex:w" +
      openAlex[1]
    );
  }

  return value;
}


export function relatedWorkSeedIdentityForAtlasIdentity(
  identity
) {
  return normalizeRelatedWorkIndexIdentity(
    normalizeResearchAtlasWorkIdentity(
      identity
    )
  );
}


function identityKind(identity) {
  if (
    identity.startsWith(
      "doi:"
    )
  ) {
    return "doi";
  }

  if (
    identity.startsWith(
      "openalex:"
    )
  ) {
    return "openalex";
  }

  if (
    identity.startsWith(
      "provider-id:"
    )
  ) {
    return "provider-id";
  }

  return "fallback";
}


function documentAuthors(document) {
  return uniqueStrings(
    array(
      document?.authors
    ).map(author =>
      typeof author === "string"
        ? author
        : author?.name ||
          author?.displayName ||
          null
    )
  );
}


function documentProviders(document) {
  const providers =
    uniqueStrings([
      ...array(
        document?.providers
      ),
      document?.provider,
      document?.source
    ]);

  return providers.length
    ? providers
    : [
        "Related Work Index"
      ];
}


function documentTopics(document) {
  return array(
    document?.topics
  )
    .map(topic => {
      if (
        typeof topic ===
        "string"
      ) {
        return {
          id: topic,
          name: null,
          score: null
        };
      }

      return {
        id:
          topic?.id ||
          topic?.topic_id ||
          null,
        name:
          topic?.name ||
          topic?.display_name ||
          null,
        score:
          Number.isFinite(
            Number(
              topic?.score
            )
          )
            ? Number(
                topic.score
              )
            : null
      };
    })
    .filter(
      topic =>
        topic.id ||
        topic.name
    )
    .sort(
      (left, right) =>
        String(
          left.id ||
          left.name
        ).localeCompare(
          String(
            right.id ||
            right.name
          )
        )
    );
}


function sourceRefForExpandedDocument(
  identity,
  document
) {
  const vectorId =
    Number(
      document?.vector_id
    );

  return stableId(
    "source:related-work-metadata",
    stableJson({
      identity,
      vectorId:
        Number.isInteger(
          vectorId
        )
          ? vectorId
          : null
    })
  );
}


function expandedWorkNode(
  identity,
  document
) {
  const canonicalIdentity =
    normalizeResearchAtlasWorkIdentity(
      identity
    );

  const title =
    String(
      document?.title ||
      ""
    ).trim();

  if (
    !canonicalIdentity ||
    !title
  ) {
    return null;
  }

  return {
    id:
      researchAtlasWorkNodeId(
        canonicalIdentity
      ),
    nodeType:
      RESEARCH_ATLAS_NODE_TYPES
        .WORK,
    title,
    abstract:
      String(
        document?.abstract ||
        ""
      ).trim() ||
      null,
    identity: {
      kind:
        identityKind(
          canonicalIdentity
        ),
      key:
        canonicalIdentity
    },
    discovery: {
      directHit:
        false,
      origins: [
        RESEARCH_ATLAS_DISCOVERY_ORIGINS
          .RELATED_WORK_EXPANSION
      ]
    },
    providers:
      documentProviders(
        document
      ),
    sourceRecordRefs: [
      sourceRefForExpandedDocument(
        canonicalIdentity,
        document
      )
    ],
    matchedQueries: [],
    authors:
      documentAuthors(
        document
      ),
    year:
      Number.isFinite(
        Number(
          document?.year
        )
      )
        ? Number(
            document.year
          )
        : null,
    type:
      document?.type ||
      null,
    language:
      document?.language ||
      null,
    doi:
      document?.doi ||
      (
        canonicalIdentity
          .startsWith(
            "doi:"
          )
          ? canonicalIdentity
              .slice(4)
          : null
      ),
    isbn:
      uniqueStrings(
        document?.isbn
      ),
    journal:
      document?.journal ||
      document?.container_title ||
      null,
    publisher:
      document?.publisher ||
      null,
    topics:
      documentTopics(
        document
      ),
    urls:
      stableObject(
        document?.urls ||
        {}
      ),
    retrieval: {
      mode:
        "related-work-expansion",
      semanticCompanion:
        false,
      semanticScore:
        null
    }
  };
}


function responseList(
  relatedResponses
) {
  if (
    relatedResponses instanceof
    Map
  ) {
    return [
      ...relatedResponses
        .values()
    ];
  }

  if (
    Array.isArray(
      relatedResponses
    )
  ) {
    return relatedResponses;
  }

  if (
    isPlainObject(
      relatedResponses
    )
  ) {
    return Object.values(
      relatedResponses
    );
  }

  return [];
}


function canonicalResponses(
  relatedResponses
) {
  return responseList(
    relatedResponses
  )
    .filter(
      response =>
        response &&
        response.seed
          ?.identity
    )
    .sort(
      (left, right) =>
        normalizeResearchAtlasWorkIdentity(
          left.seed.identity
        ).localeCompare(
          normalizeResearchAtlasWorkIdentity(
            right.seed.identity
          )
        )
    );
}


function itemsByEdgeId(response) {
  return new Map(
    array(
      response?.items
    )
      .filter(item =>
        item?.edge?.id
      )
      .map(item => [
        String(
          item.edge.id
        ),
        item
      ])
  );
}


function relatedIndexRevision(
  response,
  explicitRevision
) {
  return (
    String(
      explicitRevision ||
      response?.provenance
        ?.indexRevision ||
      response?.provenance
        ?.generatorVersion ||
      ""
    ).trim()
  );
}


function semanticRevision(
  response,
  explicitRevision
) {
  return String(
    explicitRevision ||
    response?.provenance
      ?.source
      ?.semantic_revision ||
    response?.provenance
      ?.source
      ?.semanticRevision ||
    ""
  ).trim();
}


function relatedEvidence(
  seedNode,
  targetNode,
  edge,
  indexRevision
) {
  return {
    id:
      stableId(
        "evidence:related-work",
        stableJson({
          seed:
            seedNode.identity.key,
          target:
            targetNode.identity.key,
          relationEdgeRef:
            edge.id,
          indexRevision
        })
      ),
    class:
      RESEARCH_ATLAS_EVIDENCE_CLASSES
        .DERIVED,
    source:
      "related-work-index-v1",
    payload: {
      relationEdgeRef:
        edge.id,
      indexRevision,
      relationTypes:
        uniqueStrings(
          edge.relationTypes ||
          []
        ),
      signals:
        stableObject(
          edge.signals ||
          {}
        ),
      reasons:
        structuredClone(
          edge.reasons ||
          []
        )
    }
  };
}


function relatedEdge(
  seedNode,
  targetNode,
  evidence
) {
  return {
    id:
      stableId(
        "edge:related-work",
        seedNode.identity.key +
        "|" +
        targetNode.identity.key +
        "|" +
        evidence.payload
          .relationEdgeRef
      ),
    type:
      RESEARCH_ATLAS_EDGE_TYPES
        .RELATED_WORK,
    fromRef:
      seedNode.id,
    toRef:
      targetNode.id,
    status:
      RESEARCH_ATLAS_EDGE_STATUS
        .DERIVED,
    evidenceRefs: [
      evidence.id
    ]
  };
}


function semanticEvidence(
  seedNode,
  targetNode,
  edge,
  {
    modelId,
    modelRevision
  }
) {
  if (
    !edge.relationTypes
      ?.includes(
        "semantic-affinity"
      )
  ) {
    return null;
  }

  const score =
    Number(
      edge.signals
        ?.semantic
    );

  if (
    !Number.isFinite(
      score
    ) ||
    !modelRevision
  ) {
    return null;
  }

  const observed =
    array(
      edge.evidence
    ).find(
      item =>
        item.class ===
        "semantic"
    );

  return {
    id:
      stableId(
        "evidence:semantic-neighbor",
        stableJson({
          seed:
            seedNode.identity.key,
          target:
            targetNode.identity.key,
          modelId,
          modelRevision,
          score
        })
      ),
    class:
      RESEARCH_ATLAS_EVIDENCE_CLASSES
        .DERIVED,
    source:
      "related-work-index-v1",
    payload: {
      modelId,
      modelRevision,
      metric:
        "cosine",
      score,
      observedVectorId:
        Number.isInteger(
          Number(
            observed
              ?.observedVectorId
          )
        )
          ? Number(
              observed
                .observedVectorId
            )
          : null
    }
  };
}


function semanticEdge(
  seedNode,
  targetNode,
  evidence
) {
  return {
    id:
      stableId(
        "edge:semantic-neighbor",
        seedNode.identity.key +
        "|" +
        targetNode.identity.key +
        "|" +
        evidence.payload
          .modelRevision
      ),
    type:
      RESEARCH_ATLAS_EDGE_TYPES
        .SEMANTIC_NEIGHBOR,
    fromRef:
      seedNode.id,
    toRef:
      targetNode.id,
    status:
      RESEARCH_ATLAS_EDGE_STATUS
        .DERIVED,
    evidenceRefs: [
      evidence.id
    ]
  };
}


function canonicalSort(values) {
  return [
    ...values
  ].sort(
    (left, right) =>
      String(
        left.id ||
        ""
      ).localeCompare(
        String(
          right.id ||
          ""
        )
      )
  );
}


function updateExpandedDiscovery(
  node,
  seedNode,
  edge
) {
  if (
    node.discovery
      ?.directHit
  ) {
    return node;
  }

  const next =
    structuredClone(
      node
    );

  next.relatedDiscovery = {
    seedWorkRefs:
      uniqueStrings([
        ...array(
          next.relatedDiscovery
            ?.seedWorkRefs
        ),
        seedNode.id
      ]),
    relationEdgeRefs:
      uniqueStrings([
        ...array(
          next.relatedDiscovery
            ?.relationEdgeRefs
        ),
        edge.id
      ])
  };

  return next;
}


function updateDiagnostics(
  snapshot,
  metrics
) {
  const directHits =
    snapshot.nodes.filter(
      node =>
        node.nodeType ===
          RESEARCH_ATLAS_NODE_TYPES
            .WORK &&
        node.discovery
          ?.directHit ===
            true
    ).length;

  const expandedWorks =
    snapshot.nodes.filter(
      node =>
        node.nodeType ===
          RESEARCH_ATLAS_NODE_TYPES
            .WORK &&
        node.discovery
          ?.directHit ===
            false
    ).length;

  return {
    ...snapshot.diagnostics,
    directHits,
    expandedWorks,
    related: {
      revision:
        RESEARCH_ATLAS_RELATED_REVISION,
      responses:
        metrics.responses,
      indexedSeeds:
        metrics.indexedSeeds,
      candidateEdges:
        metrics.candidateEdges,
      relatedWorkEdges:
        metrics.relatedWorkEdges,
      semanticNeighborEdges:
        metrics.semanticNeighborEdges,
      expandedWorks,
      reusedDirectTargets:
        metrics.reusedDirectTargets,
      skippedUnhydratedTargets:
        metrics.skippedUnhydratedTargets,
      skippedByGlobalBudget:
        metrics.skippedByGlobalBudget,
      skippedSemanticWithoutRevision:
        metrics.skippedSemanticWithoutRevision
    }
  };
}


export function expandResearchAtlasWithRelatedWorks(
  snapshot,
  relatedResponses,
  {
    maxNeighborsPerSeed = 6,
    maxExpandedWorks = 24,
    relatedWorkIndexRevision = null,
    semanticModelId =
      "Qwen3-Embedding",
    semanticModelRevision = null
  } = {}
) {
  const perSeed =
    Math.max(
      0,
      Math.min(
        50,
        Number(
          maxNeighborsPerSeed
        ) || 0
      )
    );

  const globalBudget =
    Math.max(
      0,
      Math.min(
        200,
        Number(
          maxExpandedWorks
        ) || 0
      )
    );

  const nodesByIdentity =
    new Map(
      snapshot.nodes
        .filter(
          node =>
            node.nodeType ===
            RESEARCH_ATLAS_NODE_TYPES
              .WORK
        )
        .map(node => [
          normalizeResearchAtlasWorkIdentity(
            node.identity.key
          ),
          structuredClone(
            node
          )
        ])
    );

  const otherNodes =
    snapshot.nodes.filter(
      node =>
        node.nodeType !==
        RESEARCH_ATLAS_NODE_TYPES
          .WORK
    );

  const edges =
    new Map(
      snapshot.edges
        .map(edge => [
          edge.id,
          structuredClone(
            edge
          )
        ])
    );

  const evidence =
    new Map(
      snapshot.evidence
        .map(item => [
          item.id,
          structuredClone(
            item
          )
        ])
    );

  const metrics = {
    responses: 0,
    indexedSeeds: 0,
    candidateEdges: 0,
    relatedWorkEdges: 0,
    semanticNeighborEdges: 0,
    reusedDirectTargets: 0,
    skippedUnhydratedTargets: 0,
    skippedByGlobalBudget: 0,
    skippedSemanticWithoutRevision: 0
  };

  let expandedCount =
    [...nodesByIdentity.values()]
      .filter(
        node =>
          node.discovery
            ?.directHit ===
            false
      ).length;

  for (
    const response of
    canonicalResponses(
      relatedResponses
    )
  ) {
    metrics.responses += 1;

    const seedIdentity =
      normalizeResearchAtlasWorkIdentity(
        response.seed.identity
      );

    const seedNode =
      nodesByIdentity.get(
        seedIdentity
      );

    if (!seedNode) {
      throw new TypeError(
        "Related Work response seed is absent from Research Atlas: " +
        seedIdentity
      );
    }

    if (
      seedNode.discovery
        ?.directHit !==
        true
    ) {
      throw new TypeError(
        "RA4 L1 expansion requires a direct-hit seed: " +
        seedIdentity
      );
    }

    if (
      response.coverage
        ?.indexed ===
        true
    ) {
      metrics.indexedSeeds += 1;
    }

    const indexRevision =
      relatedIndexRevision(
        response,
        relatedWorkIndexRevision
      );

    if (!indexRevision) {
      throw new TypeError(
        "Related Work response requires an index revision"
      );
    }

    const modelRevision =
      semanticRevision(
        response,
        semanticModelRevision
      );

    const itemIndex =
      itemsByEdgeId(
        response
      );

    const candidates =
      array(
        response.edges
      )
        .slice(
          0,
          perSeed
        );

    for (
      const relation of
      candidates
    ) {
      metrics.candidateEdges += 1;

      const targetIdentity =
        normalizeResearchAtlasWorkIdentity(
          relation?.target
            ?.identity
        );

      if (
        !targetIdentity ||
        targetIdentity ===
          seedIdentity
      ) {
        continue;
      }

      let targetNode =
        nodesByIdentity.get(
          targetIdentity
        );

      if (!targetNode) {
        const item =
          itemIndex.get(
            String(
              relation.id
            )
          );

        if (!item?.document) {
          metrics
            .skippedUnhydratedTargets +=
            1;
          continue;
        }

        if (
          expandedCount >=
          globalBudget
        ) {
          metrics
            .skippedByGlobalBudget +=
            1;
          continue;
        }

        targetNode =
          expandedWorkNode(
            targetIdentity,
            item.document
          );

        if (!targetNode) {
          metrics
            .skippedUnhydratedTargets +=
            1;
          continue;
        }

        expandedCount += 1;

        nodesByIdentity.set(
          targetIdentity,
          targetNode
        );
      } else if (
        targetNode.discovery
          ?.directHit ===
          true
      ) {
        metrics
          .reusedDirectTargets +=
          1;
      }

      targetNode =
        updateExpandedDiscovery(
          targetNode,
          seedNode,
          relation
        );

      nodesByIdentity.set(
        targetIdentity,
        targetNode
      );

      const rwEvidence =
        relatedEvidence(
          seedNode,
          targetNode,
          relation,
          indexRevision
        );

      const rwEdge =
        relatedEdge(
          seedNode,
          targetNode,
          rwEvidence
        );

      evidence.set(
        rwEvidence.id,
        rwEvidence
      );

      edges.set(
        rwEdge.id,
        rwEdge
      );

      metrics.relatedWorkEdges += 1;

      if (
        relation.relationTypes
          ?.includes(
            "semantic-affinity"
          )
      ) {
        const semEvidence =
          semanticEvidence(
            seedNode,
            targetNode,
            relation,
            {
              modelId:
                semanticModelId,
              modelRevision
            }
          );

        if (!semEvidence) {
          metrics
            .skippedSemanticWithoutRevision +=
            1;
          continue;
        }

        const semEdge =
          semanticEdge(
            seedNode,
            targetNode,
            semEvidence
          );

        evidence.set(
          semEvidence.id,
          semEvidence
        );

        edges.set(
          semEdge.id,
          semEdge
        );

        metrics
          .semanticNeighborEdges +=
          1;
      }
    }
  }

  const enriched = {
    ...structuredClone(
      snapshot
    ),
    nodes:
      canonicalSort([
        ...otherNodes,
        ...nodesByIdentity
          .values()
      ]),
    edges:
      canonicalSort(
        edges.values()
      ),
    evidence:
      canonicalSort(
        evidence.values()
      )
  };

  enriched.diagnostics =
    updateDiagnostics(
      enriched,
      metrics
    );

  return assertResearchAtlasSnapshot(
    enriched
  );
}

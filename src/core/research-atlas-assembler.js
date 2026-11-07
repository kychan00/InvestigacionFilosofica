import {
  normalizeText
} from "./parser.js";

import {
  resultIdentityKey
} from "./merge-results.js";

import {
  enrichResearchAtlasWithAuthority
} from "./research-atlas-authority.js";

import {
  RESEARCH_ATLAS_SCHEMA_VERSION,
  RESEARCH_ATLAS_NODE_TYPES,
  RESEARCH_ATLAS_EDGE_TYPES,
  RESEARCH_ATLAS_EVIDENCE_CLASSES,
  RESEARCH_ATLAS_EDGE_STATUS,
  RESEARCH_ATLAS_DISCOVERY_ORIGINS,
  RESEARCH_ATLAS_SEARCH_MODES,
  assertResearchAtlasSnapshot
} from "./research-atlas-contract.js";


export const RESEARCH_ATLAS_ASSEMBLER_REVISION =
  "2026-11-07.ra2-v1";


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


function normalizedString(value) {
  const text =
    String(value || "").trim();

  return text || null;
}


function canonicalStrings(values = []) {
  const map =
    new Map();

  for (const value of values || []) {
    const original =
      normalizedString(value);

    if (!original) {
      continue;
    }

    const key =
      normalizeText(original);

    if (
      key &&
      !map.has(key)
    ) {
      map.set(
        key,
        original
      );
    }
  }

  return [...map.entries()]
    .sort(
      ([left], [right]) =>
        left.localeCompare(right)
    )
    .map(([, original]) =>
      original
    );
}


function canonicalMatchedQueries(
  values = [],
  fallbackQuery = ""
) {
  const map =
    new Map();

  for (const item of values || []) {
    const query =
      normalizedString(
        item?.query
      );

    if (!query) {
      continue;
    }

    const key =
      normalizeText(query);

    const previous =
      map.get(key);

    if (
      !previous ||
      Number(item?.weight || 0) >
        Number(previous?.weight || 0)
    ) {
      map.set(
        key,
        {
          query,
          weight:
            Number.isFinite(
              Number(item?.weight)
            )
              ? Number(item.weight)
              : 0,
          type:
            normalizedString(
              item?.type
            )
        }
      );
    }
  }

  if (
    map.size === 0 &&
    normalizedString(fallbackQuery)
  ) {
    map.set(
      normalizeText(
        fallbackQuery
      ),
      {
        query:
          String(
            fallbackQuery
          ).trim(),
        weight: 1,
        type: "original"
      }
    );
  }

  return [...map.values()]
    .sort(
      (left, right) =>
        right.weight -
          left.weight ||
        normalizeText(
          left.query
        ).localeCompare(
          normalizeText(
            right.query
          )
        )
    );
}


function bestMatchedQuery(
  result,
  fallbackQuery
) {
  return (
    canonicalMatchedQueries(
      result?.matchedQueries,
      fallbackQuery
    )[0]?.query ||
    String(
      fallbackQuery || ""
    ).trim()
  );
}


function sourceRecordRef(record) {
  const provider =
    normalizedString(
      record?.provider
    ) || "unknown";

  const sourceId =
    normalizedString(
      record?.sourceId
    );

  if (sourceId) {
    return [
      "source",
      encodeURIComponent(
        provider
      ),
      encodeURIComponent(
        sourceId
      )
    ].join(":");
  }

  return stableId(
    "source",
    stableJson({
      provider,
      query:
        record?.query ||
        null
    })
  );
}


function sourceRecordRefs(result) {
  return [
    ...new Set(
      (result?.sourceRecords || [])
        .map(sourceRecordRef)
    )
  ].sort();
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


export function researchAtlasWorkNodeId(
  identity
) {
  return stableId(
    "work",
    identity
  );
}


function queryContextKey({
  normalizedQuery,
  filters,
  searchMode
}) {
  return stableJson({
    normalizedQuery,
    filters:
      stableObject(
        filters || {}
      ),
    searchMode
  });
}


function inferSearchMode(
  response,
  context
) {
  const explicit =
    context?.searchMode;

  if (
    Object.values(
      RESEARCH_ATLAS_SEARCH_MODES
    ).includes(explicit)
  ) {
    return explicit;
  }

  if (
    response?.searchMode ===
      "semantic"
  ) {
    return (
      context?.browserSemantic ===
        true
        ? RESEARCH_ATLAS_SEARCH_MODES
            .BROWSER_SEMANTIC
        : RESEARCH_ATLAS_SEARCH_MODES
            .SEMANTIC_SERVICE
    );
  }

  return RESEARCH_ATLAS_SEARCH_MODES
    .TRADITIONAL;
}


function inferSessionState(
  response,
  context
) {
  if (
    [
      "collecting",
      "canonicalizing",
      "enriching",
      "settling",
      "complete",
      "partial",
      "failed"
    ].includes(
      context?.state
    )
  ) {
    return context.state;
  }

  if (response?.progress) {
    return "collecting";
  }

  if (
    (response?.errors || [])
      .length > 0
  ) {
    return "partial";
  }

  return "complete";
}


function canonicalSourceRevisions(
  response,
  context
) {
  const supplied =
    context?.sourceRevisions;

  if (
    isPlainObject(
      supplied
    )
  ) {
    return stableObject(
      supplied
    );
  }

  const semanticRevision =
    response?.semantic
      ?.revision ||
    response?.semantic
      ?.corpusRevision ||
    null;

  return stableObject({
    searchResponse:
      "runtime-unversioned",
    ...(semanticRevision
      ? {
          semantic:
            semanticRevision
        }
      : {})
  });
}


function workNode(
  result,
  query
) {
  const identity =
    resultIdentityKey(
      result
    );

  const providers =
    canonicalStrings(
      result?.providers
    );

  const matchedQueries =
    canonicalMatchedQueries(
      result?.matchedQueries,
      query
    );

  const authors =
    canonicalStrings(
      (result?.authors || [])
        .map(author =>
          author?.name ||
          author
        )
    );

  const topics =
    (result?.topics || [])
      .map(topic => ({
        id:
          normalizedString(
            topic?.id
          ),
        name:
          normalizedString(
            topic?.name
          ),
        score:
          Number.isFinite(
            Number(topic?.score)
          )
            ? Number(topic.score)
            : null
      }))
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

  return {
    id:
      researchAtlasWorkNodeId(
        identity
      ),
    nodeType:
      RESEARCH_ATLAS_NODE_TYPES
        .WORK,
    title:
      normalizedString(
        result?.title
      ) ||
      "Untitled work",
    identity: {
      kind:
        identityKind(
          identity
        ),
      key:
        identity
    },
    discovery: {
      directHit: true,
      origins: [
        RESEARCH_ATLAS_DISCOVERY_ORIGINS
          .DIRECT_SEARCH
      ]
    },
    providers,
    sourceRecordRefs:
      sourceRecordRefs(
        result
      ),
    matchedQueries,
    authors,
    year:
      Number.isFinite(
        Number(
          result?.year
        )
      )
        ? Number(
            result.year
          )
        : null,
    type:
      normalizedString(
        result?.type
      ),
    language:
      normalizedString(
        result?.language
      ),
    doi:
      normalizedString(
        result?.doi
      ),
    isbn:
      canonicalStrings(
        result?.isbn
      ),
    journal:
      normalizedString(
        result?.journal
      ),
    publisher:
      normalizedString(
        result?.publisher
      ),
    topics,
    urls:
      stableObject(
        result?.urls || {}
      ),
    retrieval: {
      mode:
        normalizedString(
          result?.retrievalMode
        ),
      semanticCompanion:
        result?.semanticCompanion ===
          true,
      semanticScore:
        Number.isFinite(
          Number(
            result?.semanticScore
          )
        )
          ? Number(
              result.semanticScore
            )
          : null
    }
  };
}


function queryEvidence({
  work,
  result,
  query,
  searchPosition
}) {
  const providers =
    canonicalStrings(
      result?.providers
    );

  const matchedQuery =
    bestMatchedQuery(
      result,
      query
    );

  return providers.map(
    provider => ({
      id:
        stableId(
          "evidence:query-result",
          stableJson({
            workIdentity:
              work.identity.key,
            provider
          })
        ),
      class:
        RESEARCH_ATLAS_EVIDENCE_CLASSES
          .FACTUAL,
      source:
        "search-response",
      payload: {
        provider,
        searchPosition,
        matchedQuery
      }
    })
  );
}


function queryResultEdge(
  queryNodeRef,
  work,
  evidence
) {
  return {
    id:
      stableId(
        "edge:query-result",
        stableJson({
          queryNodeRef,
          workIdentity:
            work.identity.key
        })
      ),
    type:
      RESEARCH_ATLAS_EDGE_TYPES
        .QUERY_RESULT,
    fromRef:
      queryNodeRef,
    toRef:
      work.id,
    status:
      RESEARCH_ATLAS_EDGE_STATUS
        .CONFIRMED,
    evidenceRefs:
      evidence
        .map(item =>
          item.id
        )
        .sort()
  };
}


function diagnosticsFor(nodes) {
  return {
    directHits:
      nodes.filter(
        node =>
          node.nodeType ===
            RESEARCH_ATLAS_NODE_TYPES
              .WORK &&
          node.discovery
            ?.directHit ===
              true
      ).length,
    expandedWorks:
      nodes.filter(
        node =>
          node.nodeType ===
            RESEARCH_ATLAS_NODE_TYPES
              .WORK &&
          node.discovery
            ?.directHit ===
              false
      ).length,
    authorityPersons:
      nodes.filter(
        node =>
          node.nodeType ===
            RESEARCH_ATLAS_NODE_TYPES
              .AUTHORITY_PERSON
      ).length,
    unresolvedMentions:
      nodes.filter(
        node =>
          node.nodeType ===
            RESEARCH_ATLAS_NODE_TYPES
              .AUTHOR_MENTION
      ).length
  };
}


export function buildResearchAtlasSnapshot(
  searchResponse,
  context = {}
) {
  if (
    !isPlainObject(
      searchResponse
    )
  ) {
    throw new TypeError(
      "SearchResponse is required"
    );
  }

  const rawQuery =
    normalizedString(
      searchResponse.query
    );

  if (!rawQuery) {
    throw new TypeError(
      "SearchResponse.query is required"
    );
  }

  const normalizedQuery =
    normalizeText(
      rawQuery
    );

  if (!normalizedQuery) {
    throw new TypeError(
      "SearchResponse.query normalizes to empty"
    );
  }

  const filters =
    stableObject(
      context.filters || {}
    );

  const searchMode =
    inferSearchMode(
      searchResponse,
      context
    );

  const queryKey =
    queryContextKey({
      normalizedQuery,
      filters,
      searchMode
    });

  const queryNodeRef =
    stableId(
      "query",
      queryKey
    );

  const sessionId =
    stableId(
      "session:research-atlas",
      queryKey
    );

  const queryNode = {
    id:
      queryNodeRef,
    nodeType:
      RESEARCH_ATLAS_NODE_TYPES
        .QUERY,
    rawQuery,
    normalizedQuery
  };

  const workNodes = [];
  const edges = [];
  const evidence = [];
  const seenIdentity =
    new Set();

  for (
    let index = 0;
    index <
      (searchResponse.results || [])
        .length;
    index += 1
  ) {
    const result =
      searchResponse.results[index];

    const work =
      workNode(
        result,
        rawQuery
      );

    if (
      seenIdentity.has(
        work.identity.key
      )
    ) {
      throw new TypeError(
        "SearchResponse contains duplicate canonical identity: " +
        work.identity.key
      );
    }

    seenIdentity.add(
      work.identity.key
    );

    const workEvidence =
      queryEvidence({
        work,
        result,
        query:
          rawQuery,
        searchPosition:
          index + 1
      });

    if (
      workEvidence.length ===
      0
    ) {
      throw new TypeError(
        "Search result has no provider evidence: " +
        work.identity.key
      );
    }

    workNodes.push(
      work
    );

    evidence.push(
      ...workEvidence
    );

    edges.push(
      queryResultEdge(
        queryNodeRef,
        work,
        workEvidence
      )
    );
  }

  const nodes = [
    queryNode,
    ...workNodes
  ].sort(
    (left, right) =>
      left.id.localeCompare(
        right.id
      )
  );

  edges.sort(
    (left, right) =>
      left.id.localeCompare(
        right.id
      )
  );

  evidence.sort(
    (left, right) =>
      left.id.localeCompare(
        right.id
      )
  );

  const session = {
    id:
      sessionId,
    rawQuery,
    normalizedQuery,
    queryNodeRef,
    searchMode,
    state:
      inferSessionState(
        searchResponse,
        context
      ),
    filters,
    sourceRevisions:
      canonicalSourceRevisions(
        searchResponse,
        context
      ),
    assemblerRevision:
      RESEARCH_ATLAS_ASSEMBLER_REVISION,
    graphRevision:
      Number.isInteger(
        context.graphRevision
      )
        ? context.graphRevision
        : 1
  };

  if (
    searchMode ===
      RESEARCH_ATLAS_SEARCH_MODES
        .BROWSER_SEMANTIC
  ) {
    session.semantic = {
      browserOptIn:
        context.browserOptIn ===
          true
    };
  }

  const snapshot = {
    schemaVersion:
      RESEARCH_ATLAS_SCHEMA_VERSION,
    session,
    nodes,
    edges,
    evidence,
    diagnostics:
      diagnosticsFor(
        nodes
      )
  };

  return assertResearchAtlasSnapshot(
    snapshot
  );
}


export function researchAtlasGraphSignature(
  snapshot
) {
  return stableJson({
    nodes:
      (snapshot?.nodes || [])
        .map(node => ({
          id:
            node.id,
          nodeType:
            node.nodeType,
          identity:
            node.identity?.key ||
            null
        }))
        .sort(
          (left, right) =>
            left.id.localeCompare(
              right.id
            )
        ),
    edges:
      (snapshot?.edges || [])
        .map(edge => ({
          type:
            edge.type,
          fromRef:
            edge.fromRef,
          toRef:
            edge.toRef
        }))
        .sort(
          (left, right) =>
            stableJson(left)
              .localeCompare(
                stableJson(
                  right
                )
              )
        )
  });
}


export class ResearchAtlasAssembler {
  constructor(context = {}) {
    this.context =
      structuredClone(
        context
      );

    this.graphRevision = 0;
    this.currentSnapshot =
      null;
  }

  ingest(
    searchResponse,
    context = {}
  ) {
    this.graphRevision += 1;

    const effectiveContext = {
      ...this.context,
      ...context,
      graphRevision:
        this.graphRevision
    };

    const baseSnapshot =
      buildResearchAtlasSnapshot(
        searchResponse,
        effectiveContext
      );

    this.currentSnapshot =
      effectiveContext
        .authorityGraph
        ? enrichResearchAtlasWithAuthority(
            baseSnapshot,
            searchResponse,
            {
              authorityGraph:
                effectiveContext
                  .authorityGraph,
              authorityWorkMap:
                effectiveContext
                  .authorityWorkMap ||
                null,
              authorityWorkMapRevision:
                effectiveContext
                  .authorityWorkMapRevision ||
                null
            }
          )
        : baseSnapshot;

    return structuredClone(
      this.currentSnapshot
    );
  }

  snapshot() {
    return this.currentSnapshot
      ? structuredClone(
          this.currentSnapshot
        )
      : null;
  }

  reset() {
    this.graphRevision = 0;
    this.currentSnapshot =
      null;
  }
}

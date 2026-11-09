// RA12-D3 — live Qwen semantic-neighbor topology with RA11 fallback.
// This module operates only on works already present in SearchResponse/Atlas.
// It never expands search, alters ranking, infers identity from similarity, or claims
// citation/influence/dependency. Cosine means representational proximity only.
import { resultIdentityKey } from "./merge-results.js";
import {
  RESEARCH_ATLAS_NODE_TYPES,
  RESEARCH_ATLAS_EDGE_TYPES,
  RESEARCH_ATLAS_EVIDENCE_CLASSES,
  RESEARCH_ATLAS_EDGE_STATUS,
  assertResearchAtlasSnapshot
} from "./research-atlas-contract.js";
import {
  addResearchAtlasDocumentSimilarity
} from "./research-atlas-document-similarity.js";
import {
  ResearchAtlasQwenVectorClient
} from "./research-atlas-qwen-vector-client.js";
import {
  cosineInt8
} from "./research-atlas-qwen-vector-range.js";

export const RA12D3_REVISION =
  "2026-11-09.ra12-d3-v1";

export const RA12D3_MODEL_ID =
  "Qwen/Qwen3-Embedding-0.6B";

export const RA12D3_MODEL_REVISION =
  "97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3";

function fnv1a64(value) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(String(value || ""))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

function stableId(prefix, value) {
  return prefix + ":" + fnv1a64(value);
}

function pairKey(leftRef, rightRef) {
  return [String(leftRef), String(rightRef)]
    .sort()
    .join("|");
}

function directWorks(snapshot, directHitsOnly) {
  return snapshot.nodes
    .filter(node =>
      node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK &&
      (!directHitsOnly || node.discovery?.directHit === true)
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

function resultMap(searchResponse) {
  const map = new Map();
  for (const result of searchResponse?.results || []) {
    const key = resultIdentityKey(result);
    if (!map.has(key)) map.set(key, result);
  }
  return map;
}

function selectedCandidates(candidates, { topK, maximumEdges }) {
  const ordered = [...candidates].sort((left, right) =>
    right.score - left.score ||
    pairKey(left.fromRef, left.toRef)
      .localeCompare(pairKey(right.fromRef, right.toRef))
  );

  const degree = new Map();
  const selected = [];

  for (const candidate of ordered) {
    if (selected.length >= maximumEdges) break;

    const leftDegree = degree.get(candidate.fromRef) || 0;
    const rightDegree = degree.get(candidate.toRef) || 0;

    if (leftDegree >= topK || rightDegree >= topK) continue;

    selected.push(candidate);
    degree.set(candidate.fromRef, leftDegree + 1);
    degree.set(candidate.toRef, rightDegree + 1);
  }

  return selected;
}

function vectorEvidenceSide(record) {
  return {
    identity:
      record.node.identity.key,
    resolutionState:
      record.resolution?.state || "unresolved",
    vectorSource:
      record.vector?.source || null,
    vectorSha256:
      record.vector?.vectorSha256 || null,
    proof:
      record.vector?.proof || null,
    ...(record.vector?.source === "v4"
      ? {
          cluster: record.vector.cluster,
          ordinal: record.vector.ordinal
        }
      : {}),
    ...(record.vector?.source === "overlay"
      ? {
          ordinal: record.vector.ordinal,
          overlayIdentity: record.vector.identity
        }
      : {})
  };
}

function semanticSnapshot(
  snapshot,
  selected,
  records,
  diagnostics
) {
  const edges = [...snapshot.edges];
  const evidence = [...snapshot.evidence];
  const byNode = new Map(records.map(record => [record.node.id, record]));

  for (const candidate of selected) {
    const key = pairKey(candidate.fromRef, candidate.toRef);
    const left = byNode.get(candidate.fromRef);
    const right = byNode.get(candidate.toRef);

    const evidenceId = stableId(
      "evidence:qwen-semantic-neighbor",
      [
        key,
        RA12D3_MODEL_REVISION,
        candidate.score.toFixed(12)
      ].join("|")
    );

    evidence.push({
      id: evidenceId,
      class: RESEARCH_ATLAS_EVIDENCE_CLASSES.DERIVED,
      source: "research-atlas-qwen-pairwise-v1",
      payload: {
        modelId: RA12D3_MODEL_ID,
        modelRevision: RA12D3_MODEL_REVISION,
        metric: "cosine",
        score: candidate.score,
        topologyRevision: RA12D3_REVISION,
        interpretation: "representational-proximity-only",
        from: vectorEvidenceSide(left),
        to: vectorEvidenceSide(right)
      }
    });

    edges.push({
      id: stableId(
        "edge:qwen-semantic-neighbor",
        key + "|" + RA12D3_REVISION
      ),
      type: RESEARCH_ATLAS_EDGE_TYPES.SEMANTIC_NEIGHBOR,
      fromRef: candidate.fromRef,
      toRef: candidate.toRef,
      status: RESEARCH_ATLAS_EDGE_STATUS.DERIVED,
      evidenceRefs: [evidenceId]
    });
  }

  return assertResearchAtlasSnapshot({
    ...structuredClone(snapshot),
    edges: edges.sort((a, b) => a.id.localeCompare(b.id)),
    evidence: evidence.sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics: {
      ...snapshot.diagnostics,
      qwenSemantic: diagnostics
    }
  });
}

/**
 * Add Qwen pairwise semantic-neighbor edges to direct SearchResponse works.
 *
 * RA11 fallback is limited to pairs where at least one endpoint lacks a verified
 * Qwen vector. Pairs with two verified vectors are considered semantically
 * evaluated even if they are not selected by topK/maximumEdges.
 */
export async function addResearchAtlasQwenSemanticTopology(
  snapshot,
  searchResponse,
  {
    vectorClient = new ResearchAtlasQwenVectorClient(),
    topK = 3,
    maximumEdges = 36,
    minimumScore = 0,
    directHitsOnly = true,
    signal = null
  } = {}
) {
  assertResearchAtlasSnapshot(snapshot);

  if (!searchResponse || typeof searchResponse !== "object") {
    throw new TypeError("SearchResponse is required for RA12-D3");
  }
  if (
    !Number.isInteger(topK) || topK < 1 || topK > 10 ||
    !Number.isInteger(maximumEdges) || maximumEdges < 1 || maximumEdges > 200 ||
    !Number.isFinite(minimumScore) || minimumScore < -1 || minimumScore > 1
  ) {
    throw new RangeError("Invalid RA12-D3 topology limits");
  }
  if (
    !vectorClient ||
    typeof vectorClient.resolveAndFetch !== "function"
  ) {
    throw new TypeError("RA12-D3 requires a Qwen vector client");
  }
  if (signal?.aborted) {
    throw new DOMException("Search aborted", "AbortError");
  }

  const works = directWorks(snapshot, directHitsOnly);
  const results = resultMap(searchResponse);

  const records = await Promise.all(
    works.map(async node => {
      const result = results.get(node.identity.key);
      if (!result) {
        return {
          node,
          result: null,
          resolution: {
            state: "unresolved",
            reason: "missing-search-response-result"
          },
          vector: {
            state: "unavailable",
            reason: "missing-search-response-result"
          }
        };
      }

      try {
        const fetched = await vectorClient.resolveAndFetch(
          result,
          { signal }
        );

        return {
          node,
          result,
          resolution: fetched?.resolution || {
            state: "unresolved",
            reason: "missing-resolution"
          },
          vector: fetched?.vector || {
            state: "unavailable",
            reason: "missing-vector"
          }
        };
      } catch (error) {
        if (signal?.aborted || error?.name === "AbortError") {
          throw new DOMException("Search aborted", "AbortError");
        }

        return {
          node,
          result,
          resolution: {
            state: "unresolved",
            reason: "semantic-transport-failed"
          },
          vector: {
            state: "blocked",
            reason:
              error instanceof Error
                ? error.message
                : "semantic-transport-failed"
          }
        };
      }
    })
  );

  if (signal?.aborted) {
    throw new DOMException("Search aborted", "AbortError");
  }

  const candidates = [];
  const fallbackPairKeys = new Set();
  let evaluatedPairs = 0;

  for (let left = 0; left < records.length; left += 1) {
    for (let right = left + 1; right < records.length; right += 1) {
      const a = records[left];
      const b = records[right];
      const key = pairKey(a.node.id, b.node.id);

      if (
        a.vector?.state === "verified" &&
        b.vector?.state === "verified"
      ) {
        const score = cosineInt8(a.vector.bytes, b.vector.bytes);
        evaluatedPairs += 1;
        if (score >= minimumScore) {
          candidates.push({
            fromRef: a.node.id,
            toRef: b.node.id,
            score
          });
        }
      } else {
        fallbackPairKeys.add(key);
      }
    }
  }

  const selected = selectedCandidates(
    candidates,
    { topK, maximumEdges }
  );

  const verified = records.filter(
    record => record.vector?.state === "verified"
  );
  const v4Vectors = verified.filter(
    record => record.vector?.source === "v4"
  ).length;
  const overlayVectors = verified.filter(
    record => record.vector?.source === "overlay"
  ).length;
  const blockedWorks = records.filter(
    record => record.vector?.state === "blocked"
  ).length;
  const unavailableWorks = records.length - verified.length - blockedWorks;

  const diagnostics = {
    revision: RA12D3_REVISION,
    modelId: RA12D3_MODEL_ID,
    modelRevision: RA12D3_MODEL_REVISION,
    metric: "cosine",
    interpretation: "representational-proximity-only",
    corpusWorks: records.length,
    vectorsVerified: verified.length,
    v4Vectors,
    overlayVectors,
    blockedWorks,
    unavailableWorks,
    evaluatedPairs,
    candidatePairs: candidates.length,
    semanticEdgesAdded: selected.length,
    lexicalFallbackPairs: fallbackPairKeys.size,
    topK,
    maximumEdges,
    minimumScore,
    directHitsOnly: Boolean(directHitsOnly)
  };

  const withSemantic = semanticSnapshot(
    snapshot,
    selected,
    records,
    diagnostics
  );

  return addResearchAtlasDocumentSimilarity(
    withSemantic,
    {
      pairFilter:
        (leftNode, rightNode) =>
          fallbackPairKeys.has(
            pairKey(leftNode.id, rightNode.id)
          )
    }
  );
}

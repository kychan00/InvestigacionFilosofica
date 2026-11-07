import {
  normalizeText
} from "./parser.js";

import {
  RESEARCH_ATLAS_NODE_TYPES,
  RESEARCH_ATLAS_EDGE_TYPES,
  RESEARCH_ATLAS_EVIDENCE_CLASSES,
  RESEARCH_ATLAS_EDGE_STATUS,
  assertResearchAtlasSnapshot
} from "./research-atlas-contract.js";


export const RESEARCH_ATLAS_LEXICAL_REVISION =
  "2026-11-07.ra7-lexical-v1";

export const RESEARCH_ATLAS_LEXICAL_METHOD =
  "title-token-jaccard-v1";


const STOPWORDS =
  new Set([
    "the","and","for","from","with","into","about","after","before",
    "this","that","these","those","between","through","toward","towards",
    "sobre","para","por","con","del","las","los","una","uno","unos","unas",
    "que","como","entre","desde","hacia","tras","ante","sin","sus","una",
    "estudio","study","analysis","analisis","approach","introduction",
    "introduccion","perspective","perspectiva"
  ]);


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
    hash ^=
      BigInt(byte);

    hash =
      BigInt.asUintN(
        64,
        hash *
          prime
      );
  }

  return hash
    .toString(16)
    .padStart(16,"0");
}


function stableId(
  prefix,
  value
) {
  return (
    prefix +
    ":" +
    fnv1a64(value)
  );
}


function titleTokens(
  value
) {
  return [
    ...new Set(
      normalizeText(
        value
      )
        .split(/\s+/)
        .map(token =>
          token.trim()
        )
        .filter(
          token =>
            token.length >=
              3 &&
            !STOPWORDS.has(
              token
            ) &&
            !/^\d+$/.test(
              token
            )
        )
    )
  ].sort();
}


function lexicalSimilarity(
  left,
  right
) {
  const leftSet =
    new Set(left);

  const rightSet =
    new Set(right);

  const shared =
    left.filter(
      token =>
        rightSet.has(
          token
        )
    );

  const union =
    new Set([
      ...left,
      ...right
    ]);

  const score =
    union.size
      ? shared.length /
        union.size
      : 0;

  return {
    score,
    sharedTokens:
      [...shared].sort(),
    unionSize:
      union.size
  };
}


function eligiblePair(
  similarity,
  {
    minimumScore,
    minimumSharedTokens
  }
) {
  if (
    similarity
      .sharedTokens
      .length >=
      minimumSharedTokens &&
    similarity.score >=
      minimumScore
  ) {
    return true;
  }

  return (
    similarity
      .sharedTokens
      .length >=
      1 &&
    similarity.score >=
      0.34
  );
}


function pairKey(
  leftRef,
  rightRef
) {
  return [
    leftRef,
    rightRef
  ]
    .sort()
    .join("|");
}


function existingPairTypes(
  snapshot
) {
  const map =
    new Map();

  for (
    const edge of
    snapshot.edges
  ) {
    const key =
      pairKey(
        edge.fromRef,
        edge.toRef
      );

    if (
      !map.has(key)
    ) {
      map.set(
        key,
        new Set()
      );
    }

    map.get(key)
      .add(
        edge.type
      );
  }

  return map;
}


export function addResearchAtlasLexicalNeighbors(
  snapshot,
  {
    topK = 3,
    maximumEdges = 36,
    minimumScore = 0.12,
    minimumSharedTokens = 2,
    directHitsOnly = true
  } = {}
) {
  assertResearchAtlasSnapshot(
    snapshot
  );

  const works =
    snapshot.nodes
      .filter(
        node =>
          node.nodeType ===
            RESEARCH_ATLAS_NODE_TYPES
              .WORK &&
          (
            !directHitsOnly ||
            node.discovery
              ?.directHit ===
              true
          )
      )
      .sort(
        (left,right) =>
          left.id.localeCompare(
            right.id
          )
      );

  const tokens =
    new Map(
      works.map(
        node => [
          node.id,
          titleTokens(
            node.title
          )
        ]
      )
    );

  const candidates = [];

  for (
    let left = 0;
    left <
      works.length;
    left += 1
  ) {
    for (
      let right =
        left + 1;
      right <
        works.length;
      right += 1
    ) {
      const a =
        works[left];

      const b =
        works[right];

      const similarity =
        lexicalSimilarity(
          tokens.get(
            a.id
          ),
          tokens.get(
            b.id
          )
        );

      if (
        !eligiblePair(
          similarity,
          {
            minimumScore,
            minimumSharedTokens
          }
        )
      ) {
        continue;
      }

      candidates.push({
        fromRef:
          a.id,
        toRef:
          b.id,
        ...similarity
      });
    }
  }

  candidates.sort(
    (left,right) =>
      right.score -
        left.score ||
      right.sharedTokens
        .length -
        left.sharedTokens
          .length ||
      pairKey(
        left.fromRef,
        left.toRef
      ).localeCompare(
        pairKey(
          right.fromRef,
          right.toRef
        )
      )
  );

  const degree =
    new Map();

  const selected = [];

  for (
    const candidate of
    candidates
  ) {
    if (
      selected.length >=
      maximumEdges
    ) {
      break;
    }

    const leftDegree =
      degree.get(
        candidate.fromRef
      ) ||
      0;

    const rightDegree =
      degree.get(
        candidate.toRef
      ) ||
      0;

    if (
      leftDegree >=
        topK ||
      rightDegree >=
        topK
    ) {
      continue;
    }

    selected.push(
      candidate
    );

    degree.set(
      candidate.fromRef,
      leftDegree +
        1
    );

    degree.set(
      candidate.toRef,
      rightDegree +
        1
    );
  }

  const existing =
    existingPairTypes(
      snapshot
    );

  const edges =
    [...snapshot.edges];

  const evidence =
    [...snapshot.evidence];

  let added = 0;
  let skippedSemantic = 0;

  for (
    const candidate of
    selected
  ) {
    const key =
      pairKey(
        candidate.fromRef,
        candidate.toRef
      );

    if (
      existing
        .get(key)
        ?.has(
          RESEARCH_ATLAS_EDGE_TYPES
            .SEMANTIC_NEIGHBOR
        )
    ) {
      skippedSemantic +=
        1;
      continue;
    }

    const evidenceId =
      stableId(
        "evidence:lexical-neighbor",
        [
          key,
          RESEARCH_ATLAS_LEXICAL_METHOD,
          candidate.score
            .toFixed(8)
        ].join("|")
      );

    evidence.push({
      id:
        evidenceId,
      class:
        RESEARCH_ATLAS_EVIDENCE_CLASSES
          .DERIVED,
      source:
        "research-atlas-live-v1",
      payload: {
        method:
          RESEARCH_ATLAS_LEXICAL_METHOD,
        revision:
          RESEARCH_ATLAS_LEXICAL_REVISION,
        score:
          candidate.score,
        sharedTokens:
          candidate.sharedTokens,
        unionSize:
          candidate.unionSize,
        representation:
          "normalized-title-tokens"
      }
    });

    edges.push({
      id:
        stableId(
          "edge:lexical-neighbor",
          key +
          "|" +
          RESEARCH_ATLAS_LEXICAL_REVISION
        ),
      type:
        RESEARCH_ATLAS_EDGE_TYPES
          .LEXICAL_NEIGHBOR,
      fromRef:
        candidate.fromRef,
      toRef:
        candidate.toRef,
      status:
        RESEARCH_ATLAS_EDGE_STATUS
          .DERIVED,
      evidenceRefs: [
        evidenceId
      ]
    });

    added += 1;
  }

  const enriched = {
    ...structuredClone(
      snapshot
    ),
    edges:
      edges.sort(
        (a,b) =>
          a.id.localeCompare(
            b.id
          )
      ),
    evidence:
      evidence.sort(
        (a,b) =>
          a.id.localeCompare(
            b.id
          )
      ),
    diagnostics: {
      ...snapshot.diagnostics,
      lexical: {
        revision:
          RESEARCH_ATLAS_LEXICAL_REVISION,
        method:
          RESEARCH_ATLAS_LEXICAL_METHOD,
        candidatePairs:
          candidates.length,
        edgesAdded:
          added,
        skippedBecauseSemantic:
          skippedSemantic,
        directHitsOnly:
          Boolean(
            directHitsOnly
          )
      }
    }
  };

  return assertResearchAtlasSnapshot(
    enriched
  );
}

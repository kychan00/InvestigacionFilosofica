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
  "2026-11-07.ra11-textual-v1";

export const RESEARCH_ATLAS_LEXICAL_METHOD =
  "title-abstract-tfidf-v1";


const TITLE_WEIGHT = 2;
const ABSTRACT_WEIGHT = 1;


const STOPWORDS =
  new Set([
    "the","and","for","from","with","into","about","after","before",
    "this","that","these","those","between","through","toward","towards",
    "sobre","para","por","con","del","las","los","una","uno","unos","unas",
    "que","como","entre","desde","hacia","tras","ante","sin","sus","una",
    "estudio","study","analysis","analisis","approach","introduction",
    "introduccion","perspective","perspectiva","paper","article","work",
    "examines","examine","explores","explore","argues","argue"
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


function tokens(value) {
  return normalizeText(
    String(
      value ||
      ""
    )
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
    );
}


function weightedTermCounts(
  node
) {
  const counts =
    new Map();

  const add =
    (
      values,
      fieldWeight
    ) => {
      for (
        const token of
        values
      ) {
        counts.set(
          token,
          (
            counts.get(
              token
            ) ||
            0
          ) +
          fieldWeight
        );
      }
    };

  add(
    tokens(
      node.title
    ),
    TITLE_WEIGHT
  );

  add(
    tokens(
      node.abstract
    ),
    ABSTRACT_WEIGHT
  );

  return counts;
}


function documentFrequency(
  countsById
) {
  const frequency =
    new Map();

  for (
    const counts of
    countsById.values()
  ) {
    for (
      const term of
      counts.keys()
    ) {
      frequency.set(
        term,
        (
          frequency.get(
            term
          ) ||
          0
        ) +
          1
      );
    }
  }

  return frequency;
}


function tfidfVector(
  counts,
  frequency,
  documentCount
) {
  const vector =
    new Map();

  let squared =
    0;

  for (
    const [
      term,
      weightedCount
    ] of
    counts
  ) {
    const tf =
      1 +
      Math.log(
        Math.max(
          1,
          weightedCount
        )
      );

    const df =
      frequency.get(
        term
      ) ||
      0;

    const idf =
      Math.log(
        (
          documentCount +
          1
        ) /
        (
          df +
          1
        )
      ) +
      1;

    const weight =
      tf *
      idf;

    vector.set(
      term,
      weight
    );

    squared +=
      weight *
      weight;
  }

  return {
    weights:
      vector,
    norm:
      Math.sqrt(
        squared
      )
  };
}


function cosine(
  left,
  right
) {
  if (
    !left.norm ||
    !right.norm
  ) {
    return {
      score:
        0,
      sharedTokens: []
    };
  }

  const [
    smaller,
    larger
  ] =
    left.weights.size <=
      right.weights.size
      ? [
          left.weights,
          right.weights
        ]
      : [
          right.weights,
          left.weights
        ];

  let dot =
    0;

  const shared = [];

  for (
    const [
      term,
      weight
    ] of
    smaller
  ) {
    const other =
      larger.get(
        term
      );

    if (
      other ===
      undefined
    ) {
      continue;
    }

    dot +=
      weight *
      other;

    shared.push(
      term
    );
  }

  return {
    score:
      dot /
      (
        left.norm *
        right.norm
      ),
    sharedTokens:
      shared.sort()
  };
}


function eligiblePair(
  similarity,
  {
    minimumScore,
    minimumSharedTokens
  }
) {
  return (
    similarity.score >=
      minimumScore &&
    similarity
      .sharedTokens
      .length >=
      minimumSharedTokens
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


function textCoverage(
  node
) {
  const abstract =
    String(
      node.abstract ||
      ""
    ).trim();

  return {
    hasTitle:
      Boolean(
        String(
          node.title ||
          ""
        ).trim()
      ),
    hasAbstract:
      Boolean(
        abstract
      ),
    abstractCharacters:
      abstract.length
  };
}


export function addResearchAtlasLexicalNeighbors(
  snapshot,
  {
    topK = 3,
    maximumEdges = 36,
    minimumScore = 0.18,
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

  const countsById =
    new Map(
      works.map(
        node => [
          node.id,
          weightedTermCounts(
            node
          )
        ]
      )
    );

  const frequency =
    documentFrequency(
      countsById
    );

  const vectors =
    new Map(
      works.map(
        node => [
          node.id,
          tfidfVector(
            countsById.get(
              node.id
            ),
            frequency,
            works.length
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
        cosine(
          vectors.get(
            a.id
          ),
          vectors.get(
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
        leftCoverage:
          textCoverage(
            a
          ),
        rightCoverage:
          textCoverage(
            b
          ),
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
  let skippedExisting = 0;
  let abstractBackedEdges = 0;
  let titleOnlyEdges = 0;

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

    if (
      existing
        .get(key)
        ?.has(
          RESEARCH_ATLAS_EDGE_TYPES
            .LEXICAL_NEIGHBOR
        )
    ) {
      skippedExisting +=
        1;
      continue;
    }

    const abstractBacked =
      candidate
        .leftCoverage
        .hasAbstract &&
      candidate
        .rightCoverage
        .hasAbstract;

    if (abstractBacked) {
      abstractBackedEdges +=
        1;
    } else {
      titleOnlyEdges +=
        1;
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
        "research-atlas-work-text-v1",
      payload: {
        method:
          RESEARCH_ATLAS_LEXICAL_METHOD,
        revision:
          RESEARCH_ATLAS_LEXICAL_REVISION,
        score:
          candidate.score,
        sharedTokens:
          candidate.sharedTokens,
        representation:
          "weighted-tfidf-title-abstract",
        titleWeight:
          TITLE_WEIGHT,
        abstractWeight:
          ABSTRACT_WEIGHT,
        leftTextCoverage:
          candidate.leftCoverage,
        rightTextCoverage:
          candidate.rightCoverage,
        abstractBacked
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

    added +=
      1;
  }

  const worksWithAbstract =
    works.filter(
      node =>
        textCoverage(
          node
        ).hasAbstract
    ).length;

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
        representation:
          "weighted-tfidf-title-abstract",
        workCount:
          works.length,
        worksWithAbstract,
        candidatePairs:
          candidates.length,
        edgesAdded:
          added,
        abstractBackedEdges,
        titleOnlyEdges,
        skippedBecauseSemantic:
          skippedSemantic,
        skippedExisting,
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

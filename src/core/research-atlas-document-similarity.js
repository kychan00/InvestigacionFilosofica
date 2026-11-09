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


export const RESEARCH_ATLAS_DOCUMENT_SIMILARITY_REVISION =
  "2026-11-07.ra11-document-v1";

export const RESEARCH_ATLAS_DOCUMENT_SIMILARITY_METHOD =
  "title-abstract-tfidf-cosine-v1";


const STOPWORDS =
  new Set([
    "the","and","for","from","with","into","about","after","before",
    "this","that","these","those","between","through","toward","towards",
    "over","under","within","without","where","when","which","while",
    "sobre","para","por","con","del","las","los","una","uno","unos","unas",
    "que","como","entre","desde","hacia","tras","ante","sin","sus","este",
    "esta","estos","estas","donde","cuando","cual","cuales","pero","porque",
    "study","studies","analysis","analyses","approach","approaches",
    "introduction","review","paper","article","estudio","estudios",
    "analisis","enfoque","enfoques","introduccion","revision","articulo"
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


function normalizedTokens(
  value
) {
  return normalizeText(
    value
  )
    .split(/\s+/)
    .map(token =>
      token
        .replace(
          /[^\p{L}\p{N}_-]/gu,
          ""
        )
        .trim()
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


function weightedTerms(
  node,
  {
    titleWeight,
    abstractWeight
  }
) {
  const title =
    normalizedTokens(
      node.title
    );

  const abstractText =
    String(
      node.abstract ||
      ""
    ).trim();

  const abstract =
    abstractText
      ? normalizedTokens(
          abstractText
        )
      : [];

  const counts =
    new Map();

  const add =
    (
      token,
      weight
    ) => {
      counts.set(
        token,
        (
          counts.get(
            token
          ) ||
          0
        ) +
        weight
      );
    };

  for (
    const token of
    title
  ) {
    add(
      token,
      titleWeight
    );
  }

  for (
    const token of
    abstract
  ) {
    add(
      token,
      abstractWeight
    );
  }

  return {
    counts,
    fieldsUsed: [
      "title",
      ...(
        abstractText
          ? [
              "abstract"
            ]
          : []
      )
    ]
  };
}


function documentFrequency(
  records
) {
  const frequency =
    new Map();

  for (
    const record of
    records
  ) {
    for (
      const token of
      record.terms
        .counts
        .keys()
    ) {
      frequency.set(
        token,
        (
          frequency.get(
            token
          ) ||
          0
        ) +
        1
      );
    }
  }

  return frequency;
}


function vectorize(
  counts,
  frequency,
  corpusSize
) {
  const vector =
    new Map();

  let squared =
    0;

  for (
    const [
      token,
      count
    ] of
    counts
  ) {
    const df =
      frequency.get(
        token
      ) ||
      0;

    const tf =
      1 +
      Math.log(
        Math.max(
          count,
          1e-9
        )
      );

    const idf =
      Math.log(
        (
          corpusSize +
          1
        ) /
        (
          df +
          1
        )
      ) +
      1;

    const value =
      tf *
      idf;

    vector.set(
      token,
      value
    );

    squared +=
      value *
      value;
  }

  const norm =
    Math.sqrt(
      squared
    ) ||
    1;

  for (
    const [
      token,
      value
    ] of
    vector
  ) {
    vector.set(
      token,
      value /
      norm
    );
  }

  return vector;
}


function cosine(
  left,
  right
) {
  const [
    smaller,
    larger
  ] =
    left.size <=
      right.size
      ? [
          left,
          right
        ]
      : [
          right,
          left
        ];

  let score =
    0;

  const sharedTerms =
    [];

  for (
    const [
      token,
      value
    ] of
    smaller
  ) {
    const other =
      larger.get(
        token
      );

    if (
      other ===
      undefined
    ) {
      continue;
    }

    score +=
      value *
      other;

    sharedTerms.push(
      token
    );
  }

  return {
    score:
      Math.max(
        0,
        Math.min(
          1,
          score
        )
      ),
    sharedTerms:
      sharedTerms
        .sort()
        .slice(
          0,
          12
        )
  };
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
      !map.has(
        key
      )
    ) {
      map.set(
        key,
        new Set()
      );
    }

    map.get(
      key
    ).add(
      edge.type
    );
  }

  return map;
}


function eligible(
  candidate,
  {
    minimumScore,
    minimumSharedTerms
  }
) {
  return (
    candidate.score >=
      minimumScore &&
    candidate.sharedTerms
      .length >=
      minimumSharedTerms
  );
}


export function addResearchAtlasDocumentSimilarity(
  snapshot,
  {
    topK = 3,
    maximumEdges = 36,
    minimumScore = 0.08,
    minimumSharedTerms = 2,
    titleWeight = 2,
    abstractWeight = 1,
    directHitsOnly = true,
    pairFilter = null
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
        (
          left,
          right
        ) =>
          left.id.localeCompare(
            right.id
          )
      );

  const records =
    works.map(
      node => ({
        node,
        terms:
          weightedTerms(
            node,
            {
              titleWeight,
              abstractWeight
            }
          )
      })
    );

  const frequency =
    documentFrequency(
      records
    );

  const corpusSize =
    Math.max(
      1,
      records.length
    );

  for (
    const record of
    records
  ) {
    record.vector =
      vectorize(
        record.terms
          .counts,
        frequency,
        corpusSize
      );
  }

  const candidates =
    [];

  for (
    let left = 0;
    left <
      records.length;
    left += 1
  ) {
    for (
      let right =
        left +
        1;
      right <
        records.length;
      right += 1
    ) {
      const a =
        records[
          left
        ];

      const b =
        records[
          right
        ];

      if (
        typeof pairFilter ===
          "function" &&
        !pairFilter(
          a.node,
          b.node
        )
      ) {
        continue;
      }

      const similarity =
        cosine(
          a.vector,
          b.vector
        );

      const candidate = {
        fromRef:
          a.node.id,
        toRef:
          b.node.id,
        score:
          similarity.score,
        sharedTerms:
          similarity.sharedTerms,
        fromFields:
          a.terms
            .fieldsUsed,
        toFields:
          b.terms
            .fieldsUsed
      };

      if (
        eligible(
          candidate,
          {
            minimumScore,
            minimumSharedTerms
          }
        )
      ) {
        candidates.push(
          candidate
        );
      }
    }
  }

  candidates.sort(
    (
      left,
      right
    ) =>
      right.score -
        left.score ||
      right.sharedTerms
        .length -
        left.sharedTerms
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

  const selected =
    [];

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
    [
      ...snapshot.edges
    ];

  const evidence =
    [
      ...snapshot.evidence
    ];

  let added =
    0;

  let skippedSemantic =
    0;

  let skippedExisting =
    0;

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
        .get(
          key
        )
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
        .get(
          key
        )
        ?.has(
          RESEARCH_ATLAS_EDGE_TYPES
            .LEXICAL_NEIGHBOR
        )
    ) {
      skippedExisting +=
        1;
      continue;
    }

    const evidenceId =
      stableId(
        "evidence:document-similarity",
        [
          key,
          RESEARCH_ATLAS_DOCUMENT_SIMILARITY_METHOD,
          candidate.score
            .toFixed(
              8
            )
        ].join(
          "|"
        )
      );

    evidence.push({
      id:
        evidenceId,
      class:
        RESEARCH_ATLAS_EVIDENCE_CLASSES
          .DERIVED,
      source:
        "research-atlas-work-topology-v1",
      payload: {
        method:
          RESEARCH_ATLAS_DOCUMENT_SIMILARITY_METHOD,
        revision:
          RESEARCH_ATLAS_DOCUMENT_SIMILARITY_REVISION,
        metric:
          "tfidf-cosine",
        score:
          candidate.score,
        sharedTerms:
          candidate.sharedTerms,
        fieldsUsed: {
          from:
            candidate.fromFields,
          to:
            candidate.toFields
        },
        titleWeight,
        abstractWeight,
        corpusSize
      }
    });

    edges.push({
      id:
        stableId(
          "edge:document-similarity",
          key +
          "|" +
          RESEARCH_ATLAS_DOCUMENT_SIMILARITY_REVISION
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
    records.filter(
      record =>
        record.terms
          .fieldsUsed
          .includes(
            "abstract"
          )
    ).length;

  const enriched = {
    ...structuredClone(
      snapshot
    ),
    edges:
      edges.sort(
        (
          a,
          b
        ) =>
          a.id.localeCompare(
            b.id
          )
      ),
    evidence:
      evidence.sort(
        (
          a,
          b
        ) =>
          a.id.localeCompare(
            b.id
          )
      ),
    diagnostics: {
      ...snapshot.diagnostics,
      documentSimilarity: {
        revision:
          RESEARCH_ATLAS_DOCUMENT_SIMILARITY_REVISION,
        method:
          RESEARCH_ATLAS_DOCUMENT_SIMILARITY_METHOD,
        corpusWorks:
          records.length,
        worksWithAbstract,
        titleOnlyWorks:
          records.length -
          worksWithAbstract,
        candidatePairs:
          candidates.length,
        edgesAdded:
          added,
        skippedBecauseSemantic:
          skippedSemantic,
        skippedExisting,
        topK,
        maximumEdges,
        minimumScore,
        minimumSharedTerms,
        titleWeight,
        abstractWeight,
        directHitsOnly:
          Boolean(
            directHitsOnly
          ),
        pairFilterApplied:
          typeof pairFilter ===
            "function"
      }
    }
  };

  return assertResearchAtlasSnapshot(
    enriched
  );
}

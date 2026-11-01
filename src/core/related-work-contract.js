export const RELATED_WORK_SCHEMA_VERSION =
  "related-work-v1";


export const RELATION_FAMILIES =
  Object.freeze({
    SEMANTIC:
      "semantic",
    PHILOSOPHICAL:
      "philosophical",
    AUTHORSHIP:
      "authorship",
    BIBLIOGRAPHIC:
      "bibliographic",
    HISTORICAL:
      "historical"
  });


export const RELATION_TYPES =
  Object.freeze({
    SEMANTIC_AFFINITY:
      "semantic-affinity",
    SHARED_TOPIC:
      "shared-topic",
    SHARED_CONCEPT:
      "shared-concept",
    SAME_AUTHOR:
      "same-author",
    SHARED_COAUTHOR:
      "shared-coauthor",
    CITED_BY_SEED:
      "cited-by-seed",
    CITES_SEED:
      "cites-seed",
    BIBLIOGRAPHIC_REFERENCE:
      "bibliographic-reference",
    SAME_DEBATE:
      "same-debate",
    HISTORICAL_CONTEXT:
      "historical-context"
  });


export const RELATION_TYPE_FAMILY =
  Object.freeze({
    [RELATION_TYPES.SEMANTIC_AFFINITY]:
      RELATION_FAMILIES.SEMANTIC,
    [RELATION_TYPES.SHARED_TOPIC]:
      RELATION_FAMILIES.PHILOSOPHICAL,
    [RELATION_TYPES.SHARED_CONCEPT]:
      RELATION_FAMILIES.PHILOSOPHICAL,
    [RELATION_TYPES.SAME_AUTHOR]:
      RELATION_FAMILIES.AUTHORSHIP,
    [RELATION_TYPES.SHARED_COAUTHOR]:
      RELATION_FAMILIES.AUTHORSHIP,
    [RELATION_TYPES.CITED_BY_SEED]:
      RELATION_FAMILIES.BIBLIOGRAPHIC,
    [RELATION_TYPES.CITES_SEED]:
      RELATION_FAMILIES.BIBLIOGRAPHIC,
    [RELATION_TYPES.BIBLIOGRAPHIC_REFERENCE]:
      RELATION_FAMILIES.BIBLIOGRAPHIC,
    [RELATION_TYPES.SAME_DEBATE]:
      RELATION_FAMILIES.PHILOSOPHICAL,
    [RELATION_TYPES.HISTORICAL_CONTEXT]:
      RELATION_FAMILIES.HISTORICAL
  });


export const EVIDENCE_CLASSES =
  Object.freeze({
    DETERMINISTIC:
      "deterministic",
    BIBLIOGRAPHIC:
      "bibliographic",
    SEMANTIC:
      "semantic",
    CONTEXTUAL:
      "contextual"
  });


export const EVIDENCE_STRENGTH =
  Object.freeze({
    VETO:
      "veto",
    STRONG:
      "strong",
    SUPPORTING:
      "supporting",
    WEAK:
      "weak"
  });


export const RELATION_REASON_CODES =
  Object.freeze({
    SEMANTIC_AFFINITY:
      "semantic-affinity",
    SHARED_TOPIC:
      "shared-topic",
    SHARED_CONCEPT:
      "shared-concept",
    SAME_AUTHOR:
      "same-author",
    SHARED_COAUTHOR:
      "shared-coauthor",
    CITED_BY_SEED:
      "cited-by-seed",
    CITES_SEED:
      "cites-seed",
    BIBLIOGRAPHIC_REFERENCE:
      "bibliographic-reference",
    SAME_DEBATE:
      "same-debate",
    HISTORICAL_CONTEXT:
      "historical-context"
  });


export const RELATION_EVIDENCE_REQUIREMENTS =
  Object.freeze({
    [RELATION_TYPES.SEMANTIC_AFFINITY]: {
      minimumClass:
        EVIDENCE_CLASSES.SEMANTIC,
      requiresStructuredIdentity:
        false,
      requiresExplicitBibliographicEdge:
        false
    },
    [RELATION_TYPES.SHARED_TOPIC]: {
      minimumClass:
        EVIDENCE_CLASSES.CONTEXTUAL,
      requiresStructuredIdentity:
        false,
      requiresExplicitBibliographicEdge:
        false
    },
    [RELATION_TYPES.SHARED_CONCEPT]: {
      minimumClass:
        EVIDENCE_CLASSES.CONTEXTUAL,
      requiresStructuredIdentity:
        false,
      requiresExplicitBibliographicEdge:
        false
    },
    [RELATION_TYPES.SAME_AUTHOR]: {
      minimumClass:
        EVIDENCE_CLASSES.BIBLIOGRAPHIC,
      requiresStructuredIdentity:
        true,
      requiresExplicitBibliographicEdge:
        false
    },
    [RELATION_TYPES.SHARED_COAUTHOR]: {
      minimumClass:
        EVIDENCE_CLASSES.BIBLIOGRAPHIC,
      requiresStructuredIdentity:
        true,
      requiresExplicitBibliographicEdge:
        false
    },
    [RELATION_TYPES.CITED_BY_SEED]: {
      minimumClass:
        EVIDENCE_CLASSES.BIBLIOGRAPHIC,
      requiresStructuredIdentity:
        true,
      requiresExplicitBibliographicEdge:
        true
    },
    [RELATION_TYPES.CITES_SEED]: {
      minimumClass:
        EVIDENCE_CLASSES.BIBLIOGRAPHIC,
      requiresStructuredIdentity:
        true,
      requiresExplicitBibliographicEdge:
        true
    },
    [RELATION_TYPES.BIBLIOGRAPHIC_REFERENCE]: {
      minimumClass:
        EVIDENCE_CLASSES.BIBLIOGRAPHIC,
      requiresStructuredIdentity:
        true,
      requiresExplicitBibliographicEdge:
        true
    },
    [RELATION_TYPES.SAME_DEBATE]: {
      minimumClass:
        EVIDENCE_CLASSES.CONTEXTUAL,
      requiresStructuredIdentity:
        false,
      requiresExplicitBibliographicEdge:
        false
    },
    [RELATION_TYPES.HISTORICAL_CONTEXT]: {
      minimumClass:
        EVIDENCE_CLASSES.CONTEXTUAL,
      requiresStructuredIdentity:
        false,
      requiresExplicitBibliographicEdge:
        false
    }
  });


const EVIDENCE_CLASS_RANK =
  Object.freeze({
    [EVIDENCE_CLASSES.CONTEXTUAL]:
      1,
    [EVIDENCE_CLASSES.SEMANTIC]:
      2,
    [EVIDENCE_CLASSES.BIBLIOGRAPHIC]:
      3,
    [EVIDENCE_CLASSES.DETERMINISTIC]:
      4
  });


function isPlainObject(
  value
) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function isNonEmptyString(
  value
) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}


function isFiniteUnit(
  value
) {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}


function relationTypeValues() {
  return new Set(
    Object.values(
      RELATION_TYPES
    )
  );
}


function evidenceClassValues() {
  return new Set(
    Object.values(
      EVIDENCE_CLASSES
    )
  );
}


function evidenceStrengthValues() {
  return new Set(
    Object.values(
      EVIDENCE_STRENGTH
    )
  );
}


export function relationFamilyFor(
  relationType
) {
  return (
    RELATION_TYPE_FAMILY[
      relationType
    ] ||
    null
  );
}


export function evidenceClassSatisfies(
  actual,
  minimum
) {
  return (
    (
      EVIDENCE_CLASS_RANK[
        actual
      ] ||
      0
    ) >=
    (
      EVIDENCE_CLASS_RANK[
        minimum
      ] ||
      Infinity
    )
  );
}


export function validateRelatedWorkEdge(
  edge
) {
  const errors = [];

  if (!isPlainObject(edge)) {
    return {
      ok: false,
      errors: [
        "edge:not-object"
      ]
    };
  }

  if (
    edge.schemaVersion !==
    RELATED_WORK_SCHEMA_VERSION
  ) {
    errors.push(
      "schema:unsupported"
    );
  }

  if (
    !isNonEmptyString(
      edge.id
    )
  ) {
    errors.push(
      "edge:id-required"
    );
  }

  if (
    !isPlainObject(
      edge.seed
    ) ||
    !isNonEmptyString(
      edge.seed.identity
    )
  ) {
    errors.push(
      "seed:identity-required"
    );
  }

  if (
    !isPlainObject(
      edge.target
    ) ||
    !isNonEmptyString(
      edge.target.identity
    )
  ) {
    errors.push(
      "target:identity-required"
    );
  }

  if (
    edge.seed?.identity &&
    edge.target?.identity &&
    edge.seed.identity ===
      edge.target.identity
  ) {
    errors.push(
      "edge:self-relation-forbidden"
    );
  }

  const relationTypes =
    Array.isArray(
      edge.relationTypes
    )
      ? edge.relationTypes
      : [];

  if (!relationTypes.length) {
    errors.push(
      "relations:at-least-one-required"
    );
  }

  const knownRelationTypes =
    relationTypeValues();

  for (
    const relationType of
    relationTypes
  ) {
    if (
      !knownRelationTypes.has(
        relationType
      )
    ) {
      errors.push(
        "relations:unknown:" +
        relationType
      );
    }
  }

  const evidence =
    Array.isArray(
      edge.evidence
    )
      ? edge.evidence
      : [];

  if (!evidence.length) {
    errors.push(
      "evidence:at-least-one-required"
    );
  }

  const knownEvidenceClasses =
    evidenceClassValues();

  const knownStrengths =
    evidenceStrengthValues();

  const evidenceById =
    new Map();

  for (
    const item of evidence
  ) {
    if (
      !isPlainObject(item) ||
      !isNonEmptyString(item.id)
    ) {
      errors.push(
        "evidence:id-required"
      );
      continue;
    }

    if (
      evidenceById.has(
        item.id
      )
    ) {
      errors.push(
        "evidence:duplicate-id:" +
        item.id
      );
    }

    evidenceById.set(
      item.id,
      item
    );

    if (
      !knownEvidenceClasses.has(
        item.class
      )
    ) {
      errors.push(
        "evidence:unknown-class:" +
        String(
          item.class
        )
      );
    }

    if (
      !knownStrengths.has(
        item.strength
      )
    ) {
      errors.push(
        "evidence:unknown-strength:" +
        String(
          item.strength
        )
      );
    }

    if (
      !isNonEmptyString(
        item.source
      )
    ) {
      errors.push(
        "evidence:source-required:" +
        item.id
      );
    }
  }

  const reasons =
    Array.isArray(
      edge.reasons
    )
      ? edge.reasons
      : [];

  if (!reasons.length) {
    errors.push(
      "reasons:at-least-one-required"
    );
  }

  for (
    const reason of reasons
  ) {
    if (
      !isPlainObject(reason) ||
      !isNonEmptyString(
        reason.code
      )
    ) {
      errors.push(
        "reason:code-required"
      );
      continue;
    }

    if (
      !knownRelationTypes.has(
        reason.relationType
      )
    ) {
      errors.push(
        "reason:unknown-relation:" +
        String(
          reason.relationType
        )
      );
    }

    if (
      !relationTypes.includes(
        reason.relationType
      )
    ) {
      errors.push(
        "reason:not-declared:" +
        reason.relationType
      );
    }

    const refs =
      Array.isArray(
        reason.evidenceRefs
      )
        ? reason.evidenceRefs
        : [];

    if (!refs.length) {
      errors.push(
        "reason:evidence-required:" +
        reason.code
      );
    }

    for (
      const ref of refs
    ) {
      if (
        !evidenceById.has(
          ref
        )
      ) {
        errors.push(
          "reason:unknown-evidence:" +
          String(ref)
        );
      }
    }
  }

  for (
    const relationType of
    relationTypes
  ) {
    const requirements =
      RELATION_EVIDENCE_REQUIREMENTS[
        relationType
      ];

    if (!requirements) {
      continue;
    }

    const linkedEvidence =
      reasons
        .filter(
          reason =>
            reason.relationType ===
            relationType
        )
        .flatMap(
          reason =>
            reason.evidenceRefs ||
            []
        )
        .map(
          ref =>
            evidenceById.get(ref)
        )
        .filter(Boolean);

    if (
      !linkedEvidence.length
    ) {
      errors.push(
        "relation:evidence-missing:" +
        relationType
      );
      continue;
    }

    if (
      !linkedEvidence.some(
        item =>
          evidenceClassSatisfies(
            item.class,
            requirements.minimumClass
          )
      )
    ) {
      errors.push(
        "relation:evidence-too-weak:" +
        relationType
      );
    }

    if (
      requirements
        .requiresStructuredIdentity &&
      !linkedEvidence.some(
        item =>
          Boolean(
            item.structuredIdentity
          )
      )
    ) {
      errors.push(
        "relation:structured-identity-required:" +
        relationType
      );
    }

    if (
      requirements
        .requiresExplicitBibliographicEdge &&
      !linkedEvidence.some(
        item =>
          Boolean(
            item.explicitBibliographicEdge
          )
      )
    ) {
      errors.push(
        "relation:explicit-bibliographic-edge-required:" +
        relationType
      );
    }
  }

  const signals =
    isPlainObject(
      edge.signals
    )
      ? edge.signals
      : {};

  for (
    const [name, value] of
    Object.entries(signals)
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      continue;
    }

    if (
      typeof value ===
        "number" &&
      !isFiniteUnit(value)
    ) {
      errors.push(
        "signals:not-unit:" +
        name
      );
    }
  }

  if (
    relationTypes.includes(
      RELATION_TYPES
        .HISTORICAL_CONTEXT
    ) &&
    relationTypes.length === 1
  ) {
    errors.push(
      "relation:historical-only-forbidden"
    );
  }

  if (
    isPlainObject(
      edge.identity
    ) &&
    edge.identity.sameIntellectualWork ===
      true
  ) {
    errors.push(
      "edge:same-work-version-forbidden"
    );
  }

  return {
    ok:
      errors.length === 0,
    errors
  };
}


export function assertRelatedWorkEdge(
  edge
) {
  const result =
    validateRelatedWorkEdge(
      edge
    );

  if (!result.ok) {
    throw new TypeError(
      "Invalid RelatedWorkEdge: " +
      result.errors.join(", ")
    );
  }

  return edge;
}

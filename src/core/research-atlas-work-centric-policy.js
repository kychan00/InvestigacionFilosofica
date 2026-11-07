export const RESEARCH_ATLAS_WORK_CENTRIC_POLICY_SCHEMA =
  "research-atlas-work-centric-policy-v1";

export const RESEARCH_ATLAS_WORK_CENTRIC_POLICY_REVISION =
  "2026-11-07.ra11-v1";


function object(value) {
  return (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );
}


function nonEmpty(value) {
  return (
    typeof value ===
      "string" &&
    value.trim().length >
      0
  );
}


export function validateResearchAtlasWorkCentricPolicy(
  config
) {
  const errors = [];

  if (!object(config)) {
    return {
      ok: false,
      errors: [
        "policy:not-object"
      ]
    };
  }

  if (
    config.schemaVersion !==
    RESEARCH_ATLAS_WORK_CENTRIC_POLICY_SCHEMA
  ) {
    errors.push(
      "policy:schema-invalid"
    );
  }

  if (
    !nonEmpty(
      config.revision
    )
  ) {
    errors.push(
      "policy:revision-required"
    );
  }

  const core =
    config.coreTopology;

  if (!object(core)) {
    errors.push(
      "policy:core-topology-required"
    );
  } else {
    if (
      core.entity !==
      "work"
    ) {
      errors.push(
        "policy:core-entity-must-be-work"
      );
    }

    if (
      core.authorityRequired !==
      false
    ) {
      errors.push(
        "policy:authority-must-not-block-core"
      );
    }

    if (
      core.relatedWorkRequired !==
      false
    ) {
      errors.push(
        "policy:related-work-must-not-block-core"
      );
    }

    if (
      core.titleRequired !==
      true
    ) {
      errors.push(
        "policy:title-required"
      );
    }

    if (
      core.abstractPreferred !==
      true
    ) {
      errors.push(
        "policy:abstract-must-be-preferred"
      );
    }

    if (
      core.textualFallback
        ?.method !==
      "title-abstract-tfidf-v1"
    ) {
      errors.push(
        "policy:textual-method-invalid"
      );
    }

    if (
      core.semanticPriority
        ?.metric !==
      "cosine"
    ) {
      errors.push(
        "policy:semantic-metric-invalid"
      );
    }

    if (
      core.semanticPriority
        ?.supersedesTextualFallbackForSamePair !==
      true
    ) {
      errors.push(
        "policy:semantic-must-supersede-textual-for-same-pair"
      );
    }
  }

  const authors =
    config.authors;

  if (!object(authors)) {
    errors.push(
      "policy:authors-required"
    );
  } else {
    if (
      authors.displaySourceReportedNames !==
      true ||
      authors.identityResolutionRequiredForDisplay !==
      false
    ) {
      errors.push(
        "policy:source-authors-must-be-displayable-without-resolution"
      );
    }

    if (
      authors.nameEqualityMayMergePeople !==
      false
    ) {
      errors.push(
        "policy:name-only-person-merge-forbidden"
      );
    }

    if (
      authors.authorityIsOptionalEnrichment !==
      true
    ) {
      errors.push(
        "policy:authority-must-be-optional-enrichment"
      );
    }
  }

  const launch =
    config.launch;

  if (!object(launch)) {
    errors.push(
      "policy:launch-required"
    );
  } else {
    if (
      launch.requiresAuthorHumanAudit !==
      false
    ) {
      errors.push(
        "policy:human-audit-must-not-block-atlas-launch"
      );
    }

    if (
      launch.requiresRelatedWorkFullIndex !==
      false
    ) {
      errors.push(
        "policy:related-work-must-not-block-atlas-launch"
      );
    }

    if (
      launch.requiresWorkTopology !==
      true
    ) {
      errors.push(
        "policy:work-topology-required"
      );
    }
  }

  return {
    ok:
      errors.length ===
      0,
    errors
  };
}


export function evaluateResearchAtlasWorkCentricPolicy(
  config
) {
  const validation =
    validateResearchAtlasWorkCentricPolicy(
      config
    );

  return {
    schemaVersion:
      "research-atlas-work-centric-policy-report-v1",
    revision:
      config?.revision ||
      null,
    valid:
      validation.ok,
    coreAtlasReady:
      validation.ok &&
      config.coreTopology
        ?.entity ===
        "work" &&
      config.launch
        ?.requiresWorkTopology ===
        true,
    authorAuthorityBlocking:
      config?.launch
        ?.requiresAuthorHumanAudit ===
        true,
    relatedWorkBlocking:
      config?.launch
        ?.requiresRelatedWorkFullIndex ===
        true,
    textualFallback:
      config?.coreTopology
        ?.textualFallback ||
      null,
    semanticPriority:
      config?.coreTopology
        ?.semanticPriority ||
      null,
    errors:
      validation.errors
  };
}

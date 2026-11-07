export const RESEARCH_ATLAS_ENRICHMENT_READINESS_SCHEMA =
  "research-atlas-enrichment-readiness-v1";

export const RESEARCH_ATLAS_ENRICHMENT_READINESS_REVISION =
  "2026-11-07.ra10-v1";


function nonEmpty(value) {
  return (
    typeof value ===
      "string" &&
    value.trim().length >
      0
  );
}


function sha256(value) {
  return (
    typeof value ===
      "string" &&
    /^[a-f0-9]{64}$/i.test(
      value
    )
  );
}


function validatePublication(
  publication,
  label
) {
  const errors = [];

  if (
    !publication ||
    typeof publication !==
      "object"
  ) {
    return [
      label +
      " publication is required"
    ];
  }

  if (
    publication.published ===
    true
  ) {
    if (
      !nonEmpty(
        publication.repo
      )
    ) {
      errors.push(
        label +
        " publication repo is required"
      );
    }

    if (
      publication.repoType !==
      "dataset"
    ) {
      errors.push(
        label +
        " publication repoType must be dataset"
      );
    }

    if (
      !nonEmpty(
        publication.pathPrefix
      )
    ) {
      errors.push(
        label +
        " publication pathPrefix is required"
      );
    }

    if (
      !nonEmpty(
        publication.revision
      )
    ) {
      errors.push(
        label +
        " publication revision is required"
      );
    }

    if (
      !nonEmpty(
        publication.baseUrl
      )
    ) {
      errors.push(
        label +
        " publication baseUrl is required"
      );
    }

    if (
      !sha256(
        publication.manifestSha256
      )
    ) {
      errors.push(
        label +
        " publication manifestSha256 is required"
      );
    }
  }

  return errors;
}


export function validateResearchAtlasEnrichmentReadiness(
  config
) {
  const errors = [];

  if (
    !config ||
    typeof config !==
      "object"
  ) {
    return {
      ok:
        false,
      errors: [
        "readiness config is required"
      ]
    };
  }

  if (
    config.schemaVersion !==
    RESEARCH_ATLAS_ENRICHMENT_READINESS_SCHEMA
  ) {
    errors.push(
      "unsupported readiness schema"
    );
  }

  if (
    !nonEmpty(
      config.revision
    )
  ) {
    errors.push(
      "readiness revision is required"
    );
  }

  const authority =
    config.authorAuthority;

  if (
    !authority ||
    typeof authority !==
      "object"
  ) {
    errors.push(
      "authorAuthority is required"
    );
  } else {
    if (
      !sha256(
        authority.source
          ?.releaseSha256
      )
    ) {
      errors.push(
        "authorAuthority source releaseSha256 is invalid"
      );
    }

    if (
      authority.massBenchmark
        ?.passed ===
        true
    ) {
      if (
        authority.massBenchmark
          .falseMergeGroups !==
          0 ||
        authority.massBenchmark
          .falseSplitGroups !==
          0 ||
        authority.massBenchmark
          .unmappedProfiles !==
          0 ||
        authority.massBenchmark
          .exactSourceCoverage !==
          true
      ) {
        errors.push(
          "authorAuthority mass benchmark cannot be marked passed with failing invariants"
        );
      }
    }

    if (
      authority.humanAudit
        ?.gatePassed ===
        true
    ) {
      if (
        authority.humanAudit
          .judgmentsVersioned !==
          true
      ) {
        errors.push(
          "authorAuthority human audit requires versioned judgments"
        );
      }

      if (
        authority.humanAudit
          .falseMergeCount !==
          0
      ) {
        errors.push(
          "authorAuthority human audit gate requires zero false merges"
        );
      }

      if (
        !sha256(
          authority.humanAudit
            .sampleSha256
        )
      ) {
        errors.push(
          "authorAuthority human audit sampleSha256 is invalid"
        );
      }
    }

    errors.push(
      ...validatePublication(
        authority.publication,
        "authorAuthority"
      )
    );

    if (
      authority.publication
        ?.published ===
        true &&
      !sha256(
        authority.publication
          .registrySha256
      )
    ) {
      errors.push(
        "authorAuthority publication registrySha256 is required"
      );
    }
  }

  const related =
    config.relatedWork;

  if (
    !related ||
    typeof related !==
      "object"
  ) {
    errors.push(
      "relatedWork is required"
    );
  } else {
    for (
      const [
        key,
        value
      ] of [
        [
          "faissSha256",
          related.source
            ?.faissSha256
        ],
        [
          "metadataSqliteSha256",
          related.source
            ?.metadataSqliteSha256
        ],
        [
          "staticManifestSha256",
          related.source
            ?.staticManifestSha256
        ]
      ]
    ) {
      if (
        !sha256(
          value
        )
      ) {
        errors.push(
          "relatedWork source " +
          key +
          " is invalid"
        );
      }
    }

    if (
      related.fullBuild
        ?.validated ===
        true
    ) {
      if (
        related.fullBuild
          .originalFaissRecoverable !==
          true ||
        related.fullBuild
          .built !==
          true ||
        !sha256(
          related.fullBuild
            .manifestSha256
        )
      ) {
        errors.push(
          "relatedWork validated full build requires exact recoverable FAISS, build and manifest SHA"
        );
      }
    }

    errors.push(
      ...validatePublication(
        related.publication,
        "relatedWork"
      )
    );
  }

  return {
    ok:
      errors.length ===
      0,
    errors
  };
}


function authorityBlockers(
  config
) {
  const authority =
    config.authorAuthority;

  const blockers = [];

  if (
    authority.massBenchmark
      ?.passed !==
      true
  ) {
    blockers.push(
      "mass-benchmark-not-passed"
    );
  }

  if (
    authority.humanAudit
      ?.judgmentsVersioned !==
      true
  ) {
    blockers.push(
      "human-audit-judgments-not-versioned"
    );
  }

  if (
    authority.humanAudit
      ?.gatePassed !==
      true
  ) {
    blockers.push(
      "human-audit-gate-not-passed"
    );
  }

  if (
    authority.humanAudit
      ?.falseMergeCount !==
      0
  ) {
    blockers.push(
      "human-audit-zero-false-merges-not-established"
    );
  }

  if (
    authority.publication
      ?.published !==
      true
  ) {
    blockers.push(
      "authority-artifact-not-published"
    );
  }

  if (
    !nonEmpty(
      authority.publication
        ?.revision
    ) ||
    !sha256(
      authority.publication
        ?.manifestSha256
    ) ||
    !sha256(
      authority.publication
        ?.registrySha256
    )
  ) {
    blockers.push(
      "authority-publication-not-pinned"
    );
  }

  return blockers;
}


function relatedBlockers(
  config
) {
  const related =
    config.relatedWork;

  const blockers = [];

  if (
    related.fullBuild
      ?.originalFaissRecoverable !==
      true
  ) {
    blockers.push(
      "original-faiss-not-recoverable"
    );
  }

  if (
    related.fullBuild
      ?.built !==
      true
  ) {
    blockers.push(
      "full-related-work-index-not-built"
    );
  }

  if (
    related.fullBuild
      ?.validated !==
      true
  ) {
    blockers.push(
      "full-related-work-index-not-validated"
    );
  }

  if (
    !sha256(
      related.fullBuild
        ?.manifestSha256
    )
  ) {
    blockers.push(
      "full-related-work-manifest-not-pinned"
    );
  }

  if (
    related.publication
      ?.published !==
      true
  ) {
    blockers.push(
      "related-work-artifact-not-published"
    );
  }

  if (
    !nonEmpty(
      related.publication
        ?.revision
    ) ||
    !sha256(
      related.publication
        ?.manifestSha256
    )
  ) {
    blockers.push(
      "related-work-publication-not-pinned"
    );
  }

  return blockers;
}


export function evaluateResearchAtlasEnrichmentReadiness(
  config
) {
  const validation =
    validateResearchAtlasEnrichmentReadiness(
      config
    );

  if (!validation.ok) {
    return {
      schemaVersion:
        "research-atlas-enrichment-readiness-report-v1",
      revision:
        config?.revision ||
        null,
      valid:
        false,
      ready:
        false,
      authorAuthority: {
        ready:
          false,
        blockers: []
      },
      relatedWork: {
        ready:
          false,
        blockers: []
      },
      validationErrors:
        validation.errors
    };
  }

  const authority =
    authorityBlockers(
      config
    );

  const related =
    relatedBlockers(
      config
    );

  const authorityPrepublicationBlockers =
    authority.filter(
      blocker =>
        blocker !==
          "authority-artifact-not-published" &&
        blocker !==
          "authority-publication-not-pinned"
    );

  const relatedPrepublicationBlockers =
    related.filter(
      blocker =>
        blocker !==
          "related-work-artifact-not-published" &&
        blocker !==
          "related-work-publication-not-pinned"
    );

  return {
    schemaVersion:
      "research-atlas-enrichment-readiness-report-v1",
    revision:
      config.revision,
    valid:
      true,
    ready:
      authority.length ===
        0 &&
      related.length ===
        0,
    authorAuthority: {
      prepublicationReady:
        authorityPrepublicationBlockers
          .length ===
        0,
      prepublicationBlockers:
        authorityPrepublicationBlockers,
      ready:
        authority.length ===
        0,
      blockers:
        authority
    },
    relatedWork: {
      prepublicationReady:
        relatedPrepublicationBlockers
          .length ===
        0,
      prepublicationBlockers:
        relatedPrepublicationBlockers,
      ready:
        related.length ===
        0,
      blockers:
        related
    },
    validationErrors: []
  };
}


export function assertResearchAtlasEnrichmentActivation(
  config,
  {
    authorAuthority =
      false,
    relatedWork =
      false
  } = {}
) {
  const report =
    evaluateResearchAtlasEnrichmentReadiness(
      config
    );

  if (!report.valid) {
    throw new TypeError(
      "Research Atlas enrichment readiness config is invalid: " +
      report.validationErrors.join(
        ", "
      )
    );
  }

  if (
    authorAuthority &&
    !report.authorAuthority
      .ready
  ) {
    throw new Error(
      "Author Authority activation is blocked: " +
      report.authorAuthority
        .blockers
        .join(
          ", "
        )
    );
  }

  if (
    relatedWork &&
    !report.relatedWork
      .ready
  ) {
    throw new Error(
      "Related Work activation is blocked: " +
      report.relatedWork
        .blockers
        .join(
          ", "
        )
    );
  }

  return report;
}

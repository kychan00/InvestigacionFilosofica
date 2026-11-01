export const AUTHORITY_HUMAN_AUDIT_SCHEMA_VERSION =
  "author-authority-human-audit-v1";

export const AUTHORITY_HUMAN_AUDIT_SAMPLE_SIZE = 100;

export const AUTHORITY_HUMAN_AUDIT_LABELS = Object.freeze([
  "same-person",
  "different-person",
  "unresolved"
]);

function array(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function stringId(value) {
  return String(value ?? "").trim();
}

function byAuthorId(left, right) {
  return stringId(left?.authorId).localeCompare(
    stringId(right?.authorId)
  );
}

function blindProfile(profile = {}) {
  return {
    authorId: stringId(profile.authorId),
    name: profile.name || null
  };
}

function hiddenProfile(profile = {}) {
  return {
    authorId: stringId(profile.authorId),
    orcid: profile.orcid || null
  };
}

function addPair(output, {
  stratum,
  left,
  right,
  currentRelation,
  sourceGroup
}) {
  const auditId =
    "AAH" + String(output.sample.length + 1).padStart(3, "0");

  output.sample.push({
    audit_id: auditId,
    stratum,
    left: blindProfile(left),
    right: blindProfile(right),
    judgment: null,
    note: ""
  });

  output.manifestItems.push({
    audit_id: auditId,
    stratum,
    source_group: sourceGroup || null,
    current_relation: currentRelation,
    left: hiddenProfile(left),
    right: hiddenProfile(right)
  });
}

function firstTwo(profiles = []) {
  const sorted = [...profiles].sort(byAuthorId);
  return [sorted[0], sorted[1]];
}

function mixedPair(profiles = []) {
  const anchored = profiles
    .filter(profile => Boolean(profile?.orcid))
    .sort(byAuthorId);
  const unanchored = profiles
    .filter(profile => !profile?.orcid)
    .sort(byAuthorId);

  if (anchored.length && unanchored.length) {
    return [anchored[0], unanchored[0]];
  }

  return firstTwo(profiles);
}

export function selectHumanAuthorityAuditPairs({
  benchmarkReport
} = {}) {
  const collisions =
    benchmarkReport?.nameCollisions?.sample || {};
  const multiId =
    benchmarkReport?.auditSample?.strata
      ?.multiOpenAlexIdCandidates || [];

  const output = {
    sample: [],
    manifestItems: []
  };

  for (const candidate of multiId) {
    const ids = array(candidate.authorIds)
      .map(stringId)
      .filter(Boolean)
      .sort();

    if (ids.length !== 2) {
      throw new Error(
        "Human audit V1 requires pairwise multi-ID candidates"
      );
    }

    const orcid = array(candidate.orcids)[0] || null;

    addPair(output, {
      stratum: "automatic-merge-shared-orcid",
      left: {
        authorId: ids[0],
        name: candidate.canonicalName || null,
        orcid
      },
      right: {
        authorId: ids[1],
        name: candidate.canonicalName || null,
        orcid
      },
      currentRelation: "same-person",
      sourceGroup: candidate.candidateRef
    });
  }

  for (
    const collision of
      array(collisions["distinct-orcid-homonym"]).slice(0, 20)
  ) {
    const [left, right] = firstTwo(collision.profiles);
    addPair(output, {
      stratum: "distinct-orcid-homonym",
      left,
      right,
      currentRelation: "different-person",
      sourceGroup: collision.normalizedName
    });
  }

  for (
    const collision of
      array(collisions["anchorless-homonym"]).slice(0, 34)
  ) {
    const [left, right] = firstTwo(collision.profiles);
    addPair(output, {
      stratum: "anchorless-homonym",
      left,
      right,
      currentRelation: "different-person",
      sourceGroup: collision.normalizedName
    });
  }

  for (
    const collision of
      array(collisions["mixed-anchor-homonym"]).slice(0, 33)
  ) {
    const [left, right] = mixedPair(collision.profiles);
    addPair(output, {
      stratum: "mixed-anchor-homonym",
      left,
      right,
      currentRelation: "different-person",
      sourceGroup: collision.normalizedName
    });
  }

  if (output.sample.length !== AUTHORITY_HUMAN_AUDIT_SAMPLE_SIZE) {
    throw new Error(
      "Expected " +
      AUTHORITY_HUMAN_AUDIT_SAMPLE_SIZE +
      " audit pairs, got " +
      output.sample.length
    );
  }

  const authorIds = new Set();
  for (const item of output.sample) {
    authorIds.add(item.left.authorId);
    authorIds.add(item.right.authorId);
  }

  if (authorIds.size !== AUTHORITY_HUMAN_AUDIT_SAMPLE_SIZE * 2) {
    throw new Error(
      "Human audit V1 requires 200 unique profile IDs"
    );
  }

  return {
    ...output,
    counts: {
      pairs: output.sample.length,
      uniqueProfiles: authorIds.size,
      byStratum: output.sample.reduce((acc, item) => {
        acc[item.stratum] = (acc[item.stratum] || 0) + 1;
        return acc;
      }, {})
    }
  };
}

export function humanAuditSampleJsonl(sample = []) {
  return sample
    .map(row => JSON.stringify(row))
    .join("\n") + "\n";
}

export function normalizeHumanAuthorityJudgments(
  rows = []
) {
  return rows.map((row, index) => {
    const auditId = String(row?.audit_id || "").trim();
    const judgment = String(row?.judgment || "").trim();
    const note = String(row?.note || "").trim();

    if (!auditId) {
      throw new Error(
        "Missing audit_id at judgment row " + (index + 1)
      );
    }

    if (!AUTHORITY_HUMAN_AUDIT_LABELS.includes(judgment)) {
      throw new Error(
        "Invalid judgment for " +
        auditId +
        ": " +
        judgment
      );
    }

    return {
      audit_id: auditId,
      judgment,
      note,
      evidence: array(row?.evidence)
        .map(value => String(value).trim())
        .filter(Boolean),
      judged_at: row?.judged_at || null
    };
  });
}

export function evaluateHumanAuthorityAudit({
  sample = [],
  manifestItems = [],
  judgments = [],
  minimumResolved = 80
} = {}) {
  const normalized = normalizeHumanAuthorityJudgments(judgments);
  const sampleById = new Map(
    sample.map(item => [item.audit_id, item])
  );
  const manifestById = new Map(
    manifestItems.map(item => [item.audit_id, item])
  );
  const judgmentById = new Map();

  for (const judgment of normalized) {
    if (judgmentById.has(judgment.audit_id)) {
      throw new Error(
        "Duplicate judgment: " + judgment.audit_id
      );
    }
    if (!sampleById.has(judgment.audit_id)) {
      throw new Error(
        "Unknown audit_id: " + judgment.audit_id
      );
    }
    judgmentById.set(judgment.audit_id, judgment);
  }

  const result = {
    total: sample.length,
    judged: normalized.length,
    resolved: 0,
    unresolved: 0,
    agreement: 0,
    falseMergeCount: 0,
    falseSplitCount: 0,
    automaticMergePairs: 0,
    automaticMergePairsResolved: 0,
    separatePairs: 0,
    separatePairsResolved: 0,
    byStratum: {},
    disagreements: [],
    unresolvedItems: []
  };

  for (const sampleItem of sample) {
    const manifest = manifestById.get(sampleItem.audit_id);
    if (!manifest) {
      throw new Error(
        "Missing manifest item: " + sampleItem.audit_id
      );
    }

    const current = manifest.current_relation;
    if (current === "same-person") {
      result.automaticMergePairs++;
    } else if (current === "different-person") {
      result.separatePairs++;
    } else {
      throw new Error(
        "Invalid current relation for " + sampleItem.audit_id
      );
    }

    const judgment = judgmentById.get(sampleItem.audit_id);
    if (!judgment) continue;

    const stratum = sampleItem.stratum;
    const bucket = result.byStratum[stratum] || {
      total: 0,
      judged: 0,
      resolved: 0,
      unresolved: 0,
      agreement: 0,
      falseMergeCount: 0,
      falseSplitCount: 0
    };
    bucket.total++;
    bucket.judged++;

    if (judgment.judgment === "unresolved") {
      result.unresolved++;
      bucket.unresolved++;
      result.unresolvedItems.push({
        audit_id: sampleItem.audit_id,
        stratum,
        note: judgment.note
      });
      result.byStratum[stratum] = bucket;
      continue;
    }

    result.resolved++;
    bucket.resolved++;

    if (current === "same-person") {
      result.automaticMergePairsResolved++;
    } else {
      result.separatePairsResolved++;
    }

    if (judgment.judgment === current) {
      result.agreement++;
      bucket.agreement++;
    } else if (
      current === "same-person" &&
      judgment.judgment === "different-person"
    ) {
      result.falseMergeCount++;
      bucket.falseMergeCount++;
      result.disagreements.push({
        audit_id: sampleItem.audit_id,
        kind: "false-merge",
        stratum,
        note: judgment.note
      });
    } else if (
      current === "different-person" &&
      judgment.judgment === "same-person"
    ) {
      result.falseSplitCount++;
      bucket.falseSplitCount++;
      result.disagreements.push({
        audit_id: sampleItem.audit_id,
        kind: "false-split",
        stratum,
        note: judgment.note
      });
    }

    result.byStratum[stratum] = bucket;
  }

  for (const item of sample) {
    const bucket = result.byStratum[item.stratum] || {
      total: 0,
      judged: 0,
      resolved: 0,
      unresolved: 0,
      agreement: 0,
      falseMergeCount: 0,
      falseSplitCount: 0
    };
    if (!bucket._counted) {
      bucket.total = sample.filter(
        row => row.stratum === item.stratum
      ).length;
      bucket._counted = true;
      result.byStratum[item.stratum] = bucket;
    }
  }

  for (const bucket of Object.values(result.byStratum)) {
    delete bucket._counted;
    bucket.agreementRate = bucket.resolved
      ? bucket.agreement / bucket.resolved
      : null;
  }

  result.agreementRate = result.resolved
    ? result.agreement / result.resolved
    : null;
  result.unresolvedRate = result.judged
    ? result.unresolved / result.judged
    : null;
  result.humanFalseMergeRate =
    result.automaticMergePairsResolved
      ? result.falseMergeCount /
        result.automaticMergePairsResolved
      : null;
  result.humanFalseSplitRate =
    result.separatePairsResolved
      ? result.falseSplitCount /
        result.separatePairsResolved
      : null;

  const failures = [];

  if (result.judged < sample.length) {
    failures.push({
      metric: "judged",
      actual: result.judged,
      threshold: sample.length
    });
  }

  if (result.resolved < minimumResolved) {
    failures.push({
      metric: "resolved",
      actual: result.resolved,
      threshold: minimumResolved
    });
  }

  if (
    result.automaticMergePairsResolved <
    result.automaticMergePairs
  ) {
    failures.push({
      metric: "automaticMergePairsResolved",
      actual: result.automaticMergePairsResolved,
      threshold: result.automaticMergePairs
    });
  }

  if (result.falseMergeCount > 0) {
    failures.push({
      metric: "falseMergeCount",
      actual: result.falseMergeCount,
      threshold: 0
    });
  }

  result.gate = {
    passed: failures.length === 0,
    failures,
    policy: {
      minimumResolved,
      requireAllJudged: true,
      requireAllAutomaticMergesResolved: true,
      falseMergeCount: 0,
      falseSplitRate: "reported-not-blocking-v1"
    }
  };

  return result;
}

export function promoteHumanAuthorityGold({
  sample = [],
  manifestItems = [],
  judgments = []
} = {}) {
  const normalized = normalizeHumanAuthorityJudgments(judgments);
  const sampleById = new Map(
    sample.map(item => [item.audit_id, item])
  );
  const manifestById = new Map(
    manifestItems.map(item => [item.audit_id, item])
  );

  return normalized
    .filter(item => item.judgment !== "unresolved")
    .map(item => {
      const sampleItem = sampleById.get(item.audit_id);
      const manifest = manifestById.get(item.audit_id);
      if (!sampleItem || !manifest) {
        throw new Error(
          "Missing audit sample/manifest for " + item.audit_id
        );
      }

      return {
        schemaVersion:
          "author-authority-human-gold-pair-v1",
        audit_id: item.audit_id,
        relation: item.judgment,
        left: {
          authorId: sampleItem.left.authorId,
          name: sampleItem.left.name
        },
        right: {
          authorId: sampleItem.right.authorId,
          name: sampleItem.right.name
        },
        stratum: sampleItem.stratum,
        note: item.note,
        evidence: item.evidence,
        judged_at: item.judged_at
      };
    });
}

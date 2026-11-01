import {
  normalizeAuthorName
} from "./remote-author-resolution.js";

export const AUTHORITY_BENCHMARK_SCHEMA_VERSION =
  "author-authority-benchmark-v1";

function array(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function validOrcid(value) {
  const normalized = String(value || "")
    .replace(/^https?:\/\/orcid\.org\//i, "")
    .trim()
    .toUpperCase();

  return /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/.test(normalized)
    ? normalized
    : null;
}

function fnv1a(value) {
  let result = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(String(value))) {
    result ^= byte;
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result;
}

function stableScore(value, seed) {
  return fnv1a(String(seed) + "|" + String(value));
}

function profileId(profile = {}) {
  return String(profile.id || "").trim();
}

function expectedIdentityKey(profile = {}) {
  const orcid = validOrcid(profile.o || profile.orcid);
  return orcid
    ? "orcid:" + orcid
    : "openalex-author:" + profileId(profile);
}

function nameKey(profile = {}) {
  return normalizeAuthorName(
    profile.n ||
    profile.name ||
    profile.displayName ||
    ""
  );
}

function candidateRefFor(profile, authorIdToCandidateRef = {}) {
  return authorIdToCandidateRef[profileId(profile)] || null;
}

function groupBy(items, keyFn) {
  const output = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const values = output.get(key) || [];
    values.push(item);
    output.set(key, values);
  }
  return output;
}

function sample(items, {
  size = 50,
  seed = 20261101,
  key = item => JSON.stringify(item)
} = {}) {
  return [...items]
    .map(item => ({
      item,
      score: stableScore(key(item), seed)
    }))
    .sort((a, b) =>
      a.score - b.score ||
      String(key(a.item)).localeCompare(String(key(b.item)))
    )
    .slice(0, Math.max(0, size))
    .map(entry => entry.item);
}

function hasDiacritic(value) {
  const text = String(value || "");
  return text.normalize("NFD") !==
    text.normalize("NFD").replace(/\p{M}/gu, "");
}

function hasInitial(value) {
  return String(value || "")
    .split(/[\s,-]+/)
    .some(token => /^[\p{L}]\.?$/u.test(token.trim()));
}

function tokenCount(value) {
  return normalizeAuthorName(value)
    .split(" ")
    .filter(Boolean)
    .length;
}

function summarizeProfiles(profiles, authorIdToCandidateRef) {
  return profiles.map(profile => ({
    authorId: profileId(profile),
    name: profile.n || null,
    orcid: validOrcid(profile.o || profile.orcid),
    corpusWorks: Number(profile.cw || 0),
    candidateRef: candidateRefFor(
      profile,
      authorIdToCandidateRef
    ),
    expectedIdentityKey: expectedIdentityKey(profile)
  }));
}

export function evaluateSilverIdentityPartition({
  profiles = [],
  authorIdToCandidateRef = {}
} = {}) {
  const expectedGroups = groupBy(
    profiles,
    expectedIdentityKey
  );
  const actualGroups = groupBy(
    profiles,
    profile => candidateRefFor(
      profile,
      authorIdToCandidateRef
    )
  );

  const falseSplitGroups = [];
  for (const [expectedKey, members] of expectedGroups) {
    if (!expectedKey.startsWith("orcid:")) continue;
    if (members.length < 2) continue;

    const candidateRefs = unique(
      members.map(profile =>
        candidateRefFor(profile, authorIdToCandidateRef)
      )
    );

    if (
      candidateRefs.length !== 1 ||
      members.some(profile =>
        !candidateRefFor(profile, authorIdToCandidateRef)
      )
    ) {
      falseSplitGroups.push({
        expectedIdentityKey: expectedKey,
        authorIds: members.map(profileId).sort(),
        candidateRefs: candidateRefs.sort()
      });
    }
  }

  const falseMergeGroups = [];
  for (const [candidateRef, members] of actualGroups) {
    const expectedKeys = unique(
      members.map(expectedIdentityKey)
    );

    if (expectedKeys.length > 1) {
      falseMergeGroups.push({
        candidateRef,
        expectedIdentityKeys: expectedKeys.sort(),
        authorIds: members.map(profileId).sort()
      });
    }
  }

  const sharedOrcidGroups = [...expectedGroups.entries()]
    .filter(([key, members]) =>
      key.startsWith("orcid:") && members.length > 1
    )
    .map(([key, members]) => ({
      orcid: key.slice("orcid:".length),
      authorIds: members.map(profileId).sort(),
      names: unique(members.map(profile => profile.n)).sort(),
      candidateRefs: unique(
        members.map(profile =>
          candidateRefFor(profile, authorIdToCandidateRef)
        )
      ).sort()
    }));

  return {
    profilesEvaluated: profiles.length,
    expectedIdentityGroups: expectedGroups.size,
    actualCandidateGroups: actualGroups.size,
    sharedOrcidGroups: sharedOrcidGroups.length,
    sharedOrcidAuthorIds: sharedOrcidGroups.reduce(
      (sum, group) => sum + group.authorIds.length,
      0
    ),
    falseMergeCount: falseMergeGroups.length,
    falseSplitCount: falseSplitGroups.length,
    falseMergeGroups,
    falseSplitGroups
  };
}

export function analyzeNameCollisions({
  profiles = [],
  authorIdToCandidateRef = {},
  sampleSize = 100,
  seed = 20261101
} = {}) {
  const groups = groupBy(profiles, nameKey);
  const collisions = [];

  for (const [normalizedName, members] of groups) {
    if (members.length < 2) continue;

    const expectedKeys = unique(
      members.map(expectedIdentityKey)
    );
    if (expectedKeys.length < 2) continue;

    const validOrcids = unique(
      members.map(profile =>
        validOrcid(profile.o || profile.orcid)
      )
    );

    const allHaveOrcid = members.every(profile =>
      Boolean(validOrcid(profile.o || profile.orcid))
    );
    const noneHaveOrcid = members.every(profile =>
      !validOrcid(profile.o || profile.orcid)
    );

    const stratum = allHaveOrcid
      ? "distinct-orcid-homonym"
      : noneHaveOrcid
        ? "anchorless-homonym"
        : "mixed-anchor-homonym";

    const actualRefs = unique(
      members.map(profile =>
        candidateRefFor(profile, authorIdToCandidateRef)
      )
    );

    collisions.push({
      normalizedName,
      stratum,
      profileCount: members.length,
      expectedIdentityCount: expectedKeys.length,
      actualCandidateCount: actualRefs.length,
      validOrcids: validOrcids.sort(),
      profiles: summarizeProfiles(
        members,
        authorIdToCandidateRef
      )
    });
  }

  const counts = {};
  for (const collision of collisions) {
    counts[collision.stratum] =
      (counts[collision.stratum] || 0) + 1;
  }

  const byStratum = {};
  for (const stratum of [
    "distinct-orcid-homonym",
    "anchorless-homonym",
    "mixed-anchor-homonym"
  ]) {
    byStratum[stratum] = sample(
      collisions.filter(item => item.stratum === stratum),
      {
        size: sampleSize,
        seed,
        key: item => item.normalizedName
      }
    );
  }

  return {
    collisionGroups: collisions.length,
    counts,
    sample: byStratum
  };
}

export function buildProfileAuditSample({
  profiles = [],
  groupedCandidates = [],
  sampleSize = 100,
  seed = 20261101
} = {}) {
  const profileRows = profiles.map(profile => ({
    authorId: profileId(profile),
    name: profile.n || null,
    orcid: validOrcid(profile.o || profile.orcid),
    corpusWorks: Number(profile.cw || 0),
    tokens: tokenCount(profile.n),
    hasDiacritic: hasDiacritic(profile.n),
    hasInitial: hasInitial(profile.n)
  }));

  const multiIdRows = groupedCandidates
    .filter(candidate =>
      array(candidate?.sourceMetadata?.authorIds).length > 1
    )
    .map(candidate => ({
      candidateRef: candidate.id,
      canonicalName: candidate.canonicalName,
      authorIds: array(
        candidate?.sourceMetadata?.authorIds
      ).map(String).sort(),
      orcids: unique(
        array(candidate.externalIdentifiers)
          .filter(item => item.scheme === "orcid")
          .map(item => validOrcid(item.normalizedValue))
      ).sort()
    }));

  return {
    strata: {
      diacritics: sample(
        profileRows.filter(row => row.hasDiacritic),
        {
          size: sampleSize,
          seed: seed + 1,
          key: row => row.authorId
        }
      ),
      initials: sample(
        profileRows.filter(row => row.hasInitial),
        {
          size: sampleSize,
          seed: seed + 2,
          key: row => row.authorId
        }
      ),
      multiTokenNames: sample(
        profileRows.filter(row => row.tokens >= 3),
        {
          size: sampleSize,
          seed: seed + 3,
          key: row => row.authorId
        }
      ),
      multiOpenAlexIdCandidates: sample(
        multiIdRows,
        {
          size: sampleSize,
          seed: seed + 4,
          key: row => row.candidateRef
        }
      )
    },
    counts: {
      profiles: profileRows.length,
      diacritics: profileRows.filter(
        row => row.hasDiacritic
      ).length,
      initials: profileRows.filter(
        row => row.hasInitial
      ).length,
      multiTokenNames: profileRows.filter(
        row => row.tokens >= 3
      ).length,
      multiOpenAlexIdCandidates: multiIdRows.length
    }
  };
}

export function evaluateCuratedGoldCases(
  cases = [],
  {
    resolveCuratedIdentity
  } = {}
) {
  if (typeof resolveCuratedIdentity !== "function") {
    throw new TypeError(
      "evaluateCuratedGoldCases requires resolveCuratedIdentity"
    );
  }

  const failures = [];
  const results = [];

  for (const item of cases) {
    const actual = resolveCuratedIdentity(item.input);
    const expectedFound = item.expected?.found !== false;
    const found = Boolean(actual);

    const canonicalMatches =
      !item.expected?.canonicalName ||
      actual?.canonicalName === item.expected.canonicalName;
    const orcidMatches =
      !item.expected?.orcid ||
      validOrcid(actual?.orcid) ===
        validOrcid(item.expected.orcid);

    const passed =
      found === expectedFound &&
      (!expectedFound || (canonicalMatches && orcidMatches));

    const result = {
      id: item.id,
      input: item.input,
      passed,
      expected: item.expected || {},
      actual: actual
        ? {
            canonicalName: actual.canonicalName,
            orcid: validOrcid(actual.orcid)
          }
        : null
    };

    results.push(result);
    if (!passed) failures.push(result);
  }

  return {
    cases: cases.length,
    passed: cases.length - failures.length,
    failed: failures.length,
    failures,
    results
  };
}

export function sourceCoverageCheck({
  sourceManifest = {},
  aggregatedProfiles = 0,
  quarantinedOpenAlexIds = 0
} = {}) {
  const expected = Number(
    sourceManifest?.counts?.resolved_authors || 0
  );
  const observed =
    Number(aggregatedProfiles || 0) +
    Number(quarantinedOpenAlexIds || 0);

  return {
    expectedResolvedAuthors: expected,
    observedResolvedAuthors: observed,
    ratio: expected
      ? observed / expected
      : null,
    exact: expected > 0
      ? observed === expected
      : null
  };
}

export function buildAuthorityBenchmarkReport({
  sourceManifest = {},
  release = null,
  profiles = [],
  aliasConflicts = [],
  grouped = {
    candidates: [],
    authorIdToCandidateRef: {}
  },
  gold = null,
  seed = 20261101,
  sampleSize = 100,
  thresholds = {}
} = {}) {
  const silver = evaluateSilverIdentityPartition({
    profiles,
    authorIdToCandidateRef:
      grouped.authorIdToCandidateRef || {}
  });

  const nameCollisions = analyzeNameCollisions({
    profiles,
    authorIdToCandidateRef:
      grouped.authorIdToCandidateRef || {},
    sampleSize,
    seed
  });

  const auditSample = buildProfileAuditSample({
    profiles,
    groupedCandidates: grouped.candidates || [],
    sampleSize,
    seed
  });

  const coverage = sourceCoverageCheck({
    sourceManifest,
    aggregatedProfiles: profiles.length,
    quarantinedOpenAlexIds: aliasConflicts.length
  });

  const gateThresholds = {
    goldFailures: 0,
    falseMergeGroups: 0,
    falseSplitGroups: 0,
    requireExactSourceCoverage: true,
    ...thresholds
  };

  const failures = [];

  if (
    gold &&
    gold.failed > gateThresholds.goldFailures
  ) {
    failures.push({
      metric: "gold.failed",
      actual: gold.failed,
      threshold: gateThresholds.goldFailures
    });
  }

  if (
    silver.falseMergeCount >
    gateThresholds.falseMergeGroups
  ) {
    failures.push({
      metric: "silver.falseMergeCount",
      actual: silver.falseMergeCount,
      threshold: gateThresholds.falseMergeGroups
    });
  }

  if (
    silver.falseSplitCount >
    gateThresholds.falseSplitGroups
  ) {
    failures.push({
      metric: "silver.falseSplitCount",
      actual: silver.falseSplitCount,
      threshold: gateThresholds.falseSplitGroups
    });
  }

  if (
    gateThresholds.requireExactSourceCoverage &&
    coverage.exact === false
  ) {
    failures.push({
      metric: "coverage.exact",
      actual: coverage,
      threshold: "exact"
    });
  }

  return {
    schemaVersion: AUTHORITY_BENCHMARK_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    seed,
    sampleSize,
    source: {
      release,
      manifest: {
        schemaVersion: sourceManifest.schema_version || null,
        version: sourceManifest.version || null,
        source: sourceManifest.source || null,
        counts: sourceManifest.counts || null
      }
    },
    corpus: {
      aliasProfiles: profiles.length,
      quarantinedAliasConflicts: aliasConflicts.length,
      candidateGroups: array(grouped.candidates).length
    },
    gold,
    silver,
    nameCollisions,
    auditSample,
    coverage,
    gate: {
      thresholds: gateThresholds,
      passed: failures.length === 0,
      failures
    }
  };
}

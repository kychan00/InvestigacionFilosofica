import {
  authorityIdentifiers,
  resolveAuthorMention
} from "./author-authority-resolution.js";
import {
  createDecisionLedger,
  resolutionResultToDecision,
  appendResolutionDecision
} from "./author-resolution-decision-ledger.js";

export const AUTHORITY_GRAPH_SCHEMA_VERSION = "author-authority-graph-v1";

function array(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function identifierKey(identifier = {}) {
  const scheme = String(identifier.scheme || "").trim().toLowerCase();
  const value = String(
    identifier.normalizedValue ??
    identifier.value ??
    identifier.rawValue ??
    ""
  ).trim();
  return scheme && value ? scheme + ":" + value : null;
}

function candidateId(candidate = {}) {
  return String(candidate.id || candidate.authorityId || "").trim();
}

function candidateById(candidates) {
  return new Map(candidates.map(candidate => [candidateId(candidate), candidate]));
}

function canonicalNames(candidate = {}) {
  const values = [
    candidate.canonicalName,
    candidate.displayName,
    candidate.sourceDisplayName,
    ...array(candidate.names).map(item =>
      typeof item === "string" ? item : item?.value
    ),
    ...array(candidate.aliases)
  ].map(value => String(value || "").trim()).filter(Boolean);

  const seen = new Set();
  return values.filter(value => {
    const key = value.toLocaleLowerCase("es");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cloneIdentifier(identifier = {}) {
  return {
    scheme: String(identifier.scheme || "").trim().toLowerCase(),
    rawValue: identifier.rawValue ?? identifier.value ?? null,
    normalizedValue:
      identifier.normalizedValue ??
      identifier.value ??
      identifier.rawValue ??
      null,
    status: identifier.status || "asserted",
    source: identifier.source || null
  };
}

function mergeIdentifiers(left = [], right = []) {
  const output = new Map();
  for (const item of [...left, ...right]) {
    const normalized = cloneIdentifier(item);
    const key = identifierKey(normalized);
    if (!key) continue;
    const current = output.get(key);
    output.set(key, current ? {
      ...current,
      ...normalized,
      source: current.source || normalized.source || null
    } : normalized);
  }
  return [...output.values()].sort((a, b) =>
    identifierKey(a).localeCompare(identifierKey(b))
  );
}

function previousAuthorityMap(previousGraph = {}) {
  return new Map(array(previousGraph.authorities).map(authority => [
    String(authority.id),
    structuredClone(authority)
  ]));
}

function cloneRegistry(registry = {}) {
  return Object.fromEntries(
    Object.entries(registry || {}).map(([key, value]) => [
      String(key),
      String(value)
    ])
  );
}

function deterministicKeys(candidate = {}) {
  return authorityIdentifiers(candidate)
    .map(item => identifierKey(item))
    .filter(Boolean)
    .sort();
}

function allocateAuthority(candidate, {
  identifierRegistry,
  candidateRegistry,
  buildRevision
} = {}) {
  const ref = candidateId(candidate);
  const keys = deterministicKeys(candidate);

  const priorIds = unique([
    candidateRegistry?.[ref],
    ...keys.map(key => identifierRegistry?.[key])
  ].filter(Boolean));

  if (priorIds.length > 1) {
    return {
      status: "registry-conflict",
      authorityId: null,
      conflictingAuthorityIds: priorIds,
      identifierKeys: keys
    };
  }

  if (priorIds.length === 1) {
    return {
      status: "reused",
      authorityId: priorIds[0],
      conflictingAuthorityIds: [],
      identifierKeys: keys
    };
  }

  if (!keys.length) {
    return {
      status: "insufficient-anchor",
      authorityId: null,
      conflictingAuthorityIds: [],
      identifierKeys: []
    };
  }

  // The hash is only the initial opaque allocation seed. Once emitted,
  // identifierRegistry/candidateRegistry freeze the AuthorityPerson.id across
  // later builds even if aliases or identifiers evolve.
  const authorityId = "authority:if:v1:" + fnv1a(
    "seed|" + keys.join("|") + "|" + String(buildRevision || "v1")
  );

  return {
    status: "allocated",
    authorityId,
    conflictingAuthorityIds: [],
    identifierKeys: keys
  };
}

function authorityFromCandidate(candidate, authorityId, {
  existing = null,
  buildRevision,
  decisionRef = null,
  mention = null
} = {}) {
  const names = canonicalNames(candidate);
  const canonicalName =
    String(candidate.canonicalName || names[0] || "Autor sin nombre").trim();

  const base = existing || {
    schemaVersion: "author-authority-data-v1",
    entityType: "AuthorityPerson",
    id: authorityId,
    lifecycleState: "active",
    resolutionState: "confirmed",
    canonicalName,
    names: [],
    externalIdentifiers: [],
    affiliations: [],
    activeRange: null,
    topicSignals: [],
    collaborationRefs: [],
    mergedFrom: [],
    redirectTo: null,
    splitFrom: null,
    supersededBy: [],
    evidenceRefs: [],
    decisionRefs: [],
    sourceRecordRefs: [],
    mentionRefs: [],
    createdInRevision: buildRevision,
    lastEvaluatedInRevision: buildRevision
  };

  const nameMap = new Map(
    array(base.names).map(item => [
      String(item?.value || item || "").toLocaleLowerCase("es"),
      typeof item === "string" ? {value: item, type: "alias"} : {...item}
    ])
  );

  names.forEach((value, index) => {
    const key = value.toLocaleLowerCase("es");
    if (!nameMap.has(key)) {
      nameMap.set(key, {
        value,
        type: index === 0 ? "canonical" : "alias"
      });
    }
  });

  return {
    ...base,
    canonicalName: base.canonicalName || canonicalName,
    resolutionState: "confirmed",
    names: [...nameMap.values()],
    externalIdentifiers: mergeIdentifiers(
      base.externalIdentifiers,
      candidate.externalIdentifiers
    ),
    affiliations: [
      ...array(base.affiliations),
      ...array(candidate.affiliations)
    ],
    decisionRefs: unique([
      ...array(base.decisionRefs),
      decisionRef
    ]),
    sourceRecordRefs: unique([
      ...array(base.sourceRecordRefs),
      mention?.sourceRecordRef
    ]),
    mentionRefs: unique([
      ...array(base.mentionRefs),
      mention?.id
    ]),
    lastEvaluatedInRevision: buildRevision
  };
}

function statusCounts(decisions = []) {
  const output = {
    confirmed: 0,
    probable: 0,
    ambiguous: 0,
    unresolved: 0,
    rejected: 0
  };
  for (const decision of decisions) {
    if (output[decision.status] !== undefined) {
      output[decision.status]++;
    }
  }
  return output;
}

export function evaluateAuthorityBuildAgainstGold(
  resolutions = [],
  goldExpectations = {}
) {
  let evaluated = 0;
  let falseMergeCount = 0;
  let missedConfirmationCount = 0;
  const failures = [];

  for (const entry of resolutions) {
    const expected = goldExpectations?.[entry.mentionRef];
    if (expected === undefined) continue;
    evaluated++;

    const expectedCandidateRef =
      typeof expected === "string"
        ? expected
        : expected?.candidateRef ?? null;
    const expectedStatus =
      typeof expected === "object" && expected
        ? expected.status || null
        : null;

    const actualCandidateRef = entry.candidateRef || null;
    const actualStatus = entry.status;

    const falseMerge =
      actualStatus === "confirmed" &&
      (
        expectedCandidateRef === null ||
        (expectedCandidateRef && actualCandidateRef !== expectedCandidateRef)
      );

    if (falseMerge) {
      falseMergeCount++;
      failures.push({
        mentionRef: entry.mentionRef,
        kind: "false-merge",
        expectedCandidateRef,
        actualCandidateRef,
        actualStatus
      });
    }

    if (
      expectedCandidateRef &&
      expectedStatus === "confirmed" &&
      actualStatus !== "confirmed"
    ) {
      missedConfirmationCount++;
      failures.push({
        mentionRef: entry.mentionRef,
        kind: "missed-confirmation",
        expectedCandidateRef,
        actualCandidateRef,
        actualStatus
      });
    }
  }

  return {
    evaluated,
    falseMergeCount,
    missedConfirmationCount,
    passed: falseMergeCount === 0,
    failures
  };
}

export function validateAuthorityGraph(graph = {}) {
  if (graph.schemaVersion !== AUTHORITY_GRAPH_SCHEMA_VERSION) {
    throw new TypeError("Unsupported Authority Graph schema");
  }

  const authorityIds = new Set();
  for (const authority of array(graph.authorities)) {
    if (!authority?.id) {
      throw new TypeError("AuthorityPerson requires id");
    }
    if (authorityIds.has(authority.id)) {
      throw new TypeError("Duplicate AuthorityPerson id: " + authority.id);
    }
    authorityIds.add(authority.id);
  }

  for (const [key, authorityId] of Object.entries(
    graph.identifierRegistry || {}
  )) {
    if (!key.includes(":")) {
      throw new TypeError("Malformed identifier registry key: " + key);
    }
    if (!authorityIds.has(authorityId)) {
      throw new TypeError(
        "Identifier registry points to unknown authority: " + authorityId
      );
    }
  }

  for (const authorityId of Object.values(graph.candidateRegistry || {})) {
    if (!authorityIds.has(authorityId)) {
      throw new TypeError(
        "Candidate registry points to unknown authority: " + authorityId
      );
    }
  }

  const mentionIds = new Set(array(graph.mentions).map(item => item.id));
  for (const link of array(graph.mentionAuthorityLinks)) {
    if (!mentionIds.has(link.mentionRef)) {
      throw new TypeError("Authority link points to unknown mention");
    }
    if (!authorityIds.has(link.authorityRef)) {
      throw new TypeError("Authority link points to unknown authority");
    }
  }

  return true;
}

export function buildAuthorityGraph({
  candidates = [],
  mentions = [],
  sourceRecords = [],
  previousGraph = null,
  previousLedger = null,
  algorithmVersion = "identity-v1",
  datasetRevision,
  buildRevision,
  goldExpectations = null
} = {}) {
  if (!String(datasetRevision || "").trim()) {
    throw new TypeError("buildAuthorityGraph requires datasetRevision");
  }
  if (!String(buildRevision || "").trim()) {
    throw new TypeError("buildAuthorityGraph requires buildRevision");
  }

  const candidateMap = candidateById(candidates);
  const authorityMap = previousAuthorityMap(previousGraph);
  const identifierRegistry = cloneRegistry(
    previousGraph?.identifierRegistry
  );
  const candidateRegistry = cloneRegistry(
    previousGraph?.candidateRegistry
  );
  let ledger = createDecisionLedger(
    previousLedger || previousGraph?.decisionLedger || []
  );

  const resolutions = [];
  const mentionAuthorityLinks = [];
  const registryConflicts = [];

  for (const mention of mentions) {
    const result = resolveAuthorMention(mention, candidates);
    const targetCandidate = result.targetRef
      ? candidateMap.get(result.targetRef)
      : null;

    let authorityId = null;
    let allocation = null;

    if (result.status === "confirmed" && targetCandidate) {
      allocation = allocateAuthority(targetCandidate, {
        identifierRegistry,
        candidateRegistry,
        buildRevision
      });

      if (allocation.authorityId) {
        authorityId = allocation.authorityId;
      } else {
        registryConflicts.push({
          mentionRef: mention.id,
          candidateRef: result.targetRef,
          ...allocation
        });
      }
    }

    const decisionResult = {
      ...result,
      targetRef: authorityId || result.targetRef || null
    };

    const decision = resolutionResultToDecision(decisionResult, {
      subjectRefs: [mention.id],
      algorithmVersion,
      datasetRevision,
      decidedAtRevision: buildRevision,
      decisionMode: "automatic"
    });

    const appended = appendResolutionDecision(ledger, decision);
    ledger = appended.ledger;

    if (authorityId && targetCandidate) {
      const existing = authorityMap.get(authorityId) || null;
      const authority = authorityFromCandidate(
        targetCandidate,
        authorityId,
        {
          existing,
          buildRevision,
          decisionRef: appended.decision.id,
          mention
        }
      );
      authorityMap.set(authorityId, authority);

      for (const key of allocation.identifierKeys) {
        const current = identifierRegistry[key];
        if (current && current !== authorityId) {
          registryConflicts.push({
            mentionRef: mention.id,
            candidateRef: result.targetRef,
            status: "registry-conflict",
            authorityId,
            conflictingAuthorityIds: [current],
            identifierKeys: [key]
          });
          continue;
        }
        identifierRegistry[key] = authorityId;
      }

      candidateRegistry[result.targetRef] = authorityId;
      mentionAuthorityLinks.push({
        mentionRef: mention.id,
        authorityRef: authorityId,
        decisionRef: appended.decision.id,
        status: "confirmed"
      });
    }

    resolutions.push({
      mentionRef: mention.id,
      candidateRef: result.targetRef || null,
      authorityRef: authorityId,
      status: result.status,
      explanationCode: result.explanationCode,
      decisionRef: appended.decision.id
    });
  }

  const goldReport = goldExpectations
    ? evaluateAuthorityBuildAgainstGold(resolutions, goldExpectations)
    : null;

  const graph = {
    schemaVersion: AUTHORITY_GRAPH_SCHEMA_VERSION,
    buildRevision,
    algorithmVersion,
    datasetRevision,
    authorities: [...authorityMap.values()].sort((a, b) =>
      String(a.id).localeCompare(String(b.id))
    ),
    mentions: [...mentions],
    sourceRecords: [...sourceRecords],
    mentionAuthorityLinks,
    identifierRegistry,
    candidateRegistry,
    decisionLedger: ledger,
    buildMetrics: {
      candidatesSeen: candidates.length,
      mentionsSeen: mentions.length,
      authoritiesTotal: authorityMap.size,
      authoritiesPromoted:
        new Set(mentionAuthorityLinks.map(link => link.authorityRef)).size,
      registryConflictCount: registryConflicts.length,
      decisionsByStatus: statusCounts(
        ledger.decisions.filter(item =>
          item.decidedAtRevision === buildRevision
        )
      ),
      gold: goldReport
    },
    registryConflicts
  };

  validateAuthorityGraph(graph);
  return graph;
}

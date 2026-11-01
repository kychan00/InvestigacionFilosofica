const SCHEMA_VERSION = "author-authority-decisions-v1";

const DECISION_TYPES = new Set([
  "mention-to-authority",
  "authority-merge",
  "authority-split",
  "contribution-attribution",
  "work-merge",
  "work-split",
  "version-link",
  "identifier-link"
]);

const DECISION_STATUSES = new Set([
  "confirmed",
  "probable",
  "ambiguous",
  "unresolved",
  "rejected"
]);

const DECISION_MODES = new Set([
  "automatic",
  "curated",
  "hybrid"
]);

function array(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function unique(values) {
  return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))];
}

function canonicalRefs(values) {
  return unique(array(values)).sort();
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(String(value))) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function decisionKeyValue(decision = {}) {
  return [
    decision.decisionType,
    ...canonicalRefs(decision.subjectRefs)
  ].join("|");
}

function cloneEvidenceItem(item = {}) {
  return {
    class: item.class || null,
    polarity: item.polarity || "supports",
    ruleId: item.ruleId || null,
    value: item.value ?? null
  };
}

function validateDecision(decision) {
  if (!DECISION_TYPES.has(decision.decisionType)) {
    throw new TypeError(`Unsupported resolution decision type: ${decision.decisionType}`);
  }
  if (!DECISION_STATUSES.has(decision.status)) {
    throw new TypeError(`Unsupported resolution decision status: ${decision.status}`);
  }
  if (!DECISION_MODES.has(decision.decisionMode)) {
    throw new TypeError(`Unsupported resolution decision mode: ${decision.decisionMode}`);
  }
  if (!canonicalRefs(decision.subjectRefs).length) {
    throw new TypeError("ResolutionDecision requires at least one subjectRef");
  }
  if (!String(decision.algorithmVersion || "").trim()) {
    throw new TypeError("ResolutionDecision requires algorithmVersion");
  }
  if (!String(decision.datasetRevision || "").trim()) {
    throw new TypeError("ResolutionDecision requires datasetRevision");
  }
  return decision;
}

export function createDecisionLedger(initial = []) {
  const decisions = Array.isArray(initial)
    ? initial
    : array(initial?.decisions);
  const ledger = {
    schemaVersion: SCHEMA_VERSION,
    decisions: decisions.map(item => normalizeResolutionDecision(item))
  };
  validateLedger(ledger);
  return ledger;
}

export function normalizeResolutionDecision(input = {}) {
  const subjectRefs = canonicalRefs(input.subjectRefs);
  const targetRefs = canonicalRefs(
    input.targetRefs ?? (input.targetRef ? [input.targetRef] : [])
  );
  const mergeCandidateRefs = canonicalRefs(input.mergeCandidateRefs);
  const decisionType = String(input.decisionType || "").trim();
  const status = String(input.status || "").trim();
  const decisionMode = String(input.decisionMode || "automatic").trim();
  const algorithmVersion = String(input.algorithmVersion || "").trim();
  const datasetRevision = String(input.datasetRevision || "").trim();
  const decidedAtRevision = String(
    input.decidedAtRevision || datasetRevision
  ).trim();
  const evidenceSnapshot = array(input.evidenceSnapshot ?? input.evidence)
    .map(cloneEvidenceItem);
  const vetoSnapshot = array(input.vetoSnapshot ?? input.vetoes)
    .map(cloneEvidenceItem);
  const id = String(input.id || [
    "decision",
    fnv1a(JSON.stringify({
      decisionType,
      subjectRefs,
      targetRefs,
      mergeCandidateRefs,
      status,
      algorithmVersion,
      datasetRevision,
      decidedAtRevision,
      explanationCode: input.explanationCode || null
    }))
  ].join(":"));

  return validateDecision({
    schemaVersion: SCHEMA_VERSION,
    entityType: "ResolutionDecision",
    id,
    decisionType,
    subjectRefs,
    targetRefs,
    mergeCandidateRefs,
    status,
    evidenceRefs: canonicalRefs(input.evidenceRefs),
    vetoRefs: canonicalRefs(input.vetoRefs),
    evidenceSnapshot,
    vetoSnapshot,
    algorithmVersion,
    datasetRevision,
    decisionMode,
    supersedesDecisionRef: input.supersedesDecisionRef || null,
    decidedAtRevision,
    explanationCode: input.explanationCode || null
  });
}

export function resolutionResultToDecision(result = {}, {
  id = null,
  subjectRefs = [],
  algorithmVersion,
  datasetRevision,
  decidedAtRevision = datasetRevision,
  decisionMode = "automatic",
  evidenceRefs = [],
  vetoRefs = []
} = {}) {
  const targets = result.targetRef
    ? [result.targetRef]
    : result.targetRefs || [];
  return normalizeResolutionDecision({
    id,
    decisionType: result.decisionType || "mention-to-authority",
    subjectRefs,
    targetRefs: targets,
    mergeCandidateRefs: result.mergeCandidateRefs || [],
    status: result.status || "unresolved",
    evidenceRefs,
    vetoRefs,
    evidenceSnapshot: result.evidence || [],
    vetoSnapshot: result.vetoes || [],
    algorithmVersion,
    datasetRevision,
    decidedAtRevision,
    decisionMode,
    explanationCode: result.explanationCode || null
  });
}

export function decisionKey(decision = {}) {
  return decisionKeyValue(decision);
}

export function activeResolutionDecision(ledger, {
  decisionType,
  subjectRefs
} = {}) {
  const normalized = createDecisionLedger(ledger);
  const key = decisionKeyValue({decisionType, subjectRefs});
  const matching = normalized.decisions.filter(item =>
    decisionKeyValue(item) === key
  );
  if (!matching.length) return null;

  const superseded = new Set(
    matching.map(item => item.supersedesDecisionRef).filter(Boolean)
  );
  const active = matching.filter(item => !superseded.has(item.id));
  return active.at(-1) || matching.at(-1) || null;
}

function sameDecisionOutcome(left, right) {
  return left.decisionType === right.decisionType &&
    left.status === right.status &&
    JSON.stringify(canonicalRefs(left.subjectRefs)) ===
      JSON.stringify(canonicalRefs(right.subjectRefs)) &&
    JSON.stringify(canonicalRefs(left.targetRefs)) ===
      JSON.stringify(canonicalRefs(right.targetRefs)) &&
    JSON.stringify(canonicalRefs(left.mergeCandidateRefs)) ===
      JSON.stringify(canonicalRefs(right.mergeCandidateRefs)) &&
    left.explanationCode === right.explanationCode &&
    left.algorithmVersion === right.algorithmVersion &&
    left.datasetRevision === right.datasetRevision;
}

export function appendResolutionDecision(ledger, input) {
  const current = createDecisionLedger(ledger);
  let decision = normalizeResolutionDecision(input);
  const active = activeResolutionDecision(current, {
    decisionType: decision.decisionType,
    subjectRefs: decision.subjectRefs
  });

  if (active && sameDecisionOutcome(active, decision)) {
    return {
      ledger: current,
      decision: active,
      appended: false,
      reason: "duplicate-active-decision"
    };
  }

  if (active && !decision.supersedesDecisionRef) {
    decision = normalizeResolutionDecision({
      ...decision,
      supersedesDecisionRef: active.id,
      id: input?.id || null
    });
  }

  return {
    ledger: {
      schemaVersion: SCHEMA_VERSION,
      decisions: [...current.decisions, decision]
    },
    decision,
    appended: true,
    reason: active ? "superseded-active-decision" : "new-decision"
  };
}

export function rejectedTargetsForSubject(ledger, {
  decisionType = "mention-to-authority",
  subjectRefs = []
} = {}) {
  const current = activeResolutionDecision(ledger, {
    decisionType,
    subjectRefs
  });
  if (!current || current.status !== "rejected") {
    return [];
  }
  return [...current.targetRefs];
}

export function decisionHistory(ledger, {
  decisionType,
  subjectRefs
} = {}) {
  const normalized = createDecisionLedger(ledger);
  const key = decisionKeyValue({decisionType, subjectRefs});
  return normalized.decisions.filter(item => decisionKeyValue(item) === key);
}

export function serializeDecisionLedger(ledger) {
  const normalized = createDecisionLedger(ledger);
  return JSON.stringify(normalized, null, 2);
}

export function hydrateDecisionLedger(serialized) {
  if (typeof serialized === "string") {
    return createDecisionLedger(JSON.parse(serialized));
  }
  return createDecisionLedger(serialized);
}

export function validateLedger(ledger) {
  if (ledger?.schemaVersion !== SCHEMA_VERSION) {
    throw new TypeError(`Unsupported decision ledger schema: ${ledger?.schemaVersion}`);
  }
  const ids = new Set();
  for (const decision of array(ledger.decisions)) {
    validateDecision(decision);
    if (ids.has(decision.id)) {
      throw new TypeError(`Duplicate ResolutionDecision id: ${decision.id}`);
    }
    ids.add(decision.id);
  }

  const known = new Set(array(ledger.decisions).map(item => item.id));
  for (const decision of array(ledger.decisions)) {
    if (decision.supersedesDecisionRef &&
        !known.has(decision.supersedesDecisionRef)) {
      throw new TypeError(
        `Unknown superseded decision: ${decision.supersedesDecisionRef}`
      );
    }
  }

  return true;
}

export const RESOLUTION_DECISION_SCHEMA_VERSION = SCHEMA_VERSION;

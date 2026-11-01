import {
  normalizeAuthorName,
  authorNameSignature
} from "./remote-author-resolution.js";

const DETERMINISTIC_SCHEMES = new Set([
  "orcid",
  "openalex-author",
  "wikidata"
]);

function array(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function compact(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizedOrcid(value) {
  return String(value || "")
    .replace(/^https?:\/\/orcid\.org\//i, "")
    .trim()
    .toUpperCase();
}

function normalizedScheme(value) {
  return String(value || "").trim().toLowerCase();
}

function identifierValue(item) {
  if (typeof item === "string") return item;
  return item?.normalizedValue ?? item?.value ?? item?.rawValue ?? "";
}

function identifierScheme(item) {
  if (typeof item === "string") return "";
  return normalizedScheme(item?.scheme);
}

export function authorityIdentifiers(entity = {}) {
  const output = [];
  for (const item of [
    ...array(entity.externalIdentifiers),
    ...array(entity.embeddedIdentifiers)
  ]) {
    const scheme = identifierScheme(item);
    const raw = identifierValue(item);
    if (!scheme || !String(raw || "").trim()) continue;
    const value = scheme === "orcid" ? normalizedOrcid(raw) : String(raw).trim();
    output.push({scheme, value});
  }
  if (entity.orcid) {
    output.push({scheme: "orcid", value: normalizedOrcid(entity.orcid)});
  }
  const seen = new Set();
  return output.filter(item => {
    const key = `${item.scheme}:${item.value}`;
    if (!item.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nameValue(item) {
  if (typeof item === "string") return item;
  return item?.value ?? item?.rawValue ?? item?.name ?? "";
}

export function authorityNames(entity = {}) {
  const values = [
    entity.canonicalName,
    entity.displayName,
    entity.sourceDisplayName,
    entity.rawValue,
    entity.normalizedValue,
    entity.name,
    ...array(entity.names).map(nameValue),
    ...array(entity.aliases).map(nameValue)
  ];
  const seen = new Set();
  return values
    .map(value => String(value || "").trim())
    .filter(value => {
      const key = normalizeAuthorName(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizedInstitution(value) {
  const source = typeof value === "string"
    ? value
    : value?.institution ?? value?.name ?? value?.value ?? "";
  return normalizeAuthorName(source);
}

function affiliationKeys(entity = {}) {
  return compact(array(entity.affiliations).map(normalizedInstitution));
}

function relationKeys(entity = {}, keys) {
  return compact(keys.flatMap(key => array(entity[key])).map(item => {
    if (typeof item === "string") return normalizeAuthorName(item);
    return normalizeAuthorName(item?.id ?? item?.doi ?? item?.name ?? item?.value ?? "");
  }));
}

function familyNames(entity = {}) {
  const values = entity?.parsedName?.familyNames ?? entity?.familyNames ?? [];
  return array(values).map(value => normalizeAuthorName(value)).filter(Boolean);
}

function tokens(value) {
  return normalizeAuthorName(value).split(" ").filter(Boolean);
}

function initialCompatible(left, right) {
  const a = tokens(left), b = tokens(right);
  if (a.length < 2 || a.length !== b.length) return false;
  return a.every((token, index) => {
    const other = b[index];
    return token === other ||
      (token.length === 1 && other.startsWith(token)) ||
      (other.length === 1 && token.startsWith(other));
  });
}

function subsetName(left, right) {
  const a = tokens(left), b = tokens(right);
  if (a.length < 2 || b.length < 2 || a.length === b.length) return false;
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  return shorter.every(token => longer.includes(token));
}

function evidence({className, polarity = "supports", ruleId, value = null}) {
  return {class: className, polarity, ruleId, value};
}

function intersection(left, right) {
  const target = new Set(right);
  return compact(left.filter(value => target.has(value)));
}

function identifierEvidence(mention, candidate) {
  const output = [];
  const left = authorityIdentifiers(mention);
  const right = authorityIdentifiers(candidate);
  const schemes = compact([...left, ...right].map(item => item.scheme));

  for (const scheme of schemes) {
    const a = left.filter(item => item.scheme === scheme).map(item => item.value);
    const b = right.filter(item => item.scheme === scheme).map(item => item.value);
    if (!a.length || !b.length) continue;
    const shared = intersection(a, b);
    if (shared.length && DETERMINISTIC_SCHEMES.has(scheme)) {
      output.push(evidence({
        className: "A",
        ruleId: `${scheme}-match`,
        value: shared[0]
      }));
      continue;
    }
    if (scheme === "orcid" && !shared.length) {
      output.push(evidence({
        className: "VETO",
        polarity: "contradicts",
        ruleId: "orcid-conflict",
        value: {mention: a, candidate: b}
      }));
    }
  }
  return output;
}

function nameEvidence(mention, candidate) {
  const output = [];
  const left = authorityNames(mention);
  const right = authorityNames(candidate);
  let exact = false, signature = false, initials = false, subset = false;

  for (const a of left) for (const b of right) {
    if (normalizeAuthorName(a) === normalizeAuthorName(b)) exact = true;
    else if (authorNameSignature(a) === authorNameSignature(b)) signature = true;
    else if (initialCompatible(a, b)) initials = true;
    else if (subsetName(a, b)) subset = true;
  }

  if (exact) output.push(evidence({className: "D", ruleId: "name-exact"}));
  else if (signature) output.push(evidence({className: "D", ruleId: "name-signature"}));
  else if (initials) output.push(evidence({className: "D", ruleId: "name-initial-compatible"}));
  else if (subset) output.push(evidence({className: "D", ruleId: "name-subset"}));
  return output;
}

function structuredFamilyEvidence(mention, candidate) {
  const left = familyNames(mention), right = familyNames(candidate);
  if (left.length < 2 || right.length < 2) return [];
  if (left[0] === right[0] && left.at(-1) !== right.at(-1)) {
    return [evidence({
      className: "VETO",
      polarity: "contradicts",
      ruleId: "family-name-conflict",
      value: {mention: left, candidate: right}
    })];
  }
  return [];
}

function contextEvidence(mention, candidate) {
  const output = [];
  const affiliations = intersection(
    affiliationKeys(mention),
    affiliationKeys(candidate)
  );
  if (affiliations.length) {
    output.push(evidence({
      className: "B",
      ruleId: "affiliation-exact",
      value: affiliations
    }));
  }

  const works = intersection(
    relationKeys(mention, ["knownWorkIds", "workRefs", "dois"]),
    relationKeys(candidate, ["knownWorkIds", "workRefs", "dois"])
  );
  if (works.length) {
    output.push(evidence({
      className: "B",
      ruleId: "known-work-overlap",
      value: works
    }));
  }

  const coauthors = intersection(
    relationKeys(mention, ["coauthors", "coauthorRefs"]),
    relationKeys(candidate, ["coauthors", "coauthorRefs"])
  );
  if (coauthors.length >= 2) {
    output.push(evidence({
      className: "B",
      ruleId: "coauthor-network-overlap",
      value: coauthors
    }));
  } else if (coauthors.length === 1) {
    output.push(evidence({
      className: "C",
      ruleId: "coauthor-overlap",
      value: coauthors
    }));
  }
  return output;
}

function profile(items) {
  const support = {A: 0, B: 0, C: 0, D: 0};
  let contradictions = 0;
  for (const item of items) {
    if (item.polarity === "contradicts") {
      contradictions++;
      continue;
    }
    if (support[item.class] !== undefined) support[item.class]++;
  }
  return {support, contradictions};
}

function candidateRef(candidate, index = 0) {
  return String(candidate?.id || candidate?.authorityId || `candidate:${index}`);
}

export function evaluateIdentityCandidate(mention, candidate, {index = 0} = {}) {
  const evidenceItems = [
    ...identifierEvidence(mention, candidate),
    ...structuredFamilyEvidence(mention, candidate),
    ...nameEvidence(mention, candidate),
    ...contextEvidence(mention, candidate)
  ];
  const vetoes = evidenceItems.filter(item => item.class === "VETO");
  const evidenceOnly = evidenceItems.filter(item => item.class !== "VETO");
  const evidenceProfile = profile(evidenceItems);
  let status = "unresolved";
  let explanationCode = "insufficient-evidence";

  if (vetoes.length) {
    status = "rejected";
    explanationCode = "identity-veto";
  } else if (evidenceProfile.support.A > 0) {
    status = "confirmed";
    explanationCode = "deterministic-identifier";
  } else if (evidenceProfile.support.B > 0 &&
             (evidenceProfile.support.D > 0 || evidenceProfile.support.C > 0)) {
    status = "probable";
    explanationCode = "strong-bibliographic-evidence";
  }

  return {
    candidateRef: candidateRef(candidate, index),
    candidate,
    status,
    evidence: evidenceOnly,
    vetoes,
    evidenceProfile,
    explanationCode
  };
}

function hasBlockingSignal(mention, candidate) {
  const identifiers = identifierEvidence(mention, candidate);
  if (identifiers.some(item => item.polarity === "supports")) return true;
  if (nameEvidence(mention, candidate).length) return true;
  return contextEvidence(mention, candidate).some(item => item.class === "B");
}

export function blockAuthorityCandidates(mention, candidates = []) {
  return candidates.filter(candidate => hasBlockingSignal(mention, candidate));
}

function compareEvaluations(a, b) {
  const av = a.evidenceProfile.support, bv = b.evidenceProfile.support;
  return bv.A - av.A || bv.B - av.B || bv.C - av.C || bv.D - av.D ||
    a.vetoes.length - b.vetoes.length ||
    a.candidateRef.localeCompare(b.candidateRef);
}

export function resolveAuthorMention(mention, candidates = []) {
  const blocked = blockAuthorityCandidates(mention, candidates);
  if (!blocked.length) {
    return {
      decisionType: "mention-to-authority",
      status: "unresolved",
      targetRef: null,
      candidates: [],
      rejectedCandidates: [],
      explanationCode: "no-blocked-candidates"
    };
  }

  const evaluations = blocked.map((candidate, index) =>
    evaluateIdentityCandidate(mention, candidate, {index})
  ).sort(compareEvaluations);
  const viable = evaluations.filter(item => item.status !== "rejected");
  const rejected = evaluations.filter(item => item.status === "rejected");
  const deterministic = viable.filter(item => item.evidenceProfile.support.A > 0);

  if (deterministic.length === 1) {
    const winner = deterministic[0];
    return {
      decisionType: "mention-to-authority",
      status: "confirmed",
      targetRef: winner.candidateRef,
      candidates: evaluations,
      rejectedCandidates: rejected,
      evidence: winner.evidence,
      vetoes: winner.vetoes,
      explanationCode: "unique-deterministic-candidate"
    };
  }

  if (deterministic.length > 1) {
    return {
      decisionType: "mention-to-authority",
      status: "ambiguous",
      targetRef: null,
      candidates: evaluations,
      rejectedCandidates: rejected,
      mergeCandidateRefs: deterministic.map(item => item.candidateRef),
      explanationCode: "shared-deterministic-identifier"
    };
  }

  const strong = viable.filter(item => item.evidenceProfile.support.B > 0);
  if (strong.length === 1) {
    const winner = strong[0];
    return {
      decisionType: "mention-to-authority",
      status: "probable",
      targetRef: winner.candidateRef,
      candidates: evaluations,
      rejectedCandidates: rejected,
      evidence: winner.evidence,
      vetoes: winner.vetoes,
      explanationCode: "unique-strong-candidate"
    };
  }

  if (viable.length > 1) {
    return {
      decisionType: "mention-to-authority",
      status: "ambiguous",
      targetRef: null,
      candidates: evaluations,
      rejectedCandidates: rejected,
      explanationCode: "multiple-compatible-candidates"
    };
  }

  if (viable.length === 1) {
    return {
      decisionType: "mention-to-authority",
      status: "unresolved",
      targetRef: null,
      candidates: evaluations,
      rejectedCandidates: rejected,
      explanationCode: "name-or-context-only"
    };
  }

  return {
    decisionType: "mention-to-authority",
    status: "unresolved",
    targetRef: null,
    candidates: evaluations,
    rejectedCandidates: rejected,
    explanationCode: "all-candidates-vetoed"
  };
}

function authorityAsMention(authority = {}) {
  return {
    ...authority,
    rawValue: authority.canonicalName || authority.displayName || authority.name || "",
    embeddedIdentifiers: authorityIdentifiers(authority)
  };
}

export function evaluateAuthorityMerge(left, right) {
  const evaluation = evaluateIdentityCandidate(authorityAsMention(left), right);
  return {
    decisionType: "authority-merge",
    status: evaluation.status,
    subjectRefs: [candidateRef(left, 0), candidateRef(right, 1)],
    evidence: evaluation.evidence,
    vetoes: evaluation.vetoes,
    evidenceProfile: evaluation.evidenceProfile,
    explanationCode: evaluation.explanationCode
  };
}

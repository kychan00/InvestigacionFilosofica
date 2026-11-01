import {
  normalizeAuthorName
} from "./remote-author-resolution.js";
import {
  splitCreatorMetadata
} from "./author-federated-matching.js";

function array(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeOrcid(value) {
  const match = String(value || "")
    .trim()
    .match(/(?:https?:\/\/orcid\.org\/)?(\d{4}-\d{4}-\d{4}-[\dX]{4})$/i);
  return match?.[1]?.toUpperCase() || null;
}

function openAlexAuthorId(value) {
  return String(value || "")
    .match(/(?:^|openalex\.org\/)A?(\d+)$/i)?.[1] || null;
}

function safeIdPart(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_.:-]+/g, "")
    .slice(0, 80);
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(String(value))) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function sourceRecordRef(provider, sourceId, workContext = "") {
  const providerKey = safeIdPart(provider) || "unknown";
  return "source:" + providerKey + ":" +
    fnv1a(
      String(provider) + "|" +
      String(sourceId) + "|" +
      String(workContext)
    );
}

function mentionRef(recordRef, position, rawValue) {
  const suffix = position ?? fnv1a(rawValue).slice(0, 8);
  return "mention:" + fnv1a(recordRef) + ":" + suffix;
}

function identifierAssertionsFromCreator(creator = {}) {
  const output = [];
  const orcid = normalizeOrcid(creator.orcid || creator.id);
  if (orcid) {
    output.push({
      scheme: "orcid",
      rawValue: creator.orcid || creator.id,
      normalizedValue: orcid,
      status: "asserted"
    });
  }

  const openalex = openAlexAuthorId(creator.id);
  if (openalex) {
    output.push({
      scheme: "openalex-author",
      rawValue: creator.id,
      normalizedValue: openalex,
      status: "asserted"
    });
  }

  return output;
}

function normalizedRole(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "unknown";
  if (/coord/.test(raw)) return "coordinator";
  if (/edit/.test(raw)) return "editor";
  if (/trad/.test(raw)) return "translator";
  if (/compil/.test(raw)) return "compiler";
  if (/prolog/.test(raw)) return "prologue";
  if (/intro/.test(raw)) return "introduction";
  if (/review|reseñ/.test(raw)) return "reviewer";
  if (/author|autor/.test(raw)) return "author";
  return "unknown";
}

export function snapshotCandidateToAuthorityCandidate(candidate = {}) {
  const openalex = openAlexAuthorId(candidate.id);
  const canonicalName = String(
    candidate.n ||
    candidate.displayName ||
    candidate.sourceDisplayName ||
    ""
  ).trim();

  const externalIdentifiers = [];
  if (openalex) {
    externalIdentifiers.push({
      scheme: "openalex-author",
      rawValue: candidate.id,
      normalizedValue: openalex,
      status: "asserted",
      source: "OpenAlex Philosophy · Hugging Face"
    });
  }

  const orcid = normalizeOrcid(candidate.o || candidate.orcid);
  if (orcid) {
    externalIdentifiers.push({
      scheme: "orcid",
      rawValue: candidate.o || candidate.orcid,
      normalizedValue: orcid,
      status: "asserted",
      source: "OpenAlex Philosophy · Hugging Face"
    });
  }

  const aliases = unique([
    canonicalName,
    ...array(candidate.aliases),
    ...array(candidate.display_name_alternatives)
  ]).filter(Boolean);

  return {
    entityType: "AuthorityCandidate",
    id: openalex
      ? "candidate:openalex-author:" + openalex
      : "candidate:name:" + safeIdPart(normalizeAuthorName(canonicalName)),
    canonicalName,
    names: aliases.map((value, index) => ({
      value,
      type: index === 0 ? "provider-canonical" : "alias"
    })),
    aliases,
    externalIdentifiers,
    corpusWorks: Math.max(
      0,
      Number(candidate.cw ?? candidate.corpusWorks ?? 0) || 0
    ),
    source: "OpenAlex Philosophy · Hugging Face",
    sourceMetadata: {
      matchKind: candidate.k || null
    }
  };
}

export function resolvedSnapshotIdentityToAuthorityCandidate(author = {}) {
  const ids = unique([
    openAlexAuthorId(author.id),
    ...array(author.linkedAuthorIds).map(openAlexAuthorId)
  ]);

  const canonicalName = String(
    author.displayName ||
    author.sourceDisplayName ||
    author.n ||
    ""
  ).trim();

  const externalIdentifiers = ids.map(id => ({
    scheme: "openalex-author",
    rawValue: "A" + id,
    normalizedValue: id,
    status: "asserted",
    source: "OpenAlex Philosophy · Hugging Face"
  }));

  const orcid = normalizeOrcid(author.orcid || author.o);
  if (orcid) {
    externalIdentifiers.push({
      scheme: "orcid",
      rawValue: author.orcid || author.o,
      normalizedValue: orcid,
      status: "asserted",
      source: "OpenAlex Philosophy · Hugging Face"
    });
  }

  const aliases = unique([
    canonicalName,
    author.sourceDisplayName,
    author.n,
    ...array(author.aliases)
  ]).filter(Boolean);

  const sortedIds = [...ids].sort();

  return {
    entityType: "AuthorityCandidate",
    id: sortedIds.length
      ? "candidate:snapshot-group:" + sortedIds.join("+")
      : "candidate:name:" + safeIdPart(normalizeAuthorName(canonicalName)),
    canonicalName,
    names: aliases.map((value, index) => ({
      value,
      type: index === 0 ? "provider-canonical" : "alias"
    })),
    aliases,
    externalIdentifiers,
    corpusWorks: Math.max(
      0,
      Number(author.corpusWorks ?? author.cw ?? 0) || 0
    ),
    source: "OpenAlex Philosophy · Hugging Face"
  };
}

function inferProvider(work = {}, source = {}) {
  return String(
    source.provider ||
    array(work.providers)[0] ||
    work.metadataAuthority ||
    "unknown"
  ).trim();
}

function inferSourceId(work = {}, source = {}, index = 0) {
  return String(
    source.sourceId ||
    source.id ||
    work.id ||
    work.doi ||
    (
      normalizeAuthorName(work.title || "work") + ":" +
      (work.year || "unknown") + ":" + index
    )
  ).trim();
}

export function workToSourceRecords(work = {}, {
  providerRevision = null
} = {}) {
  const records = array(work.sourceRecords);
  const sourceEntries = records.length ? records : [{}];

  return sourceEntries.map((source, index) => {
    const provider = inferProvider(work, source);
    const providerRecordId = inferSourceId(work, source, index);
    const workContext =
      work.id ||
      work.doi ||
      (
        normalizeAuthorName(work.title || "work") + ":" +
        String(work.year || "unknown")
      );
    const ref = sourceRecordRef(
      provider,
      providerRecordId,
      workContext
    );

    return {
      schemaVersion: "author-authority-data-v1",
      entityType: "SourceRecord",
      id: ref,
      provider,
      providerRecordId,
      providerRevision:
        source.providerRevision ||
        source.revision ||
        providerRevision ||
        null,
      recordUrl:
        source.url ||
        source.recordUrl ||
        work.urls?.landing ||
        work.urls?.canonical ||
        null,
      rawTitle: source.title || work.title || "",
      rawCreators: array(source.authors || work.authors).map(author => ({
        ...author
      })),
      rawDate:
        source.date ||
        source.published ||
        work.publishedDate ||
        work.year ||
        null,
      rawIdentifiers: {
        doi: source.doi || work.doi || null,
        isbn: array(source.isbn || work.isbn),
        openalex:
          source.openalexId ||
          work.openalexId ||
          (String(work.id || "").includes("openalex.org/") ? work.id : null)
      },
      rawType: source.type || work.type || null,
      rawContainer:
        source.journal ||
        source.containerTitle ||
        work.journal ||
        work.containerTitle ||
        null,
      rawPublisher: source.publisher || work.publisher || null,
      rawLanguage: source.language || work.language || null,
      rawUrls: {
        ...(work.urls || {}),
        ...(source.urls || {})
      },
      normalizationVersion: "author-authority-adapter-v1"
    };
  });
}

export function creatorToAuthorMention(creator = {}, {
  sourceRecordRef: recordRef,
  position = null,
  fallbackRole = null
} = {}) {
  const rawValue = String(
    creator.name ||
    creator.displayName ||
    creator.rawCreator ||
    ""
  ).trim();
  const rawCreatorStatement = String(
    creator.rawCreator ||
    creator.originalCreatorStatement ||
    rawValue
  ).trim();

  return {
    schemaVersion: "author-authority-data-v1",
    entityType: "AuthorMention",
    id: mentionRef(recordRef, position, rawValue),
    sourceRecordRef: recordRef,
    rawValue,
    rawCreatorStatement,
    normalizedValue: normalizeAuthorName(rawValue),
    parsedName: null,
    rawRole: creator.role || fallbackRole || null,
    normalizedRoleCandidate: normalizedRole(
      creator.role || fallbackRole
    ),
    position,
    embeddedIdentifiers: identifierAssertionsFromCreator(creator),
    isCompositeStatement: Boolean(
      creator.creatorComposite ||
      creator.originalCreatorStatement
    ),
    candidateAuthorityRefs: [],
    resolutionDecisionRef: null
  };
}

export function workToAuthorMentions(work = {}, {
  sourceRecord = null,
  sourceRecordRef: explicitRef = null
} = {}) {
  const records = sourceRecord
    ? [sourceRecord]
    : workToSourceRecords(work);

  const primaryRecord = records[0];
  const ref = explicitRef || primaryRecord?.id;
  const rawCreators = array(
    primaryRecord?.rawCreators?.length
      ? primaryRecord.rawCreators
      : work.authors
  );

  const split = splitCreatorMetadata(rawCreators);
  return split.map((creator, index) =>
    creatorToAuthorMention(creator, {
      sourceRecordRef: ref,
      position: index,
      fallbackRole: creator.role || null
    })
  );
}

export function indexedWorkTargetMention(work = {}) {
  const record = workToSourceRecords(work)[0];
  const identity = work.authorIdentity || {};
  const author = array(work.authors).find(item => {
    const targetId = openAlexAuthorId(identity.id);
    const currentId = openAlexAuthorId(item?.id);
    const targetOrcid = normalizeOrcid(identity.orcid);
    const currentOrcid = normalizeOrcid(item?.orcid || item?.id);
    return (targetId && currentId === targetId) ||
      (targetOrcid && currentOrcid === targetOrcid);
  }) || array(work.authors)[0] || {
    name: identity.displayName || identity.sourceDisplayName || ""
  };

  return creatorToAuthorMention(author, {
    sourceRecordRef: record.id,
    position: 0,
    fallbackRole: "author"
  });
}

export function currentAuthorProfileToAuthorityCandidate(author = {}) {
  const candidate = resolvedSnapshotIdentityToAuthorityCandidate(author);

  const affiliations = array(author.affiliations)
    .map(item => typeof item === "string"
      ? {institution: item}
      : {...item});

  const knownWorkIds = unique([
    ...array(author.knownWorkIds),
    ...array(author.workRefs)
  ]);

  return {
    ...candidate,
    affiliations,
    knownWorkIds,
    coauthors: array(author.coauthors).map(item =>
      typeof item === "string" ? item : {...item}
    )
  };
}

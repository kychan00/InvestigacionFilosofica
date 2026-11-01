import {
  authorBucket
} from "./remote-author-resolution.js";
import {
  resolvedSnapshotIdentityToAuthorityCandidate,
  creatorToAuthorMention
} from "./author-authority-adapters.js";
import {
  buildAuthorityGraph
} from "./author-authority-build-pipeline.js";

export const AUTHORITY_BATCH_SCHEMA_VERSION =
  "author-authority-batch-v1";
export const AUTHORITY_BATCH_SHARD_SCHEMA_VERSION =
  "author-authority-batch-shard-v1";
export const DEFAULT_AUTHORITY_SHARD_COUNT = 256;

function array(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizedOrcid(value) {
  const normalized = String(value || "")
    .replace(/^https?:\/\/orcid\.org\//i, "")
    .trim()
    .toUpperCase();

  return /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/.test(normalized)
    ? normalized
    : "";
}

function openAlexId(value) {
  return String(value || "")
    .match(/(?:^|openalex\.org\/)A?(\d+)$/i)?.[1] || null;
}

function fnv1a(value) {
  let result = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(String(value))) {
    result ^= byte;
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result;
}

function numericSort(left, right) {
  const a = BigInt(String(left));
  const b = BigInt(String(right));
  return a < b ? -1 : a > b ? 1 : 0;
}

function createUnionFind(ids) {
  const parent = new Map(ids.map(id => [id, id]));

  function find(id) {
    let current = parent.get(id);
    while (current !== parent.get(current)) {
      current = parent.get(current);
    }
    let cursor = id;
    while (parent.get(cursor) !== current) {
      const next = parent.get(cursor);
      parent.set(cursor, current);
      cursor = next;
    }
    return current;
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    const winner = numericSort(rootA, rootB) <= 0 ? rootA : rootB;
    const loser = winner === rootA ? rootB : rootA;
    parent.set(loser, winner);
  }

  return {find, union};
}

function chooseDisplayProfile(profiles) {
  return [...profiles].sort((a, b) => {
    const works = Number(b.cw || 0) - Number(a.cw || 0);
    if (works) return works;
    return numericSort(a.id, b.id);
  })[0];
}

export function createAuthorAliasAccumulator() {
  const profiles = new Map();

  return {
    add(row = {}) {
      const id = openAlexId(row?.id);
      if (!id || !String(row?.n || "").trim()) return;

      const current = profiles.get(id) || {
        id,
        names: new Set(),
        signatures: new Set(),
        kinds: new Set(),
        orcids: new Set(),
        cw: 0,
        w: 0,
        c: 0
      };

      current.names.add(String(row.n).trim());
      if (row.s) current.signatures.add(String(row.s));
      if (row.k) current.kinds.add(String(row.k));

      const orcid = normalizedOrcid(row.o);
      if (orcid) current.orcids.add(orcid);

      current.cw = Math.max(current.cw, Number(row.cw || 0));
      current.w = Math.max(current.w, Number(row.w || 0));
      current.c = Math.max(current.c, Number(row.c || 0));
      profiles.set(id, current);
    },

    finish() {
      const normalized = [];
      const conflicts = [];

      for (const profile of profiles.values()) {
        if (profile.orcids.size > 1) {
          conflicts.push({
            kind: "openalex-author-orcid-conflict",
            authorId: profile.id,
            orcids: [...profile.orcids].sort()
          });
          continue;
        }

        normalized.push({
          id: profile.id,
          n: [...profile.names].sort()[0],
          names: [...profile.names].sort(),
          signatures: [...profile.signatures].sort(),
          kinds: [...profile.kinds].sort(),
          o: [...profile.orcids][0] || null,
          cw: profile.cw,
          w: profile.w,
          c: profile.c
        });
      }

      normalized.sort((a, b) => numericSort(a.id, b.id));
      return {profiles: normalized, conflicts};
    },

    get size() {
      return profiles.size;
    }
  };
}

export function aggregateAuthorAliasRows(rows = []) {
  const accumulator = createAuthorAliasAccumulator();
  for (const row of rows) accumulator.add(row);
  return accumulator.finish();
}

export function groupAggregatedAuthorProfiles(
  aggregated = {profiles: [], conflicts: []}
) {
  const ids = array(aggregated.profiles).map(profile => profile.id);
  const unionFind = createUnionFind(ids);
  const byOrcid = new Map();

  for (const profile of aggregated.profiles) {
    const orcid = normalizedOrcid(profile.o);
    if (!orcid) continue;
    const first = byOrcid.get(orcid);
    if (first) unionFind.union(first, profile.id);
    else byOrcid.set(orcid, profile.id);
  }

  const groups = new Map();
  for (const profile of aggregated.profiles) {
    const root = unionFind.find(profile.id);
    const values = groups.get(root) || [];
    values.push(profile);
    groups.set(root, values);
  }

  const candidates = [];
  const authorIdToCandidateRef = {};

  for (const profiles of groups.values()) {
    profiles.sort((a, b) => numericSort(a.id, b.id));
    const display = chooseDisplayProfile(profiles);
    const authorIds = profiles.map(profile => profile.id);
    const names = unique(
      profiles.flatMap(profile => profile.names)
    ).sort();
    const orcids = unique(
      profiles.map(profile => normalizedOrcid(profile.o))
    ).filter(Boolean);

    const candidate =
      resolvedSnapshotIdentityToAuthorityCandidate({
        id: authorIds[0],
        linkedAuthorIds: authorIds.slice(1),
        displayName: display.n,
        aliases: names.filter(name => name !== display.n),
        orcid: orcids[0] || null,
        corpusWorks: profiles.reduce(
          (sum, profile) => sum + Number(profile.cw || 0),
          0
        )
      });

    candidate.sourceMetadata = {
      ...candidate.sourceMetadata,
      authorIds,
      memberProfiles: profiles.map(profile => ({
        id: profile.id,
        name: profile.n,
        orcid: profile.o,
        corpusWorks: profile.cw,
        works: profile.w,
        citedBy: profile.c,
        signatures: profile.signatures,
        kinds: profile.kinds
      }))
    };

    candidates.push(candidate);
    for (const id of authorIds) {
      authorIdToCandidateRef[id] = candidate.id;
    }
  }

  candidates.sort((a, b) =>
    String(a.id).localeCompare(String(b.id))
  );

  return {
    candidates,
    authorIdToCandidateRef,
    conflicts: array(aggregated.conflicts)
  };
}

export function groupAuthorIndexCandidates(aliasRows = []) {
  return groupAggregatedAuthorProfiles(
    aggregateAuthorAliasRows(aliasRows)
  );
}

export function authorityCandidateShard(
  candidate,
  shardCount = DEFAULT_AUTHORITY_SHARD_COUNT
) {
  const ids = array(candidate?.sourceMetadata?.authorIds)
    .map(openAlexId)
    .filter(Boolean)
    .sort(numericSort);
  const stableKey = ids[0] || candidate?.id || "";
  return fnv1a(stableKey) % shardCount;
}

export function partitionAuthorityCandidates(
  candidates = [],
  shardCount = DEFAULT_AUTHORITY_SHARD_COUNT
) {
  const buckets = new Map();

  for (const candidate of candidates) {
    const shard = authorityCandidateShard(candidate, shardCount);
    const values = buckets.get(shard) || [];
    values.push(candidate);
    buckets.set(shard, values);
  }

  for (const values of buckets.values()) {
    values.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  return buckets;
}

function candidateOpenAlexIds(candidate) {
  return array(candidate?.sourceMetadata?.authorIds)
    .map(openAlexId)
    .filter(Boolean);
}

function candidateByAuthorId(candidates = []) {
  const index = new Map();
  for (const candidate of candidates) {
    for (const id of candidateOpenAlexIds(candidate)) {
      index.set(id, candidate);
    }
  }
  return index;
}

function memberProfile(candidate, authorId) {
  return array(candidate?.sourceMetadata?.memberProfiles)
    .find(profile => String(profile.id) === String(authorId)) || null;
}

export function authorIndexWorkRowToSourceRecord(row = {}, candidate = {}) {
  const authorId = openAlexId(row.id);
  const workId = String(row.wid || "").trim();
  const member = memberProfile(candidate, authorId);

  return {
    schemaVersion: "author-authority-data-v1",
    entityType: "SourceRecord",
    id: "source:author-index-v3:authorship:" +
      authorId + ":" + workId,
    provider: "OpenAlex Philosophy · Hugging Face",
    providerRecordId: "author-work:" + authorId + ":" + workId,
    providerRevision: "author-index-v3",
    recordUrl: null,
    rawTitle: String(row.t || "").trim(),
    rawCreators: [{
      id: "https://openalex.org/A" + authorId,
      name: member?.name || candidate.canonicalName || "",
      orcid: member?.orcid
        ? "https://orcid.org/" + normalizedOrcid(member.orcid)
        : null,
      role: "author",
      position: row.p || null,
      corresponding: Boolean(row.r)
    }],
    rawDate: row.y ?? null,
    rawIdentifiers: {
      openalexWork: workId ? "W" + workId : null,
      openalexAuthor: authorId ? "A" + authorId : null
    },
    rawType: row.ty || null,
    rawContainer: null,
    rawPublisher: null,
    rawLanguage: row.l || null,
    rawUrls: {},
    normalizationVersion: "author-authority-batch-v1"
  };
}

export function authorIndexWorkRowToMention(row = {}, candidate = {}) {
  const authorId = openAlexId(row.id);
  const workId = String(row.wid || "").trim();
  const member = memberProfile(candidate, authorId);

  return creatorToAuthorMention({
    id: "https://openalex.org/A" + authorId,
    name: member?.name || candidate.canonicalName || "",
    orcid: member?.orcid || null,
    role: "author"
  }, {
    sourceRecordRef:
      "source:author-index-v3:authorship:" +
      authorId + ":" + workId,
    position: row.p || null,
    fallbackRole: "author"
  });
}

export function buildAuthorityBatchShard({
  shard,
  shardCount = DEFAULT_AUTHORITY_SHARD_COUNT,
  candidates = [],
  workRows = [],
  previousGraph = null,
  algorithmVersion = "identity-v1",
  datasetRevision,
  buildRevision,
  goldExpectations = null
} = {}) {
  const candidateIndex = candidateByAuthorId(candidates);
  const mentions = [];
  const sourceRecords = [];
  const missingCandidateAuthorIds = new Set();

  for (const row of workRows) {
    const authorId = openAlexId(row?.id);
    const candidate = candidateIndex.get(authorId);
    if (!candidate) {
      if (authorId) missingCandidateAuthorIds.add(authorId);
      continue;
    }

    mentions.push(authorIndexWorkRowToMention(row, candidate));
    sourceRecords.push(
      authorIndexWorkRowToSourceRecord(row, candidate)
    );
  }

  const graph = buildAuthorityGraph({
    candidates,
    mentions,
    sourceRecords,
    previousGraph,
    algorithmVersion,
    datasetRevision,
    buildRevision,
    goldExpectations
  });

  return {
    schemaVersion: AUTHORITY_BATCH_SHARD_SCHEMA_VERSION,
    shard,
    shardCount,
    datasetRevision,
    buildRevision,
    candidateCount: candidates.length,
    workRowCount: workRows.length,
    missingCandidateAuthorIds:
      [...missingCandidateAuthorIds].sort(numericSort),
    graph
  };
}

export function summarizeAuthorityBatchShards({
  shards = [],
  shardCount = DEFAULT_AUTHORITY_SHARD_COUNT,
  sourceManifest = null,
  datasetRevision,
  buildRevision,
  aliasConflicts = []
} = {}) {
  const authorityLocations = {};
  const identifierRegistry = {};
  const candidateRegistry = {};
  const duplicateAuthorityIds = [];
  const registryConflicts = [];
  const counts = {
    shards: 0,
    candidates: 0,
    workRows: 0,
    mentions: 0,
    authorities: 0,
    confirmed: 0,
    probable: 0,
    ambiguous: 0,
    unresolved: 0,
    rejected: 0,
    missingCandidateAuthors: 0
  };

  for (const item of shards) {
    counts.shards++;
    counts.candidates += Number(item.candidateCount || 0);
    counts.workRows += Number(item.workRowCount || 0);
    counts.mentions += Number(
      item.graph?.buildMetrics?.mentionsSeen || 0
    );
    counts.authorities += Number(
      item.graph?.authorities?.length || 0
    );
    counts.missingCandidateAuthors +=
      array(item.missingCandidateAuthorIds).length;

    const statuses =
      item.graph?.buildMetrics?.decisionsByStatus || {};
    for (const status of [
      "confirmed",
      "probable",
      "ambiguous",
      "unresolved",
      "rejected"
    ]) {
      counts[status] += Number(statuses[status] || 0);
    }

    for (const authority of array(item.graph?.authorities)) {
      if (authorityLocations[authority.id] !== undefined) {
        duplicateAuthorityIds.push(authority.id);
      } else {
        authorityLocations[authority.id] = item.shard;
      }
    }

    for (const [key, authorityId] of Object.entries(
      item.graph?.identifierRegistry || {}
    )) {
      const previous = identifierRegistry[key];
      if (previous && previous !== authorityId) {
        registryConflicts.push({
          kind: "identifier-registry-conflict",
          key,
          authorityIds: unique([previous, authorityId]).sort()
        });
      } else {
        identifierRegistry[key] = authorityId;
      }
    }

    for (const [key, authorityId] of Object.entries(
      item.graph?.candidateRegistry || {}
    )) {
      const previous = candidateRegistry[key];
      if (previous && previous !== authorityId) {
        registryConflicts.push({
          kind: "candidate-registry-conflict",
          key,
          authorityIds: unique([previous, authorityId]).sort()
        });
      } else {
        candidateRegistry[key] = authorityId;
      }
    }
  }

  return {
    schemaVersion: AUTHORITY_BATCH_SCHEMA_VERSION,
    shardCount,
    datasetRevision,
    buildRevision,
    sourceManifest,
    counts,
    authorityLocations,
    identifierRegistry,
    candidateRegistry,
    conflicts: {
      alias: [...aliasConflicts],
      registry: registryConflicts,
      duplicateAuthorityIds: unique(duplicateAuthorityIds).sort()
    }
  };
}

export function sourceWorkBucketForAuthor(
  authorId,
  bucketCount = 1024
) {
  return authorBucket(String(authorId), bucketCount);
}

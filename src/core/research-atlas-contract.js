export const RESEARCH_ATLAS_SCHEMA_VERSION =
  "research-atlas-snapshot-v1";

export const RESEARCH_ATLAS_NODE_TYPES = Object.freeze({
  QUERY: "query",
  WORK: "work",
  AUTHORITY_PERSON: "authority-person",
  AUTHOR_MENTION: "author-mention"
});

export const RESEARCH_ATLAS_EDGE_TYPES = Object.freeze({
  QUERY_RESULT: "query-result",
  CONTRIBUTION: "contribution",
  AUTHOR_MENTION: "author-mention",
  SEMANTIC_NEIGHBOR: "semantic-neighbor",
  LEXICAL_NEIGHBOR: "lexical-neighbor",
  SAME_AUTHOR: "same-author",
  COAUTHOR: "coauthor",
  SHARED_COAUTHOR: "shared-coauthor",
  RELATED_WORK: "related-work",
  CITATION: "citation"
});

export const RESEARCH_ATLAS_EVIDENCE_CLASSES = Object.freeze({
  FACTUAL: "factual",
  DERIVED: "derived",
  PROVISIONAL: "provisional"
});

export const RESEARCH_ATLAS_EDGE_STATUS = Object.freeze({
  CONFIRMED: "confirmed",
  PROBABLE: "probable",
  DERIVED: "derived",
  PROVISIONAL: "provisional"
});

export const RESEARCH_ATLAS_DISCOVERY_ORIGINS = Object.freeze({
  DIRECT_SEARCH: "direct-search",
  RELATED_WORK_EXPANSION: "related-work-expansion",
  AUTHOR_EXPANSION: "author-expansion",
  MANUAL_EXPANSION: "manual-expansion"
});

export const RESEARCH_ATLAS_SEARCH_MODES = Object.freeze({
  TRADITIONAL: "traditional",
  SEMANTIC_SERVICE: "semantic-service",
  BROWSER_SEMANTIC: "browser-semantic"
});

const FORBIDDEN_SESSION_KEYS = new Set([
  "password",
  "passwd",
  "token",
  "access_token",
  "refresh_token",
  "cookie",
  "cookies",
  "authorization",
  "credential",
  "credentials"
]);

function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function nonEmptyString(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function stringArray(value) {
  return (
    Array.isArray(value) &&
    value.every(nonEmptyString)
  );
}

function finiteNumber(value) {
  return Number.isFinite(value);
}

function enumValues(object) {
  return new Set(Object.values(object));
}

function deepForbiddenKey(value, path = "session") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = deepForbiddenKey(value[index], path + "." + index);
      if (found) return found;
    }
    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SESSION_KEYS.has(String(key).toLowerCase())) {
      return path + "." + key;
    }

    const found = deepForbiddenKey(child, path + "." + key);
    if (found) return found;
  }

  return null;
}

function evidenceById(snapshot) {
  return new Map(
    (snapshot.evidence || [])
      .map(item => [item.id, item])
  );
}

function nodeById(snapshot) {
  return new Map(
    (snapshot.nodes || [])
      .map(item => [item.id, item])
  );
}

function evidenceFor(edge, evidenceMap) {
  return (edge.evidenceRefs || [])
    .map(ref => evidenceMap.get(ref))
    .filter(Boolean);
}

function hasEvidence(evidence, evidenceClass, predicate = () => true) {
  return evidence.some(item =>
    item.class === evidenceClass &&
    predicate(item)
  );
}

function hasPayloadFields(item, fields) {
  if (!isPlainObject(item?.payload)) {
    return false;
  }

  return fields.every(field => {
    const value = item.payload[field];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    return value !== null && value !== undefined && value !== "";
  });
}

export function validateResearchAtlasSession(session) {
  const errors = [];

  if (!isPlainObject(session)) {
    return { ok: false, errors: ["session:not-object"] };
  }

  if (!nonEmptyString(session.id)) {
    errors.push("session:id-required");
  }

  if (!nonEmptyString(session.rawQuery)) {
    errors.push("session:raw-query-required");
  }

  if (!nonEmptyString(session.normalizedQuery)) {
    errors.push("session:normalized-query-required");
  }

  if (!nonEmptyString(session.queryNodeRef)) {
    errors.push("session:query-node-ref-required");
  }

  if (!enumValues(RESEARCH_ATLAS_SEARCH_MODES).has(session.searchMode)) {
    errors.push("session:search-mode-invalid");
  }

  if (!["collecting", "canonicalizing", "enriching", "settling", "complete", "partial", "failed"]
    .includes(session.state)) {
    errors.push("session:state-invalid");
  }

  if (!isPlainObject(session.filters)) {
    errors.push("session:filters-required");
  }

  if (!isPlainObject(session.sourceRevisions)) {
    errors.push("session:source-revisions-required");
  }

  const forbidden = deepForbiddenKey(session);
  if (forbidden) {
    errors.push("session:forbidden-sensitive-key:" + forbidden);
  }

  if (
    session.searchMode === RESEARCH_ATLAS_SEARCH_MODES.BROWSER_SEMANTIC &&
    session.semantic?.browserOptIn !== true
  ) {
    errors.push("session:browser-semantic-requires-explicit-opt-in");
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateResearchAtlasNode(node) {
  const errors = [];

  if (!isPlainObject(node)) {
    return { ok: false, errors: ["node:not-object"] };
  }

  if (!nonEmptyString(node.id)) {
    errors.push("node:id-required");
  }

  if (!enumValues(RESEARCH_ATLAS_NODE_TYPES).has(node.nodeType)) {
    errors.push("node:type-invalid");
    return { ok: false, errors };
  }

  if (node.nodeType === RESEARCH_ATLAS_NODE_TYPES.QUERY) {
    if (!nonEmptyString(node.rawQuery)) {
      errors.push("query:raw-query-required");
    }
    if (!nonEmptyString(node.normalizedQuery)) {
      errors.push("query:normalized-query-required");
    }
  }

  if (node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK) {
    if (!nonEmptyString(node.title)) {
      errors.push("work:title-required");
    }
    if (
      !isPlainObject(node.identity) ||
      !nonEmptyString(node.identity.key) ||
      !nonEmptyString(node.identity.kind)
    ) {
      errors.push("work:identity-required");
    }
    if (
      !isPlainObject(node.discovery) ||
      typeof node.discovery.directHit !== "boolean" ||
      !stringArray(node.discovery.origins) ||
      !node.discovery.origins.length
    ) {
      errors.push("work:discovery-required");
    } else if (
      node.discovery.directHit &&
      !node.discovery.origins.includes(
        RESEARCH_ATLAS_DISCOVERY_ORIGINS.DIRECT_SEARCH
      )
    ) {
      errors.push("work:direct-hit-must-declare-direct-search-origin");
    }
    if (!stringArray(node.providers) || !node.providers.length) {
      errors.push("work:providers-required");
    }
  }

  if (node.nodeType === RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON) {
    if (!nonEmptyString(node.authorityRef)) {
      errors.push("person:authority-ref-required");
    }
    if (!nonEmptyString(node.displayName)) {
      errors.push("person:display-name-required");
    }
    if (!["confirmed", "probable"].includes(node.resolutionState)) {
      errors.push("person:resolution-state-invalid");
    }
  }

  if (node.nodeType === RESEARCH_ATLAS_NODE_TYPES.AUTHOR_MENTION) {
    if (!nonEmptyString(node.mentionRef)) {
      errors.push("mention:mention-ref-required");
    }
    if (!nonEmptyString(node.rawName)) {
      errors.push("mention:raw-name-required");
    }
    if (!["ambiguous", "unresolved"].includes(node.resolutionState)) {
      errors.push("mention:resolution-state-invalid");
    }
    if (!stringArray(node.sourceRecordRefs) || !node.sourceRecordRefs.length) {
      errors.push("mention:source-record-refs-required");
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateResearchAtlasEvidence(item) {
  const errors = [];

  if (!isPlainObject(item)) {
    return { ok: false, errors: ["evidence:not-object"] };
  }

  if (!nonEmptyString(item.id)) {
    errors.push("evidence:id-required");
  }

  if (!enumValues(RESEARCH_ATLAS_EVIDENCE_CLASSES).has(item.class)) {
    errors.push("evidence:class-invalid");
  }

  if (!nonEmptyString(item.source)) {
    errors.push("evidence:source-required");
  }

  if (!isPlainObject(item.payload)) {
    errors.push("evidence:payload-required");
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function requireEndpoints(edge, fromNode, toNode, fromType, toType, errors) {
  if (fromNode?.nodeType !== fromType || toNode?.nodeType !== toType) {
    errors.push(
      "edge:endpoint-types-invalid:" +
      edge.type +
      ":" +
      (fromNode?.nodeType || "missing") +
      "->" +
      (toNode?.nodeType || "missing")
    );
  }
}

export function validateResearchAtlasEdge(edge, snapshot) {
  const errors = [];

  if (!isPlainObject(edge)) {
    return { ok: false, errors: ["edge:not-object"] };
  }

  if (!nonEmptyString(edge.id)) {
    errors.push("edge:id-required");
  }

  if (!enumValues(RESEARCH_ATLAS_EDGE_TYPES).has(edge.type)) {
    errors.push("edge:type-invalid:" + String(edge.type || ""));
    return { ok: false, errors };
  }

  if (!nonEmptyString(edge.fromRef) || !nonEmptyString(edge.toRef)) {
    errors.push("edge:endpoints-required");
  }

  if (edge.fromRef && edge.toRef && edge.fromRef === edge.toRef) {
    errors.push("edge:self-relation-forbidden");
  }

  if (!enumValues(RESEARCH_ATLAS_EDGE_STATUS).has(edge.status)) {
    errors.push("edge:status-invalid");
  }

  if (!stringArray(edge.evidenceRefs) || !edge.evidenceRefs.length) {
    errors.push("edge:evidence-refs-required");
  }

  const nodes = nodeById(snapshot);
  const evidenceMap = evidenceById(snapshot);
  const fromNode = nodes.get(edge.fromRef);
  const toNode = nodes.get(edge.toRef);
  const evidence = evidenceFor(edge, evidenceMap);

  if (!fromNode || !toNode) {
    errors.push("edge:dangling-node-ref");
    return { ok: false, errors };
  }

  if (evidence.length !== (edge.evidenceRefs || []).length) {
    errors.push("edge:dangling-evidence-ref");
  }

  switch (edge.type) {
    case RESEARCH_ATLAS_EDGE_TYPES.QUERY_RESULT:
      requireEndpoints(
        edge,
        fromNode,
        toNode,
        RESEARCH_ATLAS_NODE_TYPES.QUERY,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        errors
      );
      if (toNode.discovery?.directHit !== true) {
        errors.push("query-result:target-must-be-direct-hit");
      }
      if (
        !hasEvidence(
          evidence,
          RESEARCH_ATLAS_EVIDENCE_CLASSES.FACTUAL,
          item =>
            hasPayloadFields(item, ["provider", "searchPosition", "matchedQuery"])
        )
      ) {
        errors.push("query-result:factual-retrieval-evidence-required");
      }
      break;

    case RESEARCH_ATLAS_EDGE_TYPES.CONTRIBUTION:
      requireEndpoints(
        edge,
        fromNode,
        toNode,
        RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        errors
      );
      if (
        !hasEvidence(
          evidence,
          RESEARCH_ATLAS_EVIDENCE_CLASSES.FACTUAL,
          item =>
            hasPayloadFields(item, ["role", "authorityRef", "sourceRecordRefs"]) &&
            item.payload.authorityRef === fromNode.authorityRef
        )
      ) {
        errors.push("contribution:authority-evidence-required");
      }
      break;

    case RESEARCH_ATLAS_EDGE_TYPES.AUTHOR_MENTION:
      requireEndpoints(
        edge,
        fromNode,
        toNode,
        RESEARCH_ATLAS_NODE_TYPES.AUTHOR_MENTION,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        errors
      );
      if (edge.status !== RESEARCH_ATLAS_EDGE_STATUS.PROVISIONAL) {
        errors.push("author-mention:must-remain-provisional");
      }
      if (
        !hasEvidence(
          evidence,
          RESEARCH_ATLAS_EVIDENCE_CLASSES.PROVISIONAL,
          item => hasPayloadFields(item, ["sourceRecordRefs", "rawRole"])
        )
      ) {
        errors.push("author-mention:provisional-source-evidence-required");
      }
      break;

    case RESEARCH_ATLAS_EDGE_TYPES.SEMANTIC_NEIGHBOR:
      requireEndpoints(
        edge,
        fromNode,
        toNode,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        errors
      );
      if (edge.status !== RESEARCH_ATLAS_EDGE_STATUS.DERIVED) {
        errors.push("semantic-neighbor:must-be-derived");
      }
      if (
        !hasEvidence(
          evidence,
          RESEARCH_ATLAS_EVIDENCE_CLASSES.DERIVED,
          item =>
            hasPayloadFields(
              item,
              ["modelId", "modelRevision", "metric", "score"]
            ) &&
            finiteNumber(item.payload.score)
        )
      ) {
        errors.push("semantic-neighbor:model-evidence-required");
      }
      break;

    case RESEARCH_ATLAS_EDGE_TYPES.LEXICAL_NEIGHBOR:
      requireEndpoints(
        edge,
        fromNode,
        toNode,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        errors
      );
      if (edge.status !== RESEARCH_ATLAS_EDGE_STATUS.DERIVED) {
        errors.push("lexical-neighbor:must-be-derived");
      }
      if (
        !hasEvidence(
          evidence,
          RESEARCH_ATLAS_EVIDENCE_CLASSES.DERIVED,
          item =>
            hasPayloadFields(item, ["method", "score"]) &&
            finiteNumber(item.payload.score)
        )
      ) {
        errors.push("lexical-neighbor:method-evidence-required");
      }
      break;

    case RESEARCH_ATLAS_EDGE_TYPES.SAME_AUTHOR:
      requireEndpoints(
        edge,
        fromNode,
        toNode,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        errors
      );
      if (
        !hasEvidence(
          evidence,
          RESEARCH_ATLAS_EVIDENCE_CLASSES.DERIVED,
          item => hasPayloadFields(item, ["authorityRefs"])
        )
      ) {
        errors.push("same-author:authority-refs-required");
      }
      break;

    case RESEARCH_ATLAS_EDGE_TYPES.COAUTHOR:
      requireEndpoints(
        edge,
        fromNode,
        toNode,
        RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON,
        RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON,
        errors
      );
      if (
        !hasEvidence(
          evidence,
          RESEARCH_ATLAS_EVIDENCE_CLASSES.DERIVED,
          item => hasPayloadFields(item, ["supportWorkRefs"])
        )
      ) {
        errors.push("coauthor:support-work-refs-required");
      }
      break;

    case RESEARCH_ATLAS_EDGE_TYPES.SHARED_COAUTHOR:
      requireEndpoints(
        edge,
        fromNode,
        toNode,
        RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON,
        RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON,
        errors
      );
      if (
        !hasEvidence(
          evidence,
          RESEARCH_ATLAS_EVIDENCE_CLASSES.DERIVED,
          item => hasPayloadFields(item, ["sharedAuthorityRefs", "supportWorkRefs"])
        )
      ) {
        errors.push("shared-coauthor:structured-evidence-required");
      }
      break;

    case RESEARCH_ATLAS_EDGE_TYPES.RELATED_WORK:
      requireEndpoints(
        edge,
        fromNode,
        toNode,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        errors
      );
      if (
        !hasEvidence(
          evidence,
          RESEARCH_ATLAS_EVIDENCE_CLASSES.DERIVED,
          item => hasPayloadFields(item, ["relationEdgeRef", "indexRevision"])
        )
      ) {
        errors.push("related-work:index-evidence-required");
      }
      break;

    case RESEARCH_ATLAS_EDGE_TYPES.CITATION:
      requireEndpoints(
        edge,
        fromNode,
        toNode,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        RESEARCH_ATLAS_NODE_TYPES.WORK,
        errors
      );
      if (
        !hasEvidence(
          evidence,
          RESEARCH_ATLAS_EVIDENCE_CLASSES.FACTUAL,
          item =>
            item.payload?.explicitBibliographicEdge === true &&
            hasPayloadFields(item, ["sourceRecordRefs"])
        )
      ) {
        errors.push("citation:explicit-bibliographic-evidence-required");
      }
      break;
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function validateResearchAtlasSnapshot(snapshot) {
  const errors = [];

  if (!isPlainObject(snapshot)) {
    return { ok: false, errors: ["snapshot:not-object"] };
  }

  if (snapshot.schemaVersion !== RESEARCH_ATLAS_SCHEMA_VERSION) {
    errors.push("snapshot:schema-unsupported");
  }

  const sessionResult = validateResearchAtlasSession(snapshot.session);
  errors.push(...sessionResult.errors);

  if (!Array.isArray(snapshot.nodes)) {
    errors.push("snapshot:nodes-required");
  }

  if (!Array.isArray(snapshot.edges)) {
    errors.push("snapshot:edges-required");
  }

  if (!Array.isArray(snapshot.evidence)) {
    errors.push("snapshot:evidence-required");
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  const nodeIds = new Set();
  const edgeIds = new Set();
  const evidenceIds = new Set();
  const workIdentities = new Set();
  const authorityRefs = new Set();

  for (const node of snapshot.nodes) {
    const result = validateResearchAtlasNode(node);
    errors.push(...result.errors.map(error => node.id + ":" + error));

    if (nodeIds.has(node.id)) {
      errors.push("snapshot:duplicate-node-id:" + node.id);
    }
    nodeIds.add(node.id);

    if (node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK) {
      const identity = node.identity?.key;
      if (identity && workIdentities.has(identity)) {
        errors.push("snapshot:duplicate-work-identity:" + identity);
      }
      if (identity) workIdentities.add(identity);
    }

    if (node.nodeType === RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON) {
      const ref = node.authorityRef;
      if (ref && authorityRefs.has(ref)) {
        errors.push("snapshot:duplicate-authority-ref:" + ref);
      }
      if (ref) authorityRefs.add(ref);
    }
  }

  for (const item of snapshot.evidence) {
    const result = validateResearchAtlasEvidence(item);
    errors.push(...result.errors.map(error => item.id + ":" + error));

    if (evidenceIds.has(item.id)) {
      errors.push("snapshot:duplicate-evidence-id:" + item.id);
    }
    evidenceIds.add(item.id);
  }

  for (const edge of snapshot.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push("snapshot:duplicate-edge-id:" + edge.id);
    }
    edgeIds.add(edge.id);

    const result = validateResearchAtlasEdge(edge, snapshot);
    errors.push(...result.errors.map(error => edge.id + ":" + error));
  }

  const queryNodes = snapshot.nodes.filter(
    node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.QUERY
  );

  if (queryNodes.length !== 1) {
    errors.push("snapshot:exactly-one-query-node-required");
  } else if (snapshot.session.queryNodeRef !== queryNodes[0].id) {
    errors.push("snapshot:session-query-ref-mismatch");
  }

  const queryResultTargets = new Set(
    snapshot.edges
      .filter(edge => edge.type === RESEARCH_ATLAS_EDGE_TYPES.QUERY_RESULT)
      .map(edge => edge.toRef)
  );

  for (const node of snapshot.nodes) {
    if (
      node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK &&
      node.discovery?.directHit === true &&
      !queryResultTargets.has(node.id)
    ) {
      errors.push("snapshot:direct-hit-without-query-result:" + node.id);
    }
  }

  if (isPlainObject(snapshot.diagnostics)) {
    const expected = {
      directHits: snapshot.nodes.filter(
        node =>
          node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK &&
          node.discovery?.directHit === true
      ).length,
      expandedWorks: snapshot.nodes.filter(
        node =>
          node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK &&
          node.discovery?.directHit === false
      ).length,
      authorityPersons: snapshot.nodes.filter(
        node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON
      ).length,
      unresolvedMentions: snapshot.nodes.filter(
        node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.AUTHOR_MENTION
      ).length
    };

    for (const [key, value] of Object.entries(expected)) {
      if (snapshot.diagnostics[key] !== value) {
        errors.push("snapshot:diagnostic-mismatch:" + key);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function assertResearchAtlasSnapshot(snapshot) {
  const result = validateResearchAtlasSnapshot(snapshot);

  if (!result.ok) {
    throw new TypeError(
      "Invalid ResearchAtlasSnapshot:\n" +
      result.errors.join("\n")
    );
  }

  return snapshot;
}

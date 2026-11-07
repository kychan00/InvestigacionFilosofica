import {
  RESEARCH_ATLAS_NODE_TYPES,
  RESEARCH_ATLAS_EDGE_TYPES,
  assertResearchAtlasSnapshot
} from "./research-atlas-contract.js";

export const RESEARCH_ATLAS_LAYOUT_SCHEMA_VERSION = "research-atlas-layout-v1";
export const RESEARCH_ATLAS_LAYOUT_ENGINE_ID = "anchored-force-v1";
export const RESEARCH_ATLAS_LAYOUT_ENGINE_REVISION = "2026-11-07.ra5-v1";

const TAU = Math.PI * 2;
const DEFAULT_ITERATIONS = 180;
const DEFAULT_MAX_EXISTING_DISPLACEMENT = 0.18;
const DEFAULT_COLLISION_RADIUS = 0.16;

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stableObject(value[key])])
  );
}

function stableJson(value) {
  return JSON.stringify(stableObject(value));
}

function fnv1a64(value) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(String(value || ""))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

function hashUnit(value, salt = "") {
  const integer = Number.parseInt(fnv1a64(salt + "|" + value).slice(-8), 16);
  return integer / 0xffffffff;
}

function stableAngle(value, salt = "") {
  return hashUnit(value, salt) * TAU;
}

function finitePoint(value) {
  return Boolean(
    value &&
    Number.isFinite(Number(value.x)) &&
    Number.isFinite(Number(value.y))
  );
}

function point(x = 0, y = 0) {
  return {x: Number(x), y: Number(y)};
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function nodeMap(snapshot) {
  return new Map(snapshot.nodes.map(node => [node.id, node]));
}

function evidenceMap(snapshot) {
  return new Map(snapshot.evidence.map(item => [item.id, item]));
}

function previousCoordinateMap(previousLayout) {
  if (!previousLayout || !Array.isArray(previousLayout.nodes)) return new Map();
  return new Map(
    previousLayout.nodes
      .filter(finitePoint)
      .map(item => [
        item.id,
        {x: Number(item.x), y: Number(item.y), pinned: item.pinned === true}
      ])
  );
}

function pinnedCoordinateMap(pinned = {}) {
  if (pinned instanceof Map) {
    return new Map(
      [...pinned]
        .filter(([, value]) => finitePoint(value))
        .map(([id, value]) => [
          String(id),
          {x: Number(value.x), y: Number(value.y)}
        ])
    );
  }
  if (!isPlainObject(pinned)) return new Map();
  return new Map(
    Object.entries(pinned)
      .filter(([, value]) => finitePoint(value))
      .map(([id, value]) => [
        String(id),
        {x: Number(value.x), y: Number(value.y)}
      ])
  );
}

function workNodes(snapshot) {
  return snapshot.nodes
    .filter(node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function directWorkRadius(node) {
  return node.discovery?.directHit === true ? 0.92 : 1.38;
}

function radialSpawn(node) {
  const angle = stableAngle(node.id, "radial");
  const radius =
    directWorkRadius(node) +
    (hashUnit(node.id, "radial-radius") - 0.5) * 0.24;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    method: "deterministic-ring",
    anchorRef: null
  };
}

function pairKey(leftRef, rightRef) {
  return [leftRef, rightRef].sort().join("|");
}

function evidenceFor(edge, evidenceById) {
  return (edge.evidenceRefs || [])
    .map(ref => evidenceById.get(ref))
    .filter(Boolean);
}

function scoreFromEvidence(edge, evidenceById) {
  for (const item of evidenceFor(edge, evidenceById)) {
    const score = Number(item.payload?.score);
    if (Number.isFinite(score)) {
      return Math.max(0, Math.min(1, score));
    }
  }
  return null;
}

function relatedRelationTypes(edge, evidenceById) {
  for (const item of evidenceFor(edge, evidenceById)) {
    if (Array.isArray(item.payload?.relationTypes)) {
      return [...item.payload.relationTypes];
    }
  }
  return [];
}

function geometryProfile(edge, evidenceById) {
  if (edge.type === RESEARCH_ATLAS_EDGE_TYPES.SEMANTIC_NEIGHBOR) {
    const score = scoreFromEvidence(edge, evidenceById);
    if (score === null) return null;
    return {
      type: "semantic-neighbor",
      priority: 3,
      desired: 0.42 + (1 - score) * 0.72,
      strength: 0.12 + score * 0.16,
      score
    };
  }

  if (edge.type === RESEARCH_ATLAS_EDGE_TYPES.LEXICAL_NEIGHBOR) {
    const score = scoreFromEvidence(edge, evidenceById);
    if (score === null) return null;
    return {
      type: "lexical-neighbor",
      priority: 2,
      desired: 0.72 + (1 - score) * 0.55,
      strength: 0.055 + score * 0.055,
      score
    };
  }

  if (edge.type === RESEARCH_ATLAS_EDGE_TYPES.RELATED_WORK) {
    const relationTypes = relatedRelationTypes(edge, evidenceById);
    const structural = relationTypes.filter(
      type => !["same-author", "shared-coauthor", "semantic-affinity"].includes(type)
    );
    if (!structural.length) return null;
    return {
      type: "related-work",
      priority: 1,
      desired: 1.02,
      strength: 0.045,
      score: null
    };
  }

  return null;
}

function buildGeometryEdges(snapshot) {
  const nodesById = nodeMap(snapshot);
  const evidenceById = evidenceMap(snapshot);
  const selected = new Map();

  for (const edge of [...snapshot.edges].sort((a, b) => a.id.localeCompare(b.id))) {
    const from = nodesById.get(edge.fromRef);
    const to = nodesById.get(edge.toRef);
    if (
      from?.nodeType !== RESEARCH_ATLAS_NODE_TYPES.WORK ||
      to?.nodeType !== RESEARCH_ATLAS_NODE_TYPES.WORK
    ) {
      continue;
    }

    const profile = geometryProfile(edge, evidenceById);
    if (!profile) continue;

    const key = pairKey(edge.fromRef, edge.toRef);
    const previous = selected.get(key);
    if (!previous || profile.priority > previous.priority) {
      selected.set(key, {
        id: edge.id,
        fromRef: edge.fromRef,
        toRef: edge.toRef,
        ...profile
      });
    }
  }

  return [...selected.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function adjacencyMap(geometryEdges) {
  const adjacency = new Map();
  for (const edge of geometryEdges) {
    for (const [source, target] of [
      [edge.fromRef, edge.toRef],
      [edge.toRef, edge.fromRef]
    ]) {
      if (!adjacency.has(source)) adjacency.set(source, []);
      adjacency.get(source).push({targetRef: target, edge});
    }
  }

  for (const values of adjacency.values()) {
    values.sort(
      (a, b) =>
        b.edge.priority - a.edge.priority ||
        (b.edge.score ?? -1) - (a.edge.score ?? -1) ||
        a.targetRef.localeCompare(b.targetRef)
    );
  }
  return adjacency;
}

function neighborSpawn(node, positions, adjacency) {
  for (const item of adjacency.get(node.id) || []) {
    const anchor = positions.get(item.targetRef);
    if (!anchor) continue;
    const angle = stableAngle(node.id + "|" + item.targetRef, "neighbor-spawn");
    const radius = Math.max(0.24, Math.min(0.55, item.edge.desired * 0.55));
    return {
      x: anchor.x + Math.cos(angle) * radius,
      y: anchor.y + Math.sin(angle) * radius,
      method: "neighbor",
      anchorRef: item.targetRef
    };
  }
  return null;
}

function initializeWorkPositions(snapshot, {previousLayout, pinned}) {
  const previous = previousCoordinateMap(previousLayout);
  const pinnedMap = pinnedCoordinateMap(pinned);
  const geometryEdges = buildGeometryEdges(snapshot);
  const adjacency = adjacencyMap(geometryEdges);
  const positions = new Map();
  const spawnInfo = new Map();
  const anchors = new Map();
  const pinnedRefs = new Set();
  const works = workNodes(snapshot);

  for (const node of works) {
    const explicitPin = pinnedMap.get(node.id);
    if (explicitPin) {
      positions.set(node.id, point(explicitPin.x, explicitPin.y));
      anchors.set(node.id, point(explicitPin.x, explicitPin.y));
      pinnedRefs.add(node.id);
      spawnInfo.set(node.id, {method: "pinned", anchorRef: null});
      continue;
    }

    const prior = previous.get(node.id);
    if (prior) {
      positions.set(node.id, point(prior.x, prior.y));
      anchors.set(node.id, point(prior.x, prior.y));
      if (prior.pinned) pinnedRefs.add(node.id);
      spawnInfo.set(node.id, {
        method: prior.pinned ? "previous-pinned" : "previous",
        anchorRef: null
      });
    }
  }

  for (const node of works.filter(
    item => item.discovery?.directHit === true && !positions.has(item.id)
  )) {
    const initial = radialSpawn(node);
    positions.set(node.id, point(initial.x, initial.y));
    spawnInfo.set(node.id, {
      method: initial.method,
      anchorRef: initial.anchorRef
    });
  }

  for (const node of works.filter(item => !positions.has(item.id))) {
    const initial = neighborSpawn(node, positions, adjacency) || radialSpawn(node);
    positions.set(node.id, point(initial.x, initial.y));
    spawnInfo.set(node.id, {
      method: initial.method,
      anchorRef: initial.anchorRef
    });
  }

  return {
    works,
    positions,
    spawnInfo,
    anchors,
    pinnedRefs,
    geometryEdges
  };
}

function deterministicDirection(leftRef, rightRef) {
  const angle = stableAngle(pairKey(leftRef, rightRef), "collision");
  return {x: Math.cos(angle), y: Math.sin(angle)};
}

function clampToAnchor(current, anchor, maximum) {
  const dx = current.x - anchor.x;
  const dy = current.y - anchor.y;
  const length = Math.hypot(dx, dy);
  if (length <= maximum || length === 0) return current;
  const scale = maximum / length;
  return {
    x: anchor.x + dx * scale,
    y: anchor.y + dy * scale
  };
}

function simulateWorks(
  state,
  {iterations, maxExistingDisplacement, collisionRadius}
) {
  const {works, positions, anchors, pinnedRefs, geometryEdges} = state;
  const workRefs = works.map(node => node.id);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const delta = new Map(workRefs.map(ref => [ref, point(0, 0)]));

    for (const edge of geometryEdges) {
      const from = positions.get(edge.fromRef);
      const to = positions.get(edge.toRef);
      if (!from || !to) continue;

      let dx = to.x - from.x;
      let dy = to.y - from.y;
      let length = Math.hypot(dx, dy);

      if (length < 1e-8) {
        const direction = deterministicDirection(edge.fromRef, edge.toRef);
        dx = direction.x * 1e-4;
        dy = direction.y * 1e-4;
        length = 1e-4;
      }

      const spring = (length - edge.desired) * edge.strength * 0.18;
      const ux = dx / length;
      const uy = dy / length;
      const fromDelta = delta.get(edge.fromRef);
      const toDelta = delta.get(edge.toRef);
      fromDelta.x += ux * spring;
      fromDelta.y += uy * spring;
      toDelta.x -= ux * spring;
      toDelta.y -= uy * spring;
    }

    for (let left = 0; left < workRefs.length; left += 1) {
      for (let right = left + 1; right < workRefs.length; right += 1) {
        const leftRef = workRefs[left];
        const rightRef = workRefs[right];
        const a = positions.get(leftRef);
        const b = positions.get(rightRef);

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let length = Math.hypot(dx, dy);

        if (length < 1e-8) {
          const direction = deterministicDirection(leftRef, rightRef);
          dx = direction.x * 1e-4;
          dy = direction.y * 1e-4;
          length = 1e-4;
        }

        const softRadius = collisionRadius * 2.2;
        if (length >= softRadius) continue;

        const pressure = (softRadius - length) * 0.075;
        const ux = dx / length;
        const uy = dy / length;
        const leftDelta = delta.get(leftRef);
        const rightDelta = delta.get(rightRef);
        leftDelta.x -= ux * pressure;
        leftDelta.y -= uy * pressure;
        rightDelta.x += ux * pressure;
        rightDelta.y += uy * pressure;
      }
    }

    for (const ref of workRefs) {
      if (pinnedRefs.has(ref)) continue;

      const current = positions.get(ref);
      const movement = delta.get(ref);
      movement.x += -current.x * 0.0018;
      movement.y += -current.y * 0.0018;

      const anchor = anchors.get(ref);
      if (anchor) {
        movement.x += (anchor.x - current.x) * 0.065;
        movement.y += (anchor.y - current.y) * 0.065;
      }

      const candidate = {
        x: current.x + Math.max(-0.045, Math.min(0.045, movement.x)),
        y: current.y + Math.max(-0.045, Math.min(0.045, movement.y))
      };

      positions.set(
        ref,
        anchor
          ? clampToAnchor(candidate, anchor, maxExistingDisplacement)
          : candidate
      );
    }
  }

  for (const ref of pinnedRefs) {
    const anchor = anchors.get(ref);
    if (anchor) positions.set(ref, point(anchor.x, anchor.y));
  }
}

function relatedWorksForPerson(snapshot, personNode) {
  return snapshot.edges
    .filter(
      edge =>
        edge.type === RESEARCH_ATLAS_EDGE_TYPES.CONTRIBUTION &&
        edge.fromRef === personNode.id
    )
    .map(edge => edge.toRef)
    .sort();
}

function relatedWorksForMention(snapshot, mentionNode) {
  return snapshot.edges
    .filter(
      edge =>
        edge.type === RESEARCH_ATLAS_EDGE_TYPES.AUTHOR_MENTION &&
        edge.fromRef === mentionNode.id
    )
    .map(edge => edge.toRef)
    .sort();
}

function barycenter(refs, positions) {
  const points = refs.map(ref => positions.get(ref)).filter(Boolean);
  if (!points.length) return null;
  return {
    x: points.reduce((sum, value) => sum + value.x, 0) / points.length,
    y: points.reduce((sum, value) => sum + value.y, 0) / points.length
  };
}

function satelliteTarget(node, center, radius, salt) {
  const angle = stableAngle(node.id, salt);
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius
  };
}

function stabilizeSecondaryPoint(target, previous, maximum) {
  if (!previous) return target;
  return clampToAnchor(
    {
      x: previous.x * 0.78 + target.x * 0.22,
      y: previous.y * 0.78 + target.y * 0.22
    },
    previous,
    maximum
  );
}

function layoutSecondaryNodes(
  snapshot,
  workPositions,
  {previousLayout, pinned, maxExistingDisplacement}
) {
  const previous = previousCoordinateMap(previousLayout);
  const pinnedMap = pinnedCoordinateMap(pinned);
  const positions = new Map(workPositions);
  const records = [];

  const persons = snapshot.nodes
    .filter(node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const node of persons) {
    const explicitPin = pinnedMap.get(node.id);
    const refs = relatedWorksForPerson(snapshot, node);
    const center = barycenter(refs, positions) || point(0, 0);
    const target =
      explicitPin ||
      satelliteTarget(
        node,
        center,
        refs.length > 1 ? 0.24 : 0.31,
        "authority-satellite"
      );
    const prior = previous.get(node.id);
    const finalPoint = explicitPin
      ? target
      : stabilizeSecondaryPoint(target, prior, maxExistingDisplacement);
    positions.set(node.id, point(finalPoint.x, finalPoint.y));
    records.push({
      id: node.id,
      nodeType: node.nodeType,
      x: finalPoint.x,
      y: finalPoint.y,
      pinned: Boolean(explicitPin || prior?.pinned),
      spawn: {
        method: explicitPin
          ? "pinned"
          : prior
            ? "previous-satellite"
            : "authority-barycenter",
        anchorRef: refs[0] || null
      }
    });
  }

  const mentions = snapshot.nodes
    .filter(node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.AUTHOR_MENTION)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const node of mentions) {
    const explicitPin = pinnedMap.get(node.id);
    const refs = relatedWorksForMention(snapshot, node);
    const center = barycenter(refs, positions) || point(0, 0);
    const target =
      explicitPin ||
      satelliteTarget(node, center, 0.22, "mention-satellite");
    const prior = previous.get(node.id);
    const finalPoint = explicitPin
      ? target
      : stabilizeSecondaryPoint(target, prior, maxExistingDisplacement);
    positions.set(node.id, point(finalPoint.x, finalPoint.y));
    records.push({
      id: node.id,
      nodeType: node.nodeType,
      x: finalPoint.x,
      y: finalPoint.y,
      pinned: Boolean(explicitPin || prior?.pinned),
      spawn: {
        method: explicitPin
          ? "pinned"
          : prior
            ? "previous-satellite"
            : "mention-satellite",
        anchorRef: refs[0] || null
      }
    });
  }

  return {positions, records};
}

function queryRecord(snapshot, {pinned}) {
  const query = snapshot.nodes.find(
    node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.QUERY
  );
  const explicit = pinnedCoordinateMap(pinned).get(query.id);
  return {
    id: query.id,
    nodeType: query.nodeType,
    x: explicit?.x ?? 0,
    y: explicit?.y ?? 0,
    pinned: true,
    spawn: {
      method: explicit ? "pinned" : "query-origin",
      anchorRef: null
    }
  };
}

function workRecords(state) {
  return state.works.map(node => {
    const value = state.positions.get(node.id);
    return {
      id: node.id,
      nodeType: node.nodeType,
      x: value.x,
      y: value.y,
      pinned: state.pinnedRefs.has(node.id),
      spawn:
        state.spawnInfo.get(node.id) ||
        {method: "unknown", anchorRef: null}
    };
  });
}

function viewportFor(nodes) {
  if (!nodes.length) {
    return {
      minX: -1, maxX: 1, minY: -1, maxY: 1,
      centerX: 0, centerY: 0, width: 2, height: 2, padding: 0.24
    };
  }
  const xs = nodes.map(node => node.x);
  const ys = nodes.map(node => node.y);
  const padding = 0.24;
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  return {
    minX, maxX, minY, maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
    padding
  };
}

function displacementMetrics(nodes, previousLayout) {
  const previous = previousCoordinateMap(previousLayout);
  const values = [];
  for (const node of nodes) {
    const prior = previous.get(node.id);
    if (prior) values.push(distance(node, prior));
  }
  return {
    reusedNodes: values.length,
    mean: values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0,
    max: values.length ? Math.max(...values) : 0
  };
}

function overlapPairs(nodes, radius = DEFAULT_COLLISION_RADIUS) {
  const works = nodes.filter(
    node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK
  );
  let count = 0;
  for (let left = 0; left < works.length; left += 1) {
    for (let right = left + 1; right < works.length; right += 1) {
      if (distance(works[left], works[right]) < radius) count += 1;
    }
  }
  return count;
}

function geometryEdgeMetrics(geometryEdges) {
  const counts = {
    "semantic-neighbor": 0,
    "lexical-neighbor": 0,
    "related-work": 0
  };
  for (const edge of geometryEdges) counts[edge.type] += 1;
  return counts;
}

export function validateResearchAtlasLayout(layout, snapshot) {
  const errors = [];
  if (!isPlainObject(layout)) {
    return {ok: false, errors: ["layout:not-object"]};
  }
  if (layout.schemaVersion !== RESEARCH_ATLAS_LAYOUT_SCHEMA_VERSION) {
    errors.push("layout:schema-invalid");
  }
  if (layout.sessionRef !== snapshot.session.id) {
    errors.push("layout:session-ref-mismatch");
  }
  if (!Array.isArray(layout.nodes)) {
    errors.push("layout:nodes-required");
    return {ok: false, errors};
  }

  const expected = new Set(snapshot.nodes.map(node => node.id));
  const seen = new Set();

  for (const node of layout.nodes) {
    if (!expected.has(node.id)) errors.push("layout:unknown-node:" + node.id);
    if (seen.has(node.id)) errors.push("layout:duplicate-node:" + node.id);
    seen.add(node.id);
    if (!finitePoint(node)) errors.push("layout:coordinate-invalid:" + node.id);
  }

  for (const ref of expected) {
    if (!seen.has(ref)) errors.push("layout:missing-node:" + ref);
  }

  const query = snapshot.nodes.find(
    node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.QUERY
  );
  const queryLayout = layout.nodes.find(node => node.id === query.id);
  if (!queryLayout || queryLayout.pinned !== true) {
    errors.push("layout:query-anchor-required");
  }

  return {ok: errors.length === 0, errors};
}

export function assertResearchAtlasLayout(layout, snapshot) {
  const result = validateResearchAtlasLayout(layout, snapshot);
  if (!result.ok) {
    throw new TypeError(
      "Invalid ResearchAtlasLayout:\n" + result.errors.join("\n")
    );
  }
  return layout;
}

export function buildResearchAtlasLayout(
  snapshot,
  {
    previousLayout = null,
    pinned = {},
    iterations = DEFAULT_ITERATIONS,
    maxExistingDisplacement = DEFAULT_MAX_EXISTING_DISPLACEMENT,
    collisionRadius = DEFAULT_COLLISION_RADIUS
  } = {}
) {
  assertResearchAtlasSnapshot(snapshot);

  const safeIterations = Math.max(
    1,
    Math.min(1000, Math.floor(Number(iterations) || DEFAULT_ITERATIONS))
  );
  const safeMaximum = Math.max(
    0,
    Math.min(
      1,
      Number(maxExistingDisplacement) || DEFAULT_MAX_EXISTING_DISPLACEMENT
    )
  );
  const safeCollision = Math.max(
    0.04,
    Math.min(0.5, Number(collisionRadius) || DEFAULT_COLLISION_RADIUS)
  );

  const state = initializeWorkPositions(snapshot, {previousLayout, pinned});
  simulateWorks(state, {
    iterations: safeIterations,
    maxExistingDisplacement: safeMaximum,
    collisionRadius: safeCollision
  });

  const works = workRecords(state);
  const secondary = layoutSecondaryNodes(snapshot, state.positions, {
    previousLayout,
    pinned,
    maxExistingDisplacement: safeMaximum
  });
  const query = queryRecord(snapshot, {pinned});
  const nodes = [query, ...works, ...secondary.records].sort(
    (a, b) => a.id.localeCompare(b.id)
  );

  const movement = displacementMetrics(nodes, previousLayout);
  const layout = {
    schemaVersion: RESEARCH_ATLAS_LAYOUT_SCHEMA_VERSION,
    sessionRef: snapshot.session.id,
    graphRevision: snapshot.session.graphRevision ?? null,
    engine: {
      id: RESEARCH_ATLAS_LAYOUT_ENGINE_ID,
      revision: RESEARCH_ATLAS_LAYOUT_ENGINE_REVISION,
      deterministic: true,
      iterations: safeIterations,
      maxExistingDisplacement: safeMaximum,
      collisionRadius: safeCollision
    },
    nodes,
    viewport: viewportFor(nodes),
    diagnostics: {
      workNodes: works.length,
      authorityPersons: snapshot.nodes.filter(
        node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON
      ).length,
      authorMentions: snapshot.nodes.filter(
        node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.AUTHOR_MENTION
      ).length,
      geometryEdges: geometryEdgeMetrics(state.geometryEdges),
      previousNodesReused: movement.reusedNodes,
      meanExistingDisplacement: movement.mean,
      maxExistingDisplacement: movement.max,
      overlapPairs: overlapPairs(nodes, safeCollision),
      spawnNearNeighbor: works.filter(
        node => node.spawn?.method === "neighbor"
      ).length,
      pinnedNodes: nodes.filter(node => node.pinned === true).length
    }
  };

  return assertResearchAtlasLayout(layout, snapshot);
}

export function researchAtlasLayoutSignature(layout) {
  return stableJson({
    schemaVersion: layout?.schemaVersion,
    engine: layout?.engine?.revision,
    nodes: (layout?.nodes || [])
      .map(node => ({
        id: node.id,
        x: Number(node.x),
        y: Number(node.y),
        pinned: node.pinned === true
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  });
}

export function measureResearchAtlasLayout(
  snapshot,
  layout,
  {previousLayout = null} = {}
) {
  assertResearchAtlasLayout(layout, snapshot);
  const coordinates = new Map(layout.nodes.map(node => [node.id, node]));
  const geometryEdges = buildGeometryEdges(snapshot);
  const byType = {};

  for (const edge of geometryEdges) {
    const from = coordinates.get(edge.fromRef);
    const to = coordinates.get(edge.toRef);
    if (!from || !to) continue;
    if (!byType[edge.type]) byType[edge.type] = [];
    byType[edge.type].push(distance(from, to));
  }

  const edgeLengths = Object.fromEntries(
    Object.entries(byType).map(([type, values]) => [
      type,
      {
        count: values.length,
        mean: values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : null,
        max: values.length ? Math.max(...values) : null
      }
    ])
  );

  const movement = displacementMetrics(layout.nodes, previousLayout);
  return {
    schemaVersion: "research-atlas-layout-metrics-v1",
    nodeCount: layout.nodes.length,
    workNodeCount: snapshot.nodes.filter(
      node => node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK
    ).length,
    edgeLengths,
    overlaps: overlapPairs(layout.nodes, layout.engine.collisionRadius),
    previousNodesReused: movement.reusedNodes,
    meanExistingDisplacement: movement.mean,
    maxExistingDisplacement: movement.max,
    viewport: JSON.parse(JSON.stringify(layout.viewport))
  };
}

export class ResearchAtlasLayoutEngine {
  constructor(options = {}) {
    this.options = JSON.parse(JSON.stringify(options));
    this.currentLayout = null;
  }

  layout(snapshot, options = {}) {
    this.currentLayout = buildResearchAtlasLayout(snapshot, {
      ...this.options,
      ...options,
      previousLayout:
        options.previousLayout ?? this.currentLayout
    });
    return JSON.parse(JSON.stringify(this.currentLayout));
  }

  snapshot() {
    return this.currentLayout
      ? JSON.parse(JSON.stringify(this.currentLayout))
      : null;
  }

  reset() {
    this.currentLayout = null;
  }
}

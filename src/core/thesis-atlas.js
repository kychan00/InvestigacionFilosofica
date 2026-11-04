import {
  approvedInstitutionalUrl,
  normalized,
} from "./thesis-demo-search.js?v=20261104-t2ch";

export const ATLAS_SCHEMA = "thesis-atlas-index-v1";
export const ATLAS_NODES = 566;
export const ATLAS_SOURCE = "thesis-effective-corpus-v2";

export function validateAtlas(payload) {
  if (
    !payload ||
    payload.schemaVersion !== ATLAS_SCHEMA ||
    payload.sourceRelease !== ATLAS_SOURCE ||
    payload.referenceOnly !== true ||
    payload.methodStatus !== "experimental-not-benchmark-approved" ||
    payload.topologyInputContract?.version !== "normalized-title-v1" ||
    JSON.stringify(payload.topologyInputContract?.fields) !== JSON.stringify(["title"]) ||
    !Array.isArray(payload.nodes) ||
    payload.nodes.length !== ATLAS_NODES ||
    !Array.isArray(payload.clusters)
  ) {
    throw new Error("El Atlas no coincide con el contrato experimental V1.");
  }

  const ids = new Set(payload.nodes.map(node => node.id));
  if (ids.size !== ATLAS_NODES) {
    throw new Error("El Atlas contiene identidades duplicadas.");
  }

  for (const node of payload.nodes) {
    const x = Number(node.atlas?.x);
    const y = Number(node.atlas?.y);
    if (
      !node.id?.startsWith("thesis:work:") ||
      !node.title ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) > 1.01 ||
      Math.abs(y) > 1.01 ||
      node.topology?.inputContractVersion !== "normalized-title-v1" ||
      node.neighborhood?.k !== 8 ||
      !Array.isArray(node.neighborhood?.neighborRefs) ||
      node.neighborhood.neighborRefs.length !== 8 ||
      node.neighborhood.neighborRefs.some(ref => !ids.has(ref) || ref === node.id)
    ) {
      throw new Error("El Atlas contiene un nodo inválido.");
    }
    if (node.sourceUrl && !approvedInstitutionalUrl(node.sourceUrl)) {
      throw new Error("El Atlas contiene un enlace no institucional.");
    }
  }

  const clusterIds = new Set(payload.clusters.map(cluster => cluster.id));
  for (const node of payload.nodes) {
    for (const ref of node.atlas.clusterRefs || []) {
      if (!clusterIds.has(ref)) {
        throw new Error("El Atlas contiene una región inexistente.");
      }
    }
  }
  return payload;
}

export function atlasSearch(nodes, query) {
  const terms = normalized(query).split(" ").filter(Boolean);
  if (!terms.length) return nodes;
  return nodes.filter(node => {
    const text = normalized([
      node.title,
      ...(node.authors || []),
      node.program,
      node.degree,
      node.unit,
      ...(node.keywords || []),
    ].join(" "));
    return terms.every(term => text.includes(term));
  });
}

export function atlasNodeMap(nodes) {
  return new Map(nodes.map(node => [node.id, node]));
}

export function atlasClusterMap(clusters) {
  return new Map(clusters.map(cluster => [cluster.id, cluster]));
}

export function proposedClusterLabel(cluster) {
  const first = cluster?.proposedLabels?.[0];
  return first?.status === "proposed" && first.label
    ? first.label
    : "Región sin etiqueta";
}

export function atlasYearExtent(nodes) {
  const years = nodes.map(node => node.year).filter(Number.isFinite);
  if (!years.length) return [null, null];
  return [Math.min(...years), Math.max(...years)];
}

export function stableHue(value) {
  const input = String(value || "sin-dato");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 360;
}

export function overlayColor(node, mode, {
  clusterById = new Map(),
  minYear = null,
  maxYear = null,
} = {}) {
  if (mode === "degree") {
    const hues = {
      licenciatura: 212,
      maestria: 282,
      doctorado: 28,
    };
    return `hsl(${hues[node.degree] ?? 198} 68% 56%)`;
  }
  if (mode === "program") {
    return `hsl(${stableHue(node.programRef || node.program)} 61% 56%)`;
  }
  if (mode === "period") {
    const year = Number(node.year);
    if (!Number.isFinite(year) || !Number.isFinite(minYear) || !Number.isFinite(maxYear)) {
      return "hsl(215 8% 58%)";
    }
    const span = Math.max(1, maxYear - minYear);
    const t = Math.max(0, Math.min(1, (year - minYear) / span));
    const hue = 220 - t * 180;
    return `hsl(${hue.toFixed(1)} 68% 56%)`;
  }
  const clusterRef = node.atlas?.clusterRefs?.[0];
  if (!clusterRef) return "hsl(215 8% 58%)";
  const cluster = clusterById.get(clusterRef);
  return `hsl(${stableHue(cluster?.id || clusterRef)} 62% 56%)`;
}

export function neighborEntries(node, nodesById) {
  const refs = node?.neighborhood?.neighborRefs || [];
  const values = node?.neighborhood?.similarityValues || [];
  return refs.map((ref, index) => ({
    node: nodesById.get(ref),
    similarity: Number(values[index]),
  })).filter(item => item.node && Number.isFinite(item.similarity));
}

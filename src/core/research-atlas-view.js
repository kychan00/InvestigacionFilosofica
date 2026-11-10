import {
  RESEARCH_ATLAS_NODE_TYPES,
  RESEARCH_ATLAS_EDGE_TYPES
} from "./research-atlas-contract.js";

import {
  assertResearchAtlasLayout
} from "./research-atlas-layout.js";


export const RESEARCH_ATLAS_VIEW_SCHEMA_VERSION =
  "research-atlas-view-v1";

export const RESEARCH_ATLAS_VIEW_REVISION =
  "2026-11-09.react-flow-temporal-v1";


const DEFAULT_EDGE_TYPES = Object.freeze([
  RESEARCH_ATLAS_EDGE_TYPES.SEMANTIC_NEIGHBOR,
  RESEARCH_ATLAS_EDGE_TYPES.RELATED_WORK,
  RESEARCH_ATLAS_EDGE_TYPES.LEXICAL_NEIGHBOR,
  RESEARCH_ATLAS_EDGE_TYPES.CONTRIBUTION,
  RESEARCH_ATLAS_EDGE_TYPES.AUTHOR_MENTION
]);


function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}


function nodeKind(node) {
  if (
    node.nodeType ===
    RESEARCH_ATLAS_NODE_TYPES.WORK
  ) {
    return node.discovery?.directHit === true
      ? "work-direct"
      : "work-expanded";
  }

  if (
    node.nodeType ===
    RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON
  ) {
    return "authority-person";
  }

  if (
    node.nodeType ===
    RESEARCH_ATLAS_NODE_TYPES.AUTHOR_MENTION
  ) {
    return "author-mention";
  }

  return "query";
}


function nodeLabel(node) {
  if (node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK) {
    return node.title || "Obra sin título";
  }

  if (
    node.nodeType ===
    RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON
  ) {
    return node.displayName || "Autor";
  }

  if (
    node.nodeType ===
    RESEARCH_ATLAS_NODE_TYPES.AUTHOR_MENTION
  ) {
    return node.rawName || "Mención de autor";
  }

  return node.rawQuery || "Consulta";
}


function nodeSubtitle(node) {
  if (node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK) {
    return [
      node.year,
      ...(node.providers || []).slice(0, 2)
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (
    node.nodeType ===
    RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON
  ) {
    return node.resolutionState === "confirmed"
      ? "Autoridad confirmada"
      : "Autoridad probable";
  }

  if (
    node.nodeType ===
    RESEARCH_ATLAS_NODE_TYPES.AUTHOR_MENTION
  ) {
    return node.resolutionState === "ambiguous"
      ? "Mención ambigua"
      : "Mención no resuelta";
  }

  return "Consulta actual";
}


function evidenceMap(snapshot) {
  return new Map(
    snapshot.evidence.map(item => [item.id, item])
  );
}


function evidenceClasses(edge, evidenceById) {
  return [
    ...new Set(
      (edge.evidenceRefs || [])
        .map(ref => evidenceById.get(ref)?.class)
        .filter(Boolean)
    )
  ];
}


function edgeVisualType(edge) {
  switch (edge.type) {
    case RESEARCH_ATLAS_EDGE_TYPES.SEMANTIC_NEIGHBOR:
      return "semantic";
    case RESEARCH_ATLAS_EDGE_TYPES.RELATED_WORK:
      return "related";
    case RESEARCH_ATLAS_EDGE_TYPES.LEXICAL_NEIGHBOR:
      return "lexical";
    case RESEARCH_ATLAS_EDGE_TYPES.CONTRIBUTION:
      return "contribution";
    case RESEARCH_ATLAS_EDGE_TYPES.AUTHOR_MENTION:
      return "provisional";
    case RESEARCH_ATLAS_EDGE_TYPES.QUERY_RESULT:
      return "retrieval";
    case RESEARCH_ATLAS_EDGE_TYPES.SAME_AUTHOR:
      return "same-author";
    case RESEARCH_ATLAS_EDGE_TYPES.COAUTHOR:
      return "coauthor";
    case RESEARCH_ATLAS_EDGE_TYPES.SHARED_COAUTHOR:
      return "shared-coauthor";
    case RESEARCH_ATLAS_EDGE_TYPES.CITATION:
      return "citation";
    default:
      return "other";
  }
}


function edgeLabel(edge) {
  const labels = {
    "semantic-neighbor": "Vecindad semántica",
    "related-work": "Obra relacionada",
    "lexical-neighbor": "Similitud título + abstract",
    "contribution": "Contribución confirmada",
    "author-mention": "Mención provisional",
    "query-result": "Resultado directo",
    "same-author": "Autor compartido",
    "coauthor": "Coautoría",
    "shared-coauthor": "Coautor compartido",
    "citation": "Citación documentada"
  };

  return labels[edge.type] || edge.type;
}


function semanticScore(edge, evidenceById) {
  if (
    edge.type !==
    RESEARCH_ATLAS_EDGE_TYPES.SEMANTIC_NEIGHBOR
  ) {
    return null;
  }

  for (const ref of edge.evidenceRefs || []) {
    const score = Number(
      evidenceById.get(ref)?.payload?.score
    );

    if (Number.isFinite(score)) {
      return score;
    }
  }

  return null;
}


function whyNode(node) {
  if (node.nodeType === RESEARCH_ATLAS_NODE_TYPES.QUERY) {
    return [
      "Representa la consulta actual.",
      "No ejerce fuerza semántica sobre las obras."
    ];
  }

  if (node.nodeType === RESEARCH_ATLAS_NODE_TYPES.WORK) {
    const output = [];

    if (node.discovery?.directHit === true) {
      output.push("Resultado directo de la búsqueda.");
    } else {
      output.push("Descubierta por expansión de obras relacionadas.");
    }

    if ((node.providers || []).length) {
      output.push(
        "Fuente: " +
        node.providers.join(", ") +
        "."
      );
    }

    if (
      node.relatedDiscovery?.seedWorkRefs?.length
    ) {
      output.push(
        "Conectada desde " +
        node.relatedDiscovery.seedWorkRefs.length +
        " obra(s) visible(s)."
      );
    }

    return output;
  }

  if (
    node.nodeType ===
    RESEARCH_ATLAS_NODE_TYPES.AUTHORITY_PERSON
  ) {
    return [
      "Persona resuelta por Author Authority Graph.",
      "Su posición es satélite de sus obras y no modifica la topología."
    ];
  }

  return [
    node.resolutionState === "ambiguous"
      ? "Mención de autor ambigua."
      : "Mención de autor todavía no resuelta.",
    "No se presenta como persona confirmada."
  ];
}


export function buildResearchAtlasViewModel(
  snapshot,
  layout,
  {
    edgeTypes = DEFAULT_EDGE_TYPES,
    includeQuery = true
  } = {}
) {
  assertResearchAtlasLayout(layout, snapshot);

  const layoutById =
    new Map(
      layout.nodes.map(item => [item.id, item])
    );

  const evidenceById =
    evidenceMap(snapshot);

  const enabledEdgeTypes =
    new Set(edgeTypes);

  const nodes =
    snapshot.nodes
      .filter(
        node =>
          includeQuery ||
          node.nodeType !==
            RESEARCH_ATLAS_NODE_TYPES.QUERY
      )
      .map(node => {
        const coordinates =
          layoutById.get(node.id);

        return {
          id: node.id,
          nodeType: node.nodeType,
          kind: nodeKind(node),
          label: nodeLabel(node),
          subtitle: nodeSubtitle(node),
          year:
            node.nodeType ===
              RESEARCH_ATLAS_NODE_TYPES.WORK &&
            Number.isFinite(Number(node.year))
              ? Number(node.year)
              : null,
          x: coordinates.x,
          y: coordinates.y,
          pinned: coordinates.pinned === true,
          spawn: coordinates.spawn || null,
          directHit:
            node.nodeType ===
              RESEARCH_ATLAS_NODE_TYPES.WORK
              ? node.discovery?.directHit === true
              : null,
          identity:
            node.identity?.key || null,
          providers:
            [...(node.providers || [])],
          why: whyNode(node)
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

  const visibleNodeIds =
    new Set(nodes.map(node => node.id));

  const edges =
    snapshot.edges
      .filter(edge => enabledEdgeTypes.has(edge.type))
      .filter(
        edge =>
          visibleNodeIds.has(edge.fromRef) &&
          visibleNodeIds.has(edge.toRef)
      )
      .map(edge => ({
        id: edge.id,
        type: edge.type,
        visualType: edgeVisualType(edge),
        label: edgeLabel(edge),
        fromRef: edge.fromRef,
        toRef: edge.toRef,
        status: edge.status,
        evidenceClasses:
          evidenceClasses(edge, evidenceById),
        semanticScore:
          semanticScore(edge, evidenceById)
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion:
      RESEARCH_ATLAS_VIEW_SCHEMA_VERSION,
    revision:
      RESEARCH_ATLAS_VIEW_REVISION,
    sessionRef:
      snapshot.session.id,
    query:
      snapshot.session.rawQuery,
    state:
      snapshot.session.state,
    graphRevision:
      snapshot.session.graphRevision ?? null,
    layoutRevision:
      layout.engine.revision,
    sourceRevisions:
      structuredClone(
        snapshot.session.sourceRevisions || {}
      ),
    nodes,
    edges,
    viewport:
      structuredClone(layout.viewport),
    diagnostics: {
      nodes:
        nodes.length,
      edges:
        edges.length,
      directWorks:
        nodes.filter(
          node => node.kind === "work-direct"
        ).length,
      expandedWorks:
        nodes.filter(
          node => node.kind === "work-expanded"
        ).length,
      authorities:
        nodes.filter(
          node => node.kind === "authority-person"
        ).length,
      mentions:
        nodes.filter(
          node => node.kind === "author-mention"
        ).length
    }
  };
}


export function filterResearchAtlasViewModel(
  viewModel,
  query
) {
  const terms =
    normalize(query)
      .split(/\s+/)
      .filter(Boolean);

  if (!terms.length) {
    return {
      query: "",
      visibleNodeIds:
        new Set(
          viewModel.nodes.map(node => node.id)
        ),
      visibleEdgeIds:
        new Set(
          viewModel.edges.map(edge => edge.id)
        )
    };
  }

  const visibleNodeIds =
    new Set(
      viewModel.nodes
        .filter(node => {
          const haystack =
            normalize(
              [
                node.label,
                node.subtitle,
                node.identity,
                ...(node.providers || [])
              ].join(" ")
            );

          return terms.every(
            term =>
              haystack.includes(term)
          );
        })
        .map(node => node.id)
    );

  const visibleEdgeIds =
    new Set(
      viewModel.edges
        .filter(
          edge =>
            visibleNodeIds.has(edge.fromRef) &&
            visibleNodeIds.has(edge.toRef)
        )
        .map(edge => edge.id)
    );

  return {
    query: String(query || ""),
    visibleNodeIds,
    visibleEdgeIds
  };
}


export function selectedResearchAtlasContext(
  viewModel,
  nodeId
) {
  const node =
    viewModel.nodes.find(
      item => item.id === nodeId
    );

  if (!node) {
    return null;
  }

  const edges =
    viewModel.edges.filter(
      edge =>
        edge.fromRef === nodeId ||
        edge.toRef === nodeId
    );

  const connectedIds =
    new Set(
      edges.map(edge =>
        edge.fromRef === nodeId
          ? edge.toRef
          : edge.fromRef
      )
    );

  return {
    node,
    edges,
    connectedNodes:
      viewModel.nodes.filter(
        item =>
          connectedIds.has(item.id)
      )
  };
}

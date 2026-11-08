
import { ResearchAtlasAssembler } from "../src/core/research-atlas-assembler.js";
import { ResearchAtlasLayoutEngine } from "../src/core/research-atlas-layout.js";
import { addResearchAtlasDocumentSimilarity } from "../src/core/research-atlas-document-similarity.js";
import {
  buildResearchAtlasViewModel,
  filterResearchAtlasViewModel,
  selectedResearchAtlasContext
} from "../src/core/research-atlas-view.js";
import { OPENALEX_PHILOSOPHY_HF_REVISION } from "../src/sources/openalex-philosophy.js";

export const RESEARCH_ATLAS_MAIN_REVISION = "2026-11-07.ra9-v1";
export const RESEARCH_ATLAS_RESPONSE_EVENT = "research-atlas:search-response";
export const RESEARCH_ATLAS_RESET_EVENT = "research-atlas:reset";
export const RESEARCH_ATLAS_FILTER_EVENT = "research-atlas:filter-results";

const q = selector => document.querySelector(selector);
const switcher = q("#research-view-switch");
const resultsPanel = q("#research-results-panel");
const atlasPanel = q("#research-atlas-panel");
const tabs = [...document.querySelectorAll("[data-research-view]")];
const atlasCount = q("#research-atlas-count");
const syncStatus = q("#research-atlas-sync-status");
const filterInput = q("#research-atlas-filter");
const fitButton = q("#research-atlas-fit");
const canvas = q("#research-atlas-canvas");
const stage = q("#research-atlas-stage");
const stageLabel = q("#research-atlas-stage-label");
const zoomReadout = q("#research-atlas-zoom");
const zoomIn = q("#research-atlas-zoom-in");
const zoomOut = q("#research-atlas-zoom-out");
const tooltip = q("#research-atlas-tooltip");
const detail = q("#research-atlas-detail");
const list = q("#research-atlas-list");
const edgeToggles = [...document.querySelectorAll("[data-research-atlas-edge]")];
const context = canvas?.getContext("2d", { alpha: true }) || null;

const EMPTY_AUTHORITY_GRAPH = Object.freeze({
  schemaVersion: "author-authority-graph-v1",
  buildRevision: "research-atlas-main-unresolved-only",
  datasetRevision: "research-atlas-main-unresolved-only",
  authorities: [],
  mentions: [],
  sourceRecords: [],
  mentionAuthorityLinks: [],
  identifierRegistry: {},
  candidateRegistry: {},
  decisionLedger: { decisions: [] },
  buildMetrics: {}
});

let assembler;
let layoutEngine;
let snapshot = null;
let layout = null;
let viewModel = null;
let filterState = null;
let mainVisibleIdentityKeys = null;
let mainVisibleNodeIds = null;
let mainVisibleEdgeIds = null;
let currentQuery = "";
let activeView = "results";
let selectedId = null;
let hoveredId = null;
let drag = null;
let raf = null;

const view = { x: 0, y: 0, zoom: 1 };

function makeAssembler() {
  assembler = new ResearchAtlasAssembler({ authorityGraph: EMPTY_AUTHORITY_GRAPH });
  layoutEngine = new ResearchAtlasLayoutEngine({ maxExistingDisplacement: 0.18 });
}

function sourceRevisions(response) {
  const revisions = {
    openAlexPhilosophy: OPENALEX_PHILOSOPHY_HF_REVISION,
    mainSearchIntegration: RESEARCH_ATLAS_MAIN_REVISION
  };
  const semanticRevision =
    response?.semantic?.indexBuildId ||
    response?.semantic?.index_build_id ||
    response?.semantic?.revision ||
    response?.semantic?.corpusRevision ||
    null;
  if (semanticRevision) revisions.semanticService = semanticRevision;
  return revisions;
}

function inferSearchMode(meta, response) {
  if (meta?.searchMode === "semantic-service") return "semantic-service";
  if (response?.searchMode === "semantic" || response?.searchMode === "semantic-service") {
    return "semantic-service";
  }
  return "traditional";
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function resetGraph() {
  makeAssembler();
  snapshot = null;
  layout = null;
  viewModel = null;
  filterState = null;
  mainVisibleIdentityKeys = null;
  mainVisibleNodeIds = null;
  mainVisibleEdgeIds = null;
  selectedId = null;
  hoveredId = null;
  filterInput.value = "";
  atlasCount.textContent = "";
  syncStatus.textContent = "";
  stageLabel.textContent = "Esperando resultados…";
  list.replaceChildren();
  renderEmptyDetail();
  view.x = 0;
  view.y = 0;
  view.zoom = 1;
  clearCanvas();
}

function clearCanvas() {
  if (!canvas || !context) return;
  const metrics = canvasMetrics();
  context.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
  context.clearRect(0, 0, metrics.width, metrics.height);
}

function enabledEdgeTypes() {
  return edgeToggles
    .filter(toggle => toggle.checked)
    .map(toggle => toggle.dataset.researchAtlasEdge);
}

function consumeSearchResponse(meta) {
  const response = meta?.response;
  if (!response || !Array.isArray(response.results)) return;

  const queryText = String(response.query || "").trim();
  if (!queryText) return;

  if (currentQuery && currentQuery !== queryText) resetGraph();
  currentQuery = queryText;

  const state =
    meta.phase === "partial"
      ? "collecting"
      : response.errors?.length
        ? "partial"
        : "complete";

  const base = assembler.ingest(response, {
    searchMode: inferSearchMode(meta, response),
    state,
    sourceRevisions: sourceRevisions(response)
  });

  snapshot = addResearchAtlasDocumentSimilarity(base);
  layout = layoutEngine.layout(snapshot);
  rebuildViewModel();

  switcher.classList.remove("hidden");
  atlasCount.textContent = String(viewModel.diagnostics.directWorks);

  if (meta.phase === "partial") {
    syncStatus.textContent =
      String(viewModel.diagnostics.directWorks) + " obras · Atlas actualizándose";
    stageLabel.textContent =
      "Resultados parciales · la geometría se estabiliza conforme llegan fuentes";
  } else {
    syncStatus.textContent =
      String(viewModel.diagnostics.directWorks) + " obras · " +
      String(viewModel.diagnostics.mentions) + " menciones de autor";
    stageLabel.textContent =
      "Mismo SearchResponse que la lista · sin búsqueda adicional";
  }

  if (activeView === "atlas") {
    requestAnimationFrame(() => {
      requestDraw();
      if (view.zoom === 1 && view.x === 0 && view.y === 0) fitView();
    });
  }
}

function rebuildViewModel() {
  if (!snapshot || !layout) return;
  viewModel = buildResearchAtlasViewModel(snapshot, layout, {
    edgeTypes: enabledEdgeTypes()
  });
  filterState = filterResearchAtlasViewModel(viewModel, filterInput.value);
  recomputeMainVisibility();
  if (selectedId && !viewModel.nodes.some(node => node.id === selectedId)) {
    selectedId = null;
  }
  renderList();
  renderDetail();
  requestDraw();
}

function setView(nextView, options = {}) {
  const safeView = nextView === "atlas" && viewModel ? "atlas" : "results";
  activeView = safeView;
  const atlasActive = safeView === "atlas";

  resultsPanel.classList.toggle("hidden", atlasActive);
  atlasPanel.classList.toggle("hidden", !atlasActive);

  for (const tab of tabs) {
    const selected = tab.dataset.researchView === safeView;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (options.focus && selected) tab.focus();
  }

  if (atlasActive) {
    requestDraw();
    requestAnimationFrame(fitView);
  }
}

function canvasMetrics() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const targetWidth = Math.round(width * dpr);
  const targetHeight = Math.round(height * dpr);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  return { width, height, dpr, base: Math.min(width, height) * 0.34 };
}

function cssColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function palette() {
  return {
    ink: cssColor("--pg-black", "#161616"),
    white: cssColor("--pg-white", "#ffffff"),
    line: cssColor("--pg-line", "#c6c6c6"),
    blue: cssColor("--pg-blue", "#0f62fe"),
    cyan: "#33b1ff",
    green: "#42be65",
    purple: "#8a3ffc",
    yellow: "#f1c21b",
    muted: cssColor("--pg-muted", "#6f6f6f")
  };
}

function worldToScreen(node, metrics) {
  return {
    x: metrics.width / 2 + (node.x - view.x) * metrics.base * view.zoom,
    y: metrics.height / 2 + (node.y - view.y) * metrics.base * view.zoom
  };
}

function screenToWorld(x, y, metrics) {
  return {
    x: view.x + (x - metrics.width / 2) / (metrics.base * view.zoom),
    y: view.y + (y - metrics.height / 2) / (metrics.base * view.zoom)
  };
}

function edgeStyle(edge, colors) {
  if (edge.visualType === "semantic") {
    return {
      color: colors.blue,
      alpha: 0.35 + Math.max(0, Math.min(1, Number(edge.semanticScore || 0))) * 0.35,
      width: 1.6,
      dash: []
    };
  }
  if (edge.visualType === "lexical") {
    return { color: colors.cyan, alpha: 0.48, width: 1.05, dash: [2, 4] };
  }
  if (edge.visualType === "related") {
    return { color: colors.purple, alpha: 0.5, width: 1.15, dash: [5, 5] };
  }
  if (edge.visualType === "contribution") {
    return { color: colors.green, alpha: 0.62, width: 1.2, dash: [] };
  }
  if (edge.visualType === "provisional") {
    return { color: colors.yellow, alpha: 0.65, width: 1, dash: [3, 5] };
  }
  return { color: colors.line, alpha: 0.3, width: 1, dash: [2, 5] };
}

function requestDraw() {
  if (!context || activeView !== "atlas" || !viewModel || raf) return;
  raf = requestAnimationFrame(() => {
    raf = null;
    draw();
  });
}

function selectedContext() {
  if (!selectedId || !viewModel) return null;
  return selectedResearchAtlasContext(viewModel, selectedId);
}

function recomputeMainVisibility() {
  if (!viewModel || !mainVisibleIdentityKeys) {
    mainVisibleNodeIds = null;
    mainVisibleEdgeIds = null;
    return;
  }

  const visibleIds = new Set();

  for (const node of viewModel.nodes) {
    if (node.kind === "query") {
      visibleIds.add(node.id);
      continue;
    }

    if (
      (node.kind === "work-direct" || node.kind === "work-expanded") &&
      mainVisibleIdentityKeys.has(node.identity)
    ) {
      visibleIds.add(node.id);
    }
  }

  for (const edge of viewModel.edges) {
    if (edge.type !== "contribution" && edge.type !== "author-mention") continue;
    const fromVisible = visibleIds.has(edge.fromRef);
    const toVisible = visibleIds.has(edge.toRef);
    if (fromVisible) visibleIds.add(edge.toRef);
    if (toVisible) visibleIds.add(edge.fromRef);
  }

  mainVisibleNodeIds = visibleIds;
  mainVisibleEdgeIds = new Set(
    viewModel.edges
      .filter(edge => visibleIds.has(edge.fromRef) && visibleIds.has(edge.toRef))
      .map(edge => edge.id)
  );
}

function visibleNode(id) {
  const textVisible = filterState?.visibleNodeIds?.has(id) ?? true;
  const mainVisible = mainVisibleNodeIds?.has(id) ?? true;
  return textVisible && mainVisible;
}

function visibleEdge(id) {
  const textVisible = filterState?.visibleEdgeIds?.has(id) ?? true;
  const mainVisible = mainVisibleEdgeIds?.has(id) ?? true;
  return textVisible && mainVisible;
}

function draw() {
  if (!viewModel || !context) return;

  const metrics = canvasMetrics();
  const colors = palette();
  context.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
  context.clearRect(0, 0, metrics.width, metrics.height);

  const nodesById = new Map(viewModel.nodes.map(node => [node.id, node]));
  const current = selectedContext();
  const connectedIds = new Set(current?.connectedNodes?.map(node => node.id) || []);
  const selectedEdges = new Set(current?.edges?.map(edge => edge.id) || []);

  for (const edge of viewModel.edges) {
    if (!visibleEdge(edge.id)) continue;
    const from = nodesById.get(edge.fromRef);
    const to = nodesById.get(edge.toRef);
    if (!from || !to || !visibleNode(from.id) || !visibleNode(to.id)) continue;

    const a = worldToScreen(from, metrics);
    const b = worldToScreen(to, metrics);
    const style = edgeStyle(edge, colors);

    context.save();
    context.globalAlpha = selectedId
      ? (selectedEdges.has(edge.id) ? Math.min(1, style.alpha + 0.25) : style.alpha * 0.16)
      : style.alpha;
    context.strokeStyle = style.color;
    context.lineWidth = selectedEdges.has(edge.id) ? style.width * 1.5 : style.width;
    context.setLineDash(style.dash);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
    context.restore();
  }

  for (const node of viewModel.nodes) {
    const screen = worldToScreen(node, metrics);
    if (
      screen.x < -28 ||
      screen.x > metrics.width + 28 ||
      screen.y < -28 ||
      screen.y > metrics.height + 28
    ) continue;

    const selected = node.id === selectedId;
    const connected = connectedIds.has(node.id);
    const hovered = node.id === hoveredId;
    const visible = visibleNode(node.id);

    context.save();
    context.globalAlpha = visible ? (selected || connected ? 1 : 0.9) : 0.06;

    if (node.kind === "work-direct") {
      const radius = selected ? 8 : hovered ? 6.5 : connected ? 5.5 : 4.4;
      context.beginPath();
      context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      context.fillStyle = colors.blue;
      context.fill();
    } else if (node.kind === "work-expanded") {
      const radius = selected ? 8 : hovered ? 6.5 : 4.8;
      context.beginPath();
      context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      context.fillStyle = colors.white;
      context.fill();
      context.strokeStyle = colors.cyan;
      context.lineWidth = 2;
      context.stroke();
    } else if (node.kind === "authority-person") {
      const size = selected ? 8 : 6;
      context.translate(screen.x, screen.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = colors.green;
      context.fillRect(-size / 2, -size / 2, size, size);
    } else if (node.kind === "author-mention") {
      const radius = selected ? 7 : 5;
      context.setLineDash([3, 3]);
      context.beginPath();
      context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      context.strokeStyle = colors.yellow;
      context.lineWidth = 1.5;
      context.stroke();
    } else {
      context.beginPath();
      context.arc(screen.x, screen.y, selected ? 9 : 7, 0, Math.PI * 2);
      context.strokeStyle = colors.muted;
      context.lineWidth = 1;
      context.stroke();
    }

    context.restore();
  }

  zoomReadout.textContent = String(Math.round(view.zoom * 100)) + "%";
}

function hitTest(clientX, clientY) {
  if (!viewModel) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const metrics = canvasMetrics();
  let winner = null;
  let best = Infinity;

  for (const node of viewModel.nodes) {
    if (!visibleNode(node.id)) continue;
    const screen = worldToScreen(node, metrics);
    const dx = screen.x - x;
    const dy = screen.y - y;
    const squared = dx * dx + dy * dy;
    const radius = node.kind === "query" ? 15 : 12;
    if (squared <= radius * radius && squared < best) {
      winner = node;
      best = squared;
    }
  }
  return winner;
}

function fitView() {
  if (!viewModel || activeView !== "atlas") return;
  const nodes = viewModel.nodes.filter(node => visibleNode(node.id));
  if (!nodes.length) return;

  const xs = nodes.map(node => node.x);
  const ys = nodes.map(node => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  view.x = (minX + maxX) / 2;
  view.y = (minY + maxY) / 2;

  const metrics = canvasMetrics();
  const spanX = Math.max(0.14, maxX - minX);
  const spanY = Math.max(0.14, maxY - minY);

  view.zoom = Math.max(
    0.55,
    Math.min(
      5.5,
      Math.min(
        metrics.width * 0.7 / (spanX * metrics.base),
        metrics.height * 0.7 / (spanY * metrics.base)
      )
    )
  );
  requestDraw();
}

function zoomAt(factor, clientX = null, clientY = null) {
  if (activeView !== "atlas") return;
  const metrics = canvasMetrics();
  const rect = canvas.getBoundingClientRect();
  const x = clientX === null ? metrics.width / 2 : clientX - rect.left;
  const y = clientY === null ? metrics.height / 2 : clientY - rect.top;
  const before = screenToWorld(x, y, metrics);
  const next = Math.max(0.5, Math.min(8, view.zoom * factor));
  if (next === view.zoom) return;
  view.zoom = next;
  const after = screenToWorld(x, y, metrics);
  view.x += before.x - after.x;
  view.y += before.y - after.y;
  requestDraw();
}

function kindLabel(kind) {
  const labels = {
    "work-direct": "Obra · resultado directo",
    "work-expanded": "Obra · expansión L1",
    "authority-person": "Autor · autoridad confirmada",
    "author-mention": "Autor · mención no resuelta",
    query: "Consulta"
  };
  return labels[kind] || kind;
}

function renderEmptyDetail() {
  detail.replaceChildren(
    element("span", "research-atlas-detail-mark", "◎"),
    element("strong", "", "Seleccione un nodo"),
    element(
      "p",
      "",
      "Aquí aparecerá la evidencia de por qué una obra o un autor forma parte del Atlas."
    )
  );
  detail.firstElementChild?.setAttribute("aria-hidden", "true");
}

function renderDetail() {
  const current = selectedContext();
  if (!current) {
    renderEmptyDetail();
    return;
  }

  const node = current.node;
  const fragment = document.createDocumentFragment();
  fragment.append(
    element("span", "research-atlas-kicker", kindLabel(node.kind)),
    element("h3", "research-atlas-detail-title", node.label),
    element("p", "", node.subtitle || "")
  );

  const meta = element("div", "research-atlas-detail-meta");
  const identity = element("div");
  identity.append(
    element("span", "", "Identidad"),
    element("strong", "", node.identity || "No aplica")
  );
  const relationCount = element("div");
  relationCount.append(
    element("span", "", "Relaciones visibles"),
    element("strong", "", current.edges.length)
  );
  meta.append(identity, relationCount);
  fragment.append(meta);

  const why = element("section", "research-atlas-why");
  why.append(element("h3", "", "¿Por qué está aquí?"));
  const whyList = element("ul");
  for (const reason of node.why) whyList.append(element("li", "", reason));
  why.append(whyList);
  fragment.append(why);

  const relations = element("section", "research-atlas-relations");
  relations.append(element("h3", "", "Relaciones visibles"));

  for (const edge of current.edges) {
    const otherId = edge.fromRef === node.id ? edge.toRef : edge.fromRef;
    const other = current.connectedNodes.find(item => item.id === otherId);
    if (!other) continue;
    const button = element("button", "research-atlas-relation");
    button.type = "button";
    button.dataset.researchAtlasSelect = other.id;
    button.append(
      element("strong", "", other.label),
      element("span", "", edge.label)
    );
    relations.append(button);
  }

  if (relations.children.length === 1) {
    relations.append(element("p", "", "Sin relaciones visibles con las capas actuales."));
  }

  fragment.append(relations);
  detail.replaceChildren(fragment);
}

function renderList() {
  list.replaceChildren();
  if (!viewModel) return;

  const nodes = viewModel.nodes.filter(node => node.kind !== "query" && visibleNode(node.id));

  if (!nodes.length) {
    list.append(element("span", "", "No hay nodos que coincidan con este filtro."));
    return;
  }

  for (const node of nodes) {
    const button = element("button");
    button.type = "button";
    button.dataset.researchAtlasSelect = node.id;
    if (node.id === selectedId) button.setAttribute("aria-current", "true");
    const subtitle =
      kindLabel(node.kind) + (node.subtitle ? " · " + node.subtitle : "");
    button.append(
      element("strong", "", node.label),
      element("span", "", subtitle)
    );
    list.append(button);
  }
}

function selectNode(nodeId, options = {}) {
  const node = viewModel?.nodes?.find(item => item.id === nodeId);
  if (!node) return;

  selectedId = nodeId;
  if (options.center) {
    view.x = node.x;
    view.y = node.y;
    view.zoom = Math.max(2, view.zoom);
  }
  renderList();
  renderDetail();
  requestDraw();
}

function setTooltip(node, event) {
  if (!node) {
    tooltip.classList.add("hidden");
    return;
  }

  tooltip.replaceChildren(
    element("strong", "", node.label),
    element("span", "", node.subtitle || kindLabel(node.kind))
  );
  tooltip.classList.remove("hidden");

  const rect = stage.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, event.clientX - rect.left + 12),
    Math.max(8, rect.width - 284)
  );
  const top = Math.min(
    Math.max(8, event.clientY - rect.top + 12),
    Math.max(8, rect.height - 70)
  );
  tooltip.style.left = String(left) + "px";
  tooltip.style.top = String(top) + "px";
}

for (const tab of tabs) {
  tab.addEventListener("click", () => setView(tab.dataset.researchView));
  tab.addEventListener("keydown", event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab.dataset.researchView === "results" ? "atlas" : "results";
    setView(next, { focus: true });
  });
}

filterInput.addEventListener("input", () => {
  if (!viewModel) return;
  filterState = filterResearchAtlasViewModel(viewModel, filterInput.value);
  renderList();
  requestDraw();
});

for (const toggle of edgeToggles) toggle.addEventListener("change", rebuildViewModel);

fitButton.addEventListener("click", fitView);
zoomIn.addEventListener("click", () => zoomAt(1.18));
zoomOut.addEventListener("click", () => zoomAt(1 / 1.18));

canvas.addEventListener(
  "wheel",
  event => {
    if (activeView !== "atlas") return;
    event.preventDefault();
    zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
  },
  { passive: false }
);

canvas.addEventListener("pointerdown", event => {
  if (activeView !== "atlas") return;
  canvas.setPointerCapture(event.pointerId);
  drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false
  };
  canvas.classList.add("is-dragging");
  tooltip.classList.add("hidden");
});

canvas.addEventListener("pointermove", event => {
  if (drag?.pointerId === event.pointerId) {
    const metrics = canvasMetrics();
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
      drag.moved = true;
    }
    view.x -= dx / (metrics.base * view.zoom);
    view.y -= dy / (metrics.base * view.zoom);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    requestDraw();
    return;
  }
  const node = hitTest(event.clientX, event.clientY);
  hoveredId = node?.id || null;
  setTooltip(node, event);
  requestDraw();
});

canvas.addEventListener("pointerup", event => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const moved = drag.moved;
  drag = null;
  canvas.classList.remove("is-dragging");
  if (!moved) {
    const node = hitTest(event.clientX, event.clientY);
    if (node) selectNode(node.id);
  }
});

canvas.addEventListener("pointercancel", () => {
  drag = null;
  canvas.classList.remove("is-dragging");
});

canvas.addEventListener("pointerleave", () => {
  if (drag) return;
  hoveredId = null;
  tooltip.classList.add("hidden");
  requestDraw();
});

atlasPanel.addEventListener("click", event => {
  const target = event.target.closest("[data-research-atlas-select]");
  if (!target) return;
  selectNode(target.dataset.researchAtlasSelect, { center: true });
});

window.addEventListener(RESEARCH_ATLAS_RESPONSE_EVENT, event => {
  consumeSearchResponse(event.detail);
});

window.addEventListener(RESEARCH_ATLAS_RESET_EVENT, event => {
  currentQuery = String(event.detail?.query || "").trim();
  resetGraph();
  setView("results");
  switcher.classList.add("hidden");
});

window.addEventListener(RESEARCH_ATLAS_FILTER_EVENT, event => {
  const keys = Array.isArray(event.detail?.visibleIdentityKeys)
    ? event.detail.visibleIdentityKeys
    : null;

  mainVisibleIdentityKeys = keys ? new Set(keys) : null;
  recomputeMainVisibility();

  if (viewModel) {
    renderList();
    renderDetail();
    requestDraw();

    const visible = Number(event.detail?.visibleCount);
    const total = Number(event.detail?.totalCount);

    if (Number.isFinite(visible) && Number.isFinite(total) && visible !== total) {
      syncStatus.textContent =
        String(visible) + " de " + String(total) + " obras visibles · topología preservada";
    }
  }
});

new MutationObserver(() => {
  if (document.body.classList.contains("author-view")) setView("results");
}).observe(document.body, {
  attributes: true,
  attributeFilter: ["class"]
});

new MutationObserver(requestDraw).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"]
});

window.addEventListener("resize", requestDraw);

makeAssembler();
renderEmptyDetail();

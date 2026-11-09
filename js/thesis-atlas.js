import {
  atlasClusterMap,
  atlasNodeMap,
  atlasSearch,
  atlasYearExtent,
  neighborEntries,
  overlayColor,
  proposedClusterLabel,
  stableHue,
  validateAtlas,
} from "../src/core/thesis-atlas.js?v=20261104-t2ch";

const canvas = document.querySelector("#atlas-canvas");
const stage = document.querySelector("#atlas-stage");
const context = canvas.getContext("2d", { alpha: true });
const query = document.querySelector("#atlas-query");
const matchCount = document.querySelector("#atlas-match-count");
const overlay = document.querySelector("#atlas-overlay");
const overlayLabel = document.querySelector("#atlas-overlay-label");
const focusResults = document.querySelector("#atlas-focus-results");
const resetView = document.querySelector("#atlas-reset-view");
const zoomIn = document.querySelector("#atlas-zoom-in");
const zoomOut = document.querySelector("#atlas-zoom-out");
const zoomReadout = document.querySelector("#atlas-zoom-readout");
const status = document.querySelector("#atlas-status");
const tooltip = document.querySelector("#atlas-tooltip");
const detail = document.querySelector("#atlas-detail");
const regionList = document.querySelector("#atlas-region-list");

let atlas = null;
let nodes = [];
let nodeById = new Map();
let clusterById = new Map();
let yearExtent = [null, null];
let matchedIds = null;
let activeCluster = null;
let selectedId = null;
let hoveredId = null;
let raf = null;
let drag = null;
const view = { x: 0, y: 0, zoom: 1 };

const overlayLabels = {
  region: "región experimental",
  program: "programa",
  degree: "grado",
  period: "periodo",
};

function element(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = String(text);
  return node;
}

function canvasMetrics() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  if (
    canvas.width !== Math.round(width * dpr) ||
    canvas.height !== Math.round(height * dpr)
  ) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  return { width, height, dpr, base: Math.min(width, height) * 0.43 };
}

function worldToScreen(node, metrics) {
  return {
    x: metrics.width / 2 + (node.atlas.x - view.x) * metrics.base * view.zoom,
    y: metrics.height / 2 + (node.atlas.y - view.y) * metrics.base * view.zoom,
  };
}

function screenToWorld(x, y, metrics) {
  return {
    x: view.x + (x - metrics.width / 2) / (metrics.base * view.zoom),
    y: view.y + (y - metrics.height / 2) / (metrics.base * view.zoom),
  };
}

function currentMatches() {
  const searchMatches = matchedIds || new Set(nodes.map(node => node.id));
  if (!activeCluster) return searchMatches;
  return new Set(
    [...searchMatches].filter(id =>
      nodeById.get(id)?.atlas?.clusterRefs?.includes(activeCluster)
    )
  );
}

function nodeIsVisible(node, visible) {
  return !visible || visible.has(node.id);
}

function requestDraw() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = null;
    draw();
  });
}

function themeInk() {
  const styles = getComputedStyle(document.documentElement);
  return {
    ink: styles.getPropertyValue("--ta-ink").trim() || "#f4f4f4",
    muted: styles.getPropertyValue("--ta-muted").trim() || "#c6c6c6",
    surface: styles.getPropertyValue("--ta-surface").trim() || "#161a1f",
    line: styles.getPropertyValue("--ta-line").trim() || "#525860",
  };
}

function selectedNeighborIds() {
  const node = nodeById.get(selectedId);
  return new Set(node?.neighborhood?.neighborRefs || []);
}

function drawRegionLabels(ctx, metrics, colors, visible) {
  if (overlay.value !== "region" || view.zoom > 2.7) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const cluster of atlas.clusters) {
    const membersVisible = nodes.some(node =>
      node.atlas.clusterRefs?.[0] === cluster.id && nodeIsVisible(node, visible)
    );
    if (!membersVisible) continue;
    const point = {
      atlas: { x: cluster.centroid.x, y: cluster.centroid.y },
    };
    const screen = worldToScreen(point, metrics);
    if (
      screen.x < -80 || screen.x > metrics.width + 80 ||
      screen.y < -30 || screen.y > metrics.height + 30
    ) continue;

    const label = proposedClusterLabel(cluster).split(" · ").slice(0, 2).join(" · ");
    ctx.font = `600 ${Math.max(8, Math.min(11, 8 + view.zoom * .5))}px Inter, system-ui, sans-serif`;
    const width = ctx.measureText(label).width + 14;
    ctx.fillStyle = colors.surface;
    ctx.globalAlpha = .82;
    ctx.fillRect(screen.x - width / 2, screen.y - 10, width, 20);
    ctx.globalAlpha = .72;
    ctx.fillStyle = colors.muted;
    ctx.fillText(label, screen.x, screen.y);
  }
  ctx.restore();
}

function draw() {
  if (!atlas) return;
  const metrics = canvasMetrics();
  const colors = themeInk();
  context.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
  context.clearRect(0, 0, metrics.width, metrics.height);

  const visible = currentMatches();
  const neighbors = selectedNeighborIds();
  drawRegionLabels(context, metrics, colors, visible);

  const selected = nodeById.get(selectedId);
  if (selected) {
    const origin = worldToScreen(selected, metrics);
    context.save();
    context.lineWidth = 1;
    for (const entry of neighborEntries(selected, nodeById)) {
      const target = worldToScreen(entry.node, metrics);
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.lineTo(target.x, target.y);
      context.strokeStyle = `hsla(${stableHue(selected.atlas.clusterRefs?.[0] || selected.id)} 70% 58% / ${.13 + Math.max(0, entry.similarity) * .22})`;
      context.stroke();
    }
    context.restore();
  }

  for (const node of nodes) {
    const screen = worldToScreen(node, metrics);
    if (
      screen.x < -20 || screen.x > metrics.width + 20 ||
      screen.y < -20 || screen.y > metrics.height + 20
    ) continue;

    const isSelected = node.id === selectedId;
    const isHovered = node.id === hoveredId;
    const isNeighbor = neighbors.has(node.id);
    const isVisible = nodeIsVisible(node, visible);
    const baseRadius = view.zoom > 3 ? 3.6 : view.zoom > 1.7 ? 3.1 : 2.55;
    const radius = isSelected ? 7.2 : isHovered ? 5.6 : isNeighbor ? 4.6 : baseRadius;

    context.save();
    context.globalAlpha = isVisible ? (isSelected || isNeighbor ? 1 : .82) : .08;
    context.beginPath();
    context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    context.fillStyle = overlayColor(node, overlay.value, {
      clusterById,
      minYear: yearExtent[0],
      maxYear: yearExtent[1],
    });
    context.fill();

    if (isSelected) {
      context.globalAlpha = 1;
      context.lineWidth = 2.2;
      context.strokeStyle = colors.ink;
      context.stroke();
      context.beginPath();
      context.arc(screen.x, screen.y, radius + 4.8, 0, Math.PI * 2);
      context.lineWidth = 1;
      context.globalAlpha = .4;
      context.strokeStyle = colors.ink;
      context.stroke();
    } else if (isHovered) {
      context.globalAlpha = .9;
      context.lineWidth = 1.5;
      context.strokeStyle = colors.ink;
      context.stroke();
    } else if (isNeighbor) {
      context.globalAlpha = .85;
      context.lineWidth = 1;
      context.strokeStyle = colors.ink;
      context.stroke();
    }
    context.restore();
  }

  zoomReadout.textContent = `${Math.round(view.zoom * 100)}%`;
}

function hitTest(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const metrics = canvasMetrics();
  const visible = currentMatches();
  let winner = null;
  let best = 13 * 13;
  for (const node of nodes) {
    if (!nodeIsVisible(node, visible)) continue;
    const screen = worldToScreen(node, metrics);
    const dx = screen.x - x;
    const dy = screen.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < best) {
      best = distance;
      winner = node;
    }
  }
  return winner;
}

function setTooltip(node, event) {
  if (!node) {
    tooltip.hidden = true;
    return;
  }
  tooltip.replaceChildren(
    element("strong", "", node.title),
    element("span", "", [node.authors?.[0], node.year, node.program]
      .filter(Boolean).join(" · ")),
  );
  tooltip.hidden = false;
  const stageRect = stage.getBoundingClientRect();
  const x = event.clientX - stageRect.left + 14;
  const y = event.clientY - stageRect.top + 14;
  tooltip.style.left = `${Math.min(stageRect.width - 286, Math.max(8, x))}px`;
  tooltip.style.top = `${Math.min(stageRect.height - 86, Math.max(8, y))}px`;
}

function clusterFor(node) {
  return clusterById.get(node.atlas?.clusterRefs?.[0]);
}

function selectNode(id, { center = false } = {}) {
  const node = nodeById.get(id);
  if (!node) return;
  selectedId = id;
  if (center) {
    view.x = node.atlas.x;
    view.y = node.atlas.y;
    view.zoom = Math.max(view.zoom, 2.6);
  }
  renderDetail(node);
  requestDraw();
}

function renderDetail(node) {
  const cluster = clusterFor(node);
  const regionLabel = cluster ? proposedClusterLabel(cluster) : "Fuera de regiones densas";
  const wrapper = element("div", "ta-detail-selected");

  const head = element("div", "ta-detail-head");
  const kicker = element("div", "ta-detail-kicker");
  kicker.append(
    element("span", "", "TESIS / UDEG"),
    element("span", "", node.year ?? "AÑO SIN VERIFICAR"),
  );
  head.append(
    kicker,
    element("h2", "ta-detail-title", node.title),
    element("p", "ta-detail-author",
      node.authors?.length ? node.authors.join(" · ") : "Autor no registrado"),
  );

  const meta = element("div", "ta-detail-meta");
  for (const [label, value] of [
    ["Programa", node.program || "No registrado"],
    ["Grado", node.degree || "No registrado"],
    ["Unidad", node.unit || "No registrada"],
    ["ID", node.id.replace("thesis:work:", "#")],
  ]) {
    const box = element("div");
    box.append(element("span", "", label), element("strong", "", value));
    meta.append(box);
  }

  const region = element("div", "ta-detail-region");
  region.append(
    element("span", "", "Región experimental"),
    element("strong", "", regionLabel),
    element("small", "", cluster
      ? "Etiqueta propuesta automáticamente a partir de términos de los títulos. No es una clasificación oficial."
      : "HDBSCAN no asignó esta tesis a una región densa; sigue plenamente disponible en el Atlas."),
  );

  const neighborSection = element("div", "ta-neighbors");
  neighborSection.append(element("h3", "", "Ocho tesis vecinas"));
  const list = element("div", "ta-neighbor-list");
  for (const entry of neighborEntries(node, nodeById)) {
    const button = element("button", "ta-neighbor");
    button.type = "button";
    button.append(
      element("span", "ta-neighbor-title", entry.node.title),
      element("span", "ta-neighbor-score", entry.similarity.toFixed(3)),
    );
    button.addEventListener("click", () => selectNode(entry.node.id, { center: true }));
    list.append(button);
  }
  neighborSection.append(list);

  const actions = element("div", "ta-detail-actions");
  if (node.sourceUrl) {
    const source = element("a", "ta-detail-source", "Repositorio institucional ↗");
    source.href = node.sourceUrl;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    actions.append(source);
  } else {
    actions.append(element("span", "ta-detail-source", "Sin enlace verificado"));
  }
  const listLink = element("a", "ta-detail-list-link", "Vista lista");
  listLink.href = `./tesis.html?q=${encodeURIComponent(node.title)}`;
  actions.append(listLink);

  wrapper.append(head, meta, region, neighborSection, actions);
  detail.replaceChildren(wrapper);
}

function fitNodes(targetNodes) {
  if (!targetNodes.length) return;
  const xs = targetNodes.map(node => node.atlas.x);
  const ys = targetNodes.map(node => node.atlas.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  view.x = (minX + maxX) / 2;
  view.y = (minY + maxY) / 2;

  const metrics = canvasMetrics();
  const spanX = Math.max(.04, maxX - minX);
  const spanY = Math.max(.04, maxY - minY);
  const zoomX = metrics.width * .72 / (spanX * metrics.base);
  const zoomY = metrics.height * .72 / (spanY * metrics.base);
  view.zoom = Math.max(.7, Math.min(7.5, Math.min(zoomX, zoomY)));
  requestDraw();
}

function updateSearch() {
  const matches = atlasSearch(nodes, query.value);
  matchedIds = query.value.trim()
    ? new Set(matches.map(node => node.id))
    : null;
  const visible = currentMatches();
  matchCount.textContent = visible.size.toLocaleString("es-MX");
  status.textContent = query.value.trim() || activeCluster
    ? `${visible.size.toLocaleString("es-MX")} tesis visibles · la búsqueda no altera la topología`
    : `${nodes.length.toLocaleString("es-MX")} tesis · posición basada únicamente en título normalizado`;
  requestDraw();
}

function renderRegions() {
  const sorted = [...atlas.clusters].sort((a, b) =>
    b.memberCount - a.memberCount || a.id.localeCompare(b.id)
  );
  regionList.replaceChildren();
  for (const cluster of sorted) {
    const button = element("button", "ta-region-button");
    button.type = "button";
    button.title = "Centrar esta región experimental";
    const swatch = element("span", "ta-region-swatch");
    swatch.style.background = `hsl(${stableHue(cluster.id)} 62% 56%)`;
    button.append(
      swatch,
      element("span", "ta-region-label", proposedClusterLabel(cluster)),
      element("span", "ta-region-count", cluster.memberCount),
    );
    button.addEventListener("click", () => {
      activeCluster = activeCluster === cluster.id ? null : cluster.id;
      for (const child of regionList.children) child.removeAttribute("aria-pressed");
      if (activeCluster) button.setAttribute("aria-pressed", "true");
      updateSearch();
      if (activeCluster) {
        fitNodes(nodes.filter(node => node.atlas.clusterRefs?.includes(cluster.id)));
      } else {
        fitNodes(nodes);
      }
    });
    regionList.append(button);
  }
}

function zoomAt(factor, clientX = null, clientY = null) {
  const metrics = canvasMetrics();
  const rect = canvas.getBoundingClientRect();
  const px = clientX == null ? metrics.width / 2 : clientX - rect.left;
  const py = clientY == null ? metrics.height / 2 : clientY - rect.top;
  const before = screenToWorld(px, py, metrics);
  const next = Math.max(.65, Math.min(9, view.zoom * factor));
  if (next === view.zoom) return;
  view.zoom = next;
  const after = screenToWorld(px, py, metrics);
  view.x += before.x - after.x;
  view.y += before.y - after.y;
  requestDraw();
}

canvas.addEventListener("wheel", event => {
  event.preventDefault();
  zoomAt(event.deltaY < 0 ? 1.14 : 1 / 1.14, event.clientX, event.clientY);
}, { passive: false });

canvas.addEventListener("pointerdown", event => {
  canvas.setPointerCapture(event.pointerId);
  drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
  };
  canvas.classList.add("is-dragging");
  tooltip.hidden = true;
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

canvas.addEventListener("pointerleave", () => {
  if (!drag) {
    hoveredId = null;
    tooltip.hidden = true;
    requestDraw();
  }
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

query.addEventListener("input", updateSearch);
overlay.addEventListener("change", () => {
  overlayLabel.textContent = overlayLabels[overlay.value] || overlay.value;
  requestDraw();
});
focusResults.addEventListener("click", () => {
  const visible = currentMatches();
  fitNodes(nodes.filter(node => visible.has(node.id)));
});
resetView.addEventListener("click", () => {
  activeCluster = null;
  for (const child of regionList.children) child.removeAttribute("aria-pressed");
  view.x = 0;
  view.y = 0;
  view.zoom = 1;
  query.value = "";
  matchedIds = null;
  updateSearch();
});
zoomIn.addEventListener("click", () => zoomAt(1.25));
zoomOut.addEventListener("click", () => zoomAt(1 / 1.25));
window.addEventListener("resize", requestDraw);
window.addEventListener("philosophythemechange", requestDraw);

async function loadAtlas() {
  try {
    const response = await fetch("./data/theses/atlas-v1/index.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    atlas = validateAtlas(await response.json());
    nodes = atlas.nodes;
    nodeById = atlasNodeMap(nodes);
    clusterById = atlasClusterMap(atlas.clusters);
    yearExtent = atlasYearExtent(nodes);

    document.querySelector("#atlas-node-count").textContent =
      nodes.length.toLocaleString("es-MX");
    document.querySelector("#atlas-cluster-count").textContent =
      atlas.clusters.length.toLocaleString("es-MX");
    document.querySelector("#atlas-outlier-count").textContent =
      `${atlas.evaluation.outliers.toLocaleString("es-MX")} fuera de regiones densas`;
    document.querySelector("#atlas-trustworthiness").textContent =
      Number(atlas.evaluation.trustworthinessK8).toFixed(3);
    document.querySelector("#atlas-neighbor-preservation").textContent =
      Number(atlas.evaluation.neighborPreservationK8).toFixed(3);
    document.querySelector("#atlas-program-rate").textContent =
      `${(Number(atlas.evaluation.sameProgramNeighborRate) * 100).toFixed(1)}%`;

    matchCount.textContent = nodes.length.toLocaleString("es-MX");
    status.textContent =
      `${nodes.length.toLocaleString("es-MX")} tesis · posición basada únicamente en título normalizado`;
    renderRegions();
    requestDraw();

    const params = new URLSearchParams(location.search);
    const selected = params.get("thesis");
    const initialQuery = params.get("q");
    if (initialQuery) {
      query.value = initialQuery;
      updateSearch();
      focusResults.click();
    }
    if (selected && nodeById.has(selected)) {
      selectNode(selected, { center: true });
    }
  } catch (error) {
    console.error(error);
    status.textContent =
      "El Atlas no pasó su validación local. No se mostrará una topología incompleta.";
    detail.replaceChildren(
      element("div", "ta-detail-empty", ""),
    );
    const failure = detail.firstElementChild;
    failure.append(
      element("span", "ta-detail-glyph", "×"),
      element("p", "ta-section-label", "ATLAS NO DISPONIBLE"),
      element("h2", "", "La visualización quedó bloqueada."),
      element("p", "", "El contrato, la release o los datos derivados no coincidieron con la versión esperada."),
    );
  }
}

loadAtlas();

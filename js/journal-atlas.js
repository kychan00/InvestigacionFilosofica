import { ResearchAtlasQwenVectorClient } from "../src/core/research-atlas-qwen-vector-client.js";
import { cosineInt8 } from "../src/core/research-atlas-qwen-vector-range.js";

const SITE_ROOT = new URL("../", import.meta.url);
const MAX_ATLAS_RECORDS = 72;
const MAX_EDGES = 120;
const TOP_K = 3;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 3.6;

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(record) {
  return new Set(
    normalize([
      record.title,
      record.abstract,
      ...(record.subjects || [])
    ].join(" "))
      .split(" ")
      .filter(token => token.length >= 4)
  );
}

function lexicalSimilarity(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.sqrt(a.size * b.size);
}

function semanticResult(record) {
  return {
    id: record.id || record.sourceId || null,
    title: record.title || "",
    abstract: record.abstract || null,
    doi: record.doi || null,
    journal: record.journal || null,
    providers: ["CUCSH Filosofía"],
    sourceRecords: [{
      provider: "CUCSH Filosofía",
      sourceId: record.sourceId || record.id || null
    }],
    urls: {
      canonical: record.urls?.canonical || null,
      doi: record.urls?.doi || (record.doi ? "https://doi.org/" + record.doi : null)
    }
  };
}

function metadataScore(record) {
  return (record.doi ? 4 : 0) +
    (record.abstract ? 3 : 0) +
    Math.min(3, (record.subjects || []).length) +
    ((record.authors || []).length ? 1 : 0);
}

function cohort(records) {
  if (records.length <= MAX_ATLAS_RECORDS) return [...records];
  return [...records]
    .sort((a, b) =>
      metadataScore(b) - metadataScore(a) ||
      Number(b.year || 0) - Number(a.year || 0) ||
      String(a.title || "").localeCompare(String(b.title || ""), "es")
    )
    .slice(0, MAX_ATLAS_RECORDS);
}

async function mapLimit(values, limit, mapper) {
  const output = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return output;
}

function pairKey(a, b) {
  return a < b ? a + "|" + b : b + "|" + a;
}

function chooseEdges(nodes) {
  const candidates = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const left = nodes[i];
      const right = nodes[j];
      const qwen = left.vector && right.vector;
      const score = qwen
        ? cosineInt8(left.vector.bytes, right.vector.bytes)
        : lexicalSimilarity(left.record, right.record);

      if (score <= (qwen ? 0 : 0.06)) continue;

      candidates.push({
        a: i,
        b: j,
        score,
        source: qwen ? "qwen" : "textual",
        key: pairKey(left.id, right.id)
      });
    }
  }

  candidates.sort((a, b) =>
    (a.source === b.source ? 0 : a.source === "qwen" ? -1 : 1) ||
    b.score - a.score ||
    a.key.localeCompare(b.key)
  );

  const degree = new Map();
  const selected = [];

  for (const edge of candidates) {
    if (selected.length >= MAX_EDGES) break;
    const da = degree.get(edge.a) || 0;
    const db = degree.get(edge.b) || 0;
    if (da >= TOP_K || db >= TOP_K) continue;

    selected.push(edge);
    degree.set(edge.a, da + 1);
    degree.set(edge.b, db + 1);
  }

  return selected;
}

function hash(value) {
  let h = 2166136261;
  for (const ch of String(value || "")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function layout(nodes, edges) {
  const n = Math.max(nodes.length, 1);

  nodes.forEach((node, index) => {
    const jitter = (hash(node.id) % 1000) / 1000;
    const angle = (index / n) * Math.PI * 2 + jitter * 0.2;
    const radius = 0.5 + (jitter - 0.5) * 0.18;
    node.x = Math.cos(angle) * radius;
    node.y = Math.sin(angle) * radius;
  });

  for (let step = 0; step < 150; step += 1) {
    const fx = new Float64Array(nodes.length);
    const fy = new Float64Array(nodes.length);

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.0036) d2 = 0.0036;
        const force = 0.00155 / d2;
        fx[i] -= dx * force;
        fy[i] -= dy * force;
        fx[j] += dx * force;
        fy[j] += dy * force;
      }
    }

    for (const edge of edges) {
      const a = nodes[edge.a];
      const b = nodes[edge.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const target = edge.source === "qwen" ? 0.2 : 0.31;
      const strength = edge.source === "qwen" ? 0.021 : 0.0085;
      const force = (distance - target) * strength;

      fx[edge.a] += (dx / distance) * force;
      fy[edge.a] += (dy / distance) * force;
      fx[edge.b] -= (dx / distance) * force;
      fy[edge.b] -= (dy / distance) * force;
    }

    const cooling = 1 - step / 170;
    nodes.forEach((node, index) => {
      fx[index] += -node.x * 0.0018;
      fy[index] += -node.y * 0.0018;
      node.x += Math.max(-0.035, Math.min(0.035, fx[index])) * cooling;
      node.y += Math.max(-0.035, Math.min(0.035, fy[index])) * cooling;
    });
  }
}

function authorSearchUrl(name) {
  const url = new URL("", SITE_ROOT);
  url.searchParams.set("view", "author");
  url.searchParams.set("author", String(name || "").trim());
  url.hash = "results";
  return url.href;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function shortTitle(value, max = 34) {
  const text = String(value || "Sin título").replace(/\s+/g, " ").trim();
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

export class JournalSemanticAtlas {
  constructor({ canvas, status, detail, legend, controls = null, accent = "#0f62fe" }) {
    this.canvas = canvas;
    this.context = canvas?.getContext("2d") || null;
    this.status = status;
    this.detail = detail;
    this.legend = legend;
    this.controls = controls;
    this.accent = accent;
    this.nodes = [];
    this.edges = [];
    this.abortController = null;
    this.lastRecordsKey = "";
    this.qwenEnabled = false;
    this.client = null;
    this.resizeObserver = null;
    this.raf = 0;
    this.selectedNode = null;
    this.hoverNode = null;
    this.pointerState = null;
    this.view = { panX: 0, panY: 0, zoom: 1 };

    if (canvas && this.context) {
      canvas.style.touchAction = "none";
      canvas.addEventListener("wheel", event => this.onWheel(event), { passive: false });
      canvas.addEventListener("pointerdown", event => this.onPointerDown(event));
      canvas.addEventListener("pointermove", event => this.onPointerMove(event));
      canvas.addEventListener("pointerup", event => this.onPointerUp(event));
      canvas.addEventListener("pointercancel", event => this.onPointerUp(event));
      canvas.addEventListener("pointerleave", () => {
        if (!this.pointerState) {
          this.hoverNode = null;
          this.requestDraw();
        }
      });
      canvas.addEventListener("dblclick", () => this.fitView());

      this.resizeObserver = new ResizeObserver(() => {
        this.requestDraw();
      });
      this.resizeObserver.observe(canvas);
    }

    controls?.addEventListener("click", event => {
      const button = event.target.closest("[data-atlas-action]");
      if (!button) return;
      const action = button.dataset.atlasAction;
      if (action === "zoom-in") this.zoomBy(1.22);
      if (action === "zoom-out") this.zoomBy(1 / 1.22);
      if (action === "fit") this.fitView();
      if (action === "reset") this.resetLayout();
    });
  }

  setQwenEnabled(value) {
    this.qwenEnabled = Boolean(value);
  }

  async build(records, { categoryFor = () => "General", colorFor = () => this.accent } = {}) {
    if (!this.canvas || !this.context) return;

    this.abortController?.abort();
    this.abortController = new AbortController();

    const chosen = cohort(records);
    const key = chosen.map(record => record.id || record.sourceId || record.title).join("|") + "|" + this.qwenEnabled;

    if (key === this.lastRecordsKey && this.nodes.length) {
      this.requestDraw();
      return;
    }

    this.lastRecordsKey = key;
    this.status.textContent = this.qwenEnabled
      ? "Resolviendo vectores Qwen verificables…"
      : "Construyendo topología textual de respaldo…";

    let resolved = chosen.map(record => ({ record, vector: null, resolution: null }));

    if (this.qwenEnabled) {
      this.client ||= new ResearchAtlasQwenVectorClient();
      resolved = await mapLimit(chosen, 4, async record => {
        try {
          const result = await this.client.resolveAndFetch(
            semanticResult(record),
            { signal: this.abortController.signal }
          );
          return {
            record,
            resolution: result?.resolution || null,
            vector: result?.vector?.state === "verified" ? result.vector : null
          };
        } catch (error) {
          if (error?.name === "AbortError") throw error;
          return { record, vector: null, resolution: null };
        }
      });
    }

    this.nodes = resolved.map((item, index) => ({
      id: String(item.record.id || item.record.sourceId || index),
      record: item.record,
      vector: item.vector,
      resolution: item.resolution,
      category: categoryFor(item.record),
      color: colorFor(item.record, index)
    }));

    this.edges = chooseEdges(this.nodes);
    layout(this.nodes, this.edges);
    this.selectedNode = this.nodes[0] || null;
    this.hoverNode = null;

    const qwenNodes = this.nodes.filter(node => node.vector).length;
    const qwenEdges = this.edges.filter(edge => edge.source === "qwen").length;

    this.status.textContent =
      this.nodes.length + " nodos · " +
      this.edges.length + " conexiones · " +
      qwenNodes + " vectores Qwen verificados · " +
      qwenEdges + " relaciones Qwen" +
      (records.length > chosen.length ? " · muestra de " + chosen.length + " / " + records.length : "");

    if (this.legend) {
      this.legend.innerHTML =
        '<span><i class="atlas-key qwen"></i>Qwen verificado</span>' +
        '<span><i class="atlas-key textual"></i>Respaldo textual</span>' +
        '<span><i class="atlas-key node"></i>Artículo</span>';
    }

    this.renderDetail(this.selectedNode);
    this.fitView({ immediate: true });
  }

  resetLayout() {
    if (!this.nodes.length) return;
    layout(this.nodes, this.edges);
    this.selectedNode = this.nodes[0] || null;
    this.renderDetail(this.selectedNode);
    this.fitView();
  }

  metrics() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, globalThis.devicePixelRatio || 1));
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);

    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
    }

    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height, dpr, base: Math.min(width, height) * 0.42 };
  }

  point(node, metrics) {
    return {
      x: metrics.width / 2 + this.view.panX + node.x * metrics.base * this.view.zoom,
      y: metrics.height / 2 + this.view.panY + node.y * metrics.base * this.view.zoom
    };
  }

  worldPoint(screenX, screenY, metrics) {
    return {
      x: (screenX - metrics.width / 2 - this.view.panX) / (metrics.base * this.view.zoom),
      y: (screenY - metrics.height / 2 - this.view.panY) / (metrics.base * this.view.zoom)
    };
  }

  hitNode(screenX, screenY, metrics, radius = 18) {
    let best = null;
    let distance = radius;

    for (const node of this.nodes) {
      const point = this.point(node, metrics);
      const candidate = Math.hypot(point.x - screenX, point.y - screenY);
      if (candidate < distance) {
        best = node;
        distance = candidate;
      }
    }

    return best;
  }

  requestDraw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  }

  syncCanvasState() {
    if (!this.canvas) return;
    this.canvas.dataset.atlasZoom = this.view.zoom.toFixed(3);
    this.canvas.dataset.atlasPanX = this.view.panX.toFixed(1);
    this.canvas.dataset.atlasPanY = this.view.panY.toFixed(1);
    this.canvas.classList.toggle("is-dragging", Boolean(this.pointerState));
  }

  palette() {
    const dark = document.documentElement.dataset.theme === "dark";
    return {
      ink: dark ? "#f4f4f4" : "#161616",
      surface: dark ? "#262626" : "#ffffff",
      muted: dark ? "#c6c6c6" : "#525252",
      line: dark ? "#525252" : "#c6c6c6"
    };
  }

  draw() {
    if (!this.context) return;

    const metrics = this.metrics();
    const ctx = this.context;
    const colors = this.palette();

    ctx.clearRect(0, 0, metrics.width, metrics.height);

    if (!this.nodes.length) {
      ctx.fillStyle = colors.muted;
      ctx.font = "13px IBM Plex Sans, Helvetica Neue, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No hay artículos visibles para construir el Atlas.", metrics.width / 2, metrics.height / 2);
      this.syncCanvasState();
      return;
    }

    for (const edge of this.edges) {
      const a = this.point(this.nodes[edge.a], metrics);
      const b = this.point(this.nodes[edge.b], metrics);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.globalAlpha = edge.source === "qwen" ? 0.58 : 0.24;
      ctx.strokeStyle = edge.source === "qwen" ? this.accent : colors.line;
      ctx.lineWidth = edge.source === "qwen" ? 1.75 : 1;
      ctx.setLineDash(edge.source === "textual" ? [3, 5] : []);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    for (const node of this.nodes) {
      const point = this.point(node, metrics);
      const selected = node === this.selectedNode;
      const hovered = node === this.hoverNode;
      const radius = selected ? 9.5 : hovered ? 8.5 : node.vector ? 7 : 5.5;

      if (selected || hovered) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = selected ? this.accent : colors.line;
        ctx.globalAlpha = selected ? 0.14 : 0.1;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color || this.accent;
      ctx.fill();
      ctx.lineWidth = node.vector ? 2.3 : 1.4;
      ctx.strokeStyle = node.vector ? "#ffffff" : colors.surface;
      ctx.stroke();

      const showLabel = selected || hovered || this.view.zoom >= 1.18;
      if (showLabel) {
        this.drawLabel(ctx, point, shortTitle(node.record.title), colors, selected);
      }
    }

    ctx.globalAlpha = 1;
    this.syncCanvasState();
  }

  drawLabel(ctx, point, label, colors, selected) {
    ctx.font = selected
      ? "600 11px IBM Plex Sans, Helvetica Neue, Arial, sans-serif"
      : "500 10px IBM Plex Sans, Helvetica Neue, Arial, sans-serif";
    const width = Math.min(240, ctx.measureText(label).width + 14);
    const x = point.x + 11;
    const y = point.y - 17;

    ctx.fillStyle = colors.surface;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(x, y, width, 22);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = selected ? this.accent : colors.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, 21);
    ctx.fillStyle = colors.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 7, y + 11, width - 14);
  }

  onWheel(event) {
    if (!this.nodes.length) return;
    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const metrics = this.metrics();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const world = this.worldPoint(screenX, screenY, metrics);
    const factor = Math.exp(-event.deltaY * 0.0012);
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.view.zoom * factor));

    this.view.zoom = nextZoom;
    this.view.panX = screenX - metrics.width / 2 - world.x * metrics.base * nextZoom;
    this.view.panY = screenY - metrics.height / 2 - world.y * metrics.base * nextZoom;
    this.requestDraw();
  }

  onPointerDown(event) {
    if (!this.nodes.length) return;

    const rect = this.canvas.getBoundingClientRect();
    const metrics = this.metrics();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const node = this.hitNode(x, y, metrics);

    this.canvas.setPointerCapture?.(event.pointerId);

    if (node) {
      const world = this.worldPoint(x, y, metrics);
      this.pointerState = {
        type: "node",
        pointerId: event.pointerId,
        node,
        offsetX: node.x - world.x,
        offsetY: node.y - world.y,
        startX: x,
        startY: y,
        moved: 0
      };
      this.selectedNode = node;
      this.renderDetail(node);
    } else {
      this.pointerState = {
        type: "pan",
        pointerId: event.pointerId,
        startX: x,
        startY: y,
        originPanX: this.view.panX,
        originPanY: this.view.panY,
        moved: 0
      };
    }

    this.syncCanvasState();
  }

  onPointerMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const metrics = this.metrics();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (!this.pointerState) {
      const nextHover = this.hitNode(x, y, metrics);
      if (nextHover !== this.hoverNode) {
        this.hoverNode = nextHover;
        this.canvas.style.cursor = nextHover ? "pointer" : "grab";
        this.requestDraw();
      }
      return;
    }

    const state = this.pointerState;
    if (state.pointerId !== event.pointerId) return;

    state.moved = Math.max(
      state.moved,
      Math.hypot(x - state.startX, y - state.startY)
    );

    if (state.type === "pan") {
      this.view.panX = state.originPanX + (x - state.startX);
      this.view.panY = state.originPanY + (y - state.startY);
    } else if (state.type === "node") {
      const world = this.worldPoint(x, y, metrics);
      state.node.x = world.x + state.offsetX;
      state.node.y = world.y + state.offsetY;
    }

    this.requestDraw();
  }

  onPointerUp(event) {
    const state = this.pointerState;
    if (!state || state.pointerId !== event.pointerId) return;

    this.canvas.releasePointerCapture?.(event.pointerId);
    this.pointerState = null;
    this.canvas.classList.remove("is-dragging");
    this.canvas.style.cursor = this.hoverNode ? "pointer" : "grab";

    if (state.type === "node" && state.moved < 5) {
      this.selectedNode = state.node;
      this.renderDetail(state.node);
    }

    this.requestDraw();
  }

  zoomBy(factor) {
    if (!this.nodes.length) return;
    const metrics = this.metrics();
    const world = this.worldPoint(metrics.width / 2, metrics.height / 2, metrics);
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.view.zoom * factor));
    this.view.zoom = nextZoom;
    this.view.panX = -world.x * metrics.base * nextZoom;
    this.view.panY = -world.y * metrics.base * nextZoom;
    this.requestDraw();
  }

  fitView({ immediate = false } = {}) {
    if (!this.nodes.length) {
      this.view = { panX: 0, panY: 0, zoom: 1 };
      this.requestDraw();
      return;
    }

    const metrics = this.metrics();
    const xs = this.nodes.map(node => node.x);
    const ys = this.nodes.map(node => node.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const spanX = Math.max(0.25, maxX - minX);
    const spanY = Math.max(0.25, maxY - minY);
    const availableWidth = Math.max(220, metrics.width - 110);
    const availableHeight = Math.max(220, metrics.height - 120);
    const zoomX = availableWidth / (spanX * metrics.base);
    const zoomY = availableHeight / (spanY * metrics.base);
    const zoom = Math.max(MIN_ZOOM, Math.min(2.35, Math.min(zoomX, zoomY)));

    this.view.zoom = zoom;
    this.view.panX = -centerX * metrics.base * zoom;
    this.view.panY = -centerY * metrics.base * zoom;

    if (immediate) this.draw();
    else this.requestDraw();
  }

  renderDetail(node) {
    if (!this.detail) return;

    if (!node) {
      this.detail.innerHTML = "<p>Seleccione un nodo para inspeccionar el artículo.</p>";
      return;
    }

    const record = node.record;
    const authors = (record.authors || [])
      .map(author => author?.name || author?.sourceName)
      .filter(Boolean);
    const link = record.urls?.canonical ||
      record.urls?.doi ||
      (record.doi ? "https://doi.org/" + record.doi : "");

    const authorHtml = authors.length
      ? authors.map(name =>
          '<a class="journal-author-link" href="' + escapeAttribute(authorSearchUrl(name)) +
          '" title="Buscar a ' + escapeAttribute(name) + ' en toda la red">' +
          escapeHtml(name) + '</a>'
        ).join(" · ")
      : "Autor no indicado";

    this.detail.innerHTML =
      '<span class="atlas-detail-kicker">' +
      (node.vector ? "QWEN VERIFICADO" : "RESPALDO TEXTUAL") +
      '</span>' +
      '<h3>' + escapeHtml(record.title || "Sin título") + '</h3>' +
      '<p class="atlas-detail-authors">' + authorHtml + '</p>' +
      '<div class="atlas-detail-meta"><span>' + escapeHtml(record.year || "s/f") +
      '</span><span>' + escapeHtml(node.category || "General") + '</span></div>' +
      (link
        ? '<a class="atlas-detail-record" href="' + escapeAttribute(link) +
          '" target="_blank" rel="noopener noreferrer">Abrir registro ↗</a>'
        : "");
  }
}

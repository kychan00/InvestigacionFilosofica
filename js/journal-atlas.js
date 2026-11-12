import { ResearchAtlasQwenVectorClient } from "../src/core/research-atlas-qwen-vector-client.js";
import { cosineInt8 } from "../src/core/research-atlas-qwen-vector-range.js";

const SITE_ROOT = new URL("../", import.meta.url);
const MAX_ATLAS_RECORDS = 72;
const TOP_K = 3;
const MAX_EDGES = 150;
const MIN_ZOOM = 0.42;
const MAX_ZOOM = 4.2;

const STOPWORDS = new Set([
  "the","and","for","from","with","into","about","after","before","this","that","these","those",
  "between","through","over","under","within","without","where","when","which","while","of","to","in","on",
  "de","del","la","las","el","los","una","uno","unos","unas","que","como","entre","desde","hacia","tras",
  "ante","sin","sus","este","esta","estos","estas","donde","cuando","cual","cuales","pero","porque","para","por","con",
  "study","studies","analysis","analyses","approach","approaches","introduction","review","paper","article",
  "estudio","estudios","analisis","enfoque","enfoques","introduccion","revision","articulo"
]);

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedTokens(value) {
  return normalize(value)
    .split(" ")
    .filter(token =>
      token.length >= 3 &&
      !STOPWORDS.has(token) &&
      !/^\d+$/.test(token)
    );
}

function weightedTerms(node) {
  const counts = new Map();
  const add = (value, weight) => {
    for (const token of normalizedTokens(value)) {
      counts.set(token, (counts.get(token) || 0) + weight);
    }
  };

  add(node.record.title, 4.2);
  add((node.record.subjects || []).join(" "), 3.1);
  add(node.category, 1.8);
  add(node.record.abstract, 1.0);

  return counts;
}

function buildTextVectors(nodes) {
  const termMaps = nodes.map(weightedTerms);
  const df = new Map();

  for (const terms of termMaps) {
    for (const token of terms.keys()) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }

  return termMaps.map(terms => {
    const vector = new Map();
    let squared = 0;

    for (const [token, count] of terms) {
      const tf = 1 + Math.log(Math.max(count, 1e-9));
      const idf = Math.log((nodes.length + 1) / ((df.get(token) || 0) + 1)) + 1;
      const value = tf * idf;
      vector.set(token, value);
      squared += value * value;
    }

    const norm = Math.sqrt(squared) || 1;
    for (const [token, value] of vector) vector.set(token, value / norm);
    return vector;
  });
}

function cosineSparse(left, right) {
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  let score = 0;
  for (const [token, value] of small) {
    const other = large.get(token);
    if (other) score += value * other;
  }
  return Math.max(0, Math.min(1, score));
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

function confidenceFor(source, score) {
  if (source === "qwen") {
    if (score >= 0.62) return "high";
    if (score >= 0.42) return "medium";
    return "low";
  }
  if (score >= 0.22) return "high";
  if (score >= 0.075) return "medium";
  return "low";
}

function chooseEdges(nodes) {
  if (nodes.length < 2) return [];

  const vectors = buildTextVectors(nodes);
  const byNode = Array.from({ length: nodes.length }, () => []);
  const all = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const qwen = Boolean(nodes[i].vector && nodes[j].vector);
      const score = qwen
        ? Math.max(0, Math.min(1, cosineInt8(nodes[i].vector.bytes, nodes[j].vector.bytes)))
        : cosineSparse(vectors[i], vectors[j]);

      const edge = {
        a: i,
        b: j,
        score,
        source: qwen ? "qwen" : "textual",
        confidence: confidenceFor(qwen ? "qwen" : "textual", score),
        sameIssue: nodes[i].issue.key === nodes[j].issue.key,
        key: pairKey(nodes[i].id, nodes[j].id)
      };

      all.push(edge);
      byNode[i].push(edge);
      byNode[j].push(edge);
    }
  }

  const selected = new Map();
  const neighbors = Math.min(TOP_K, Math.max(1, nodes.length - 1));

  for (const candidates of byNode) {
    candidates
      .sort((left, right) =>
        (left.source === right.source ? 0 : left.source === "qwen" ? -1 : 1) ||
        right.score - left.score ||
        Number(right.sameIssue) - Number(left.sameIssue) ||
        left.key.localeCompare(right.key)
      )
      .slice(0, neighbors)
      .forEach(edge => selected.set(edge.key, edge));
  }

  if (selected.size < Math.min(nodes.length - 1, MAX_EDGES)) {
    all
      .sort((left, right) =>
        right.score - left.score ||
        Number(right.sameIssue) - Number(left.sameIssue) ||
        left.key.localeCompare(right.key)
      )
      .forEach(edge => {
        if (selected.size >= Math.min(nodes.length - 1, MAX_EDGES)) return;
        selected.set(edge.key, edge);
      });
  }

  return [...selected.values()]
    .sort((left, right) =>
      (left.source === right.source ? 0 : left.source === "qwen" ? -1 : 1) ||
      right.score - left.score ||
      left.key.localeCompare(right.key)
    )
    .slice(0, MAX_EDGES);
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function issueGroups(nodes) {
  const map = new Map();

  nodes.forEach((node, index) => {
    const group = map.get(node.issue.key) || {
      issue: node.issue,
      indices: []
    };
    group.indices.push(index);
    map.set(node.issue.key, group);
  });

  const groups = [...map.values()].sort((left, right) => {
    const a = left.issue.number ?? -1;
    const b = right.issue.number ?? -1;
    if (a !== b) return b - a;
    return left.issue.key.localeCompare(right.issue.key);
  });

  const count = groups.length;
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const spacingX = count <= 2 ? 1.1 : 1.0;
  const spacingY = 0.86;

  groups.forEach((group, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    group.centerX = (column - (columns - 1) / 2) * spacingX;
    group.centerY = (row - (rows - 1) / 2) * spacingY;
  });

  return groups;
}

function layout(nodes, edges) {
  const groups = issueGroups(nodes);
  const groupByKey = new Map(groups.map(group => [group.issue.key, group]));

  for (const group of groups) {
    const n = Math.max(1, group.indices.length);
    group.indices.forEach((nodeIndex, localIndex) => {
      const node = nodes[nodeIndex];
      const jitter = (stableHash(node.id) % 1000) / 1000;
      const angle = (localIndex / n) * Math.PI * 2 + jitter * 0.35;
      const radius = 0.11 + Math.min(0.24, Math.sqrt(n) * 0.028) + jitter * 0.035;
      node.x = group.centerX + Math.cos(angle) * radius;
      node.y = group.centerY + Math.sin(angle) * radius;
    });
  }

  for (let step = 0; step < 180; step += 1) {
    const fx = new Float64Array(nodes.length);
    const fy = new Float64Array(nodes.length);

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 0.0025) distanceSquared = 0.0025;

        const sameIssue = nodes[i].issue.key === nodes[j].issue.key;
        const repulsion = (sameIssue ? 0.00145 : 0.00082) / distanceSquared;

        fx[i] -= dx * repulsion;
        fy[i] -= dy * repulsion;
        fx[j] += dx * repulsion;
        fy[j] += dy * repulsion;
      }
    }

    for (const edge of edges) {
      const a = nodes[edge.a];
      const b = nodes[edge.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const target = edge.source === "qwen" ? 0.24 : edge.confidence === "high" ? 0.28 : 0.38;
      const baseStrength = edge.source === "qwen" ? 0.02 : edge.confidence === "high" ? 0.013 : 0.006;
      const scoreStrength = 0.45 + edge.score;
      const force = (distance - target) * baseStrength * scoreStrength;

      fx[edge.a] += (dx / distance) * force;
      fy[edge.a] += (dy / distance) * force;
      fx[edge.b] -= (dx / distance) * force;
      fy[edge.b] -= (dy / distance) * force;
    }

    nodes.forEach((node, index) => {
      const group = groupByKey.get(node.issue.key);
      if (!group) return;
      fx[index] += (group.centerX - node.x) * 0.011;
      fy[index] += (group.centerY - node.y) * 0.011;
    });

    const cooling = 1 - step / 205;
    nodes.forEach((node, index) => {
      node.x += Math.max(-0.035, Math.min(0.035, fx[index])) * cooling;
      node.y += Math.max(-0.035, Math.min(0.035, fy[index])) * cooling;
    });
  }

  return issueGroups(nodes);
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

function confidenceLabel(value) {
  if (value === "high") return "alta";
  if (value === "medium") return "media";
  return "débil";
}

function relationTerms(left, right) {
  const leftTerms = weightedTerms(left);
  const rightTerms = weightedTerms(right);
  const shared = [];

  for (const [token, leftWeight] of leftTerms) {
    const rightWeight = rightTerms.get(token);
    if (!rightWeight) continue;
    shared.push({
      token,
      weight: Math.min(leftWeight, rightWeight)
    });
  }

  return shared
    .sort((a, b) => b.weight - a.weight || a.token.localeCompare(b.token, "es"))
    .slice(0, 4)
    .map(item => item.token);
}

function relationMethod(edge) {
  if (edge.source === "qwen") return "Qwen verificado";
  if (edge.confidence === "high") return "Proximidad textual fuerte";
  if (edge.confidence === "medium") return "Proximidad textual media";
  return "Aproximación textual";
}

function relationExplanation(edge, sourceNode, targetNode) {
  const terms = relationTerms(sourceNode, targetNode);
  const parts = [];

  if (edge.source === "qwen") {
    parts.push("La cercanía principal proviene de vectores Qwen verificados.");
  } else if (terms.length) {
    parts.push("Coinciden especialmente en: " + terms.join(", ") + ".");
  } else {
    parts.push("Es uno de los vecinos más próximos dentro del corpus visible.");
  }

  if (edge.sameIssue) {
    parts.push("Además pertenece al mismo número editorial.");
  }

  return parts.join(" ");
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
    this.groups = [];
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

      this.resizeObserver = new ResizeObserver(() => this.requestDraw());
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

  async build(records, {
    categoryFor = () => "General",
    issueFor = () => ({
      key: "unknown",
      label: "Número no identificado",
      color: "#6f6f6f",
      number: null
    }),
    colorFor = () => this.accent
  } = {}) {
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
      : "Calculando vecinos semánticos y números editoriales…";

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
      issue: issueFor(item.record),
      color: colorFor(item.record, index)
    }));

    this.edges = chooseEdges(this.nodes);
    this.groups = layout(this.nodes, this.edges);
    this.selectedNode = this.nodes[0] || null;
    this.hoverNode = null;

    const qwenNodes = this.nodes.filter(node => node.vector).length;
    const qwenEdges = this.edges.filter(edge => edge.source === "qwen").length;
    const weakEdges = this.edges.filter(edge => edge.confidence === "low").length;

    this.status.textContent =
      this.nodes.length + " nodos · " +
      this.edges.length + " relaciones · " +
      this.groups.length + " números editoriales · " +
      qwenNodes + " vectores Qwen" +
      (weakEdges ? " · " + weakEdges + " aproximaciones débiles" : "") +
      (records.length > chosen.length ? " · muestra de " + chosen.length + " / " + records.length : "");

    this.renderLegend(qwenEdges);
    this.renderDetail(this.selectedNode);
    this.fitView({ immediate: true });
  }

  renderLegend(qwenEdges) {
    if (!this.legend) return;

    const relationLegend =
      '<div class="atlas-relation-legend">' +
        '<span><i class="atlas-key qwen"></i>' + (qwenEdges ? "Qwen verificado" : "Qwen disponible al activar") + '</span>' +
        '<span><i class="atlas-key textual"></i>Proximidad textual</span>' +
        '<span><i class="atlas-key weak"></i>Aproximación débil</span>' +
      '</div>';

    const issueLegend = this.groups
      .slice(0, 18)
      .map(group =>
        '<span class="atlas-issue-key" title="' + escapeAttribute(group.issue.label) + '">' +
          '<i style="--issue-color:' + escapeAttribute(group.issue.color) + '"></i>' +
          escapeHtml(group.issue.label) +
          '<small>' + group.indices.length + '</small>' +
        '</span>'
      )
      .join("");

    const overflow = this.groups.length > 18
      ? '<span class="atlas-issue-more">+' + (this.groups.length - 18) + ' números</span>'
      : "";

    this.legend.innerHTML =
      relationLegend +
      '<div class="atlas-issue-legend">' + issueLegend + overflow + '</div>';
  }

  resetLayout() {
    if (!this.nodes.length) return;
    this.groups = layout(this.nodes, this.edges);
    this.selectedNode = this.nodes[0] || null;
    this.renderLegend(this.edges.filter(edge => edge.source === "qwen").length);
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
    return { width, height, dpr, base: Math.min(width, height) * 0.34 };
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

  hitNode(screenX, screenY, metrics, radius = 19) {
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
    this.canvas.dataset.atlasEdges = String(this.edges.length);
    this.canvas.dataset.atlasIssues = String(this.groups.length);
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

  drawIssueRegions(ctx, metrics, colors) {
    for (const group of this.groups) {
      if (!group.indices.length) continue;

      const points = group.indices.map(index => this.point(this.nodes[index], metrics));
      const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
      const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
      const radius = Math.max(
        42,
        ...points.map(point => Math.hypot(point.x - cx, point.y - cy) + 24)
      );

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = group.issue.color;
      ctx.globalAlpha = 0.055;
      ctx.fill();
      ctx.globalAlpha = 0.24;
      ctx.strokeStyle = group.issue.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = group.issue.color;
      ctx.font = "700 10px IBM Plex Mono, SFMono-Regular, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(group.issue.label.toUpperCase(), cx - radius + 10, cy - radius + 18);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.line;
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

    this.drawIssueRegions(ctx, metrics, colors);

    const selectedIndex = this.selectedNode ? this.nodes.indexOf(this.selectedNode) : -1;

    for (const edge of this.edges) {
      const a = this.point(this.nodes[edge.a], metrics);
      const b = this.point(this.nodes[edge.b], metrics);
      const low = edge.confidence === "low";
      const medium = edge.confidence === "medium";
      const selectedEdge = selectedIndex >= 0 && (edge.a === selectedIndex || edge.b === selectedIndex);
      const dimmed = selectedIndex >= 0 && !selectedEdge;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.globalAlpha = dimmed
        ? 0.055
        : selectedEdge
          ? 0.9
          : edge.source === "qwen"
            ? 0.68
            : low
              ? 0.18
              : medium
                ? 0.32
                : 0.5;
      ctx.strokeStyle = selectedEdge
        ? (edge.source === "qwen" ? this.accent : this.selectedNode.issue.color)
        : edge.source === "qwen"
          ? this.accent
          : colors.line;
      ctx.lineWidth = selectedEdge
        ? (edge.source === "qwen" ? 3 : 2.2)
        : edge.source === "qwen"
          ? 1.9
          : low
            ? 0.8
            : 1.15;
      ctx.setLineDash(low ? [2, 6] : medium ? [4, 5] : []);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    for (const node of this.nodes) {
      const point = this.point(node, metrics);
      const selected = node === this.selectedNode;
      const hovered = node === this.hoverNode;
      const nodeIndex = this.nodes.indexOf(node);
      const related = selectedIndex >= 0 && this.edges.some(edge =>
        (edge.a === selectedIndex && edge.b === nodeIndex) ||
        (edge.b === selectedIndex && edge.a === nodeIndex)
      );
      const radius = selected ? 10 : hovered ? 8.7 : related ? 7.8 : node.vector ? 7.4 : 6.1;

      if (selected || hovered || related) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + (selected ? 5 : 3.5), 0, Math.PI * 2);
        ctx.fillStyle = node.issue.color;
        ctx.globalAlpha = selected ? 0.19 : related ? 0.13 : 0.11;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.issue.color;
      ctx.fill();
      ctx.lineWidth = node.vector ? 2.5 : 1.5;
      ctx.strokeStyle = node.vector ? "#ffffff" : colors.surface;
      ctx.stroke();

      if (selected || hovered || related || this.view.zoom >= 1.3) {
        this.drawLabel(ctx, point, shortTitle(node.record.title), colors, selected, node.issue.color);
      }
    }

    ctx.globalAlpha = 1;
    this.syncCanvasState();
  }

  drawLabel(ctx, point, label, colors, selected, issueColor) {
    ctx.font = selected
      ? "600 11px IBM Plex Sans, Helvetica Neue, Arial, sans-serif"
      : "500 10px IBM Plex Sans, Helvetica Neue, Arial, sans-serif";
    const width = Math.min(240, ctx.measureText(label).width + 14);
    const x = point.x + 12;
    const y = point.y - 18;

    ctx.fillStyle = colors.surface;
    ctx.globalAlpha = 0.94;
    ctx.fillRect(x, y, width, 23);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = selected ? issueColor : colors.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, 22);
    ctx.fillStyle = colors.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 7, y + 11.5, width - 14);
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

    state.moved = Math.max(state.moved, Math.hypot(x - state.startX, y - state.startY));

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
    const availableHeight = Math.max(220, metrics.height - 100);
    const zoomX = availableWidth / (spanX * metrics.base);
    const zoomY = availableHeight / (spanY * metrics.base);
    const zoom = Math.max(MIN_ZOOM, Math.min(2.5, Math.min(zoomX, zoomY)));

    this.view.zoom = zoom;
    this.view.panX = -centerX * metrics.base * zoom;
    this.view.panY = -centerY * metrics.base * zoom;

    if (immediate) this.draw();
    else this.requestDraw();
  }

  relatedEdgesFor(node) {
    const index = this.nodes.indexOf(node);
    if (index < 0) return [];

    const confidenceRank = { high: 3, medium: 2, low: 1 };

    return this.edges
      .filter(edge => edge.a === index || edge.b === index)
      .map(edge => {
        const targetIndex = edge.a === index ? edge.b : edge.a;
        return {
          edge,
          targetIndex,
          target: this.nodes[targetIndex]
        };
      })
      .sort((left, right) =>
        (left.edge.source === right.edge.source ? 0 : left.edge.source === "qwen" ? -1 : 1) ||
        (confidenceRank[right.edge.confidence] || 0) - (confidenceRank[left.edge.confidence] || 0) ||
        right.edge.score - left.edge.score ||
        String(left.target.record.title || "").localeCompare(String(right.target.record.title || ""), "es")
      );
  }

  focusNode(node) {
    if (!node) return;
    this.selectedNode = node;
    this.renderDetail(node);

    const metrics = this.metrics();
    this.view.panX = -node.x * metrics.base * this.view.zoom;
    this.view.panY = -node.y * metrics.base * this.view.zoom;
    this.requestDraw();
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

    const relations = this.relatedEdgesFor(node);
    const relationItems = relations.map(({ edge, targetIndex, target }) => {
      const targetRecord = target.record;
      const targetLink = targetRecord.urls?.canonical ||
        targetRecord.urls?.doi ||
        (targetRecord.doi ? "https://doi.org/" + targetRecord.doi : "");
      const terms = relationTerms(node, target);
      const scoreLabel = edge.source === "qwen" ? "coseno Qwen" : "coseno TF-IDF";
      const relationBadges =
        '<span class="atlas-relation-badge method">' + escapeHtml(relationMethod(edge)) + '</span>' +
        '<span class="atlas-relation-badge confidence confidence-' + escapeAttribute(edge.confidence) + '">' +
          'confianza ' + escapeHtml(confidenceLabel(edge.confidence)) +
        '</span>' +
        '<span class="atlas-relation-badge score">' +
          escapeHtml(scoreLabel) + ' ' + escapeHtml(edge.score.toFixed(2)) +
        '</span>' +
        (edge.sameIssue
          ? '<span class="atlas-relation-badge same-issue">mismo ' + escapeHtml(node.issue.label) + '</span>'
          : '');

      return (
        '<article class="atlas-related-item" data-related-card="' + escapeAttribute(target.id) + '">' +
          '<button class="atlas-related-focus" type="button" data-related-node="' + targetIndex + '">' +
            '<span class="atlas-related-dot" style="--issue-color:' + escapeAttribute(target.issue.color) + '"></span>' +
            '<span class="atlas-related-copy">' +
              '<strong>' + escapeHtml(targetRecord.title || "Sin título") + '</strong>' +
              '<small>' + escapeHtml(target.issue.label) + ' · ' + escapeHtml(targetRecord.year || "s/f") + '</small>' +
            '</span>' +
          '</button>' +
          '<div class="atlas-relation-badges">' + relationBadges + '</div>' +
          '<p class="atlas-related-why">' + escapeHtml(relationExplanation(edge, node, target)) + '</p>' +
          (terms.length
            ? '<div class="atlas-related-terms">' +
                terms.map(term => '<span>' + escapeHtml(term) + '</span>').join("") +
              '</div>'
            : '') +
          (targetLink
            ? '<a class="atlas-related-open" href="' + escapeAttribute(targetLink) +
              '" target="_blank" rel="noopener noreferrer">Abrir relacionado ↗</a>'
            : '') +
        '</article>'
      );
    }).join("");

    this.detail.innerHTML =
      '<span class="atlas-detail-kicker">' +
      (node.vector ? "QWEN VERIFICADO" : "PROXIMIDAD TEXTUAL") +
      '</span>' +
      '<h3>' + escapeHtml(record.title || "Sin título") + '</h3>' +
      '<p class="atlas-detail-authors">' + authorHtml + '</p>' +
      '<div class="atlas-detail-meta">' +
        '<span class="atlas-detail-issue" style="--issue-color:' + escapeAttribute(node.issue.color) + '">' +
          escapeHtml(node.issue.label) +
        '</span>' +
        '<span>' + escapeHtml(record.year || "s/f") + '</span>' +
        '<span>' + escapeHtml(node.category || "General") + '</span>' +
      '</div>' +
      '<p class="atlas-detail-method">El color identifica el número editorial. Al seleccionar un artículo se resaltan únicamente sus conexiones directas.</p>' +
      (link
        ? '<a class="atlas-detail-record" href="' + escapeAttribute(link) +
          '" target="_blank" rel="noopener noreferrer">Abrir registro ↗</a>'
        : '') +
      '<section class="atlas-related-section" aria-label="Relaciones semánticas del artículo">' +
        '<header class="atlas-related-header">' +
          '<div><span>RELACIONES SEMÁNTICAS</span><strong>' + relations.length + '</strong></div>' +
          '<p>Vecinos conectados con este artículo, ordenados por método y fuerza de proximidad.</p>' +
        '</header>' +
        (relations.length
          ? '<div class="atlas-related-list">' + relationItems + '</div>'
          : '<p class="atlas-related-empty">Este nodo no tiene relaciones visibles con los filtros actuales.</p>') +
      '</section>';

    this.detail.querySelectorAll("[data-related-node]").forEach(button => {
      button.addEventListener("click", () => {
        const target = this.nodes[Number(button.dataset.relatedNode)];
        this.focusNode(target);
      });
    });

    this.requestDraw();
  }
}

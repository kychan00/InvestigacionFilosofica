import { ResearchAtlasQwenVectorClient } from "../src/core/research-atlas-qwen-vector-client.js";
import { cosineInt8 } from "../src/core/research-atlas-qwen-vector-range.js";

const MAX_ATLAS_RECORDS = 72;
const MAX_EDGES = 120;
const TOP_K = 3;

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
  const ordered = [...records].sort((a, b) =>
    metadataScore(b) - metadataScore(a) ||
    Number(b.year || 0) - Number(a.year || 0) ||
    String(a.title || "").localeCompare(String(b.title || ""), "es")
  );
  return ordered.slice(0, MAX_ATLAS_RECORDS);
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
    const angle = (index / n) * Math.PI * 2 + jitter * 0.18;
    const radius = 0.56 + (jitter - 0.5) * 0.12;
    node.x = Math.cos(angle) * radius;
    node.y = Math.sin(angle) * radius;
  });

  for (let step = 0; step < 170; step += 1) {
    const fx = new Float64Array(nodes.length);
    const fy = new Float64Array(nodes.length);

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.0025) d2 = 0.0025;
        const f = 0.0016 / d2;
        fx[i] -= dx * f;
        fy[i] -= dy * f;
        fx[j] += dx * f;
        fy[j] += dy * f;
      }
    }

    for (const edge of edges) {
      const a = nodes[edge.a];
      const b = nodes[edge.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const target = edge.source === "qwen" ? 0.22 : 0.32;
      const strength = edge.source === "qwen" ? 0.018 : 0.008;
      const f = (distance - target) * strength;
      fx[edge.a] += (dx / distance) * f;
      fy[edge.a] += (dy / distance) * f;
      fx[edge.b] -= (dx / distance) * f;
      fy[edge.b] -= (dy / distance) * f;
    }

    const cooling = 1 - step / 190;
    nodes.forEach((node, index) => {
      fx[index] += -node.x * 0.0016;
      fy[index] += -node.y * 0.0016;
      node.x += Math.max(-0.035, Math.min(0.035, fx[index])) * cooling;
      node.y += Math.max(-0.035, Math.min(0.035, fy[index])) * cooling;
    });
  }
}

export class JournalSemanticAtlas {
  constructor({ canvas, status, detail, legend, accent = "#0f62fe" }) {
    this.canvas = canvas;
    this.context = canvas?.getContext("2d") || null;
    this.status = status;
    this.detail = detail;
    this.legend = legend;
    this.accent = accent;
    this.nodes = [];
    this.edges = [];
    this.abortController = null;
    this.lastRecordsKey = "";
    this.qwenEnabled = false;
    this.client = null;
    this.resizeObserver = null;

    if (canvas && this.context) {
      canvas.addEventListener("click", event => this.selectAt(event));
      this.resizeObserver = new ResizeObserver(() => this.draw());
      this.resizeObserver.observe(canvas);
    }
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
      this.draw();
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

    this.renderDetail(this.nodes[0] || null);
    this.draw();
  }

  metrics() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height, scale: Math.min(width, height) * 0.4 };
  }

  point(node, metrics) {
    return {
      x: metrics.width / 2 + node.x * metrics.scale,
      y: metrics.height / 2 + node.y * metrics.scale
    };
  }

  draw() {
    if (!this.context || !this.nodes.length) return;
    const m = this.metrics();
    const ctx = this.context;
    ctx.clearRect(0, 0, m.width, m.height);

    for (const edge of this.edges) {
      const a = this.point(this.nodes[edge.a], m);
      const b = this.point(this.nodes[edge.b], m);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.globalAlpha = edge.source === "qwen" ? 0.52 : 0.2;
      ctx.strokeStyle = edge.source === "qwen" ? this.accent : "#8d8d8d";
      ctx.lineWidth = edge.source === "qwen" ? 1.5 : 1;
      if (edge.source === "textual") ctx.setLineDash([3, 5]);
      else ctx.setLineDash([]);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    for (const node of this.nodes) {
      const p = this.point(node, m);
      ctx.beginPath();
      ctx.arc(p.x, p.y, node.vector ? 7 : 5.2, 0, Math.PI * 2);
      ctx.fillStyle = node.color || this.accent;
      ctx.fill();
      ctx.lineWidth = node.vector ? 2.4 : 1.3;
      ctx.strokeStyle = node.vector ? "#ffffff" : "rgba(255,255,255,.75)";
      ctx.stroke();
    }
  }

  selectAt(event) {
    if (!this.nodes.length) return;
    const rect = this.canvas.getBoundingClientRect();
    const m = { width: rect.width, height: rect.height, scale: Math.min(rect.width, rect.height) * 0.4 };
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best = null;
    let bestDistance = 18;
    for (const node of this.nodes) {
      const p = this.point(node, m);
      const distance = Math.hypot(p.x - x, p.y - y);
      if (distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }
    if (best) this.renderDetail(best);
  }

  renderDetail(node) {
    if (!this.detail) return;
    if (!node) {
      this.detail.innerHTML = "<p>Seleccione un nodo para inspeccionar el artículo.</p>";
      return;
    }
    const record = node.record;
    const authors = (record.authors || []).map(author => author?.name || author?.sourceName).filter(Boolean);
    const link = record.urls?.canonical || record.urls?.doi || (record.doi ? "https://doi.org/" + record.doi : "");
    this.detail.innerHTML =
      '<span class="atlas-detail-kicker">' + (node.vector ? "QWEN VERIFICADO" : "RESPALDO TEXTUAL") + '</span>' +
      '<h3>' + escapeHtml(record.title || "Sin título") + '</h3>' +
      '<p>' + escapeHtml(authors.join(" · ") || "Autor no indicado") + '</p>' +
      '<div class="atlas-detail-meta"><span>' + escapeHtml(record.year || "s/f") + '</span><span>' +
      escapeHtml(node.category || "General") + '</span></div>' +
      (link ? '<a href="' + escapeAttribute(link) + '" target="_blank" rel="noopener noreferrer">Abrir registro ↗</a>' : "");
  }
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

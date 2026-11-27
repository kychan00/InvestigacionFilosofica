// Screen-space labels shared by the integrated and standalone research atlases.
const KINDS = new Set(["authority-person", "author-mention", "work-direct", "work-expanded"]);
const rank = item => (item.selected ? 100 : item.hovered ? 80 : 0) +
  (item.kind === "authority-person" ? 40 : item.kind === "author-mention" ? 30 :
    item.kind === "work-direct" ? 20 : 10) + (item.connected ? 5 : 0);

export function atlasLabelsEnabled(zoom) {
  return Math.round(zoom * 100) >= 200;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
    a.y < b.y + b.h && a.y + a.h > b.y;
}

function truncate(text, max, measure) {
  if (measure(text) <= max) return text;
  const chars = Array.from(text);
  let low = 0, high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(chars.slice(0, mid).join("") + "…") <= max) low = mid;
    else high = mid - 1;
  }
  return chars.slice(0, low).join("").trimEnd() + "…";
}

export function layoutAtlasLabels(items, { width, height, zoom, measure }) {
  if (!atlasLabelsEnabled(zoom) || width < 60 || height < 40) return [];
  const mobile = width < 500;
  const fontSize = mobile ? 11 : 12;
  const maxText = Math.min(mobile ? 150 : 230, width - 24);
  const h = fontSize + 6;
  const inView = items.filter(item => Number.isFinite(item.x) && Number.isFinite(item.y) &&
    item.x >= 0 && item.x <= width && item.y >= 0 && item.y <= height);
  const nodes = inView.map(item => ({ id: item.id, x: item.x - 10, y: item.y - 10, w: 20, h: 20 }));
  const candidates = inView.filter(item => item.visible && KINDS.has(item.kind) &&
    typeof item.label === "string" && item.label.trim())
    .sort((a, b) => rank(b) - rank(a) || String(a.id).localeCompare(String(b.id)));
  const placed = [];
  // Bound the work per frame on dense maps. More labels become available by panning/zooming.
  const budget = Math.min(100, Math.max(8, Math.floor(width * height / 2400)));
  for (const item of candidates) {
    if (placed.length >= budget) break;
    const author = item.kind === "authority-person" || item.kind === "author-mention";
    const font = (author || item.selected ? "600 " : "400 ") + fontSize + "px system-ui, sans-serif";
    const measureText = text => measure(text, font);
    const label = truncate(item.label.trim().replace(/\s+/g, " "), maxText, measureText);
    const w = Math.ceil(measureText(label)) + 8;
    const gap = 12;
    const positions = [
      { x: item.x + gap, y: item.y - h / 2 },
      { x: item.x - gap - w, y: item.y - h / 2 },
      { x: item.x - w / 2, y: item.y - gap - h },
      { x: item.x - w / 2, y: item.y + gap }
    ];
    for (const pos of positions) {
      const rect = { ...pos, w, h };
      if (rect.x < 4 || rect.y < 4 || rect.x + w > width - 4 || rect.y + h > height - 4) continue;
      if (placed.some(other => overlaps(rect, other))) continue;
      if (nodes.some(other => other.id !== item.id && overlaps(rect, other))) continue;
      placed.push({ ...rect, id: item.id, label, font, author, kind: item.kind });
      break;
    }
  }
  return placed;
}

export function drawAtlasLabels(context, items, { width, height, zoom, ink, surface }) {
  if (!atlasLabelsEnabled(zoom)) return 0;
  context.save();
  try {
    const labels = layoutAtlasLabels(items, { width, height, zoom, measure(text, font) {
      context.font = font;
      return context.measureText(text).width;
    } });
    context.globalAlpha = 1;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.lineWidth = 3;
    context.strokeStyle = surface;
    context.fillStyle = ink;
    for (const label of labels) {
      context.font = label.font;
      context.strokeText(label.label, label.x + 4, label.y + label.h / 2);
      context.fillText(label.label, label.x + 4, label.y + label.h / 2);
    }
    return labels.length;
  } finally {
    context.restore();
  }
}

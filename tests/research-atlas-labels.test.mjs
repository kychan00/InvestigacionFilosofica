import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { atlasLabelsEnabled, layoutAtlasLabels, drawAtlasLabels } from "../js/research-atlas-labels.js";

const options = { width: 390, height: 500, zoom: 2, measure: text => Array.from(text).length * 6 };
const node = (id, kind, x, y, label, extra = {}) => ({ id, kind, x, y, label, visible: true, ...extra });
const author = node("a", "authority-person", 60, 60, "Immanuel Kant");
const work = node("w", "work-direct", 60, 150, "Crítica de la razón pura");
const mention = node("m", "author-mention", 60, 240, "Autor no resuelto");
test("200% readout activates author and work labels, lower zoom hides them", () => {
  assert.equal(atlasLabelsEnabled(1.99), false);
  assert.equal(atlasLabelsEnabled(2), true);
  assert.deepEqual(layoutAtlasLabels([author, work], { ...options, zoom: 1.99 }), []);
  assert.deepEqual(layoutAtlasLabels([author, work, mention], options).map(x => x.id), ["a", "m", "w"]);
});
test("filters and viewport are respected; long mobile titles are shortened", () => {
  const long = node("l", "work-expanded", 45, 340, "Título filosófico muy extenso ".repeat(12));
  const labels = layoutAtlasLabels([author, work, long,
    node("hidden", "work-direct", 60, 400, "Oculto", { visible: false }),
    node("off", "work-direct", -50, 200, "Fuera"),
    node("q", "query", 200, 350, "Consulta")], options);
  assert.deepEqual(labels.map(x => x.id), ["a", "w", "l"]);
  assert.ok(labels[2].label.endsWith("…"));
  assert.ok(labels.every(x => x.x >= 4 && x.y >= 4 && x.x + x.w <= 386 && x.y + x.h <= 496));
});
test("dense labels prioritize selection and avoid collisions", () => {
  const items = Array.from({length: 30}, (_, i) => node(String(i), "work-direct", 195, 250, "Obra " + i, { selected: i === 29 }));
  const labels = layoutAtlasLabels(items, options);
  assert.equal(labels[0].id, "29");
  assert.ok(labels.length < items.length);
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const a = labels[i], b = labels[j];
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }
});
test("canvas uses theme contrast and restores drawing state", () => {
  const calls = [];
  const ctx = { save(){ calls.push("save"); }, restore(){ calls.push("restore"); },
    measureText: t => ({ width: t.length * 6 }), strokeText(t){ calls.push("halo:" + t); },
    fillText(t){ calls.push("text:" + t); } };
  assert.equal(drawAtlasLabels(ctx, [author, work], { ...options, ink: "#fff", surface: "#111" }), 2);
  assert.equal(ctx.strokeStyle, "#111");
  assert.equal(ctx.fillStyle, "#fff");
  assert.equal(calls[0], "save");
  assert.equal(calls.at(-1), "restore");
  assert.equal(drawAtlasLabels(ctx, [author], { ...options, zoom: 1 }), 0);
});
test("both atlas renderers integrate the shared screen-space label layer", async () => {
  for (const file of ["js/research-atlas-embed.js", "js/research-atlas.js"]) {
    const source = await readFile(new URL("../" + file, import.meta.url), "utf8");
    assert.match(source, /import \{ atlasLabelsEnabled, drawAtlasLabels \}/);
    assert.match(source, /atlasLabelsEnabled\(view.zoom\)/);
    assert.match(source, /drawAtlasLabels\(context, labelItems/);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { bindResearchAtlasNavigation } from "../js/research-atlas-navigation.js";

function setup() {
  const handlers = new Map(), captured = new Set(), selected = [];
  const canvas = {
    style: {}, classList: { add() {}, remove() {} },
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
    addEventListener: (type, fn) => handlers.set(type, fn),
    setPointerCapture: id => captured.add(id),
    hasPointerCapture: id => captured.has(id),
    releasePointerCapture: id => captured.delete(id)
  };
  const view = { x: 0, y: 0, zoom: 1 };
  const navigation = bindResearchAtlasNavigation({
    canvas, view, metrics: () => ({ width: 400, height: 300, base: 100 }),
    draw() {}, hitTest: () => ({ id: "work" }), select: id => selected.push(id),
    hover() {}
  });
  const send = (type, id, x, y, extras = {}) => handlers.get(type)({
    pointerId: id, clientX: x + 10, clientY: y + 20, pointerType: "touch",
    button: 0, preventDefault() {}, ...extras
  });
  return { send, view, selected, captured, navigation };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + " != " + b);
test("pinch doubles scale, follows moving midpoint and never selects a work", () => {
  const { send, view, selected } = setup();
  send("pointerdown", 1, 100, 150);
  send("pointerdown", 2, 200, 150);
  send("pointermove", 1, 50, 150);
  send("pointermove", 2, 250, 150);
  near(view.zoom, 2);
  near(view.x, -0.25);
  send("pointermove", 1, 70, 170);
  send("pointermove", 2, 270, 170);
  near(view.x, -0.35);
  near(view.y, -0.1);
  send("pointerup", 2, 270, 170);
  send("pointermove", 1, 90, 170);
  near(view.x, -0.45);
  send("pointerup", 1, 90, 170);
  assert.deepEqual(selected, []);
  send("pointerdown", 3, 100, 100);
  send("pointerup", 3, 100, 100);
  assert.deepEqual(selected, ["work"]);
});
test("mouse wheel anchors zoom, mouse drag does not click, cancellation clears capture", () => {
  const { send, view, selected, captured, navigation } = setup();
  send("wheel", 0, 100, 100, { deltaY: -100, deltaMode: 0 });
  assert.ok(view.zoom > 1);
  near(view.x - 1 / view.zoom, -1);
  send("pointerdown", 1, 100, 100, { pointerType: "mouse" });
  send("pointermove", 1, 130, 100, { pointerType: "mouse" });
  send("pointerup", 1, 130, 100, { pointerType: "mouse" });
  assert.deepEqual(selected, []);
  send("pointerdown", 2, 100, 100);
  send("pointercancel", 2, 100, 100);
  assert.equal(captured.size, 0);
  assert.deepEqual(selected, []);
  send("pointerdown", 3, 100, 100);
  navigation.reset();
  assert.equal(captured.size, 0);
});
test("pinching inward and outward clamps scale", () => {
  const { send, view } = setup();
  send("pointerdown", 1, 100, 150);
  send("pointerdown", 2, 200, 150);
  send("pointermove", 2, 101, 150);
  near(view.zoom, 0.5);
  send("pointermove", 2, 1500, 150);
  near(view.zoom, 8);
});

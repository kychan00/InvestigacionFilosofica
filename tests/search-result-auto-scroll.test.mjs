import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSearchResultAutoScroll } from "../js/search-result-auto-scroll.js";

function setup({ prefersReducedMotion = false } = {}) {
  const frames = [];
  const scrolls = [];
  let cardVisible = false;
  const card = { scrollIntoView(options) { scrolls.push(options); } };
  const controller = createSearchResultAutoScroll({
    results: { querySelector: selector => {
      assert.equal(selector, "article.result-card");
      return cardVisible ? card : null;
    } },
    scheduleFrame: callback => frames.push(callback),
    reducedMotion: () => prefersReducedMotion
  });

  return {
    controller,
    frames,
    scrolls,
    setCardVisible: value => { cardVisible = value; }
  };
}

test("el botón Buscar espera a la primera ficha, no al esqueleto, y se desplaza una sola vez", () => {
  const { controller, frames, scrolls, setCardVisible } = setup();
  controller.reveal();
  controller.arm();
  controller.reveal();
  assert.equal(frames.length, 0);

  setCardVisible(true);
  controller.reveal();
  controller.reveal();
  assert.equal(frames.length, 1);
  assert.equal(scrolls.length, 0);
  frames.shift()();
  assert.deepEqual(scrolls, [{ block: "start", behavior: "smooth" }]);

  controller.reveal();
  assert.equal(frames.length, 0);
  assert.equal(scrolls.length, 1);
});

test("una búsqueda nueva invalida el desplazamiento pendiente de la anterior", () => {
  const { controller, frames, scrolls, setCardVisible } = setup();
  setCardVisible(true);
  controller.arm();
  controller.reveal();
  controller.arm();
  setCardVisible(false);
  frames.shift()();
  assert.equal(scrolls.length, 0);

  setCardVisible(true);
  controller.reveal();
  frames.shift()();
  assert.equal(scrolls.length, 1);
});

test("respeta la preferencia de movimiento reducido", () => {
  const { controller, frames, scrolls, setCardVisible } = setup({ prefersReducedMotion: true });
  setCardVisible(true);
  controller.arm();
  controller.reveal();
  frames.shift()();
  assert.equal(scrolls[0].behavior, "auto");
});

test("se integra con las búsquedas tradicional, semántica y las respuestas progresivas", async () => {
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /createSearchResultAutoScroll\(/u);
  assert.match(app, /searchResultAutoScroll\.arm\(\)/u);
  assert.equal((app.match(/searchResultAutoScroll\.reveal\(\)/gu) || []).length, 2);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8"
);
const mobile = readFileSync(
  new URL("../css/mobile-layout.css", import.meta.url),
  "utf8"
);
const siteMenu = readFileSync(
  new URL("../css/mobile-site-menu.css", import.meta.url),
  "utf8"
);

test("loads the mobile layer after the existing design system", () => {
  const grid = html.indexOf("./css/philosophical-grid.css");
  const mobileLink = html.indexOf("./css/mobile-layout.css");
  assert.ok(grid >= 0);
  assert.ok(mobileLink > grid);
});

test("limits mobile overrides to explicit viewport ranges", () => {
  assert.match(mobile, /@media \(max-width: 820px\)/);
  assert.match(mobile, /@media \(max-width: 620px\)/);
  assert.match(mobile, /@media \(max-width: 359px\)/);
  assert.match(mobile, /\.hero-shell \.search-form/);
  assert.match(mobile, /\.result-card/);
  assert.match(mobile, /\.filter-grid/);
  assert.match(mobile, /body\.author-view/);
  assert.match(mobile, /\.record-modal-panel/);
  assert.equal(
    (mobile.match(/\{/g) || []).length,
    (mobile.match(/\}/g) || []).length
  );
});


test("desktop navigation rail reserves its own gutter instead of covering content",()=>{
  assert.match(siteMenu,/\.site-desktop-rail\s*\{[\s\S]*?width:\s*46px/);
  assert.match(siteMenu,/@media \(min-width: 821px\)[\s\S]*?body\s*\{[\s\S]*?padding-left:\s*46px/);
  assert.match(siteMenu,/@media \(max-width: 820px\)[\s\S]*?\.site-desktop-rail\s*\{[\s\S]*?display:\s*none/);
});

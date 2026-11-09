import assert from "node:assert/strict";
import { ResearchAtlasQwenLocator } from "../../src/core/research-atlas-qwen-resolution.js";

const locator = new ResearchAtlasQwenLocator();

const direct = await locator.resolve({
  id: "openalex-W4388864320",
  providers: ["OpenAlex Philosophy"]
});
assert.equal(direct.state, "base-direct");
assert.deepEqual(direct.location, {
  source: "v4",
  workId: "W4388864320",
  vectorId: 436957,
  cluster: 27,
  ordinal: 1660
});

const alias = await locator.resolve({
  doi: "10.32870/qr.v1i1.63",
  providers: ["CUCSH Filosofía"]
});
assert.equal(alias.state, "base-alias");
assert.equal(alias.location.workId, "W2908224364");
assert.equal(alias.location.cluster, 164);
assert.equal(alias.location.ordinal, 97);

const overlay = await locator.resolve({
  doi: "10.12795/ambitos.2019.i43.10",
  providers: ["Crossref"]
});
assert.equal(overlay.state, "overlay");
assert.equal(
  overlay.location.identity,
  "doi:10.12795/ambitos.2019.i43.10"
);
assert.equal(overlay.location.ordinal, 0);

const unknown = await locator.resolve({
  title: "No authority",
  id: "unknown",
  providers: ["Internet Archive"]
});
assert.equal(unknown.state, "unresolved");

console.log(JSON.stringify({
  status: "pass",
  lookupOid: locator.pins.lookup.oid,
  overlayOid: locator.pins.overlay.oid,
  direct,
  alias,
  overlay,
  unknown,
  liveOpenAlexQueried: false,
  vectorsDownloaded: false,
  semanticNeighborEnabled: false
}, null, 2));

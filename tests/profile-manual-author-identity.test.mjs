import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const profile = readFileSync(new URL("../js/profile.js", import.meta.url), "utf8");
const data = readFileSync(new URL("../js/user-data.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../perfil.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/profile.css", import.meta.url), "utf8");
function extract(name) {
  const start = profile.indexOf("function " + name + "(");
  assert.ok(start >= 0, name);
  const end = profile.indexOf("\n}", start);
  assert.ok(end >= 0, name);
  return profile.slice(start, end + 2);
}
function engine(decisions = []) {
  const ctx = vm.createContext({ identityDecisions: decisions });
  vm.runInContext(["normalizedPersonName", "preferredCanonicalName", "equivalentNormalizedNames",
    "mergeAuthorIdentityEntries", "namesLookCompatible", "manualIdentityConflict"].map(extract).join("\n"), ctx);
  return ctx;
}
function entry(name, works = []) {
  return { names: new Set([name]), count: works.length, works, explicitRecords: [], savedRecords: [], orcids: new Set() };
}
test("manual suggestions recognize inverted names, dates and honorifics without auto-merging", () => {
  const e = engine();
  const a = "Menéndez y Pelayo, Marcelino, 1856-1912";
  const b = "D. Marcelino Menendez Y. Pelayo";
  assert.equal(e.namesLookCompatible(a, b), true);
  assert.equal(e.namesLookCompatible("Marcelino Menéndez Pelayo", "Marcelino García"), false);
  const entries = new Map([[e.normalizedPersonName(a), entry(a)], [e.normalizedPersonName(b), entry(b)]]);
  assert.equal(e.mergeAuthorIdentityEntries(entries).length, 2);
});
test("confirmed aliases remain unified when an intermediate spelling is absent; distinct works count once", () => {
  const a = "Marcelino Menéndez Pelayo", b = "Menendez Pelayo", c = "D. Marcelino Menendez Y. Pelayo";
  const e = engine([{ leftName:a,rightName:b,same:true,canonicalName:a },{ leftName:b,rightName:c,same:true,canonicalName:a }]);
  const shared = { id:"work1", title:"Historia de las ideas estéticas en España" };
  const entries = new Map([[e.normalizedPersonName(a), entry(a,[shared])], [e.normalizedPersonName(c), entry(c,[shared,{id:"work2"}])]]);
  const result = e.mergeAuthorIdentityEntries(entries);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, a);
  assert.equal(result[0].count, 2);
  assert.equal(result[0].works.length, 2);
});
test("manual review blocks conflicting ORCIDs and previous separate decisions", () => {
  const e = engine([{ leftName:"Ana Pérez",rightName:"A. Pérez",same:false }]);
  const group = (name, orcid = "") => ({name, aliases:[], orcid, explicitRecords:[], savedRecords:[]});
  assert.match(e.manualIdentityConflict([group("Ana Pérez"),group("A. Pérez")]), /decisión anterior/);
  assert.match(e.manualIdentityConflict([group("A", "0000-0001"),group("B", "0000-0002")]), /ORCID distintos/);
  assert.equal(e.manualIdentityConflict([group("A", "https://orcid.org/0000-0001"),group("B","0000-0001")]), "");
});
test("manual UI exposes multiple choices, search, explicit confirmation and atomic private storage", () => {
  assert.match(page, /id="manual-identity-review"/);
  assert.match(profile, /data-project-author-unify/);
  assert.match(profile, /data-manual-identity-search/);
  assert.match(profile, /data-manual-identity-choice\]:checked/);
  assert.match(profile, /await saveAuthorIdentityDecisions\(uid/);
  assert.match(data, /writeBatch\(database\)/);
  assert.match(data, /batch\.commit\(\)/);
  assert.match(css, /manual-identity-option\[hidden\]/);
});

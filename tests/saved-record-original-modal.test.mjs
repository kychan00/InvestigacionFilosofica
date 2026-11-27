import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { capturePublicRecord, restoreSavedPublicRecord, savedWorkRecordUrl, recordRequestFromLocation } from "../js/record-deeplink.js";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("the saved edition opens by its library ID and does not expose a search query", () => {
  const work = { id:"work-ser-y-tiempo-123", title:"Ser y tiempo", sourceRecordId:"internetarchive:ser-y-tiempo" };
  const url = new URL(savedWorkRecordUrl(work), "https://example.com/");
  assert.equal(url.searchParams.get("workTitle"), null);
  assert.deepEqual(recordRequestFromLocation(url.search), { savedId:work.id, privateRecord:true });
  assert.deepEqual(recordRequestFromLocation("?view=record&savedWork=../other"), {savedId:"",privateRecord:true});
  assert.equal(savedWorkRecordUrl({...work,privateOnly:true}), "");
});
test("older Internet Archive saves retain the exact edition and recover its deterministic original URL", () => {
  const work = { id:"work-ser-y-tiempo-123", title:"Ser y tiempo", authors:[{name:"Martin Heidegger"}],
    year:1927, providers:["Internet Archive"], type:"archive-text", sourceRecordId:"internetarchive:ser-y-tiempo-edicion-a" };
  const restored = restoreSavedPublicRecord(work);
  assert.equal(restored.title,work.title);
  assert.equal(restored.id,work.sourceRecordId);
  assert.equal(restored.urls.canonical,"https://archive.org/details/ser-y-tiempo-edicion-a");
  assert.equal(restored.doi,"");
  assert.equal(restored.legacy,true);
  assert.equal(restored.relevanceScore,null);
});
test("original modal metadata survives successive normalization and unsafe URLs are rejected", () => {
  const original = { id:"W123", title:"Example", doi:"10.1234/example", year:2020,
    authors:[{name:"Author",id:"A123"}], abstract:"Abstract", language:"en", citedBy:12,
    urls:{canonical:"https://example.org/edition-a",openAccess:"https://example.org/pdf",reference:"javascript:alert(1)"},
    sourceRecords:[{provider:"Internet Archive",sourceId:"edition-a",externalDescription:"Original description"}],
    sourceLinks:[{url:"https://example.org/other",provider:"Crossref"},{url:"javascript:alert(1)"}],
    providers:["Internet Archive","Crossref"],topics:[{name:"Philosophy"}],isbn:["123"],relevanceScore:82 };
  const snapshot = capturePublicRecord(original);
  const saved = {id:"work-example-123",title:original.title,sourceRecordId:original.id,recordSnapshot:snapshot};
  const second = capturePublicRecord(saved);
  assert.deepEqual(second,snapshot);
  const restored = restoreSavedPublicRecord(saved);
  assert.equal(restored.abstract,"Abstract");
  assert.equal(restored.doi,"10.1234/example");
  assert.equal(restored.urls.openAccess,"https://example.org/pdf");
  assert.equal(restored.urls.reference,undefined);
  assert.equal(restored.sourceLinks.length,1);
  assert.equal(restored.sourceRecords[0].externalDescription,"Original description");
  assert.equal(restored.savedRecordView,true);
  assert.equal(restoreSavedPublicRecord({...saved,privateOnly:true}),null);
});
test("private record route reads only the signed-in library before calling the existing modal", () => {
  const app = read("js/app.js");
  const route = app.slice(app.indexOf("async function openSavedPublicRecord"), app.indexOf("  const query = request.title || request.doi;"));
  assert.match(route,/getLibraryWork\(user.uid, request.savedId\)/);
  assert.match(route,/user\?\.emailVerified/);
  assert.match(route,/openRecord\(original\)/);
  assert.doesNotMatch(route,/runFederatedSearch\(/);
  assert.match(read("js/user-data.js"),/recordSnapshot: capturePublicRecord\(work\)/);
});

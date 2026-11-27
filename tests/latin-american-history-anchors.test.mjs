import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LATAM_HISTORY_ANCHORS} from "../src/core/latin-american-history-anchors.js";
import {timelineHistoryAuthor} from "../src/core/author-timeline-history-identity.js";
import {latinAmericanDossierHref,latinAmericanHistoryIdentity} from "../src/core/latin-american-history-bridge.js";
for(const [id,qid,names,groups] of LATAM_HISTORY_ANCHORS){test("matrix-backed history anchors: "+names[0],()=>{
 const key=String(id).padStart(4,"0");
 const r=JSON.parse(readFileSync(new URL("../src/data/philosopher-works/authors/"+key+".json",import.meta.url),"utf8"));
 assert.equal(latinAmericanHistoryIdentity(r)?.wikidataId,qid);
 assert.equal(r.canonical_name,names[0]);
 for(const g of groups)assert.ok(r.works.some(w=>w.title===g[0]&&!w.edition_of_work),"Missing independent work: "+g[0]);
 const a={catalog:"federated",displayName:names[0]},works=groups.map(g=>({title:g[0],authors:[{name:names[0]}]}));
 const resolved=timelineHistoryAuthor(a,works);
 assert.equal(resolved.wikidataId,qid);
 assert.equal(latinAmericanDossierHref(resolved),"./filosofia-latinoamericana.html#autor-"+key);
 assert.equal(timelineHistoryAuthor(a,[works[0]]),a);
 assert.equal(timelineHistoryAuthor(a,[works[0],works[0]]),a);
 assert.equal(timelineHistoryAuthor(a,works.map(w=>({...w,authors:[{name:"Otro autor"}]}))),a);
 assert.equal(timelineHistoryAuthor(a,works.map(w=>({...w,authors:[{name:names[0],wikidataId:"Q1"}]}))),a);
 const conflict={...a,wikidataId:"Q1"};assert.equal(timelineHistoryAuthor(conflict,works),conflict);
 assert.equal(a.wikidataId,undefined);
});}

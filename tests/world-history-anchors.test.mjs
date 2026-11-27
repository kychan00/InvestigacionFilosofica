import test from "node:test";
import assert from "node:assert/strict";
import {WORLD_HISTORY_ANCHORS} from "../src/core/world-history-anchors.js";
import {timelineHistoryAuthor} from "../src/core/author-timeline-history-identity.js";
import {intellectualHistory} from "../src/core/author-intellectual-history.js";
test("fifteen distinct new authority records",()=>{
 assert.equal(WORLD_HISTORY_ANCHORS.length,15);
 assert.equal(new Set(WORLD_HISTORY_ANCHORS.map(r=>r[0])).size,15);
});
for(const [qid,names,groups,source] of WORLD_HISTORY_ANCHORS)test("historical authority: "+names[0],()=>{
 const a={id:"1234",displayName:names[0]}, works=groups.map(g=>({title:g[0],authors:[{name:names[0],id:"A1234"}]}));
 assert.ok(intellectualHistory({...a,wikidataId:qid}),"Curated history must exist");
 assert.equal(new URL(source).protocol,"https:");
 assert.equal(timelineHistoryAuthor(a,works).wikidataId,qid);
 assert.equal(timelineHistoryAuthor(a,[works[0]]),a);
 assert.equal(timelineHistoryAuthor(a,groups[0].map(title=>({...works[0],title}))),a);
 assert.equal(timelineHistoryAuthor(a,works.map(w=>({...w,authors:[{name:names[0],id:"A9999"}]}))),a);
 assert.equal(timelineHistoryAuthor(a,works.map(w=>({...w,authors:[{name:names[0],role:"translator"}]}))),a);
 assert.equal(timelineHistoryAuthor(a,works.map(w=>({...w,authors:[{name:"Un investigador distinto"}]}))),a);
 const conflicting={...a,wikidataId:"Q1"};assert.equal(timelineHistoryAuthor(conflicting,works),conflicting);
 assert.equal(a.wikidataId,undefined);
});

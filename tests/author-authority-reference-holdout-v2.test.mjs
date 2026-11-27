import test from "node:test";
import assert from "node:assert/strict";
import {buildReferenceHoldout} from "../src/core/author-authority-reference-holdout-v2.js";
test("documentary reference probes preserve missing candidates and exclude overlap",async()=>{
 const r=await buildReferenceHoldout({inventory:{source:{title:"fixture"},philosophers:[{id:1,name:"Latin Author",status:"confirmed"},{id:2,name:"Prior",status:"confirmed"}]},timeline:[{qid:"Q1",names:["Old Author"],region:"europe",birth:1800,sources:[{url:"https://example.org"}]},{qid:"Q2",names:["New Author"],region:"europe",birth:1950,sources:[{url:"https://example.org"}]}],excludedNames:["Prior"],excludedIds:["8"],lookup:async n=>n==="Old Author"?[{id:"8",n}]:n==="New Author"?[{id:"9",n}]:[],quotas:{contemporary:1,historical:1,"latin-american":1}});
 assert.deepEqual(r.counts,{contemporary:1,historical:0,"latin-american":1});
 assert.equal(r.diagnostics.noCandidate,1);assert.equal(r.shortfalls.historical,1);
 assert.ok(r.cases.every(c=>c.judgment===null));
});

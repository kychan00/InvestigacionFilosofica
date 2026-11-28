import test from "node:test";
import assert from "node:assert/strict";
import {buildReferenceHoldout} from "../src/core/author-authority-reference-holdout-v2.js";
test("documentary reference probes preserve missing candidates and exclude overlap",async()=>{
 const r=await buildReferenceHoldout({inventory:{source:{title:"fixture"},philosophers:[{id:1,name:"Latin Author",status:"confirmed"},{id:2,name:"Prior",status:"confirmed"}]},timeline:[{qid:"Q1",names:["Old Author"],region:"europe",birth:1800,sources:[{url:"https://example.org"}]},{qid:"Q2",names:["New Author"],region:"europe",birth:1950,sources:[{url:"https://example.org"}]}],excludedNames:["Prior"],excludedIds:["8"],lookup:async n=>n==="Old Author"?[{id:"8",n}]:n==="New Author"?[{id:"9",n}]:[],quotas:{contemporary:1,historical:1,"latin-american":1}});
 assert.deepEqual(r.counts,{contemporary:1,historical:0,"latin-american":1});
 assert.equal(r.diagnostics.noCandidate,1);assert.equal(r.shortfalls.historical,1);
 assert.ok(r.cases.every(c=>c.judgment===null));
});

test("external documented references supplement rather than replace the prior cohort",async()=>{
 const result=await buildReferenceHoldout({inventory:{philosophers:[]},timeline:[{qid:"Q1",names:["Original"],region:"europe",birth:1800,sources:[{url:"https://example.org"}]}],externalGroups:[{stratum:"historical",name:"Reference catalogue",url:"https://example.org/history",names:["Additional","Original"]},{stratum:"contemporary",name:"Faculty",url:"https://example.org/faculty",names:["Current"]}],lookup:async()=>[],quotas:{historical:2,contemporary:1,"latin-american":0}});
 assert.equal(result.cases[0].query,"Original");
 assert.equal(result.counts.historical,2);
 assert.equal(result.counts.contemporary,1);
 assert.equal(result.cases.find(c=>c.query==="Current").reference.kind,"academic-directory");
 assert.equal(result.cases.find(c=>c.query==="Current").reference.birth,undefined);
 assert.ok(result.cases.every(c=>c.judgment===null));
});

import test from "node:test";
import assert from "node:assert/strict";
import {buildContributionReview,buildPortraitReview,validateScopedJudgments} from "../src/core/author-authority-scoped-review-v2.js";
const p=(id,wid)=>({authorId:String(id),displayName:"Same name",works:[{workId:String(wid),title:"Book "+wid}]});
test("contribution probes are deterministic, distinct and never assigned gold",()=>{
 const cases=Array.from({length:12},(_,i)=>({audit_id:"C"+i,task:"identity-pair",profiles:[p(i*2+1,i*2+101),p(i*2+2,i*2+102)]}));
 const a=buildContributionReview(cases,{observedLimit:5,contrastLimit:5});
 assert.deepEqual(a,buildContributionReview(cases,{observedLimit:5,contrastLimit:5}));
 assert.equal(a.rows.length,10);
 assert.deepEqual(a.counts,{observed:5,contrast:5});
 assert.equal(new Set(a.rows.map(r=>r.target.authorId)).size,10);
 assert.equal(new Set(a.rows.map(r=>r.work.workId)).size,10);
 assert.ok(a.rows.every(r=>r.judgment===null&&!Object.hasOwn(r,"kind")));
});
test("portrait packet deduplicates identical media and preserves unavailable cases",()=>{
 const image={status:"downloaded",source:"https://commons.wikimedia.org/wiki/File:Test.jpg",entityId:"Q123",license:"PD"};
 const r=buildPortraitReview({results:[{name:"Test",candidates:[{id:"1",legacy:image,experimental:image},{id:"2",legacy:{status:"rate-limited"},experimental:{status:"rate-limited"}}]}]});
 assert.equal(r.rows.length,2);assert.equal(r.rows[0].options.length,1);assert.equal(r.rows[1].options.length,0);
 assert.equal(r.allocation["AA2-POR-001"].legacy.optionId,r.allocation["AA2-POR-001"].experimental.optionId);
 assert.equal(r.counts.withMedia,1);
});
test("scoped review requires evidence and rejects imaginary media judgments",()=>{
 const r=buildPortraitReview({results:[{candidates:[{id:"1",legacy:{status:"rate-limited"}}]}]});
 const j={audit_id:r.rows[0].audit_id,task:r.rows[0].task,judgment:"unresolved",reviewer:"R1",reviewedAt:"2026-11-27T12:00:00Z",note:"No image supplied",evidence:["https://example.org/archive"]};
 assert.equal(validateScopedJudgments(r.rows,[j]).resolved,0);
 assert.throws(()=>validateScopedJudgments(r.rows,[{...j,judgment:"reviewed"}]));
 assert.throws(()=>validateScopedJudgments(r.rows,[{...j,evidence:[]}]));
 assert.throws(()=>validateScopedJudgments(r.rows,[j,j]));
});

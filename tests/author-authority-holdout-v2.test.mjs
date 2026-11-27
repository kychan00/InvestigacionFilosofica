import test from "node:test";
import assert from "node:assert/strict";
import {selectNominalHoldout} from "../src/core/author-authority-holdout-v2.js";
test("nominal holdout excludes pilot and portrait profiles and preserves missing quotas",()=>{
 const p=(authorId,name)=>({authorId,name});
 const benchmark={nameCollisions:{sample:{"anchorless-homonym":[{profiles:[p("1","Ana"),p("2","Ana"),p("3","Ana"),p("4","Ana")]}]}},auditSample:{strata:{diacritics:[p("3","José"),p("5","María")],initials:[p("5","M. A."),p("6","A. B.")]}}};
 const args={benchmark,pilot:[{left:p("1"),right:p("9")}],portrait:{results:[{indexCandidates:[{id:"2"}]}]},quotas:{homonyms:2,"name-variants":1,initials:1}};
 const result=selectNominalHoldout(args);
 assert.deepEqual(result.counts,{homonyms:1,"name-variants":1,initials:1});
 assert.deepEqual(result.cases[0].profiles.map(x=>x.authorId),["3","4"]);
 assert.equal(result.cases[1].query,"Maria");assert.equal(result.cases[2].profiles[0].authorId,"6");
 assert.equal(result.shortfalls.homonyms,1);assert.ok(result.cases.every(c=>c.judgment===null));
 assert.deepEqual(result,selectNominalHoldout(args));
});

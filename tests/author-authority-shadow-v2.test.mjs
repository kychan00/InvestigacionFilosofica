import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {evaluateSnapshotPair,compareSnapshotShadow} from "../src/core/author-authority-shadow-v2.js";
import {adaptRecordedCase,compareRuntimeShadow} from "../scripts/authority/compare-runtime-shadow-v2.mjs";
const work=(id,collaborators)=>({workId:id,coauthors:collaborators.map(authorId=>({authorId}))});
const pair={audit_id:"AAH001",left:{authorId:"1",displayName:"Ana Pérez",orcids:["0000-0002-1825-0097"],works:[work("10",["3","4"])]},right:{authorId:"2",displayName:"Ana Pérez",orcids:["0000-0002-1825-0097"],works:[work("10",["3","4"])]}};
const datasetRevision="fixture";
test("single snapshot cannot authenticate identity even with shared ORCID and works",()=>{
 const out=evaluateSnapshotPair(pair,{datasetRevision});
 assert.equal(out.decision.status,"unresolved");
 assert.deepEqual(out.observations.sharedWorks,["10"]);
 assert.deepEqual(out.observations.sharedCoauthors,["3","4"]);
 assert.deepEqual(out.observations.sharedOrcid,["0000-0002-1825-0097"]);
 assert.ok(out.evidence.every(e=>e.reliability==="asserted"));
 assert.equal(new Set(out.evidence.map(e=>e.lineageKey)).size,1);
 assert.equal(evaluateSnapshotPair({...pair,left:{...pair.left,orcids:["0000-0002-1825-0098"]}},{datasetRevision}).observations.sharedOrcid.length,0);
});
test("legacy relation is compared after the new decision and cannot influence it",()=>{
 const manifest={audit_id:"AAH001",left:{authorId:"1"},right:{authorId:"2"},stratum:"test",current_relation:"same-person"};
 const a=compareSnapshotShadow({cases:[pair],manifestItems:[manifest],datasetRevision});
 const b=compareSnapshotShadow({cases:[pair],manifestItems:[{...manifest,current_relation:"different-person"}],datasetRevision});
 assert.deepEqual(a.results[0].decision,b.results[0].decision);
 assert.equal(a.unresolved,1);
 assert.equal(a.byStratum.test.disagreements,1);
 assert.throws(()=>compareSnapshotShadow({cases:[pair],manifestItems:[{...manifest,right:{authorId:"3"}}],datasetRevision}),/mismatched/);
});
const fixture=JSON.parse(await readFile(new URL("../benchmark/author-authority/v2/runtime-regressions.json",import.meta.url),"utf8"));
const reviewed=JSON.parse(await readFile(new URL("../benchmark/author-authority/v2/reviewed-replay-evidence.json",import.meta.url),"utf8"));
test("identical raw inputs remain distinct from the four editorial source-enriched replays",()=>{
 const report=compareRuntimeShadow(fixture,reviewed);
 assert.equal(report.results.length,13);
 assert.equal(report.reviewedComparison.count,4);
 assert.equal(report.results.find(x=>x.id==="chalmers-1627").actual,"abstain");
 assert.equal(report.results.find(x=>x.id==="chalmers-1627").enriched.actual,"reject");
 assert.equal(report.results.find(x=>x.id==="chalmers-philosophy").enriched.actual,"accept");
 assert.equal(report.results.find(x=>x.id==="jaeggi-publisher").enriched.actual,"accept");
 assert.equal(report.reviewedComparison.enriched.falseAccepts,0);
 assert.equal(report.reviewedComparison.enriched.falseNegatives,0);
 assert.deepEqual(report,compareRuntimeShadow(fixture,reviewed));
});
test("expected labels never drive adaptation; edited records cannot reuse reviewed evidence",()=>{
 const c=fixture.cases[0];
 assert.deepEqual(adaptRecordedCase(c,fixture.base),adaptRecordedCase({...c,expected:"reject"},fixture.base));
 const altered=structuredClone(fixture);altered.cases[0].work.title="Different work";
 assert.throws(()=>compareRuntimeShadow(altered,reviewed),/binding mismatch/);
});

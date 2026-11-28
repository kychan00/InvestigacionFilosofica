import test from "node:test";
import assert from "node:assert/strict";
import {scoreIdentityPilot,evaluateReleaseReadiness} from "../src/core/author-authority-release-v2.js";
const rows=[{auditId:"a",shadowRelation:"same-person",legacyRelation:"same-person"},{auditId:"b",shadowRelation:"unresolved",legacyRelation:"same-person"},{auditId:"c",shadowRelation:"different-person",legacyRelation:"different-person"}];
const j=(audit_id,judgment)=>({audit_id,judgment,note:"Reviewed fixture",evidence:["fixture:independent"]});
test("empty human review means unknown accuracy, not perfect precision",()=>{
 const r=scoreIdentityPilot(rows);
 assert.equal(r.reviewed,0);assert.equal(r.experimental.precision,null);assert.equal(r.experimental.recall,null);assert.equal(r.experimental.coverage,null);
});
test("abstention lowers coverage and recall without becoming a false split",()=>{
 const r=scoreIdentityPilot(rows,[j("a","same-person"),j("b","same-person"),j("c","different-person")]);
 assert.equal(r.experimental.precision,1);assert.equal(r.experimental.recall,.5);assert.equal(r.experimental.coverage,2/3);assert.equal(r.experimental.falseSplit,0);
 assert.equal(r.experimental.abstained,1);
});
test("reject duplicate, unknown, undocumented human judgments",()=>{
 assert.throws(()=>scoreIdentityPilot(rows,[j("a","same-person"),j("a","different-person")]));
 assert.throws(()=>scoreIdentityPilot(rows,[j("x","same-person")]));
 assert.throws(()=>scoreIdentityPilot(rows,[{audit_id:"a",judgment:"same-person"}]));
});
const policy={schemaVersion:"author-authority-v2-release-policy-v1",mode:"preview-only",identityPilot:{pairs:3,minimumResolved:2,minimumPrecision:.98,minimumRecall:.85,minimumCoverage:.8,maxFalseMerges:0},portrait:{minimumComparableCoverage:.8,minimumDownloaded:1,minimumReviewed:20},contribution:{minimumReviewed:100},independentFinal:{minimumCases:300}};
const snapshot={schemaVersion:"authority-snapshot-shadow-v2",datasetRevision:"fixture",provenance:{sampleSha256:"hash"},count:3,results:rows};
const bibliography={schemaVersion:"authority-bibliography-snapshot-v2",datasetRevision:"fixture",provenance:{sampleSha256:"hash"},summary:{profiles:6}};
const portraits={schemaVersion:"siva-live-cohort-report-v1",revision:"fixture",results:[{candidates:[{status:"measured",legacy:{status:"rate-limited"},experimental:{status:"downloaded"}},{status:"measured",legacy:{status:"abstained"},experimental:{status:"abstained"}}]}]};
test("provider failure is not a comparable gain; scientific gate stays closed",()=>{
 const r=evaluateReleaseReadiness({policy,snapshot,bibliography,portraits});
 assert.equal(r.activationAllowed,false);assert.equal(r.scientificReady,false);
 assert.equal(r.portrait.comparable,1);assert.equal(r.portrait.gains,0);assert.equal(r.portrait.rateLimited,1);
 assert.ok(r.blockers.some(b=>b.code==="portrait-provider-coverage"));
 assert.ok(r.blockers.some(b=>b.code==="independent-final-cohort-not-adjudicated"));
 assert.equal(r.bibliography.precision,null);
});
test("mixed dataset or sample cannot pass",()=>{
 assert.throws(()=>evaluateReleaseReadiness({policy,snapshot,bibliography,portraits:{...portraits,revision:"other"}}),/revision/);
 assert.throws(()=>evaluateReleaseReadiness({policy,snapshot,bibliography:{...bibliography,provenance:{sampleSha256:"other"}},portraits}),/sample/);
});

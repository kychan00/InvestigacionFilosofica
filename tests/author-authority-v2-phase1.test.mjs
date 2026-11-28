import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {EVIDENCE_SCHEMA,DECISION_SCHEMA,validateEvidenceV2,validateDecisionV2,independentEvidenceGroups} from "../src/core/author-authority-evidence-v2.js";
import {measure,runRuntimeBaseline} from "../scripts/authority/audit-runtime-v2.mjs";
const evidence=(overrides={})=>({schemaVersion:EVIDENCE_SCHEMA,id:"e1",subjectRef:"mention:1",objectRef:"person:1",scope:"identity",kind:"publisher-identifier",polarity:"supports",sourceRefs:["source:publisher"],lineageKey:"publisher:record1",reliability:"verified",revision:"snapshot1",...overrides});
const decision=(overrides={})=>({schemaVersion:DECISION_SCHEMA,id:"d1",subjectRef:"mention:1",objectRef:"person:1",scope:"identity",status:"confirmed",evidenceRefs:["e1"],reasonCodes:["verified-identifier"],algorithmVersion:"2.0-experimental",datasetRevision:"snapshot1",...overrides});
test("evidence must preserve scope, sources, revision and lineage",()=>{
 assert.deepEqual(validateEvidenceV2(evidence()),[]);
 for(const field of ["scope","sourceRefs","lineageKey","revision","reliability"])assert.ok(validateEvidenceV2(evidence({[field]:null})).includes(field));
 assert.ok(validateEvidenceV2(evidence({polarity:"missing"})).includes("polarity"));
});
test("mirrors of the same publisher record do not add independent evidence",()=>{
 const mirror=evidence({id:"e2",sourceRefs:["source:mirror"]});
 assert.equal(independentEvidenceGroups([evidence(),mirror]).length,1);
 assert.equal(independentEvidenceGroups([evidence(),mirror,evidence({id:"e3",lineageKey:"institution:record1"})]).length,2);
 assert.equal(independentEvidenceGroups([evidence(),evidence({id:"e4",objectRef:"person:2"})]).length,2);
});
test("decisions preserve uncertainty and cannot borrow evidence for a different person or scope",()=>{
 assert.deepEqual(validateDecisionV2(decision(),[evidence()]),[]);
 assert.ok(validateDecisionV2(decision(),[]).includes("invalidEvidenceLink"));
 assert.ok(validateDecisionV2(decision(),[evidence({objectRef:"person:2"})]).includes("objectMismatch"));
 assert.ok(validateDecisionV2(decision(),[evidence({scope:"portrait"})]).includes("invalidEvidenceLink"));
 assert.deepEqual(validateDecisionV2(decision({status:"unresolved",objectRef:null,evidenceRefs:[],reasonCodes:["missing-evidence"]}),[]),[]);
 const contradiction=evidence({id:"e2",polarity:"contradicts"});
 assert.ok(validateDecisionV2(decision({evidenceRefs:["e1","e2"]}),[evidence(),contradiction]).includes("verifiedContradiction"));
 assert.deepEqual(validateDecisionV2(decision({status:"rejected",evidenceRefs:["e2"],reasonCodes:["identity-conflict"]}),[contradiction]),[]);
});
test("metrics keep abstention separate from rejection and report undefined denominators",()=>{
 const m=measure([{expected:"accept",actual:"accept"},{expected:"accept",actual:"abstain"},{expected:"reject",actual:"accept"},{expected:"abstain",actual:"accept"},{expected:"abstain",actual:"abstain"}]);
 assert.equal(m.precision,.5);assert.equal(m.recall,.5);assert.equal(m.falseAccepts,1);assert.equal(m.unsafeAcceptOnAbstain,1);assert.equal(m.abstentions,2);
 assert.equal(measure([]).precision,null);
});
test("baseline executes production matchers deterministically, without external calls",async()=>{
 const fixture=JSON.parse(await readFile(new URL("../benchmark/author-authority/v2/runtime-regressions.json",import.meta.url),"utf8"));
 const first=runRuntimeBaseline(fixture);
 assert.deepEqual(first,runRuntimeBaseline(fixture));
 assert.equal(first.results.length,fixture.cases.length);
 assert.ok(first.results.every(r=>typeof r.match==="boolean"));
 assert.equal(first.results.find(r=>r.id==="benjamin-inverted").actual,"reject");
 assert.equal(first.results.find(r=>r.id==="synthetic-interdisciplinary").actual,"accept");
 assert.equal(first.results.find(r=>r.id==="synthetic-name-only").actual,"abstain");
 assert.throws(()=>runRuntimeBaseline({...fixture,cases:[fixture.cases[0],fixture.cases[0]]}),/Invalid case/);
});

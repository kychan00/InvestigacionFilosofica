import test from "node:test";
import assert from "node:assert/strict";
import {resolveAuthorityV2} from "../src/core/author-authority-resolution-v2.js";
import {EVIDENCE_SCHEMA,validateDecisionV2} from "../src/core/author-authority-evidence-v2.js";
const context={subjectRef:"mention:1",scope:"identity",datasetRevision:"hf-snapshot:fixture",candidateRefs:["person:1"]};
const e=(id,kind,extra={})=>({schemaVersion:EVIDENCE_SCHEMA,id,kind,subjectRef:"mention:1",objectRef:"person:1",scope:"identity",polarity:"supports",reliability:"corroborated",sourceRefs:["source:"+id],lineageKey:"origin:"+id,revision:"fixture",...extra});
const resolve=(evidence,overrides={})=>resolveAuthorityV2({...context,...overrides,evidence});
const state=(evidence,overrides={})=>resolve(evidence,overrides).decision.status;
const anchor=e("a","verified-person-identifier",{reliability:"verified"});
const work=e("b","authored-work-overlap");
const network=e("c","identified-coauthor-network");
test("name and popularity cannot confirm; empty evidence is not a contradiction",()=>{
 assert.equal(state([]),"unresolved");
 assert.equal(state([e("a","ordered-name-match"),e("b","publication-count"),e("c","topic-overlap")]),"unresolved");
 assert.equal(state([e("a","verified-person-identifier",{reliability:"asserted"})]),"unresolved");
});
test("verified identity anchor confirms without an ORCID requirement",()=>{
 assert.equal(state([anchor]),"confirmed");
 assert.equal(state([e("a","verified-authority-link",{reliability:"verified"})]),"confirmed");
});
test("one corroborated bibliographic signal remains probable; independent convergence confirms",()=>{
 assert.equal(state([work]),"probable");
 assert.equal(state([work,network]),"confirmed");
 assert.equal(state([work,e("c","authored-work-overlap")]),"probable");
});
test("mirror cannot manufacture independent convergence",()=>{
 assert.equal(state([work,{...network,lineageKey:work.lineageKey}]),"probable");
 assert.equal(state([work,{...network,sourceRefs:work.sourceRefs}]),"probable");
});
test("conflicting verified anchors quarantine a decision, not silently choose one",()=>{
 const veto=e("x","verified-person-identifier-conflict",{polarity:"contradicts",reliability:"verified"});
 assert.equal(state([work,veto]),"rejected");
 assert.equal(state([anchor,veto]),"ambiguous");
 assert.equal(state([anchor,{...veto,reliability:"corroborated"}]),"ambiguous");
});
test("topic and affiliation differences do not become automatic vetoes",()=>{
 assert.equal(state([anchor,e("x","topic-overlap",{polarity:"contradicts",reliability:"asserted"})]),"confirmed");
 assert.equal(state([work,e("x","affiliation-overlap",{polarity:"contradicts",reliability:"corroborated"})]),"probable");
});
test("multiple plausible identities are preserved; confirmed anchor beats only weak alternatives",()=>{
 const alternatives={candidateRefs:["person:1","person:2"]};
 assert.equal(state([work,{...network,objectRef:"person:2"}],alternatives),"ambiguous");
 assert.equal(state([anchor,{...network,objectRef:"person:2"}],alternatives),"confirmed");
 assert.equal(state([anchor,{...anchor,id:"a2",objectRef:"person:2"}],alternatives),"ambiguous");
});
test("contribution needs its own evidence; same person does not certify every work",()=>{
 const contribution={scope:"contribution",subjectRef:"mention:1"};
 assert.throws(()=>resolve([anchor],contribution),/outside resolution context/);
 const publication=e("p","publisher-authorship",{scope:"contribution"});
 const bio=e("b","institutional-bibliography",{scope:"contribution"});
 assert.equal(state([publication],contribution),"probable");
 assert.equal(state([publication,bio],contribution),"confirmed");
 const veto=e("v","verified-impossible-original-date",{scope:"contribution",reliability:"verified",polarity:"contradicts"});
 assert.equal(state([publication,veto],contribution),"rejected");
 // Later edition or different topic is not a verified impossible original date.
 assert.equal(state([publication,e("y","edition-after-death",{scope:"contribution",polarity:"contradicts",reliability:"asserted"})],contribution),"probable");
});
test("portrait identity is separate from license validation and authorship",()=>{
 const opts={scope:"portrait"};
 assert.equal(state([e("p","verified-depicted-person",{scope:"portrait",reliability:"verified"})],opts),"confirmed");
 assert.equal(state([e("p","verified-authorship",{scope:"portrait",reliability:"verified"})],opts),"unresolved");
 assert.equal(state([e("p","license-compatible",{scope:"portrait",reliability:"verified"})],opts),"unresolved");
});
test("deterministic ordering, valid links and defensive validation",()=>{
 const a=resolve([work,network]);const b=resolve([network,work]);
 assert.deepEqual(a,b);assert.deepEqual(validateDecisionV2(a.decision,[work,network]),[]);
 assert.throws(()=>resolve([work,work]),/Duplicate/);
 assert.throws(()=>resolve([work],{candidateRefs:["person:2"]}),/outside/);
 assert.throws(()=>resolve([work],{candidateRefs:["person:1","person:1"]}),/Invalid candidate/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {validateWorkbenchJudgment,validateWorkbenchExport,makeWorkbenchExport,makePilotExport,workbenchProgress,safeReviewURL} from "../src/core/author-authority-review-workbench-v2.js";
const c={audit_id:"AAH001",task:"identity-pair",cohort:"pilot",profiles:[{authorId:"1"},{authorId:"2"}]};
const r={audit_id:"R1",task:"reference-person-retrieval",cohort:"documentary",profiles:[{authorId:"3"}],unsampledCandidateIds:["4"]};
const p={audit_id:"P1",task:"portrait-subject-review",cohort:"portrait",options:[]};
const packet={datasetRevision:"fixture",packetSha256:"abc",sources:{pilot:{sampleSha256:"pilot-hash"}},cases:[c,r,p]};
const j=(c,judgment,extra={})=>({audit_id:c.audit_id,task:c.task,judgment,reviewer:"R1",reviewedAt:"2026-11-27T12:00:00Z",note:"Documented fixture",evidence:["https://example.org/reference"],...extra});
test("exports and resumes exact sample with separate pilot binding",()=>{
 const judgments=[j(c,"same-person"),j(r,"target-present",{matchedCandidateIds:["3"]}),j(p,"unresolved",{options:[]})];
 const value=makeWorkbenchExport(packet,judgments);
 assert.deepEqual(validateWorkbenchExport(packet,value),judgments);
 assert.throws(()=>validateWorkbenchExport({...packet,packetSha256:"other"},value));
 assert.throws(()=>makeWorkbenchExport(packet,[judgments[0],judgments[0]]));
 assert.equal(makePilotExport(packet,judgments).sampleSha256,"pilot-hash");
 assert.equal(makePilotExport(packet,judgments).judgments.length,1);
 assert.deepEqual(workbenchProgress(packet,judgments)["portrait-subject-review"],{total:1,reviewed:1,resolved:0,unresolved:1});
});
test("reject unsupported candidate and absence when evidence incomplete",()=>{
 assert.throws(()=>validateWorkbenchJudgment(r,j(r,"target-present",{matchedCandidateIds:["4"]})));
 assert.throws(()=>validateWorkbenchJudgment(r,j(r,"target-absent-from-returned-candidates")));
 assert.throws(()=>validateWorkbenchJudgment(r,j(r,"target-present")));
});
test("no fabricated portrait judgments or unsafe evidence",()=>{
 assert.throws(()=>validateWorkbenchJudgment(p,j(p,"reviewed",{options:[]})));
 assert.throws(()=>validateWorkbenchJudgment(c,j(c,"same-person",{evidence:["javascript:alert(1)"]})));
 assert.equal(safeReviewURL("https://example.org@evil.test"),null);
 const two={...p,options:[{option_id:"P1"},{option_id:"P2"}]};
 assert.throws(()=>validateWorkbenchJudgment(two,j(two,"reviewed",{options:[{option_id:"P1",judgment:"correct-subject"}]})));
 assert.doesNotThrow(()=>validateWorkbenchJudgment(two,j(two,"reviewed",{options:[{option_id:"P1",judgment:"correct-subject"},{option_id:"P2",judgment:"unresolved"}]})));
});

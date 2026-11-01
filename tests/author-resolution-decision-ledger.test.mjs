import test from "node:test";
import assert from "node:assert/strict";
import {
  createDecisionLedger,
  resolutionResultToDecision,
  appendResolutionDecision,
  activeResolutionDecision,
  decisionHistory,
  serializeDecisionLedger,
  hydrateDecisionLedger,
  rejectedTargetsForSubject,
  validateLedger
} from "../src/core/author-resolution-decision-ledger.js";

const metadata = {
  algorithmVersion: "identity-v1",
  datasetRevision: "author-index-v3:test",
  decidedAtRevision: "build:test"
};

test("serializa y rehidrata una decisión confirmada sin perder trazabilidad",()=>{
  const decision=resolutionResultToDecision({
    decisionType:"mention-to-authority",
    status:"confirmed",
    targetRef:"authority:1",
    evidence:[{class:"A",ruleId:"orcid-match",value:"0000-0001-1111-1111"}],
    explanationCode:"unique-deterministic-candidate"
  },{
    ...metadata,
    subjectRefs:["mention:1"]
  });

  const added=appendResolutionDecision(createDecisionLedger(),decision);
  assert.equal(added.appended,true);
  assert.equal(added.ledger.decisions.length,1);

  const hydrated=hydrateDecisionLedger(serializeDecisionLedger(added.ledger));
  const active=activeResolutionDecision(hydrated,{
    decisionType:"mention-to-authority",
    subjectRefs:["mention:1"]
  });

  assert.equal(active.status,"confirmed");
  assert.deepEqual(active.targetRefs,["authority:1"]);
  assert.equal(active.evidenceSnapshot[0].ruleId,"orcid-match");
  assert.equal(validateLedger(hydrated),true);
});

test("una reconstrucción idéntica no duplica la decisión activa",()=>{
  const first=resolutionResultToDecision({
    status:"unresolved",
    explanationCode:"name-or-context-only"
  },{
    ...metadata,
    subjectRefs:["mention:2"]
  });

  const a=appendResolutionDecision(createDecisionLedger(),first);
  const b=appendResolutionDecision(a.ledger,first);

  assert.equal(b.appended,false);
  assert.equal(b.reason,"duplicate-active-decision");
  assert.equal(b.ledger.decisions.length,1);
});

test("una decisión nueva supersede la anterior sin borrarla",()=>{
  const unresolved=resolutionResultToDecision({
    status:"unresolved",
    explanationCode:"insufficient-evidence"
  },{
    ...metadata,
    subjectRefs:["mention:3"]
  });

  const first=appendResolutionDecision(createDecisionLedger(),unresolved);

  const confirmed=resolutionResultToDecision({
    status:"confirmed",
    targetRef:"authority:3",
    evidence:[{class:"A",ruleId:"orcid-match"}],
    explanationCode:"unique-deterministic-candidate"
  },{
    ...metadata,
    datasetRevision:"author-index-v3:test-2",
    decidedAtRevision:"build:test-2",
    subjectRefs:["mention:3"]
  });

  const second=appendResolutionDecision(first.ledger,confirmed);
  const history=decisionHistory(second.ledger,{
    decisionType:"mention-to-authority",
    subjectRefs:["mention:3"]
  });
  const active=activeResolutionDecision(second.ledger,{
    decisionType:"mention-to-authority",
    subjectRefs:["mention:3"]
  });

  assert.equal(history.length,2);
  assert.equal(second.decision.supersedesDecisionRef,first.decision.id);
  assert.equal(history[0].status,"unresolved");
  assert.equal(active.status,"confirmed");
  assert.equal(active.targetRefs[0],"authority:3");
});

test("un rechazo explícito persiste como memoria negativa",()=>{
  const rejected=resolutionResultToDecision({
    status:"rejected",
    targetRef:"candidate:wrong",
    vetoes:[{class:"VETO",polarity:"contradicts",ruleId:"orcid-conflict"}],
    explanationCode:"identity-veto"
  },{
    ...metadata,
    subjectRefs:["mention:4"]
  });

  const added=appendResolutionDecision(createDecisionLedger(),rejected);
  const hydrated=hydrateDecisionLedger(serializeDecisionLedger(added.ledger));

  assert.deepEqual(rejectedTargetsForSubject(hydrated,{
    subjectRefs:["mention:4"]
  }),["candidate:wrong"]);
  assert.equal(
    activeResolutionDecision(hydrated,{
      decisionType:"mention-to-authority",
      subjectRefs:["mention:4"]
    }).vetoSnapshot[0].ruleId,
    "orcid-conflict"
  );
});

test("rechaza ledgers con referencias supersedes inexistentes",()=>{
  assert.throws(()=>createDecisionLedger([{
    id:"decision:bad",
    decisionType:"mention-to-authority",
    subjectRefs:["mention:5"],
    targetRefs:[],
    status:"unresolved",
    algorithmVersion:"identity-v1",
    datasetRevision:"d1",
    decisionMode:"automatic",
    supersedesDecisionRef:"decision:missing",
    decidedAtRevision:"d1"
  }]),/Unknown superseded decision/);
});

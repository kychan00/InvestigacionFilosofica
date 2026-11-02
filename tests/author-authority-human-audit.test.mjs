import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateHumanAuthorityAudit,
  humanAuditSampleJsonl,
  promoteHumanAuthorityGold,
  selectHumanAuthorityAuditPairs
} from "../src/core/author-authority-human-audit.js";

function profile(id,name,{orcid=null}={}){
  return {
    authorId:String(id),
    name,
    orcid,
    candidateRef:"candidate:"+id,
    expectedIdentityKey:orcid
      ? "orcid:"+orcid
      : "openalex-author:"+id
  };
}

function collision(index,stratum){
  if(stratum==="mixed-anchor-homonym"){
    return {
      normalizedName:"mixed "+index,
      profiles:[
        profile(10000+index*2,"Mixed "+index,{
          orcid:"0000-0001-"+String(index).padStart(4,"0")+"-1111"
        }),
        profile(10001+index*2,"Mixed "+index)
      ]
    };
  }

  if(stratum==="distinct-orcid-homonym"){
    return {
      normalizedName:"distinct "+index,
      profiles:[
        profile(20000+index*2,"Distinct "+index,{
          orcid:"0000-0002-"+String(index).padStart(4,"0")+"-1111"
        }),
        profile(20001+index*2,"Distinct "+index,{
          orcid:"0000-0003-"+String(index).padStart(4,"0")+"-1111"
        })
      ]
    };
  }

  return {
    normalizedName:"anchorless "+index,
    profiles:[
      profile(30000+index*2,"Anchorless "+index),
      profile(30001+index*2,"Anchorless "+index)
    ]
  };
}

function reportFixture(){
  return {
    nameCollisions:{
      sample:{
        "distinct-orcid-homonym":Array.from(
          {length:20},
          (_,i)=>collision(i,"distinct-orcid-homonym")
        ),
        "anchorless-homonym":Array.from(
          {length:34},
          (_,i)=>collision(i,"anchorless-homonym")
        ),
        "mixed-anchor-homonym":Array.from(
          {length:33},
          (_,i)=>collision(i,"mixed-anchor-homonym")
        )
      }
    },
    auditSample:{
      strata:{
        multiOpenAlexIdCandidates:Array.from(
          {length:13},
          (_,i)=>({
            candidateRef:"candidate:merge:"+i,
            canonicalName:"Merged "+i,
            authorIds:[
              String(40000+i*2),
              String(40001+i*2)
            ],
            orcids:[
              "0000-0004-"+String(i).padStart(4,"0")+"-1111"
            ]
          })
        )
      }
    }
  };
}

test("selecciona exactamente 100 pares ciegos y 200 perfiles únicos",()=>{
  const result=selectHumanAuthorityAuditPairs({
    benchmarkReport:reportFixture()
  });

  assert.equal(result.sample.length,100);
  assert.equal(result.counts.uniqueProfiles,200);
  assert.deepEqual(result.counts.byStratum,{
    "automatic-merge-shared-orcid":13,
    "distinct-orcid-homonym":20,
    "anchorless-homonym":34,
    "mixed-anchor-homonym":33
  });

  assert.equal("stratum" in result.sample[0],false);
  assert.equal("orcid" in result.sample[0].left,false);
  assert.equal("current_relation" in result.sample[0],false);
  assert.equal(
    result.manifestItems[0].current_relation,
    "same-person"
  );
  assert.equal(
    result.manifestItems[13].current_relation,
    "different-person"
  );
});

test("la serialización de sample es determinista",()=>{
  const first=selectHumanAuthorityAuditPairs({
    benchmarkReport:reportFixture()
  });
  const second=selectHumanAuthorityAuditPairs({
    benchmarkReport:reportFixture()
  });

  assert.equal(
    humanAuditSampleJsonl(first.sample),
    humanAuditSampleJsonl(second.sample)
  );
});

function perfectJudgments(selection){
  return selection.manifestItems.map(item=>({
    audit_id:item.audit_id,
    judgment:item.current_relation,
    note:"",
    evidence:[]
  }));
}

test("gate humano pasa con todos los pares resueltos sin false merges",()=>{
  const selection=selectHumanAuthorityAuditPairs({
    benchmarkReport:reportFixture()
  });
  const result=evaluateHumanAuthorityAudit({
    sample:selection.sample,
    manifestItems:selection.manifestItems,
    judgments:perfectJudgments(selection),
    minimumResolved:80
  });

  assert.equal(result.gate.passed,true);
  assert.equal(result.resolved,100);
  assert.equal(result.falseMergeCount,0);
  assert.equal(result.falseSplitCount,0);
  assert.equal(result.humanFalseMergeRate,0);
  assert.equal(result.humanFalseSplitRate,0);
});

test("un false merge humano bloquea el gate",()=>{
  const selection=selectHumanAuthorityAuditPairs({
    benchmarkReport:reportFixture()
  });
  const judgments=perfectJudgments(selection);
  judgments[0]={
    ...judgments[0],
    judgment:"different-person",
    note:"Trayectorias incompatibles"
  };

  const result=evaluateHumanAuthorityAudit({
    sample:selection.sample,
    manifestItems:selection.manifestItems,
    judgments,
    minimumResolved:80
  });

  assert.equal(result.falseMergeCount,1);
  assert.equal(result.gate.passed,false);
  assert.equal(
    result.gate.failures.some(item=>
      item.metric==="falseMergeCount"
    ),
    true
  );
});

test("false splits se reportan pero no bajan el umbral conservador de merges",()=>{
  const selection=selectHumanAuthorityAuditPairs({
    benchmarkReport:reportFixture()
  });
  const judgments=perfectJudgments(selection);
  judgments[20]={
    ...judgments[20],
    judgment:"same-person",
    note:"Misma trayectoria"
  };

  const result=evaluateHumanAuthorityAudit({
    sample:selection.sample,
    manifestItems:selection.manifestItems,
    judgments,
    minimumResolved:80
  });

  assert.equal(result.falseMergeCount,0);
  assert.equal(result.falseSplitCount,1);
  assert.equal(result.gate.passed,true);
});

test("un merge automático no concluyente mantiene el gate cerrado",()=>{
  const selection=selectHumanAuthorityAuditPairs({
    benchmarkReport:reportFixture()
  });
  const judgments=perfectJudgments(selection);
  judgments[0]={
    ...judgments[0],
    judgment:"unresolved"
  };

  const result=evaluateHumanAuthorityAudit({
    sample:selection.sample,
    manifestItems:selection.manifestItems,
    judgments,
    minimumResolved:80
  });

  assert.equal(result.unresolved,1);
  assert.equal(result.automaticMergePairsResolved,12);
  assert.equal(result.gate.passed,false);
});

test("gold humano excluye unresolved y no conserva decisión del algoritmo",()=>{
  const selection=selectHumanAuthorityAuditPairs({
    benchmarkReport:reportFixture()
  });
  const judgments=perfectJudgments(selection);
  judgments[99]={
    ...judgments[99],
    judgment:"unresolved"
  };

  const gold=promoteHumanAuthorityGold({
    sample:selection.sample,
    manifestItems:selection.manifestItems,
    judgments
  });

  assert.equal(gold.length,99);
  assert.equal(
    gold.some(item=>item.audit_id==="AAH100"),
    false
  );
  assert.equal(
    "current_relation" in gold[0],
    false
  );
});

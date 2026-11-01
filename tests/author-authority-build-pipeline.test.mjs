import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthorityGraph,
  validateAuthorityGraph
} from "../src/core/author-authority-build-pipeline.js";
import {
  currentAuthorProfileToAuthorityCandidate,
  indexedWorkTargetMention,
  workToSourceRecords,
  creatorToAuthorMention
} from "../src/core/author-authority-adapters.js";
import {
  getCuratedAuthorBibliography
} from "../src/core/curated-author-bibliography.js";

function dedupeById(items) {
  return [...new Map(items.map(item => [item.id, item])).values()];
}

test("promueve una identidad real verificada y conserva sus decisiones",()=>{
  const curated=getCuratedAuthorBibliography({
    displayName:"Dinora Hernández López",
    orcid:"0000-0001-7335-1790"
  });
  assert.ok(curated.works.length>=20);

  const candidate=currentAuthorProfileToAuthorityCandidate({
    displayName:"Dinora Hernández López",
    aliases:["Dinora Hernández","Dra. Dinora Hernández"],
    orcid:"0000-0001-7335-1790"
  });

  const decoy=currentAuthorProfileToAuthorityCandidate({
    displayName:"Dinora Hernández López",
    aliases:["Dinora Hernández"],
    orcid:"0000-0002-0000-0000"
  });
  decoy.id="candidate:decoy:dinora";

  const selectedWorks=curated.works.slice(0,4);
  const mentions=selectedWorks.map(indexedWorkTargetMention);
  const sourceRecords=dedupeById(
    selectedWorks.flatMap(work=>workToSourceRecords(work))
  );
  const gold=Object.fromEntries(
    mentions.map(mention=>[
      mention.id,
      {candidateRef:candidate.id,status:"confirmed"}
    ])
  );

  const graph=buildAuthorityGraph({
    candidates:[candidate,decoy],
    mentions,
    sourceRecords,
    algorithmVersion:"identity-v1",
    datasetRevision:"curated-dinora:test",
    buildRevision:"build:test:1",
    goldExpectations:gold
  });

  assert.equal(graph.authorities.length,1);
  assert.equal(graph.mentionAuthorityLinks.length,mentions.length);
  assert.equal(graph.buildMetrics.decisionsByStatus.confirmed,mentions.length);
  assert.equal(graph.buildMetrics.gold.falseMergeCount,0);
  assert.equal(graph.buildMetrics.registryConflictCount,0);
  assert.equal(
    graph.authorities[0].externalIdentifiers.some(item=>
      item.scheme==="orcid" &&
      item.normalizedValue==="0000-0001-7335-1790"
    ),
    true
  );
  assert.equal(
    graph.decisionLedger.decisions.every(item=>
      item.targetRefs[0]===graph.authorities[0].id
    ),
    true
  );
  assert.equal(validateAuthorityGraph(graph),true);
});

test("una coincidencia nominal ambigua no crea AuthorityPerson",()=>{
  const mention=creatorToAuthorMention({
    name:"Laura Hernández"
  },{
    sourceRecordRef:"source:test:ambiguous",
    position:0
  });

  const graph=buildAuthorityGraph({
    candidates:[
      currentAuthorProfileToAuthorityCandidate({
        displayName:"Laura Hernández López"
      }),
      currentAuthorProfileToAuthorityCandidate({
        displayName:"Laura Hernández García"
      })
    ],
    mentions:[mention],
    sourceRecords:[],
    algorithmVersion:"identity-v1",
    datasetRevision:"synthetic:ambiguous",
    buildRevision:"build:test:2"
  });

  assert.equal(graph.authorities.length,0);
  assert.equal(graph.mentionAuthorityLinks.length,0);
  assert.equal(graph.buildMetrics.decisionsByStatus.ambiguous,1);
});

test("un candidato probable tampoco se promueve automáticamente",()=>{
  const mention=creatorToAuthorMention({
    name:"Elena Ruiz"
  },{
    sourceRecordRef:"source:test:probable",
    position:0
  });
  mention.affiliations=["Universidad de Guadalajara"];
  mention.coauthors=["Ana Pérez","Carlos Mora"];

  const candidate=currentAuthorProfileToAuthorityCandidate({
    displayName:"Elena Ruiz",
    affiliations:["Universidad de Guadalajara"],
    coauthors:["Ana Pérez","Carlos Mora"]
  });

  const graph=buildAuthorityGraph({
    candidates:[candidate],
    mentions:[mention],
    sourceRecords:[],
    algorithmVersion:"identity-v1",
    datasetRevision:"synthetic:probable",
    buildRevision:"build:test:3"
  });

  assert.equal(graph.buildMetrics.decisionsByStatus.probable,1);
  assert.equal(graph.authorities.length,0);
});

test("reutiliza el AuthorityPerson.id de un build previo aunque aparezca un identificador adicional",()=>{
  const candidate1=currentAuthorProfileToAuthorityCandidate({
    displayName:"Ana Pérez",
    orcid:"0000-0001-1111-1111"
  });
  const mention1=creatorToAuthorMention({
    name:"Ana Pérez",
    orcid:"0000-0001-1111-1111"
  },{
    sourceRecordRef:"source:test:first",
    position:0
  });

  const first=buildAuthorityGraph({
    candidates:[candidate1],
    mentions:[mention1],
    algorithmVersion:"identity-v1",
    datasetRevision:"d1",
    buildRevision:"build:one"
  });

  const authorityId=first.authorities[0].id;

  const candidate2=currentAuthorProfileToAuthorityCandidate({
    id:"https://openalex.org/A123456",
    displayName:"Ana María Pérez",
    aliases:["Ana Pérez"],
    orcid:"0000-0001-1111-1111"
  });
  const mention2=creatorToAuthorMention({
    name:"Ana María Pérez",
    id:"https://openalex.org/A123456",
    orcid:"0000-0001-1111-1111"
  },{
    sourceRecordRef:"source:test:second",
    position:0
  });

  const second=buildAuthorityGraph({
    candidates:[candidate2],
    mentions:[mention2],
    previousGraph:first,
    algorithmVersion:"identity-v1",
    datasetRevision:"d2",
    buildRevision:"build:two"
  });

  assert.equal(second.authorities.length,1);
  assert.equal(second.authorities[0].id,authorityId);
  assert.equal(
    second.identifierRegistry["openalex-author:123456"],
    authorityId
  );
  assert.equal(
    second.identifierRegistry["orcid:0000-0001-1111-1111"],
    authorityId
  );
});

test("golden set cuenta un falso merge si se confirma la persona equivocada",()=>{
  const candidate=currentAuthorProfileToAuthorityCandidate({
    displayName:"José Martínez",
    orcid:"0000-0001-1111-1111"
  });
  const mention=creatorToAuthorMention({
    name:"José Martínez",
    orcid:"0000-0001-1111-1111"
  },{
    sourceRecordRef:"source:test:gold",
    position:0
  });

  const graph=buildAuthorityGraph({
    candidates:[candidate],
    mentions:[mention],
    algorithmVersion:"identity-v1",
    datasetRevision:"gold:test",
    buildRevision:"build:gold",
    goldExpectations:{
      [mention.id]:{
        candidateRef:"candidate:expected:someone-else",
        status:"confirmed"
      }
    }
  });

  assert.equal(graph.buildMetrics.gold.falseMergeCount,1);
  assert.equal(graph.buildMetrics.gold.passed,false);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  snapshotCandidateToAuthorityCandidate,
  resolvedSnapshotIdentityToAuthorityCandidate,
  workToSourceRecords,
  creatorToAuthorMention,
  workToAuthorMentions,
  indexedWorkTargetMention,
  currentAuthorProfileToAuthorityCandidate
} from "../src/core/author-authority-adapters.js";
import {
  resolveAuthorMention
} from "../src/core/author-authority-resolution.js";

test("author-index produce un candidato, no un AuthorityPerson canónico",()=>{
  const candidate=snapshotCandidateToAuthorityCandidate({
    id:"https://openalex.org/A123",
    n:"María Elena Torres",
    o:"https://orcid.org/0000-0001-1111-1111",
    cw:80,
    k:"full"
  });

  assert.equal(candidate.entityType,"AuthorityCandidate");
  assert.equal(candidate.id,"candidate:openalex-author:123");
  assert.equal(candidate.externalIdentifiers.some(x=>
    x.scheme==="openalex-author"&&x.normalizedValue==="123"),true);
  assert.equal(candidate.externalIdentifiers.some(x=>
    x.scheme==="orcid"&&x.normalizedValue==="0000-0001-1111-1111"),true);
  assert.equal(candidate.corpusWorks,80);
});

test("una identidad snapshot agrupada conserva todos los IDs externos enlazados",()=>{
  const candidate=resolvedSnapshotIdentityToAuthorityCandidate({
    id:"123",
    linkedAuthorIds:["456","https://openalex.org/A789"],
    displayName:"María Torres",
    aliases:["M. Torres"],
    orcid:"0000-0001-1111-1111"
  });

  const openalex=candidate.externalIdentifiers
    .filter(x=>x.scheme==="openalex-author")
    .map(x=>x.normalizedValue)
    .sort();
  assert.deepEqual(openalex,["123","456","789"]);
  assert.equal(candidate.id,"candidate:snapshot-group:123+456+789");
});

test("SourceRecord conserva procedencia aunque la obra esté normalizada",()=>{
  const records=workToSourceRecords({
    id:"https://openalex.org/W999",
    title:"Obra normalizada",
    year:2024,
    doi:"10.1234/example",
    authors:[{name:"Ana Pérez"}],
    providers:["OpenAlex Philosophy"],
    sourceRecords:[
      {provider:"OpenAlex Philosophy",sourceId:"W999"},
      {provider:"Crossref",sourceId:"10.1234/example"}
    ]
  });

  assert.equal(records.length,2);
  assert.notEqual(records[0].id,records[1].id);
  assert.equal(records[0].rawTitle,"Obra normalizada");
  assert.equal(records[1].rawIdentifiers.doi,"10.1234/example");
});

test("IDs de SourceRecord distinguen IDs que sólo difieren por separadores",()=>{
  const a=workToSourceRecords({
    title:"A",
    sourceRecords:[{provider:"Crossref",sourceId:"10.1/ab-c"}]
  })[0];
  const b=workToSourceRecords({
    title:"A",
    sourceRecords:[{provider:"Crossref",sourceId:"10.1/abc"}]
  })[0];

  assert.notEqual(a.id,b.id);
});

test("creatorToAuthorMention conserva texto original e identificadores embebidos",()=>{
  const mention=creatorToAuthorMention({
    name:"Dinora Hernández López",
    id:"https://openalex.org/A123",
    orcid:"https://orcid.org/0000-0001-7335-1790",
    role:"coordinadora"
  },{
    sourceRecordRef:"source:test:1",
    position:2
  });

  assert.equal(mention.rawValue,"Dinora Hernández López");
  assert.equal(mention.normalizedRoleCandidate,"coordinator");
  assert.equal(mention.position,2);
  assert.equal(mention.embeddedIdentifiers.some(x=>x.scheme==="orcid"),true);
  assert.equal(mention.embeddedIdentifiers.some(x=>x.scheme==="openalex-author"),true);
});

test("una cadena estructurada de creadores genera menciones separadas",()=>{
  const mentions=workToAuthorMentions({
    title:"Volumen",
    authors:[{
      name:"Dinora Hernández, Hermann Omar Amaya, Santiago M. Roggerone"
    }],
    providers:["Internet Archive"]
  });

  assert.equal(mentions.length,3);
  assert.deepEqual(
    mentions.map(x=>x.rawValue),
    ["Dinora Hernández","Hermann Omar Amaya","Santiago M. Roggerone"]
  );
  assert.equal(
    mentions[0].rawCreatorStatement,
    "Dinora Hernández, Hermann Omar Amaya, Santiago M. Roggerone"
  );
  assert.equal(new Set(mentions.map(x=>x.id)).size,3);
});

test("indexedWorkTargetMention transforma el target actual a AuthorMention",()=>{
  const mention=indexedWorkTargetMention({
    id:"https://openalex.org/W1",
    title:"Artículo",
    providers:["OpenAlex Philosophy"],
    authorIdentity:{
      id:"123",
      displayName:"Ana Pérez",
      orcid:"0000-0001-1111-1111"
    },
    authors:[
      {
        id:"https://openalex.org/A123",
        name:"Ana Pérez",
        orcid:"https://orcid.org/0000-0001-1111-1111"
      },
      {id:"https://openalex.org/A456",name:"Otro Autor"}
    ]
  });

  assert.equal(mention.entityType,"AuthorMention");
  assert.equal(mention.rawValue,"Ana Pérez");
  assert.equal(mention.embeddedIdentifiers.some(x=>
    x.scheme==="openalex-author"&&x.normalizedValue==="123"),true);
});

test("el adaptador se conecta al resolvedor genérico sin hacer excepción por autor",()=>{
  const candidate=currentAuthorProfileToAuthorityCandidate({
    id:"123",
    displayName:"Dinora Hernández López",
    aliases:["Dra. Dinora Hernández"],
    orcid:"0000-0001-7335-1790"
  });

  const mention=creatorToAuthorMention({
    name:"Dra. Dinora Hernández",
    orcid:"0000-0001-7335-1790"
  },{
    sourceRecordRef:"source:test:dinora",
    position:0
  });

  const result=resolveAuthorMention(mention,[candidate]);
  assert.equal(result.status,"confirmed");
  assert.equal(result.targetRef,candidate.id);
});

test("la misma URL usada por obras distintas produce SourceRecord internos distintos",()=>{
  const a=workToSourceRecords({
    id:"curated:a",
    title:"Obra A",
    year:2024,
    sourceRecords:[{
      provider:"Bibliografía verificada",
      sourceId:"https://example.org/shared"
    }]
  })[0];
  const b=workToSourceRecords({
    id:"curated:b",
    title:"Obra B",
    year:2024,
    sourceRecords:[{
      provider:"Bibliografía verificada",
      sourceId:"https://example.org/shared"
    }]
  })[0];

  assert.equal(a.providerRecordId,b.providerRecordId);
  assert.notEqual(a.id,b.id);
});


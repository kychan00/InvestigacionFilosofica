import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateAuthorAliasRows,
  groupAuthorIndexCandidates,
  authorityCandidateShard,
  partitionAuthorityCandidates,
  buildAuthorityBatchShard,
  summarizeAuthorityBatchShards,
  sourceWorkBucketForAuthor,
  authorIndexAuthorshipSourceRecordId
} from "../src/core/author-authority-batch.js";

function alias(id,name,{orcid=null,cw=1,kind="full",signature=null}={}){
  return {
    id,
    n:name,
    o:orcid,
    cw,
    w:cw,
    c:0,
    k:kind,
    s:signature || name.toLowerCase()
  };
}

function work(id,wid,title){
  return {
    id,
    wid,
    p:"first",
    r:false,
    co:0,
    t:title,
    y:2024,
    l:"es",
    ty:"article"
  };
}

test("agrega filas repetidas del índice sin duplicar perfiles",()=>{
  const result=aggregateAuthorAliasRows([
    alias(123,"Ana Pérez",{orcid:"0000-0001-1111-1111",cw:4}),
    alias(123,"Ana Pérez",{orcid:"0000-0001-1111-1111",cw:4,kind:"surname",signature:"perez"})
  ]);

  assert.equal(result.profiles.length,1);
  assert.equal(result.profiles[0].id,"123");
  assert.equal(result.profiles[0].o,"0000-0001-1111-1111");
  assert.deepEqual(result.profiles[0].kinds,["full","surname"]);
  assert.equal(result.conflicts.length,0);
});

test("un mismo OpenAlex Author ID con ORCID contradictorios no entra al lote",()=>{
  const result=aggregateAuthorAliasRows([
    alias(123,"Ana Pérez",{orcid:"0000-0001-1111-1111"}),
    alias(123,"Ana Pérez",{orcid:"0000-0002-2222-2222"})
  ]);

  assert.equal(result.profiles.length,0);
  assert.equal(result.conflicts.length,1);
  assert.equal(result.conflicts[0].kind,"openalex-author-orcid-conflict");
});

test("dos IDs OpenAlex con el mismo ORCID forman un solo candidato",()=>{
  const result=groupAuthorIndexCandidates([
    alias(123,"Ana Pérez",{orcid:"0000-0001-1111-1111",cw:4}),
    alias(456,"Ana María Pérez",{orcid:"0000-0001-1111-1111",cw:3})
  ]);

  assert.equal(result.candidates.length,1);
  assert.equal(result.authorIdToCandidateRef["123"],result.candidates[0].id);
  assert.equal(result.authorIdToCandidateRef["456"],result.candidates[0].id);
  assert.deepEqual(
    result.candidates[0].sourceMetadata.authorIds,
    ["123","456"]
  );
  assert.equal(
    result.candidates[0].externalIdentifiers.filter(x=>
      x.scheme==="openalex-author"
    ).length,
    2
  );
});

test("homónimos sin identificador compartido permanecen separados",()=>{
  const result=groupAuthorIndexCandidates([
    alias(123,"José Martínez"),
    alias(456,"José Martínez")
  ]);

  assert.equal(result.candidates.length,2);
  assert.notEqual(
    result.authorIdToCandidateRef["123"],
    result.authorIdToCandidateRef["456"]
  );
});

test("el shard se deriva de IDs externos, no del nombre visible",()=>{
  const result=groupAuthorIndexCandidates([
    alias(123,"Nombre Uno",{orcid:"0000-0001-1111-1111"}),
    alias(456,"Nombre Dos",{orcid:"0000-0001-1111-1111"})
  ]);
  const candidate=result.candidates[0];
  const before=authorityCandidateShard(candidate,256);

  const renamed={
    ...candidate,
    canonicalName:"Nombre completamente distinto"
  };

  assert.equal(authorityCandidateShard(renamed,256),before);
});

test("un shard resuelve homónimos por OpenAlex ID y promueve dos autoridades",()=>{
  const grouped=groupAuthorIndexCandidates([
    alias(123,"José Martínez"),
    alias(456,"José Martínez")
  ]);
  const candidates=grouped.candidates;
  const shard=authorityCandidateShard(candidates[0],1);

  const built=buildAuthorityBatchShard({
    shard,
    shardCount:1,
    candidates,
    workRows:[
      work(123,1001,"Obra A"),
      work(456,1002,"Obra B")
    ],
    algorithmVersion:"identity-v1",
    datasetRevision:"fixture:index",
    buildRevision:"fixture:build"
  });

  assert.equal(built.graph.authorities.length,2);
  assert.equal(built.graph.mentionAuthorityLinks.length,2);
  assert.equal(built.graph.buildMetrics.decisionsByStatus.confirmed,2);
  assert.equal(built.missingCandidateAuthorIds.length,0);
});

test("IDs enlazados por ORCID producen una autoridad con obras de ambos IDs",()=>{
  const grouped=groupAuthorIndexCandidates([
    alias(123,"Ana Pérez",{orcid:"0000-0001-1111-1111"}),
    alias(456,"Ana M. Pérez",{orcid:"0000-0001-1111-1111"})
  ]);

  const built=buildAuthorityBatchShard({
    shard:0,
    shardCount:1,
    candidates:grouped.candidates,
    workRows:[
      work(123,2001,"Obra A"),
      work(456,2002,"Obra B")
    ],
    algorithmVersion:"identity-v1",
    datasetRevision:"fixture:index",
    buildRevision:"fixture:build"
  });

  assert.equal(built.graph.authorities.length,1);
  assert.equal(built.graph.mentionAuthorityLinks.length,2);
  assert.equal(
    built.graph.authorities[0].externalIdentifiers.filter(x=>
      x.scheme==="openalex-author"
    ).length,
    2
  );
});

test("preserva varias observaciones del mismo autor en una obra",()=>{
  const grouped=groupAuthorIndexCandidates([
    alias(
      5004281027,
      "David Sedley"
    )
  ]);

  const rows=[
    {
      id:5004281027,
      wid:569490510,
      p:"first",
      r:true,
      co:12,
      t:"The Philosophy of Antiochus",
      y:2012,
      l:"en",
      ty:"book"
    },
    {
      id:5004281027,
      wid:569490510,
      p:"middle",
      r:false,
      co:12,
      t:"The Philosophy of Antiochus",
      y:2012,
      l:"en",
      ty:"book"
    },
    {
      id:5004281027,
      wid:569490510,
      p:"last",
      r:false,
      co:12,
      t:"The Philosophy of Antiochus",
      y:2012,
      l:"en",
      ty:"book"
    }
  ];

  const built=buildAuthorityBatchShard({
    shard:0,
    shardCount:1,
    candidates:grouped.candidates,
    workRows:rows,
    algorithmVersion:"identity-v1",
    datasetRevision:"fixture:index",
    buildRevision:"fixture:build"
  });

  assert.equal(
    built.graph.authorities.length,
    1
  );

  assert.equal(
    built.graph.sourceRecords.length,
    3
  );

  assert.equal(
    built.graph.mentions.length,
    3
  );

  assert.equal(
    new Set(
      built.graph.sourceRecords.map(
        item=>item.id
      )
    ).size,
    3
  );

  assert.deepEqual(
    built.graph.sourceRecords
      .map(item=>item.id)
      .sort(),
    rows
      .map(
        row=>
          authorIndexAuthorshipSourceRecordId(
            row
          )
      )
      .sort()
  );

  assert.ok(
    built.graph.sourceRecords.some(
      item=>
        item.id.endsWith(
          ":first:corresponding"
        )
    )
  );

  assert.ok(
    built.graph.sourceRecords.some(
      item=>
        item.id.endsWith(
          ":middle:noncorresponding"
        )
    )
  );

  assert.ok(
    built.graph.sourceRecords.some(
      item=>
        item.id.endsWith(
          ":last:noncorresponding"
        )
    )
  );
});


test("particiona candidatos exactamente una vez",()=>{
  const grouped=groupAuthorIndexCandidates([
    alias(123,"Ana Pérez"),
    alias(456,"José Martínez"),
    alias(789,"Laura Ruiz")
  ]);

  const buckets=partitionAuthorityCandidates(grouped.candidates,8);
  const flattened=[...buckets.values()].flat();

  assert.equal(flattened.length,3);
  assert.equal(new Set(flattened.map(x=>x.id)).size,3);
});

test("el resumen detecta un AuthorityPerson repetido entre shards",()=>{
  const summary=summarizeAuthorityBatchShards({
    shards:[
      {
        shard:0,
        candidateCount:1,
        workRowCount:1,
        missingCandidateAuthorIds:[],
        graph:{
          authorities:[{id:"authority:1"}],
          buildMetrics:{
            mentionsSeen:1,
            decisionsByStatus:{confirmed:1}
          },
          identifierRegistry:{"openalex-author:1":"authority:1"},
          candidateRegistry:{"candidate:1":"authority:1"}
        }
      },
      {
        shard:1,
        candidateCount:1,
        workRowCount:1,
        missingCandidateAuthorIds:[],
        graph:{
          authorities:[{id:"authority:1"}],
          buildMetrics:{
            mentionsSeen:1,
            decisionsByStatus:{confirmed:1}
          },
          identifierRegistry:{"openalex-author:2":"authority:1"},
          candidateRegistry:{"candidate:2":"authority:1"}
        }
      }
    ],
    shardCount:2,
    datasetRevision:"fixture:index",
    buildRevision:"fixture:build"
  });

  assert.deepEqual(
    summary.conflicts.duplicateAuthorityIds,
    ["authority:1"]
  );
});

test("el helper de bucket coincide con el contrato de author-index",()=>{
  assert.equal(sourceWorkBucketForAuthor("123",1024),795);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  buildAuthorityBatchFromIndex
} from "../scripts/authority/build-authority-batch-v1.mjs";

async function writeJson(path,value){
  await writeFile(path,JSON.stringify(value,null,2)+"\n","utf8");
}

async function writeJsonl(path,rows){
  await writeFile(
    path,
    rows.map(row=>JSON.stringify(row)).join("\n")+"\n",
    "utf8"
  );
}

async function makeIndex(root,{includeThirdAlias=false}={}){
  await mkdir(join(root,"aliases"),{recursive:true});
  await mkdir(join(root,"works"),{recursive:true});

  const aliasRows=[
    {
      s:"ana perez",
      id:123,
      n:"Ana Pérez",
      o:"0000-0001-1111-1111",
      cw:2,w:2,c:0,k:"full"
    },
    {
      s:"ana maria perez",
      id:456,
      n:"Ana María Pérez",
      o:"0000-0001-1111-1111",
      cw:1,w:1,c:0,k:"full"
    },
    {
      s:"jose martinez",
      id:789,
      n:"José Martínez",
      o:null,
      cw:1,w:1,c:0,k:"full"
    }
  ];
  if(includeThirdAlias){
    aliasRows.push({
      s:"a perez",
      id:999,
      n:"A. Pérez",
      o:"0000-0001-1111-1111",
      cw:1,w:1,c:0,k:"full"
    });
  }

  const workRows=[
    {id:123,wid:1,p:"first",r:false,co:0,t:"Obra A",y:2020,l:"es",ty:"article"},
    {id:456,wid:2,p:"first",r:false,co:0,t:"Obra B",y:2021,l:"es",ty:"article"},
    {id:789,wid:3,p:"first",r:false,co:0,t:"Obra C",y:2022,l:"es",ty:"article"}
  ];
  if(includeThirdAlias){
    workRows.push({
      id:999,wid:4,p:"first",r:false,co:0,t:"Obra D",y:2023,l:"es",ty:"article"
    });
  }

  await writeJsonl(join(root,"aliases","0000.jsonl"),aliasRows);
  await writeJsonl(join(root,"works","0000.jsonl"),workRows);

  await writeJson(join(root,"manifest.json"),{
    schema_version:"remote-author-index-manifest-v1",
    version:"author-index-v2",
    bucket_count:1024,
    hash:"fnv1a-32",
    normalization:"unicode-nfkd-casefold-token-signature-v1",
    source:{
      snapshot_repo:"Mearman/OpenAlex",
      snapshot_revision:"snapshot-test",
      philosophy_repo:"CristianPelayo/openalex-philosophy",
      philosophy_revision:"philosophy-test",
      philosophy_path:"v3.2/test.parquet"
    },
    counts:{
      alias_rows:aliasRows.length,
      work_rows_published:workRows.length
    },
    files:{
      aliases:[{path:"aliases/0000.jsonl"}],
      works:[{path:"works/0000.jsonl"}],
      work_authors:[]
    }
  });
}

test("construye registry, manifest y shards desde un author-index realista",async()=>{
  const root=await mkdtemp(join(tmpdir(),"authority-batch-"));
  const input=join(root,"input","author-index-v2");
  const output=join(root,"output");
  await makeIndex(input);

  const result=await buildAuthorityBatchFromIndex({
    inputRoot:input,
    outputRoot:output,
    shardCount:8,
    buildRevision:"batch:test:1"
  });

  assert.equal(result.manifest.input.aliasRowsSeen,3);
  assert.equal(result.manifest.input.candidateGroups,2);
  assert.equal(result.manifest.counts.authorities,2);
  assert.equal(result.manifest.counts.mentions,3);
  assert.equal(result.manifest.conflicts.alias.length,0);
  assert.equal(result.manifest.conflicts.registry.length,0);
  assert.equal(result.manifest.conflicts.duplicateAuthorityIds.length,0);
  assert.ok(result.manifest.files.shards.length>=1);

  const registry=JSON.parse(
    await readFile(join(output,"registry.json"),"utf8")
  );
  assert.equal(
    registry.identifierRegistry["orcid:0000-0001-1111-1111"]!==undefined,
    true
  );
  assert.equal(
    registry.identifierRegistry["openalex-author:123"],
    registry.identifierRegistry["openalex-author:456"]
  );
  assert.notEqual(
    registry.identifierRegistry["openalex-author:123"],
    registry.identifierRegistry["openalex-author:789"]
  );
});

test("un rebuild conserva AuthorityPerson.id cuando aparece otro OpenAlex ID con el mismo ORCID",async()=>{
  const root=await mkdtemp(join(tmpdir(),"authority-rebuild-"));
  const input1=join(root,"input1","author-index-v2");
  const output1=join(root,"output1");
  const input2=join(root,"input2","author-index-v2");
  const output2=join(root,"output2");

  await makeIndex(input1);
  const first=await buildAuthorityBatchFromIndex({
    inputRoot:input1,
    outputRoot:output1,
    shardCount:8,
    buildRevision:"batch:test:first"
  });

  const firstId=
    first.registry.identifierRegistry["orcid:0000-0001-1111-1111"];

  await makeIndex(input2,{includeThirdAlias:true});
  const second=await buildAuthorityBatchFromIndex({
    inputRoot:input2,
    outputRoot:output2,
    previousRoot:output1,
    shardCount:8,
    buildRevision:"batch:test:second"
  });

  const secondId=
    second.registry.identifierRegistry["orcid:0000-0001-1111-1111"];

  assert.equal(secondId,firstId);
  assert.equal(
    second.registry.identifierRegistry["openalex-author:999"],
    firstId
  );
  assert.equal(second.manifest.counts.authorities,2);
  assert.equal(second.manifest.counts.mentions,4);
});


test("work-authors recupera perfiles ausentes del índice de alias",async()=>{
  const root=await mkdtemp(join(tmpdir(),"authority-profile-fallback-"));
  const input=join(root,"input","author-index-v2");
  const output=join(root,"output");

  await mkdir(join(input,"aliases"),{recursive:true});
  await mkdir(join(input,"works"),{recursive:true});
  await mkdir(join(input,"work-authors"),{recursive:true});

  await writeJsonl(join(input,"aliases","0000.jsonl"),[
    {
      s:"ana perez",
      id:1,
      n:"Ana Pérez",
      o:null,
      cw:1,w:1,c:0,k:"full"
    }
  ]);

  await writeJsonl(join(input,"works","0000.jsonl"),[
    {id:1,wid:10,p:"first",r:false,co:0,t:"Obra A",y:2020,l:"es",ty:"article"},
    {id:2,wid:20,p:"first",r:false,co:0,t:"Obra B",y:2021,l:"es",ty:"article"}
  ]);

  await writeJsonl(join(input,"work-authors","0000.jsonl"),[
    {
      wid:10,
      a:[{id:1,n:"Ana Pérez",o:null,p:"first",r:false}]
    },
    {
      wid:20,
      a:[{id:2,n:"—",o:null,p:"first",r:false}]
    }
  ]);

  await writeJson(join(input,"manifest.json"),{
    schema_version:"remote-author-index-manifest-v1",
    version:"author-index-v2",
    bucket_count:1024,
    hash:"fnv1a-32",
    normalization:"unicode-nfkd-casefold-token-signature-v1",
    source:{
      snapshot_repo:"Mearman/OpenAlex",
      snapshot_revision:"snapshot-test",
      philosophy_repo:"CristianPelayo/openalex-philosophy",
      philosophy_revision:"philosophy-test",
      philosophy_path:"v3.2/test.parquet"
    },
    counts:{
      resolved_authors:2,
      alias_rows:1,
      work_rows_published:2,
      work_author_rows_published:2
    },
    files:{
      aliases:[{path:"aliases/0000.jsonl"}],
      works:[{path:"works/0000.jsonl"}],
      work_authors:[{path:"work-authors/0000.jsonl"}]
    }
  });

  const result=await buildAuthorityBatchFromIndex({
    inputRoot:input,
    outputRoot:output,
    shardCount:8,
    buildRevision:"batch:fallback"
  });

  assert.equal(result.manifest.input.aliasRowsSeen,1);
  assert.equal(result.manifest.input.workAuthorMembershipsSeen,2);
  assert.equal(result.manifest.input.aggregatedAuthorProfiles,2);
  assert.equal(result.manifest.input.candidateGroups,2);
  assert.equal(result.manifest.input.workRowsMissingCandidate,0);
  assert.equal(result.manifest.counts.authorities,2);
  assert.ok(
    result.registry.identifierRegistry["openalex-author:2"]
  );
});

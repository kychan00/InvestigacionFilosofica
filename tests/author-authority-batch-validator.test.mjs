import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  appendFile
} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {
  buildAuthorityBatchFromIndex
} from "../scripts/authority/build-authority-batch-v1.mjs";
import {
  validateAuthorityBatch
} from "../scripts/authority/validate-authority-batch-v1.mjs";


async function writeJson(path,value){
  await writeFile(
    path,
    JSON.stringify(value,null,2)+"\n",
    "utf8"
  );
}


async function writeJsonl(path,rows){
  await writeFile(
    path,
    rows.map(row=>JSON.stringify(row)).join("\n")+"\n",
    "utf8"
  );
}


async function fixture(root){
  const input=join(root,"author-index-v2");
  const output=join(root,"authority");

  await mkdir(join(input,"aliases"),{recursive:true});
  await mkdir(join(input,"works"),{recursive:true});

  const aliases=[
    {
      s:"ana perez",
      id:1,
      n:"Ana Pérez",
      o:"0000-0001-1111-1111",
      cw:1,
      w:1,
      c:0,
      k:"full"
    },
    {
      s:"jose martinez",
      id:2,
      n:"José Martínez",
      o:null,
      cw:1,
      w:1,
      c:0,
      k:"full"
    }
  ];

  const works=[
    {
      id:1,
      wid:100,
      p:"first",
      r:true,
      co:0,
      t:"Radbruch as an Affirmative Holist.\u2028On the Question",
      y:2024,
      l:"es",
      ty:"article"
    },
    {
      id:2,
      wid:200,
      p:"first",
      r:false,
      co:0,
      t:"Obra B",
      y:2023,
      l:"es",
      ty:"article"
    }
  ];

  await writeJsonl(
    join(input,"aliases","fixture.jsonl"),
    aliases
  );
  await writeJsonl(
    join(input,"works","fixture.jsonl"),
    works
  );

  const manifest={
    schema_version:"remote-author-index-manifest-v1",
    version:"author-index-v2",
    bucket_count:1024,
    hash:"fnv1a-32",
    normalization:"unicode-nfkd-casefold-token-signature-v1",
    source:{
      snapshot_repo:"Mearman/OpenAlex",
      snapshot_revision:"snapshot-fixture",
      philosophy_repo:"CristianPelayo/openalex-philosophy",
      philosophy_revision:"philosophy-fixture",
      philosophy_path:"v3.2/fixture.parquet"
    },
    counts:{
      resolved_authors:2,
      alias_rows:2,
      work_rows_published:2
    },
    files:{
      aliases:[
        {path:"aliases/fixture.jsonl"}
      ],
      works:[
        {path:"works/fixture.jsonl"}
      ],
      work_authors:[]
    }
  };

  const manifestPath=join(input,"manifest.json");
  await writeJson(manifestPath,manifest);

  await buildAuthorityBatchFromIndex({
    inputRoot:input,
    outputRoot:output,
    shardCount:8,
    buildRevision:"validator-fixture"
  });

  return {
    input,
    output,
    manifestPath
  };
}


test("valida batch, registry, source coverage y conteos",async()=>{
  const root=await mkdtemp(
    join(tmpdir(),"authority-batch-validator-")
  );
  const data=await fixture(root);

  const report=await validateAuthorityBatch({
    authorityRoot:data.output,
    sourceManifestPath:data.manifestPath
  });

  assert.equal(report.status,"pass");
  assert.equal(report.counts.authorities,2);
  assert.equal(report.counts.mentions,2);
  assert.equal(report.counts.missingCandidateAuthors,0);
  assert.equal(report.input.aggregatedAuthorProfiles,2);
  assert.equal(report.input.workRowsMissingCandidate,0);
});


test("rechaza un shard alterado después del manifest",async()=>{
  const root=await mkdtemp(
    join(tmpdir(),"authority-batch-validator-tamper-")
  );
  const data=await fixture(root);

  const manifest=JSON.parse(
    await readFile(
      join(data.output,"manifest.json"),
      "utf8"
    )
  );

  const shard=manifest.files.shards[0];
  await appendFile(
    join(data.output,shard.path),
    "\n",
    "utf8"
  );

  await assert.rejects(
    validateAuthorityBatch({
      authorityRoot:data.output,
      sourceManifestPath:data.manifestPath
    }),
    /artifact size|artifact SHA-256/
  );
});

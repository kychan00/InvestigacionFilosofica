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
  runAuthorAuthorityBenchmark
} from "../scripts/authority/benchmark-author-authority-v1.mjs";

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
  await mkdir(join(input,"aliases"),{recursive:true});
  await mkdir(join(input,"work-authors"),{recursive:true});

  const rows=[
    {s:"ana perez",id:1,n:"Ana Pérez",o:"0000-0001-1111-1111",cw:2,w:2,c:0,k:"full"},
    {s:"ana maria perez",id:2,n:"Ana María Pérez",o:"0000-0001-1111-1111",cw:1,w:1,c:0,k:"full"},
    {s:"jose martinez",id:3,n:"José Martínez",o:"0000-0002-2222-2222",cw:1,w:1,c:0,k:"full"},
    {s:"jose martinez",id:4,n:"Jose Martinez",o:"0000-0003-3333-3333",cw:1,w:1,c:0,k:"full"},
    {s:"laura ruiz",id:5,n:"Laura Ruiz",o:null,cw:1,w:1,c:0,k:"full"},
    {s:"laura ruiz",id:6,n:"Laura Ruiz",o:null,cw:1,w:1,c:0,k:"full"}
  ];
  await writeJsonl(join(input,"aliases","0000.jsonl"),rows);
  await writeJsonl(
    join(input,"work-authors","0000.jsonl"),
    [{
      wid:99,
      a:[{
        id:7,
        n:"—",
        o:null,
        p:"first",
        r:false
      }]
    }]
  );

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
      resolved_authors:7,
      alias_rows:6
    },
    files:{
      aliases:[{path:"aliases/0000.jsonl"}],
      works:[],
      work_authors:[{path:"work-authors/0000.jsonl"}]
    }
  });

  const config=join(root,"config.json");
  await writeJson(config,{
    schemaVersion:"author-authority-benchmark-config-v1",
    seed:7,
    sampleSizePerStratum:10,
    release:{
      tag:"fixture",
      asset:"fixture.tar.gz",
      sha256:"fixture"
    },
    expectedSource:{
      snapshotRepo:"Mearman/OpenAlex",
      snapshotRevision:"snapshot-test",
      philosophyRepo:"CristianPelayo/openalex-philosophy",
      philosophyRevision:"philosophy-test",
      philosophyPath:"v3.2/test.parquet"
    },
    gate:{
      goldFailures:0,
      falseMergeGroups:0,
      falseSplitGroups:0,
      requireExactSourceCoverage:true
    }
  });

  const gold=join(root,"gold.json");
  await writeJson(gold,{
    schemaVersion:"author-authority-gold-v1",
    cases:[]
  });

  return {input,config,gold};
}

test("runner escanea toda la fixture y produce reportes reproducibles",async()=>{
  const root=await mkdtemp(join(tmpdir(),"authority-benchmark-"));
  const {input,config,gold}=await fixture(root);
  const output1=join(root,"out1","report.json");
  const output2=join(root,"out2","report.json");

  const first=await runAuthorAuthorityBenchmark({
    inputRoot:input,
    outputPath:output1,
    configPath:config,
    goldPath:gold
  });
  const second=await runAuthorAuthorityBenchmark({
    inputRoot:input,
    outputPath:output2,
    configPath:config,
    goldPath:gold
  });

  assert.equal(first.report.gate.passed,true);
  assert.equal(first.report.scan.aliasRowsSeen,6);
  assert.equal(first.report.scan.workAuthorMembershipsSeen,1);
  assert.equal(first.report.corpus.profileInventory,7);
  assert.equal(first.report.corpus.aliasIndexedProfiles,6);
  assert.equal(first.report.corpus.profilesMissingFromAliases,1);
  assert.equal(
    first.report.corpus.missingAliasProfileSample[0].authorId,
    "7"
  );
  assert.equal(first.report.corpus.candidateGroups,6);
  assert.equal(first.report.silver.sharedOrcidGroups,1);
  assert.equal(first.report.silver.falseMergeCount,0);
  assert.equal(first.report.silver.falseSplitCount,0);
  assert.equal(
    first.report.nameCollisions.counts["distinct-orcid-homonym"],
    1
  );
  assert.equal(
    first.report.nameCollisions.counts["anchorless-homonym"],
    1
  );

  assert.equal(
    await readFile(output1,"utf8"),
    await readFile(output2,"utf8")
  );
  assert.equal(
    JSON.parse(await readFile(first.auditPath,"utf8")).seed,
    7
  );
});

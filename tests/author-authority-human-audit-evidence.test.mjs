import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile
} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  sourceWorkBucketForAuthor
} from "../src/core/author-authority-batch.js";
import {
  buildHumanAuthorityEvidencePack
} from "../scripts/authority/build-human-authority-audit-v1.mjs";

async function writeJsonl(path,rows){
  await writeFile(
    path,
    rows.map(row=>JSON.stringify(row)).join("\n")+"\n",
    "utf8"
  );
}

test("evidence pack reúne obras, ORCID y coautores sin exponer el estrato",async()=>{
  const root=await mkdtemp(join(tmpdir(),"authority-evidence-"));
  await mkdir(join(root,"works"),{recursive:true});
  await mkdir(join(root,"work-authors"),{recursive:true});

  const bucketCount=8;
  const a1="101";
  const a2="202";
  const w1="9001";
  const w2="9002";

  const workBuckets=new Map();
  for(const row of [
    {id:Number(a1),wid:Number(w1),p:"first",r:true,co:1,t:"Obra uno",y:2024,l:"es",ty:"article"},
    {id:Number(a2),wid:Number(w2),p:"first",r:false,co:1,t:"Obra dos",y:2019,l:"en",ty:"book"}
  ]){
    const bucket=sourceWorkBucketForAuthor(String(row.id),bucketCount);
    const rows=workBuckets.get(bucket)||[];
    rows.push(row);
    workBuckets.set(bucket,rows);
  }

  const workFiles=[];
  for(const [bucket,rows] of workBuckets){
    const path="works/"+String(bucket).padStart(4,"0")+".jsonl";
    await writeJsonl(join(root,path),rows);
    workFiles.push({path});
  }

  const authorRows=[
    {
      wid:Number(w1),
      a:[
        {id:Number(a1),n:"Ana Pérez",o:"0000-0001-1111-1111",p:"first",r:true},
        {id:303,n:"Colega Uno",o:null,p:"middle",r:false}
      ]
    },
    {
      wid:Number(w2),
      a:[
        {id:Number(a2),n:"Ana Pérez",o:null,p:"first",r:false},
        {id:404,n:"Colega Dos",o:null,p:"middle",r:false}
      ]
    }
  ];

  const authorBuckets=new Map();
  for(const row of authorRows){
    const bucket=sourceWorkBucketForAuthor(String(row.wid),bucketCount);
    const rows=authorBuckets.get(bucket)||[];
    rows.push(row);
    authorBuckets.set(bucket,rows);
  }

  const workAuthorFiles=[];
  for(const [bucket,rows] of authorBuckets){
    const path="work-authors/"+String(bucket).padStart(4,"0")+".jsonl";
    await writeJsonl(join(root,path),rows);
    workAuthorFiles.push({path});
  }

  const manifest={
    bucket_count:bucketCount,
    files:{
      works:workFiles,
      work_authors:workAuthorFiles
    }
  };

  const evidence=await buildHumanAuthorityEvidencePack({
    inputRoot:root,
    manifest,
    sample:[{
      audit_id:"AAH001",
      left:{authorId:a1,name:"Ana Pérez"},
      right:{authorId:a2,name:"Ana Pérez"},
      judgment:null,
      note:""
    }],
    maxWorksPerProfile:12
  });

  assert.equal(evidence.length,1);
  assert.equal("stratum" in evidence[0],false);
  assert.equal(evidence[0].left.workCountObserved,1);
  assert.deepEqual(
    evidence[0].left.orcids,
    ["0000-0001-1111-1111"]
  );
  assert.equal(
    evidence[0].left.works[0].coauthors[0].name,
    "Colega Uno"
  );
  assert.equal(
    evidence[0].right.works[0].coauthors[0].name,
    "Colega Dos"
  );
});

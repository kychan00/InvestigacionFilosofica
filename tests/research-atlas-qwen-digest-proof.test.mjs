import test from "node:test";
import assert from "node:assert/strict";
import {createHash, webcrypto} from "node:crypto";
import {fetchAuthenticatedQwenVector} from "../src/core/research-atlas-qwen-digest-proof.js";

const sha = data => createHash("sha256").update(data).digest("hex");
const utf8 = o => Buffer.from(JSON.stringify(o));
const OID = "a".repeat(40);
const positiveVector=Uint8Array.from({length:1024},(_,i)=>(i*17+5)&255);

function syntheticChain() {
  const vectorSha=sha(positiveVector);
  const digests=Buffer.from(vectorSha,"hex");
  const tile={tile:0,firstOrdinal:0,count:1,startByte:0,endByte:31,
              bytes:32,sha256:sha(digests)};
  const index={
    schemaVersion:"research-atlas-ra12c2-cluster-index-v1",
    cluster:0,count:1,vectorDimension:1024,digestBytes:32,tileVectors:64,
    sourceVectorSha256:sha(positiveVector),
    digests:{path:"digests/cluster-000.sha256.bin",bytes:32,sha256:sha(digests)},
    tiles:[tile]
  };
  const indexBytes=utf8(index);
  const record={
    cluster:0,count:1,
    index:{path:"indexes/cluster-000.json",bytes:indexBytes.length,sha256:sha(indexBytes)},
    digests:{path:"digests/cluster-000.sha256.bin",bytes:32,sha256:sha(digests)}
  };
  const root={
    schemaVersion:"research-atlas-ra12c2-vector-digest-tree-v1",
    documentCount:451823, clusterCount:256,dimension:1024,digestBytes:32,tileVectors:64,
    productionEnabled:false,
    source:{revision:"5a4a195085de54bf607a6c4397092ffb32716dcc",
      vectorShardsSourceSha256Verified:true},
    clusters:Array.from({length:256},(_,i)=>i===0?record:{cluster:i,count:1})
  };
  const rootBytes=utf8(root);
  return {indexBytes,rootBytes,rootSha:sha(rootBytes),digests,record};
}
function mockResponses({tamperRoot=false,tamperIndex=false,tamperTile=false,
                        tileStatus=206, vectorStatus=206, corruptVector=false}={}) {
  const fixture=syntheticChain();
  const called=[];
  const get=async (url, options)=>{
    called.push({url,options});
    const baseHeaders={};
    if(url.endsWith("/hash-manifest.json")){
      const bytes=tamperRoot?Buffer.from("tampered"):fixture.rootBytes;
      return new Response(bytes,{status:200,headers:baseHeaders});
    }
    if(url.endsWith("/indexes/cluster-000.json")){
      const bytes=tamperIndex?Buffer.from("tampered"):fixture.indexBytes;
      return new Response(bytes,{status:200});
    }
    if(url.endsWith("/digests/cluster-000.sha256.bin")){
      const bytes=tamperTile?Buffer.alloc(32,1):fixture.digests;
      return new Response(bytes,{status:tileStatus,
        headers:tileStatus===206?{"Content-Range":"bytes 0-31/32"}:{}});
    }
    if(url.endsWith("/clusters/cluster-000.vectors.i8")){
      const bytes=Uint8Array.from(positiveVector);
      if(corruptVector) bytes[4]^=8;
      return new Response(bytes,{status:vectorStatus,
        headers:vectorStatus===206?{"Content-Range":"bytes 0-1023/1024"}:{}});
    }
    throw Error("Unexpected request "+url);
  };
  return {get,called,rootSha:fixture.rootSha};
}
function params(mock){
  return {oid:OID,cluster:0,ordinal:0,expectedRootSha:mock.rootSha,
    fetchImpl:mock.get,cryptoImpl:webcrypto};
}

test("RA12-C3 synthetic full root-index-tile-vector proof authenticates 1024 bytes",async()=>{
  const f=mockResponses();
  const result=await fetchAuthenticatedQwenVector(params(f));
  assert.equal(result.state,"verified",JSON.stringify(result));
  assert.equal(result.bytes.length,1024);
  assert.equal(result.proof,"root-sha:index-sha:tile-sha:vector-sha");
  assert.equal(result.vectorSha256,sha(positiveVector));
  assert.equal(f.called.length,4);
  assert.equal(f.called[2].options.headers.Range,"bytes=0-31");
  assert.equal(f.called[3].options.headers.Range,"bytes=0-1023");
  assert.equal(result.atlasRuntimeEnabled,false);
});
test("RA12-C3 wrong immutable HF OID blocked without any fetch",async()=>{
  const f=mockResponses();
  const res=await fetchAuthenticatedQwenVector({...params(f),oid:"main"});
  assert.equal(res.reason,"invalid-hf-oid");
  assert.equal(f.called.length,0);
});
test("RA12-C3 tampered root blocks before index retrieval",async()=>{
  const f=mockResponses({tamperRoot:true});
  const res=await fetchAuthenticatedQwenVector(params(f));
  assert.equal(res.reason,"json-sha-mismatch");
  assert.equal(f.called.length,1);
});
test("RA12-C3 tampered cluster index blocks before hash tile",async()=>{
  const f=mockResponses({tamperIndex:true});
  const res=await fetchAuthenticatedQwenVector(params(f));
  assert.equal(res.reason,"json-sha-mismatch");
  assert.equal(f.called.length,2);
});
test("RA12-C3 digest tile must be HTTP 206, not silent 200",async()=>{
  const f=mockResponses({tileStatus:200});
  const res=await fetchAuthenticatedQwenVector(params(f));
  assert.equal(res.reason,"digest-range-ignored-200");
  assert.equal(f.called.length,3);
});
test("RA12-C3 digest tile SHA mismatch blocks original vector fetch",async()=>{
  const f=mockResponses({tamperTile:true});
  const res=await fetchAuthenticatedQwenVector(params(f));
  assert.equal(res.reason,"digest-tile-sha-mismatch");
  assert.equal(f.called.length,3);
});
test("RA12-C3 original V4 vector SHA mismatch remains fail-closed",async()=>{
  const f=mockResponses({corruptVector:true});
  const res=await fetchAuthenticatedQwenVector(params(f));
  assert.equal(res.reason,"vector-slice-sha-mismatch");
  assert.equal(f.called.length,4);
});
test("RA12-C3 Range ignored for vector also blocked",async()=>{
  const f=mockResponses({vectorStatus:200});
  const res=await fetchAuthenticatedQwenVector(params(f));
  assert.equal(res.reason,"vector-range-ignored-200");
});
test("RA12-C3 out-of-bounds ordinal fails without fetching",async()=>{
  const f=mockResponses();
  const res=await fetchAuthenticatedQwenVector({...params(f),ordinal:10000});
  assert.equal(res.reason,"invalid-contract-or-aborted");
  assert.equal(f.called.length,0);
});

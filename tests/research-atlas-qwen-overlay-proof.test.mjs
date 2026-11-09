import test from "node:test";
import assert from "node:assert/strict";
import {createHash,webcrypto} from "node:crypto";
import {gzipSync} from "node:zlib";
import {fetchAuthenticatedOverlayVector,cosineOverlayVectors} from "../src/core/research-atlas-qwen-overlay-proof.js";

const sha=b=>createHash("sha256").update(b).digest("hex");
const oid="a".repeat(40);
const vector=Uint8Array.from({length:1024},(_,i)=>(i*13+9)&255);
const vectorSha=sha(vector);
const digests=Buffer.concat([Buffer.from(vectorSha,"hex"),Buffer.alloc((207-1)*32)]);
const index=gzipSync(Buffer.from('{"identity":"doi:test","ordinal":0,"vectorSha256":"'+vectorSha+'"}\n'));
const manifest={
  schemaVersion:"research-atlas-ra12c5b-semantic-overlay-v1",status:"built-unpublished",
  documentCount:207,dimension:1024,productionEnabled:false,
  artifacts:{vectors:{bytes:211968,sha256:"f".repeat(64)},index:{bytes:index.length,sha256:sha(index)},
    digests:{bytes:6624,sha256:sha(digests)}}
};
const manifestBytes=Buffer.from(JSON.stringify(manifest));
const lookup={schemaVersion:"research-atlas-ra12c5c-overlay-identity-lookup-v1",
  sourceManifestSha256:sha(manifestBytes),documentCount:207,dimension:1024,
  vectorsSha256:"f".repeat(64),digestsSha256:sha(digests),productionEnabled:false,
  records:Array.from({length:207},(_,i)=>({identity:i===0?"doi:test":"x:"+i,ordinal:i,
    vectorSha256:i===0?vectorSha:"0".repeat(64)}))};
const lookupBytes=Buffer.from(JSON.stringify(lookup));

function mock({vectorStatus=206,corruptVector=false,tamperManifest=false,tamperIndex=false,tamperLookup=false}={}){
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    if(url.endsWith("/manifest.json")){
      const b=tamperManifest?Buffer.from("bad"):manifestBytes;
      return new Response(b,{status:200,headers:{"Content-Length":String(b.length)}});
    }
    if(url.endsWith("/vector-index.jsonl.gz")){
      const b=tamperIndex?Buffer.from("bad"):index;
      return new Response(b,{status:200,headers:{"Content-Length":String(b.length)}});
    }
    if(url.endsWith("/vector-digests.sha256.bin")) return new Response(digests,{status:200});
    if(url.endsWith("/identity-lookup.json")){
      const b=tamperLookup?Buffer.from("bad"):lookupBytes; return new Response(b,{status:200});
    }
    if(url.endsWith("/vectors.i8")){
      const b=Uint8Array.from(vector); if(corruptVector) b[0]^=1;
      return new Response(b,{status:vectorStatus,headers:vectorStatus===206?{"Content-Range":"bytes 0-1023/211968"}:{}});
    }
    throw Error("unexpected "+url);
  };
  return {fetchImpl,calls};
}
const params=m=>({oid,ordinal:0,expectedManifestSha256:sha(manifestBytes),expectedIndexSha256:sha(index),expectedLookupSha256:sha(lookupBytes),expectedManifestBytes:manifestBytes.length,expectedIndexBytes:index.length,expectedLookupBytes:lookupBytes.length,fetchImpl:m.fetchImpl,cryptoImpl:webcrypto});

test("C5-C verifies manifest, original index/digest, lookup and 206 vector slice",async()=>{
  const m=mock(); const r=await fetchAuthenticatedOverlayVector(params(m));
  assert.equal(r.state,"verified",JSON.stringify(r));
  assert.equal(r.vectorSha256,vectorSha); assert.equal(r.bytes.length,1024);
  assert.equal(r.proof,"manifest-sha:index-sha:digest-sha:lookup-sha:range206:vector-sha");
  assert.equal(m.calls.at(-1).options.headers.Range,"bytes=0-1023");
  assert.equal(cosineOverlayVectors(r.bytes,r.bytes),1);
});
test("C5-C rejects mutable/non-OID publication before fetch",async()=>{
  const m=mock(); const r=await fetchAuthenticatedOverlayVector({...params(m),oid:"main"});
  assert.equal(r.reason,"invalid-hf-oid"); assert.equal(m.calls.length,0);
});
test("C5-C fails closed on manifest tamper",async()=>{
  const m=mock({tamperManifest:true}); const r=await fetchAuthenticatedOverlayVector(params(m));
  assert.equal(r.reason,"file-byte-count-mismatch"); assert.equal(m.calls.length,1);
});
test("C5-C fails closed on original index SHA mismatch",async()=>{
  const m=mock({tamperIndex:true}); const r=await fetchAuthenticatedOverlayVector(params(m));
  assert.match(r.reason,/file-(byte-count|sha)-mismatch/); assert.equal(m.calls.length,2);
});
test("C5-C rejects HTTP 200 for vector range",async()=>{
  const m=mock({vectorStatus:200}); const r=await fetchAuthenticatedOverlayVector(params(m));
  assert.equal(r.reason,"vector-range-ignored-200");
});
test("C5-C rejects corrupted 1024-byte vector",async()=>{
  const m=mock({corruptVector:true}); const r=await fetchAuthenticatedOverlayVector(params(m));
  assert.equal(r.reason,"vector-slice-sha-mismatch");
});

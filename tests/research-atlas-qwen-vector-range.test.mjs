import test from "node:test";
import assert from "node:assert/strict";
import {createHash, webcrypto} from "node:crypto";
import {
  QWEN3_V4_REVISION, vectorByteRange, parseExactContentRange,
  cosineInt8, fetchVerifiedVectorRange
} from "../src/core/research-atlas-qwen-vector-range.js";

const url = "https://huggingface.co/datasets/CristianPelayo/openalex-philosophy/resolve/" +
  QWEN3_V4_REVISION + "/semantic-retrieval/v3.3/browser-static-v4/20261010-v4/clusters/cluster-000.vectors.i8";
const cluster = {count:3,vectors:{bytes:3072}};
const range = vectorByteRange(1, cluster);
const vector = Uint8Array.from({length:1024},(_,i) => (i*7)%256);
const hash = createHash("sha256").update(vector).digest("hex");
const response = (status, headers = {}, body = vector) =>
  new Response(body, {status,headers});
const defaults = {url,range,expectedSliceSha256:hash,cryptoImpl:webcrypto};

test("RA12-C1: exact 1024-byte offset, range semantics and edge bounds",()=>{
  assert.deepEqual(range,{start:1024,end:2047,total:3072,bytes:1024});
  assert.deepEqual(vectorByteRange(2,cluster),{start:2048,end:3071,total:3072,bytes:1024});
  assert.throws(()=>vectorByteRange(3,cluster),RangeError);
  assert.throws(()=>vectorByteRange(-1,cluster),RangeError);
  assert.throws(()=>vectorByteRange(0,{count:3,vectors:{bytes:3000}}),RangeError);
  assert.equal(parseExactContentRange("bytes 1024-2047/3072",range),true);
  for(const value of ["bytes 1024-2047/*","bytes 1024-2048/3072","bytes 1024-2047/9999",
    "bytes 1024-2047/3072, other","bytes */3072","BYTES 1024-2047/3072",""]) {
    assert.equal(parseExactContentRange(value,range),false,value);
  }
});

test("RA12-C1: verified 206 produces one SHA-verified int8 1024-vector",async()=>{
  let rangeHeader;
  const fetchImpl = async (_url,opts)=>{
    rangeHeader=opts.headers.Range;
    assert.equal(opts.mode,"cors");
    assert.equal(opts.credentials,"omit");
    return response(206,{"Content-Range":"bytes 1024-2047/3072"});
  };
  const result=await fetchVerifiedVectorRange({...defaults,fetchImpl});
  assert.equal(rangeHeader,"bytes=1024-2047");
  assert.equal(result.state,"verified");
  assert.equal(result.byteCount,1024);
  assert.ok(result.bytes instanceof Int8Array);
  assert.equal(result.bytes[0],vector[0]);
  assert.equal(result.bytes[100],new Int8Array(vector.buffer)[100]);
  assert.equal(result.sliceSha256,hash);
});

test("RA12-C1: 200 full-shard fallback is refused, even with correct 1024 bytes",async()=>{
  const r=await fetchVerifiedVectorRange({...defaults,fetchImpl:async()=>response(200)});
  assert.deepEqual(r,{state:"blocked",reason:"range-ignored-200"});
});

test("RA12-C1: missing, wrong or unexposed Content-Range is refused",async()=>{
  let r=await fetchVerifiedVectorRange({...defaults,fetchImpl:async()=>response(206)});
  assert.equal(r.reason,"content-range-not-exposed");
  r=await fetchVerifiedVectorRange({...defaults,fetchImpl:async()=>response(206,{"Content-Range":"bytes 1024-2047/4000"})});
  assert.equal(r.reason,"invalid-content-range-or-encoding");
  r=await fetchVerifiedVectorRange({...defaults,fetchImpl:async()=>response(206,{"Content-Range":"bytes 1024-2047/3072","Content-Encoding":"gzip"})});
  assert.equal(r.reason,"invalid-content-range-or-encoding");
});

test("RA12-C1: short or oversized response body is rejected before hashing",async()=>{
  let r=await fetchVerifiedVectorRange({...defaults,fetchImpl:async()=>response(206,{"Content-Range":"bytes 1024-2047/3072"},new Uint8Array(1000))});
  assert.equal(r.reason,"short-read");
  r=await fetchVerifiedVectorRange({...defaults,fetchImpl:async()=>response(206,{"Content-Range":"bytes 1024-2047/3072"},new Uint8Array(1030))});
  assert.equal(r.reason,"response-over-budget");
});

test("RA12-C1: tampered bytes never become a verified vector",async()=>{
  const corrupted=Uint8Array.from(vector);
  corrupted[100]^=7;
  const r=await fetchVerifiedVectorRange({...defaults,fetchImpl:async()=>response(206,{"Content-Range":"bytes 1024-2047/3072"},corrupted)});
  assert.equal(r.reason,"slice-sha-mismatch");
});

test("RA12-C1: invalid source and missing per-slice hash fail before fetching",async()=>{
  let requested=0;
  const fetchImpl=async()=>{requested++;throw Error("Should never run")};
  const a=await fetchVerifiedVectorRange({...defaults,expectedSliceSha256:undefined,fetchImpl});
  const b=await fetchVerifiedVectorRange({...defaults,url:"https://untrusted.example/cluster.bin",fetchImpl});
  const c=await fetchVerifiedVectorRange({...defaults,range:{...range,bytes:3072},fetchImpl});
  const d=await fetchVerifiedVectorRange({...defaults,url:url.replace("cluster-000.vectors.i8","cluster-000.ids.u32"),fetchImpl});
  const e=await fetchVerifiedVectorRange({...defaults,url:url.replace("cluster-000.vectors.i8","cluster-999.vectors.i8"),fetchImpl});
  assert.deepEqual([a.reason,b.reason,c.reason,d.reason,e.reason],Array(5).fill("invalid-contract"));
  assert.equal(requested,0);
});

test("RA12-C1: network/CORS denial or cancel fails without throwing",async()=>{
  const r=await fetchVerifiedVectorRange({...defaults,fetchImpl:async()=>{throw Error("CORS") }});
  assert.equal(r.reason,"network-or-cors");
  const controller=new AbortController();
  controller.abort();
  const a=await fetchVerifiedVectorRange({...defaults,signal:controller.signal,fetchImpl:async()=>{throw Error("AbortError")}});
  assert.equal(a.reason,"aborted");
});

test("RA12-C1: quantized document-document cosine renormalizes int8 vectors",()=>{
  const a=new Int8Array(1024), b=new Int8Array(1024),neg=new Int8Array(1024);
  a[0]=10;a[1]=20;
  b[0]=20;b[1]=40;
  neg[0]=-10;neg[1]=-20;
  assert.ok(Math.abs(cosineInt8(a,b)-1)<1e-14);
  assert.ok(Math.abs(cosineInt8(a,neg)+1)<1e-14);
  const ortho=new Int8Array(1024);ortho[5]=127;
  assert.equal(cosineInt8(a,ortho),0);
  assert.throws(()=>cosineInt8(new Int8Array(1024),a),/Zero-norm/);
  assert.throws(()=>cosineInt8(new Int8Array(2),a),RangeError);
});

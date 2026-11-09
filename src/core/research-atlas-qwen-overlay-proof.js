// RA12-C5-C — standalone experimental overlay integrity proof.
// Not imported by production Atlas. Immutable HF OID + pinned file SHA values are required.
import { sha256Hex, cosineInt8 } from "./research-atlas-qwen-vector-range.js";

export const RA12C5C_OVERLAY_DIMENSION = 1024;
export const RA12C5C_OVERLAY_DOCUMENTS = 207;
export const RA12C5C_OVERLAY_VECTOR_BYTES = 211968;
export const RA12C5C_OVERLAY_PREFIX = "research-atlas/qwen3-semantic-overlay/v1/ra12c5b-run42560032286";
const DATASET_PREFIX = "https://huggingface.co/datasets/CristianPelayo/openalex-philosophy/resolve/";

const validSha = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const validOid = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const fail = reason => ({state:"blocked", reason});

async function readCapped(response, maximum) {
  if (!response.body?.getReader) throw new Error("no-readable-body");
  const declared=response.headers.get("content-length");
  if (declared!==null && Number(declared)>maximum) {
    await response.body.cancel().catch(()=>{}); throw new Error("over-budget");
  }
  const reader=response.body.getReader();
  const chunks=[]; let total=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      if (!value || total+value.byteLength>maximum) {
        await reader.cancel().catch(()=>{}); throw new Error("over-budget");
      }
      chunks.push(value); total+=value.byteLength;
    }
  } catch (error) { await reader.cancel().catch(()=>{}); throw error; }
  const out=new Uint8Array(total); let offset=0;
  for (const chunk of chunks) { out.set(chunk,offset); offset+=chunk.byteLength; }
  return out;
}

async function verifiedWholeFile({url, expectedSha, expectedBytes, maxBytes, fetchImpl, cryptoImpl, signal}) {
  if (!validSha(expectedSha) || !Number.isSafeInteger(expectedBytes) || expectedBytes<1 || expectedBytes>maxBytes)
    throw new Error("invalid-whole-file-contract");
  const response=await fetchImpl(url,{method:"GET",mode:"cors",credentials:"omit",cache:"no-store",signal});
  if (response.status!==200) { await response.body?.cancel().catch(()=>{}); throw new Error("file-http-"+response.status); }
  const bytes=await readCapped(response,maxBytes);
  if (bytes.byteLength!==expectedBytes) throw new Error("file-byte-count-mismatch");
  if (await sha256Hex(bytes,cryptoImpl)!==expectedSha) throw new Error("file-sha-mismatch");
  return bytes;
}

function immutableBase(oid) {
  if (!validOid(oid)) throw new Error("invalid-hf-oid");
  return DATASET_PREFIX+oid+"/"+RA12C5C_OVERLAY_PREFIX;
}

function digestHex(bytes) {
  return Array.from(bytes, value=>value.toString(16).padStart(2,"0")).join("");
}

export async function fetchAuthenticatedOverlayVector({
  oid, ordinal, expectedManifestSha256, expectedIndexSha256, expectedLookupSha256,
  expectedManifestBytes=1803, expectedIndexBytes=19314, expectedLookupBytes,
  fetchImpl=globalThis.fetch, cryptoImpl=globalThis.crypto, signal
}={}) {
  if (!Number.isSafeInteger(ordinal) || ordinal<0 || ordinal>=RA12C5C_OVERLAY_DOCUMENTS ||
      !validSha(expectedManifestSha256) || !validSha(expectedIndexSha256) || !validSha(expectedLookupSha256) ||
      !Number.isSafeInteger(expectedManifestBytes) || expectedManifestBytes<1 ||
      !Number.isSafeInteger(expectedIndexBytes) || expectedIndexBytes<1 ||
      !Number.isSafeInteger(expectedLookupBytes) || expectedLookupBytes<1 ||
      typeof fetchImpl!=="function" || !cryptoImpl?.subtle?.digest || signal?.aborted)
    return fail("invalid-contract-or-aborted");
  let base;
  try { base=immutableBase(oid); } catch { return fail("invalid-hf-oid"); }
  let accepted=0;
  try {
    const manifestBytes=await verifiedWholeFile({
      url:base+"/manifest.json", expectedSha:expectedManifestSha256,
      expectedBytes:expectedManifestBytes,maxBytes:10_000,fetchImpl,cryptoImpl,signal
    }); accepted+=manifestBytes.byteLength;
    const manifest=JSON.parse(new TextDecoder().decode(manifestBytes));
    if (manifest.schemaVersion!=="research-atlas-ra12c5b-semantic-overlay-v1" ||
        manifest.status!=="built-unpublished" || manifest.documentCount!==RA12C5C_OVERLAY_DOCUMENTS ||
        manifest.dimension!==RA12C5C_OVERLAY_DIMENSION || manifest.productionEnabled!==false ||
        manifest.artifacts?.vectors?.bytes!==RA12C5C_OVERLAY_VECTOR_BYTES ||
        manifest.artifacts?.index?.sha256!==expectedIndexSha256 ||
        !validSha(manifest.artifacts?.digests?.sha256)) throw new Error("invalid-overlay-manifest");

    const indexBytes=await verifiedWholeFile({
      url:base+"/vector-index.jsonl.gz", expectedSha:expectedIndexSha256,
      expectedBytes:expectedIndexBytes,maxBytes:50_000,fetchImpl,cryptoImpl,signal
    }); accepted+=indexBytes.byteLength;

    const digestBytes=await verifiedWholeFile({
      url:base+"/vector-digests.sha256.bin", expectedSha:manifest.artifacts.digests.sha256,
      expectedBytes:manifest.artifacts.digests.bytes,maxBytes:10_000,fetchImpl,cryptoImpl,signal
    }); accepted+=digestBytes.byteLength;
    if (digestBytes.byteLength!==RA12C5C_OVERLAY_DOCUMENTS*32) throw new Error("invalid-digest-layout");

    const lookupResponse=await fetchImpl(base+"/identity-lookup.json",{
      method:"GET",mode:"cors",credentials:"omit",cache:"no-store",signal
    });
    if (lookupResponse.status!==200) { await lookupResponse.body?.cancel().catch(()=>{}); throw new Error("lookup-http-"+lookupResponse.status); }
    const lookupBytes=await readCapped(lookupResponse,150_000); accepted+=lookupBytes.byteLength;
    if (lookupBytes.byteLength!==expectedLookupBytes) throw new Error("lookup-byte-count-mismatch");
    if (await sha256Hex(lookupBytes,cryptoImpl)!==expectedLookupSha256) throw new Error("lookup-sha-mismatch");
    const lookup=JSON.parse(new TextDecoder().decode(lookupBytes));
    if (lookup.schemaVersion!=="research-atlas-ra12c5c-overlay-identity-lookup-v1" ||
        lookup.sourceManifestSha256!==expectedManifestSha256 || lookup.documentCount!==RA12C5C_OVERLAY_DOCUMENTS ||
        lookup.dimension!==1024 || lookup.vectorsSha256!==manifest.artifacts.vectors.sha256 ||
        lookup.digestsSha256!==manifest.artifacts.digests.sha256 || lookup.records?.length!==RA12C5C_OVERLAY_DOCUMENTS ||
        lookup.productionEnabled!==false) throw new Error("invalid-overlay-lookup");
    const row=lookup.records[ordinal];
    if (row?.ordinal!==ordinal || typeof row.identity!=="string" || !validSha(row.vectorSha256))
      throw new Error("invalid-overlay-lookup-row");
    const digest=digestHex(digestBytes.subarray(ordinal*32,(ordinal+1)*32));
    if (digest!==row.vectorSha256) throw new Error("lookup-digest-disagreement");

    const start=ordinal*1024, end=start+1023;
    const response=await fetchImpl(base+"/vectors.i8",{
      method:"GET",mode:"cors",credentials:"omit",cache:"no-store",
      headers:{Range:"bytes="+start+"-"+end},signal
    });
    if (response.status!==206) {
      await response.body?.cancel().catch(()=>{});
      throw new Error(response.status===200?"vector-range-ignored-200":"vector-http-"+response.status);
    }
    const exact="bytes "+start+"-"+end+"/"+RA12C5C_OVERLAY_VECTOR_BYTES;
    const contentRange=response.headers.get("content-range");
    const encoding=response.headers.get("content-encoding");
    const contentType=response.headers.get("content-type");
    if (contentRange!==exact || (encoding&&encoding.toLowerCase()!=="identity") ||
        (contentType&&contentType.toLowerCase().includes("multipart/"))) {
      await response.body?.cancel().catch(()=>{}); throw new Error(contentRange?"invalid-vector-content-range":"vector-content-range-not-exposed");
    }
    const vector=await readCapped(response,1024); accepted+=vector.byteLength;
    if (vector.byteLength!==1024) throw new Error("vector-short-read");
    if (await sha256Hex(vector,cryptoImpl)!==digest) throw new Error("vector-slice-sha-mismatch");
    return {
      state:"verified", bytes:new Int8Array(vector.buffer,vector.byteOffset,vector.byteLength),
      identity:row.identity, ordinal, vectorSha256:digest, bytesAccepted:accepted,
      proof:"manifest-sha:index-sha:digest-sha:lookup-sha:range206:vector-sha",
      atlasRuntimeEnabled:false, semanticNeighborEnabled:false
    };
  } catch (error) {
    return {state:"blocked",reason:error instanceof Error?error.message:"unknown-error",bytesAccepted:accepted};
  }
}

export function cosineOverlayVectors(left,right) {
  return cosineInt8(left,right,RA12C5C_OVERLAY_DIMENSION);
}

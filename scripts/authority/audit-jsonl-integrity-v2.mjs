import {readFile,mkdir,writeFile} from "node:fs/promises";
import {join,dirname,resolve} from "node:path";
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline";
import {readSnapshotJsonl} from "./read-snapshot-jsonl.mjs";
const [indexRoot,out]=process.argv.slice(2);
if(!out)throw Error("Usage: audit-jsonl-integrity-v2.mjs INDEX OUTPUT");
const rawManifest=await readFile(join(indexRoot,"manifest.json"));
const manifest=JSON.parse(rawManifest);
const totals={files:0,physicalLines:0,validRows:0,invalidPhysicalLines:0,possibleMultilineRecords:0,unclassifiedInvalidLines:0};
const affected=[],readerDifferences=[];
let streamedInvalid=0,streamedValid=0,canonicalValid=0,canonicalInvalid=0,canonicalDifferences=0;
const parse=s=>{try{return JSON.parse(s);}catch{return null;}};
// Investigate raw physical lines; never repair or write back the input.
// Joining is only a diagnostic hypothesis and must form a complete work
// record with numeric IDs, not an arbitrary invented row.
for(const item of manifest.files?.works||[]){
 const raw=await readFile(join(indexRoot,item.path),"utf8");
 const lines=raw.split(/\r?\n/);
 totals.files++;
 let fileRawValid=0,fileRawInvalid=0,fileStreamValid=0,fileStreamInvalid=0;
 const stream=createInterface({input:createReadStream(join(indexRoot,item.path),{encoding:"utf8"}),crlfDelay:Infinity});
 for await(const line of stream){if(!line.trim())continue;if(parse(line))fileStreamValid++;else fileStreamInvalid++;}
 streamedInvalid+=fileStreamInvalid;streamedValid+=fileStreamValid;
 for(let i=0;i<lines.length;i++){
  if(!lines[i].trim())continue;
  totals.physicalLines++;
  if(parse(lines[i])){totals.validRows++;fileRawValid++;continue;}
  const start=i,parts=[lines[i]];
  while(i+1<lines.length&&parts.length<8&&lines[i+1].trim()&&!parse(lines[i+1])&&!/^\s*\{/.test(lines[i+1])){
   parts.push(lines[++i]);totals.physicalLines++;
  }
  totals.invalidPhysicalLines+=parts.length;fileRawInvalid+=parts.length;
  const reconstructed=parts.length>1?parse(parts.join("\\n")):null;
  const possible=Boolean(reconstructed&&/^\d+$/.test(String(reconstructed.id))&&/^\d+$/.test(String(reconstructed.wid))&&typeof reconstructed.t==="string");
  if(possible)totals.possibleMultilineRecords++;else totals.unclassifiedInvalidLines+=parts.length;
  affected.push({path:item.path,startLine:start+1,endLine:i+1,physicalLines:parts.length,possibleEscapedNewlineRecord:possible,authorId:possible?String(reconstructed.id):null,workId:possible?String(reconstructed.wid):null,rawFragmentSha256:createHash("sha256").update(parts.join("\n")).digest("hex")});
 }
 const canonicalDiagnostics={invalidJsonRows:0,samples:[]};let valid=0;
 for await(const row of readSnapshotJsonl(join(indexRoot,item.path),{tolerant:true,diagnostics:canonicalDiagnostics}))valid++;
 canonicalValid+=valid;canonicalInvalid+=canonicalDiagnostics.invalidJsonRows;
 if(valid!==fileRawValid||canonicalDiagnostics.invalidJsonRows!==fileRawInvalid)canonicalDifferences++;
 if(fileRawValid!==fileStreamValid||fileRawInvalid!==fileStreamInvalid)readerDifferences.push({path:item.path,raw:{valid:fileRawValid,invalid:fileRawInvalid},readline:{valid:fileStreamValid,invalid:fileStreamInvalid}});
}
await mkdir(dirname(resolve(out)),{recursive:true});
await writeFile(out,JSON.stringify({schemaVersion:"authority-jsonl-integrity-v2",revision:manifest.source?.philosophy_revision,manifestSha256:createHash("sha256").update(rawManifest).digest("hex"),totals,affected,readerComparison:{streamedValid,streamedInvalid,differingFiles:readerDifferences.length,readerDifferences,canonicalValid,canonicalInvalid,canonicalDifferences},limitations:["Possible escaped-newline records are diagnostic only. Original bytes and frozen release remain unchanged.","No inferred record enters a benchmark or production index. Rebuild and compare against pinned HF source before repair."]},null,2)+"\n");
console.log("AUTHORITY_JSONL_INTEGRITY "+JSON.stringify({...totals,streamedValid,streamedInvalid,differingFiles:readerDifferences.length,canonicalValid,canonicalInvalid,canonicalDifferences}));
if(canonicalDifferences)throw Error("Canonical reader disagrees with full shard scan");

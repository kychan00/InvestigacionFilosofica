import {readFile} from "node:fs/promises";
// JSONL records are separated by LF (optionally preceded by CR).
// Do not treat Unicode separators inside JSON strings as record boundaries.
// Read one immutable shard at a time. Never reconstruct invalid records.
export function splitSnapshotJsonl(text){
 return String(text).split(/\r?\n/);
}
export async function* readSnapshotJsonl(path,{tolerant=false,diagnostics=null}={}){
 const lines=splitSnapshotJsonl(await readFile(path,"utf8"));
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!line.trim())continue;
  try{yield JSON.parse(line);}
  catch(error){
   if(!tolerant)throw Error(path+":"+(i+1)+": "+error.message);
   if(diagnostics){
    diagnostics.invalidJsonRows=Number(diagnostics.invalidJsonRows||0)+1;
    diagnostics.samples??=[];
    if(diagnostics.samples.length<20)diagnostics.samples.push({path,lineNumber:i+1,error:error.message,preview:line.slice(0,240)});
   }
  }
 }
}

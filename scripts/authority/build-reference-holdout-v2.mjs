import {readFile,mkdir,writeFile} from "node:fs/promises";
import {join,resolve,relative,isAbsolute,sep} from "node:path";
import {pathToFileURL,fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {findSnapshotAuthorCandidates} from "../../src/core/remote-author-resolution.js";
import {intellectualHistoryReferenceInventory} from "../../src/core/author-intellectual-history.js";
import {buildReferenceHoldout} from "../../src/core/author-authority-reference-holdout-v2.js";
import {buildHumanAuthorityEvidencePack} from "./build-human-authority-audit-v1.mjs";
const [indexRoot,snapshotRoot,portraitPath,nominalRoot,out]=process.argv.slice(2);
if(!out)throw Error("Usage: build-reference-holdout-v2.mjs INDEX SNAPSHOT PORTRAIT NOMINAL OUTPUT");
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const lines=async p=>(await readFile(p,"utf8")).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const manifest=await read(join(indexRoot,"manifest.json"));
const snapshot=await read(join(snapshotRoot,"snapshot-shadow.json"));
const portraits=await read(portraitPath);
const nominal=await read(join(nominalRoot,"manifest.json"));
if([portraits.revision,nominal.datasetRevision,manifest.source?.philosophy_revision].some(r=>r!==snapshot.datasetRevision))throw Error("Reference holdout source revision mismatch");
const pilot=await lines(join(snapshotRoot,"review-sample.jsonl"));
const probes=await lines(join(nominalRoot,"sample.jsonl"));
const inventory=await read(new URL("../../src/data/latin-american-philosophers-metadata.json",import.meta.url));
const excluded=[...pilot.flatMap(p=>[p.left,p.right]),...probes.flatMap(p=>p.profiles),...portraits.results.flatMap(p=>(p.indexCandidates||[]).map(c=>({authorId:String(c.id),name:c.name})))];
const root=resolve(indexRoot),indexBase=pathToFileURL(root+sep);
const localFetch=async value=>{
 const u=new URL(value);if(u.protocol!=="file:")throw Error("Only local snapshot files allowed");
 const p=fileURLToPath(u),rel=relative(root,p);if(rel.startsWith("..")||isAbsolute(rel))throw Error("Outside snapshot");
 try{return new Response(await readFile(p),{status:200});}catch(e){if(e.code==="ENOENT")return new Response("",{status:404});throw e;}
};
const selection=await buildReferenceHoldout({inventory,timeline:intellectualHistoryReferenceInventory(),excludedNames:[...excluded.map(p=>p.name),...portraits.results.map(p=>p.name)],excludedIds:excluded.map(p=>p.authorId),lookup:name=>findSnapshotAuthorCandidates(name,{indexBase,fetchImpl:localFetch})});
const sample=selection.cases.map(c=>JSON.stringify(c)).join("\n")+"\n";
const sampleSha256=createHash("sha256").update(sample).digest("hex");
const diagnostics={invalidJsonRows:0,samples:[]};
// Collect source evidence for each distinct sampled candidate, even when a
// reference query has multiple or zero candidate profiles.
const evidenceInput=selection.cases.flatMap(c=>c.profiles.map((p,i)=>({audit_id:c.audit_id+":"+i,left:p,right:p})));
const evidence=await buildHumanAuthorityEvidencePack({inputRoot:indexRoot,manifest,sample:evidenceInput,maxWorksPerProfile:12,diagnostics});
await mkdir(out,{recursive:true});
await writeFile(join(out,"sample.jsonl"),sample);
await writeFile(join(out,"evidence.json"),JSON.stringify({sampleSha256,cases:evidence.map(e=>({audit_id:e.audit_id,profile:e.left})),diagnostics},null,2)+"\n");
await writeFile(join(out,"judgments.template.jsonl"),selection.cases.map(c=>JSON.stringify({audit_id:c.audit_id,task:c.task,judgment:null,note:"",evidence:[]})).join("\n")+"\n");
const report={schemaVersion:"authority-v2-reference-holdout-v1",datasetRevision:snapshot.datasetRevision,sampleSha256,selectedCases:selection.cases.length,counts:selection.counts,shortfalls:selection.shortfalls,diagnostics:selection.diagnostics,evidenceDiagnostics:diagnostics,reviewed:0,limitations:["Reference people selected from existing editorial sources, not independent gold.","Historical is birth before 1900; contemporary is birth in or after 1900, not inferred from publication year.","Latin American category denotes the editorial inventory scope, not nationality inferred from names.","No-candidate queries are retained as retrieval probes, not validated failures.","Disjoint observed IDs and names, not proof of different persons; lookup capped by index resolver."]};
await writeFile(join(out,"manifest.json"),JSON.stringify(report,null,2)+"\n");
console.log("AUTHORITY_V2_REFERENCE_HOLDOUT "+JSON.stringify(report));

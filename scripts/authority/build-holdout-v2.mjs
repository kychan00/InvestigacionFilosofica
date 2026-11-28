import {readFile,mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {selectNominalHoldout} from "../../src/core/author-authority-holdout-v2.js";
import {buildHumanAuthorityEvidencePack} from "./build-human-authority-audit-v1.mjs";
const [indexRoot,benchmarkPath,snapshotRoot,portraitPath,out]=process.argv.slice(2);
if(!out)throw Error("Usage: build-holdout-v2.mjs INDEX BENCHMARK SNAPSHOT PORTRAITS OUTPUT");
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const manifest=await read(join(indexRoot,"manifest.json"));
const benchmark=await read(benchmarkPath);
const snapshot=await read(join(snapshotRoot,"snapshot-shadow.json"));
const portraits=await read(portraitPath);
const pilot=(await readFile(join(snapshotRoot,"review-sample.jsonl"),"utf8")).trim().split(/\r?\n/).map(JSON.parse);
if(snapshot.datasetRevision!==manifest.source?.philosophy_revision||portraits.revision!==snapshot.datasetRevision)throw Error("Holdout source revision mismatch");
const selection=selectNominalHoldout({benchmark,pilot,portrait:portraits});
const diagnostics={invalidJsonRows:0,samples:[]};
// Reuse the evidence reader for single-profile retrieval probes by repeating
// the profile in its internal pair-shaped input; no duplicate review case.
const evidence=await buildHumanAuthorityEvidencePack({inputRoot:indexRoot,manifest,sample:selection.cases.map(c=>({audit_id:c.audit_id,left:c.profiles[0],right:c.profiles[1]||c.profiles[0]})),maxWorksPerProfile:12,diagnostics});
const sampleText=selection.cases.map(c=>JSON.stringify(c)).join("\n")+"\n";
const sampleSha256=createHash("sha256").update(sampleText).digest("hex");
await mkdir(out,{recursive:true});
await writeFile(join(out,"sample.jsonl"),sampleText);
await writeFile(join(out,"evidence.json"),JSON.stringify({sampleSha256,cases:evidence.map((e,i)=>({audit_id:e.audit_id,profiles:selection.cases[i].profiles.length===1?[e.left]:[e.left,e.right]})),diagnostics},null,2)+"\n");
await writeFile(join(out,"judgments.template.jsonl"),selection.cases.map(c=>JSON.stringify({audit_id:c.audit_id,task:c.task,judgment:null,note:"",evidence:[]})).join("\n")+"\n");
const report={schemaVersion:"authority-v2-nominal-holdout-v1",datasetRevision:snapshot.datasetRevision,sampleSha256,counts:selection.counts,selectedCases:selection.cases.length,selectedProfiles:selection.selectedProfiles,excludedProfiles:selection.excludedProfiles,shortfalls:{...selection.shortfalls,contemporary:60,historical:50,"latin-american":60},reviewed:0,diagnostics,limitations:["Disjoint profile IDs relative to frozen pilot and listed SIVA candidates; not proof of disjoint human identities.","Purposive nominal risk probes from existing benchmark strata, not independent human gold.","Identity-pair and name-retrieval tasks differ; no pooled accuracy. Accent removal is a controlled query change.","Historical, contemporary and Latin American strata require separately sourced reference people; no inferred nationality from names."]};
await writeFile(join(out,"manifest.json"),JSON.stringify(report,null,2)+"\n");
console.log("AUTHORITY_V2_HOLDOUT "+JSON.stringify(report));

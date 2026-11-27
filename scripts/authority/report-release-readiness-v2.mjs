import {readFile,mkdir,writeFile} from "node:fs/promises";
import {join,dirname,resolve} from "node:path";
import {createHash} from "node:crypto";
import {evaluateReleaseReadiness} from "../../src/core/author-authority-release-v2.js";
const [snapshotRoot,portraitPath,output,judgmentPath]=process.argv.slice(2);
if(!snapshotRoot||!portraitPath||!output)throw Error("Usage: report-release-readiness-v2.mjs SNAPSHOT_ROOT PORTRAIT_REPORT OUTPUT [REVIEWED_JUDGMENTS_JSON]");
const read=async path=>JSON.parse(await readFile(path,"utf8"));
const policy=await read(new URL("../../benchmark/author-authority/v2/release-policy.json",import.meta.url));
const snapshot=await read(join(snapshotRoot,"snapshot-shadow.json"));
const bibliography=await read(join(snapshotRoot,"bibliography-shadow.json"));
const portraits=await read(portraitPath);
const sample=await readFile(join(snapshotRoot,"review-sample.jsonl"));
const sha=createHash("sha256").update(sample).digest("hex");
if(sha!==snapshot.provenance.sampleSha256)throw Error("Review sample checksum mismatch");
let judgments=[];
if(judgmentPath){
 const reviewed=await read(judgmentPath);
 if(reviewed.schemaVersion!=="authority-v2-reviewed-pilot-v1"||reviewed.sampleSha256!==sha||reviewed.datasetRevision!==snapshot.datasetRevision||!Array.isArray(reviewed.judgments))throw Error("Review packet not bound to frozen sample");
 judgments=reviewed.judgments;
}
const report=evaluateReleaseReadiness({policy,snapshot,bibliography,portraits,judgments});
await mkdir(dirname(resolve(output)),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+"\n");
console.log("AUTHORITY_V2_RELEASE_READINESS "+JSON.stringify({scientificReady:report.scientificReady,activationAllowed:report.activationAllowed,blockers:report.blockers,identity:report.identity,portrait:report.portrait}));
// Diagnostic preview CI can pass even if the scientific gate is blocked.
// A separate explicit release change is required; no code auto-enables V2.

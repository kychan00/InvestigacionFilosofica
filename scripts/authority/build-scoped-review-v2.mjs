import {readFile,mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {buildContributionReview,buildPortraitReview,validateScopedJudgments} from "../../src/core/author-authority-scoped-review-v2.js";
const [docRoot,portraitPath,out]=process.argv.slice(2);
if(!out)throw Error("Usage: build-scoped-review-v2.mjs DOCUMENTARY_ROOT PORTRAIT_REPORT OUTPUT");
const sha=v=>createHash("sha256").update(v).digest("hex");
const doc=JSON.parse(await readFile(join(docRoot,"manifest.json"),"utf8"));
const raw=await readFile(join(docRoot,"review-cases.jsonl"));
const portraitRaw=await readFile(portraitPath);
const portrait=JSON.parse(portraitRaw);
if(doc.schemaVersion!=="authority-v2-documentary-review-v1"||doc.reviewSha256!==sha(raw)||doc.datasetRevision!==portrait.revision||portrait.schemaVersion!=="siva-live-cohort-report-v1")throw Error("Scoped review provenance mismatch");
const cases=raw.toString("utf8").trim().split(/\r?\n/).map(JSON.parse);
if(cases.length!==300||new Set(cases.map(c=>c.audit_id)).size!==300||cases.some(c=>c.judgment!==null))throw Error("Expected untouched documentary packet");
const contribution=buildContributionReview(cases),portraits=buildPortraitReview(portrait);
const jsonl=rows=>rows.map(r=>JSON.stringify(r)).join("\n")+(rows.length?"\n":"");
const report={schemaVersion:"authority-v2-scoped-review-v1",datasetRevision:doc.datasetRevision,documentaryReviewSha256:doc.reviewSha256,portraitReportSha256:sha(portraitRaw),contribution:{counts:contribution.counts,available:contribution.available,shortfalls:contribution.shortfalls,...validateScopedJudgments(contribution.rows,[])},portrait:{counts:portraits.counts,shortfall:portraits.shortfall,...validateScopedJudgments(portraits.rows,[])},scientificReady:false,activationAllowed:false,limitations:["Contribution probes reuse the documentary reference cohort; they are not independent people relative to that cohort.","Observed membership and cross-profile contrast are sampling provenance, not verified positive or negative labels.","Portrait profiles are from the existing development cohort. A no-media case is not a reviewed portrait; independent portrait gold still required.","Only snapshot-visible source metadata and actual downloaded media references are included. No external verification or adjudication is performed here."]};
for(const [name,packet] of [["contribution",contribution],["portrait",portraits]]){
 const dir=join(out,name),text=jsonl(packet.rows);
 await mkdir(dir,{recursive:true});
 await writeFile(join(dir,"cases.jsonl"),text);
 await writeFile(join(dir,"judgments.template.jsonl"),jsonl(packet.rows.map(c=>({audit_id:c.audit_id,task:c.task,judgment:null,reviewer:"",reviewedAt:null,note:"",evidence:[],...(name==="portrait"?{options:c.options.map(o=>({option_id:o.option_id,judgment:null}))}:{})}))));
 await writeFile(join(dir,"manifest.json"),JSON.stringify({schemaVersion:"authority-v2-scope-packet-v1",scope:name,datasetRevision:doc.datasetRevision,sampleSha256:sha(text),cases:packet.rows.length,reviewed:0},null,2)+"\n");
 // Store method allocation apart from the reviewer-facing files.
 await mkdir(join(out,"diagnostics"),{recursive:true});
 await writeFile(join(out,"diagnostics",name+"-allocation.json"),JSON.stringify(packet.allocation,null,2)+"\n");
}
await writeFile(join(out,"manifest.json"),JSON.stringify(report,null,2)+"\n");
await writeFile(join(out,"README.md"),"# Scoped review V2\n\nReview contribution and portrait packets separately. Consult primary editions, publisher/library records, institutional biographies or image archives; never infer authorship or portrait identity from the snapshot or P18 alone. Enter the reviewer identifier, review date, reason and independent HTTPS source URLs. For contribution choose author, editor, translator, coordinator, compiler, reviewer, other-role, no-contribution or unresolved. The latter is required when the person or role is not documented. For portrait, evaluate each candidate media option as correct-subject, wrong-subject or unresolved, with judgment=reviewed only when there are actual options. Without media use unresolved; no verified image means no portrait precision observation. Do not inspect diagnostics/ allocation until first-pass judgments are complete. These packets are review preparation only and cannot authorize activation.\n");
console.log("AUTHORITY_V2_SCOPED_REVIEW "+JSON.stringify(report));

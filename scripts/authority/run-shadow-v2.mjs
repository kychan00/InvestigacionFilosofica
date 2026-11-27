import {readFile,mkdir,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {selectHumanAuthorityAuditPairs,humanAuditSampleJsonl} from "../../src/core/author-authority-human-audit.js";
import {buildHumanAuthorityEvidencePack} from "./build-human-authority-audit-v1.mjs";
import {compareSnapshotShadow} from "../../src/core/author-authority-shadow-v2.js";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const hash=b=>createHash("sha256").update(b).digest("hex");
export async function runSnapshotShadow({inputRoot,benchmarkPath,outputRoot}){
 const manifestBytes=await readFile(join(inputRoot,"manifest.json"));
 const manifest=JSON.parse(manifestBytes);
 const benchmark=await read(benchmarkPath);
 const release=await read("benchmark/author-authority/v1/config.json");
 const audit=await read("benchmark/author-authority/human-audit-v1/config.json");
 if(!benchmark.gate?.passed||manifest.source?.philosophy_repo!==release.expectedSource.philosophyRepo||manifest.source?.philosophy_revision!==release.expectedSource.philosophyRevision||manifest.source?.philosophy_path!==release.expectedSource.philosophyPath)throw Error("Unpinned or invalid snapshot");
 // Reuse the already validated V1 selection, not model-generated labels.
 const selection=selectHumanAuthorityAuditPairs({benchmarkReport:benchmark});
 const sampleSha256=hash(humanAuditSampleJsonl(selection.sample));
 if(sampleSha256!==audit.selection.expectedSampleSha256)throw Error("Frozen sample changed");
 const diagnostics={invalidJsonRows:0,samples:[]};
 const cases=await buildHumanAuthorityEvidencePack({inputRoot,manifest,sample:selection.sample,maxWorksPerProfile:audit.evidence.maxWorksPerProfile,diagnostics});
 const report=compareSnapshotShadow({cases,manifestItems:selection.manifestItems,datasetRevision:manifest.source.philosophy_revision});
 report.provenance={release:release.release,manifestSha256:hash(manifestBytes),sampleSha256,philosophyRepo:manifest.source.philosophy_repo,philosophyPath:manifest.source.philosophy_path,diagnostics};
 await mkdir(outputRoot,{recursive:true});
 await writeFile(join(outputRoot,"snapshot-shadow.json"),JSON.stringify(report,null,2)+"\n");
 // Keep the reviewer-facing packet blind. Do not embed predictions here.
 await writeFile(join(outputRoot,"review-sample.jsonl"),humanAuditSampleJsonl(selection.sample));
 await writeFile(join(outputRoot,"review-evidence.json"),JSON.stringify({sampleSha256,cases,diagnostics},null,2)+"\n");
 await writeFile(join(outputRoot,"judgments.template.jsonl"),selection.sample.map(c=>JSON.stringify({audit_id:c.audit_id,judgment:null,note:"",evidence:[]})).join("\n")+"\n");
 console.log(JSON.stringify({pairs:report.count,agreed:report.agreed,unresolved:report.unresolved,byStratum:report.byStratum,invalidJsonRows:diagnostics.invalidJsonRows,sampleSha256},null,2));
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [inputRoot,benchmarkPath,outputRoot]=process.argv.slice(2);
 if(!inputRoot||!benchmarkPath||!outputRoot)throw Error("Usage: run-shadow-v2.mjs INPUT_ROOT BENCHMARK_REPORT OUTPUT_ROOT");
 await runSnapshotShadow({inputRoot,benchmarkPath,outputRoot});
}

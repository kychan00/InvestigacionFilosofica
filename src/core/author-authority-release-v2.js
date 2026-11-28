// Scientific readiness is not CI success. No runtime activation API here.
const ratio=(n,d)=>d?n/d:null;
const relations=new Set(["same-person","different-person","unresolved"]);
export function scoreIdentityPilot(results,judgments=[]){
 if(!Array.isArray(results)||!Array.isArray(judgments))throw TypeError("Invalid pilot");
 const byId=new Map();
 for(const row of results){
  if(!row.auditId||byId.has(row.auditId)||!relations.has(row.shadowRelation)||!relations.has(row.legacyRelation))throw Error("Invalid or duplicate pilot prediction");
  byId.set(row.auditId,row);
 }
 const reviewed=new Map();
 for(const j of judgments){
  if(!byId.has(j.audit_id)||reviewed.has(j.audit_id)||!relations.has(j.judgment))throw Error("Invalid or duplicate judgment");
  if(typeof j.note!=="string"||!j.note.trim()||!Array.isArray(j.evidence)||!j.evidence.some(x=>typeof x==="string"&&x.trim()))throw Error("Judgment requires documented evidence");
  reviewed.set(j.audit_id,j);
 }
 function score(field){
  const m={truePositive:0,trueNegative:0,falseMerge:0,falseSplit:0,abstained:0,resolvedGold:0,unresolvedGold:0};
  for(const [id,j] of reviewed){
   if(j.judgment==="unresolved"){m.unresolvedGold++;continue;}
   m.resolvedGold++;
   const pred=byId.get(id)[field];
   if(pred==="unresolved")m.abstained++;
   else if(pred==="same-person")m[j.judgment==="same-person"?"truePositive":"falseMerge"]++;
   else m[j.judgment==="different-person"?"trueNegative":"falseSplit"]++;
  }
  const same=[...reviewed.values()].filter(j=>j.judgment==="same-person").length;
  const different=[...reviewed.values()].filter(j=>j.judgment==="different-person").length;
  const precision=ratio(m.truePositive,m.truePositive+m.falseMerge);
  const recall=ratio(m.truePositive,same);
  return {...m,sameGold:same,differentGold:different,precision,recall,
    f1:precision===null||recall===null?null:precision+recall===0?0:2*precision*recall/(precision+recall),
    coverage:ratio(m.resolvedGold-m.abstained,m.resolvedGold),
    selectiveAccuracy:ratio(m.truePositive+m.trueNegative,m.resolvedGold-m.abstained)};
 }
 return {total:results.length,reviewed:reviewed.size,unreviewed:results.length-reviewed.size,legacy:score("legacyRelation"),experimental:score("shadowRelation")};
}
function portraitComparison(report){
 const rows=report.results.flatMap(r=>r.candidates||[]).filter(c=>c.status==="measured");
 const usable=new Set(["downloaded","abstained","insufficient-profile"]);
 const comparable=rows.filter(c=>usable.has(c.legacy?.status)&&usable.has(c.experimental?.status));
 const validDownloads=comparable.filter(c=>c.experimental.status==="downloaded");
 return {profiles:rows.length,comparable:comparable.length,coverage:ratio(comparable.length,rows.length),legacyDownloaded:comparable.filter(c=>c.legacy.status==="downloaded").length,
 experimentalDownloaded:validDownloads.length,gains:comparable.filter(c=>c.legacy.status!=="downloaded"&&c.experimental.status==="downloaded").length,
 losses:comparable.filter(c=>c.legacy.status==="downloaded"&&c.experimental.status!=="downloaded").length,
 rateLimited:rows.filter(c=>[c.legacy?.status,c.experimental?.status].includes("rate-limited")).length,
 inconclusive:rows.length-comparable.length,reviewed:0,precision:null};
}
export function evaluateReleaseReadiness({policy,snapshot,bibliography,portraits,judgments=[]}){
 if(policy?.schemaVersion!=="author-authority-v2-release-policy-v1"||policy.mode!=="preview-only")throw Error("Invalid release policy");
 if(snapshot?.schemaVersion!=="authority-snapshot-shadow-v2"||bibliography?.schemaVersion!=="authority-bibliography-snapshot-v2"||portraits?.schemaVersion!=="siva-live-cohort-report-v1")throw Error("Invalid report schemas");
 if(!snapshot.datasetRevision||snapshot.datasetRevision!==bibliography.datasetRevision||snapshot.datasetRevision!==portraits.revision)throw Error("Mismatched dataset revisions");
 if(!snapshot.provenance?.sampleSha256||snapshot.provenance.sampleSha256!==bibliography.provenance?.sampleSha256||snapshot.count!==snapshot.results.length||snapshot.count!==policy.identityPilot.pairs)throw Error("Mismatched frozen sample");
 const identity=scoreIdentityPilot(snapshot.results,judgments);
 const portrait=portraitComparison(portraits);
 const m=identity.experimental,p=policy.identityPilot;
 const blockers=[];
 const require=(condition,code,actual,threshold)=>{if(!condition)blockers.push({code,actual,threshold});};
 require(identity.reviewed===identity.total,"identity-review-incomplete",identity.reviewed,identity.total);
 require(m.resolvedGold>=p.minimumResolved,"identity-resolved-gold",m.resolvedGold,p.minimumResolved);
 require(m.coverage!==null&&m.coverage>=p.minimumCoverage,"identity-coverage",m.coverage,p.minimumCoverage);
 require(m.precision!==null&&m.precision>=p.minimumPrecision,"identity-precision",m.precision,p.minimumPrecision);
 require(m.recall!==null&&m.recall>=p.minimumRecall,"identity-recall",m.recall,p.minimumRecall);
 require(m.resolvedGold>0&&m.falseMerge<=p.maxFalseMerges,"identity-false-merges",m.resolvedGold?m.falseMerge:null,p.maxFalseMerges);
 require(portrait.coverage!==null&&portrait.coverage>=policy.portrait.minimumComparableCoverage,"portrait-provider-coverage",portrait.coverage,policy.portrait.minimumComparableCoverage);
 require(portrait.experimentalDownloaded>=policy.portrait.minimumDownloaded,"portrait-download-evidence",portrait.experimentalDownloaded,policy.portrait.minimumDownloaded);
 require(false,"portrait-independent-review-missing",0,policy.portrait.minimumReviewed);
 require(false,"contribution-independent-review-missing",0,policy.contribution.minimumReviewed);
 require(false,"independent-final-cohort-not-adjudicated",0,policy.independentFinal.minimumCases);
 return {schemaVersion:"author-authority-v2-readiness-v1",datasetRevision:snapshot.datasetRevision,sampleSha256:snapshot.provenance.sampleSha256,
  scientificReady:false,activationAllowed:false,mode:"preview-only",blockers,identity,
  bibliography:{...bibliography.summary,reviewed:0,precision:null,recall:null},portrait,
  caveats:["Snapshot assertions and development regression fixtures are not human gold.","Null metrics mean insufficient denominators, not zero errors.","Provider failures are not negative identity judgments.","Final cohort, contribution and portrait adjudication remain unimplemented; this report cannot authorize activation."]};
}

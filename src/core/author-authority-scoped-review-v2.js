// Reviewer-facing evidence only. Neither membership nor a contrast is gold.
const numeric=v=>/^\d+$/.test(String(v||""));
const order=(a,b)=>String(a).localeCompare(String(b),"en");
function seedOrder(value){let h=0x811c9dc5;for(const b of new TextEncoder().encode("20261127:scope:"+value))h=Math.imul(h^b,0x01000193)>>>0;return h;}
const arr=v=>Array.isArray(v)?v:[];
function profileRef(p){return {authorId:String(p.authorId),displayName:p.displayName||null,openAlexUrl:"https://openalex.org/A"+p.authorId,observedNames:arr(p.observedNames),orcids:arr(p.orcids),activeYears:p.activeYears||null,workCountObserved:p.workCountObserved??null};}
function documentRef(w){return {workId:String(w.workId),source:"https://openalex.org/W"+w.workId,title:w.title||null,year:w.year??null,type:w.type||null,language:w.language||null,coauthors:arr(w.coauthors),authorPosition:w.authorPosition||null};}
export function buildContributionReview(cases,{observedLimit=60,contrastLimit=40}={}){
 const observed=[],contrast=[];
 for(const c of cases){
  const profiles=arr(c.profiles).filter(p=>numeric(p?.authorId));
  for(const p of profiles){
   for(const w of arr(p.works).filter(w=>numeric(w.workId)&&w.title)){
    observed.push({target:p,work:w,sourceCase:c.audit_id,stratum:c.stratum,kind:"observed-membership",owner:p});
   }
  }
  if(c.task!=="identity-pair"||profiles.length!==2||profiles[0].authorId===profiles[1].authorId)continue;
  for(let i=0;i<2;i++){
   const target=profiles[i],owner=profiles[1-i],known=new Set(arr(target.works).map(w=>String(w.workId)));
   for(const w of arr(owner.works).filter(w=>numeric(w.workId)&&w.title&&!known.has(String(w.workId)))){
    contrast.push({target,work:w,sourceCase:c.audit_id,stratum:c.stratum,kind:"cross-profile-probe",owner});
   }
  }
 }
 const selected=[],keys=new Set(),targetIds=new Set(),workIds=new Set();
 const sort=rows=>rows.sort((a,b)=>seedOrder(a.target.authorId+":"+a.work.workId)-seedOrder(b.target.authorId+":"+b.work.workId)||order(a.target.authorId+":"+a.work.workId,b.target.authorId+":"+b.work.workId));
 function take(pool,limit){
  let n=0;
  for(const row of sort(pool)){
   if(n>=limit)break;
   const target=String(row.target.authorId),wid=String(row.work.workId),key=target+":"+wid;
   // Diversity: one work per target and one target per work, across both pools.
   if(keys.has(key)||targetIds.has(target)||workIds.has(wid))continue;
   keys.add(key);targetIds.add(target);workIds.add(wid);selected.push(row);n++;
  }
  return n;
 }
 // Reserve hard contrast probes first. They are not labeled negatives.
 const contrastCount=take(contrast,contrastLimit),observedCount=take(observed,observedLimit);
 const rows=selected.sort((a,b)=>seedOrder("review:"+a.target.authorId)-seedOrder("review:"+b.target.authorId)||order(a.target.authorId,b.target.authorId)).map((r,i)=>({
  audit_id:"AA2-CON-"+String(i+1).padStart(3,"0"),task:"contribution-role-review",sourceCase:r.sourceCase,
  target:profileRef(r.target),work:documentRef(r.work),snapshotMembership:{observedProfile:profileRef(r.owner),assertedRole:"not-verified"},
  judgment:null,note:"",evidence:[]
 }));
 const allocation=Object.fromEntries(rows.map((r,i)=>[r.audit_id,selected[i].kind]));
 return {rows,allocation,counts:{observed:observedCount,contrast:contrastCount},shortfalls:{observed:observedLimit-observedCount,contrast:contrastLimit-contrastCount},available:{observed:observed.length,contrast:contrast.length}};
}
const mediaSource=v=>{try{const u=new URL(v);return u.protocol==="https:"&&u.hostname==="commons.wikimedia.org"&&!u.username&&!u.password&&!u.port&&u.pathname.startsWith("/wiki/File")?u.href:null;}catch{return null;}};
export function buildPortraitReview(report,{limit=20}={}){
 const rows=[],allocation={},ids=new Set();
 for(const group of arr(report.results)){
  for(const c of arr(group.candidates)){
   if(rows.length>=limit)break;
   const id=String(c.id||"");if(!numeric(id)||ids.has(id))continue;
   ids.add(id);
   const audit_id="AA2-POR-"+String(rows.length+1).padStart(3,"0");
   const proposed=new Map(),arms={};
   for(const arm of ["legacy","experimental"]){
    const r=c[arm],source=r?.status==="downloaded"?mediaSource(r.source):null;
    if(!source){arms[arm]={status:r?.status||c.status||"not-measured",optionId:null};continue;}
    const key=source+"|"+String(r.entityId||"");
    if(!proposed.has(key))proposed.set(key,{source,entityId:r.entityId||null,license:r.license||null});
    arms[arm]={status:"downloaded",key};
   }
   const options=[...proposed.entries()].sort((a,b)=>order(a[0],b[0])).map(([key,v],i)=>({key,option_id:"P"+(i+1),...v,judgment:null}));
   for(const a of Object.values(arms)){if(a.key){a.optionId=options.find(x=>x.key===a.key).option_id;delete a.key;}}
   allocation[audit_id]=arms;
   rows.push({audit_id,task:"portrait-subject-review",target:{authorId:id,displayName:c.name||null,indexOrcid:c.indexOrcid||null,source:"https://openalex.org/A"+id},documentaryQuery:group.name||null,referenceSources:arr(group.sources||group.referenceSources),options:options.map(({key,...o})=>o),status:options.length?"candidate-media":"no-media-to-review",judgment:null,note:"",evidence:[]});
  }
 }
 return {rows,allocation,counts:{profiles:rows.length,withMedia:rows.filter(r=>r.options.length).length,withoutMedia:rows.filter(r=>!r.options.length).length,mediaOptions:rows.reduce((n,r)=>n+r.options.length,0)},shortfall:Math.max(0,limit-rows.length)};
}
const httpsSource=v=>{try{const u=new URL(v);return u.protocol==="https:"&&Boolean(u.hostname)&&!u.username&&!u.password;}catch{return false;}};
export function validateScopedJudgments(cases,judgments){
 if(!Array.isArray(cases)||!Array.isArray(judgments))throw TypeError("Expected cases and judgments arrays");
 const byId=new Map(cases.map(c=>[c.audit_id,c]));
 if(byId.size!==cases.length)throw Error("Duplicate case");
 const seen=new Set();let resolved=0,unresolved=0;
 for(const j of judgments){
  const c=byId.get(j.audit_id);
  if(!c||seen.has(j.audit_id)||c.task!==j.task)throw Error("Unknown, duplicate or mismatched judgment");
  seen.add(j.audit_id);
  if(typeof j.reviewer!=="string"||!j.reviewer.trim()||!j.reviewedAt||!Number.isFinite(Date.parse(j.reviewedAt))||typeof j.note!=="string"||!j.note.trim()||!Array.isArray(j.evidence)||!j.evidence.length||!j.evidence.every(httpsSource))throw Error("Reviewer, date, note and HTTPS evidence required");
  if(c.task==="contribution-role-review"){
   if(!["author","editor","translator","coordinator","compiler","reviewer","other-role","no-contribution","unresolved"].includes(j.judgment))throw Error("Invalid contribution role");
   if(j.judgment==="unresolved")unresolved++;else resolved++;
  }else if(c.task==="portrait-subject-review"){
   if(!c.options.length){if(j.judgment!=="unresolved"||arr(j.options).length)throw Error("No media cannot be judged correct or wrong");unresolved++;continue;}
   const options=arr(j.options),ids=new Set(options.map(o=>o.option_id));
   if(options.length!==c.options.length||ids.size!==options.length||options.some(o=>!c.options.some(p=>p.option_id===o.option_id)||!["correct-subject","wrong-subject","unresolved"].includes(o.judgment)))throw Error("All candidate media require individual judgments");
   if(j.judgment!=="reviewed")throw Error("Expected portrait option review");
   if(options.some(o=>o.judgment==="unresolved"))unresolved++;else resolved++;
  }else throw Error("Unknown scope");
 }
 return {total:cases.length,reviewed:seen.size,resolved,unresolved,unreviewed:cases.length-seen.size};
}

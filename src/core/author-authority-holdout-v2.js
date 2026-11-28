// Risk-based holdout candidate selection: no generated gold labels.
// Exclude all profile IDs used in prior development cohorts.
const id=p=>String(p?.authorId||"");
const compact=p=>({authorId:id(p),name:p.name||null});
export function selectNominalHoldout({benchmark,pilot,portrait,quotas={homonyms:60,"name-variants":40,initials:30}}){
 const used=new Set();
 for(const p of pilot)for(const x of [p.left,p.right])used.add(id(x));
 for(const row of portrait.results||[])for(const x of row.indexCandidates||[])used.add(String(x.id));
 const excluded=new Set(used),cases=[],counts={homonyms:0,"name-variants":0,initials:0};
 const take=(stratum,profiles,query=null)=>{
  const ids=profiles.map(id);
  if(counts[stratum]>=quotas[stratum]||ids.some(x=>!x||used.has(x))||new Set(ids).size!==ids.length)return;
  ids.forEach(x=>used.add(x));
  counts[stratum]++;
  cases.push({audit_id:"AA2-"+String(cases.length+1).padStart(3,"0"),stratum,task:stratum==="homonyms"?"identity-pair":"name-retrieval",profiles:profiles.map(compact),query,judgment:null});
 };
 const groups=benchmark.nameCollisions?.sample||{};
 for(const key of ["distinct-orcid-homonym","anchorless-homonym","mixed-anchor-homonym"]){
  for(const g of groups[key]||[]){
   const available=(g.profiles||[]).filter(p=>!used.has(id(p))).sort((a,b)=>id(a).localeCompare(id(b)));
   if(available.length>=2)take("homonyms",available.slice(0,2));
  }
 }
 const strata=benchmark.auditSample?.strata||{};
 // Accent-stripped query is a controlled retrieval perturbation, not a
 // verified alternative author name and not an identity-positive label.
 for(const p of strata.diacritics||[]){
  const query=String(p.name||"").normalize("NFD").replace(/\p{M}/gu,"");
  if(query&&query!==p.name)take("name-variants",[p],query);
 }
 for(const p of strata.initials||[])if(p.name)take("initials",[p],p.name);
 return {cases,counts,excludedProfiles:excluded.size,selectedProfiles:used.size-excluded.size,shortfalls:Object.fromEntries(Object.entries(quotas).map(([k,v])=>[k,v-counts[k]]))};
}

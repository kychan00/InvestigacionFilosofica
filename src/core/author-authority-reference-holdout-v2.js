const norm=v=>String(v||"").normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
function hash(value){let h=0x811c9dc5;for(const b of new TextEncoder().encode(value))h=Math.imul(h^b,0x01000193)>>>0;return h;}
export async function buildReferenceHoldout({inventory,timeline,excludedNames=[],excludedIds=[],lookup,quotas={contemporary:60,historical:50,"latin-american":60}}){
 const names=new Set(excludedNames.map(norm).filter(Boolean)),ids=new Set(excludedIds.map(String));
 const cases=[],counts={contemporary:0,historical:0,"latin-american":0},diagnostics={overlap:0,lookupError:0,noCandidate:0,notEvaluatedCandidates:0};
 const refs=[
  ...timeline.filter(r=>r.region!=="latin"&&Number.isInteger(r.birth)&&r.sources?.length).map(r=>({stratum:r.birth<1900?"historical":"contemporary",name:r.names[0],names:r.names,reference:{kind:"documentary-timeline",qid:r.qid,birth:r.birth,region:r.region,sources:r.sources}})),
  ...inventory.philosophers.filter(r=>r.status==="confirmed"&&r.name&&r.id).map(r=>({stratum:"latin-american",name:r.name,names:[r.name],reference:{kind:"editorial-inventory",inventoryId:r.id,source:inventory.source}}))
 ].sort((a,b)=>hash("20261127:"+a.stratum+":"+a.name)-hash("20261127:"+b.stratum+":"+b.name)||a.name.localeCompare(b.name,"en"));
 for(const ref of refs){
  if(counts[ref.stratum]>=quotas[ref.stratum])continue;
  const aliases=ref.names.map(norm).filter(Boolean);
  if(!aliases.length||aliases.some(n=>names.has(n))){diagnostics.overlap++;continue;}
  let found;
  try{found=await lookup(ref.name);}
  catch{diagnostics.lookupError++;continue;}
  const unique=[...new Map(found.filter(c=>/^\d+$/.test(String(c.id))).map(c=>[String(c.id),c])).values()].sort((a,b)=>Number(b.cw||0)-Number(a.cw||0)||String(a.id).localeCompare(String(b.id)));
  // Exclude the entire query if any returned candidate has been used.
  if(unique.some(c=>ids.has(String(c.id)))){diagnostics.overlap++;continue;}
  aliases.forEach(n=>names.add(n));unique.forEach(c=>ids.add(String(c.id)));
  const candidates=unique.map(c=>({authorId:String(c.id),name:c.n||null,matchKind:c.k||null}));
  const profiles=candidates.slice(0,3).map(c=>({authorId:c.authorId,name:c.name}));
  if(!candidates.length)diagnostics.noCandidate++;
  diagnostics.notEvaluatedCandidates+=Math.max(0,candidates.length-profiles.length);
  counts[ref.stratum]++;
  cases.push({audit_id:"AA2-REF-"+String(cases.length+1).padStart(3,"0"),stratum:ref.stratum,task:"reference-person-retrieval",query:ref.name,reference:ref.reference,candidates,profiles,judgment:null});
 }
 return {cases,counts,diagnostics,shortfalls:Object.fromEntries(Object.entries(quotas).map(([k,v])=>[k,v-counts[k]]))};
}

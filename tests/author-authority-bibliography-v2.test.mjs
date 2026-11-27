import test from "node:test";
import assert from "node:assert/strict";
import {evaluateBibliographicRecord,evaluateBibliographicBatches} from "../src/core/author-authority-bibliography-v2.js";
import {discoverAuthorArchive,fetchAuthorWorksFromSnapshot} from "../src/core/author-deep-discovery.js";
import {resolveFederatedAuthor} from "../src/core/crossref-author-fallback.js";
const datasetRevision="hf-fixture";
const author={id:"123",displayName:"Ana Pérez",orcid:"0000-0002-1825-0097"};
const w=(provider,id,authors,extra={})=>({id,title:"Bibliographic work "+id,year:2020,authors,providers:[provider],...extra});
const evaluate=(provider,work,extra={})=>evaluateBibliographicRecord({author,work,provider,datasetRevision,...extra});
test("exact snapshot membership is probable, not human identity confirmation",()=>{
 const work=w("OpenAlex Philosophy","https://openalex.org/W100",[{id:"https://openalex.org/A123",name:"Ana Pérez"},{id:"A456",name:"Otra Persona"}]);
 const r=evaluate("OpenAlex Philosophy",work);
 assert.deepEqual(r.contributions.map(c=>c.decision.status),["probable","unresolved"]);
 assert.equal(r.contributions[0].role,"author");
 assert.equal(r.contributions[0].evidence.find(e=>e.kind==="snapshot-author-membership").reliability,"asserted");
 assert.equal(evaluate("OpenAlex Philosophy",work,{author:{id:"123",displayName:"Ana Pérez"}}).contributions[0].decision.status,"probable");
});
test("name, conflicting ID and collective statement do not prove authorship",()=>{
 const byName=w("Crossref","x",[{name:"Ana Pérez"}]);
 assert.equal(evaluate("Crossref",byName).contributions[0].decision.status,"unresolved");
 const conflict=w("Crossref","x",[{name:"Ana Pérez",orcid:"0000-0001-5109-3700"}]);
 assert.equal(evaluate("Crossref",conflict).contributions[0].decision.status,"unresolved");
 const composite=w("Crossref","x",[{name:"Ana Pérez; Otra Persona",orcid:author.orcid}]);
 assert.equal(evaluate("Crossref",composite).contributions[0].decision.status,"unresolved");
 const multi=w("Crossref","x",[{name:"Ana Pérez"},{name:"Other Author",orcid:author.orcid}]);
 assert.ok(evaluate("Crossref",multi).contributions.every(c=>c.decision.status==="unresolved"));
});
test("explicit role stays separate and registry listing requires matching request",()=>{
 const item=w("ORCID","orcid:work:1",[{name:"Ana Pérez",orcid:author.orcid}]);
 assert.equal(evaluate("ORCID",item).contributions[0].decision.status,"unresolved");
 const r=evaluate("ORCID",item,{registryOrcid:author.orcid}).contributions[0];
 assert.equal(r.decision.status,"probable");assert.equal(r.role,"unknown");
 const editor=w("Internet Archive","archive:1",[{name:"Ana Pérez",role:"editor"}]);
 assert.equal(evaluate("Internet Archive",editor).contributions[0].role,"editor");
});
test("merged source metadata never borrows the winning author list",()=>{
 const item=w("Crossref","x",[{name:"Ana Pérez",orcid:author.orcid}],{providers:["Crossref","Internet Archive"],sourceRecords:[{provider:"Crossref",sourceId:"x"},{provider:"Internet Archive",sourceId:"y"}]});
 assert.equal(evaluate("Crossref",item).reason,"missing-source-creators");
 assert.equal(evaluate("Internet Archive",item).reason,"missing-source-creators");
 const sourceSpecific={...item,sourceRecords:[{provider:"Crossref",sourceId:"x",authors:[{name:"Otra Persona"}]}]};
 assert.equal(evaluate("Crossref",sourceSpecific).contributions[0].decision.status,"unresolved");
});
test("same DOI mirrors keep common lineage; duplicate retrieval does not inflate record count",()=>{
 const a=w("Crossref","x",[{name:"Ana Pérez",orcid:author.orcid}],{doi:"10.1234/test"});
 const b=w("Internet Archive","y",[{name:"Ana Pérez"}],{doi:"https://doi.org/10.1234/TEST"});
 const out=evaluateBibliographicBatches({author,datasetRevision,batches:[{provider:"Crossref",works:[a,a]},{provider:"Internet Archive",works:[b]}]});
 assert.equal(out.rows.length,2);assert.equal(out.rows[0].record.lineageKey,out.rows[1].record.lineageKey);
 assert.equal(out.counts.probable,1);assert.equal(out.counts.confirmed,0);
});
test("real federated resolver exposes source candidates even when legacy matcher drops them",async()=>{
 const records=[w("Crossref","x",[{name:"Ana Pérez"}]),w("Crossref","y",[{name:"Other Person"}])];
 const captured=[];
 const result=await resolveFederatedAuthor("Ana Pérez",{disableInternetArchive:true,disableCucsh:true,crossrefSearchImpl:async()=>records,onSourceBatch:b=>captured.push(b)});
 assert.equal(result.works.length,1);assert.equal(captured[0].works.length,2);
});
test("opt-in discovery uses same providers, keeps legacy output and performs no extra requests",async()=>{
 let calls=0;
 const input={author:{id:"123",displayName:"Ana Pérez"},snapshotImpl:async()=>{calls++;return {works:[w("OpenAlex Philosophy","https://openalex.org/W100",[{name:"Ana Pérez",id:"A123"}])],complete:true,total:1}},
 federatedImpl:async(n,options)=>{calls++;const works=[w("Crossref","x",[{name:"Ana Pérez"}])];options.onSourceBatch?.({provider:"Crossref",works});return {status:"resolved",works,author:{catalogSources:["Crossref"]}};}};
 const baseline=await discoverAuthorArchive(input);
 const shadow=await discoverAuthorArchive({...input,authorityShadowRevision:datasetRevision});
 assert.equal(calls,4);
 assert.deepEqual(shadow.works,baseline.works);
 assert.equal("authorityShadow" in baseline,false);
 assert.equal(shadow.authorityShadow.counts.probable,1);
 assert.equal(shadow.authorityShadow.counts.unresolved,1);
});


test("snapshot captures distinct memberships before deduplication and ignores synthetic identifiers",async()=>{
 const make=id=>w("OpenAlex Philosophy","https://openalex.org/W100",[{name:"Ana Pérez",id:"A"+id,orcid:author.orcid}],{snapshotMembership:{authorId:id,workId:"100",position:"first",synthesizedCreator:true}});
 const batches=[];
 const result=await fetchAuthorWorksFromSnapshot({authorId:"123",linkedAuthorIds:["456"],displayName:"Ana Pérez",enrichCollaborators:false,resolverImpl:async candidate=>({status:"resolved",author:{corpusWorks:1},works:[make(String(candidate.id))]}),onSourceBatch:b=>batches.push(structuredClone(b))});
 assert.equal(result.works.length,1);
 assert.equal(batches[0].works.length,2);
 const shadow=evaluateBibliographicBatches({author,batches,datasetRevision});
 assert.equal(shadow.rows.length,2);
 assert.notEqual(shadow.rows[0].record.ref,shadow.rows[1].record.ref);
 assert.deepEqual(shadow.rows.map(r=>r.contributions[0].decision.status),["probable","unresolved"]);
 assert.deepEqual(shadow.rows[0].contributions[0].evidence.map(e=>e.kind),["snapshot-author-membership"]);
});
test("capture failure stays in V2 diagnostics and does not suppress legacy work",async()=>{
 const work=w("Crossref","x",[{name:"Ana Pérez"}],{uncloneable:()=>{}});
 const options={author:{displayName:"Ana Pérez"},federatedImpl:async(n,o)=>{o.onSourceBatch?.({provider:"Crossref",works:[work]});return {status:"resolved",works:[work]};}};
 const base=await discoverAuthorArchive(options);
 const shadow=await discoverAuthorArchive({...options,authorityShadowRevision:datasetRevision});
 assert.deepEqual(shadow.works,base.works);
 assert.deepEqual(shadow.errors,base.errors);
 assert.equal(shadow.authorityShadow.diagnostics[0].reason,"capture-failed");
});
test("throwing observer does not turn a successful provider into a failed one",async()=>{
 const records=[w("Crossref","x",[{name:"Ana Pérez"}])];
 const result=await resolveFederatedAuthor("Ana Pérez",{disableInternetArchive:true,disableCucsh:true,crossrefSearchImpl:async()=>records,onSourceBatch:()=>{throw Error("observer");}});
 assert.equal(result.status,"resolved");assert.equal(result.works.length,1);
});

test("unrelated coauthors with different ORCID do not contradict selected creator",()=>{
 const r=evaluate("Crossref",w("Crossref","x",[{name:"Ana Pérez",orcid:author.orcid},{name:"Other Person",orcid:"0000-0001-5109-3700"}]));
 assert.equal(r.contributions[0].decision.status,"probable");
 assert.equal(r.contributions[1].relevant,false);
 assert.equal(r.contributions[1].identifierConflict,false);
 assert.deepEqual(r.contributions[1].evidence,[]);
});
test("invalid or merged synthetic membership cannot become ordinary positive attribution",()=>{
 const item=w("OpenAlex Philosophy","https://openalex.org/W100",[{id:"A123",name:"Ana Pérez",orcid:author.orcid}],{snapshotMembership:{authorId:"123",workId:"999",synthesizedCreator:true}});
 const r=evaluate("OpenAlex Philosophy",item);
 assert.equal(r.reason,"invalid-snapshot-membership");
 assert.equal(r.contributions[0].synthesizedCreator,true);
 assert.equal(r.contributions[0].decision.status,"unresolved");
 assert.deepEqual(r.contributions[0].evidence,[]);
});
test("same-name contradictory identifier remains relevant but asserted",()=>{
 const r=evaluate("Crossref",w("Crossref","x",[{name:"Ana Pérez",orcid:"0000-0001-5109-3700"}]));
 assert.equal(r.contributions[0].relevant,true);
 assert.equal(r.contributions[0].identifierConflict,true);
 assert.equal(r.contributions[0].decision.status,"unresolved");
});

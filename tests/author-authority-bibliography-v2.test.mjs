import test from "node:test";
import assert from "node:assert/strict";
import {evaluateBibliographicRecord,evaluateBibliographicBatches} from "../src/core/author-authority-bibliography-v2.js";
import {discoverAuthorArchive} from "../src/core/author-deep-discovery.js";
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

import test from "node:test";
import assert from "node:assert/strict";
import {assessPortraitV2} from "../src/core/author-authority-portrait-v2.js";
import {validateDecisionV2} from "../src/core/author-authority-evidence-v2.js";
import {resolveAuthorPortrait,portraitIdentity} from "../src/core/author-portrait-policy.js";
const identity={key:"fixture",qid:"Q123"};
const meta={identity:"https://www.wikidata.org/wiki/Q123",source:"https://commons.wikimedia.org/wiki/File:Test.jpg",license:{label:"CC BY 4.0"},authorityTrace:{entityId:"Q123",entityRevision:"123",authorityFile:"Test.jpg",commonsFile:"File:Test.jpg",method:"historical-authority"}};
test("authority P18 is probable, never confirmed, without ORCID or contribution evidence",()=>{
 const result=assessPortraitV2(identity,meta,"fixture");
 assert.equal(result.decision.scope,"portrait");assert.equal(result.decision.status,"probable");
 assert.equal(result.evidence[0].reliability,"asserted");
 assert.equal(result.evidence[0].revision,"wikidata:123");
 assert.deepEqual(validateDecisionV2(result.decision,result.evidence),[]);
});
test("missing image, compatible license alone, conflicting file or entity remain unresolved",()=>{
 for(const candidate of [null,{license:meta.license},{...meta,authorityTrace:{...meta.authorityTrace,commonsFile:"File:Tést.jpg"}},{...meta,authorityTrace:{...meta.authorityTrace,entityId:"Q124"}},{...meta,authorityTrace:{...meta.authorityTrace,method:"name-only"}}]){
  const result=assessPortraitV2(identity,candidate,"fixture");
  assert.equal(result.decision.status,"unresolved");assert.equal(result.evidence.length,0);
 }
});
test("existing resolver retains exact P18 provenance without additional network requests",async()=>{
 const claim=value=>({rank:"normal",mainsnak:{snaktype:"value",datavalue:{value}}});
 const i=portraitIdentity({id:"123",displayName:"Immanuel Kant"});
 let calls=0;
 const m=await resolveAuthorPortrait(i,{fetcher:async url=>{
  calls++;
  const p=new URL(url).searchParams;
  return Response.json(p.get("action")==="wbgetentities"?{entities:{Q9312:{id:"Q9312",lastrevid:321,claims:{P31:[claim({id:"Q5"})],P18:[claim("Test.jpg")]}}}}:{query:{pages:{1:{title:"File:Test.jpg",imageinfo:[{thumburl:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Test.jpg/220px-Test.jpg",thumbwidth:220,thumbheight:300,mime:"image/jpeg",extmetadata:{LicenseShortName:{value:"Public domain"}}}]}}}});
 }});
 assert.equal(calls,2);assert.equal(m.authorityTrace.method,"historical-authority");
 assert.equal(assessPortraitV2(i,m,"fixture").decision.status,"probable");
});

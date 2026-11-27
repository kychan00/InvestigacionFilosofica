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

const c=value=>({rank:"normal",mainsnak:{snaktype:"value",datavalue:{value}}});
const selected={id:"123",displayName:"Example Philosopher",orcid:"0000-0002-1825-0097"};
const person=(extra={})=>({id:"Q123",labels:{en:{value:selected.displayName}},claims:{P31:[c({id:"Q5"})],P10283:[c("A123")],P18:[c("Test.jpg")],...extra}});
const media={query:{pages:{1:{title:"File:Test.jpg",imageinfo:[{thumburl:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Test.jpg/220px-Test.jpg",thumbwidth:220,thumbheight:300,mime:"image/jpeg",extmetadata:{LicenseShortName:{value:"Public domain"}}}]}}}};
function routeFixture({orcidHits=[],oaHits=[{title:"Q123"}],entity=person(),nameHits=[],works={}}={}){
 const calls=[];
 const fetcher=async url=>{
  const p=new URL(url).searchParams;calls.push(p);
  if(p.get("list")==="search")return Response.json({query:{search:p.get("srsearch").includes("P496=")?orcidHits:oaHits}});
  if(p.get("action")==="wbsearchentities")return Response.json({search:nameHits});
  if(p.get("action")==="wbgetentities")return Response.json({entities:p.get("ids")==="Q123"?{Q123:entity}:works});
  return Response.json(media);
 };
 return {fetcher,calls};
}
test("experimental independent OA route recovers a portrait despite present unverified ORCID",async()=>{
 const legacy=routeFixture();
 assert.equal(await resolveAuthorPortrait(portraitIdentity(selected),legacy),null);
 assert.equal(legacy.calls.length,1);
 const v2=routeFixture();
 const identity=portraitIdentity(selected,[],{independent:true});
 const result=await resolveAuthorPortrait(identity,v2);
 assert.equal(result.authorityTrace.method,"openalex-bridge");
 assert.equal(v2.calls.length,4);
 assert.equal(assessPortraitV2(identity,result,"fixture").decision.status,"probable");
});
test("distinct identifier hits, conflicting IDs, wrong name, or non-human cannot pass",async()=>{
 for(const options of [
  {orcidHits:[{title:"Q124"}]},
  {oaHits:[{title:"Q123"},{title:"Q124"}]},
  {entity:person({P496:[c("0000-0001-5109-3700")]})},
  {entity:person({P10283:[c("A123"),c("A999")]})},
  {entity:{...person(),labels:{en:{value:"Different Person"}}}},
  {entity:person({P31:[c({id:"Q43229"})]})}
 ]){
  const fixture=routeFixture(options);
  assert.equal(await resolveAuthorPortrait(portraitIdentity(selected,[],{independent:true}),fixture),null);
  assert.ok(!fixture.calls.some(p=>p.get("prop")==="imageinfo"));
 }
});
test("verified ORCID and matching name remain an independent route",async()=>{
 const fixture=routeFixture({orcidHits:[{title:"Q123"}],oaHits:[],entity:person({P10283:[],P496:[c(selected.orcid)]})});
 const identity=portraitIdentity({...selected,orcidVerified:true},[],{independent:true});
 assert.equal((await resolveAuthorPortrait(identity,fixture)).authorityTrace.method,"orcid-bridge");
});
test("bibliographic recovery remains available with ORCID and requires exact local author IDs",async()=>{
 const records=[{title:"The ethics of evidence",authors:[{id:"A123",name:selected.displayName}]},{title:"Knowledge and interpretation",authors:[{id:"A123",name:selected.displayName}]}];
 const entity=person({P10283:[],P800:[c({id:"Q201"}),c({id:"Q202"})]});
 const works=Object.fromEntries(records.map((record,i)=>["Q20"+(i+1),{id:"Q20"+(i+1),labels:{en:{value:record.title}},claims:{P50:[c({id:"Q123"})]}}]));
 const fixture=routeFixture({oaHits:[],nameHits:[{id:"Q123"}],entity,works});
 const identity=portraitIdentity(selected,records,{independent:true});
 assert.equal(identity.canDiscover,true);
 assert.equal((await resolveAuthorPortrait(identity,fixture)).authorityTrace.method,"bibliographic-bridge");
 for(const altered of [records.map(w=>({...w,authors:[{name:selected.displayName}]})),records.map(w=>({...w,authors:[{id:"A999",name:selected.displayName}]})),records.map(w=>({...w,authors:[{id:"A123",name:selected.displayName,role:"editor"}]}))]){
  assert.equal(portraitIdentity(selected,altered,{independent:true}).canDiscover,false);
 }
});

import test from "node:test";
import assert from "node:assert/strict";
import {portraitIdentity,matchesPortraitIdentity,resolveAuthorPortrait} from "../src/core/author-portrait-policy.js";
import {reviewedAuthorEvidence,filterReviewedAuthorWorks} from "../src/core/author-reviewed-evidence.js";
import {resolveFederatedAuthor} from "../src/core/crossref-author-fallback.js";
const claim=value=>({rank:"normal",mainsnak:{snaktype:"value",datavalue:{value}}});
const work=(name,title,year=2019)=>({title,year,authors:[{name}],providers:["Crossref"]});
const human=(id,claims={})=>({id,claims:{P31:[claim({id:"Q5"})],P18:[claim("Test.jpg")],...claims}});
const media={query:{pages:{1:{title:"File:Test.jpg",imageinfo:[{thumburl:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Test.jpg/220px-Test.jpg",thumbwidth:220,thumbheight:280,mime:"image/jpeg",extmetadata:{LicenseShortName:{value:"CC BY-SA 4.0"},Artist:{value:"Photographer"}}}]}}}};
test("a verified ORCID does not block independent OpenAlex portrait lookup",async()=>{
 const identity=portraitIdentity({id:"123",displayName:"Example Person",orcid:"0000-0002-1825-0097",orcidVerified:true});
 const calls=[];
 const portrait=await resolveAuthorPortrait(identity,{fetcher:async url=>{
  const p=new URL(url).searchParams;
  if(p.get("list")==="search"){calls.push(p.get("srsearch"));return Response.json({query:{search:p.get("srsearch").includes("P10283")?[{title:"Q123"}]:[]}});}
  if(p.get("action")==="wbgetentities")return Response.json({entities:{Q123:human("Q123",{P10283:[claim("a123")]})}});
  return Response.json(media);
 }});
 assert.equal(calls.length,2);
 assert.match(calls[0],/P496/);assert.match(calls[1],/P10283/);
 assert.equal(portrait.identity,"https://www.wikidata.org/wiki/Q123");
});
test("Jaeggi verified ORCID with independent publisher link allows portrait despite missing Wikidata ORCID",async()=>{
 const person={id:"123",displayName:"Rahel Jaeggi",orcid:"0000-0003-4713-7031",orcidVerified:true};
 const identity=portraitIdentity(person);
 assert.equal(identity.qid,"Q2127389");
 assert.ok(matchesPortraitIdentity(human("Q2127389"),identity));
 assert.ok(!matchesPortraitIdentity(human("Q2127389",{P496:[claim("0000-0002-1825-0097")]}),identity));
 assert.ok(!matchesPortraitIdentity(human("Q2127389",{P10283:[claim("A999")]}),identity));
 assert.equal(portraitIdentity({...person,orcidVerified:false}).qid,null);
 const portrait=await resolveAuthorPortrait(identity,{fetcher:async url=>Response.json(new URL(url).searchParams.get("action")==="wbgetentities"?{entities:{Q2127389:human("Q2127389")}}:media)});
 assert.equal(portrait.license.label,"CC BY-SA 4.0");
});
test("Singer requires evidence, not just a shared name",()=>{
 const author={id:"456",displayName:"Peter Singer"};
 const works=[work("Peter Singer","Animal Liberation"),work("Peter Singer","Practical Ethics")];
 assert.equal(portraitIdentity(author).qid,null);
 assert.equal(portraitIdentity(author,works).qid,"Q211539");
 assert.equal(reviewedAuthorEvidence(author,[{...work("Peter Singer","AI ethics: the case for including animals"),doi:"10.1007/s43681-022-00187-z"}]).orcid,"0000-0003-3741-4314");
 assert.equal(reviewedAuthorEvidence({...author,orcid:"0000-0002-1825-0097"},works),null);
});
test("Chalmers archive excludes the documented medical and seventeenth-century homonyms",async()=>{
 const name="David Chalmers";
 const good=[work(name,"Facing Up to the Problem of Consciousness",1995),work(name,"Idealism and the Mind-Body Problem",2019)];
 const bad=[work(name,"Penile plastic operations in childhood",2026),work(name,"Congenital Upper Tract Anomalies",2020),work(name,"De statu hominis",1627),work("David Chalmers","Unverified title",2020)];
 assert.deepEqual(filterReviewedAuthorWorks(name,[...good,...bad]),good);
 const result=await resolveFederatedAuthor(name,{disableInternetArchive:true,disableCucsh:true,crossrefSearchImpl:async()=>[...good,...bad]});
 assert.equal(result.status,"resolved");
 assert.equal(result.author.wikidataId,"Q366123");
 assert.equal(result.author.orcid,null);
 assert.equal(result.works.length,2);
 assert.equal(portraitIdentity(result.author,result.works).qid,"Q366123");
 assert.ok(matchesPortraitIdentity(human("Q366123"),portraitIdentity(result.author,result.works)));
});

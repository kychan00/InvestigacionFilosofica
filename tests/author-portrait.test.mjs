import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import { portraitIdentity, matchesPortraitIdentity, commonsPortrait, resolveAuthorPortrait, downloadPortrait, PORTRAIT_MAX_BYTES } from "../src/core/author-portrait-policy.js";
import { createAuthorPortraitSession } from "../js/author-portrait-session.js";
const claim=value=>({rank:"normal",mainsnak:{snaktype:"value",datavalue:{value}}});
const id="0000-0002-1825-0097";
const human=(extra={})=>({id:"Q123",claims:{P31:[claim({id:"Q5"})],P496:[claim(id)],P18:[claim("Test.jpg")],...extra}});
const file=(extra={})=>({title:"File:Test.jpg",imageinfo:[{thumburl:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Test.jpg/320px-Test.jpg",thumbwidth:320,thumbheight:400,mime:"image/jpeg",thumbmime:"image/jpeg",extmetadata:{LicenseShortName:{value:"CC BY-SA 4.0"},Artist:{value:"<b>Photographer</b>"},...extra}}]});
test("SIVA identity: no name-only or invalid ORCID; exact public identifiers",()=>{
 assert.equal(portraitIdentity({displayName:"Jane Doe"}),null);
 assert.equal(portraitIdentity({orcid:"0000-0002-1825-0098"}),null);
 assert.equal(portraitIdentity({id:"42",catalog:"federated"}),null);
 const ident=portraitIdentity({orcid:id,wikidataId:"Q123"});
 assert.ok(matchesPortraitIdentity(human(),ident));
 assert.ok(!matchesPortraitIdentity(human({P496:[claim("0000-0001-5109-3700")]}),ident));
 assert.ok(!matchesPortraitIdentity(human({P31:[claim({id:"Q43229"})]}),ident));
 assert.ok(!matchesPortraitIdentity({...human(),id:"Q124"},ident));
 assert.ok(!matchesPortraitIdentity(human({P496:[]}),ident));
 const oa=portraitIdentity({id:"123456"});assert.ok(matchesPortraitIdentity(human({P496:[],P10283:[claim("a123456")]}),oa));
 const historical=portraitIdentity({wikidataId:"Q9312",sourceDisplayName:"Immanuel Kant",id:"123456"});
 assert.ok(matchesPortraitIdentity({id:"Q9312",claims:{P31:[claim({id:"Q5"})]}},historical));
 assert.ok(!matchesPortraitIdentity({id:"Q9312",claims:{P31:[claim({id:"Q5"})],P10283:[claim("A999")]}},historical));
 assert.equal(portraitIdentity({wikidataId:"Q9312",displayName:"Other Kant"}),null);
});
test("Commons licenses reject unknown, NC, ND, no attribution, restrictions, oversize and arbitrary hosts",()=>{
 const meta=commonsPortrait(file(),"Q123");assert.equal(meta.credit,"Photographer");assert.equal(meta.license.label,"CC BY-SA 4.0");
 for(const value of ["CC BY-NC 4.0","CC BY-ND 4.0","Fair use","", "Copyrighted"])assert.equal(commonsPortrait(file({LicenseShortName:{value}}),"Q123"),null);
 assert.equal(commonsPortrait(file({Artist:{value:""}}),"Q123"),null);
 assert.equal(commonsPortrait(file({Restrictions:{value:"personality rights"}}),"Q123"),null);
 for(const value of ["CC0","Public domain","CC BY 3.0"])assert.ok(commonsPortrait(file({LicenseShortName:{value}}),"Q123"));
 const bad=file();bad.imageinfo[0].thumbwidth=900;assert.equal(commonsPortrait(bad,"Q123"),null);
 const badHost=file();badHost.imageinfo[0].thumburl="https://example.org/x.jpg";assert.equal(commonsPortrait(badHost,"Q123"),null);
});
test("ORCID bridge verifies statements, does not search names, rejects ambiguity",async()=>{
 const ident=portraitIdentity({orcid:id,displayName:"Never sent"});
 const seen=[];const fetcher=async(url,opts)=>{seen.push(url);assert.equal(opts.cache,"no-store");assert.equal(opts.credentials,"omit");
 const p=new URL(url).searchParams;assert.ok(!url.includes("Never"));
 return Response.json(p.get("list")==="search"?{query:{search:[{title:"Q123"}]}}:p.get("action")==="wbgetentities"?{entities:{Q123:human()}}:{query:{pages:{"1":file()}}});};
 assert.equal((await resolveAuthorPortrait(ident,{fetcher})).credit,"Photographer");assert.equal(seen.length,3);
 assert.ok(new URL(seen[0]).searchParams.get("srsearch").includes("P496="+id));
 assert.equal(await resolveAuthorPortrait(ident,{fetcher:async()=>Response.json({query:{search:[{title:"Q123"},{title:"Q124"}]}})}),null);
});
test("download has strict streaming budget, no persistent cache",async()=>{
 const meta=commonsPortrait(file(),"Q123");
 const b=await downloadPortrait(meta,{fetcher:async(url,opts)=>{assert.equal(opts.cache,"no-store");return new Response(new Uint8Array(50),{headers:{"content-type":"image/jpeg"}});}});
 assert.equal(b.size,50);
 await assert.rejects(downloadPortrait(meta,{fetcher:async()=>new Response(new Uint8Array(PORTRAIT_MAX_BYTES+1),{headers:{"content-type":"image/jpeg"}})}),/budget/);
 await assert.rejects(downloadPortrait(meta,{fetcher:async()=>new Response("bad",{headers:{"content-type":"text/html"}})}),/policy/);
});
test("session reuses one image while author is open and aborts/revokes on exit",async()=>{
 const revoked=[];let creates=0,requests=0,signal;
 const manager=createAuthorPortraitSession({resolve:async(i,o)=>{requests++;signal=o.signal;return {url:"https://example.test",width:10,height:10};},
 download:async()=>new Blob(["x"]),createURL:()=>("blob:"+ ++creates),revokeURL:x=>revoked.push(x),decode:async()=>({width:10,height:10})});
 const slot={isConnected:false,querySelector:()=>null,removeAttribute(){}};
 await manager.open({orcid:id},slot);await manager.open({orcid:id},slot);
 assert.equal(requests,1);assert.equal(creates,1);
 manager.close();assert.equal(signal.aborted,true);assert.deepEqual(revoked,["blob:1"]);
 await manager.open({orcid:id},slot);manager.close();assert.deepEqual(revoked,["blob:1","blob:2"]);
});
test("late decode is revoked after author close; no stale image",async()=>{
 let finish;const revoked=[];let started;
 const ready=new Promise(r=>started=r);
 const manager=createAuthorPortraitSession({resolve:async()=>({}),download:async()=>new Blob(["x"]),createURL:()=>"blob:late",revokeURL:x=>revoked.push(x),
 decode:()=>{started();return new Promise(r=>finish=r);}});
 const task=manager.open({orcid:id},{isConnected:false,querySelector:()=>null,removeAttribute(){}});
 await ready;manager.close();assert.deepEqual(revoked,["blob:late"],"release before pending decode settles");finish({width:10,height:10});await task;assert.deepEqual(revoked,["blob:late"]);
});
test("app integration closes portrait at all three author exits and pagehide",async()=>{
 const app=await readFile(new URL("../js/app.js",import.meta.url),"utf8");
 assert.match(app,/authorPortraitSession\.open\(currentResponse\.authorResolution\?\.author/);
 assert.equal((app.match(/authorPortraitSession\.close\(\);\s*document\.body\.classList\.remove\(\s*"author-view"/g)||[]).length,3);
 assert.match(app,/addEventListener\("pagehide", \(\) => authorPortraitSession\.close\(\)\)/);
});

test("timeout cancels and frees the pending URL immediately, without restarting on a rerender",async()=>{
 let finish,requests=0,signal;const revoked=[];
 const manager=createAuthorPortraitSession({timeoutMs:15,resolve:async(_,o)=>{requests++;signal=o.signal;return {};},download:async()=>new Blob(["x"]),createURL:()=>"blob:timeout",revokeURL:x=>revoked.push(x),decode:()=>new Promise(r=>finish=r)});
 const slot={isConnected:false,querySelector:()=>null,removeAttribute(){}};
 const task=manager.open({orcid:id},slot);
 await new Promise(r=>setTimeout(r,40));
 assert.equal(signal.aborted,true);assert.deepEqual(revoked,["blob:timeout"]);
 const repeated=manager.open({orcid:id},slot);assert.equal(requests,1);
 finish({width:10,height:10});await Promise.all([task,repeated]);manager.close();
 assert.deepEqual(revoked,["blob:timeout"]);
});


test("accept real Commons thumbnail CDN while enforcing exact host, path, HTTPS and byte limits",async()=>{
 const actual="https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cc/Jakob_Schlesinger_-_Hegel_1831.jpg/330px-Jakob_Schlesinger_-_Hegel_1831.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail";
 const fixture=file({LicenseShortName:{value:"Public domain"}});
 fixture.imageinfo[0].thumburl=actual;
 const meta=commonsPortrait(fixture,"Q9235");
 assert.equal(meta.url,actual);
 assert.equal(meta.license.label,"Dominio público");
 let fetched=false;
 await downloadPortrait(meta,{fetcher:async(url,opts)=>{fetched=true;assert.equal(url,actual);assert.equal(opts.redirect,"error");assert.equal(opts.cache,"no-store");return new Response(new Uint8Array(3),{headers:{"content-type":"image/jpeg"}});}});
 assert.ok(fetched);
 for(const bad of [actual.replace("thumb.wikimedia.org","thumb.wikimedia.org.evil.test"),actual.replace("https:","http:"),actual.replace("/commons/thumb/","/en/thumb/"),actual.replace("thumb.wikimedia.org","evil@thumb.wikimedia.org"),actual.replace("thumb.wikimedia.org","thumb.wikimedia.org:8443"),actual.replace("/commons/thumb/","/commons/")]){
  fixture.imageinfo[0].thumburl=bad;
  assert.equal(commonsPortrait(fixture,"Q9235"),null,bad);
  await assert.rejects(downloadPortrait({url:bad},{fetcher:async()=>{throw Error("must not fetch");}}),/host outside/);
 }
});

test("historical corpus fallback resolves Hegel without Wikidata profile, but not unknown or contradictory identities",async()=>{
 const author={id:"123456",displayName:"Georg Wilhelm Friedrich Hegel",sourceDisplayName:"Hegel, Georg Wilhelm Friedrich"};
 const ident=portraitIdentity(author);
 assert.equal(ident.qid,"Q9235");
 assert.equal(ident.historical,true);
 const seen=[];
 const portrait=await resolveAuthorPortrait(ident,{fetcher:async url=>{
  const p=new URL(url).searchParams;seen.push(p);
  return Response.json(p.get("action")==="wbgetentities"
    ? {entities:{Q9235:{id:"Q9235",claims:{P31:[claim({id:"Q5"})],P18:[claim("Test.jpg")]}}}}
    : {query:{pages:{"1":file({LicenseShortName:{value:"Public domain"}})}}});
 }});
 assert.ok(portrait);
 assert.equal(portrait.identity,"https://www.wikidata.org/wiki/Q9235");
 assert.equal(seen[0].get("ids"),"Q9235");
 assert.equal(seen.length,2,"Use reviewed QID, no name lookup");
 for(const variant of [
   {...author,id:undefined},
   {...author,displayName:"Hegel"},
   {...author,sourceDisplayName:"Other Hegel"},
   {...author,catalog:"federated"},
   {...author,orcid:"0000-0002-1825-0097"},
   {...author,wikidataId:"Q123"},
   {id:"123456",displayName:"Socrates"}
 ])assert.notEqual(portraitIdentity(variant)?.qid,"Q9235");
 assert.equal(portraitIdentity({id:"123456",displayName:"Socrates"}).qid,null);
 assert.ok(!matchesPortraitIdentity({id:"Q9235",claims:{P31:[claim({id:"Q5"})],P10283:[claim("A999")]}},ident));
});

test("Adorno resolves without a linked Wikidata profile, keeping the Commons license",async()=>{
 const ident=portraitIdentity({id:"123456",displayName:"Theodor W. Adorno",sourceDisplayName:"Adorno, Theodor W."});
 assert.equal(ident.qid,"Q152388");
 const portrait=await resolveAuthorPortrait(ident,{fetcher:async url=>{
  const p=new URL(url).searchParams;
  return Response.json(p.get("action")==="wbgetentities"
   ? {entities:{Q152388:{id:"Q152388",claims:{P31:[claim({id:"Q5"})],P18:[claim("Test.jpg")]}}}}
   : {query:{pages:{"1":file({LicenseShortName:{value:"CC BY-SA 3.0"}})}}});
 }});
 assert.equal(portrait.license.label,"CC BY-SA 3.0");
});
test("unlisted author requires independent works evidence, not just a matching name",async()=>{
 const author={id:"456",displayName:"Example Philosopher"};
 const works=[{title:"The ethics of evidence",authors:[{id:"A456",name:author.displayName}]},
  {title:"Knowledge and interpretation",authors:[{id:"A456",name:author.displayName}]}];
 const person=(id,refs)=>({id,labels:{en:{value:author.displayName}},claims:{P31:[claim({id:"Q5"})],
  P800:refs.map(id=>claim({id})),P18:[claim("Test.jpg")]}});
 const work=(id,title,owner)=>({id,labels:{en:{value:title}},claims:{P50:[claim({id:owner})]}});
 const makeFetcher=({ambiguous=false,unrelated=false,truncate=false}={})=>async(url)=>{
  const p=new URL(url).searchParams;
  if(p.get("list")==="search")return Response.json({query:{search:[]}});
  if(p.get("action")==="wbsearchentities")return Response.json({search:[{id:"Q101"},{id:"Q102"}],...(truncate?{"search-continue":5}:{})});
  if(p.get("action")==="wbgetentities"){
   if(p.get("ids")==="Q101|Q102")return Response.json({entities:{Q101:person("Q101",["Q201","Q202"]),Q102:person("Q102",["Q203","Q204"])}});
   return Response.json({entities:{
    Q201:work("Q201",works[0].title,unrelated?"Q999":"Q101"),
    Q202:work("Q202",works[1].title,"Q101"),
    Q203:work("Q203",ambiguous?works[0].title:"Other work about philosophy","Q102"),
    Q204:work("Q204",ambiguous?works[1].title:"Another unrelated book","Q102")
   }});
  }
  return Response.json({query:{pages:{"1":file()}}});
 };
 const identity=portraitIdentity(author,works);
 assert.equal(identity.canDiscover,true);
 assert.equal((await resolveAuthorPortrait(identity,{fetcher:makeFetcher()})).identity,"https://www.wikidata.org/wiki/Q101");
 for(const opts of [{ambiguous:true},{unrelated:true},{truncate:true}])
  assert.equal(await resolveAuthorPortrait(identity,{fetcher:makeFetcher(opts)}),null);
 assert.equal(await resolveAuthorPortrait(portraitIdentity(author,works.slice(0,1)),{fetcher:makeFetcher()}),null);
 assert.equal(portraitIdentity(author,works.map(w=>({...w,authors:[{id:"A999",name:author.displayName}]}))).canDiscover,false);
});
test("multiple images of verified person may fall through to a compatible licensed file",async()=>{
 const person=human({P18:[claim("Restricted.jpg"),claim("Test.jpg")]});
 const denied=file({LicenseShortName:{value:"CC BY-NC 4.0"}});denied.title="File:Restricted.jpg";
 const portrait=await resolveAuthorPortrait(portraitIdentity({orcid:id,wikidataId:"Q123"}),{fetcher:async url=>{
  const p=new URL(url).searchParams;
  return Response.json(p.get("action")==="wbgetentities"?{entities:{Q123:person}}:{query:{pages:{"1":denied,"2":file()}}});
 }});
 assert.equal(portrait.title,"Test.jpg");
});

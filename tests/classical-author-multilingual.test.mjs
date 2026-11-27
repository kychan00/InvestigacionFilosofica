import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {classicalAuthority,localizeClassicalAuthor,classicalCreatorAlias} from "../src/core/classical-author-aliases.js";
import {portraitIdentity} from "../src/core/author-portrait-policy.js";
import {resolveFederatedAuthor} from "../src/core/crossref-author-fallback.js";
import {matchFederatedWork} from "../src/core/author-federated-matching.js";
import {buildInternetArchiveSearchUrl} from "../src/sources/internet-archive.js";
import {authorBucket,authorNameSignature,findSnapshotAuthorCandidates,resolveRemoteAuthorCandidate} from "../src/core/remote-author-resolution.js";

test("Plato Plato retains the source ID but displays Platón and both retrieval names",()=>{
 const original={id:"123",displayName:"Plato Plato",sourceDisplayName:"Plato Plato"};
 const localized=localizeClassicalAuthor(original);
 assert.equal(localized.displayName,"Platón");
 assert.equal(localized.sourceDisplayName,"Plato Plato");
 assert.equal(localized.id,original.id);
 assert.deepEqual(localized.aliases,["Platón","Plato"]);
 assert.equal(localized.wikidataId,"Q859");
 assert.equal(portraitIdentity(localized).qid,"Q859");
 assert.equal(classicalAuthority("Plato") ,classicalAuthority("Platón"));
 assert.equal(classicalAuthority("Plato Smith"),null);
 assert.equal(localizeClassicalAuthor({...original,orcid:"0000-0002-1825-0097"}).displayName,"Plato Plato");
 assert.equal(localizeClassicalAuthor({...original,wikidataId:"Q999"}).displayName,"Plato Plato");
 assert.equal(localizeClassicalAuthor({displayName:"Plato"}).wikidataId,undefined);
});
test("snapshot lookup checks both linguistic alias partitions without merging distinct IDs",async()=>{
 const requests=[];
 const sig=authorNameSignature("Plato");
 const row={s:sig,id:123,n:"Plato Plato",o:null,cw:200,k:"full"};
 const result=await findSnapshotAuthorCandidates("Platón",{
  indexBase:new URL("https://example.test/index/"),
  fetchImpl:async(url)=>{
    const path=new URL(url).pathname;requests.push(path);
    const body=path.endsWith("/"+String(authorBucket(sig)).padStart(4,"0")+".jsonl")?JSON.stringify(row)+"\n":"";
    return new Response(body,{status:200});
  }
 });
 assert.equal(result.length,1);
 assert.equal(String(result[0].id),"123");
 assert.ok(requests.some(path=>path.endsWith("/"+String(authorBucket(authorNameSignature("Platón"))).padStart(4,"0")+".jsonl")));
 assert.ok(requests.some(path=>path.endsWith("/"+String(authorBucket(sig)).padStart(4,"0")+".jsonl")));
});
const work=(id,title,creator,language)=>({id,title,authors:[{name:creator}],language,year:2001,providers:["Internet Archive"]});
test("Spanish creator variants and ancient dates retain real editions, not mere mentions",()=>{
 assert.equal(classicalCreatorAlias("Plato, 427?-347? B.C.").qid,"Q859");
 assert.ok(matchFederatedWork(work("a","La República","Platón","es"),"Plato"));
 assert.ok(matchFederatedWork(work("b","Fedón","Plato, 427?-347? B.C.","es"),"Platón"));
 assert.equal(matchFederatedWork(work("c","Estudio sobre Platón","Juan Pérez","es"),"Platón"),null);
 assert.equal(matchFederatedWork({...work("d","Un estudio moderno","Plato","es"),authors:[{name:"Plato",orcid:"0000-0002-1825-0097"}]},"Platón"),null);
});
test("Spanish editions are separately retrieved even when unfiltered results are English",async()=>{
 const calls=[];
 const result=await resolveFederatedAuthor("Plato Plato",{
  disableCrossref:true,disableCucsh:true,
  archiveSearchImpl:async({query},options)=>{
    calls.push({query,language:options.language});
    return options.language==="es"
      ? [work("es1","La República","Platón","es"),work("es2","El banquete","Plato, 427?-347? B.C.","es"),work("noise","Sobre Platón","Otra persona","es")]
      : [work("en1","The Republic","Plato","en")];
  }
 });
 assert.equal(result.status,"resolved");
 assert.equal(result.author.displayName,"Platón");
 assert.ok(calls.some(x=>x.query==="Plato"&&x.language==="es"));
 assert.ok(calls.some(x=>x.query==="Platón"&&x.language==="es"));
 assert.deepEqual(new Set(result.works.map(x=>x.title)),new Set(["La República","El banquete","The Republic"]));
 assert.deepEqual(new Set(result.works.map(x=>x.language)),new Set(["es","en"]));
});
test("Archive language filter is creator-scoped and leaves general queries unchanged",()=>{
 const url=buildInternetArchiveSearchUrl("Plato",{queryType:"author",language:"es"});
 const query=url.searchParams.get("q");
 assert.match(query,/creator:\(Plato\)/);
 assert.match(query,/language:spa/);
 assert.doesNotMatch(buildInternetArchiveSearchUrl("Plato",{queryType:"author"}).searchParams.get("q"),/language:/);
});
test("author page language controls are connected to state and work filtering",async()=>{
 const source=await readFile(new URL("../js/app.js",import.meta.url),"utf8");
 assert.match(source,/data-author-work-language/);
 assert.match(source,/authorWorkBrowserState\.language=button\.dataset\.authorWorkLanguage/);
 assert.match(source,/item\?\.language \|\| "und"\) !== authorWorkBrowserState\.language/);
});

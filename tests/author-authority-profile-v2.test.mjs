import test from "node:test";
import assert from "node:assert/strict";
import {authorityPreviewRevision,authorityPreviewExitUrl,AUTHORITY_PREVIEW_MODE,projectAuthorityProfile,PROFILE_PREVIEW_REVISION,buildAuthorityArchiveView,summarizeAuthorityAuthorship,authorityArchiveLabel,projectIdentityState} from "../src/core/author-authority-profile-v2.js";
const row=(id,status,extra={})=>({record:{provider:"Crossref",sourceId:id,title:"Title "+id,year:2020,...extra},contributions:[{decision:{scope:"contribution",status},role:"author"}]});
test("preview is explicit and disabled by default",()=>{
 assert.equal(authorityPreviewRevision(""),null);
 assert.equal(authorityPreviewRevision("?authorityPreview=true"),null);
 assert.ok(["opt-in","disabled"].includes(AUTHORITY_PREVIEW_MODE));
 assert.equal(authorityPreviewRevision("?authorityPreview=1","opt-in"),PROFILE_PREVIEW_REVISION);
 for(const value of ["?authorityPreview=1&authorityPreview=0","?authorityPreview=1&authorityPreview=1","?authorityPreview=0&authorityPreview=1","?authorityPreview=01"]){
  assert.equal(authorityPreviewRevision(value,"opt-in"),null);
 }
 for(const mode of ["disabled","default-on","production",null]){
  assert.equal(authorityPreviewRevision("?authorityPreview=1",mode),null);
 }
});
test("preview exit preserves author identity, unrelated parameters, and location anchor",()=>{
 const input="https://example.org/InvestigacionFilosofica/?view=author&author=Kant&authorId=123&authorityPreview=1&theme=dark#results";
 const exit=new URL(authorityPreviewExitUrl(input));
 assert.equal(exit.origin,"https://example.org");
 assert.equal(exit.pathname,"/InvestigacionFilosofica/");
 assert.equal(exit.searchParams.get("view"),"author");
 assert.equal(exit.searchParams.get("author"),"Kant");
 assert.equal(exit.searchParams.get("authorId"),"123");
 assert.equal(exit.searchParams.get("theme"),"dark");
 assert.equal(exit.hash,"#results");
 assert.equal(exit.searchParams.has("authorityPreview"),false);
 assert.equal(authorityPreviewRevision(exit.search,"opt-in"),null);
});
test("work grouping uses identifiers not titles, and preserves conflicting source decisions",()=>{
 const a=row("1","probable",{doi:"10.1234/test",title:"Same"});
 const b=row("2","rejected",{provider:"Internet Archive",doi:"10.1234/TEST",title:"Same"});
 const c=row("3","unresolved",{title:"Same"});
 const before=structuredClone([a,b,c]);
 const result=projectAuthorityProfile({rows:[a,b,c]});
 assert.equal(result.works.length,2);assert.equal(result.counts.ambiguous,1);
 assert.equal(result.counts.unresolved,1);assert.equal(result.mentions,3);
 assert.deepEqual([a,b,c],before);
});
test("no identity decision or missing metadata becomes a confirmed contribution",()=>{
 const a=row("1","confirmed");a.contributions[0].decision.scope="identity";
 const b=row("2","probable");b.contributions=[];
 const result=projectAuthorityProfile({rows:[a,b,{record:null}],diagnostics:[{reason:"capture-failed"}]});
 assert.equal(result.counts.confirmed,0);assert.equal(result.counts.unresolved,2);
 assert.equal(result.missingRecords,2);assert.equal(result.diagnostics.length,1);
});
test("different memberships of one source work do not inflate work counts",()=>{
 const a=row("1","probable"),b=row("1","unresolved");
 const result=projectAuthorityProfile({rows:[a,b]});
 assert.equal(result.works.length,1);assert.equal(result.counts.probable,1);assert.equal(result.mentions,2);
});

test("archive links require exact identifiers and preserve the original record object",()=>{
 const records=[row("https://openalex.org/W42","probable",{provider:"OpenAlex Philosophy"}),row("x","rejected",{doi:"10.1234/example"}),row("z","confirmed",{title:"Shared title"})];
 const exact={id:"W42",providers:["OpenAlex Philosophy · Hugging Face"]};
 const doi={id:"random",doi:"https://doi.org/10.1234/EXAMPLE"};
 const title={id:"not-z",title:"Shared title",providers:["Crossref"]};
 const before=structuredClone([exact,doi,title]);
 const model=buildAuthorityArchiveView({rows:records},[exact,doi,title]);
 assert.equal(model.byWork.get(exact).status,"probable");
 assert.equal(model.byWork.get(doi).status,"rejected");
 assert.equal(model.byWork.get(title).linked,false);
 assert.equal(model.byGroup.get(model.byWork.get(exact).groupKey).work,exact);
 assert.match(authorityArchiveLabel(model.byWork.get(doi)),/Rechazada/);
 assert.deepEqual([exact,doi,title],before);
});
test("competing exact groups or multiple legacy copies do not become links",()=>{
 const rows=[row("x","probable",{doi:"10.1234/a"}),row("y","confirmed")];
 const conflict={doi:"10.1234/a",sourceRecords:[{provider:"Crossref",sourceId:"y"}]};
 const duplicate1={doi:"10.1234/a"},duplicate2={doi:"10.1234/a"};
 const view=buildAuthorityArchiveView({rows},[conflict,duplicate1,duplicate2]);
 assert.equal(view.byGroup.size,0);
 for(const work of [conflict,duplicate1,duplicate2])assert.equal(view.byWork.get(work).status,"ambiguous");
});
test("authorship counts and chronology exclude rejected, ambiguous and nonauthor roles",()=>{
 const rows=[row("one","confirmed",{year:-300}),row("two","probable",{year:2000}),row("three","rejected",{year:1627}),row("four","ambiguous",{year:2001}),row("five","confirmed",{year:2002}),row("six","unresolved",{year:2003}),row("seven","probable",{year:2004,doi:"10.1234/7"}),row("eight","probable",{year:2005,doi:"10.1234/7"})];
 rows[4].contributions[0].role="translator";
 const model=summarizeAuthorityAuthorship(projectAuthorityProfile({rows}).works);
 assert.deepEqual(model.counts,{confirmed:1,probable:2,review:2,otherRoles:1,rejected:1});
 assert.deepEqual(model.years,[{year:-300,confirmed:1,probable:0},{year:2000,confirmed:0,probable:1}]);
 assert.deepEqual(model.undated,{confirmed:0,probable:1});
 assert.deepEqual(model.collaborators,[]);
});
test("coauthor candidates use only identified creators in a confirmed original authorship",()=>{
 const a=row("1","confirmed",{rawCreators:[{name:"Target"},{name:"Observed",orcid:"0000-0002-1825-0097"},{name:"Namesake"},{name:"Translator",orcid:"0000-0001-5109-3700",role:"translator"}]});
 a.contributions[0].position=0;
 const b=structuredClone(a);b.record.sourceId="2";b.contributions[0].decision.status="probable";
 const c=structuredClone(a);c.record.sourceId="3";c.contributions[0].synthesizedCreator=true;
 const result=summarizeAuthorityAuthorship(projectAuthorityProfile({rows:[a,b,c]}).works);
 assert.deepEqual(result.collaborators,[{key:"orcid:0000-0002-1825-0097",name:"Observed",count:1}]);
});

test("identity state is never inferred from confirmed contributions",()=>{
 assert.equal(projectIdentityState({scope:"contribution",status:"confirmed"}),"unresolved");
 assert.equal(projectIdentityState(null),"unresolved");
 assert.equal(projectIdentityState({scope:"identity",status:"ambiguous"}),"ambiguous");
});

test("same-role material conflict is reviewable; irrelevant coauthor and other role do not negate author evidence",()=>{
 const a=row("x","probable",{doi:"10.1234/x"});
 const b=row("y","unresolved",{doi:"10.1234/x"});
 b.contributions[0].identifierConflict=true;b.contributions[0].relevant=true;
 assert.equal(projectAuthorityProfile({rows:[a,b]}).works[0].status,"ambiguous");
 b.contributions[0].role="translator";
 assert.equal(projectAuthorityProfile({rows:[a,b]}).works[0].status,"probable");
 b.contributions[0].role="author";b.contributions[0].relevant=false;
 assert.equal(projectAuthorityProfile({rows:[a,b]}).works[0].status,"probable");
});

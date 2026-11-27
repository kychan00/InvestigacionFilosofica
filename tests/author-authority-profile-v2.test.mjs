import test from "node:test";
import assert from "node:assert/strict";
import {authorityPreviewRevision,projectAuthorityProfile,PROFILE_PREVIEW_REVISION} from "../src/core/author-authority-profile-v2.js";
const row=(id,status,extra={})=>({record:{provider:"Crossref",sourceId:id,title:"Title "+id,year:2020,...extra},contributions:[{decision:{scope:"contribution",status},role:"author"}]});
test("preview is explicit and disabled by default",()=>{
 assert.equal(authorityPreviewRevision(""),null);
 assert.equal(authorityPreviewRevision("?authorityPreview=true"),null);
 assert.equal(authorityPreviewRevision("?authorityPreview=1"),PROFILE_PREVIEW_REVISION);
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

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {renderPublicHistory} from "../scripts/build-author-history-public-v1.mjs";
import {publicHistoryEvidence} from "../src/core/author-history-public-v1.js";
import {intellectualHistory,intellectualHistoryAuthorities} from "../src/core/author-intellectual-history.js";
const ledger=JSON.parse(readFileSync(new URL("../docs/data/author-history-evidence-ledger-v1.json",import.meta.url),"utf8"));
test("public projection is regenerated exactly and excludes non-direct evidence",()=>{
 assert.equal(readFileSync(new URL("../src/core/author-history-public-v1.js",import.meta.url),"utf8"),renderPublicHistory(ledger));
 const {entries,urls}=publicHistoryEvidence;
 assert.equal(Object.keys(entries).length,199);
 assert.equal(new Set(urls).size,urls.length);
 for(const url of urls){const u=new URL(url);assert.equal(u.protocol,"https:");assert.ok(!u.username&&!u.password);}
 let count=0,notes=0;
 for(const row of ledger.entries){
  const entry=entries[row.id];assert.ok(entry,row.id);
  assert.deepEqual(Object.keys(entry).sort(),row.editorialNote?["note","sources"]:["sources"]);
  assert.equal(entry.note,row.editorialNote);
  if(entry.note)notes++;
  assert.deepEqual(entry.sources.map(([i,locator])=>({url:urls[i],locator})),row.evidence.filter(e=>e.access==="direct").map(({url,locator})=>({url,locator})),row.id);
  count+=entry.sources.length;
 }
 assert.equal(count,ledger.consolidation.referenceAccessSummary.direct);
 assert.equal(notes,ledger.consolidation.editorialNoteCount);
 for(const {id,name} of intellectualHistoryAuthorities())for(const e of intellectualHistory({wikidataId:id,displayName:name}).events)assert.ok(entries[e.id]);
});
test("projection rejects pending publication corrections and missing direct evidence",()=>{
 assert.throws(()=>renderPublicHistory({entries:[{...ledger.entries[0],publicationReview:{status:"correction-required"}}]}),/Unresolved/);
 assert.throws(()=>renderPublicHistory({entries:[{...ledger.entries[0],evidence:[{url:"https://example.com",locator:"index",access:"indexed"}]}]}),/No direct/);
});

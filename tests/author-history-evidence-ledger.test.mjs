import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {intellectualHistory,intellectualHistoryAuthorities} from "../src/core/author-intellectual-history.js";
const ledger=JSON.parse(readFileSync(new URL("../docs/data/author-history-evidence-ledger-v1.json",import.meta.url),"utf8"));
test("editorial evidence ledger covers every current milestone without stale or fabricated review claims",()=>{
 const current=intellectualHistoryAuthorities().flatMap(a=>intellectualHistory({wikidataId:a.id,displayName:a.name}).events.map(e=>({...e,qid:a.id,author:a.name})));
 assert.equal(ledger.schemaVersion,1);
 assert.equal(ledger.entries.length,current.length);
 const map=new Map(ledger.entries.map(r=>[r.id,r]));
 assert.equal(map.size,current.length);
 for(const e of current){
  const row=map.get(e.id);assert.ok(row,e.id);
  for(const key of ["qid","author","year","date","type","title"])assert.equal(row[key],e[key],e.id+" stale "+key);
  assert.ok(["contrasted","pending"].includes(row.status));
  if(row.status==="contrasted"){
   assert.match(row.reviewedOn,/^\d{4}-\d{2}-\d{2}$/);
   assert.ok(row.evidence.length);
   for(const ev of row.evidence){assert.equal(new URL(ev.url).protocol,"https:");assert.ok(ev.locator.trim());}
  }else{assert.equal(row.evidence,undefined);assert.equal(row.reviewedOn,undefined);}
 }
 assert.equal(ledger.entries.filter(x=>x.status==="contrasted").length,199);
 for(const [qid,count] of [["Q43216",3],["Q4604",4],["Q171195",2],["Q8018",7],["Q8011",5],["Q39837",4],["Q127398",5],["Q9438",8],["Q9191",7],["Q9358",9],["Q7197",8],["Q60025",9],["Q60028",6],["Q33760",8],["Q235134",7]]){
  const rows=ledger.entries.filter(x=>x.qid===qid);
  assert.equal(rows.length,count);assert.ok(rows.every(x=>x.status==="contrasted"));
 }
});

test("disputed medieval date ranges retain contrasting sources",()=>{
 const map=new Map(ledger.entries.map(e=>[e.id,e]));
 for(const id of ["Q8018-4","Q8018-5","Q8011-0"])assert.ok(map.get(id).evidence.length>=2,id);
 assert.match(map.get("Q39837-2").evidence[0].locator,/reinado/);
});

test("modern chronology records distinct editions and source access limitations",()=>{
 const map=new Map(ledger.entries.map(e=>[e.id,e]));
 assert.equal(map.get("Q60025-8").type,"posthumous");
 assert.match(map.get("Q60028-4").evidence[0].locator,/1893 y 1903/);
 assert.match(map.get("Q33760-5").evidence[0].locator,/1910, 1912 y 1913/);
 assert.ok(map.get("Q235134-3").evidence.some(e=>e.locator.includes("mantenimiento")));
});

test("consolidation preserves evidence levels and 30 authority page title checks",()=>{
 assert.equal(ledger.authorityChecks.length,30);
 const names=new Map(intellectualHistoryAuthorities().map(a=>[a.id,a.name]));
 assert.equal(new Set(ledger.authorityChecks.map(a=>a.qid)).size,30);
 for(const a of ledger.authorityChecks){
  assert.equal(a.author,names.get(a.qid));assert.equal(a.url,"https://www.wikidata.org/wiki/"+a.qid);assert.ok(a.observedPageTitle.trim());assert.equal(a.scope,"page-title-match");
 }
 const counts={"direct-recorded":0,"legacy-unclassified":0,"indexed-only":0};
 for(const row of ledger.entries){
  assert.equal(row.status,"contrasted");assert.ok(row.evidence.length);
  for(const s of row.evidence)assert.ok(["direct","indexed","legacy-unclassified"].includes(s.access),row.id);
  const expected=row.evidence.some(s=>s.access==="direct")?"direct-recorded":row.evidence.some(s=>s.access==="legacy-unclassified")?"legacy-unclassified":"indexed-only";
  assert.equal(row.accessLevel,expected);counts[expected]++;
 }
 assert.deepEqual(counts,ledger.accessSummary);
 const map=new Map(ledger.entries.map(e=>[e.id,e]));
 for(const id of ["Q473518-2","Q601364-9"]){assert.ok(map.get(id).previousReviewIssue);assert.ok(map.get(id).resolution);assert.equal(map.get(id).accessLevel,"direct-recorded");}
 assert.match(map.get("Q473518-2").evidence[0].url,/clacso/);
});

test("editorial consolidation reconciles reference access, notes and publication blockers",()=>{
 const c=ledger.consolidation;
 assert.match(c.reviewedOn,/^\d{4}-\d{2}-\d{2}$/);
 assert.ok(c.scope.trim());
 const counts={direct:0,indexed:0,"legacy-unclassified":0};
 const residualUrls=new Set();
 const corrections=[];
 let noteCount=0;
 for(const row of ledger.entries){
  assert.ok(row.evidence.some(e=>e.access==="direct"),row.id);
  if(row.editorialNote){assert.ok(row.editorialNote.trim());noteCount++;}
  if(row.publicationReview?.status==="correction-required"){
   corrections.push(row.id);
   assert.ok(row.publicationReview.reason.trim());
   assert.ok(Number.isInteger(row.publicationReview.proposed.year));
   assert.ok(row.publicationReview.proposed.date.trim());
   assert.ok(row.publicationReview.proposed.title.trim());
  }
  for(const e of row.evidence){
   assert.ok(Object.hasOwn(counts,e.access),row.id);
   counts[e.access]++;
   if(e.access!=="direct"){
    residualUrls.add(e.url);
    assert.match(e.lastAccessAttempt.date,/^\d{4}-\d{2}-\d{2}$/);
    assert.equal(e.lastAccessAttempt.outcome,"unavailable");
    assert.ok(e.lastAccessAttempt.detail.trim());
   }
  }
 }
 assert.deepEqual(counts,c.referenceAccessSummary);
 assert.equal(residualUrls.size,c.residualUniqueUrls);
 assert.equal(noteCount,c.editorialNoteCount);
 assert.deepEqual(corrections.sort(),[...c.publicationCorrections].sort());
 const arendt=ledger.entries.find(r=>r.id==="Q60025-1");
 assert.match(arendt.editorialNote,/1928/);
 assert.match(arendt.editorialNote,/1929/);
 assert.ok(arendt.evidence.some(e=>e.access==="direct"&&e.url.includes("hannaharendt.net")));
 assert.ok(arendt.publicationReview?.status==="correction-required"||arendt.year===1928);
});

test("Arendt canonical correction preserves the stable milestone and distinguishes publication",()=>{
 const a=ledger.entries.find(r=>r.id==="Q60025-1");
 assert.equal(a.year,1928);
 assert.match(a.date,/1928.*1929/);
 assert.equal(a.publicationReview.status,"corrected");
 assert.equal(a.publicationReview.previous.year,1929);
 assert.deepEqual(ledger.consolidation.publicationCorrections,[]);
 const e=intellectualHistory({wikidataId:"Q60025",displayName:"Hannah Arendt"}).events.find(e=>e.id===a.id);
 assert.equal(e.year,1928);assert.equal(e.date,a.date);
 assert.match(e.source.url,/hannaharendt\.net/);
});

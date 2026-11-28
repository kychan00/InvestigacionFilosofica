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
 assert.equal(ledger.entries.filter(x=>x.status==="contrasted").length,59);
 for(const [qid,count] of [["Q43216",3],["Q4604",4],["Q171195",2],["Q8018",7],["Q8011",5],["Q39837",4],["Q127398",5],["Q9438",8]]){
  const rows=ledger.entries.filter(x=>x.qid===qid);
  assert.equal(rows.length,count);assert.ok(rows.every(x=>x.status==="contrasted"));
 }
});

test("disputed medieval date ranges retain contrasting sources",()=>{
 const map=new Map(ledger.entries.map(e=>[e.id,e]));
 for(const id of ["Q8018-4","Q8018-5","Q8011-0"])assert.ok(map.get(id).evidence.length>=2,id);
 assert.match(map.get("Q39837-2").evidence[0].locator,/reinado/);
});

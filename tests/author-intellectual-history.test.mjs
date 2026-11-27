import test from "node:test";
import assert from "node:assert/strict";
import {intellectualHistory,BIO_TYPES,BIO_BATCH} from "../src/core/author-intellectual-history.js";

test("authority and name must agree; no fallback by name",()=>{
  assert.equal(intellectualHistory({displayName:"Hegel"}),null);
  assert.equal(intellectualHistory({wikidataId:"Q9235",displayName:"Immanuel Kant"}),null);
  assert.equal(intellectualHistory({wikidataId:"Q9235"}),null);
  assert.equal(intellectualHistory({wikidataId:"Q0",displayName:"Hegel"}),null);
  assert.equal(intellectualHistory({wikidataId:"Q859",displayName:"Platon"}).id,"Q859");
});
test("six reviewed profiles have chronological, separately typed and sourced events",()=>{
  for(const [id,name] of [["Q859","Platón"],["Q868","Aristóteles"],["Q9312","Immanuel Kant"],["Q9235","Georg Wilhelm Friedrich Hegel"],["Q183074","Sor Juana Inés de la Cruz"],["Q473518","Enrique Dussel"]]){
    const h=intellectualHistory({wikidataId:id,displayName:name});
    assert.ok(h.events.length>=BIO_BATCH);
    assert.equal(new Set(h.events.map(e=>e.id)).size,h.events.length);
    assert.deepEqual(h.events.map(e=>e.year),h.events.map(e=>e.year).sort((a,b)=>a-b));
    for(const e of h.events){
      assert.ok(BIO_TYPES[e.type]);assert.ok(e.source.name);
      assert.equal(new URL(e.source.url).protocol,"https:");
      assert.ok(e.date&&e.title);
    }
  }
});
test("uncertainty and composition remain explicit, not publication metadata",()=>{
  const p=intellectualHistory({wikidataId:"Q859",displayName:"Platón"});
  assert.match(p.events[0].date,/c\./);
  assert.match(p.events[1].date,/387–383/);
  const s=intellectualHistory({wikidataId:"Q183074",displayName:"Sor Juana Inés de la Cruz"});
  assert.match(s.events[0].date,/1648 o 1651/);
  assert.equal(s.events.find(e=>e.year===1691).type,"composition");
  s.events[0].source.name="changed";
  assert.notEqual(intellectualHistory({wikidataId:"Q183074",displayName:"Sor Juana Inés de la Cruz"}).events[0].source.name,"changed");
});

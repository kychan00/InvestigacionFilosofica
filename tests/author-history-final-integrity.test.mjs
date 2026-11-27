import test from "node:test";
import assert from "node:assert/strict";
import {intellectualHistory,intellectualHistoryAuthorities,BIO_TYPES} from "../src/core/author-intellectual-history.js";
import {timelineHistoryAuthor} from "../src/core/author-timeline-history-identity.js";
import {WORLD_HISTORY_ANCHORS} from "../src/core/world-history-anchors.js";
import {LATAM_HISTORY_ANCHORS} from "../src/core/latin-american-history-anchors.js";

test("all 30 authorities and 199 milestones pass global structural checks",()=>{
 const authorities=intellectualHistoryAuthorities();
 assert.equal(authorities.length,30);
 assert.equal(new Set(authorities.map(a=>a.id)).size,30);
 const eventIds=new Set();let count=0;
 for(const {id,name,aliases} of authorities){
  const h=intellectualHistory({wikidataId:id,displayName:name});
  assert.ok(h?.events?.length,id);
  for(const alias of aliases)assert.equal(intellectualHistory({wikidataId:id,displayName:alias})?.id,id);
  let previous=-Infinity;
  for(const e of h.events){
   assert.ok(Number.isInteger(e.year)&&e.year!==0&&e.year>=previous,e.id);
   previous=e.year;
   assert.ok(e.date.trim()&&e.title.trim()&&BIO_TYPES[e.type],e.id);
   assert.ok(!eventIds.has(e.id),e.id);eventIds.add(e.id);count++;
   for(const s of [e.source,...e.additionalSources]){
    const u=new URL(s.url);
    assert.ok(s.name.trim()&&u.protocol==="https:"&&!u.username&&!u.password,e.id);
   }
   if(e.year<0)assert.match(e.date,/a\. C\./,e.id);
  }
  assert.equal(intellectualHistory({displayName:name}),null);
 }
 assert.equal(count,199);
 const a=authorities[0];a.aliases.length=0;
 assert.ok(intellectualHistoryAuthorities()[0].aliases.length);
});
test("all authorities have documentary anchor configuration with a distinct Confucius rule",()=>{
 const all=[...WORLD_HISTORY_ANCHORS.map(r=>r[0]),...LATAM_HISTORY_ANCHORS.map(r=>r[1]),"Q7197","Q601364","Q4604","Q9235","Q9358"];
 assert.deepEqual([...new Set(all)].sort(),intellectualHistoryAuthorities().map(a=>a.id).sort());
 assert.equal(all.length,30);
 const a={displayName:"Confucio",viafId:"123"};
 const w=[{title:"Analectas",authors:[{name:"Confucio, 551-479 a. C."}]}];
 assert.equal(timelineHistoryAuthor(a,w),a);
 const b={displayName:"Confucio"};
 assert.equal(timelineHistoryAuthor(b,[{title:"Analectas",authors:[{name:"Confucio, 551-479 a. C.",viafId:"123"}]}]),b);
});
test("Hegel first appearance and imprint date are distinct; Dussel has teaching authority",()=>{
 const h=intellectualHistory({wikidataId:"Q9235",displayName:"Hegel"});
 const e=h.events.find(e=>e.title.includes("Principios de la filosofía del derecho"));
 assert.equal(e.year,1820);assert.match(e.date,/1821/);assert.match(e.source.url,/cambridge\.org/);
 const d=intellectualHistory({wikidataId:"Q473518",displayName:"Enrique Dussel"});
 assert.match(d.events.find(e=>e.year===1976).source.url,/colegiodefilosofia\.filos\.unam\.mx/);
});

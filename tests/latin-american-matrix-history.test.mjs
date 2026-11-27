import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {matrixIntellectualHistory} from "../src/core/latin-american-matrix-history.js";
import {latinAmericanHistoryIdentity} from "../src/core/latin-american-history-bridge.js";
const dossier=id=>JSON.parse(readFileSync(new URL("../src/data/philosopher-works/authors/"+String(id).padStart(4,"0")+".json",import.meta.url),"utf8"));
test("real dossiers preserve approximate lives, roles and dossier-wide evidence",()=>{
  const tl=matrixIntellectualHistory(dossier(1));
  assert.equal(tl.events[0].date,"c. 1398");
  assert.equal(tl.events[1].type,"archive-contribution");
  assert.match(tl.events[1].date,/1428–1480/);
  assert.equal(tl.events[1].source,null);
  assert.match(tl.events[1].evidenceScope,/Fuentes generales/);
  assert.equal(matrixIntellectualHistory(dossier(1187)),null);
  const firmin=matrixIntellectualHistory(dossier(380));
  const book=firmin.events.find(e=>e.title.includes("égalité des races"));
  assert.equal(book.type,"archive-publication");
  assert.equal(book.source.url,"https://haitiana.org/fr/oeuvre/haiw-sfdkaehxa");
  assert.equal(matrixIntellectualHistory(dossier(1504)).events[0].date,"1924");
  const ramaglia=matrixIntellectualHistory(dossier(800));
  assert.equal(ramaglia.events[0].type,"archive-record");
  assert.match(ramaglia.events[0].role,/coauthor/);
});
test("no dates inferred from undated contributions, reprints or uncertain identity",()=>{
  const r=dossier(162);
  const h=matrixIntellectualHistory(r);
  assert.equal(h.events.find(e=>e.title.includes("ser irreal")).type,"archive-thesis");
  assert.ok(!h.events.some(e=>e.title==="Irrealidad e idealidad"));
  assert.ok(!h.events.some(e=>e.type==="archive-contribution"));
  const x={...r,life:{},works:[{title:"No",authorship_status:"unverified",first_publication_year:1950},{title:"No date",authorship_status:"verified",edition_history:[{year:1950}]}],non_bibliographic_contributions:[]};
  assert.equal(matrixIntellectualHistory(x),null);
  assert.equal(matrixIntellectualHistory({...r,sources:[]}),null);
  const sor=matrixIntellectualHistory(dossier(19));
  assert.match(sor.events[0].date,/1648 o 1651/);
});
test("full 1504-record audit: stable IDs, safe provenance and no mutation",()=>{
  let covered=0,events=0,linked=0,excluded=0;
  for(let id=1;id<=1504;id++){
    const r=dossier(id),snapshot=JSON.stringify(r);
    if(latinAmericanHistoryIdentity(r)){linked++;continue;}
    const h=matrixIntellectualHistory(r);
    assert.equal(JSON.stringify(r),snapshot);
    if(!h){excluded++;continue;}
    covered++;events+=h.events.length;
    assert.equal(h.id,"latam-"+id);
    assert.equal(new Set(h.events.map(e=>e.id)).size,h.events.length);
    assert.deepEqual(h.events.map(e=>e.year),h.events.map(e=>e.year).sort((a,b)=>a-b));
    for(const e of h.events){assert.ok(e.date&&e.title&&e.evidenceScope&&e.certainty);for(const s of [e.source,...e.additionalSources].filter(Boolean))assert.equal(new URL(s.url).protocol,"https:");}
  }
  assert.equal(linked,11);
  assert.equal(covered+excluded+linked,1504);
  assert.ok(covered>0&&events>=covered);
  console.log("LATAM matrix history coverage:",JSON.stringify({covered,events,linked,excluded}));
});

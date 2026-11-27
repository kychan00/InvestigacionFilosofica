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

import {PHASE2_AUTHORS,PHASE2_SOURCES} from "../src/core/author-intellectual-history-phase2.js";
test("phase 2: six authorities, aliases, sources and chronological order",()=>{
  let total=0;
  for(const [id,record] of Object.entries(PHASE2_AUTHORS)){
    const h=intellectualHistory({wikidataId:id,displayName:record.names[0]});
    assert.equal(h.region,record.region);
    assert.equal(h.events.length,record.events.length);
    assert.deepEqual(h.events.map(e=>e.year),h.events.map(e=>e.year).sort((a,b)=>a-b));
    assert.equal(new Set(h.events.map(e=>e.id)).size,h.events.length);
    for(const alias of record.names)assert.equal(intellectualHistory({wikidataId:id,displayName:alias}).id,id);
    for(const [year,date,type,title,source] of record.events){assert.ok(Number.isInteger(year)&&year!==0&&date&&title&&BIO_TYPES[type]);assert.ok(Object.hasOwn(PHASE2_SOURCES,source));assert.equal(new URL(PHASE2_SOURCES[source][1]).protocol,"https:");}
    assert.equal(intellectualHistory({displayName:record.names[0]}),null);
    assert.equal(intellectualHistory({wikidataId:id,displayName:"Otro autor",name:record.names[0]}),null);
    total+=h.events.length;
  }
  assert.equal(total,48);
});
test("exact authority URIs and fallback field still require matching identity",()=>{
  assert.equal(intellectualHistory({wikidataId:"https://www.wikidata.org/entity/Q1879022",name:"Leopoldo Zea Aguilar"}).id,"Q1879022");
  assert.equal(intellectualHistory({wikidataId:"https://evil.example/Q1879022",name:"Leopoldo Zea"}),null);
  assert.equal(intellectualHistory({wikidataId:"Q7197",displayName:"Hannah Arendt"}),null);
  const h=intellectualHistory({wikidataId:"Q60025",displayName:"Hannah Arendt"});
  assert.equal(h.events.at(-1).type,"posthumous");
  assert.equal(h.events.at(-1).year,1978);
});

import {PHASE3_AUTHORS,PHASE3_SOURCES} from "../src/core/author-intellectual-history-phase3.js";
import {historicalPeriod} from "../src/core/author-historical-periods.js";
test("phase 3: authorities, names, sources, chronological ordering and no collisions",()=>{
  let total=0;
  for(const [id,record] of Object.entries(PHASE3_AUTHORS)){
    assert.ok(!Object.hasOwn(PHASE2_AUTHORS,id));
    const h=intellectualHistory({wikidataId:id,displayName:record.names[0]});
    assert.equal(h.region,record.region);
    assert.equal(h.events.length,record.events.length);
    assert.deepEqual(h.events.map(e=>e.year),h.events.map(e=>e.year).sort((a,b)=>a-b));
    assert.equal(new Set(h.events.map(e=>e.id)).size,h.events.length);
    for(const alias of record.names)assert.equal(intellectualHistory({wikidataId:id,displayName:alias}).id,id);
    for(const [year,date,type,title,source] of record.events){assert.ok(Number.isInteger(year)&&year!==0&&date&&title&&BIO_TYPES[type]);assert.ok(Object.hasOwn(PHASE3_SOURCES,source));assert.equal(new URL(PHASE3_SOURCES[source][1]).protocol,"https:");}
    assert.equal(intellectualHistory({displayName:record.names[0]}),null);
    total+=h.events.length;
  }
  assert.equal(total,36);
});
test("traditional dates, medieval composition, and homonym safety",()=>{
  const china=intellectualHistory({wikidataId:"Q4604",displayName:"孔子"});
  assert.match(china.events[0].date,/tradicional/);
  assert.match(china.events[1].date,/testimonio textual/);
  assert.equal(historicalPeriod(-509,china.region).label,"China antigua · a. C.");
  assert.equal(historicalPeriod(1800,china.region).label,"Siglo 18");
  const thomas=intellectualHistory({wikidataId:"Q9438",displayName:"Tomás de Aquino"});
  assert.equal(thomas.events.find(e=>e.title.includes("Summa theologiae")).type,"composition");
  assert.equal(intellectualHistory({wikidataId:"Q6291218",displayName:"José Carlos Mariátegui"}),null);
});

import {PHASE4_AUTHORS,PHASE4_SOURCES} from "../src/core/author-intellectual-history-phase4.js";
test("phase 4: exact authorities, sparse evidence, sources and chronological order",()=>{
  let total=0;
  for(const [id,record] of Object.entries(PHASE4_AUTHORS)){
    assert.ok(!Object.hasOwn(PHASE2_AUTHORS,id)&&!Object.hasOwn(PHASE3_AUTHORS,id));
    const h=intellectualHistory({wikidataId:id,displayName:record.names[0]});
    assert.equal(h.region,record.region);
    assert.equal(h.events.length,record.events.length);
    assert.deepEqual(h.events.map(e=>e.year),h.events.map(e=>e.year).sort((a,b)=>a-b));
    assert.equal(new Set(h.events.map(e=>e.id)).size,h.events.length);
    for(const alias of record.names)assert.equal(intellectualHistory({wikidataId:id,displayName:alias}).id,id);
    for(const [year,date,type,title,...keys] of record.events){assert.ok(Number.isInteger(year)&&year!==0&&date&&title&&BIO_TYPES[type]);for(const source of keys){assert.ok(Object.hasOwn(PHASE4_SOURCES,source));assert.equal(new URL(PHASE4_SOURCES[source][1]).protocol,"https:");}}
    assert.equal(intellectualHistory({displayName:record.names[0]}),null);
    total+=h.events.length;
  }
  assert.equal(total,30);
});
test("uncertain lives and multiple evidence sources remain explicit",()=>{
  const av=intellectualHistory({wikidataId:"Q8011",displayName:"Avicena"});
  assert.match(av.events[0].date,/970 o 980/);
  assert.equal(av.events[0].additionalSources.length,1);
  assert.equal(intellectualHistory({wikidataId:"Q133605",displayName:"Avicenna"}),null);
  const nag=intellectualHistory({wikidataId:"Q171195",displayName:"Nāgārjuna"});
  assert.equal(nag.events.length,2);
  assert.equal(nag.events[0].type,"floruit");
  assert.match(nag.events[1].date,/fecha desconocida/);
  assert.equal(intellectualHistory({wikidataId:"Q6958571",displayName:"Nagarjuna"}),null);
  for(const region of ["roman-africa","islamicate","jewish-mediterranean","india"]){assert.equal(historicalPeriod(1200,region).label,"Siglo 12 d. C.");assert.equal(historicalPeriod(-200,region).label,"Siglo 2 a. C.");}
});

import {PHASE5_AUTHORS,PHASE5_SOURCES} from "../src/core/author-intellectual-history-phase5.js";
test("phase 5: six Latin American authorities and sourced chronology",()=>{
  let total=0;
  for(const [id,record] of Object.entries(PHASE5_AUTHORS)){
    assert.ok(![PHASE2_AUTHORS,PHASE3_AUTHORS,PHASE4_AUTHORS].some(batch=>Object.hasOwn(batch,id)));
    const h=intellectualHistory({wikidataId:id,displayName:record.names[0]});
    assert.equal(h.region,"latin");
    assert.equal(h.events.length,record.events.length);
    assert.deepEqual(h.events.map(e=>e.year),h.events.map(e=>e.year).sort((a,b)=>a-b));
    assert.equal(new Set(h.events.map(e=>e.id)).size,h.events.length);
    for(const alias of record.names)assert.equal(intellectualHistory({wikidataId:id,displayName:alias}).id,id);
    for(const [year,date,type,title,...keys] of record.events){assert.ok(Number.isInteger(year)&&year!==0&&date&&title&&BIO_TYPES[type]);assert.ok(keys.length);for(const key of keys){assert.ok(Object.hasOwn(PHASE5_SOURCES,key));assert.equal(new URL(PHASE5_SOURCES[key][1]).protocol,"https:");}}
    assert.equal(intellectualHistory({displayName:record.names[0]}),null);
    total+=h.events.length;
  }
  assert.equal(total,53);
});
test("revised editions and transatlantic careers are not confused with original editions or birth regions",()=>{
  const caso=intellectualHistory({wikidataId:"Q601364",displayName:"Antonio Caso Andrade"});
  assert.equal(caso.events.find(e=>e.year===1916).type,"publication");
  assert.equal(caso.events.find(e=>e.year===1919).type,"revision");
  assert.equal(caso.events.find(e=>e.year===1919).additionalSources.length,1);
  assert.equal(intellectualHistory({wikidataId:"Q601364",displayName:"Alfonso Caso"}),null);
  assert.equal(intellectualHistory({wikidataId:"Q5711746",displayName:"Sebastián Salazar Bondy"}),null);
  assert.equal(intellectualHistory({wikidataId:"Q2370396",displayName:"Juan Villoro"}),null);
  assert.equal(intellectualHistory({wikidataId:"Q365193",displayName:"Adolfo Sánchez Vázquez",biography:"Spanish philosopher"}).region,"latin");
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {latinAmericanHistoryIdentity,latinAmericanDossierHref,latinAmericanHistoryLinks} from "../src/core/latin-american-history-bridge.js";
import {intellectualHistory} from "../src/core/author-intellectual-history.js";
const read=path=>JSON.parse(readFileSync(new URL("../src/data/"+path,import.meta.url),"utf8"));
const dossier=id=>read("philosopher-works/authors/"+String(id).padStart(4,"0")+".json");
test("all eleven reviewed crosswalks match real inventory and dossier records",()=>{
  const links=latinAmericanHistoryLinks();
  const inventory=read("latin-american-philosophers-metadata.json").philosophers;
  assert.equal(inventory.length,1504);
  assert.equal(links.length,11);
  assert.equal(new Set(links.map(l=>l.id)).size,11);
  assert.equal(new Set(links.map(l=>l.qid)).size,11);
  for(const link of links){
    assert.equal(inventory.find(a=>a.id===link.id).name,link.name);
    const record=dossier(link.id);
    const identity=latinAmericanHistoryIdentity(record);
    assert.equal(identity?.wikidataId,link.qid,link.name);
    assert.deepEqual(intellectualHistory(identity),intellectualHistory({wikidataId:link.qid,displayName:link.name}));
    assert.equal(latinAmericanDossierHref(identity),"./filosofia-latinoamericana.html#autor-"+String(link.id).padStart(4,"0"));
  }
});
test("no guessed match, incorrect dates, same-name impostor, or non-pilot entry",()=>{
  const caso=dossier(98);
  assert.equal(latinAmericanHistoryIdentity({...caso,author_id:99}),null);
  assert.equal(latinAmericanHistoryIdentity({...caso,canonical_name:"Alfonso Caso"}),null);
  assert.equal(latinAmericanHistoryIdentity({...caso,life:{...caso.life,died:{year:1950}}}),null);
  assert.equal(latinAmericanHistoryIdentity(dossier(1)),null);
  assert.equal(latinAmericanDossierHref({displayName:"Antonio Caso"}),null);
  assert.equal(latinAmericanDossierHref({wikidataId:"Q601364",displayName:"Alfonso Caso"}),null);
  assert.equal(latinAmericanDossierHref({wikidataId:"Q9235",displayName:"Hegel"}),null);
  const sor=dossier(19);
  assert.equal(latinAmericanHistoryIdentity(sor).wikidataId,"Q183074");
  assert.equal(latinAmericanHistoryIdentity({...sor,life:{...sor.life,born:{year:1651}}}),null);
});

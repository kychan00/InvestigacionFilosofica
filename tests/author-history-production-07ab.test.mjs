import test from "node:test";
import assert from "node:assert/strict";
import {timelineHistoryAuthor} from "../src/core/author-timeline-history-identity.js";
import {intellectualHistory} from "../src/core/author-intellectual-history.js";
// Reconstructed from six user-supplied production PDFs, not a raw provider payload.
const cases=[
  {
    "qid": "Q8011",
    "name": "Avicena",
    "catalog": "federated",
    "count": 5,
    "positive": [
      "De anima latine",
      "Prima primi canonis Avicenne sectio",
      "Principis Auicennae... De corde, eiusque facultatibus libells"
    ],
    "noise": [
      "PENGARUH ATRIBUT PRODUK DAN GAYA HIDUP TERHADAP KEPUTUSAN PEMBELIAN SAMMRTPHONE REDMI DI ROYAL CELL BIMA",
      "Comparative Investigation on Tool Wear during End Milling of AISI H13 Steel with Different Tool Path Strategies"
    ],
    "sameFamily": [
      "Principis Auicennae... De corde, eiusque facultatibus libells",
      "Principis Auicennae... De corde, eiusque facultatibus libellus"
    ]
  },
  {
    "qid": "Q183074",
    "name": "Sor Juana Inés de la Cruz",
    "catalog": "federated",
    "count": 5,
    "positive": [
      "Loa Al Auto Sacramental Del Divino Narciso Sor Juana Ines De La Cruz",
      "Loa To The Divine Narcissus",
      "Obras escogidas y Los empeños de una casa",
      "From “La Respuesta” (1691)"
    ],
    "noise": [
      "Sor Juana Inés De La Cruz, Francisco Ramírez Santacruz",
      "The Tenth Muse"
    ],
    "sameFamily": [
      "Loa Al Auto Sacramental Del Divino Narciso Sor Juana Ines De La Cruz",
      "Loa To The Divine Narcissus"
    ]
  },
  {
    "qid": "Q171195",
    "name": "Nāgārjuna",
    "catalog": "openalex",
    "count": 2,
    "positive": [
      "[ Nagarjuna] Middle Way",
      "SUHṚLLEKHA",
      "Suh-ki-li-lih-kiu: The Suhṛillekha Or 'friendly Letter' Addressed to King Sadvaha"
    ],
    "noise": [
      "Khichdi Viplava Dekha Mamne",
      "Kumbhipak",
      "Nai Paudh",
      "AKAAL AUR USKE BAAD - HINDI NAGARJUNA",
      "Nāgārjuna Philosophy Middle Path"
    ],
    "sameFamily": [
      "SUHṚLLEKHA",
      "Suh-ki-li-lih-kiu: The Suhṛillekha Or 'friendly Letter' Addressed to King Sadvaha"
    ]
  }
];
for(const c of cases)test("production title families: "+c.name,()=>{
 const a={displayName:c.name,catalog:c.catalog};
 const rows=titles=>titles.map(title=>({title,authors:[{name:c.name}]}));
 const works=rows([...c.positive,...c.noise]);
 const resolved=timelineHistoryAuthor(a,works);
 assert.equal(resolved.wikidataId,c.qid);
 assert.equal(resolved.historyIdentityContext,"reviewed-title-families");
 assert.equal(intellectualHistory(resolved).events.length,c.count);
 assert.equal(a.wikidataId,undefined);
 assert.equal(timelineHistoryAuthor(a,rows(c.noise)),a);
 assert.equal(timelineHistoryAuthor(a,rows(c.sameFamily)),a);
 assert.equal(timelineHistoryAuthor(a,rows([c.positive[0],...c.noise])),a);
 assert.equal(timelineHistoryAuthor(a,works.map(w=>({...w,authors:[{name:c.name,role:"translator"}]}))),a);
 assert.equal(timelineHistoryAuthor(a,works.map(w=>({...w,authors:[{name:c.name,wikidataId:"Q1"}]}))),a);
 const conflict={...a,wikidataId:"Q1"};
 assert.equal(timelineHistoryAuthor(conflict,works),conflict);
 const viaf={...a,viafId:"123"};
 assert.equal(timelineHistoryAuthor(viaf,works),viaf);
 const orcid={...a,orcid:"0000-0001-0000-0001"};
 assert.equal(timelineHistoryAuthor(orcid,works),orcid);
 const incompatible=works.map((w,i)=>({...w,authors:[{name:c.name,id:"A"+(100+i)}]}));
 assert.equal(timelineHistoryAuthor(a,incompatible),a);
});

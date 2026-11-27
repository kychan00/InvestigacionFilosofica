import test from "node:test";
import assert from "node:assert/strict";
import {timelineHistoryAuthor} from "../src/core/author-timeline-history-identity.js";
const cases=[{"author":{"id":"5033760928","displayName":"Simone de Beauvoir"},"titles":["Le sang des autres","Segundo Sexo, Simone De Beauvoir","The Ethics of Ambiguity"],"qid":"Q7197","date":"1908"},{"author":{"catalog":"federated","displayName":"Antonio Caso Andrade","sourceDisplayName":"Antonio Caso"},"titles":["La existencia como economia como desinteres y como caridad","Positivismo, neopositivismo y fenomenología"],"qid":"Q601364","date":"1883"},{"author":{"catalog":"federated","displayName":"Confucio"},"titles":["Analectas, Confucio","Los cuatro libros"],"qid":"Q4604","date":"551"}];
for(const c of cases)test("production-shaped identity: "+c.author.displayName,()=>{
 const works=c.titles.map(title=>({title,authors:[{name:c.author.displayName}]}));
 assert.equal(timelineHistoryAuthor(c.author,works).wikidataId,c.qid);
 assert.equal(c.author.wikidataId,undefined);
 assert.equal(timelineHistoryAuthor(c.author,[]),c.author);
 assert.equal(timelineHistoryAuthor(c.author,[works[0],works[0]]),c.author);
 assert.equal(timelineHistoryAuthor(c.author,works.map(w=>({...w,authors:[{name:"Different author"}]}))),c.author);
 const conflict={...c.author,wikidataId:"Q1"};assert.equal(timelineHistoryAuthor(conflict,works),conflict);
 const orcid={...c.author,orcid:"0000-0001-0000-0001"};assert.equal(timelineHistoryAuthor(orcid,works),orcid);
});
test("same title editions and conflicting local author identifiers cannot unlock history",()=>{
 const a=cases[0].author;
 const records=["Segundo Sexo, Simone De Beauvoir","El segundo sexo"].map(title=>({title,authors:[{name:a.displayName}]}));
 assert.equal(timelineHistoryAuthor(a,records),a);
 assert.equal(timelineHistoryAuthor(a,cases[0].titles.map(title=>({title,authors:[{name:a.displayName,id:"A123"}]}))),a);
});

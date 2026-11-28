import test from "node:test";
import assert from "node:assert/strict";
import {timelineHistoryAuthor} from "../src/core/author-timeline-history-identity.js";
const cases=[{"author":{"id":"5033760928","displayName":"Simone de Beauvoir"},"titles":["Le sang des autres","Segundo Sexo, Simone De Beauvoir","The Ethics of Ambiguity"],"qid":"Q7197","date":"1908"},{"author":{"catalog":"federated","displayName":"Antonio Caso Andrade","sourceDisplayName":"Antonio Caso"},"titles":["La existencia como economia como desinteres y como caridad","Positivismo, neopositivismo y fenomenología"],"qid":"Q601364","date":"1883"}];
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


test("Confucius: anthology and Analects do not count as independent authored works",()=>{
 const a={catalog:"federated",displayName:"Confucio"};
 const works=["Analectas","Los cuatro libros"].map(title=>({title,authors:[{name:"Confucio"}]}));
 assert.equal(timelineHistoryAuthor(a,works),a);
 assert.equal(timelineHistoryAuthor(a,[works[0],works[0]]),a);
 assert.equal(timelineHistoryAuthor({...a,viafId:"89664672"},[works[0]]).wikidataId,"Q4604");
 const wrong={...a,viafId:"123"};
 assert.equal(timelineHistoryAuthor(wrong,works),wrong);
 assert.equal(timelineHistoryAuthor(a,[{title:"Analectas",authors:[{name:"Confucio, 551-479 a. C."}]}]).wikidataId,"Q4604");
 assert.equal(timelineHistoryAuthor(a,[{title:"Analectas",authors:[{name:"Confucio, 552-479 B.C."}]}]).wikidataId,"Q4604");
 assert.equal(timelineHistoryAuthor(a,[{title:"Analectas",authors:[{name:"Confucio, 551-479 a. C.",role:"editor"}]}]),a);
 const conflict={...a,wikidataId:"Q1",viafId:"89664672"};
 assert.equal(timelineHistoryAuthor(conflict,works),conflict);
});
test("independent titles from incompatible corpus IDs do not establish a federated identity",()=>{
 const a={catalog:"federated",displayName:"Antonio Caso"};
 const works=[{title:"El problema de México y la ideología nacional",authors:[{name:"Antonio Caso",id:"A123"}]},{title:"La persona humana y el Estado totalitario",authors:[{name:"Antonio Caso",id:"A456"}]}];
 assert.equal(timelineHistoryAuthor(a,works),a);
});


test("Confucius contextual panel from documented federated Analects record, not a second authored work",()=>{
 const a={id:null,catalog:"federated",displayName:"Confucio",sourceDisplayName:"Confucio"};
 const w={title:"Analectas, Confucio",authors:[{name:"Confucio",id:null}],authorIdentity:{exact:true,evidence:"exact-name"},sourceRecords:[{provider:"Internet Archive",sourceId:"analects-fixture"}]};
 const h=timelineHistoryAuthor(a,[w]);
 assert.equal(h.wikidataId,"Q4604");assert.equal(h.historyIdentityContext,"confucius-reviewed-catalogue");
 assert.equal(a.wikidataId,undefined);
 assert.equal(timelineHistoryAuthor(a,[{...w,title:"Los cuatro libros"}]),a);
 assert.equal(timelineHistoryAuthor(a,[{...w,authors:[{name:"Otro autor"}]}]),a);
 assert.equal(timelineHistoryAuthor(a,[{...w,authors:[{name:"Confucio",role:"translator"}]}]),a);
 assert.equal(timelineHistoryAuthor(a,[{...w,authors:[{name:"Confucio",id:"A9999"}]}]),a);
 assert.equal(timelineHistoryAuthor(a,[{...w,sourceRecords:[]}]),a);
 assert.equal(timelineHistoryAuthor(a,[{...w,authorIdentity:{exact:false}}]),a);
 const modern={...a,id:"1234"};assert.equal(timelineHistoryAuthor(modern,[w]),modern);
 const conflict={...a,viafId:"123"};assert.equal(timelineHistoryAuthor(conflict,[w]),conflict);
 const orcid={...a,orcid:"0000-0001-0000-0001"};assert.equal(timelineHistoryAuthor(orcid,[w]),orcid);
 assert.equal(timelineHistoryAuthor(a,[{...w,authors:[{name:"Confucio",wikidataId:"Q1"}]}]),a);
});

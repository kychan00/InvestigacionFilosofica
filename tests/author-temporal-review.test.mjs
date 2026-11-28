import test from "node:test";
import assert from "node:assert/strict";
import {assessAuthorWorkDate} from "../src/core/author-temporal-review.js";
import {authorWorkDate,buildAuthorTimeline} from "../src/core/author-timeline.js";
import {intellectualHistory} from "../src/core/author-intellectual-history.js";
import {historicalTimelineSlice} from "../src/core/author-historical-periods.js";
const h=(wikidataId,displayName)=>intellectualHistory({wikidataId,displayName});
const arendt=h("Q60025","Hannah Arendt"),russell=h("Q33760","Bertrand Russell"),hegel=h("Q9235","Hegel"),sor=h("Q183074","Sor Juana Inés de la Cruz"),naga=h("Q171195","Nāgārjuna"),avicena=h("Q8011","Avicena"),caso=h("Q601364","Antonio Caso");
const assess=(history,title,year,extra={})=>{const w={title,year,...extra};return assessAuthorWorkDate(w,authorWorkDate(w),history);};
test("production PDF cases: suspicious dates are not rewritten",()=>{
 assert.equal(assess(arendt,"Hannah Arendt, The Origins Of Totalitarianism",1900).code,"before-birth");
 assert.equal(assess(arendt,"The Origins of Totalitarianism",1949).code,"before-first-publication");
 assert.equal(assess(russell,"Bertrand Russell, Last's Message 1970",1900).code,"title-year-disagreement");
 assert.equal(assess(russell,"Bertrand Russell, Last's Message 1970",1970),null);
 assert.equal(assess(arendt,"Other title",1950,{publicationDate:"1951-01-01"}).code,"conflicting-metadata");
});
test("later editions and posthumous dates do not establish false authorship",()=>{
 assert.equal(assess(arendt,"The Origins of Totalitarianism",2025).code,"later-version-possible");
 assert.equal(assess(arendt,"The Life of the Mind",1978).code,"documented-posthumous");
 assert.equal(assess(hegel,"Principios de la filosofía del derecho",1821).code,"documented-publication");
 assert.equal(assess(russell,"Principia Mathematica",1912).code,"documented-publication");
 assert.equal(assess(caso,"Contemporary engineering paper",2022).code,"after-death");
 assert.equal(assess(avicena,"De anima latine",1485).review,false);
});
test("approximate chronology, unrelated titles and unknown authors remain conservative",()=>{
 assert.equal(assess(sor,"Unknown title",1647),null);
 assert.equal(assess(avicena,"Unknown title",964),null);
 assert.equal(assess(naga,"Unknown title",1900),null);
 assert.equal(assess(russell,"An unrelated title 1970",1900),null);
 assert.equal(assess(null,"Any",1900),null);
 assert.equal(assess(arendt,"The Human Condition",null),null);
});
test("review group preserves rows, original years, indexes and ordinary chronology",()=>{
 const works=[{title:"Hannah Arendt, The Origins Of Totalitarianism",year:1900},{title:"The Human Condition",year:1958},{title:"The Origins of Totalitarianism",year:2025},{title:"Unknown"}];
 const before=JSON.stringify(works);
 for(const mode of ["year","month"]){
  const model=buildAuthorTimeline(works,mode,{history:arendt});
  assert.equal(model.total,4);assert.equal(model.dated,2);assert.equal(model.undated,1);assert.equal(model.dateReview,1);
  assert.equal(model.groups.at(-1).key,"review");
  assert.equal(model.groups.at(-1).nodes[0].work.year,1900);
  assert.equal(model.groups.at(-1).nodes[0].index,0);
  assert.equal(historicalTimelineSlice(model,{region:"europe"},4).at(-1).key,"review");
  assert.equal(JSON.stringify(works),before);
 }
 assert.equal(buildAuthorTimeline(works).groups[0].year,1900);
});

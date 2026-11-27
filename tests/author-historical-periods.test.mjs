import test from "node:test";
import assert from "node:assert/strict";
import {buildAuthorTimeline,authorWorkDate} from "../src/core/author-timeline.js";
import {historicalPeriod,historicalTimelineSlice,authorHistoricalContext,TIMELINE_BATCH} from "../src/core/author-historical-periods.js";
test("años a. C. y sin fecha",()=>{
 const model=buildAuthorTimeline([{title:"edition",year:2000},{title:"ancient",year:-380},{title:"unknown",year:0},{title:"older",year:-400}]);
 assert.deepEqual(model.groups.map(g=>g.label),["400 a. C.","380 a. C.","2000","Sin fecha"]);
 assert.equal(authorWorkDate({year:-380}).year,-380);
});
test("cuatro obras, distintos años, índices originales",()=>{
 const model=buildAuthorTimeline([{title:"G",year:2000},{title:"C",year:1801},{title:"A",year:1790},{title:"B",year:1790},{title:"D",year:1810},{title:"E",year:1900},{title:"F"}]);
 const context={region:"europe"},first=historicalTimelineSlice(model,context);
 assert.equal(TIMELINE_BATCH,4);
 assert.deepEqual(first.flatMap(s=>s.entries.map(e=>e.index)),[2,3,1,4]);
 assert.deepEqual(first.map(s=>s.key),["early-modern","nineteenth"]);
 assert.deepEqual(historicalTimelineSlice(model,context,8).flatMap(s=>s.entries.map(e=>e.index)),[2,3,1,4,5,0,6]);
});
test("regiones distintas y reserva ante evidencia insuficiente",()=>{
 assert.equal(historicalPeriod(1650,"latin").key,"colonial");
 assert.equal(historicalPeriod(1650,"europe").key,"early-modern");
 assert.equal(historicalPeriod(1650,"neutral").key,"century-17");
 assert.equal(historicalPeriod(1800,"latin").key,"independence");
 assert.equal(historicalPeriod(1910,"latin").key,"contemporary");
 assert.equal(authorHistoricalContext({wikidataId:"Q1",biography:"filósofa mexicana"}).region,"latin");
 assert.equal(authorHistoricalContext({wikidataId:"Q2",biography:"German philosopher"}).region,"europe");
 assert.equal(authorHistoricalContext({displayName:"Pérez",biography:"filósofa mexicana"}).region,"neutral");
 assert.equal(authorHistoricalContext({wikidataId:"Q3",biography:"Mexican and Spanish philosopher"}).region,"neutral");
});
test("una edición moderna no se convierte en obra fechada a. C.",()=>{
 const context=authorHistoricalContext({wikidataId:"Q859"});
 assert.equal(context.motif,"ancient");
 assert.equal(historicalTimelineSlice(buildAuthorTimeline([{title:"Republic",year:2020}]),context)[0].key,"contemporary");
});

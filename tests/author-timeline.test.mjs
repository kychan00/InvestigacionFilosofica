import assert from "node:assert/strict";
import test from "node:test";
import {
  authorWorkDate,
  buildAuthorTimeline
} from "../src/core/author-timeline.js";

test("agrupa cronológicamente cada obra en nodos por año", () => {
  const works = [
    {id:"W2",title:"B",year:1821},
    {id:"W1",title:"A",year:1817},
    {id:"W3",title:"C",year:1821},
    {id:"W4",title:"Sin fecha"}
  ];
  const result = buildAuthorTimeline(works);
  assert.equal(result.total, 4);
  assert.equal(result.dated, 3);
  assert.equal(result.undated, 1);
  assert.deepEqual(result.groups.map(x => [x.label,x.count]), [
    ["1817",1],["1821",2],["Sin fecha",1]
  ]);
  assert.deepEqual(result.groups[1].nodes.map(x=>x.work.title),["B","C"]);
});

test("por mes no inventa fechas para obras del índice que sólo da año", () => {
  const result = buildAuthorTimeline([
    {title:"Obra histórica",year:1781},
    {title:"Artículo",year:1781,publicationDate:"1781-05-15"},
    {title:"Error de metadata",year:1781,publicationDate:"1788-08-01"},
    {title:"Sin fecha"}
  ],"month");
  assert.equal(result.monthsKnown,1);
  assert.deepEqual(result.groups.map(x=>[x.label,x.count]),[
    ["mayo de 1781",1],
    ["1781 · Mes no registrado",2],
    ["Sin fecha",1]
  ]);
});

test("la fecha incompatible conserva el año y no inventa el mes", () => {
  assert.deepEqual(
    authorWorkDate({year:1807,publicationDate:"1808-04-02"}),
    {year:1807,month:null,precision:"year"}
  );
  assert.deepEqual(
    authorWorkDate({year:1807,month:13}),
    {year:1807,month:null,precision:"year"}
  );
  assert.deepEqual(
    authorWorkDate({publicationDate:"1807-03-15"}),
    {year:1807,month:3,precision:"month"}
  );
});

test("es determinista y no altera las obras originales", () => {
  const works=[{id:"W1",title:"Z",year:1810},{id:"W2",title:"A",year:1810}];
  const result=buildAuthorTimeline(works,"invalid");
  assert.equal(result.granularity,"year");
  assert.deepEqual(result.groups[0].nodes.map(n=>n.index),[1,0]);
  assert.deepEqual(works.map(w=>w.title),["Z","A"]);
});

test("grupo vacío no presenta fechas ni nodos imaginarios",()=>{
  assert.deepEqual(buildAuthorTimeline([]),{
    granularity:"year",total:0,dated:0,undated:0,monthsKnown:0,groups:[]
  });
});

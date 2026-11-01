import test from "node:test";
import assert from "node:assert/strict";
import {
  workCollaboration,summarizeAuthorCollaborations
} from "../src/core/author-collaborations.js";

const author={
  id:"7654321",
  displayName:"Dinora Hernández López",
  aliases:["Dra Dinora Hernández","Dinora Hernández"],
  linkedAuthorIds:["7654321","7654322"],
  orcid:"https://orcid.org/0000-0002-1234-5678"
};
const ids=(id,name)=>({id:"https://openalex.org/A"+id,name});
const work=(id,authors,coauthorCount=null)=>({
  id:"https://openalex.org/W"+id,title:"Obra "+id,authors,
  coauthorCount,retrievalMode:"author-index"
});

test("distingue obras individuales, en colaboración y con autoría desconocida",()=>{
 const together=work(101,[ids("7654322","Dinora Hernández"),
  ids("900","María Pérez")],1);
 const solo=work(102,[ids("7654321","Dinora Hernández López")],0);
 const legacy=work(103,[ids("7654321","Dinora Hernández López")],null);
 assert.deepEqual(workCollaboration(together,author).kind,"collaboration");
 assert.equal(workCollaboration(together,author).count,1);
 assert.equal(workCollaboration(solo,author).kind,"individual");
 assert.equal(workCollaboration(legacy,author).kind,"unknown");
});

test("colaboradoras repetidas se cuentan una sola vez por obra",()=>{
 const works=[
  work(201,[ids("7654321","Dinora"),ids("900","María Pérez")],1),
  work(202,[ids("7654322","Dinora"),ids("900","María Pérez")],1),
  work(203,[ids("7654321","Dinora")],0)
 ];
 const summary=summarizeAuthorCollaborations(author,works);
 assert.equal(summary.collaboration,2);
 assert.equal(summary.individual,1);
 assert.equal(summary.collaborators.length,1);
 assert.equal(summary.collaborators[0].name,"María Pérez");
 assert.equal(summary.collaborators[0].count,2);
});

test("nunca registra el otro ID ORCID de la misma persona como coautor",()=>{
 const result=workCollaboration(work(300,[
  ids("7654321","Dinora Hernández"),
  ids("7654322","Dinora Hernández López"),
  ids("777","Colega")
 ],2),author);
 assert.equal(result.kind,"collaboration");
 assert.equal(result.coauthors.length,1);
 assert.equal(result.coauthors[0].name,"Colega");
});

test("los nombres ambiguos no son pruebas de identidad",()=>{
 const result=workCollaboration(work(400,[
  ids("222","Dinora Hernández"),ids("333","Otro autor")
 ],1),author);
 assert.equal(result.coauthors.length,2);
});

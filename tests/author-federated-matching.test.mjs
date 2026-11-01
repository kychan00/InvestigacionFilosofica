import test from "node:test";
import assert from "node:assert/strict";
import {
 normalizeAuthorAliases,splitCreatorMetadata,matchFederatedWork,
 discoveredAuthorVariants
} from "../src/core/author-federated-matching.js";
import {
 workCollaboration,summarizeAuthorCollaborations
} from "../src/core/author-collaborations.js";

const target={displayName:"Dinora Hernández López",
 aliases:["Dra Dinora Hernández","Dinora Hernández"],id:null};

test("los tratamientos y los acentos no crean diferentes personas",()=>{
 assert.deepEqual(normalizeAuthorAliases("Dra. Dinora Hernández",[
   "Dinora Hernandez","Dinora Hernández López"
 ]),["Dinora Hernández","Dinora Hernández López"]);
});

test("reconoce una lista de autores, no una persona con nombre muy largo",()=>{
 const authors=splitCreatorMetadata([{id:null,
  name:"Dinora Hernández, Hermann Omar Amaya, Santiago M. Roggerone, José A. Zamora"}]);
 assert.equal(authors.length,4);
 assert.equal(authors[0].name,"Dinora Hernández");
 assert.equal(authors[1].name,"Hermann Omar Amaya");
});

test("una compilación de varias personas cuenta como colectiva",()=>{
 const entry=matchFederatedWork({
  title:"Teoría crítica, planteamientos, desplazamientos, tensiones",
  authors:[{name:"Dinora Hernández López Hermann Omar Amaya Velasco Coordinadores"}]
 },"Dra Dinora Hernández");
 assert.ok(entry);
 assert.equal(entry.collectiveWork,true);
 assert.equal(entry.coauthorCount,1);
 assert.equal(entry.authors.length,1);
 assert.equal(entry.authors[0].name,"Dinora Hernández");
 assert.ok(entry.creatorStatement.includes("Hermann Omar Amaya"));
 assert.ok(!entry.authors[0].name.includes("Hermann Omar Amaya"));
 assert.equal(workCollaboration({...entry,retrievalMode:"author-internet-archive"},target).kind,
   "collaboration");
});

test("el listado de colaboradores de un volumen identifica coautores visibles",()=>{
 const entry=matchFederatedWork({
  title:"Teoría crítica, planteamientos, desplazamientos, tensiones",
  authors:[{name:"Dinora Hernández, Hermann Omar Amaya, Santiago M. Roggerone"}]
 },"Dra Dinora Hernández");
 assert.ok(entry);
 assert.equal(entry.authors.length,3);
 assert.equal(entry.coauthorCount,2);
 const value=workCollaboration({...entry,retrievalMode:"author-internet-archive"},target);
 assert.equal(value.kind,"collaboration");
 assert.deepEqual(value.coauthors.map(x=>x.name),["Hermann Omar Amaya","Santiago M. Roggerone"]);
});

test("un único creador federado no demuestra autoría individual",()=>{
 const entry=matchFederatedWork({
  title:"Theodor W. Adorno: resistencia y briznas",
  authors:[{name:"Dra Dinora Hernández"}]
 },"Dinora Hernández");
 assert.ok(entry);
 const result=workCollaboration({...entry,retrievalMode:"author-internet-archive"},target);
 assert.equal(result.kind,"unknown");
 assert.equal(result.count,0);
});

test("no atribuye obras por un nombre contenido únicamente en el título",()=>{
 assert.equal(matchFederatedWork({
  title:"Dinora Corsi y otras investigadoras",
  authors:[{name:"Otra Autora"}]
 },"Dinora Hernández"),null);
 assert.equal(matchFederatedWork({
  title:"Cultura y política",
  authors:[{name:"Antonio Hernández"}]
 },"Dinora Hernández"),null);
});

test("no mezcla homónimos identificados por ORCID contradictorio",()=>{
 assert.equal(matchFederatedWork({
  title:"Obra",
  authors:[{name:"Dinora Hernández",
    id:"https://orcid.org/0000-0001-1111-1111"}]
 },"Dinora Hernández",{
  expectedOrcid:"https://orcid.org/0000-0002-2222-2222"
 }),null);
});

test("descubre un apellido adicional exclusivamente en el campo de autor",()=>{
 const source=[
  {authors:[{name:"Dinora Hernández López"}]},
  {title:"Dra Dinora Hernández López",authors:[{name:"Otra persona"}]},
  {authors:[{name:"Dinora Hernández López Hermann Amaya Coordinadores"}]}
 ];
 assert.deepEqual(discoveredAuthorVariants(source,
  "Dra Dinora Hernández"),["Dinora Hernández López"]);
});

test("los coautores estructurados se agrupan de forma global sin duplicar obras",()=>{
 const works=[
  matchFederatedWork({title:"Volumen uno",authors:[
   {name:"Dinora Hernández, Hermann Omar Amaya"}]}, "Dinora Hernández"),
  matchFederatedWork({title:"Volumen dos",authors:[
   {name:"Dinora Hernández, Hermann Omar Amaya"}]}, "Dinora Hernández"),
 ].map(work=>({...work,retrievalMode:"author-internet-archive"}));
 const summary=summarizeAuthorCollaborations(target,works);
 assert.equal(summary.collaboration,2);
 assert.equal(summary.collaborators.length,1);
 assert.equal(summary.collaborators[0].count,2);
});

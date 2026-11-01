import test from "node:test";
import assert from "node:assert/strict";
import {resolveFederatedAuthor} from "../src/core/crossref-author-fallback.js";
import {summarizeAuthorCollaborations} from "../src/core/author-collaborations.js";

const mk=(id,title,year,author,provider)=>({
  id, title,year,type:"article",language:"es",
  authors:[{id:null,name:author}],providers:[provider]
});

test("perfil de Dinora recupera las publicaciones colectivas encontradas en la búsqueda general",async()=>{
 const requested=[];
 const archive=async ({query})=>{
   requested.push(["archive",query]);
   if(query==="Dinora Hernández López")return [
     mk("ia:8","Capítulo sobre teoría crítica",2025,
       "Dinora Hernández López, Hermann Omar Amaya","Internet Archive")
   ];
   return [
     mk("ia:1","La perspectiva de la imbricación",1900,
       "Dinora Hernández","Internet Archive"),
     mk("ia:2","La escuela de Frankfurt: un acercamiento",2010,
       "Dinora Hernández","Internet Archive"),
     mk("ia:3","Teoría crítica, planteamientos, desplazamientos, tensiones",2019,
       "Dinora Hernández López Hermann Omar Amaya Velasco Coordinadores","Internet Archive"),
     mk("ia:4","Teoría crítica, planteamientos, desplazamientos, tensiones",2023,
       "Dinora Hernández, Hermann Omar Amaya, Santiago Roggerone","Internet Archive"),
     mk("ia:5","La Escuela de Frankfurt: un entramado de disonancias, Dr Dinora Hernández López",2024,
       "Dinora Hernández López Hermann Omar Amaya Velasco Coordinadores","Internet Archive"),
     mk("ia:6","Theodor W Adorno: resistencia y briznas",2022,
       "Dra Dinora Hernández","Internet Archive"),
     mk("ia:noise","Dinora Dutchizky o la gracia",1952,
       "Antonio Romera","Internet Archive")
   ];
 };
 const crossref=async ({query})=>{
   requested.push(["crossref",query]);
   return query==="Dinora Hernández"
     ?[
       mk("cr:1","Reseña crítica de la construcción de la ciudad",2016,
         "Dinora Hernandez","Crossref"),
       mk("cr:noise","Gracias, Dinora",1972,
         "M. Peter McCusker","Crossref")
     ]:[];
 };
 const cucsh=async ({query})=>{
   requested.push(["cucsh",query]);
   return query==="Dinora Hernández" ?[
     mk("udg:1","La Escuela de Frankfurt: Un entramado de disonancias",2024,
       "Dinora Hernández López","CUCSH Filosofía")
   ]:[];
 };
 const result=await resolveFederatedAuthor("Dra Dinora Hernández",{
   archiveSearchImpl:archive,crossrefSearchImpl:crossref,
   cucshSearchImpl:cucsh,maxVariants:3,limit:60
 });
 assert.equal(result.status,"resolved");
 assert.equal(result.author.displayName,"Dinora Hernández López");
 assert.ok(result.author.aliases.some(x=>x==="Dra Dinora Hernández"));
 assert.ok(result.works.length>=8,"must include collective and institutional works");
 assert.ok(requested.some(([source,name])=>
   source==="archive"&&name==="Dinora Hernández López"),
   "the full name discovered from a creator must trigger another catalogue search");
 assert.ok(!result.works.some(x=>/Dutchizky|Gracias, Dinora/.test(x.title)));
 const summary=summarizeAuthorCollaborations(result.author,result.works);
 assert.ok(summary.collaboration>=3,
  "coordinated and multi-author volumes must not be counted as sole authored");
 assert.equal(summary.individual,0,
  "catalogue records with one creator cannot prove solo authorship");
 assert.ok(summary.unknown>=1);
 assert.ok(result.author.catalogSources.includes("CUCSH Filosofía"));
});

test("no se hereda el ORCID de otra persona que participa en una colaboración",async()=>{
 const res=await resolveFederatedAuthor("María Investigadora",{
  disableCucsh:true,disableCrossref:true,
  archiveSearchImpl:async()=>[
   {id:"ia:1",title:"Una obra colectiva",year:2024,
    authors:[
     {name:"María Investigadora",id:null},
     {name:"Pedro Autor",id:"https://orcid.org/0000-0001-5555-5555"}
    ],providers:["Internet Archive"]}
  ]
 });
 assert.equal(res.status,"resolved");
 assert.equal(res.author.orcid,null);
});

test("dos segundos apellidos diferentes nunca se agregan en silencio",async()=>{
 const res=await resolveFederatedAuthor("Dinora Hernández",{
  disableCucsh:true,disableCrossref:true,maxVariants:1,
  archiveSearchImpl:async()=>[
   mk("ia:1","Libro de López",2024,"Dinora Hernández López","Internet Archive"),
   mk("ia:2","Libro de Gómez",2023,"Dinora Hernández Gómez","Internet Archive"),
   mk("ia:3","Libro sin segundo apellido",2022,"Dinora Hernández","Internet Archive")
  ]
 });
 assert.equal(res.status,"resolved");
 assert.equal(res.works.length,1);
 assert.equal(res.works[0].title,"Libro sin segundo apellido");
 assert.match(res.errors.join(" "),/Varias identidades/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  matchAuthorName,chooseLiveAuthorIdentity,findOpenAlexAuthorIdentity
} from "../src/core/author-identity-lookup.js";

const person=(id,name,count,extra={})=>({
  id:"https://openalex.org/A"+id,
  display_name:name,works_count:count,
  last_known_institutions:[{display_name:"Universidad de Guadalajara"}],
  ...extra
});
const dinora=person("7654321","Dinora Hernández López",28,{
  display_name_alternatives:["Dinora Hernandez","D. Hernández López"],
  orcid:"https://orcid.org/0000-0002-1234-5678"
});

test("nombre sin apellido materno puede identificar un único perfil, sin inventar ORCID",()=>{
  assert.equal(matchAuthorName("Dinora Hernández",dinora),"exact");
  assert.equal(matchAuthorName("Dinora Hernández López",dinora),"exact");
  const decision=chooseLiveAuthorIdentity("Dinora Hernández",[dinora],{totalReported:1});
  assert.equal(decision.status,"resolved");
  assert.equal(decision.candidate.id,"7654321");
  assert.match(decision.candidate.affiliation,/Guadalajara/);
});

test("coincidencia parcial de nombre se acepta solamente cuando es única",()=>{
  const extended=person("7654321","Dinora Hernández López",28);
  const decision=chooseLiveAuthorIdentity("Dinora Hernández",[extended],{totalReported:1});
  assert.equal(decision.status,"resolved");
  assert.equal(decision.candidate.k,"partial");
});

test("homónimos no se fusionan aunque uno tenga muchas más publicaciones",()=>{
  const one=person("123","Dinora Hernández López",100);
  const two=person("234","Dinora Hernández Gómez",2);
  const resolution=chooseLiveAuthorIdentity("Dinora Hernández",[one,two],{totalReported:2});
  assert.equal(resolution.status,"ambiguous");
  assert.equal(resolution.candidates.length,2);
});

test("recuento de resultados truncado impide autoseleccionar identidad",()=>{
  const result=chooseLiveAuthorIdentity("Dinora Hernández",[dinora],{totalReported:100});
  assert.equal(result.status,"ambiguous");
});

test("ORCID requiere coincidencia explícita, sin aceptar autor del mismo nombre",()=>{
  const result=chooseLiveAuthorIdentity("Dinora Hernández",[
    person("22","Dinora Hernández López",12,{orcid:"https://orcid.org/0000-0001-0000-0001"}),
    person("33","Dinora Hernández López",4,{orcid:"https://orcid.org/0000-0002-1234-5678"})
  ],{orcid:"0000-0002-1234-5678",totalReported:2});
  assert.equal(result.status,"resolved");
  assert.equal(result.candidate.id,"33");
  assert.equal(chooseLiveAuthorIdentity("Dinora Hernández",[
    person("44","Dinora Hernández López",7)
  ],{orcid:"0000-0002-1234-5678"}).status,"none");
});

test("consulta por nombre al directorio OpenAlex usa endpoint de autores, no trabajos de tema",async()=>{
  const urls=[];
  const value=await findOpenAlexAuthorIdentity("Dinora Hernández",{
    fetchImpl:async url=>{
      urls.push(new URL(url));
      return {ok:true,json:async()=>({meta:{count:1},results:[dinora]})};
    }
  });
  assert.equal(value.status,"resolved");
  assert.equal(urls[0].pathname,"/authors");
  assert.equal(urls[0].searchParams.get("search"),"Dinora Hernández");
  assert.ok(urls[0].searchParams.get("select").includes("last_known_institutions"));
});

test("con ORCID consulta el filtro fiable y no el texto general",async()=>{
  const urls=[];
  await findOpenAlexAuthorIdentity("Dinora Hernández",{
    orcid:"https://orcid.org/0000-0002-1234-5678",
    fetchImpl:async url=>{
      urls.push(new URL(url));
      return {ok:true,json:async()=>({meta:{count:1},results:[dinora]})};
    }
  });
  assert.equal(urls[0].searchParams.get("filter"),"orcid:0000-0002-1234-5678");
  assert.equal(urls[0].searchParams.has("search"),false);
});

test("servicio inaccesible conserva ruta de búsqueda alternativa",async()=>{
  const result=await findOpenAlexAuthorIdentity("Dinora Hernández",{
    fetchImpl:async()=>({ok:false,status:429})
  });
  assert.equal(result.status,"unavailable");
  assert.match(result.error,/429/);
});

test("cancelar la pestaña detiene la búsqueda de identidades",async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(findOpenAlexAuthorIdentity("Dinora Hernández",{
    signal:controller.signal,
    fetchImpl:async()=>{throw new Error("must not fetch")}
  }),{name:"AbortError"});
});

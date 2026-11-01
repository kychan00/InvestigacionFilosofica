import test from "node:test";
import assert from "node:assert/strict";
import {
  matchAuthorName,
  chooseSnapshotAuthorIdentity,
  findSnapshotAuthorIdentity
} from "../src/core/author-identity-lookup.js";

const author={
  id:"7654321",
  displayName:"Dinora Hernández López",
  sourceDisplayName:"Dinora Hernández López",
  orcid:"https://orcid.org/0000-0002-1234-5678",
  corpusWorks:28
};
const candidate=(id,name,orcid=null,cw=4)=>({
  id,n:name,o:orcid,cw,k:"full"
});

test("normaliza acentos y admite las variantes del nombre",()=>{
  assert.equal(matchAuthorName("Dinora Hernández",{
    display_name:"Dinora Hernández López",
    display_name_alternatives:["Dinora Hernandez"]
  }),"exact");
  assert.equal(matchAuthorName("Dinora Hernández",{
    display_name:"Dinora Hernández López"
  }),"partial");
});

test("resuelve autor desde índice estático de Hugging Face, sin HTTP a OpenAlex",async()=>{
  let calls=0;
  const lookup=await findSnapshotAuthorIdentity("Dinora Hernández",{
    resolverImpl:async(name,options)=>{
      calls++;
      assert.equal(name,"Dinora Hernández");
      assert.equal(options.includeProfile,false);
      return {status:"resolved",author,works:[]};
    }
  });
  assert.equal(calls,1);
  assert.equal(lookup.status,"resolved");
  assert.equal(lookup.candidate.id,author.id);
  assert.equal(lookup.candidate.n,author.displayName);
  assert.match(lookup.provider,/Hugging Face/);
});

test("con ORCID no acepta una identidad diferente",()=>{
  const wrong=chooseSnapshotAuthorIdentity("Dinora Hernández",{
    status:"resolved",author
  },{orcid:"0000-0003-0000-0000"});
  assert.equal(wrong.status,"none");
});

test("ORCID selecciona sólo al candidato inequívoco",()=>{
  const resolution=chooseSnapshotAuthorIdentity("Dinora Hernández",{
    status:"ambiguous",candidates:[
      candidate("123","Dinora Hernández","https://orcid.org/0000-0001-1111-1111"),
      candidate("234","Dinora Hernández","https://orcid.org/0000-0002-1234-5678")
    ]
  },{orcid:"0000-0002-1234-5678"});
  assert.equal(resolution.status,"resolved");
  assert.equal(resolution.candidate.id,"234");
});

test("homónimos permanecen como elección explícita",()=>{
  const resolution=chooseSnapshotAuthorIdentity("Dinora Hernández",{
    status:"ambiguous",candidates:[
      candidate("123","Dinora Hernández López",null,100),
      candidate("234","Dinora Hernández Gómez",null,2)
    ]
  });
  assert.equal(resolution.status,"ambiguous");
  assert.equal(resolution.candidates.length,2);
});

test("si el archivo no incluye a la autora, permite complementar con Crossref",async()=>{
  const found=await findSnapshotAuthorIdentity("Dinora Hernández",{
    resolverImpl:async()=>({status:"none",candidates:[]})
  });
  assert.equal(found.status,"none");
});

test("un error de descarga del índice no activa OpenAlex API",async()=>{
  const found=await findSnapshotAuthorIdentity("Dinora Hernández",{
    resolverImpl:async()=>{throw new Error("snapshot HTTP 503")}
  });
  assert.equal(found.status,"unavailable");
  assert.match(found.error,/503/);
});

test("abort no relanza solicitudes externas",async()=>{
  const c=new AbortController();c.abort();
  await assert.rejects(findSnapshotAuthorIdentity("Dinora Hernández",{
    signal:c.signal,
    resolverImpl:async()=>{throw new DOMException("Aborted","AbortError")}
  }),{name:"AbortError"});
});

test("Dra., Dinora Hernández y Hernández López se agrupan por ORCID",()=>{
 const res=chooseSnapshotAuthorIdentity("Dra Dinora Hernández",{
  status:"candidates",
  candidates:[
    candidate("7654321","Dra Dinora Hernández","https://orcid.org/0000-0002-1234-5678",3),
    candidate("7654322","Dinora Hernández López","https://orcid.org/0000-0002-1234-5678",9)
  ]
 });
 assert.equal(res.status,"resolved");
 assert.equal(res.joinedBy,"orcid");
 assert.equal(res.candidate.n,"Dinora Hernández López");
 assert.deepEqual(res.candidate.linkedAuthorIds,["7654322","7654321"]);
 assert.equal(res.candidate.aliases.includes("Dinora Hernández"),true);
});

test("títulos académicos se normalizan sin atribuir homónimos",()=>{
 assert.equal(matchAuthorName("Dra Dinora Hernández",{
  display_name:"Dinora Hernández López"
 }),"partial");
 const res=chooseSnapshotAuthorIdentity("Dinora Hernández",{
  status:"candidates",candidates:[
    candidate("123","Dinora Hernández López",null,5),
    candidate("124","Dinora Hernández Gómez",null,3)
  ]
 });
 assert.equal(res.status,"ambiguous");
});

test("una búsqueda por alias del índice no se sustituye por API externa",async()=>{
 const found=await findSnapshotAuthorIdentity("Dra Dinora Hernández",{
  candidatesImpl:async()=>[
    candidate("5","Dinora Hernández",null,3)
  ]
 });
 assert.equal(found.status,"resolved");
 assert.equal(found.candidate.id,"5");
});

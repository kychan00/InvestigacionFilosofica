import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHOR_SNAPSHOT_SOURCE,
  discoverAuthorArchive,
  fetchAuthorWorksFromSnapshot,
  mergeAuthorArchives
} from "../src/core/author-deep-discovery.js";

const author={
  id:"5082752736",displayName:"Ángeles Eraña",
  orcid:"https://orcid.org/0000-0002-8595-8693",
  corpusWorks:2
};
const work=(id,title,year)=>({
  id:"https://openalex.org/W"+id,title,year,
  providers:[AUTHOR_SNAPSHOT_SOURCE],
  authors:[{id:"https://openalex.org/A"+author.id,name:author.displayName}]
});

test("el índice de Hugging Face devuelve todas las obras indexadas del ID",async()=>{
  let requested=null;
  const result=await fetchAuthorWorksFromSnapshot({
    authorId:author.id,displayName:author.displayName,orcid:author.orcid,
    resolverImpl:async(candidate,options)=>{
      requested={candidate,options};
      return {status:"resolved",author:{corpusWorks:4},
        works:[work(1,"Primera",2001),work(2,"Segunda",2002),
          work(3,"Tercera",2003),work(4,"Cuarta",2004)]};
    }
  });
  assert.equal(requested.candidate.id,author.id);
  assert.equal(requested.options.limit,5000);
  assert.equal(result.total,4);
  assert.equal(result.complete,true);
  assert.equal(result.works.length,4);
  assert.equal(result.pages,1);
});

test("marcamos la cobertura parcial, sin inventar obras ausentes del corpus",async()=>{
  const result=await fetchAuthorWorksFromSnapshot({
    authorId:author.id,
    resolverImpl:async()=>({
      status:"resolved",author:{corpusWorks:20},
      works:[work(1,"Primera",2001),work(2,"Segunda",2002)]
    })
  });
  assert.equal(result.complete,false);
  assert.equal(result.reason,"snapshot-index-partial");
  assert.equal(result.total,20);
});

test("las dos obras de Ángeles Eraña se amplían SIN red de OpenAlex",async()=>{
  const initial=[work(1,"Primera",2001),work(2,"Segunda",2002)];
  const states=[];
  let snapshotCalled=false;
  let federatedCalled=false;
  const result=await discoverAuthorArchive({
    author,initialWorks:initial,
    snapshotImpl:async args=>{
      snapshotCalled=true;
      assert.equal(args.authorId,author.id);
      return {
        works:[work(1,"Primera",2001),work(2,"Segunda",2002),
          work(3,"Tercera",2003)],
        total:3,complete:true
      };
    },
    federatedImpl:async name=>{
      federatedCalled=true;
      assert.equal(name,author.displayName);
      return {
        status:"resolved",author:{catalogSources:["Crossref"]},
        works:[{id:"crossref-4",title:"Cuarta",year:2004,
          doi:"10.1234/four",providers:["Crossref"]}]
      };
    },
    onProgress:x=>states.push(x)
  });
  assert.ok(snapshotCalled&&federatedCalled);
  assert.equal(result.works.length,4);
  assert.deepEqual(new Set(result.sources),
    new Set([AUTHOR_SNAPSHOT_SOURCE,"Crossref"]));
  assert.equal(result.snapshotComplete,true);
  assert.equal(states[0].works.length,2);
  assert.equal(states.at(-1).works.length,4);
});

test("el índice no disponible conserva las obras iniciales y no consume tokens",async()=>{
  const result=await discoverAuthorArchive({
    author,initialWorks:[work(1,"Primera",2001)],
    snapshotImpl:async()=>{throw new Error("HF storage temporarily unavailable")},
    federatedImpl:async()=>({status:"none",works:[]})
  });
  assert.equal(result.works.length,1);
  assert.equal(result.complete,false);
  assert.match(result.errors.join(" "),/Hugging Face/);
});

test("sin ID OpenAlex sólo se complementa con Crossref y otras fuentes",async()=>{
  let called=false;
  const result=await discoverAuthorArchive({
    author:{displayName:"Dinora Hernández"},
    snapshotImpl:async()=>{called=true;throw new Error("unexpected call")},
    federatedImpl:async()=>({
      status:"resolved",author:{catalogSources:["Crossref"]},
      works:[{id:"crossref-d",title:"Ensayo",year:2024,providers:["Crossref"]}]
    })
  });
  assert.equal(called,false);
  assert.equal(result.works.length,1);
});

test("la unión elimina duplicados y preserva las fuentes complementarias",()=>{
  const found=mergeAuthorArchives([
    work(10,"Pensamiento y lenguaje",2020)
  ],[
    {id:"crossref-x",title:"Pensamiento y lenguaje",year:2020,
      doi:"10.1/abcd",providers:["Crossref"]}
  ]);
  assert.equal(found.length,1);
  assert.ok(found[0].providers.includes("Crossref"));
  assert.ok(found[0].providers.includes(AUTHOR_SNAPSHOT_SOURCE));
});

test("las consultas canceladas no entregan fichas de otro autor",async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(fetchAuthorWorksFromSnapshot({
    authorId:author.id,signal:controller.signal,
    resolverImpl:async()=>{throw new Error("must not be called")}
  }),{name:"AbortError"});
});

test("la búsqueda académica de perfiles jamás utiliza api.openalex.org",async()=>{
  const {readFile}=await import("node:fs/promises");
  for(const path of [
    "../src/core/author-deep-discovery.js",
    "../src/core/author-identity-lookup.js"
  ]) {
    const source=await readFile(new URL(path,import.meta.url),"utf8");
    assert.equal(source.includes('https://api.openalex.org/'),false,path);
    assert.equal(source.includes('new URL("works",apiBase)'),false,path);
    assert.equal(source.includes('new URL("authors",apiBase)'),false,path);
  }
});

test("fusiona IDs respaldados por el mismo ORCID sin duplicar colaboraciones",async()=>{
 const ids=[];
 const result=await fetchAuthorWorksFromSnapshot({
  authorId:"7654321",displayName:"Dinora Hernández López",
  linkedAuthorIds:["7654322","7654321"],
  orcid:"https://orcid.org/0000-0002-1234-5678",
  enrichCollaborators:false,
  resolverImpl:async candidate=>{
    ids.push(candidate.id);
    return {status:"resolved",author:{corpusWorks:2},works:
      candidate.id==="7654321"
      ?[work(101,"Obra conjunta",2021),work(102,"Primera",2022)]
      :[work(101,"Obra conjunta",2021),work(103,"Segunda",2023)]};
  }
 });
 assert.deepEqual(ids,["7654321","7654322"]);
 assert.equal(result.works.length,3);
 assert.equal(result.total,3);
 assert.equal(result.complete,true);
});

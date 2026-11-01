import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverAuthorArchive,
  fetchAuthorWorksOpenAlex,
  mergeAuthorArchives
} from "../src/core/author-deep-discovery.js";

const id="5082752736";
const orcid="https://orcid.org/0000-0002-8595-8693";
const author={id,displayName:"Ángeles Eraña",orcid,corpusWorks:2};
function record(workId,title,year,authorId=id,date=null) {
  return {
    id:"https://openalex.org/W"+workId,title,display_name:title,
    publication_year:year,publication_date:date||String(year)+"-01-01",
    type:"article",language:"es",doi:"https://doi.org/10.1234/"+workId,
    authorships:[{author:{id:"https://openalex.org/A"+authorId,
      display_name:"Ángeles Eraña",orcid}}],
    open_access:{is_oa:false},primary_location:null,cited_by_count:0
  };
}
function response(value,status=200) {
  return {ok:status>=200&&status<300,status,json:async()=>value};
}
const makeFetch=()=>{
 const urls=[];
 const fetchImpl=async url=>{
  const parsed=new URL(url);
  urls.push(parsed);
  assert.equal(parsed.origin,"https://api.openalex.org");
  assert.equal(parsed.pathname,"/works");
  assert.equal(parsed.searchParams.get("filter"),"authorships.author.id:A"+id);
  assert.equal(parsed.searchParams.get("corpus"),"all");
  assert.equal(parsed.searchParams.get("per_page"),"2");
  assert.equal(parsed.searchParams.get("select").includes("authorships"),true);
  const cursor=parsed.searchParams.get("cursor");
  if(cursor==="*"){
   return response({
    meta:{count:4,next_cursor:"page-two"},
    results:[record(1,"Primera obra",2015),record(2,"Segunda obra",2017)]
   });
  }
  if(cursor==="page-two") {
   return response({
    meta:{count:4,next_cursor:null},
    results:[
      record(3,"Tercera obra",2022,id,"2022-10-13"),
      record(4,"No corresponde a Eraña",2023,"19999999")
    ]
   });
  }
  throw Error("Unexpected cursor "+cursor);
 };
 return {urls,fetchImpl};
};

test("la consulta profunda usa el ID exacto, recorre cursor y no confunde otros autores",async()=>{
 const {urls,fetchImpl}=makeFetch();
 const progress=[];
 const result=await fetchAuthorWorksOpenAlex({
  authorId:id,displayName:author.displayName,orcid,
  fetchImpl,pageSize:2,onPage:info=>progress.push(info),
 });
 assert.equal(result.pages,2);
 assert.equal(result.total,4);
 assert.equal(result.complete,true);
 assert.deepEqual(result.works.map(x=>x.title),[
  "Primera obra","Segunda obra","Tercera obra"
 ]);
 assert.equal(result.works[2].publicationDate,"2022-10-13");
 assert.equal(result.works.every(x=>x.relevanceLevel===undefined),true);
 assert.equal(progress.length,2);
 assert.equal(urls.length,2);
});

test("Ángeles Eraña: dos obras del índice se amplían con catálogos profundos verificables",async()=>{
 const {fetchImpl}=makeFetch();
 const initial=[
  {id:"https://openalex.org/W1",title:"Primera obra",year:2015,
    authors:[{id:"https://openalex.org/A"+id,name:"Ángeles Eraña"}],
    providers:["OpenAlex Philosophy"]},
  {id:"https://openalex.org/W2",title:"Segunda obra",year:2017,
    providers:["OpenAlex Philosophy"]}
 ];
 const states=[];
 const result=await discoverAuthorArchive({
  author,initialWorks:initial,fetchImpl,
  openAlexOptions:{pageSize:2},
  federatedImpl:async(name,options)=>{
   assert.equal(name,"Ángeles Eraña");
   assert.equal(options.orcid,orcid);
   return {
    status:"resolved",
    author:{catalogSources:["Crossref"]},
    works:[
      {id:"crossref-new",title:"Cuarta obra",year:2025,doi:"10.1234/fourth",
        providers:["Crossref"],authors:[{name:"Ángeles Eraña",id:orcid}]},
      {id:"crossref-duplicate",title:"Segunda obra",year:2017,
        providers:["Crossref"],authors:[{name:"Ángeles Eraña",id:orcid}]}
    ]
   };
  },
  onProgress:data=>states.push(data)
 });
 assert.equal(result.works.length,4);
 assert.equal(new Set(result.works.map(x=>x.title)).size,4);
 assert.ok(result.works.some(x=>x.title==="Cuarta obra"));
 assert.ok(result.sources.includes("Crossref"));
 assert.ok(result.sources.includes("OpenAlex"));
 assert.equal(result.openAlexComplete,true);
 assert.ok(states.some(s=>s.works.length>=3));
 assert.ok(states[0].works.length===2);
 assert.ok(states.at(-1).works.length===4);
});

test("la API no disponible deja obras iniciales visibles y marca consulta parcial",async()=>{
 const result=await discoverAuthorArchive({
  author,initialWorks:[{id:"one",title:"Obra inicial",year:2020,
    providers:["OpenAlex Philosophy"]}],
  fetchImpl:async()=>response({error:"Requires API key"},401),
  federatedImpl:async()=>({status:"none",works:[]})
 });
 assert.equal(result.works.length,1);
 assert.equal(result.complete,false);
 assert.match(result.errors.join(" "),/HTTP 401/);
});

test("con ausencia de ID sólo se agregan referencias verificadas de Crossref",async()=>{
 let fetched=false;
 const result=await discoverAuthorArchive({
  author:{displayName:"Ángeles Eraña",orcid},
  initialWorks:[],
  fetchImpl:async()=>{fetched=true;throw Error("Should not call OpenAlex without ID")},
  federatedImpl:async()=>({
    status:"resolved",author:{catalogSources:["Crossref"]},
    works:[{id:"crossref-2024",title:"Ensayo",year:2024,providers:["Crossref"]}]
  })
 });
 assert.equal(fetched,false);
 assert.equal(result.works.length,1);
});

test("los duplicados se unen por título/año cuando los proveedores tienen IDs distintos",()=>{
 const found=mergeAuthorArchives([
  {id:"https://openalex.org/W10",title:"Pensamiento y lenguaje",year:2020,providers:["OpenAlex Philosophy"]}
 ],[
  {id:"crossref-x",title:"Pensamiento y lenguaje",year:2020,doi:"10.1/abcd",providers:["Crossref"]}
 ]);
 assert.equal(found.length,1);
 assert.ok(found[0].providers.includes("Crossref"));
 assert.ok(found[0].providers.includes("OpenAlex Philosophy"));
 assert.equal(found[0].doi,"10.1/abcd");
});

test("la cancelación de una búsqueda de autor no entrega datos obsoletos",async()=>{
 const controller=new AbortController();
 controller.abort();
 await assert.rejects(
  fetchAuthorWorksOpenAlex({authorId:id,fetchImpl:async()=>response({results:[]}),
    signal:controller.signal}),
  {name:"AbortError"}
 );
});

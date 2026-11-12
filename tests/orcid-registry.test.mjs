import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchOrcidPublicWorks, normalizeOrcidPublicWorks
} from "../src/sources/orcid.js";
import {
  mergeAuthorArchives, discoverAuthorArchive
} from "../src/core/author-deep-discovery.js";
import { authorWorkSources } from "../src/core/author-provenance.js";

const ORCID = "0000-0002-7283-8051";
const profile = "https://orcid.org/" + ORCID;
function record(title, putCode, year, options = {}) {
  return {
    "put-code": putCode,
    visibility: options.visibility || "public",
    title: { title: { value: title } },
    "publication-date": year ? {
      year: { value: String(year) },
      ...(options.month ? {month: {value: String(options.month)}} : {})
    } : null,
    type: options.type || "journal-article",
    "external-ids": {"external-id": options.doi ? [{
      "external-id-type": "doi", "external-id-value": options.doi,
      "external-id-relationship": "self"
    }] : [] },
    url: { value: options.url || "https://example.org/work/" + putCode }
  };
}
const groups = (...records) => ({
  group: records.map(item =>
    Array.isArray(item) ? {"work-summary": item}
      : {"work-summary": [item]})
});

test("ORCID extrae cada grupo público con título, DOI, año, fuente y URL", () => {
  const response = normalizeOrcidPublicWorks(groups(
    record("La crítica del poder",101,2021,
      {month:6,doi:"https://doi.org/10.24215/18524907e052"}),
    record("Sobre la filosofía",102,2018),
    record("Revista editada",103,null)
  ), {orcid:ORCID,displayName:"Mauricio Méndez Huerta"});
  assert.equal(response.totalGroups, 3);
  assert.equal(response.works.length, 3);
  const first = response.works[0];
  assert.equal(first.title, "La crítica del poder");
  assert.equal(first.year, 2021);
  assert.equal(first.month, 6);
  assert.equal(first.publicationDate, "2021-06");
  assert.equal(first.type, "journal-article");
  assert.equal(first.doi,"10.24215/18524907e052");
  assert.equal(first.sourceRecords[0].provider, "ORCID");
  assert.ok(first.sourceLinks[0].url === profile);
  assert.ok(first.providers.includes("ORCID"));
  assert.equal(first.orcidRecord,true);
  assert.equal(first.authors[0].name,"Mauricio Méndez Huerta");
  assert.equal(response.works[2].year, null);
});

test("agrupa versiones equivalentes de ORCID, preservando dos put-codes", () => {
  const response = normalizeOrcidPublicWorks(groups([
    record("Un artículo", 333, 2023),
    record("Un artículo", 334, 2023,
      {doi:"10.5555/important",month:9})
  ]), {orcid:ORCID});
  assert.equal(response.works.length,1);
  assert.equal(response.works[0].sourceRecords.length,2);
  assert.equal(response.works[0].doi,"10.5555/important");
  assert.equal(response.works[0].month, null,
    "la fecha no debe unir años y meses de versiones distintas");
});

test("no inventa resultados ante API inválida, caída o sin consentimiento público",async()=>{
  await assert.rejects(fetchOrcidPublicWorks(ORCID,{
    fetchImpl:async()=>({ok:false,status:429})
  }), /ORCID HTTP 429/);
  await assert.rejects(fetchOrcidPublicWorks(ORCID,{
    fetchImpl:async()=>({ok:true,json:async()=>({error:"blocked"})})
  }), /no contiene grupos/);
  const empty=await fetchOrcidPublicWorks("not-an-id",{
    fetchImpl:async()=>{throw Error("must not fetch")}
  });
  assert.equal(empty.works.length,0);
  assert.equal(empty.skipped,"invalid-orcid");
});

test("consume /v3.0/{ORCID}/works y no consulta por apellido ni usa tokens secretos",async()=>{
  const urls=[];
  const response=await fetchOrcidPublicWorks(profile,{
    displayName:"Mauricio Méndez Huerta",
    fetchImpl:async(url,options)=>{
      urls.push({url,options});
      return {ok:true,json:async()=>groups(record("Obra",99,2020))};
    }
  });
  assert.equal(urls[0].url,
    "https://pub.orcid.org/v3.0/" + ORCID + "/works");
  assert.equal(urls[0].options.headers.Accept,
    "application/vnd.orcid+json");
  assert.equal(urls[0].options.headers.Authorization,undefined);
  assert.equal(response.returnedWorks,1);
});

test("bibliografía pública ORCID se integra con Crossref e Internet Archive sin perder las 17 obras",async()=>{
  const registry = normalizeOrcidPublicWorks(groups(
    ...Array.from({length:17},(_,index)=>record(
      "Publicación ORCID "+(index+1),100+index,2010+index,
      index===0?{doi:"10.5555/unique"}:{}
    ))
  ),{orcid:ORCID,displayName:"Mauricio Méndez Huerta"});
  const progress=[];
  const archive = await discoverAuthorArchive({
    author:{displayName:"Mauricio Méndez Huerta",orcid:ORCID},
    initialWorks:[{id:"crossref:10.5555/unique",title:"Publicación ORCID 1",
      year:2010,doi:"10.5555/unique",providers:["Crossref"]}],
    federatedImpl:async()=>({status:"resolved",
      author:{catalogSources:["Internet Archive"]},
      works:[{id:"ia:another",title:"Publicación ORCID 2",year:2011,
        providers:["Internet Archive"]}]}),
    orcidSearchImpl:async()=>({works:[],complete:true}),
    orcidRegistryImpl:async id=>{
      assert.equal(id,ORCID);
      return registry;
    },
    onProgress:step=>progress.push(step)
  });
  assert.equal(archive.orcidSummary.totalGroups,17);
  assert.equal(archive.orcidSummary.returnedWorks,17);
  assert.equal(archive.works.length,17);
  assert.ok(archive.sources.includes("ORCID"));
  assert.deepEqual(new Set(authorWorkSources(archive.works.find(item =>
    item.title==="Publicación ORCID 1"))),new Set(["Crossref","ORCID"]));
  assert.deepEqual(new Set(authorWorkSources(archive.works.find(item =>
    item.title==="Publicación ORCID 2"))),new Set(["Internet Archive","ORCID"]));
  assert.ok(progress.some(x=>x.source==="ORCID" && x.orcidSummary?.totalGroups===17));
});

test("una caída de ORCID se informa sin descartar los resultados de otros catálogos", async()=>{
  const found=await discoverAuthorArchive({
    author:{displayName:"Mauricio Méndez Huerta",orcid:ORCID},
    initialWorks:[{title:"Obra inicial",year:2019,providers:["Crossref"]}],
    federatedImpl:async()=>({status:"none",works:[]}),
    orcidSearchImpl:async()=>({works:[],complete:true}),
    orcidRegistryImpl:async()=>{throw new Error("ORCID HTTP 503")}
  });
  assert.equal(found.works.length,1);
  assert.ok(found.errors.some(x=>x.includes("Registro público ORCID")));
  assert.equal(found.orcidSummary.error,"No disponible");
  assert.ok(!found.sources.includes("ORCID"));
});

test("fusión ORCID + Crossref conserva el registro público como procedencia",()=>{
  const registry=normalizeOrcidPublicWorks(groups(
    record("Publicación sobre memoria",123,2016,
      {doi:"10.1234/shared"})),{orcid:ORCID});
  const joined=mergeAuthorArchives([{
    title:"Publicación sobre memoria",year:2016,doi:"10.1234/shared",
    providers:["Crossref"]
  }],registry.works);
  assert.equal(joined.length,1);
  assert.equal(joined[0].orcidRecord,true);
  assert.deepEqual(new Set(joined[0].providers),new Set(["Crossref","ORCID"]));
});

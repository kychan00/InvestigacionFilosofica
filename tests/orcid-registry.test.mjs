import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchOrcidPublicWorks,
  fetchOrcidPublicProfile,
  normalizeOrcidPublicWorks,
  normalizeOrcidPublicProfile
} from "../src/sources/orcid.js";
import {
  mergeAuthorArchives, discoverAuthorArchive
} from "../src/core/author-deep-discovery.js";
import { authorWorkSources } from "../src/core/author-provenance.js";

const ORCID = "0000-0002-7283-8051";
const profile = "https://orcid.org/" + ORCID;
const emptyProfile = async () => ({
  orcid: ORCID,
  hasPublicProfileData: false,
  source: "ORCID"
});

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

test("limpia HTML y entidades incrustadas en títulos ORCID", () => {
  const response = normalizeOrcidPublicWorks(groups(
    record("<b>Argumentación &amp; Inteligencia Artificial</b>", 150, 2026)
  ), {orcid:ORCID,displayName:"Autor de prueba"});
  assert.equal(response.works.length, 1);
  assert.equal(
    response.works[0].title,
    "Argumentación & Inteligencia Artificial"
  );
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
    orcidProfileImpl:emptyProfile,
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
    orcidRegistryImpl:async()=>{throw new Error("ORCID HTTP 503")},
    orcidProfileImpl:emptyProfile
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


test("ORCID normaliza biografía, empleo, educación y reconocimientos públicos",()=>{
  const payload={
    person:{
      name:{
        "given-names":{value:"Ana"},
        "family-name":{value:"Investigadora"},
        "credit-name":{value:"A. Investigadora"}
      },
      biography:{content:"Filósofa e investigadora en ética aplicada."},
      keywords:{keyword:[
        {content:"ética",visibility:"public"},
        {content:"filosofía política",visibility:"public"}
      ]},
      address:{address:[
        {country:{value:"MX"},visibility:"public"}
      ]},
      "researcher-urls":{"researcher-url":[
        {"url-name":"Perfil institucional",url:{value:"https://example.edu/ana"},visibility:"public"}
      ]}
    },
    "activities-summary":{
      employments:{"employment-summary":[{
        visibility:"public",
        "department-name":"Departamento de Filosofía",
        "role-title":"Profesora investigadora",
        "start-date":{year:{value:"2020"}},
        "end-date":null,
        organization:{name:"Universidad Ejemplo",address:{city:"Guadalajara",country:"MX"}}
      }]},
      educations:{"education-summary":[{
        visibility:"public",
        "role-title":"Doctorado en Filosofía",
        "end-date":{year:{value:"2019"}},
        organization:{name:"Universidad Doctoral",address:{country:"MX"}}
      }]},
      distinctions:{"distinction-summary":[{
        visibility:"public",
        "role-title":"Premio de Investigación",
        organization:{name:"Academia Ejemplo",address:{country:"MX"}}
      }]},
      memberships:{"membership-summary":[{
        visibility:"public",
        "role-title":"Miembro",
        organization:{name:"Sociedad Filosófica",address:{country:"MX"}}
      }]},
      fundings:{group:[{"funding-summary":[{
        visibility:"public",
        title:{title:{value:"Proyecto sobre justicia"}},
        type:"GRANT",
        organization:{name:"Consejo de Investigación"}
      }]}]}
    }
  };
  const parsed=normalizeOrcidPublicProfile(payload,{orcid:ORCID});
  assert.equal(parsed.displayName,"A. Investigadora");
  assert.equal(parsed.biography,"Filósofa e investigadora en ética aplicada.");
  assert.equal(parsed.employments[0].organization,"Universidad Ejemplo");
  assert.equal(parsed.employments[0].role,"Profesora investigadora");
  assert.equal(parsed.educations[0].role,"Doctorado en Filosofía");
  assert.equal(parsed.distinctions[0].role,"Premio de Investigación");
  assert.equal(parsed.memberships[0].organization,"Sociedad Filosófica");
  assert.equal(parsed.fundings[0].title,"Proyecto sobre justicia");
  assert.deepEqual(parsed.keywords,["ética","filosofía política"]);
  assert.deepEqual(parsed.countries,["MX"]);
  assert.equal(parsed.websites[0].url,"https://example.edu/ana");
  assert.equal(parsed.hasPublicProfileData,true);
});

test("ORCID no inventa biografía cuando el registro sólo contiene obras",()=>{
  const parsed=normalizeOrcidPublicProfile({
    person:{name:{
      "given-names":{value:"Mauricio"},
      "family-name":{value:"Méndez"}
    }},
    "activities-summary":{}
  },{orcid:ORCID});
  assert.equal(parsed.displayName,"Mauricio Méndez");
  assert.equal(parsed.biography,null);
  assert.equal(parsed.employments.length,0);
  assert.equal(parsed.educations.length,0);
  assert.equal(parsed.distinctions.length,0);
  assert.equal(parsed.hasPublicProfileData,false);
});

test("perfil ORCID consume /record sin credenciales embebidas",async()=>{
  const calls=[];
  const profileResult=await fetchOrcidPublicProfile(ORCID,{
    fetchImpl:async(url,options)=>{
      calls.push({url,options});
      return {ok:true,json:async()=>({
        person:{name:{"given-names":{value:"Ana"},"family-name":{value:"Investigadora"}}},
        "activities-summary":{}
      })};
    }
  });
  assert.equal(calls[0].url,
    "https://pub.orcid.org/v3.0/"+ORCID+"/record");
  assert.equal(calls[0].options.headers.Accept,"application/vnd.orcid+json");
  assert.equal(calls[0].options.headers.Authorization,undefined);
  assert.equal(profileResult.displayName,"Ana Investigadora");
});

test("discoverAuthorArchive entrega el perfil ORCID junto a la bibliografía",async()=>{
  const authorProfile={
    orcid:ORCID,
    biography:"Investigadora de prueba",
    employments:[],
    educations:[],
    distinctions:[],
    qualifications:[],
    memberships:[],
    services:[],
    invitedPositions:[],
    fundings:[],
    keywords:[],
    countries:[],
    websites:[],
    hasPublicProfileData:true,
    source:"ORCID"
  };
  const found=await discoverAuthorArchive({
    author:{displayName:"Ana Investigadora",orcid:ORCID},
    initialWorks:[],
    federatedImpl:async()=>({status:"none",works:[]}),
    orcidRegistryImpl:async()=>({
      works:[],totalGroups:0,returnedWorks:0,complete:true
    }),
    orcidSearchImpl:async()=>({works:[],complete:true}),
    orcidProfileImpl:async()=>authorProfile
  });
  assert.equal(found.orcidProfile.biography,"Investigadora de prueba");
  assert.equal(found.orcidProfile.source,"ORCID");
});

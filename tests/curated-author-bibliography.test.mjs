import test from "node:test";
import assert from "node:assert/strict";
import {
  findCuratedAuthorIdentity
} from "../src/core/author-curated-identities.js";
import {
  getCuratedAuthorBibliography
} from "../src/core/curated-author-bibliography.js";
import {
  mergeAuthorArchives,
  discoverAuthorArchive
} from "../src/core/author-deep-discovery.js";

test("Dinora Hernández, Dra. Dinora Hernández y Dinora Hernández López son la misma identidad curada",()=>{
  for (const name of [
    "Dinora Hernández",
    "Dinora Hernandez",
    "Dra Dinora Hernández",
    "Dinora Hernández López"
  ]) {
    const identity=findCuratedAuthorIdentity(name);
    assert.ok(identity,name);
    assert.equal(identity.canonicalName,"Dinora Hernández López");
    assert.equal(identity.orcid,"0000-0001-7335-1790");
  }
});


test("un authorId explícito de un homónimo no hereda la bibliografía curada por nombre",()=>{
  const result=getCuratedAuthorBibliography({
    id:"https://openalex.org/A9999999999",
    displayName:"Dinora Hernández"
  });
  assert.equal(result.works.length,0);

  const wrongOrcid=getCuratedAuthorBibliography({
    displayName:"Dinora Hernández",
    orcid:"https://orcid.org/0000-0002-2222-2222"
  });
  assert.equal(wrongOrcid.works.length,0);
});

test("la bibliografía verificada de Dinora contiene una cobertura sustancial y metadatos autoritativos",()=>{
  const result=getCuratedAuthorBibliography({
    displayName:"Dra Dinora Hernández"
  });
  assert.equal(result.author.canonicalName,"Dinora Hernández López");
  assert.ok(result.works.length>=20);
  assert.ok(result.works.some(work=>
    work.title.startsWith("Para una Teoría Crítica del racismo") &&
    work.year===2021 &&
    work.doi==="10.31391/sfj1e026"));
  assert.ok(result.works.some(work=>
    work.title.startsWith("Feminicidio:") &&
    work.year===2024 &&
    work.doi==="10.22201/cieg.2594066xe.2024.67.2403"));
  assert.ok(result.works.some(work=>
    work.title.startsWith("Después del #MeToo") &&
    work.year===2025));
});

test("la bibliografía verificada corrige años espurios de catálogos automáticos",()=>{
  const curated=getCuratedAuthorBibliography({
    displayName:"Dinora Hernández López"
  }).works;
  const noisy=[
    {
      id:"ia:perspectiva",
      title:"La Perspectiva De La Imbricacion Aportaciones Teórico Metodológicas A La Crítica De La Violencia Contra Las Mujeres, Dinora Hernández",
      year:1900,authors:[{name:"Dinora Hernández"}],
      providers:["Internet Archive"],
      retrievalMode:"author-internet-archive"
    },
    {
      id:"ia:frankfurt",
      title:"La Escuela De Frankfurt Un Acercamiento A Su Filosofía Del Poder, Dinora Hernández",
      year:2010,authors:[{name:"Dinora Hernández"}],
      providers:["Internet Archive"],
      retrievalMode:"author-internet-archive"
    },
    {
      id:"ia:adorno",
      title:"Dra Dinora Hernández, Theodor W Adorno Resistencia Y Briznas",
      year:2022,authors:[{name:"Dra Dinora Hernández"}],
      providers:["Internet Archive"],
      retrievalMode:"author-internet-archive"
    }
  ];
  const merged=mergeAuthorArchives(noisy,curated);
  assert.ok(!merged.some(work=>work.year===1900));
  assert.ok(!merged.some(work=>
    /Escuela De Frankfurt Un Acercamiento/i.test(work.title)&&work.year===2010));
  assert.ok(!merged.some(work=>
    /Theodor W Adorno Resistencia Y Briznas/i.test(work.title)&&work.year===2022));
  assert.ok(merged.some(work=>
    work.title.startsWith("La perspectiva de la imbricación")&&work.year===2026));
  assert.ok(merged.some(work=>
    work.title.startsWith("La Escuela de Frankfurt.")&&work.year===2013));
  assert.ok(merged.some(work=>
    work.title.startsWith("Theodor W. Adorno:")&&work.year===2023));
});

test("discoverAuthorArchive integra la bibliografía verificada aunque Hugging Face no tenga a la autora",async()=>{
  const federatedWorks=[{
    id:"ia:one",
    title:"Theodor W. Adorno: resistencia y briznas de vida moral",
    year:2022,
    authors:[{name:"Dra Dinora Hernández"}],
    providers:["Internet Archive"],
    retrievalMode:"author-internet-archive"
  }];
  const result=await discoverAuthorArchive({
    author:{
      displayName:"Dinora Hernández López",
      sourceDisplayName:"Dinora Hernández López",
      orcid:"https://orcid.org/0000-0001-7335-1790",
      aliases:["Dra Dinora Hernández","Dinora Hernández"]
    },
    initialWorks:[],
    snapshotImpl:async()=>({
      works:[],total:null,complete:false,pages:0,reason:"no-id"
    }),
    federatedImpl:async()=>({
      status:"resolved",
      works:federatedWorks,
      author:{catalogSources:["Internet Archive"]}
    })
  });
  assert.ok(result.works.length>=20);
  assert.ok(result.sources.includes("Bibliografía verificada"));
  const adorno=result.works.filter(work=>
    work.title.startsWith("Theodor W. Adorno: resistencia"));
  assert.equal(adorno.length,1);
  assert.equal(adorno[0].year,2023);
  assert.equal(adorno[0].metadataAuthority,"curated");
  assert.equal(result.complete,false);
});

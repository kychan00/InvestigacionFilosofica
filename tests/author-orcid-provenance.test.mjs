import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizedAuthorOrcid, authorOrcidUrl,
  authorWorkSources, workHasAuthorOrcidEvidence
} from "../src/core/author-provenance.js";
import {
  mergeAuthorArchives, discoverAuthorArchive
} from "../src/core/author-deep-discovery.js";
import { searchCrossrefByOrcid } from "../src/sources/crossref.js";

const ORCID = "0000-0002-1825-0097";
const otherOrcid = "0000-0001-5555-5555";

test("ORCID del investigador se normaliza; no se aceptan URLs arbitrarias", () => {
  assert.equal(normalizedAuthorOrcid("https://orcid.org/" + ORCID), ORCID);
  assert.equal(authorOrcidUrl(ORCID), "https://orcid.org/" + ORCID);
  assert.equal(authorOrcidUrl("javascript:alert(1)"), null);
  assert.equal(authorOrcidUrl("https://other.example/" + ORCID), null);
});

test("las obras y la cronología distinguen fuentes reales del identificador ORCID", () => {
  const work = {
    providers: ["Crossref", "Crossref"],
    sourceRecords: [{provider: "Internet Archive"}, {provider: "Crossref"}],
    sourceLinks: [{provider: "CUCSH Filosofía"}],
    authors: [{name: "Investigador", id: "https://orcid.org/" + ORCID}]
  };
  assert.deepEqual(authorWorkSources(work),
    ["Crossref", "Internet Archive", "CUCSH Filosofía"]);
  assert.equal(workHasAuthorOrcidEvidence(work, ORCID), true);
  assert.equal(workHasAuthorOrcidEvidence({
    retrievalMode:"author-index",
    authorIdentity:{orcid:ORCID},
    authors:[{name:"Investigador",orcid:ORCID}]
  }, ORCID), false, "snapshot author identity is not per-publication ORCID proof");
  assert.equal(workHasAuthorOrcidEvidence({
    authors: [{name: "Coincidencia nominal", id: "https://orcid.org/" + otherOrcid}]
  }, ORCID), false);
});

test("la unión preserva registros, enlaces, fuentes y evidencia ORCID sin duplicar obras", () => {
  const found = mergeAuthorArchives([{
    id: "https://openalex.org/W123",
    title: "Ensayo sobre causalidad", year: 2020,
    providers: ["OpenAlex Philosophy"],
    sourceLinks: [{provider: "OpenAlex Philosophy", url: "https://openalex.org/W123"}]
  }], [{
    id: "crossref:10.1234/test", doi: "10.1234/test",
    title: "Ensayo sobre causalidad", year: 2020,
    providers: ["Crossref"],
    sourceRecords: [{provider: "Crossref", sourceId: "10.1234/test"}],
    sourceLinks: [{provider: "Crossref", url: "https://doi.org/10.1234/test"}],
    orcidEvidence: ORCID
  }, {
    id: "archive:test", title: "Ensayo sobre causalidad", year: 2020,
    providers: ["Internet Archive"],
    sourceRecords: [{provider: "Internet Archive", sourceId: "test"}]
  }]);
  assert.equal(found.length, 1);
  assert.deepEqual(authorWorkSources(found[0]),
    ["OpenAlex Philosophy", "Crossref", "Internet Archive"]);
  assert.equal(found[0].sourceRecords.length, 2);
  assert.equal(found[0].sourceLinks.length, 2);
  assert.equal(found[0].orcidEvidence, ORCID);
});

test("Crossref por ORCID sólo incorpora obras cuyo contributor tiene el ORCID exacto", async () => {
  const calls = [];
  const fake = async url => {
    const target = new URL(String(url));
    calls.push(target);
    return {ok: true, json: async () => ({message: {
      "total-results": 3, items: [
        {DOI:"10.2026/a",title:["Obra de investigación"],type:"journal-article",
          author:[{given:"Ana",family:"Investigadora",ORCID:"https://orcid.org/" + ORCID}]},
        {DOI:"10.2026/b",title:["Obra de otro investigador"],type:"journal-article",
          author:[{given:"Otro",family:"Investigador",ORCID:"https://orcid.org/" + otherOrcid}]},
        {DOI:"10.2026/c",title:["Fascículo"],type:"journal-issue",
          author:[{given:"Ana",family:"Investigadora",ORCID:"https://orcid.org/" + ORCID}]}
      ]
    }})};
  };
  const response = await searchCrossrefByOrcid(ORCID, {fetchImpl: fake, rows: 50});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get("filter"), "orcid:" + ORCID);
  assert.equal(response.works.length, 1);
  assert.equal(response.works[0].orcidEvidence, ORCID);
  assert.equal(response.works[0].sourceRecords[0].provider, "Crossref");
  assert.equal(response.complete, true);
});

test("la ampliación por ORCID se integra con el índice y otras fuentes", async () => {
  const states = [];
  const response = await discoverAuthorArchive({
    author: {id:"1234567",displayName:"Ana Investigadora",orcid:ORCID},
    initialWorks:[{id:"https://openalex.org/W55",title:"Obra común",year:2021,
      providers:["OpenAlex Philosophy"]}],
    snapshotImpl:async()=>({works:[],complete:true}),
    federatedImpl:async()=>({status:"resolved",
      author:{catalogSources:["Internet Archive"]},
      works:[{id:"ia:x",title:"Obra común",year:2021,
        providers:["Internet Archive"]}]}),
    orcidRegistryImpl:async()=>({
      works:[],totalGroups:0,returnedWorks:0,complete:true
    }),
    orcidSearchImpl:async id=>{
      assert.equal(id, ORCID);
      return {works:[{id:"crossref:x",title:"Obra común",year:2021,
        providers:["Crossref"],orcidEvidence:ORCID}],total:1,complete:true};
    },
    onProgress: state => states.push(state)
  });
  assert.equal(response.works.length, 1);
  assert.deepEqual(new Set(authorWorkSources(response.works[0])),
    new Set(["OpenAlex Philosophy","Internet Archive","Crossref"]));
  assert.equal(response.works[0].orcidEvidence, ORCID);
  assert.ok(response.sources.includes("Crossref · ORCID"));
  assert.equal(states.at(-1).works.length, 1);
});

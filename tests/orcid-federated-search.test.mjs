import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeOrcidSearchCsv,
  searchOrcid,
  searchOrcidProfiles
} from "../src/sources/orcid.js";
import { mergeResults } from "../src/core/merge-results.js";
import { searchPhilosophy } from "../src/core/search-engine.js";

const ROMULO = "0000-0001-7280-3812";
const profileUrl = "https://orcid.org/" + ROMULO;

function work(title, year, doi = null) {
  return {
    id: "orcid:" + ROMULO + ":" + title,
    title,
    year,
    doi,
    journal: "Revista de Filosofía",
    authors: [{
      name: "Rómulo Ramírez Daza y García",
      id: profileUrl,
      orcid: profileUrl
    }],
    providers: ["ORCID"],
    sourceRecords: [{
      provider: "ORCID",
      sourceId: ROMULO + "/work/" + title,
      query: "Registro público ORCID " + ROMULO
    }],
    sourceLinks: [{
      provider: "ORCID",
      url: profileUrl
    }],
    urls: {
      landing: doi ? "https://doi.org/" + doi : profileUrl,
      canonical: doi ? "https://doi.org/" + doi : profileUrl
    },
    orcidRecord: true,
    orcidEvidence: ROMULO,
    retrievalMode: "author-orcid-registry",
    matchedQueries: []
  };
}

function worksPayload(items) {
  return {
    group: items.map((item, index) => ({
      "work-summary": [{
        "put-code": index + 1,
        visibility: "public",
        title: { title: { value: item.title } },
        type: "journal-article",
        "publication-date": {
          year: { value: String(item.year) }
        },
        "external-ids": {
          "external-id": item.doi ? [{
            "external-id-type": "doi",
            "external-id-value": item.doi,
            "external-id-relationship": "self"
          }] : []
        },
        url: {
          value: item.doi
            ? "https://doi.org/" + item.doi
            : profileUrl
        }
      }]
    }))
  };
}

test("CSV público de ORCID conserva nombres, ORCID y afiliaciones con comas", () => {
  const rows = normalizeOrcidSearchCsv(
    [
      "orcid,given-names,family-name,credit-name,current-institution-affiliation-name,past-institution-affiliation-name",
      '0000-0001-7280-3812,Rómulo,Ramírez Daza y García,,"Universidad Panamericana, Guadalajara","Universidad de Guadalajara"'
    ].join("\n")
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].orcid, ROMULO);
  assert.equal(rows[0].displayName, "Rómulo Ramírez Daza y García");
  assert.deepEqual(rows[0].institutions, [
    "Universidad Panamericana, Guadalajara",
    "Universidad de Guadalajara"
  ]);
});

test("búsqueda por nombre devuelve bibliografía ORCID del autor, no perfiles sueltos", async () => {
  const found = await searchOrcid(
    { query: "Rómulo Ramírez Daza y García", weight: 1, type: "original" },
    {
      rows: 4,
      searchProfilesImpl: async () => [{
        orcid: ROMULO,
        displayName: "Rómulo Ramírez Daza y García",
        givenNames: "Rómulo",
        familyName: "Ramírez Daza y García",
        institutions: ["Universidad Panamericana"]
      }],
      worksImpl: async () => ({
        works: [
          work("Platón y la argumentación", 2022),
          work("Aristóteles y la retórica", 2021),
          work("Filosofía antigua y recepción", 2020)
        ]
      })
    }
  );

  assert.equal(found.length, 3);
  assert.ok(found.every(item => item.providers.includes("ORCID")));
  assert.ok(found.every(item => item.retrievalMode === "orcid-registry-search"));
  assert.ok(found.every(item =>
    item.authors[0].orcid === profileUrl &&
    item.matchedQueries.some(match => match.provider === "ORCID")
  ));
  assert.ok(found.every(item => item.orcidSearch.authorQuery === true));
});

test("búsqueda temática ORCID filtra las obras ajenas al término consultado", async () => {
  const found = await searchOrcid(
    { query: "argumentación", weight: 1, type: "original" },
    {
      rows: 6,
      searchProfilesImpl: async () => [{
        orcid: ROMULO,
        displayName: "Rómulo Ramírez Daza y García",
        institutions: []
      }],
      worksImpl: async () => ({
        works: [
          work("Teoría de la argumentación", 2022),
          work("Platón y Aristóteles", 2021),
          work("Argumentación y retórica clásica", 2020)
        ]
      })
    }
  );

  assert.deepEqual(
    found.map(item => item.title),
    ["Teoría de la argumentación", "Argumentación y retórica clásica"]
  );
});

test("la identidad ya resuelta por el sitio vence a homónimos del índice ORCID", async () => {
  const expected = "0000-0002-7283-8051";
  let registryCalled = false;
  let requestedOrcid = null;

  const found = await searchOrcid(
    { query: "Mauricio Méndez Huerta", weight: 1, type: "original" },
    {
      rows: 4,
      preferredAuthorResolution: {
        status: "resolved",
        author: {
          displayName: "Mauricio Méndez Huerta",
          orcid: expected
        }
      },
      searchProfilesImpl: async () => {
        registryCalled = true;
        return [{
          orcid: "0000-0009-9999-9999",
          displayName: "Mauricio Huerta",
          institutions: []
        }];
      },
      worksImpl: async orcid => {
        requestedOrcid = orcid;
        return {
          works: [{
            ...work("Filosofía y adolescencia", 2021),
            authors: [{
              name: "Mauricio Méndez Huerta",
              id: "https://orcid.org/" + expected,
              orcid: "https://orcid.org/" + expected
            }],
            orcidEvidence: expected
          }]
        };
      }
    }
  );

  assert.equal(registryCalled, false);
  assert.equal(requestedOrcid, expected);
  assert.equal(found.length, 1);
  assert.equal(found[0].orcidSearch.identitySource, "resolved-author");
  assert.equal(found[0].orcidSearch.authorQuery, true);
});


test("coincidencias nominales parciales no se convierten en identidad de autor", async () => {
  const found = await searchOrcid(
    { query: "Mauricio Méndez Huerta", weight: 1, type: "original" },
    {
      rows: 8,
      searchProfilesImpl: async () => [
        {
          orcid:"0000-0001-1111-1111",
          displayName:"Mauricio Huerta",
          givenNames:"Mauricio",
          familyName:"Huerta",
          otherNames:[],
          institutions:[]
        },
        {
          orcid:"0000-0002-2222-2222",
          displayName:"Ana Méndez-Huerta",
          givenNames:"Ana",
          familyName:"Méndez-Huerta",
          otherNames:[],
          institutions:[]
        }
      ],
      worksImpl: async orcid => ({
        works: orcid.endsWith("1111-1111")
          ? [work("A Real-Time Intelligent System Based on Machine-Learning Methods",2025)]
          : [work("Habilidades Intrapersonales e Interpersonales",2023)]
      })
    }
  );

  assert.deepEqual(found,[]);
});

test("identidad reconocida sin ORCID impide fallback nominal inseguro", async () => {
  let registryCalled = false;

  const found = await searchOrcid(
    { query:"Mauricio Méndez Huerta",weight:1,type:"original" },
    {
      rows:8,
      preferredAuthorPromise:Promise.resolve({
        status:"resolved",
        identitySearchStrict:true,
        author:{
          displayName:"Mauricio Méndez Huerta",
          orcid:null
        },
        works:[]
      }),
      searchProfilesImpl:async()=>{
        registryCalled = true;
        return [];
      }
    }
  );

  assert.equal(registryCalled,false);
  assert.deepEqual(found,[]);
});

test("ORCID resuelto pagina el registro público sin repetir el primer lote", async () => {
  const expected = "0000-0002-7283-8051";
  const all = Array.from({length:17},(_,index)=>({
    ...work("Obra Mauricio " + String(index + 1).padStart(2,"0"),2026-index),
    authors:[{
      name:"Mauricio Méndez Huerta",
      id:"https://orcid.org/" + expected,
      orcid:"https://orcid.org/" + expected
    }],
    orcidEvidence:expected
  }));

  const options = {
    rows:8,
    profilesPerPage:2,
    preferredAuthorResolution:{
      status:"resolved",
      identitySearchStrict:true,
      author:{
        displayName:"Mauricio Méndez Huerta",
        orcid:expected
      }
    },
    searchProfilesImpl:async()=>{
      throw new Error("no debe buscar perfiles por nombre");
    },
    worksImpl:async orcid=>{
      assert.equal(orcid,expected);
      return {works:all};
    }
  };

  const page1 = await searchOrcid(
    {query:"Mauricio Méndez Huerta",weight:1,type:"original"},
    {...options,page:1}
  );
  const page2 = await searchOrcid(
    {query:"Mauricio Méndez Huerta",weight:1,type:"original"},
    {...options,page:2}
  );
  const page3 = await searchOrcid(
    {query:"Mauricio Méndez Huerta",weight:1,type:"original"},
    {...options,page:3}
  );

  assert.deepEqual(page1.map(item=>item.title),all.slice(0,8).map(item=>item.title));
  assert.deepEqual(page2.map(item=>item.title),all.slice(8,16).map(item=>item.title));
  assert.deepEqual(page3.map(item=>item.title),all.slice(16,17).map(item=>item.title));
});


test("ORCID exacto evita la búsqueda nominal y pagina las obras del registro", async () => {
  let searched = false;
  const all = Array.from({ length: 9 }, (_, index) =>
    work("Obra " + (index + 1), 2026 - index)
  );

  const page2 = await searchOrcid(
    "https://orcid.org/" + ROMULO,
    {
      rows: 3,
      page: 2,
      searchProfilesImpl: async () => {
        searched = true;
        return [];
      },
      profileImpl: async () => ({
        displayName: "Rómulo Ramírez Daza y García",
        givenName: "Rómulo",
        familyName: "Ramírez Daza y García",
        employments: []
      }),
      worksImpl: async () => ({ works: all })
    }
  );

  assert.equal(searched, false);
  assert.deepEqual(page2.map(item => item.title), ["Obra 4", "Obra 5", "Obra 6"]);
});

test("ORCID se fusiona con Crossref cuando comparten DOI", () => {
  const merged = mergeResults([
    work("Platón y la argumentación", 2022, "10.1234/shared"),
    {
      id: "crossref:10.1234/shared",
      title: "Platón y la argumentación",
      year: 2022,
      doi: "10.1234/shared",
      authors: [{ name: "Rómulo Ramírez Daza y García" }],
      providers: ["Crossref"],
      sourceRecords: [{ provider: "Crossref", sourceId: "10.1234/shared" }],
      matchedQueries: [],
      urls: { canonical: "https://doi.org/10.1234/shared" }
    }
  ]);

  assert.equal(merged.length, 1);
  assert.deepEqual(new Set(merged[0].providers), new Set(["ORCID", "Crossref"]));
});

test("searchPhilosophy incorpora ORCID como proveedor y emite parciales", async () => {
  const originalFetch = globalThis.fetch;
  const partials = [];

  globalThis.fetch = async input => {
    const url = new URL(String(input));

    if (url.pathname.endsWith("/csv-search/")) {
      return new Response(
        [
          "orcid,given-names,family-name,credit-name,current-institution-affiliation-name,past-institution-affiliation-name",
          ROMULO + ",Rómulo,Ramírez Daza y García,,Universidad Panamericana,"
        ].join("\n"),
        {
          status: 200,
          headers: { "content-type": "text/csv" }
        }
      );
    }

    if (url.pathname.endsWith("/" + ROMULO + "/works")) {
      return new Response(
        JSON.stringify(worksPayload([
          { title: "Platón y la argumentación", year: 2022 },
          { title: "Aristóteles y la retórica", year: 2021 }
        ])),
        {
          status: 200,
          headers: { "content-type": "application/vnd.orcid+json" }
        }
      );
    }

    throw new Error("Unexpected request " + url);
  };

  try {
    const response = await searchPhilosophy(
      "Rómulo Ramírez Daza y García",
      { philosophers: [], concepts: [], areas: [], works: [] },
      {
        maxQueries: 1,
        delayBetweenExpansions: 0,
        openAlexPhilosophy: { enabled: false },
        cucshFilosofia: { enabled: false },
        openAlex: { enabled: false },
        crossref: { enabled: false },
        internetArchive: { enabled: false },
        orcid: { enabled: true, rows: 6, profilesPerPage: 2 },
        onPartialResults(value) {
          partials.push(value);
        }
      }
    );

    assert.equal(response.results.length, 2);
    assert.equal(response.stats.providers.ORCID, 2);
    assert.ok(response.results.every(item => item.providers.includes("ORCID")));
    assert.equal(partials.at(-1).progress.provider, "ORCID");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("searchOrcidProfiles construye la búsqueda pública sin Authorization", async () => {
  let request = null;
  await searchOrcidProfiles("ética y Aristóteles", {
    start: 2,
    rows: 3,
    fetchImpl: async (url, options) => {
      request = { url: new URL(String(url)), options };
      return {
        ok: true,
        text: async () =>
          "orcid,given-names,family-name,credit-name,current-institution-affiliation-name,past-institution-affiliation-name\n"
      };
    }
  });

  assert.equal(request.url.pathname, "/v3.0/csv-search/");
  assert.equal(request.url.searchParams.get("q"), "ética y Aristóteles");
  assert.equal(request.url.searchParams.get("start"), "2");
  assert.equal(request.url.searchParams.get("rows"), "3");
  assert.equal(request.options.headers.Accept, "text/csv");
  assert.equal(request.options.headers.Authorization, undefined);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveSearchAuthorIdentity
} from "../src/core/search-author-identity.js";

const ORCID = "0000-0002-7283-8051";

test("enriquece un autor local con ORCID federado exacto", async () => {
  const result = await resolveSearchAuthorIdentity(
    "Mauricio Méndez Huerta",
    {
      remoteImpl: async () => ({
        status: "resolved",
        resolution: "corpus",
        author: {
          id: "123",
          displayName: "Mauricio Méndez Huerta",
          orcid: null
        },
        works: [{id:"openalex:1",title:"Obra local"}]
      }),
      federatedImpl: async () => ({
        status: "resolved",
        resolution: "federated-author",
        author: {
          displayName: "Mauricio Méndez Huerta",
          orcid: "https://orcid.org/" + ORCID,
          aliases: ["Mauricio Méndez-Huerta"],
          catalogSources: ["Crossref","CUCSH Filosofía"]
        },
        works: [{
          title: "Batman y Miguel Ángel",
          authorIdentity: {exact:true}
        }]
      })
    }
  );

  assert.equal(result.status,"resolved");
  assert.equal(result.identitySearchStrict,true);
  assert.equal(result.identityEvidence,"federated-exact-orcid");
  assert.equal(result.author.orcid,"https://orcid.org/" + ORCID);
  assert.equal(result.author.id,"123");
  assert.equal(result.works[0].title,"Obra local");
});

test("autor ambiguo activa política estricta y no habilita adivinación ORCID", async () => {
  const result = await resolveSearchAuthorIdentity(
    "Mauricio Méndez Huerta",
    {
      remoteImpl: async () => ({
        status:"ambiguous",
        candidates:[{id:"1"},{id:"2"}],
        works:[]
      }),
      federatedImpl: async () => ({
        status:"none",
        works:[]
      })
    }
  );

  assert.equal(result.status,"ambiguous");
  assert.equal(result.identitySearchStrict,true);
  assert.equal(result.identityEvidence,"ambiguous-author");
});

test("una consulta temática de una palabra no dispara resolución federada de persona", async () => {
  let federatedCalled = false;

  const result = await resolveSearchAuthorIdentity(
    "argumentación",
    {
      remoteImpl: async () => ({
        status:"none",
        candidates:[],
        works:[]
      }),
      federatedImpl: async () => {
        federatedCalled = true;
        return {status:"resolved",works:[]};
      }
    }
  );

  assert.equal(federatedCalled,false);
  assert.equal(result.status,"none");
  assert.equal(result.identitySearchStrict,false);
});

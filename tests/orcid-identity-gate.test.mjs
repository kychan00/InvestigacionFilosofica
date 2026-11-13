import test from "node:test";
import assert from "node:assert/strict";
import { searchOrcid } from "../src/sources/orcid.js";

const ORCID = "0000-0002-7283-8051";
const wrong = "0000-0001-1111-1111";

function profile(orcid, displayName) {
  return {
    orcid, displayName, givenNames: displayName.split(" ")[0],
    familyName: displayName.split(" ").slice(1).join(" "),
    creditName: null, otherNames: [], institutions: []
  };
}

function work(title) {
  return { title, year: 2020, authors: [], providers: ["ORCID"] };
}

test("a close name match cannot import a homonym's entire ORCID bibliography", async () => {
  let workRequests = 0;
  const results = await searchOrcid("Mauricio Méndez Huerta", {
    searchProfilesImpl: async () => [
      profile(wrong, "Mauricio Huerta"),
      profile(ORCID, "Mauricio Méndez Huerta")
    ],
    worksImpl: async () => {
      workRequests++;
      return { works: [work("Unrelated publication")] };
    }
  });
  assert.deepEqual(results, []);
  assert.equal(workRequests, 0);
});

test("ambiguous author resolution is not authorization to expand all ORCIDs", async () => {
  let workRequests = 0;
  const results = await searchOrcid("Mauricio Méndez Huerta", {
    preferredAuthorResolution: {
      status: "multiple",
      authors: [
        { displayName: "Mauricio Méndez Huerta", orcid: ORCID },
        { displayName: "Mauricio Huerta", orcid: wrong }
      ]
    },
    searchProfilesImpl: async () => [profile(wrong, "Mauricio Huerta")],
    worksImpl: async () => {
      workRequests++;
      return { works: [work("Unrelated publication")] };
    }
  });
  assert.deepEqual(results, []);
  assert.equal(workRequests, 0);
});

test("a resolved author with an ORCID still imports public works", async () => {
  const requested = [];
  const results = await searchOrcid("Mauricio Méndez Huerta", {
    preferredAuthorResolution: {
      status: "resolved",
      author: { displayName: "Mauricio Méndez Huerta", orcid: ORCID }
    },
    searchProfilesImpl: async () => {
      throw new Error("name search must be skipped");
    },
    worksImpl: async id => {
      requested.push(id);
      return { works: [work("Los usos del interrogatorio en Platón")] };
    }
  });
  assert.deepEqual(requested, [ORCID]);
  assert.equal(results.length, 1);
  assert.equal(results[0].orcidSearch.profile, ORCID);
});

test("an explicitly supplied ORCID remains an authoritative lookup", async () => {
  const results = await searchOrcid(ORCID, {
    profileImpl: async () => ({ displayName: "Mauricio Méndez Huerta" }),
    searchProfilesImpl: async () => {
      throw new Error("no fuzzy lookup required");
    },
    worksImpl: async id => {
      assert.equal(id, ORCID);
      return { works: [work("Ensayo académico")] };
    }
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].orcidSearch.profile, ORCID);
});

test("topical queries may use ORCID records only through work-title relevance", async () => {
  const results = await searchOrcid("argumentación", {
    searchProfilesImpl: async () => [profile(wrong, "Mauricio Huerta")],
    worksImpl: async () => ({
      works: [work("Teoría de la argumentación"), work("Estadística inferencial")]
    })
  });
  assert.deepEqual(results.map(item => item.title), ["Teoría de la argumentación"]);
});

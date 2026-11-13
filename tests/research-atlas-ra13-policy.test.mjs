import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const policy = JSON.parse(
  await readFile(
    new URL(
      "../benchmark/research-atlas/v13/author-identity-policy.json",
      import.meta.url
    ),
    "utf8"
  )
);

test("RA13 conserva Work-first como topología primaria", () => {
  assert.equal(
    policy.primaryTopology.entity,
    "work"
  );
  assert.equal(
    policy.primaryTopology.unchangedFrom,
    "RA11"
  );
  assert.equal(
    policy.primaryTopology.authorIdentityMayMoveWorks,
    false
  );
});

test("RA13 prohíbe fusionar personas sólo por nombre", () => {
  assert.equal(
    policy.identity.automaticMergeByName,
    false
  );
  assert.equal(
    policy.identity.nameOnlyRemains,
    "author-mention"
  );
  assert.equal(
    policy.identity.conflictingIdentifiers,
    "fail-closed"
  );
});

test("RA13 no dispara una segunda búsqueda desde el Atlas", () => {
  assert.equal(
    policy.provenance.noAdditionalProviderSearchFromAtlas,
    true
  );
  assert.equal(
    policy.provenance.consumesSearchResponseOnly,
    true
  );
});

test("instituciones quedan como metadata hasta RA13-B", () => {
  assert.match(
    policy.relationships.affiliation,
    /deferred/i
  );
  assert.match(
    policy.futurePhases["RA13-B"],
    /Institution nodes/i
  );
});

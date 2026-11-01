import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  RELATED_WORK_SCHEMA_VERSION,
  RELATION_FAMILIES,
  RELATION_TYPES,
  RELATION_TYPE_FAMILY,
  RELATION_EVIDENCE_REQUIREMENTS,
  EVIDENCE_CLASSES,
  evidenceClassSatisfies,
  relationFamilyFor,
  validateRelatedWorkEdge,
  assertRelatedWorkEdge
} from "../src/core/related-work-contract.js";

const fixturePayload = JSON.parse(
  await readFile(
    new URL(
      "../benchmark/related-works/v1/fixtures.json",
      import.meta.url
    ),
    "utf8"
  )
);


test("el contrato V1 expone familias y tipos estables", () => {
  assert.equal(
    RELATED_WORK_SCHEMA_VERSION,
    "related-work-v1"
  );

  assert.deepEqual(
    new Set(Object.values(RELATION_FAMILIES)),
    new Set([
      "semantic",
      "philosophical",
      "authorship",
      "bibliographic",
      "historical"
    ])
  );

  for (const relationType of Object.values(RELATION_TYPES)) {
    assert.ok(
      RELATION_TYPE_FAMILY[relationType],
      "Missing family for " + relationType
    );

    assert.ok(
      RELATION_EVIDENCE_REQUIREMENTS[relationType],
      "Missing evidence contract for " + relationType
    );

    assert.equal(
      relationFamilyFor(relationType),
      RELATION_TYPE_FAMILY[relationType]
    );
  }
});


test("la jerarquía de evidencia nunca trata contexto como evidencia bibliográfica", () => {
  assert.equal(
    evidenceClassSatisfies(
      EVIDENCE_CLASSES.CONTEXTUAL,
      EVIDENCE_CLASSES.BIBLIOGRAPHIC
    ),
    false
  );

  assert.equal(
    evidenceClassSatisfies(
      EVIDENCE_CLASSES.SEMANTIC,
      EVIDENCE_CLASSES.BIBLIOGRAPHIC
    ),
    false
  );

  assert.equal(
    evidenceClassSatisfies(
      EVIDENCE_CLASSES.BIBLIOGRAPHIC,
      EVIDENCE_CLASSES.SEMANTIC
    ),
    true
  );

  assert.equal(
    evidenceClassSatisfies(
      EVIDENCE_CLASSES.DETERMINISTIC,
      EVIDENCE_CLASSES.BIBLIOGRAPHIC
    ),
    true
  );
});


test("todos los fixtures V1 cumplen exactamente su expectativa contractual", () => {
  assert.equal(
    fixturePayload.schemaVersion,
    "related-work-fixtures-v1"
  );

  assert.ok(
    fixturePayload.cases.length >= 16,
    "Expected a non-trivial V1 fixture matrix"
  );

  for (const fixture of fixturePayload.cases) {
    const result =
      validateRelatedWorkEdge(
        fixture.edge
      );

    assert.equal(
      result.ok,
      fixture.expected.valid,
      fixture.id +
        " " +
        fixture.label +
        "\n" +
        result.errors.join("\n")
    );

    for (const expectedError of fixture.expected.errorIncludes || []) {
      assert.ok(
        result.errors.includes(
          expectedError
        ),
        fixture.id +
          " should include " +
          expectedError +
          "\nReceived: " +
          result.errors.join(", ")
      );
    }

    if (fixture.expected.valid) {
      assert.equal(
        assertRelatedWorkEdge(
          fixture.edge
        ),
        fixture.edge
      );
    } else {
      assert.throws(
        () =>
          assertRelatedWorkEdge(
            fixture.edge
          ),
        /Invalid RelatedWorkEdge/
      );
    }
  }
});


test("ningún fixture válido usa contexto histórico como única relación", () => {
  for (const fixture of fixturePayload.cases) {
    if (!fixture.expected.valid) {
      continue;
    }

    assert.notDeepEqual(
      fixture.edge.relationTypes,
      [
        RELATION_TYPES.HISTORICAL_CONTEXT
      ],
      fixture.id
    );
  }
});


test("las relaciones de citación exigen evidencia bibliográfica explícita", () => {
  for (const type of [
    RELATION_TYPES.CITED_BY_SEED,
    RELATION_TYPES.CITES_SEED,
    RELATION_TYPES.BIBLIOGRAPHIC_REFERENCE
  ]) {
    const contract =
      RELATION_EVIDENCE_REQUIREMENTS[
        type
      ];

    assert.equal(
      contract.requiresStructuredIdentity,
      true,
      type
    );

    assert.equal(
      contract.requiresExplicitBibliographicEdge,
      true,
      type
    );

    assert.equal(
      contract.minimumClass,
      EVIDENCE_CLASSES.BIBLIOGRAPHIC,
      type
    );
  }
});


test("las relaciones de autoría nunca dependen sólo de similitud nominal", () => {
  for (const type of [
    RELATION_TYPES.SAME_AUTHOR,
    RELATION_TYPES.SHARED_COAUTHOR
  ]) {
    const contract =
      RELATION_EVIDENCE_REQUIREMENTS[
        type
      ];

    assert.equal(
      contract.requiresStructuredIdentity,
      true,
      type
    );

    assert.equal(
      evidenceClassSatisfies(
        EVIDENCE_CLASSES.CONTEXTUAL,
        contract.minimumClass
      ),
      false,
      type
    );
  }
});


test("cada relación V1 exige el payload estructurado que la justifica", () => {
  const expectedFields = new Map([
    [RELATION_TYPES.SEMANTIC_AFFINITY, "semanticScore"],
    [RELATION_TYPES.SHARED_TOPIC, "topicIds"],
    [RELATION_TYPES.SHARED_CONCEPT, "conceptIds"],
    [RELATION_TYPES.SAME_AUTHOR, "authorityRefs"],
    [RELATION_TYPES.SHARED_COAUTHOR, "sharedAuthorityRefs"],
    [RELATION_TYPES.CITED_BY_SEED, "sourceRecordRefs"],
    [RELATION_TYPES.CITES_SEED, "sourceRecordRefs"],
    [RELATION_TYPES.BIBLIOGRAPHIC_REFERENCE, "sourceRecordRefs"]
  ]);

  for (const [type, field] of expectedFields) {
    assert.ok(
      RELATION_EVIDENCE_REQUIREMENTS[type].requiredAnyFields.includes(field),
      type + " must require " + field
    );
  }

  assert.deepEqual(
    new Set(
      RELATION_EVIDENCE_REQUIREMENTS[
        RELATION_TYPES.SAME_DEBATE
      ].requiredAnyFields
    ),
    new Set([
      "conceptIds",
      "topicIds",
      "areaIds"
    ])
  );
});


test("evidencia veto nunca puede llegar a una arista publicable", () => {
  const fixture =
    fixturePayload.cases.find(
      item => item.id === "RW17"
    );

  assert.ok(fixture);

  const result =
    validateRelatedWorkEdge(
      fixture.edge
    );

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes(
      "edge:veto-evidence-present:ev-veto-17"
    )
  );
});


test("los códigos de explicación fuera del vocabulario V1 se rechazan", () => {
  const fixture =
    structuredClone(
      fixturePayload.cases.find(
        item => item.id === "RW01"
      ).edge
    );

  fixture.reasons[0].code =
    "ai-thinks-it-is-related";

  const result =
    validateRelatedWorkEdge(
      fixture
    );

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes(
      "reason:unknown-code:ai-thinks-it-is-related"
    )
  );
});

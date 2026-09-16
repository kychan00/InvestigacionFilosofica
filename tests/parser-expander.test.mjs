import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  parseQuery
} from "../src/core/parser.js";

import {
  expandQuery
} from "../src/core/expander.js";


const philosophyMap =
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../src/data/philosophy-map.json",
        import.meta.url
      ),
      "utf8"
    )
  );


test(
  "detecta Kant + libertad",
  () => {
    const parsed =
      parseQuery(
        "libertad en Kant",
        philosophyMap
      );

    assert.equal(
      parsed.philosophers[0]?.id,
      "kant"
    );

    assert.ok(
      parsed.concepts.some(
        item =>
          item.id === "freedom"
      )
    );
  }
);


test(
  "detecta Ser y tiempo como obra",
  () => {
    const parsed =
      parseQuery(
        "Ser y tiempo Heidegger",
        philosophyMap
      );

    assert.ok(
      parsed.works.some(
        item =>
          item.id ===
          "heidegger_bt"
      )
    );
  }
);


test(
  "expande español a inglés",
  () => {
    const parsed =
      parseQuery(
        "epistemología de Hume",
        philosophyMap
      );

    const expansions =
      expandQuery(
        parsed,
        philosophyMap,
        {
          maxQueries: 5
        }
      );

    assert.ok(
      expansions.some(
        item =>
          item.query.toLowerCase() ===
          "david hume epistemology"
      )
    );
  }
);


test(
  "preserva contexto en consulta multi-concepto",
  () => {
    const parsed =
      parseQuery(
        "libre albedrío y determinismo",
        philosophyMap
      );

    const expansions =
      expandQuery(
        parsed,
        philosophyMap,
        {
          maxQueries: 6
        }
      );

    assert.ok(
      expansions.some(
        item =>
          item.query ===
          "Free will Determinism"
      )
    );

    assert.ok(
      expansions.some(
        item =>
          item.query.includes(
            "causal determinism"
          )
      )
    );
  }
);


test(
  "traduce ontología informática completa sin volverla Metaphysics",
  () => {
    const parsed =
      parseQuery(
        "ontología en informática",
        philosophyMap
      );

    const expansions =
      expandQuery(
        parsed,
        philosophyMap,
        {
          maxQueries: 6
        }
      );

    assert.ok(
      expansions.some(
        item =>
          item.query ===
          "ontology in computer science"
      )
    );

    assert.equal(
      expansions.some(
        item => item.query === "Metaphysics"
      ),
      false
    );
  }
);


test(
  "traduce fenomenología en enfermería completa",
  () => {
    const parsed =
      parseQuery(
        "fenomenología en enfermería",
        philosophyMap
      );

    const expansions =
      expandQuery(
        parsed,
        philosophyMap,
        {
          maxQueries: 6
        }
      );

    assert.ok(
      expansions.some(
        item =>
          item.query ===
          "phenomenology in nursing"
      )
    );

    assert.equal(
      expansions.some(
        item => item.query === "Phenomenology"
      ),
      false
    );
  }
);


test(
  "reconoce y traduce restricciones interdisciplinarias en cinco idiomas",
  () => {
    const cases = [
      [
        "ontología en informática",
        "ontology in computer science",
        "es"
      ],
      [
        "ontology in computer science",
        "ontology in computer science",
        "en"
      ],
      [
        "Ontologie in der Informatik",
        "ontology in computer science",
        "de"
      ],
      [
        "ontologie en informatique",
        "ontology in computer science",
        "fr"
      ],
      [
        "ontologia em ciência da computação",
        "ontology in computer science",
        "pt"
      ],
      [
        "fenomenología en enfermería",
        "phenomenology in nursing",
        "es"
      ],
      [
        "phenomenology in nursing",
        "phenomenology in nursing",
        "en"
      ],
      [
        "Phänomenologie in der Pflege",
        "phenomenology in nursing",
        "de"
      ],
      [
        "phénoménologie en soins infirmiers",
        "phenomenology in nursing",
        "fr"
      ],
      [
        "fenomenologia na enfermagem",
        "phenomenology in nursing",
        "pt"
      ]
    ];

    for (const [query, english, language] of cases) {
      const parsed = parseQuery(
        query,
        philosophyMap
      );

      assert.equal(
        parsed.language,
        language,
        query
      );

      assert.ok(
        parsed.explicitAreas.length > 0,
        query
      );

      assert.ok(
        parsed.domains.length > 0,
        query
      );

      const expansions = expandQuery(
        parsed,
        philosophyMap,
        {
          maxQueries: 6
        }
      );

      assert.ok(
        expansions.some(
          item =>
            item.query === english
        ),
        query
      );
    }
  }
);


test(
  "no traduce una consulta completa si quedaría un calificador desconocido",
  () => {
    const parsed =
      parseQuery(
        "ontología en informática pediátrica",
        philosophyMap
      );

    const expansions =
      expandQuery(
        parsed,
        philosophyMap,
        {
          maxQueries: 6
        }
      );

    assert.equal(
      expansions.some(
        item =>
          item.query ===
          "ontology in computer science"
      ),
      false
    );

    assert.equal(
      expansions[0]?.query,
      "ontología en informática pediátrica"
    );
  }
);


test(
  "el léxico académico no está limitado a las dos familias del benchmark",
  () => {
    const parsed =
      parseQuery(
        "ética en inteligencia artificial",
        philosophyMap
      );

    assert.ok(
      parsed.explicitAreas.some(
        item => item.id === "ETH"
      )
    );

    assert.ok(
      parsed.domains.some(
        item =>
          item.id === "artificial_intelligence"
      )
    );

    const expansions =
      expandQuery(
        parsed,
        philosophyMap,
        {
          maxQueries: 6
        }
      );

    assert.ok(
      expansions.some(
        item =>
          item.query ===
          "ethics in artificial intelligence"
      )
    );
  }
);

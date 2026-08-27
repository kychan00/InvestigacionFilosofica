import test from "node:test";
import assert from "node:assert/strict";

import {
  detectTextLanguage,
  effectiveLanguage,
  languageCandidates
} from "../src/core/language.js";


test(
  "detecta español",
  () => {
    assert.equal(
      detectTextLanguage(
        "La libertad y el problema de la razón práctica en la filosofía de Kant"
      ),
      "es"
    );
  }
);


test(
  "detecta inglés",
  () => {
    assert.equal(
      detectTextLanguage(
        "Freedom and the problem of practical reason in the philosophy of Kant"
      ),
      "en"
    );
  }
);


test(
  "clasifica título mixto de Dussel como inglés",
  () => {
    const title =
      "Enrique Dussel's Etica de La Liberación, U.s. Women of Color Decolonizing Practices, and Coalitionary Politics Amidst Difference";

    assert.equal(
      detectTextLanguage(
        title
      ),
      "en"
    );
  }
);


test(
  "texto corrige metadata incorrecta",
  () => {
    assert.equal(
      effectiveLanguage({
        title:
          "Women of Color and Coalitionary Politics in Contemporary Ethics",

        language:
          "es"
      }),
      "en"
    );
  }
);


test(
  "usa metadata para título corto",
  () => {
    assert.equal(
      effectiveLanguage({
        title:
          "Kant",

        abstract:
          null,

        language:
          "de"
      }),
      "de"
    );
  }
);


test(
  "expone candidatos de franc para auditoría",
  () => {
    const candidates =
      languageCandidates(
        "La libertad y el problema de la razón práctica en la filosofía de Kant"
      );

    assert.ok(
      candidates.length > 0
    );

    assert.ok(
      candidates[0].code
    );

    assert.equal(
      typeof candidates[0].score,
      "number"
    );
  }
);


test(
  "mantiene español en título predominantemente español",
  () => {
    assert.equal(
      detectTextLanguage(
        "La ética de la liberación y el problema de la justicia en América Latina"
      ),
      "es"
    );
  }
);


test(
  "resuelve título bilingüe predominantemente inglés",
  () => {
    assert.equal(
      detectTextLanguage(
        "The concept of justicia and the problem of freedom in contemporary political philosophy"
      ),
      "en"
    );
  }
);

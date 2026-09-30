import assert from "node:assert/strict";
import {
  createHash
} from "node:crypto";
import {
  readFile
} from "node:fs/promises";
import test from "node:test";

import {
  QWEN3_BROWSER_Q8_CONTRACT,
  buildQwen3BrowserQ8Candidate,
  isQwen3BrowserQ8OptIn,
  rerankTopKByQwen3BrowserQ8,
  selectQwen3BrowserQ8Candidates
} from "../src/ai/qwen3-browser-q8-contract.js";


test(
  "Qwen3 product mode is disabled unless the URL opts in exactly",
  () => {
    assert.equal(
      isQwen3BrowserQ8OptIn(""),
      false
    );

    assert.equal(
      isQwen3BrowserQ8OptIn("?qwen3=0"),
      false
    );

    assert.equal(
      isQwen3BrowserQ8OptIn("?qwen3=true"),
      false
    );

    assert.equal(
      isQwen3BrowserQ8OptIn("?qwen3=1"),
      true
    );
  }
);


test(
  "product scorer preserves the frozen q8 prompt and model contract",
  () => {
    const instructionSha256 =
      createHash("sha256")
        .update(
          QWEN3_BROWSER_Q8_CONTRACT
            .instruction
        )
        .digest("hex");


    assert.equal(
      instructionSha256,
      "5693a9a1377e10eb952d327aeec5c05cbbf040989feb786910b42e17cbf271a7"
    );

    assert.equal(
      QWEN3_BROWSER_Q8_CONTRACT
        .revision,
      "9995c50e2310679108a55f5ccd16ba8be9f17c20"
    );

    assert.equal(
      QWEN3_BROWSER_Q8_CONTRACT
        .dtype,
      "q8"
    );

    assert.equal(
      QWEN3_BROWSER_Q8_CONTRACT
        .device,
      "webgpu"
    );

    assert.equal(
      QWEN3_BROWSER_Q8_CONTRACT
        .maxLength,
      1024
    );
  }
);


test(
  "candidate construction excludes ranking, provenance, and human-label fields",
  () => {
    const candidate =
      buildQwen3BrowserQ8Candidate(
        " libertad en Kant ",
        {
          title:
            "Título",
          authors: [
            {
              name:
                "Autora"
            }
          ],
          year:
            2024,
          language:
            "es",
          abstract:
            "Resumen",
          relevanceScore:
            99,
          providers: [
            "Proveedor"
          ],
          human_relevance:
            3
        }
      );


    assert.deepEqual(
      candidate,
      {
        query:
          "libertad en Kant",
        title:
          "Título",
        authors: [
          "Autora"
        ],
        year:
          2024,
        document_language:
          "es",
        abstract:
          "Resumen"
      }
    );

    assert.doesNotMatch(
      JSON.stringify(candidate),
      /provider|rank|score|relevance/iu
    );
  }
);


test(
  "reranking changes only Top 20 order and uses original order for exact ties",
  () => {
    const results =
      Array.from(
        {
          length:
            23
        },
        (_, index) => ({
          id:
            `r${index + 1}`
        })
      );

    const scores =
      Array.from(
        {
          length:
            20
        },
        (_, index) =>
          index === 0 ||
          index === 1
            ? 0.5
            : index / 20
      );

    const reranked =
      rerankTopKByQwen3BrowserQ8(
        results,
        scores
      );


    assert.equal(
      reranked.length,
      results.length
    );

    assert.deepEqual(
      new Set(reranked),
      new Set(results)
    );

    assert.deepEqual(
      reranked.slice(-3),
      results.slice(-3)
    );

    assert.ok(
      reranked.indexOf(results[0]) <
      reranked.indexOf(results[1])
    );

    assert.throws(
      () =>
        rerankTopKByQwen3BrowserQ8(
          results,
          scores.slice(1)
        ),
      /score count/u
    );
  }
);


test(
  "candidate selection is capped at the frozen Top 20 membership",
  () => {
    const results =
      Array.from(
        {
          length:
            25
        },
        (_, index) => ({
          title:
            `Documento ${index}`,
          authors: [],
          year:
            null,
          abstract:
            ""
        })
      );


    assert.equal(
      selectQwen3BrowserQ8Candidates(
        "consulta",
        results
      ).length,
      20
    );
  }
);


test(
  "browser bundle build rejects Node inference and requires onnxruntime-web",
  async () => {
    const [
      runtime,
      builder,
      app,
      workflow
    ] = await Promise.all([
      readFile(
        new URL(
          "../src/ai/qwen3-browser-q8-runtime.js",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../scripts/build-qwen3-browser.mjs",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../js/app.js",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../.github/workflows/deploy.yml",
          import.meta.url
        ),
        "utf8"
      )
    ]);


    assert.match(
      runtime,
      /device:\s*\n\s*"webgpu"/u
    );

    assert.match(
      runtime,
      /executionProviders:\s*\[\s*\n\s*"webgpu"/u
    );

    assert.match(
      runtime,
      /dtype:\s*\n\s*"q8"/u
    );

    assert.match(
      runtime,
      /refusing|prohibida|prohibido/iu
    );

    assert.match(
      builder,
      /onnxruntime-node/u
    );

    assert.match(
      builder,
      /onnxruntime-web/u
    );

    assert.match(
      builder,
      /transformers\.web\.js/u
    );

    assert.match(
      app,
      /qwen3OptIn/u
    );

    assert.match(
      workflow,
      /npm run build:qwen3-browser/u
    );
  }
);


test(
  "product contract keeps the inconclusive evidence separate from opt-in prototyping",
  async () => {
    const contract =
      JSON.parse(
        await readFile(
          new URL(
            "../benchmark/qwen3/product/qwen3-browser-q8-opt-in-v1.contract.json",
            import.meta.url
          ),
          "utf8"
        )
      );


    assert.equal(
      contract
        .scientific_boundary
        .formal_external_gate,
      "inconclusive"
    );

    assert.equal(
      contract
        .scientific_boundary
        .production_promotion,
      false
    );

    assert.equal(
      contract
        .activation
        .default_enabled,
      false
    );

    assert.equal(
      contract
        .runtime_contract
        .onnxruntime_node_allowed,
      false
    );

    assert.equal(
      contract
        .ranking_contract
        .human_labels_during_inference,
      false
    );
  }
);

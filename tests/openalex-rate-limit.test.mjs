import test from "node:test";
import assert from "node:assert/strict";

import {
  searchOpenAlex
} from "../src/sources/openalex.js";


test(
  "OpenAlex entra en cooldown tras HTTP 429",
  async () => {
    const originalFetch =
      globalThis.fetch;

    let calls = 0;


    globalThis.fetch =
      async () => {
        calls += 1;

        return {
          ok: false,
          status: 429,

          headers: {
            get(name) {
              if (
                String(name)
                  .toLowerCase() ===
                "retry-after"
              ) {
                return "60";
              }

              return null;
            }
          }
        };
      };


    try {
      await assert.rejects(
        () =>
          searchOpenAlex(
            "Immanuel Kant freedom",
            {
              retries: 0
            }
          ),
        /429/
      );


      /*
       * La segunda llamada debe fallar
       * por cooldown sin volver a consultar
       * la red.
       */
      await assert.rejects(
        () =>
          searchOpenAlex(
            "Kant practical reason",
            {
              retries: 0
            }
          ),
        /429/
      );


      assert.equal(
        calls,
        1
      );

    } finally {
      globalThis.fetch =
        originalFetch;
    }
  }
);

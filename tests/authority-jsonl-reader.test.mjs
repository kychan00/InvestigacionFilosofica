import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile
} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {
  readJsonLines
} from "../scripts/authority/read-jsonl-v1.mjs";


async function collect(path) {
  const rows = [];

  for await (
    const row of
    readJsonLines(path)
  ) {
    rows.push(row);
  }

  return rows;
}


test("JSONL conserva U+2028 y U+2029 dentro de strings", async () => {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "authority-jsonl-unicode-"
      )
    );

  const path =
    join(
      root,
      "fixture.jsonl"
    );

  const rows = [
    {
      id:
        1,
      title:
        "Radbruch as an Affirmative Holist.\u2028On the Question"
    },
    {
      id:
        2,
      title:
        "Primera parte\u2029Segunda parte"
    }
  ];

  await writeFile(
    path,
    rows
      .map(
        row =>
          JSON.stringify(row)
      )
      .join("\r\n") +
      "\r\n",
    "utf8"
  );

  assert.deepEqual(
    await collect(path),
    rows
  );
});


test("JSONL inválido reporta ruta y línea física LF", async () => {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "authority-jsonl-invalid-"
      )
    );

  const path =
    join(
      root,
      "broken.jsonl"
    );

  await writeFile(
    path,
    [
      JSON.stringify({
        id:
          1
      }),
      '{"id":2,"title":"unterminated',
      JSON.stringify({
        id:
          3
      })
    ].join("\n") +
      "\n",
    "utf8"
  );

  await assert.rejects(
    collect(path),
    error => {
      assert.match(
        error.message,
        /broken\.jsonl/
      );

      assert.match(
        error.message,
        /physical line 2/
      );

      assert.match(
        error.message,
        /Invalid JSONL/
      );

      return true;
    }
  );
});

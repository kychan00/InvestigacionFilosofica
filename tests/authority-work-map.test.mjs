import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";

import {
  authorityWorkRow,
  authorityWorkShard,
  buildAuthorityWorkMap,
  openAlexWorkIdentity
} from "../scripts/related/build_authority_work_map_v1.mjs";


async function sha256(path) {
  return createHash("sha256")
    .update(
      await readFile(path)
    )
    .digest("hex");
}


async function writeJson(path, value) {
  await writeFile(
    path,
    JSON.stringify(value, null, 2) + "\n",
    "utf8"
  );
}


async function makeFixture(root) {
  const authorIndex =
    join(root, "author-index");

  const authority =
    join(root, "authority");

  await mkdir(
    join(
      authorIndex,
      "work-authors"
    ),
    {
      recursive: true
    }
  );

  await mkdir(
    authority,
    {
      recursive: true
    }
  );

  const rows = [
    {
      wid: 1001,
      a: [
        {
          id: 123,
          n: "Ana Pérez",
          o: "0000-0001-1111-1111",
          p: "first",
          r: true
        },
        {
          id: 789,
          n: "José Martínez",
          o: null,
          p: "last",
          r: false
        }
      ]
    },
    {
      wid: 1002,
      a: [
        {
          id: 456,
          n: "Ana María Pérez",
          o: "0000-0001-1111-1111",
          p: "middle",
          r: false
        },
        {
          id: 789,
          n: "José Martínez",
          o: null,
          p: "first",
          r: true
        }
      ]
    },
    {
      wid: 1003,
      a: [
        {
          id: 999,
          n: "Unresolved Person",
          o: null,
          p: "first",
          r: false
        }
      ]
    },
    {
      wid: 1004,
      a: [
        {
          id: 123,
          n: "Ana Pérez",
          o: "0000-0001-1111-1111",
          p: "first",
          r: true
        },
        {
          id: 456,
          n: "Ana María Pérez",
          o: "0000-0001-1111-1111",
          p: "last",
          r: false
        }
      ]
    }
  ];

  const workAuthorsPath =
    join(
      authorIndex,
      "work-authors",
      "fixture.jsonl"
    );

  await writeFile(
    workAuthorsPath,
    rows
      .map(
        row =>
          JSON.stringify(row)
      )
      .join("\n") +
      "\n",
    "utf8"
  );

  const info =
    await import(
      "node:fs/promises"
    ).then(
      module =>
        module.stat(
          workAuthorsPath
        )
    );

  await writeJson(
    join(
      authorIndex,
      "manifest.json"
    ),
    {
      schema_version:
        "remote-author-index-manifest-v1",
      version:
        "author-index-v2",
      source: {
        snapshot_revision:
          "snapshot-fixture",
        philosophy_revision:
          "philosophy-fixture"
      },
      files: {
        work_authors: [
          {
            path:
              "work-authors/fixture.jsonl",
            size_bytes:
              info.size,
            sha256:
              await sha256(
                workAuthorsPath
              )
          }
        ]
      }
    }
  );

  const registry = {
    schemaVersion:
      "author-authority-registry-v1",
    shardCount:
      8,
    buildRevision:
      "authority-fixture",
    datasetRevision:
      "dataset-fixture",
    authorityLocations: {
      "authority:ana":
        1,
      "authority:jose":
        2
    },
    identifierRegistry: {
      "openalex-author:123":
        "authority:ana",
      "openalex-author:456":
        "authority:ana",
      "openalex-author:789":
        "authority:jose"
    },
    candidateRegistry: {}
  };

  const registryPath =
    join(
      authority,
      "registry.json"
    );

  await writeJson(
    registryPath,
    registry
  );

  await writeJson(
    join(
      authority,
      "manifest.json"
    ),
    {
      schemaVersion:
        "author-authority-batch-manifest-v1",
      buildRevision:
        "authority-fixture",
      datasetRevision:
        "dataset-fixture",
      files: {
        registry: {
          path:
            "registry.json",
          sha256:
            await sha256(
              registryPath
            )
        },
        shards: []
      }
    }
  );

  return {
    authorIndex,
    authority,
    rows
  };
}


async function readOutputRows(
  root
) {
  const manifest =
    JSON.parse(
      await readFile(
        join(
          root,
          "manifest.json"
        ),
        "utf8"
      )
    );

  const output = [];

  for (
    const file of
    manifest.files.shards
  ) {
    const text =
      await readFile(
        join(
          root,
          file.path
        ),
        "utf8"
      );

    for (
      const line of
      text
        .split("\n")
        .filter(Boolean)
    ) {
      output.push(
        JSON.parse(line)
      );
    }
  }

  return {
    manifest,
    rows:
      output.sort(
        (left, right) =>
          left.w.localeCompare(
            right.w
          )
      )
  };
}


test("normaliza identidad OpenAlex de obra", () => {
  assert.equal(
    openAlexWorkIdentity(
      "https://openalex.org/W123"
    ),
    "openalex:W123"
  );

  assert.equal(
    openAlexWorkIdentity(
      456
    ),
    "openalex:W456"
  );
});


test("work row conserva sólo AuthorityPerson confirmadas", () => {
  const row =
    authorityWorkRow(
      {
        wid:
          100,
        a: [
          {
            id:
              1,
            p:
              "first",
            r:
              true
          },
          {
            id:
              2,
            p:
              "middle",
            r:
              false
          }
        ]
      },
      {
        "openalex-author:1":
          "authority:one"
      }
    );

  assert.equal(
    row.w,
    "openalex:W100"
  );

  assert.equal(
    row.n,
    2
  );

  assert.equal(
    row.u,
    1
  );

  assert.deepEqual(
    row.a,
    [
      {
        r:
          "authority:one",
        p:
          ["first"],
        i:
          ["1"],
        c:
          true
      }
    ]
  );
});


test("IDs OpenAlex fusionados colapsan a una sola AuthorityPerson por obra", () => {
  const row =
    authorityWorkRow(
      {
        wid:
          200,
        a: [
          {
            id:
              123,
            p:
              "first",
            r:
              true
          },
          {
            id:
              456,
            p:
              "last",
            r:
              false
          }
        ]
      },
      {
        "openalex-author:123":
          "authority:ana",
        "openalex-author:456":
          "authority:ana"
      }
    );

  assert.equal(
    row.a.length,
    1
  );

  assert.deepEqual(
    row.a[0],
    {
      r:
        "authority:ana",
      p:
        [
          "first",
          "last"
        ],
      i:
        [
          "123",
          "456"
        ],
      c:
        true
    }
  );
});


test("build produce bridge determinista y excluye obras sin autoridad confirmada", async () => {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "authority-work-map-"
      )
    );

  const fixture =
    await makeFixture(
      root
    );

  const first =
    join(
      root,
      "first"
    );

  const second =
    join(
      root,
      "second"
    );

  const resultA =
    await buildAuthorityWorkMap({
      authorIndexRoot:
        fixture.authorIndex,
      authorityRoot:
        fixture.authority,
      outputRoot:
        first,
      shardCount:
        8,
      buildRevision:
        "bridge-fixture"
    });

  const resultB =
    await buildAuthorityWorkMap({
      authorIndexRoot:
        fixture.authorIndex,
      authorityRoot:
        fixture.authority,
      outputRoot:
        second,
      shardCount:
        8,
      buildRevision:
        "bridge-fixture"
    });

  assert.equal(
    resultA.manifestSha256,
    resultB.manifestSha256
  );

  const a =
    await readOutputRows(
      first
    );

  const b =
    await readOutputRows(
      second
    );

  assert.deepEqual(
    a,
    b
  );

  assert.equal(
    a.manifest.counts.worksSeen,
    4
  );

  assert.equal(
    a.manifest.counts.worksMapped,
    3
  );

  assert.equal(
    a.manifest.counts.worksWithoutConfirmedAuthority,
    1
  );

  assert.equal(
    a.manifest.counts.rawAuthorMentions,
    7
  );

  assert.equal(
    a.manifest.counts.unresolvedAuthorMentions,
    1
  );

  assert.equal(
    a.manifest.counts.confirmedAuthorityMentions,
    5
  );

  assert.equal(
    a.manifest.counts.collapsedAuthorityMentions,
    1
  );

  assert.deepEqual(
    a.rows.map(
      row =>
        row.w
    ),
    [
      "openalex:W1001",
      "openalex:W1002",
      "openalex:W1004"
    ]
  );

  const merged =
    a.rows.find(
      row =>
        row.w ===
        "openalex:W1004"
    );

  assert.equal(
    merged.a.length,
    1
  );

  assert.deepEqual(
    merged.a[0].i,
    [
      "123",
      "456"
    ]
  );
});


test("routing del bridge es estable", () => {
  assert.equal(
    authorityWorkShard(
      "openalex:W1001",
      8
    ),
    authorityWorkShard(
      "openalex:W1001",
      8
    )
  );
});


test("build rechaza work-authors con hash distinto al manifest", async () => {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "authority-work-map-tamper-"
      )
    );

  const fixture =
    await makeFixture(
      root
    );

  await writeFile(
    join(
      fixture.authorIndex,
      "work-authors",
      "fixture.jsonl"
    ),
    "{}\n",
    "utf8"
  );

  await assert.rejects(
    buildAuthorityWorkMap({
      authorIndexRoot:
        fixture.authorIndex,
      authorityRoot:
        fixture.authority,
      outputRoot:
        join(
          root,
          "output"
        ),
      shardCount:
        8
    }),
    /size mismatch|hash mismatch/
  );
});

import {
  mkdir,
  rm,
  writeFile
} from "node:fs/promises";
import {resolve, join} from "node:path";
import {
  buildAuthorityBatchFromIndex
} from "./build-authority-batch-v1.mjs";

async function writeJson(path, value) {
  await writeFile(
    path,
    JSON.stringify(value, null, 2) + "\n",
    "utf8"
  );
}

async function writeJsonl(path, rows) {
  await writeFile(
    path,
    rows.map(row => JSON.stringify(row)).join("\n") + "\n",
    "utf8"
  );
}

const root = resolve(
  process.argv[2] ||
  "artifacts/author-authority-batch-fixture-v1"
);
const inputRoot = join(root, "input", "author-index-v2");
const outputRoot = join(root, "site", "author-authority-v1");

await rm(root, {recursive: true, force: true});
await mkdir(join(inputRoot, "aliases"), {recursive: true});
await mkdir(join(inputRoot, "works"), {recursive: true});

const aliasRows = [
  {
    s: "ana perez",
    id: 123,
    n: "Ana Pérez",
    o: "0000-0001-1111-1111",
    cw: 2,
    w: 2,
    c: 4,
    k: "full"
  },
  {
    s: "ana maria perez",
    id: 456,
    n: "Ana María Pérez",
    o: "0000-0001-1111-1111",
    cw: 1,
    w: 1,
    c: 2,
    k: "full"
  },
  {
    s: "jose martinez",
    id: 789,
    n: "José Martínez",
    o: null,
    cw: 1,
    w: 1,
    c: 0,
    k: "full"
  },
  {
    s: "jose martinez",
    id: 111,
    n: "José Martínez",
    o: null,
    cw: 1,
    w: 1,
    c: 0,
    k: "full"
  }
];

const workRows = [
  {
    id: 123,
    wid: 1001,
    p: "first",
    r: true,
    co: 1,
    t: "Identidad y memoria",
    y: 2022,
    l: "es",
    ty: "article"
  },
  {
    id: 456,
    wid: 1002,
    p: "first",
    r: false,
    co: 0,
    t: "Crítica y experiencia",
    y: 2023,
    l: "es",
    ty: "article"
  },
  {
    id: 789,
    wid: 1003,
    p: "first",
    r: false,
    co: 0,
    t: "Ética y acción",
    y: 2021,
    l: "es",
    ty: "article"
  },
  {
    id: 111,
    wid: 1004,
    p: "first",
    r: false,
    co: 0,
    t: "Lenguaje y mundo",
    y: 2020,
    l: "es",
    ty: "article"
  }
];

await writeJsonl(
  join(inputRoot, "aliases", "fixture.jsonl"),
  aliasRows
);
await writeJsonl(
  join(inputRoot, "works", "fixture.jsonl"),
  workRows
);

await writeJson(
  join(inputRoot, "manifest.json"),
  {
    schema_version: "remote-author-index-manifest-v1",
    version: "author-index-v2",
    bucket_count: 1024,
    hash: "fnv1a-32",
    normalization:
      "unicode-nfkd-casefold-token-signature-v1",
    source: {
      snapshot_repo: "Mearman/OpenAlex",
      snapshot_revision: "fixture-snapshot-v1",
      philosophy_repo:
        "CristianPelayo/openalex-philosophy",
      philosophy_revision: "fixture-philosophy-v1",
      philosophy_path:
        "v3.2/philosophy-corpus-v3-2-search.parquet"
    },
    counts: {
      alias_rows: aliasRows.length,
      work_rows_published: workRows.length
    },
    coverage: {
      works_with_authorship_ratio: 1,
      authors_resolved_ratio: 1
    },
    files: {
      aliases: [{path: "aliases/fixture.jsonl"}],
      works: [{path: "works/fixture.jsonl"}],
      work_authors: []
    }
  }
);

const result = await buildAuthorityBatchFromIndex({
  inputRoot,
  outputRoot,
  shardCount: 8,
  buildRevision: "authority-batch-fixture-v1"
});

if (result.manifest.input.candidateGroups !== 3) {
  throw new Error(
    "Fixture expected 3 candidate groups, got " +
    result.manifest.input.candidateGroups
  );
}

if (result.manifest.counts.authorities !== 3) {
  throw new Error(
    "Fixture expected 3 authorities, got " +
    result.manifest.counts.authorities
  );
}

if (result.manifest.counts.mentions !== 4) {
  throw new Error(
    "Fixture expected 4 mentions, got " +
    result.manifest.counts.mentions
  );
}

if (
  result.manifest.conflicts.alias.length ||
  result.manifest.conflicts.registry.length ||
  result.manifest.conflicts.duplicateAuthorityIds.length
) {
  throw new Error(
    "Fixture produced authority conflicts: " +
    JSON.stringify(result.manifest.conflicts)
  );
}

const ana123 =
  result.registry.identifierRegistry["openalex-author:123"];
const ana456 =
  result.registry.identifierRegistry["openalex-author:456"];
const jose789 =
  result.registry.identifierRegistry["openalex-author:789"];
const jose111 =
  result.registry.identifierRegistry["openalex-author:111"];

if (!ana123 || ana123 !== ana456) {
  throw new Error(
    "Shared ORCID did not converge to one AuthorityPerson"
  );
}

if (!jose789 || !jose111 || jose789 === jose111) {
  throw new Error(
    "Name-only homonyms were incorrectly merged"
  );
}

console.log(JSON.stringify({
  outputRoot: result.outputRoot,
  candidateGroups: result.manifest.input.candidateGroups,
  authorities: result.manifest.counts.authorities,
  mentions: result.manifest.counts.mentions,
  shardFiles: result.manifest.files.shards.length,
  sharedOrcidAuthority: ana123,
  homonymsRemainSeparate: true
}, null, 2));

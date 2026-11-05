import {
  readFile,
  stat,
  writeFile,
  mkdir
} from "node:fs/promises";
import {createHash} from "node:crypto";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";


const EXPECTED_MANIFEST_SCHEMA =
  "author-authority-batch-manifest-v1";
const EXPECTED_SHARD_SCHEMA =
  "author-authority-batch-shard-v1";
const EXPECTED_REGISTRY_SCHEMA =
  "author-authority-registry-v1";


function parseArgs(argv) {
  const output = {};

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const value = argv[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key =
      value.slice(2);

    const next =
      argv[index + 1];

    if (
      next &&
      !next.startsWith("--")
    ) {
      output[key] = next;
      index += 1;
    } else {
      output[key] = true;
    }
  }

  return output;
}


async function readJson(path) {
  return JSON.parse(
    await readFile(
      path,
      "utf8"
    )
  );
}


async function sha256File(path) {
  const hash =
    createHash("sha256");

  hash.update(
    await readFile(path)
  );

  return hash.digest("hex");
}


function sortedObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value)
      .sort(
        ([left], [right]) =>
          left.localeCompare(right)
      )
  );
}


function stableJson(value) {
  return JSON.stringify(
    value,
    Object.keys(value || {}).sort()
  );
}


function assertEqual(
  actual,
  expected,
  label
) {
  if (actual !== expected) {
    throw new Error(
      label +
      " mismatch: expected " +
      JSON.stringify(expected) +
      ", got " +
      JSON.stringify(actual)
    );
  }
}


function assertEmpty(
  values,
  label
) {
  if (
    Array.isArray(values) &&
    values.length
  ) {
    throw new Error(
      label +
      " must be empty, got " +
      JSON.stringify(values.slice(0, 10))
    );
  }
}


function ensureUnique(
  seen,
  key,
  label
) {
  if (seen.has(key)) {
    throw new Error(
      label +
      " duplicated: " +
      key
    );
  }

  seen.add(key);
}


async function verifyFileRecord(
  root,
  record
) {
  const path =
    join(
      root,
      record.path
    );

  const info =
    await stat(path);

  if (
    record.sizeBytes != null
  ) {
    assertEqual(
      info.size,
      Number(record.sizeBytes),
      "artifact size " + record.path
    );
  }

  if (record.sha256) {
    assertEqual(
      await sha256File(path),
      record.sha256,
      "artifact SHA-256 " + record.path
    );
  }

  return path;
}


export async function validateAuthorityBatch({
  authorityRoot,
  sourceManifestPath = null,
  outputPath = null
} = {}) {
  if (!authorityRoot) {
    throw new TypeError(
      "authorityRoot is required"
    );
  }

  const root =
    resolve(authorityRoot);

  const manifestPath =
    join(
      root,
      "manifest.json"
    );

  const registryPath =
    join(
      root,
      "registry.json"
    );

  const [
    manifest,
    registry
  ] =
    await Promise.all([
      readJson(manifestPath),
      readJson(registryPath)
    ]);

  assertEqual(
    manifest.schemaVersion,
    EXPECTED_MANIFEST_SCHEMA,
    "authority manifest schema"
  );

  assertEqual(
    registry.schemaVersion,
    EXPECTED_REGISTRY_SCHEMA,
    "authority registry schema"
  );

  assertEqual(
    registry.shardCount,
    manifest.shardCount,
    "registry shard count"
  );

  assertEqual(
    registry.buildRevision,
    manifest.buildRevision,
    "registry build revision"
  );

  assertEqual(
    registry.datasetRevision,
    manifest.datasetRevision,
    "registry dataset revision"
  );

  const registryRecord =
    manifest.files?.registry;

  if (!registryRecord) {
    throw new Error(
      "authority manifest registry record is missing"
    );
  }

  await verifyFileRecord(
    root,
    registryRecord
  );

  if (sourceManifestPath) {
    const sourcePath =
      resolve(
        sourceManifestPath
      );

    const sourceManifest =
      await readJson(
        sourcePath
      );

    assertEqual(
      manifest.source
        ?.manifestSha256,
      await sha256File(
        sourcePath
      ),
      "source manifest SHA-256"
    );

    assertEqual(
      Number(
        manifest.input
          ?.aggregatedAuthorProfiles
      ),
      Number(
        sourceManifest.counts
          ?.resolved_authors
      ),
      "resolved author coverage"
    );
  }

  assertEqual(
    Number(
      manifest.input
        ?.workRowsMissingCandidate
    ),
    0,
    "work rows missing candidate"
  );

  assertEqual(
    Number(
      manifest.input
        ?.workRowsSeen
    ),
    Number(
      manifest.input
        ?.workRowsRouted
    ),
    "routed work rows"
  );

  const conflicts =
    manifest.conflicts ||
    {};

  assertEmpty(
    conflicts.alias,
    "alias conflicts"
  );

  assertEmpty(
    conflicts.registry,
    "registry conflicts"
  );

  assertEmpty(
    conflicts.duplicateAuthorityIds,
    "duplicate authority ids"
  );

  const shardRecords =
    manifest.files?.shards ||
    [];

  if (!shardRecords.length) {
    throw new Error(
      "authority manifest has no shard files"
    );
  }

  assertEqual(
    shardRecords.length,
    Number(
      manifest.counts
        ?.shards
    ),
    "manifest shard count"
  );

  if (
    shardRecords.length >
    Number(manifest.shardCount)
  ) {
    throw new Error(
      "authority shard inventory exceeds shardCount"
    );
  }

  const observed = {
    shards: 0,
    candidates: 0,
    workRows: 0,
    mentions: 0,
    authorities: 0,
    confirmed: 0,
    probable: 0,
    ambiguous: 0,
    unresolved: 0,
    rejected: 0,
    missingCandidateAuthors: 0
  };

  const authorityLocations = {};
  const identifierRegistry = {};
  const candidateRegistry = {};

  const authorityIds =
    new Set();

  const shardIds =
    new Set();

  for (
    const record of
    shardRecords
  ) {
    const path =
      await verifyFileRecord(
        root,
        record
      );

    const shard =
      await readJson(
        path
      );

    assertEqual(
      shard.schemaVersion,
      EXPECTED_SHARD_SCHEMA,
      "authority shard schema"
    );

    assertEqual(
      shard.shardCount,
      manifest.shardCount,
      "authority shardCount " + record.path
    );

    assertEqual(
      shard.buildRevision,
      manifest.buildRevision,
      "authority shard build revision " + record.path
    );

    assertEqual(
      shard.datasetRevision,
      manifest.datasetRevision,
      "authority shard dataset revision " + record.path
    );

    ensureUnique(
      shardIds,
      Number(shard.shard),
      "authority shard number"
    );

    observed.shards += 1;
    observed.candidates +=
      Number(
        shard.candidateCount ||
        0
      );
    observed.workRows +=
      Number(
        shard.workRowCount ||
        0
      );

    const graph =
      shard.graph ||
      {};

    observed.mentions +=
      Number(
        graph.buildMetrics
          ?.mentionsSeen ||
        0
      );

    const authorities =
      Array.isArray(
        graph.authorities
      )
        ? graph.authorities
        : [];

    observed.authorities +=
      authorities.length;

    const statuses =
      graph.buildMetrics
        ?.decisionsByStatus ||
      {};

    for (
      const status of
      [
        "confirmed",
        "probable",
        "ambiguous",
        "unresolved",
        "rejected"
      ]
    ) {
      observed[status] +=
        Number(
          statuses[status] ||
          0
        );
    }

    const missing =
      Array.isArray(
        shard.missingCandidateAuthorIds
      )
        ? shard.missingCandidateAuthorIds
        : [];

    observed.missingCandidateAuthors +=
      missing.length;

    if (missing.length) {
      throw new Error(
        "authority shard contains missing candidate author IDs: " +
        record.path
      );
    }

    assertEqual(
      Number(record.authorities),
      authorities.length,
      "authority count " + record.path
    );

    assertEqual(
      Number(record.mentions),
      Number(
        graph.buildMetrics
          ?.mentionsSeen ||
        0
      ),
      "mention count " + record.path
    );

    for (
      const authority of
      authorities
    ) {
      const id =
        String(
          authority?.id ||
          ""
        );

      if (!id) {
        throw new Error(
          "authority without id in " +
          record.path
        );
      }

      ensureUnique(
        authorityIds,
        id,
        "AuthorityPerson id"
      );

      authorityLocations[id] =
        Number(shard.shard);
    }

    for (
      const [
        key,
        authorityId
      ] of
      Object.entries(
        graph.identifierRegistry ||
        {}
      )
    ) {
      const previous =
        identifierRegistry[key];

      if (
        previous &&
        previous !== authorityId
      ) {
        throw new Error(
          "identifier registry conflict: " +
          key
        );
      }

      identifierRegistry[key] =
        authorityId;
    }

    for (
      const [
        key,
        authorityId
      ] of
      Object.entries(
        graph.candidateRegistry ||
        {}
      )
    ) {
      const previous =
        candidateRegistry[key];

      if (
        previous &&
        previous !== authorityId
      ) {
        throw new Error(
          "candidate registry conflict: " +
          key
        );
      }

      candidateRegistry[key] =
        authorityId;
    }
  }

  for (
    const [
      key,
      authorityId
    ] of
    Object.entries(
      identifierRegistry
    )
  ) {
    if (
      !authorityIds.has(
        authorityId
      )
    ) {
      throw new Error(
        "identifier registry points to missing authority: " +
        key
      );
    }
  }

  for (
    const [
      key,
      authorityId
    ] of
    Object.entries(
      candidateRegistry
    )
  ) {
    if (
      !authorityIds.has(
        authorityId
      )
    ) {
      throw new Error(
        "candidate registry points to missing authority: " +
        key
      );
    }
  }

  const expectedCounts =
    manifest.counts ||
    {};

  for (
    const key of
    Object.keys(observed)
  ) {
    assertEqual(
      observed[key],
      Number(
        expectedCounts[key] ||
        0
      ),
      "authority manifest count " +
        key
    );
  }

  assertEqual(
    stableJson(
      sortedObject(
        authorityLocations
      )
    ),
    stableJson(
      sortedObject(
        registry.authorityLocations ||
        {}
      )
    ),
    "authorityLocations registry"
  );

  assertEqual(
    stableJson(
      sortedObject(
        identifierRegistry
      )
    ),
    stableJson(
      sortedObject(
        registry.identifierRegistry ||
        {}
      )
    ),
    "identifierRegistry"
  );

  assertEqual(
    stableJson(
      sortedObject(
        candidateRegistry
      )
    ),
    stableJson(
      sortedObject(
        registry.candidateRegistry ||
        {}
      )
    ),
    "candidateRegistry"
  );

  const report = {
    schemaVersion:
      "author-authority-batch-validation-v1",

    status:
      "pass",

    manifestSha256:
      await sha256File(
        manifestPath
      ),

    registrySha256:
      await sha256File(
        registryPath
      ),

    buildRevision:
      manifest.buildRevision,

    datasetRevision:
      manifest.datasetRevision,

    counts:
      observed,

    input:
      manifest.input
  };

  if (outputPath) {
    const destination =
      resolve(outputPath);

    await mkdir(
      dirname(destination),
      {
        recursive:
          true
      }
    );

    await writeFile(
      destination,
      JSON.stringify(
        report,
        null,
        2
      ) +
        "\n",
      "utf8"
    );
  }

  return report;
}


async function main() {
  const args =
    parseArgs(
      process.argv.slice(2)
    );

  const report =
    await validateAuthorityBatch({
      authorityRoot:
        args.authority,

      sourceManifestPath:
        args["source-manifest"] ||
        null,

      outputPath:
        args.output ||
        null
    });

  console.log(
    JSON.stringify(
      report,
      null,
      2
    )
  );
}


const isMain =
  process.argv[1] &&
  resolve(
    process.argv[1]
  ) ===
    fileURLToPath(
      import.meta.url
    );

if (isMain) {
  main().catch(
    error => {
      console.error(
        error
      );

      process.exitCode =
        1;
    }
  );
}

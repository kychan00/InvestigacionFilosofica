import {
  appendFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import {createReadStream} from "node:fs";
import {createHash} from "node:crypto";
import {resolve, join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createInterface} from "node:readline";
import {
  createAuthorAliasAccumulator,
  groupAggregatedAuthorProfiles,
  partitionAuthorityCandidates,
  buildAuthorityBatchShard,
  summarizeAuthorityBatchShards,
  DEFAULT_AUTHORITY_SHARD_COUNT
} from "../../src/core/author-authority-batch.js";

function parseArgs(argv) {
  const output = {};
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      output[key] = next;
      index++;
    } else {
      output[key] = true;
    }
  }
  return output;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonMaybe(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function* readJsonLines(path) {
  const input = createReadStream(path, {encoding: "utf8"});
  const lines = createInterface({
    input,
    crlfDelay: Infinity
  });

  for await (const line of lines) {
    if (!line.trim()) continue;
    yield JSON.parse(line);
  }
}

async function readJsonLinesArray(path) {
  const rows = [];
  for await (const row of readJsonLines(path)) rows.push(row);
  return rows;
}

async function sha256File(path) {
  const hash = createHash("sha256");
  const input = createReadStream(path);
  for await (const chunk of input) hash.update(chunk);
  return hash.digest("hex");
}

function shardName(shard) {
  return String(shard).padStart(3, "0") + ".json";
}

function sourceRevision(manifest = {}) {
  const source = manifest.source || {};
  return [
    manifest.version || "author-index-v3",
    source.snapshot_revision || "snapshot-unknown",
    source.philosophy_revision || "philosophy-unknown"
  ].join(":");
}

function compactSourceManifest(manifest = {}, manifestSha256 = null) {
  return {
    schemaVersion:
      manifest.schema_version ||
      "remote-author-index-manifest-v1",
    version: manifest.version || null,
    bucketCount: manifest.bucket_count || null,
    hash: manifest.hash || null,
    normalization: manifest.normalization || null,
    source: manifest.source || null,
    counts: manifest.counts || null,
    coverage: manifest.coverage || null,
    manifestSha256
  };
}

function filePaths(manifest, key) {
  return (manifest?.files?.[key] || [])
    .map(item => item?.path)
    .filter(Boolean);
}

async function appendShardRows(buffers, stagingRoot, shard, row, {
  flushSize = 750
} = {}) {
  const current = buffers.get(shard) || [];
  current.push(JSON.stringify(row));
  buffers.set(shard, current);

  if (current.length >= flushSize) {
    await flushShardBuffer(buffers, stagingRoot, shard);
  }
}

async function flushShardBuffer(buffers, stagingRoot, shard) {
  const current = buffers.get(shard);
  if (!current?.length) return;

  await mkdir(stagingRoot, {recursive: true});
  await appendFile(
    join(stagingRoot, shardName(shard) + ".jsonl"),
    current.join("\n") + "\n",
    "utf8"
  );
  buffers.set(shard, []);
}

async function flushAllShardBuffers(buffers, stagingRoot) {
  for (const shard of buffers.keys()) {
    await flushShardBuffer(buffers, stagingRoot, shard);
  }
}

function lightweightShardSummary(shard) {
  return {
    shard: shard.shard,
    candidateCount: shard.candidateCount,
    workRowCount: shard.workRowCount,
    missingCandidateAuthorIds: shard.missingCandidateAuthorIds,
    graph: {
      authorities: (shard.graph.authorities || []).map(item => ({
        id: item.id
      })),
      buildMetrics: shard.graph.buildMetrics,
      identifierRegistry: shard.graph.identifierRegistry,
      candidateRegistry: shard.graph.candidateRegistry
    }
  };
}

export async function buildAuthorityBatchFromIndex({
  inputRoot,
  outputRoot,
  previousRoot = null,
  shardCount = DEFAULT_AUTHORITY_SHARD_COUNT,
  buildRevision = process.env.GITHUB_SHA || "local-authority-batch-v1"
} = {}) {
  if (!inputRoot) throw new TypeError("inputRoot is required");
  if (!outputRoot) throw new TypeError("outputRoot is required");

  const resolvedInput = resolve(inputRoot);
  const resolvedOutput = resolve(outputRoot);
  const resolvedPrevious = previousRoot ? resolve(previousRoot) : null;
  const manifestPath = join(resolvedInput, "manifest.json");
  const inputManifest = await readJson(manifestPath);
  const manifestSha256 = await sha256File(manifestPath);
  const datasetRevision = sourceRevision(inputManifest);

  await rm(resolvedOutput, {recursive: true, force: true});
  await mkdir(join(resolvedOutput, "shards"), {recursive: true});

  const aliasAccumulator = createAuthorAliasAccumulator();
  let aliasRowsSeen = 0;

  for (const relativePath of filePaths(inputManifest, "aliases")) {
    const path = join(resolvedInput, relativePath);
    for await (const row of readJsonLines(path)) {
      aliasAccumulator.add(row);
      aliasRowsSeen++;
    }
  }

  const grouped = groupAggregatedAuthorProfiles(
    aliasAccumulator.finish()
  );
  const candidateBuckets = partitionAuthorityCandidates(
    grouped.candidates,
    shardCount
  );

  const candidateShardByRef = new Map();
  for (const [shard, candidates] of candidateBuckets.entries()) {
    for (const candidate of candidates) {
      candidateShardByRef.set(candidate.id, shard);
    }
  }

  const stagingRoot = join(resolvedOutput, ".staging");
  const buffers = new Map();
  let workRowsSeen = 0;
  let workRowsRouted = 0;
  let workRowsMissingCandidate = 0;

  for (const relativePath of filePaths(inputManifest, "works")) {
    const path = join(resolvedInput, relativePath);
    for await (const row of readJsonLines(path)) {
      workRowsSeen++;
      const authorId = String(row?.id || "").replace(/^A/i, "");
      const candidateRef = grouped.authorIdToCandidateRef[authorId];
      const shard = candidateRef
        ? candidateShardByRef.get(candidateRef)
        : undefined;

      if (shard === undefined) {
        workRowsMissingCandidate++;
        continue;
      }

      await appendShardRows(
        buffers,
        stagingRoot,
        shard,
        row
      );
      workRowsRouted++;
    }
  }

  await flushAllShardBuffers(buffers, stagingRoot);

  const shardSummaries = [];
  const shardFiles = [];

  for (const shard of [...candidateBuckets.keys()].sort((a, b) => a - b)) {
    const candidates = candidateBuckets.get(shard) || [];
    const stagingPath = join(
      stagingRoot,
      shardName(shard) + ".jsonl"
    );
    const workRows = await readJsonMaybe(stagingPath)
      ? []
      : null;

    let actualWorkRows;
    try {
      actualWorkRows = await readJsonLinesArray(stagingPath);
    } catch (error) {
      if (error?.code === "ENOENT") actualWorkRows = [];
      else throw error;
    }

    let previousGraph = null;
    if (resolvedPrevious) {
      const previousShard = await readJsonMaybe(
        join(resolvedPrevious, "shards", shardName(shard))
      );
      previousGraph = previousShard?.graph || null;
    }

    const built = buildAuthorityBatchShard({
      shard,
      shardCount,
      candidates,
      workRows: actualWorkRows,
      previousGraph,
      algorithmVersion: "identity-v1",
      datasetRevision,
      buildRevision
    });

    const destination = join(
      resolvedOutput,
      "shards",
      shardName(shard)
    );
    await writeFile(
      destination,
      JSON.stringify(built, null, 2) + "\n",
      "utf8"
    );

    const info = await stat(destination);
    shardFiles.push({
      path: "shards/" + shardName(shard),
      sizeBytes: info.size,
      sha256: await sha256File(destination),
      authorities: built.graph.authorities.length,
      mentions: built.graph.buildMetrics.mentionsSeen
    });
    shardSummaries.push(lightweightShardSummary(built));
  }

  const summary = summarizeAuthorityBatchShards({
    shards: shardSummaries,
    shardCount,
    sourceManifest: compactSourceManifest(
      inputManifest,
      manifestSha256
    ),
    datasetRevision,
    buildRevision,
    aliasConflicts: grouped.conflicts
  });

  const registry = {
    schemaVersion: "author-authority-registry-v1",
    shardCount,
    buildRevision,
    datasetRevision,
    authorityLocations: summary.authorityLocations,
    identifierRegistry: summary.identifierRegistry,
    candidateRegistry: summary.candidateRegistry
  };

  const registryPath = join(resolvedOutput, "registry.json");
  await writeFile(
    registryPath,
    JSON.stringify(registry, null, 2) + "\n",
    "utf8"
  );

  const manifest = {
    schemaVersion: "author-authority-batch-manifest-v1",
    buildRevision,
    datasetRevision,
    shardCount,
    source: summary.sourceManifest,
    input: {
      aliasRowsSeen,
      aggregatedAuthorProfiles: aliasAccumulator.size,
      candidateGroups: grouped.candidates.length,
      workRowsSeen,
      workRowsRouted,
      workRowsMissingCandidate
    },
    counts: summary.counts,
    conflicts: summary.conflicts,
    files: {
      registry: {
        path: "registry.json",
        sizeBytes: (await stat(registryPath)).size,
        sha256: await sha256File(registryPath)
      },
      shards: shardFiles
    }
  };

  const outputManifestPath = join(resolvedOutput, "manifest.json");
  await writeFile(
    outputManifestPath,
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );

  await rm(stagingRoot, {recursive: true, force: true});

  return {
    manifest,
    registry,
    outputRoot: resolvedOutput
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputRoot = args.input;
  const outputRoot =
    args.output ||
    "artifacts/author-authority-batch-v1";
  const previousRoot = args.previous || null;
  const shardCount = Number(
    args["shard-count"] ||
    DEFAULT_AUTHORITY_SHARD_COUNT
  );

  const result = await buildAuthorityBatchFromIndex({
    inputRoot,
    outputRoot,
    previousRoot,
    shardCount,
    buildRevision:
      args["build-revision"] ||
      process.env.GITHUB_SHA ||
      "local-authority-batch-v1"
  });

  console.log(JSON.stringify({
    outputRoot: result.outputRoot,
    authorities: result.manifest.counts.authorities,
    mentions: result.manifest.counts.mentions,
    conflicts: result.manifest.conflicts,
    shardFiles: result.manifest.files.shards.length
  }, null, 2));
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) ===
    fileURLToPath(import.meta.url);

if (isMain) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

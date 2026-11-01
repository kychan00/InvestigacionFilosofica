import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {createReadStream} from "node:fs";
import {createHash} from "node:crypto";
import {dirname, join, resolve} from "node:path";
import {createInterface} from "node:readline";
import {
  createAuthorAliasAccumulator,
  groupAggregatedAuthorProfiles
} from "../../src/core/author-authority-batch.js";
import {
  buildAuthorityBenchmarkReport,
  evaluateCuratedGoldCases
} from "../../src/core/author-authority-benchmark.js";
import {
  findCuratedAuthorIdentity
} from "../../src/core/author-curated-identities.js";

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

async function sha256File(path) {
  const hash = createHash("sha256");
  const input = createReadStream(path);
  for await (const chunk of input) hash.update(chunk);
  return hash.digest("hex");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      label + " mismatch: expected " +
      JSON.stringify(expected) +
      ", got " +
      JSON.stringify(actual)
    );
  }
}

function validateSourceManifest(manifest, config) {
  const expected = config.expectedSource || {};
  const source = manifest.source || {};

  assertEqual(
    source.snapshot_repo,
    expected.snapshotRepo,
    "snapshot repo"
  );
  assertEqual(
    source.snapshot_revision,
    expected.snapshotRevision,
    "snapshot revision"
  );
  assertEqual(
    source.philosophy_repo,
    expected.philosophyRepo,
    "philosophy repo"
  );
  assertEqual(
    source.philosophy_revision,
    expected.philosophyRevision,
    "philosophy revision"
  );
  assertEqual(
    source.philosophy_path,
    expected.philosophyPath,
    "philosophy path"
  );
}

function aliasPaths(manifest = {}) {
  return (manifest.files?.aliases || [])
    .map(item => item?.path)
    .filter(Boolean)
    .sort();
}

function compactViolationPayload(report, aliasConflicts) {
  return {
    schemaVersion: "author-authority-benchmark-violations-v1",
    gate: report.gate,
    goldFailures: report.gold?.failures || [],
    falseMergeGroups: report.silver.falseMergeGroups,
    falseSplitGroups: report.silver.falseSplitGroups,
    quarantinedAliasConflicts: aliasConflicts
  };
}

function auditPayload(report) {
  return {
    schemaVersion: "author-authority-audit-sample-v1",
    seed: report.seed,
    sampleSize: report.sampleSize,
    nameCollisions: report.nameCollisions,
    profileStrata: report.auditSample
  };
}

export async function runAuthorAuthorityBenchmark({
  inputRoot,
  outputPath,
  configPath =
    "benchmark/author-authority/v1/config.json",
  goldPath =
    "benchmark/author-authority/v1/gold-curated.json"
} = {}) {
  if (!inputRoot) {
    throw new TypeError("inputRoot is required");
  }
  if (!outputPath) {
    throw new TypeError("outputPath is required");
  }

  const resolvedInput = resolve(inputRoot);
  const resolvedOutput = resolve(outputPath);
  const config = await readJson(resolve(configPath));
  const goldFile = await readJson(resolve(goldPath));
  const manifestPath = join(resolvedInput, "manifest.json");
  const manifest = await readJson(manifestPath);

  validateSourceManifest(manifest, config);

  const accumulator = createAuthorAliasAccumulator();
  let aliasRowsSeen = 0;

  const aliases = aliasPaths(manifest);
  if (!aliases.length) {
    throw new Error("Source manifest contains no alias shards");
  }

  for (const relativePath of aliases) {
    const absolutePath = join(resolvedInput, relativePath);
    for await (const row of readJsonLines(absolutePath)) {
      accumulator.add(row);
      aliasRowsSeen++;
    }
  }

  const aggregated = accumulator.finish();
  const grouped = groupAggregatedAuthorProfiles(aggregated);

  const gold = evaluateCuratedGoldCases(
    goldFile.cases || [],
    {
      resolveCuratedIdentity: findCuratedAuthorIdentity
    }
  );

  const report = buildAuthorityBenchmarkReport({
    sourceManifest: manifest,
    release: {
      ...config.release,
      manifestSha256: await sha256File(manifestPath)
    },
    profiles: aggregated.profiles,
    aliasConflicts: aggregated.conflicts,
    grouped,
    gold,
    seed: Number(config.seed || 20261101),
    sampleSize: Number(
      config.sampleSizePerStratum || 100
    ),
    thresholds: config.gate || {},
    generatedAt: null
  });

  report.scan = {
    aliasFiles: aliases.length,
    aliasRowsSeen,
    aggregatedProfiles: aggregated.profiles.length,
    candidateGroups: grouped.candidates.length
  };

  const outputDirectory = dirname(resolvedOutput);
  await mkdir(outputDirectory, {recursive: true});

  await writeFile(
    resolvedOutput,
    JSON.stringify(report, null, 2) + "\n",
    "utf8"
  );

  const auditPath = join(
    outputDirectory,
    "audit-sample.json"
  );
  await writeFile(
    auditPath,
    JSON.stringify(auditPayload(report), null, 2) + "\n",
    "utf8"
  );

  const violationsPath = join(
    outputDirectory,
    "violations.json"
  );
  await writeFile(
    violationsPath,
    JSON.stringify(
      compactViolationPayload(
        report,
        aggregated.conflicts
      ),
      null,
      2
    ) + "\n",
    "utf8"
  );

  if (!report.gate.passed) {
    const error = new Error(
      "Author Authority benchmark gate failed: " +
      JSON.stringify(report.gate.failures)
    );
    error.report = report;
    throw error;
  }

  return {
    report,
    outputPath: resolvedOutput,
    auditPath,
    violationsPath
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const result = await runAuthorAuthorityBenchmark({
    inputRoot: args.input,
    outputPath:
      args.output ||
      "artifacts/author-authority-benchmark-v1/report.json",
    configPath:
      args.config ||
      "benchmark/author-authority/v1/config.json",
    goldPath:
      args.gold ||
      "benchmark/author-authority/v1/gold-curated.json"
  });

  console.log(JSON.stringify({
    output: result.outputPath,
    gatePassed: result.report.gate.passed,
    profiles: result.report.corpus.aliasProfiles,
    candidateGroups:
      result.report.corpus.candidateGroups,
    sharedOrcidGroups:
      result.report.silver.sharedOrcidGroups,
    falseMergeCount:
      result.report.silver.falseMergeCount,
    falseSplitCount:
      result.report.silver.falseSplitCount,
    nameCollisionGroups:
      result.report.nameCollisions.collisionGroups,
    goldFailures:
      result.report.gold?.failed ?? null
  }, null, 2));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) ===
    resolve(new URL(import.meta.url).pathname)
) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

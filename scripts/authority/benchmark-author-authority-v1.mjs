import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {createReadStream} from "node:fs";
import {createHash} from "node:crypto";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {
  readJsonLines
} from "./read-jsonl-v1.mjs";
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

function manifestPaths(manifest = {}, key) {
  return (manifest.files?.[key] || [])
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
  const aliasAuthorIds = new Set();
  let aliasRowsSeen = 0;
  let workAuthorRowsSeen = 0;
  let workAuthorMembershipsSeen = 0;

  const aliases = manifestPaths(manifest, "aliases");
  if (!aliases.length) {
    throw new Error("Source manifest contains no alias shards");
  }

  for (const relativePath of aliases) {
    const absolutePath = join(resolvedInput, relativePath);
    for await (const row of readJsonLines(absolutePath)) {
      accumulator.add(row);
      aliasAuthorIds.add(String(row?.id || ""));
      aliasRowsSeen++;
    }
  }

  const workAuthors = manifestPaths(
    manifest,
    "work_authors"
  );

  for (const relativePath of workAuthors) {
    const absolutePath = join(resolvedInput, relativePath);
    for await (const row of readJsonLines(absolutePath)) {
      workAuthorRowsSeen++;
      for (const author of Array.isArray(row?.a) ? row.a : []) {
        accumulator.add({
          id: author.id,
          n: author.n,
          o: author.o,
          cw: 0,
          w: 0,
          c: 0
        });
        workAuthorMembershipsSeen++;
      }
    }
  }

  const aggregated = accumulator.finish();
  const grouped = groupAggregatedAuthorProfiles(aggregated);

  const profilesMissingFromAliases = aggregated.profiles
    .filter(profile => !aliasAuthorIds.has(String(profile.id)))
    .map(profile => ({
      authorId: String(profile.id),
      name: profile.n || null,
      orcid: profile.o || null
    }))
    .sort((a, b) =>
      a.authorId.localeCompare(b.authorId)
    );

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
    aliasIndexedProfileCount: aliasAuthorIds.size,
    profilesMissingFromAliases,
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
    workAuthorFiles: workAuthors.length,
    workAuthorRowsSeen,
    workAuthorMembershipsSeen,
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
    profiles: result.report.corpus.profileInventory,
    aliasIndexedProfiles:
      result.report.corpus.aliasIndexedProfiles,
    profilesMissingFromAliases:
      result.report.corpus.profilesMissingFromAliases,
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
    fileURLToPath(import.meta.url)
) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

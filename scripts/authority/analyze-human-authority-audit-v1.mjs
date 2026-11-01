import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {
  evaluateHumanAuthorityAudit,
  promoteHumanAuthorityGold
} from "../../src/core/author-authority-human-audit.js";

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

async function readJsonLines(path) {
  return (await readFile(path, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(
          path + ":" + (index + 1) + ": " + error.message
        );
      }
    });
}

export async function analyzeHumanAuthorityAudit({
  packetRoot,
  judgmentsPath,
  outputPath,
  goldOutputPath
} = {}) {
  if (!packetRoot) {
    throw new TypeError("packetRoot is required");
  }
  if (!judgmentsPath) {
    throw new TypeError("judgmentsPath is required");
  }

  const root = resolve(packetRoot);
  const sample = await readJsonLines(join(root, "sample.jsonl"));
  const manifest = await readJson(join(root, "manifest.json"));
  const judgments = await readJsonLines(resolve(judgmentsPath));

  const evaluation = evaluateHumanAuthorityAudit({
    sample,
    manifestItems: manifest.items || [],
    judgments,
    minimumResolved:
      Number(manifest.judgments?.minimumResolved || 80)
  });

  const report = {
    schemaVersion:
      "author-authority-human-audit-report-v1",
    sampleSha256: manifest.sampleSha256,
    sourceBenchmark: manifest.sourceBenchmark,
    sourceRelease: manifest.sourceRelease,
    metrics: evaluation,
    cautions: [
      "The audit sample is risk-stratified and is not a prevalence estimate for all authors.",
      "False merge rate is evaluated only over automatic merge pairs that received a resolved human judgment.",
      "False split rate is diagnostic in V1 and is not a blocking threshold.",
      "Unresolved judgments are preserved and never coerced into same-person or different-person."
    ]
  };

  const gold = promoteHumanAuthorityGold({
    sample,
    manifestItems: manifest.items || [],
    judgments
  });

  const resolvedOutput =
    resolve(
      outputPath ||
      join(root, "human-audit-report.json")
    );
  const resolvedGold =
    resolve(
      goldOutputPath ||
      join(root, "human-gold-v1.jsonl")
    );

  await mkdir(dirname(resolvedOutput), {recursive: true});
  await mkdir(dirname(resolvedGold), {recursive: true});

  await writeFile(
    resolvedOutput,
    JSON.stringify(report, null, 2) + "\n",
    "utf8"
  );
  await writeFile(
    resolvedGold,
    gold.map(row => JSON.stringify(row)).join("\n") + "\n",
    "utf8"
  );

  return {
    report,
    gold,
    outputPath: resolvedOutput,
    goldOutputPath: resolvedGold
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const packetRoot =
    args.packet ||
    "artifacts/author-authority-human-audit-v1";
  const judgmentsPath =
    args.judgments ||
    "benchmark/author-authority/human-audit-v1/judgments.jsonl";

  const result = await analyzeHumanAuthorityAudit({
    packetRoot,
    judgmentsPath,
    outputPath: args.output,
    goldOutputPath: args.gold
  });

  console.log(JSON.stringify({
    gatePassed: result.report.metrics.gate.passed,
    judged: result.report.metrics.judged,
    resolved: result.report.metrics.resolved,
    unresolved: result.report.metrics.unresolved,
    falseMergeCount:
      result.report.metrics.falseMergeCount,
    falseSplitCount:
      result.report.metrics.falseSplitCount,
    humanFalseMergeRate:
      result.report.metrics.humanFalseMergeRate,
    humanFalseSplitRate:
      result.report.metrics.humanFalseSplitRate,
    goldPairs: result.gold.length,
    report: result.outputPath,
    gold: result.goldOutputPath
  }, null, 2));

  if (!result.report.metrics.gate.passed) {
    process.exitCode = 1;
  }
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

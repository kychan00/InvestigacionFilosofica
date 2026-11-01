import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {createReadStream} from "node:fs";
import {createHash} from "node:crypto";
import {basename, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {createInterface} from "node:readline";
import {
  runAuthorAuthorityBenchmark
} from "./benchmark-author-authority-v1.mjs";
import {
  sourceWorkBucketForAuthor
} from "../../src/core/author-authority-batch.js";
import {
  humanAuditSampleJsonl,
  selectHumanAuthorityAuditPairs
} from "../../src/core/author-authority-human-audit.js";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index++;
    } else {
      result[key] = true;
    }
  }
  return result;
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

function sha256Text(text) {
  return createHash("sha256")
    .update(text)
    .digest("hex");
}

function manifestPaths(manifest = {}, key) {
  return (manifest.files?.[key] || [])
    .map(item => item?.path)
    .filter(Boolean);
}

function bucketPathMap(paths = []) {
  const result = new Map();

  for (const path of paths) {
    const match = basename(path).match(/^(\d+)\.jsonl$/);
    if (!match) continue;
    result.set(Number(match[1]), path);
  }

  return result;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function workSort(left, right) {
  const leftYear = Number(left.year || 0);
  const rightYear = Number(right.year || 0);
  if (leftYear !== rightYear) return rightYear - leftYear;
  return String(left.workId).localeCompare(String(right.workId));
}

function profileEvidence(authorId, fallbackName = null) {
  return {
    authorId,
    displayName: fallbackName,
    openAlexUrl: "https://openalex.org/A" + authorId,
    observedNames: [],
    orcids: [],
    workCountObserved: 0,
    activeYears: {
      min: null,
      max: null
    },
    works: []
  };
}

function updateYearRange(profile, year) {
  const numeric = Number(year);
  if (!Number.isFinite(numeric) || numeric <= 0) return;

  if (
    profile.activeYears.min == null ||
    numeric < profile.activeYears.min
  ) {
    profile.activeYears.min = numeric;
  }

  if (
    profile.activeYears.max == null ||
    numeric > profile.activeYears.max
  ) {
    profile.activeYears.max = numeric;
  }
}

function selectedWork(row = {}) {
  return {
    workId: String(row.wid || ""),
    title: String(row.t || "").trim(),
    year: row.y ?? null,
    language: row.l || null,
    type: row.ty || null,
    authorPosition: row.p || null,
    corresponding: Boolean(row.r),
    coauthorCount: Number(row.co || 0),
    coauthors: []
  };
}

export async function buildHumanAuthorityEvidencePack({
  inputRoot,
  manifest,
  sample,
  maxWorksPerProfile = 12
}) {
  const targetNames = new Map();
  for (const item of sample) {
    targetNames.set(item.left.authorId, item.left.name);
    targetNames.set(item.right.authorId, item.right.name);
  }

  const targetIds = new Set(targetNames.keys());
  const profiles = new Map(
    [...targetIds].map(id => [
      id,
      profileEvidence(id, targetNames.get(id))
    ])
  );

  const worksByProfile = new Map(
    [...targetIds].map(id => [id, []])
  );

  const bucketCount = Number(manifest.bucket_count || 1024);
  const workPaths = bucketPathMap(
    manifestPaths(manifest, "works")
  );

  const workBuckets = new Set(
    [...targetIds].map(id =>
      sourceWorkBucketForAuthor(id, bucketCount)
    )
  );

  for (const bucket of [...workBuckets].sort((a, b) => a - b)) {
    const relativePath = workPaths.get(bucket);
    if (!relativePath) continue;

    for await (
      const row of readJsonLines(join(inputRoot, relativePath))
    ) {
      const authorId = String(row?.id || "").replace(/^A/i, "");
      if (!targetIds.has(authorId)) continue;

      const profile = profiles.get(authorId);
      const work = selectedWork(row);
      profile.workCountObserved++;
      updateYearRange(profile, work.year);
      worksByProfile.get(authorId).push(work);
    }
  }

  const selectedWorkIds = new Set();
  const workOwners = new Map();

  for (const [authorId, works] of worksByProfile) {
    const selected = works
      .sort(workSort)
      .slice(0, maxWorksPerProfile);

    profiles.get(authorId).works = selected;

    for (const work of selected) {
      selectedWorkIds.add(work.workId);
      const owners = workOwners.get(work.workId) || [];
      owners.push(authorId);
      workOwners.set(work.workId, owners);
    }
  }

  const workAuthorPaths = bucketPathMap(
    manifestPaths(manifest, "work_authors")
  );
  const workAuthorBuckets = new Set(
    [...selectedWorkIds].map(workId =>
      sourceWorkBucketForAuthor(workId, bucketCount)
    )
  );

  for (
    const bucket of
      [...workAuthorBuckets].sort((a, b) => a - b)
  ) {
    const relativePath = workAuthorPaths.get(bucket);
    if (!relativePath) continue;

    for await (
      const row of readJsonLines(join(inputRoot, relativePath))
    ) {
      const workId = String(row?.wid || "");
      if (!selectedWorkIds.has(workId)) continue;

      const creators = Array.isArray(row?.a) ? row.a : [];
      const owners = workOwners.get(workId) || [];

      for (const ownerId of owners) {
        const profile = profiles.get(ownerId);
        if (!profile) continue;

        const self = creators.find(
          creator =>
            String(creator?.id || "").replace(/^A/i, "") ===
            ownerId
        );

        if (self?.n) {
          profile.observedNames.push(String(self.n).trim());
        }
        if (self?.o) {
          profile.orcids.push(
            String(self.o)
              .replace(/^https?:\/\/orcid\.org\//i, "")
              .trim()
              .toUpperCase()
          );
        }

        const work = profile.works.find(
          item => item.workId === workId
        );
        if (!work) continue;

        work.coauthors = creators
          .filter(creator =>
            String(creator?.id || "").replace(/^A/i, "") !==
            ownerId
          )
          .map(creator => ({
            authorId:
              String(creator?.id || "").replace(/^A/i, ""),
            name: creator?.n || null,
            orcid: creator?.o
              ? String(creator.o)
                  .replace(/^https?:\/\/orcid\.org\//i, "")
                  .trim()
                  .toUpperCase()
              : null,
            position: creator?.p || null,
            corresponding: Boolean(creator?.r)
          }));
      }
    }
  }

  for (const profile of profiles.values()) {
    profile.observedNames = unique(
      [profile.displayName, ...profile.observedNames]
    ).sort();
    profile.orcids = unique(profile.orcids).sort();
    profile.orcidUrls = profile.orcids.map(
      orcid => "https://orcid.org/" + orcid
    );
  }

  return sample.map(item => ({
    audit_id: item.audit_id,
    left: profiles.get(item.left.authorId),
    right: profiles.get(item.right.authorId)
  }));
}

export async function buildHumanAuthorityAuditPacket({
  inputRoot,
  outputRoot,
  auditConfigPath =
    "benchmark/author-authority/human-audit-v1/config.json",
  benchmarkConfigPath =
    "benchmark/author-authority/v1/config.json",
  benchmarkGoldPath =
    "benchmark/author-authority/v1/gold-curated.json"
} = {}) {
  if (!inputRoot) {
    throw new TypeError("inputRoot is required");
  }
  if (!outputRoot) {
    throw new TypeError("outputRoot is required");
  }

  const resolvedInput = resolve(inputRoot);
  const resolvedOutput = resolve(outputRoot);
  const auditConfig = await readJson(resolve(auditConfigPath));
  const sourceManifest = await readJson(
    join(resolvedInput, "manifest.json")
  );

  await mkdir(resolvedOutput, {recursive: true});

  const benchmarkResult =
    await runAuthorAuthorityBenchmark({
      inputRoot: resolvedInput,
      outputPath: join(
        resolvedOutput,
        "source-benchmark-report.json"
      ),
      configPath: benchmarkConfigPath,
      goldPath: benchmarkGoldPath
    });

  const selection = selectHumanAuthorityAuditPairs({
    benchmarkReport: benchmarkResult.report
  });
  const sampleText = humanAuditSampleJsonl(selection.sample);
  const sampleSha256 = sha256Text(sampleText);

  const expectedSha =
    auditConfig.selection?.expectedSampleSha256;
  if (sampleSha256 !== expectedSha) {
    throw new Error(
      "Human audit sample changed: expected " +
      expectedSha +
      ", got " +
      sampleSha256
    );
  }

  const evidence = await buildHumanAuthorityEvidencePack({
    inputRoot: resolvedInput,
    manifest: sourceManifest,
    sample: selection.sample,
    maxWorksPerProfile:
      Number(auditConfig.evidence?.maxWorksPerProfile || 12)
  });

  const manifest = {
    schemaVersion:
      "author-authority-human-audit-manifest-v1",
    sampleSize: selection.counts.pairs,
    uniqueProfiles: selection.counts.uniqueProfiles,
    sampleSha256,
    sourceBenchmark: auditConfig.sourceBenchmark,
    sourceRelease: benchmarkResult.report.source,
    selection: {
      ...auditConfig.selection,
      counts: selection.counts.byStratum,
      blinding:
        "sample.jsonl omits ORCID, candidate refs and current graph relation. Hidden context is retained only in manifest.json."
    },
    judgments: auditConfig.judgments,
    items: selection.manifestItems
  };

  const judgmentsTemplate = selection.sample.map(item => ({
    audit_id: item.audit_id,
    judgment: null,
    note: "",
    evidence: []
  }));

  await Promise.all([
    writeFile(
      join(resolvedOutput, "sample.jsonl"),
      sampleText,
      "utf8"
    ),
    writeFile(
      join(resolvedOutput, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8"
    ),
    writeFile(
      join(resolvedOutput, "evidence.json"),
      JSON.stringify({
        schemaVersion:
          "author-authority-human-audit-evidence-v1",
        sampleSha256,
        cases: evidence
      }, null, 2) + "\n",
      "utf8"
    ),
    writeFile(
      join(resolvedOutput, "judgments.template.jsonl"),
      judgmentsTemplate
        .map(row => JSON.stringify(row))
        .join("\n") + "\n",
      "utf8"
    )
  ]);

  return {
    outputRoot: resolvedOutput,
    manifest,
    sample: selection.sample,
    evidence
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const result = await buildHumanAuthorityAuditPacket({
    inputRoot: args.input,
    outputRoot:
      args.output ||
      "artifacts/author-authority-human-audit-v1",
    auditConfigPath:
      args.config ||
      "benchmark/author-authority/human-audit-v1/config.json"
  });

  console.log(JSON.stringify({
    outputRoot: result.outputRoot,
    sampleSize: result.manifest.sampleSize,
    uniqueProfiles: result.manifest.uniqueProfiles,
    sampleSha256: result.manifest.sampleSha256,
    strata: result.manifest.selection.counts,
    evidenceCases: result.evidence.length
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

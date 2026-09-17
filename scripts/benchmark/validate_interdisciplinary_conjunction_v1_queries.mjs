import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { parseQuery, normalizeText } from "../../src/core/parser.js";

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, "benchmark/validation-interdisciplinary-conjunction-v1.queries.json");
const MAP = path.join(ROOT, "src/data/philosophy-map.json");

function fail(message) {
  throw new Error(message);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function trackedFilesAt(ref) {
  return git([
    "ls-tree", "-r", "--name-only", ref, "--",
    "tests", "benchmark", "scripts/benchmark"
  ])
    .split(/\r?\n/)
    .filter(Boolean);
}

function contentAt(ref, file) {
  try {
    return git(["show", `${ref}:${file}`]);
  } catch {
    return "";
  }
}

function exposureCandidateFile(file) {
  if (file.startsWith("tests/")) return true;
  if (file.startsWith("scripts/benchmark/")) return true;
  if (!file.startsWith("benchmark/")) return false;
  return /quer|benchmark|config|development|changes/i.test(path.basename(file));
}

function normalizedLineHasPair(line, family) {
  const n = normalizeText(line);
  const hasArea = (family.areaTerms || []).some(term => n.includes(normalizeText(term)));
  const hasDomain = (family.domainTerms || []).some(term => n.includes(normalizeText(term)));
  return hasArea && hasDomain;
}

if (!fs.existsSync(CONFIG)) fail(`Missing ${path.relative(ROOT, CONFIG)}`);
if (!fs.existsSync(MAP)) fail(`Missing ${path.relative(ROOT, MAP)}`);

const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
const philosophyMap = JSON.parse(fs.readFileSync(MAP, "utf8"));
const languages = config.evaluation?.languages || [];
const families = config.families || [];
const queries = config.queries || [];
const baseCommit = config.baseCommit;

if (!baseCommit) fail("baseCommit is required");
if (queries.length !== 20) fail(`Expected 20 queries, found ${queries.length}`);
if (families.length !== 4) fail(`Expected 4 families, found ${families.length}`);
if (new Set(queries.map(q => q.id)).size !== queries.length) fail("Duplicate query ids");
if (new Set(queries.map(q => q.query)).size !== queries.length) fail("Duplicate query strings");

const familyMap = new Map(families.map(f => [f.id, f]));
for (const family of families) {
  const subset = queries.filter(q => q.family === family.id);
  if (subset.length !== languages.length) {
    fail(`${family.id}: expected ${languages.length} language variants, found ${subset.length}`);
  }
  const gotLangs = [...new Set(subset.map(q => q.language))].sort();
  const expectedLangs = [...languages].sort();
  if (JSON.stringify(gotLangs) !== JSON.stringify(expectedLangs)) {
    fail(`${family.id}: language set mismatch: ${gotLangs.join(",")}`);
  }
}

const parserRows = [];
for (const query of queries) {
  const family = familyMap.get(query.family);
  if (!family) fail(`${query.id}: unknown family ${query.family}`);

  const parsed = parseQuery(query.query, philosophyMap);
  const explicitAreaIds = (parsed.explicitAreas || []).map(x => x.id);
  const domainIds = (parsed.domains || []).map(x => x.id);

  if (!explicitAreaIds.includes(family.areaId)) {
    fail(`${query.id}: parser did not recognize area ${family.areaId}: ${query.query}`);
  }
  if (!domainIds.includes(family.domainId)) {
    fail(`${query.id}: parser did not recognize domain ${family.domainId}: ${query.query}`);
  }
  if (parsed.language !== query.language) {
    fail(`${query.id}: expected language=${query.language}, parser=${parsed.language}: ${query.query}`);
  }

  parserRows.push({
    id: query.id,
    language: query.language,
    family: query.family,
    area: family.areaId,
    domain: family.domainId,
    parserLanguage: parsed.language
  });
}

/*
 * Exposure audit is always run against the frozen implementation commit,
 * before this preregistration existed. Exact-query matches are checked in
 * all tracked benchmark/test harness files. Family-pair co-occurrence is
 * checked only in tests, benchmark scripts and query/config-like benchmark
 * files, so retrieved article abstracts do not create false leakage alarms.
 */
const files = trackedFilesAt(baseCommit);
const exactHits = [];
const familyHits = [];

for (const file of files) {
  const content = contentAt(baseCommit, file);
  const normalizedContent = normalizeText(content);

  for (const query of queries) {
    if (normalizedContent.includes(normalizeText(query.query))) {
      exactHits.push({ query_id: query.id, file });
    }
  }

  if (!exposureCandidateFile(file)) continue;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const family of families) {
      if (normalizedLineHasPair(lines[i], family)) {
        familyHits.push({
          family: family.id,
          file,
          line: i + 1,
          text: lines[i].trim().slice(0, 220)
        });
      }
    }
  }
}

const exactUnique = [...new Map(exactHits.map(x => [`${x.query_id}\0${x.file}`, x])).values()];
const familyUnique = [...new Map(familyHits.map(x => [`${x.family}\0${x.file}\0${x.line}`, x])).values()];

console.log("INTERDISCIPLINARY CONJUNCTION V1 PREREGISTRATION CHECK");
console.log(`base_commit=${baseCommit}`);
console.log(`queries=${queries.length}`);
console.log(`families=${families.length}`);
console.log(`parser_checks=${parserRows.length}`);
console.log(`exact_query_exposure_hits=${exactUnique.length}`);
console.log(`family_pair_line_hits=${familyUnique.length}`);

if (exactUnique.length) {
  console.log("\nEXACT QUERY EXPOSURE HITS");
  for (const hit of exactUnique) console.log(`- ${hit.query_id} · ${hit.file}`);
}

if (familyUnique.length) {
  console.log("\nFAMILY-PAIR LINE HITS");
  for (const hit of familyUnique) {
    console.log(`- ${hit.family} · ${hit.file}:${hit.line} · ${hit.text}`);
  }
}

if (exactUnique.length || familyUnique.length) {
  process.exitCode = 2;
  console.log("\nPREREGISTRATION CHECK: REVIEW REQUIRED");
} else {
  console.log("\nPREREGISTRATION CHECK: PASS");
  console.log("No exact query exposure and no same-line family-pair exposure were found in the frozen pre-validation repository scope.");
}

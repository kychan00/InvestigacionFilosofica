import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const QUERIES_PATH = path.join(ROOT, "benchmark/validation-multilingual-ab-v1.queries.json");
const RUN_DIR = path.join(ROOT, "benchmark/runs");
const SAMPLE_PATH = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.sample.jsonl");
const MANIFEST_PATH = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.manifest.json");
const FINAL_PATH = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.judgments.jsonl");
const SEED = 20260917;

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`${filePath}:${index + 1}: ${error.message}`); }
    });
}

function findRun() {
  if (process.env.MULTILINGUAL_AB_RUN) return path.resolve(ROOT, process.env.MULTILINGUAL_AB_RUN);
  const candidates = fs.readdirSync(RUN_DIR)
    .filter(name => /^heldout-multilingual-ab-v1-[^.]+\.jsonl$/.test(name))
    .map(name => path.join(RUN_DIR, name));
  if (candidates.length !== 1) throw new Error(`Expected exactly one held-out A/B run, found ${candidates.length}`);
  return candidates[0];
}

function rowsFor(run, queryId, condition) {
  return run
    .filter(row => row.query_id === queryId && row.condition === condition && Number(row.rank) <= 10)
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, seed) {
  const out = [...items];
  const random = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function translationMode(row) {
  const matches = row.matchedQueries || [];
  const original = matches.some(item => item.type === "original");
  const translation = matches.some(item => item.type === "translation");
  if (original && translation) return "original+translation";
  if (translation) return "translation-only";
  if (original) return "original-only";
  return "other";
}

if (fs.existsSync(FINAL_PATH)) {
  throw new Error(`Final judgments already exist: ${path.relative(ROOT, FINAL_PATH)}. Refusing to rebuild the sample.`);
}

const validation = JSON.parse(fs.readFileSync(QUERIES_PATH, "utf8"));
const runPath = findRun();
if (!fs.existsSync(runPath)) throw new Error(`Run not found: ${runPath}`);
const run = readJsonl(runPath);
const changed = [];

for (const query of validation.queries) {
  const a10 = rowsFor(run, query.id, "A");
  const b10 = rowsFor(run, query.id, "B");
  if (a10.length !== 10 || b10.length !== 10) throw new Error(`${query.id}: incomplete Top 10`);
  const aMap = new Map(a10.map(row => [row.record_id, row]));
  const bMap = new Map(b10.map(row => [row.record_id, row]));
  const aOnly = a10.filter(row => !bMap.has(row.record_id));
  const bOnly = b10.filter(row => !aMap.has(row.record_id));
  if (aOnly.length !== bOnly.length) throw new Error(`${query.id}: asymmetric delta`);

  for (const row of aOnly) changed.push({ query, side: "A-only", row });
  for (const row of bOnly) changed.push({ query, side: "B-only", row });
}

const randomized = shuffle(changed, SEED);
const sample = randomized.map((item, index) => ({
  audit_id: `HAB${String(index + 1).padStart(3, "0")}`,
  query_id: item.query.id,
  query: item.query.query,
  record_id: item.row.record_id,
  title: item.row.title || "",
  authors: item.row.authors || [],
  year: item.row.year ?? null,
  type: item.row.type || null,
  document_language: item.row.language || null,
  journal: item.row.journal || null,
  publisher: item.row.publisher || null,
  abstract: item.row.abstract || null,
}));

const sampleByKey = new Map(sample.map(row => [`${row.query_id}\u0000${row.record_id}`, row]));
const manifestItems = changed.map(item => {
  const publicRow = sampleByKey.get(`${item.query.id}\u0000${item.row.record_id}`);
  return {
    audit_id: publicRow.audit_id,
    query_id: item.query.id,
    language: item.query.language,
    family: item.query.family,
    record_id: item.row.record_id,
    selection_side: item.side,
    a_rank: item.side === "A-only" ? Number(item.row.rank) : null,
    b_rank: item.side === "B-only" ? Number(item.row.rank) : null,
    b_translation_mode: item.side === "B-only" ? translationMode(item.row) : null,
    b_matchedQueries: item.side === "B-only" ? (item.row.matchedQueries || []) : [],
  };
});

const manifest = {
  schemaVersion: 1,
  name: "Held-out multilingual A/B blind delta audit v1",
  seed: SEED,
  run: path.relative(ROOT, runPath),
  queries: path.relative(ROOT, QUERIES_PATH),
  auditRows: sample.length,
  methodology: "Blind human relevance audit of every query-document pair in the symmetric difference between A and B Top 10. Public sample hides condition, rank, providers, scores, and translation provenance.",
  items: manifestItems,
};

fs.writeFileSync(SAMPLE_PATH, sample.map(row => JSON.stringify(row)).join("\n") + "\n", "utf8");
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");

const byLanguage = {};
for (const item of manifestItems) byLanguage[item.language] = (byLanguage[item.language] || 0) + 1;

console.log("HELD-OUT MULTILINGUAL A/B DELTA AUDIT SAMPLE: PASS");
console.log(`changed_top10_pairs=${sample.length}`);
console.log(`audit_rows=${sample.length}`);
for (const language of ["es", "en", "de", "fr", "pt"]) console.log(`${language}=${byLanguage[language] || 0}`);
console.log(`sample=${path.relative(ROOT, SAMPLE_PATH)}`);
console.log(`manifest=${path.relative(ROOT, MANIFEST_PATH)}`);

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const QUERIES_PATH = path.join(ROOT, "benchmark/validation-interdisciplinary-conjunction-v1.queries.json");
const RUN_PATH = path.join(ROOT, "benchmark/runs/interdisciplinary-conjunction-v1-holdout-105f196.jsonl");
const STRUCTURAL_PATH = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-structural.json");
const SAMPLE_PATH = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-audit.sample.jsonl");
const MANIFEST_PATH = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-audit.manifest.json");
const MANUAL_PATH = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-audit.manual.txt");
const FINAL_PATH = path.join(ROOT, "benchmark/interdisciplinary-conjunction-v1-holdout-audit.judgments.jsonl");
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

function value(value, fallback = "No disponible.") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function authorsText(authors) {
  if (!Array.isArray(authors) || !authors.length) return "No disponibles.";
  return authors.join(", ");
}

for (const filePath of [QUERIES_PATH, RUN_PATH, STRUCTURAL_PATH]) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${path.relative(ROOT, filePath)}`);
}

if (fs.existsSync(FINAL_PATH)) {
  throw new Error(`Final judgments already exist: ${path.relative(ROOT, FINAL_PATH)}. Refusing to rebuild blind sample.`);
}

const validation = JSON.parse(fs.readFileSync(QUERIES_PATH, "utf8"));
const structural = JSON.parse(fs.readFileSync(STRUCTURAL_PATH, "utf8"));
const run = readJsonl(RUN_PATH);
const changed = [];

for (const query of validation.queries) {
  const a10 = rowsFor(run, query.id, "A");
  const b10 = rowsFor(run, query.id, "B");
  if (a10.length !== 10 || b10.length !== 10) throw new Error(`${query.id}: incomplete Top 10`);

  const aMap = new Map(a10.map(row => [row.record_id, row]));
  const bMap = new Map(b10.map(row => [row.record_id, row]));
  const aOnly = a10.filter(row => !bMap.has(row.record_id));
  const bOnly = b10.filter(row => !aMap.has(row.record_id));

  if (aOnly.length !== bOnly.length) throw new Error(`${query.id}: asymmetric Top-10 delta`);

  for (const row of aOnly) changed.push({ query, side: "A-only", row });
  for (const row of bOnly) changed.push({ query, side: "B-only", row });
}

const expectedChanged = Number(structural.changedTop10Pairs ?? structural.summary?.changedTop10Pairs ?? 56);
if (changed.length !== expectedChanged) {
  throw new Error(`Changed-pair mismatch: run=${changed.length}, structural=${expectedChanged}`);
}

const aOnlyCount = changed.filter(item => item.side === "A-only").length;
const bOnlyCount = changed.filter(item => item.side === "B-only").length;
if (aOnlyCount !== bOnlyCount || aOnlyCount * 2 !== changed.length) {
  throw new Error(`Expected symmetric delta, got A-only=${aOnlyCount}, B-only=${bOnlyCount}`);
}

const randomized = shuffle(changed, SEED);
const sample = randomized.map((item, index) => ({
  audit_id: `HCV${String(index + 1).padStart(3, "0")}`,
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
  const audit = sampleByKey.get(`${item.query.id}\u0000${item.row.record_id}`);
  if (!audit) throw new Error(`Missing public audit row for ${item.query.id}/${item.row.record_id}`);
  return {
    audit_id: audit.audit_id,
    query_id: item.query.id,
    language: item.query.language,
    family: item.query.family,
    record_id: item.row.record_id,
    selection_side: item.side,
    a_rank: item.side === "A-only" ? Number(item.row.rank) : null,
    b_rank: item.side === "B-only" ? Number(item.row.rank) : null,
    conjunction_bucket: item.row.ranking?.conjunctionBucket ?? null,
    conjunction_adjustment: item.row.ranking?.conjunctionAdjustment ?? null,
  };
});

const manifest = {
  schemaVersion: 1,
  name: "Interdisciplinary conjunction v1 fresh holdout blind human audit",
  seed: SEED,
  run: path.relative(ROOT, RUN_PATH),
  structuralReport: path.relative(ROOT, STRUCTURAL_PATH),
  queries: path.relative(ROOT, QUERIES_PATH),
  auditRows: sample.length,
  aOnly: aOnlyCount,
  bOnly: bOnlyCount,
  methodology: "Blind human relevance audit of every query-document pair in the symmetric difference between the preregistered holdout Top 10 under A (pre-conjunction ranking) and B (conjunction-v1). The public sample hides condition, rank, score, conjunction bucket, conjunction adjustment, providers, and matched-query provenance.",
  limitations: "Internal holdout with one human adjudicator. Query families were preregistered after tuning and checked for detected exact-query and same-line family-pair exposure in the frozen pre-validation repository scope; this is not independent external validation.",
  items: manifestItems,
};

fs.writeFileSync(SAMPLE_PATH, sample.map(row => JSON.stringify(row)).join("\n") + "\n", "utf8");
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");

const blocks = sample.map(row => `============================================================\n${row.audit_id}\n============================================================\n\nConsulta:\n${value(row.query)}\n\nTítulo:\n${value(row.title)}\n\nAutores:\n${authorsText(row.authors)}\n\nAño:\n${value(row.year)}\n\nTipo:\n${value(row.type)}\n\nIdioma del documento:\n${value(row.document_language)}\n\nRevista:\n${value(row.journal)}\n\nEditorial:\n${value(row.publisher)}\n\nResumen / abstract:\n${row.abstract ? String(row.abstract).trim() : "Abstract no disponible."}\n\n\n## ¿Qué tan relevante es este documento para la consulta?\n\n0 · No relevante\nNo aborda sustantivamente la consulta; es ruido o falso positivo.\n\n1 · Relacionado / tangencial\nEl tema está relacionado, pero el filósofo, obra, concepto o problema consultado es periférico.\n\n2 · Relevante\nAborda sustantivamente el objeto consultado como una parte importante del documento.\n\n3 · Central\nEstá específicamente centrado y directamente dedicado al objeto de la consulta.\n\nRespuesta:\n[0 / 1 / 2 / 3]\n\nNota opcional — úsela para justificar casos dudosos:\n[Escriba aquí o déjelo vacío]\n`).join("\n");

const header = `AUDITORÍA HUMANA CIEGA · CONJUNCIÓN INTERDISCIPLINARIA V1 · HOLDOUT NUEVO\n\nCasos a juzgar: ${sample.length}\nDiseño: todos los pares query-documento que cambian membresía Top-10 entre A y B.\n\nIMPORTANTE:\nEste archivo oculta condición (A/B), rango, score, bucket de conjunción, ajuste, proveedores y procedencia de la expansión. No consulte el manifest mientras adjudica.\n\nUse exclusivamente la relevancia del documento para la consulta mostrada.\n\n`;
fs.writeFileSync(MANUAL_PATH, header + blocks + "\n", "utf8");

const byLanguage = {};
const byFamily = {};
for (const item of manifestItems) {
  byLanguage[item.language] = (byLanguage[item.language] || 0) + 1;
  byFamily[item.family] = (byFamily[item.family] || 0) + 1;
}

console.log("INTERDISCIPLINARY CONJUNCTION V1 HOLDOUT BLIND AUDIT BUILD: PASS");
console.log(`changed_top10_pairs=${sample.length}`);
console.log(`A_only=${aOnlyCount}`);
console.log(`B_only=${bOnlyCount}`);
for (const language of ["es", "en", "de", "fr", "pt"]) console.log(`${language}=${byLanguage[language] || 0}`);
for (const family of validation.families.map(item => item.id)) console.log(`${family}=${byFamily[family] || 0}`);
console.log(`sample=${path.relative(ROOT, SAMPLE_PATH)}`);
console.log(`manifest=${path.relative(ROOT, MANIFEST_PATH)}`);
console.log(`manual=${path.relative(ROOT, MANUAL_PATH)}`);

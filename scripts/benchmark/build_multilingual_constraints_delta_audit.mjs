import fs from "node:fs";

const OLD_RUN = "benchmark/runs/human-v1.0-interdisciplinary-expansionfix-cfb853a.jsonl";
const NEW_RUN = "benchmark/runs/human-v1.0-interdisciplinary-multilingual-f02f02f.jsonl";
const QUERIES = "benchmark/queries.json";
const PRIOR_HUMAN = [
  "benchmark/human-audit-v1.judgments.jsonl",
  "benchmark/interdisciplinary-delta-audit-v1.judgments.jsonl"
];
const OUT_SAMPLE = "benchmark/multilingual-constraints-delta-audit-v1.sample.jsonl";
const OUT_MANIFEST = "benchmark/multilingual-constraints-delta-audit-v1.manifest.json";
const FINAL_JUDGMENTS = "benchmark/multilingual-constraints-delta-audit-v1.judgments.jsonl";
const SEED = 2026091601;

function readJsonl(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
  return fs.readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1}: ${error.message}`);
      }
    });
}

function key(queryId, recordId) {
  return `${queryId}\u0000${recordId}`;
}

function rowsFor(run, queryId) {
  return run
    .filter(row => row.query_id === queryId && Number(row.rank) <= 10)
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

function buildPriorHuman(paths) {
  const map = new Map();
  for (const path of paths) {
    for (const row of readJsonl(path)) {
      const k = key(row.query_id, row.record_id);
      const relevance = Number(row.human_relevance);
      if (map.has(k) && map.get(k).human_relevance !== relevance) {
        throw new Error(`Conflicting prior human labels for ${row.query_id} / ${row.record_id}`);
      }
      if (!map.has(k)) {
        map.set(k, {
          human_relevance: relevance,
          human_note: String(row.human_note || ""),
          sources: [path],
        });
      } else {
        const current = map.get(k);
        current.sources.push(path);
        if (!current.human_note && row.human_note) current.human_note = String(row.human_note);
      }
    }
  }
  return map;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, seed) {
  const out = [...items];
  const random = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function publicRow(auditId, query, row) {
  return {
    audit_id: auditId,
    query_id: query.id,
    query: query.query,
    record_id: row.record_id,
    title: row.title || "",
    authors: row.authors || [],
    year: row.year ?? null,
    type: row.type || null,
    document_language: row.language || null,
    journal: row.journal || null,
    publisher: row.publisher || null,
    abstract: row.abstract || null,
  };
}

function translationMode(row) {
  const matches = row?.matchedQueries || [];
  const hasOriginal = matches.some(item => item.type === "original");
  const hasTranslation = matches.some(item => item.type === "translation");
  if (hasOriginal && hasTranslation) return "original+translation";
  if (hasTranslation) return "translation-only";
  if (hasOriginal) return "original-only";
  return "other";
}

if (fs.existsSync(FINAL_JUDGMENTS)) {
  console.error(`Refusing to rebuild after final judgments exist: ${FINAL_JUDGMENTS}`);
  process.exit(1);
}

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const oldRun = readJsonl(OLD_RUN);
const newRun = readJsonl(NEW_RUN);
const priorHuman = buildPriorHuman(PRIOR_HUMAN);
const queryMeta = new Map(benchmark.queries.map(query => [query.id, query]));
const queryIds = benchmark.queries
  .filter(query => query.intent === "interdisciplinary-challenge")
  .map(query => query.id);

const unresolved = [];
const alreadyHuman = [];

for (const queryId of queryIds) {
  const query = queryMeta.get(queryId);
  const old10 = rowsFor(oldRun, queryId);
  const new10 = rowsFor(newRun, queryId);
  const oldMap = new Map(old10.map(row => [row.record_id, row]));
  const newMap = new Map(new10.map(row => [row.record_id, row]));
  const unionIds = new Set([...oldMap.keys(), ...newMap.keys()]);

  for (const recordId of unionIds) {
    const oldRow = oldMap.get(recordId) || null;
    const newRow = newMap.get(recordId) || null;
    if (oldRow && newRow) continue;

    const row = newRow || oldRow;
    const side = newRow ? "new-only" : "old-only";
    const prior = priorHuman.get(key(queryId, recordId));
    const hidden = {
      query_id: queryId,
      record_id: recordId,
      selection_side: side,
      old_rank: oldRow?.rank ?? null,
      new_rank: newRow?.rank ?? null,
      new_translation_mode: newRow ? translationMode(newRow) : null,
    };

    if (prior) {
      alreadyHuman.push({
        ...hidden,
        human_relevance: prior.human_relevance,
        human_note: prior.human_note,
        human_sources: prior.sources,
      });
    } else {
      unresolved.push({ query, row, hidden });
    }
  }
}

const shuffled = shuffle(unresolved, SEED);
const sample = shuffled.map((item, index) =>
  publicRow(`M${String(index + 1).padStart(3, "0")}`, item.query, item.row)
);
const sampleLookup = new Map(sample.map(row => [key(row.query_id, row.record_id), row.audit_id]));
const manifestItems = unresolved.map(item => ({
  audit_id: sampleLookup.get(key(item.query.id, item.row.record_id)),
  ...item.hidden,
}));

const manifest = {
  schemaVersion: 1,
  name: "Multilingual constraints paired delta audit v1",
  generatedAt: new Date().toISOString(),
  seed: SEED,
  methodology: "Blind unresolved symmetric difference of expansion-fix vs multilingual-constraints Top-10 sets. Old/new side, ranks, provider provenance, and translation provenance are hidden from the judge.",
  interpretationBoundary: "This is a development comparison. Provider drift is observable even in English control queries, so the final old-vs-new delta is an observed run delta rather than a pure causal estimate of translation expansion.",
  sources: {
    oldRun: OLD_RUN,
    newRun: NEW_RUN,
    priorHuman: PRIOR_HUMAN,
  },
  queryCount: queryIds.length,
  changedTop10Pairs: unresolved.length + alreadyHuman.length,
  changedPairsAlreadyHuman: alreadyHuman.length,
  auditRows: sample.length,
  alreadyHuman,
  items: manifestItems,
};

fs.writeFileSync(
  OUT_SAMPLE,
  sample.map(row => JSON.stringify(row)).join("\n") + (sample.length ? "\n" : ""),
  "utf8"
);
fs.writeFileSync(OUT_MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");

const byQuery = new Map();
for (const item of unresolved) {
  const id = item.query.id;
  if (!byQuery.has(id)) byQuery.set(id, { oldOnly: 0, newOnly: 0 });
  if (item.hidden.selection_side === "old-only") byQuery.get(id).oldOnly++;
  else byQuery.get(id).newOnly++;
}

console.log("MULTILINGUAL CONSTRAINTS DELTA AUDIT SAMPLE: PASS");
console.log(`changed_top10_pairs=${manifest.changedTop10Pairs}`);
console.log(`already_human_changed=${manifest.changedPairsAlreadyHuman}`);
console.log(`audit_rows=${manifest.auditRows}`);
for (const queryId of queryIds) {
  const counts = byQuery.get(queryId) || { oldOnly: 0, newOnly: 0 };
  console.log(`${queryId}: unresolved_old_only=${counts.oldOnly} unresolved_new_only=${counts.newOnly}`);
}
console.log(`sample=${OUT_SAMPLE}`);
console.log(`manifest=${OUT_MANIFEST}`);

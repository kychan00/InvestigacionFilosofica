import fs from "node:fs";

const RUN = "benchmark/runs/human-v1.0-1064fdb.jsonl";
const JUDGMENTS = "benchmark/ai-silver-v1.jsonl";
const QUERIES = "benchmark/queries.json";
const REPORT = "benchmark/ai-silver-v1.report.json";
const OUT_JSON = "benchmark/error-analysis-v1.json";
const OUT_MD = "benchmark/error-analysis-v1.md";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function readJsonl(path) {
  return fs
    .readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function normalize(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const STOP = new Set([
  "a","al","and","bei","chez","da","das","de","del","der","des","do","e","el","em","en","et","in","la","na","of","the","und","y"
]);

function tokens(text) {
  return normalize(text)
    .split(/\s+/)
    .filter(token => token.length >= 3 && !STOP.has(token));
}

function titleCoverage(query, title) {
  const q = [...new Set(tokens(query))];
  if (!q.length) return 0;
  const t = new Set(tokens(title));
  return q.filter(token => t.has(token)).length / q.length;
}

function providerKey(row) {
  return (row.providers || []).slice().sort().join(" + ") || "Unknown";
}

const benchmark = readJson(QUERIES);
const evalReport = readJson(REPORT);
const run = readJsonl(RUN);
const judgments = readJsonl(JUDGMENTS);
const relevantThreshold = benchmark.evaluation?.relevantThreshold ?? 2;

const queryMap = new Map(benchmark.queries.map(q => [q.id, q]));
const judgmentMap = new Map(
  judgments.map(j => [`${j.query_id}\u0000${j.record_id}`, j])
);

const enriched = run.map(row => {
  const judgment = judgmentMap.get(`${row.query_id}\u0000${row.record_id}`);
  if (!judgment) throw new Error(`Missing judgment for ${row.query_id} ${row.record_id}`);
  const query = queryMap.get(row.query_id);
  return {
    ...row,
    silverRelevance: judgment.relevance,
    silverDiscipline: judgment.discipline,
    relevant: judgment.relevance >= relevantThreshold,
    titleCoverage: round(titleCoverage(row.query, row.title), 3),
    hasAbstract: Boolean((row.abstract || "").trim() && row.abstract !== "-"),
    sameLanguage: Boolean(row.language && row.query_language && row.language === row.query_language),
    providerKey: providerKey(row),
    queryMeta: query
  };
});

const byQuery = new Map();
for (const row of enriched) {
  if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, []);
  byQuery.get(row.query_id).push(row);
}
for (const rows of byQuery.values()) rows.sort((a, b) => a.rank - b.rank);

const perQueryMetric = new Map(evalReport.perQuery.map(row => [row.id, row]));

const queryErrors = [];
for (const query of benchmark.queries) {
  const rows = byQuery.get(query.id) || [];
  const top10 = rows.filter(row => row.rank <= 10);
  const lower = rows.filter(row => row.rank > 10 && row.rank <= 20);
  const falsePositives = top10
    .filter(row => !row.relevant)
    .sort((a, b) => a.silverRelevance - b.silverRelevance || a.rank - b.rank);
  const trappedRelevant = lower
    .filter(row => row.relevant)
    .sort((a, b) => b.silverRelevance - a.silverRelevance || a.rank - b.rank);
  const possibleSwaps = Math.min(falsePositives.length, trappedRelevant.length);
  const metric = perQueryMetric.get(query.id);

  queryErrors.push({
    id: query.id,
    query: query.query,
    language: query.language,
    family: query.family,
    intent: query.intent,
    precision5: metric?.precision5 ?? null,
    precision10: metric?.precision10 ?? null,
    recall10: metric?.recall10 ?? null,
    ndcg10: metric?.ndcg10 ?? null,
    mrr10: metric?.mrr10 ?? null,
    top10Relevant: top10.filter(row => row.relevant).length,
    top10FalsePositives: falsePositives.length,
    trappedRelevant: trappedRelevant.length,
    possibleRelevantSwaps: possibleSwaps,
    oraclePrecision10: round((top10.filter(row => row.relevant).length + possibleSwaps) / Math.max(1, top10.length)),
    falsePositives: falsePositives.slice(0, 5).map(row => ({
      rank: row.rank,
      relevance: row.silverRelevance,
      score: row.score,
      provider: row.providerKey,
      titleCoverage: row.titleCoverage,
      language: row.language,
      title: row.title
    })),
    trappedRelevantItems: trappedRelevant.slice(0, 5).map(row => ({
      rank: row.rank,
      relevance: row.silverRelevance,
      score: row.score,
      provider: row.providerKey,
      titleCoverage: row.titleCoverage,
      language: row.language,
      title: row.title
    }))
  });
}

const worstQueries = [...queryErrors]
  .sort((a, b) =>
    (a.precision10 ?? 1) - (b.precision10 ?? 1) ||
    (a.ndcg10 ?? 1) - (b.ndcg10 ?? 1) ||
    b.possibleRelevantSwaps - a.possibleRelevantSwaps
  )
  .slice(0, 15);

function aggregateProvider(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.providerKey;
    if (!map.has(key)) {
      map.set(key, {
        provider: key,
        top10Rows: 0,
        top10Relevant: 0,
        top10FalsePositives: 0,
        lowerPoolRows: 0,
        lowerRelevant: 0
      });
    }
    const item = map.get(key);
    if (row.rank <= 10) {
      item.top10Rows++;
      if (row.relevant) item.top10Relevant++;
      else item.top10FalsePositives++;
    } else if (row.rank <= 20) {
      item.lowerPoolRows++;
      if (row.relevant) item.lowerRelevant++;
    }
  }
  return [...map.values()]
    .map(item => ({
      ...item,
      top10Precision: item.top10Rows ? round(item.top10Relevant / item.top10Rows) : null,
      lowerRelevantRate: item.lowerPoolRows ? round(item.lowerRelevant / item.lowerPoolRows) : null
    }))
    .sort((a, b) => b.top10FalsePositives - a.top10FalsePositives || a.top10Precision - b.top10Precision);
}

function featureSlice(name, predicate) {
  const top10 = enriched.filter(row => row.rank <= 10 && predicate(row));
  const relevant = top10.filter(row => row.relevant).length;
  return {
    name,
    rows: top10.length,
    relevant,
    precision: top10.length ? round(relevant / top10.length) : null
  };
}

function aggregateGroup(field) {
  const values = new Map();
  for (const row of queryErrors) {
    const key = row[field];
    if (!values.has(key)) values.set(key, []);
    values.get(key).push(row);
  }
  return Object.fromEntries(
    [...values.entries()].map(([key, rows]) => [
      key,
      {
        queries: rows.length,
        precision10: round(rows.reduce((s, r) => s + (r.precision10 ?? 0), 0) / rows.length),
        ndcg10: round(rows.reduce((s, r) => s + (r.ndcg10 ?? 0), 0) / rows.length),
        falsePositives: rows.reduce((s, r) => s + r.top10FalsePositives, 0),
        trappedRelevant: rows.reduce((s, r) => s + r.trappedRelevant, 0),
        possibleRelevantSwaps: rows.reduce((s, r) => s + r.possibleRelevantSwaps, 0)
      }
    ])
  );
}

const top10 = enriched.filter(row => row.rank <= 10);
const falsePositiveRows = top10.filter(row => !row.relevant);
const trappedRows = enriched.filter(row => row.rank > 10 && row.rank <= 20 && row.relevant);
const totalPossibleSwaps = queryErrors.reduce((sum, row) => sum + row.possibleRelevantSwaps, 0);

const analysis = {
  schemaVersion: 1,
  baseline: evalReport.overall,
  counts: {
    queries: benchmark.queries.length,
    rows: enriched.length,
    top10Rows: top10.length,
    top10FalsePositives: falsePositiveRows.length,
    lowerPoolRelevant: trappedRows.length,
    possibleRelevantSwaps: totalPossibleSwaps,
    oraclePrecision10UpperBound: round((top10.filter(row => row.relevant).length + totalPossibleSwaps) / top10.length)
  },
  byLanguage: aggregateGroup("language"),
  byIntent: aggregateGroup("intent"),
  byFamily: aggregateGroup("family"),
  providers: aggregateProvider(enriched),
  featureDiagnostics: [
    featureSlice("title coverage >= 0.75", row => row.titleCoverage >= 0.75),
    featureSlice("title coverage 0.50-0.74", row => row.titleCoverage >= 0.5 && row.titleCoverage < 0.75),
    featureSlice("title coverage < 0.50", row => row.titleCoverage < 0.5),
    featureSlice("abstract present", row => row.hasAbstract),
    featureSlice("abstract missing", row => !row.hasAbstract),
    featureSlice("same language", row => row.sameLanguage),
    featureSlice("different/unknown language", row => !row.sameLanguage)
  ],
  worstQueries,
  allQueries: queryErrors
};

fs.writeFileSync(OUT_JSON, JSON.stringify(analysis, null, 2) + "\n");

const md = [];
md.push("# Error analysis v1 — ranking baseline");
md.push("");
md.push("This report is diagnostic. It uses the frozen silver benchmark and must not be presented as an independent test set.");
md.push("");
md.push("## Baseline");
md.push("");
md.push(`- P@5: ${analysis.baseline.precision5}`);
md.push(`- P@10: ${analysis.baseline.precision10}`);
md.push(`- Recall@10: ${analysis.baseline.recall10}`);
md.push(`- nDCG@10: ${analysis.baseline.ndcg10}`);
md.push(`- MRR@10: ${analysis.baseline.mrr10}`);
md.push("");
md.push("## Error budget");
md.push("");
md.push(`- Top-10 false positives: ${analysis.counts.top10FalsePositives}/${analysis.counts.top10Rows}`);
md.push(`- Relevant documents trapped at ranks 11–20: ${analysis.counts.lowerPoolRelevant}`);
md.push(`- Query-local swaps available inside the frozen pool: ${analysis.counts.possibleRelevantSwaps}`);
md.push(`- Oracle P@10 upper bound inside the frozen Top-20 pools: ${analysis.counts.oraclePrecision10UpperBound}`);
md.push("");
md.push("## Worst queries");
md.push("");
md.push("| Query | Lang | Intent | P@10 | nDCG@10 | FP Top10 | Relevant 11–20 | Swaps |");
md.push("|---|---|---|---:|---:|---:|---:|---:|");
for (const row of worstQueries) {
  md.push(`| ${row.query.replaceAll("|", "\\|")} | ${row.language} | ${row.intent} | ${row.precision10} | ${row.ndcg10} | ${row.top10FalsePositives} | ${row.trappedRelevant} | ${row.possibleRelevantSwaps} |`);
}
md.push("");
md.push("## Provider diagnostics");
md.push("");
md.push("| Provider | Top10 rows | P@10-like precision | False positives | Relevant 11–20 |");
md.push("|---|---:|---:|---:|---:|");
for (const row of analysis.providers) {
  md.push(`| ${row.provider.replaceAll("|", "\\|")} | ${row.top10Rows} | ${row.top10Precision} | ${row.top10FalsePositives} | ${row.lowerRelevant} |`);
}
md.push("");
md.push("## Feature diagnostics");
md.push("");
md.push("| Slice | Rows in Top10 | Relevant | Precision |");
md.push("|---|---:|---:|---:|");
for (const row of analysis.featureDiagnostics) {
  md.push(`| ${row.name} | ${row.rows} | ${row.relevant} | ${row.precision} |`);
}
md.push("");
md.push("## Methodological note");
md.push("");
md.push("The oracle upper bound only asks how many currently misplaced relevant documents could replace false positives within each frozen Top-20 pool. It is not a proposed production algorithm and does not use documents outside the frozen candidate pool.");

fs.writeFileSync(OUT_MD, md.join("\n") + "\n");

console.log("ERROR ANALYSIS: PASS");
console.log(`queries=${analysis.counts.queries}`);
console.log(`top10_false_positives=${analysis.counts.top10FalsePositives}`);
console.log(`relevant_11_20=${analysis.counts.lowerPoolRelevant}`);
console.log(`possible_swaps=${analysis.counts.possibleRelevantSwaps}`);
console.log(`oracle_p10=${analysis.counts.oraclePrecision10UpperBound}`);
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);

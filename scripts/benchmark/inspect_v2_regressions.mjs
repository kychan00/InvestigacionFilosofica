import fs from "node:fs";

const BASE_RUN =
  "benchmark/runs/human-v1.0-1064fdb.jsonl";
const V2_RUN =
  "benchmark/runs/human-v1.0-ranking-v2-e6ad110.jsonl";
const BASE_JUDGMENTS =
  "benchmark/ai-silver-v1.jsonl";
const V2_JUDGMENTS =
  "benchmark/ai-silver-ranking-v2.jsonl";
const QUERIES_PATH =
  "benchmark/queries.json";
const OUT_JSON =
  "benchmark/ranking-v2-regressions.json";
const OUT_MD =
  "benchmark/ranking-v2-regressions.md";

function readJsonl(path) {
  return fs.readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
}

function byQuery(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.query_id)) map.set(row.query_id, []);
    map.get(row.query_id).push(row);
  }
  for (const values of map.values()) {
    values.sort((a, b) => Number(a.rank) - Number(b.rank));
  }
  return map;
}

function judgmentMap(rows) {
  return new Map(
    rows.map(row => [
      `${row.query_id}\u0000${row.record_id}`,
      row
    ])
  );
}

function relevant(judgment) {
  return Number(judgment?.relevance) >= 2;
}

function precision10(rows, judgments, queryId) {
  const top = rows.slice(0, 10);
  if (!top.length) return null;
  const count = top.filter(row =>
    relevant(judgments.get(`${queryId}\u0000${row.record_id}`))
  ).length;
  return count / top.length;
}

function round(value) {
  return Number(value.toFixed(4));
}

function describe(row, baseJ, v2J, oldRanks, newRanks) {
  const key = `${row.query_id}\u0000${row.record_id}`;
  const oldJudgment = baseJ.get(key) || null;
  const newJudgment = v2J.get(key) || null;
  return {
    record_id: row.record_id,
    old_rank: oldRanks.get(row.record_id) ?? null,
    new_rank: newRanks.get(row.record_id) ?? null,
    baseline_relevance: oldJudgment?.relevance ?? null,
    v2_relevance: newJudgment?.relevance ?? null,
    baseline_relevant: oldJudgment ? relevant(oldJudgment) : null,
    v2_relevant: newJudgment ? relevant(newJudgment) : null,
    providers: row.providers || [],
    title: row.title || ""
  };
}

const benchmark =
  JSON.parse(fs.readFileSync(QUERIES_PATH, "utf8"));
const queryMeta =
  new Map(benchmark.queries.map(q => [q.id, q]));

const baseRun = byQuery(readJsonl(BASE_RUN));
const v2Run = byQuery(readJsonl(V2_RUN));
const baseJ = judgmentMap(readJsonl(BASE_JUDGMENTS));
const v2J = judgmentMap(readJsonl(V2_JUDGMENTS));

const regressions = [];
const sharedBinaryDisagreements = [];

for (const query of benchmark.queries) {
  const oldRows = baseRun.get(query.id) || [];
  const newRows = v2Run.get(query.id) || [];
  const oldP = precision10(oldRows, baseJ, query.id);
  const newP = precision10(newRows, v2J, query.id);

  const oldById = new Map(oldRows.map(row => [row.record_id, row]));
  const newById = new Map(newRows.map(row => [row.record_id, row]));
  const oldRanks = new Map(oldRows.map(row => [row.record_id, row.rank]));
  const newRanks = new Map(newRows.map(row => [row.record_id, row.rank]));

  for (const [recordId, oldRow] of oldById) {
    if (!newById.has(recordId)) continue;
    const key = `${query.id}\u0000${recordId}`;
    const a = baseJ.get(key);
    const b = v2J.get(key);
    if (!a || !b) continue;
    if (relevant(a) !== relevant(b)) {
      sharedBinaryDisagreements.push({
        query_id: query.id,
        record_id: recordId,
        baseline_relevance: a.relevance,
        v2_relevance: b.relevance,
        title: oldRow.title || ""
      });
    }
  }

  if (!(Number.isFinite(oldP) && Number.isFinite(newP)) || newP >= oldP) {
    continue;
  }

  const oldTop = new Set(oldRows.slice(0, 10).map(row => row.record_id));
  const newTop = new Set(newRows.slice(0, 10).map(row => row.record_id));

  const leaves = oldRows
    .slice(0, 10)
    .filter(row => !newTop.has(row.record_id))
    .map(row => describe(row, baseJ, v2J, oldRanks, newRanks));

  const enters = newRows
    .slice(0, 10)
    .filter(row => !oldTop.has(row.record_id))
    .map(row => describe(row, baseJ, v2J, oldRanks, newRanks));

  regressions.push({
    query_id: query.id,
    query: query.query,
    language: query.language,
    intent: query.intent,
    family: query.family,
    baseline_precision10: round(oldP),
    v2_precision10: round(newP),
    delta: round(newP - oldP),
    leaves,
    enters
  });
}

const report = {
  baselineRun: BASE_RUN,
  v2Run: V2_RUN,
  regressionCount: regressions.length,
  sharedBinaryLabelDisagreements: sharedBinaryDisagreements.length,
  regressions,
  sharedBinaryDisagreements
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n");

const md = [];
md.push("# Ranking v2 — regression inspection", "");
md.push("AI-silver diagnostic. It compares the actual baseline and Ranking v2 Top-20 pools.", "");
md.push(`- Regressed queries: ${regressions.length}`);
md.push(`- Shared-document binary relevance disagreements: ${sharedBinaryDisagreements.length}`, "");

for (const item of regressions) {
  md.push(`## ${item.query_id} — ${item.query}`);
  md.push("");
  md.push(`- ${item.language} · ${item.intent} · ${item.family}`);
  md.push(`- P@10: ${item.baseline_precision10} → ${item.v2_precision10} (${item.delta})`, "");
  md.push("### Leaves Top 10", "");
  for (const row of item.leaves) {
    md.push(
      `- r${row.old_rank} → ${row.new_rank ? `r${row.new_rank}` : "outside v2 pool"}` +
      ` · rel(base/v2)=${row.baseline_relevance ?? "—"}/${row.v2_relevance ?? "—"}` +
      ` · providers=${row.providers.join(", ") || "—"}` +
      ` · ${row.title}`
    );
  }
  if (!item.leaves.length) md.push("- none");
  md.push("", "### Enters Top 10", "");
  for (const row of item.enters) {
    md.push(
      `- ${row.old_rank ? `r${row.old_rank}` : "outside baseline pool"} → r${row.new_rank}` +
      ` · rel(base/v2)=${row.baseline_relevance ?? "—"}/${row.v2_relevance ?? "—"}` +
      ` · providers=${row.providers.join(", ") || "—"}` +
      ` · ${row.title}`
    );
  }
  if (!item.enters.length) md.push("- none");
  md.push("");
}

if (sharedBinaryDisagreements.length) {
  md.push("## Shared-document binary label disagreements", "");
  for (const row of sharedBinaryDisagreements) {
    md.push(
      `- ${row.query_id} · rel(base/v2)=${row.baseline_relevance}/${row.v2_relevance} · ${row.title}`
    );
  }
  md.push("");
}

fs.writeFileSync(OUT_MD, md.join("\n") + "\n");

console.log("RANKING V2 REGRESSION INSPECTION: PASS");
console.log(`regressions=${regressions.length}`);
console.log(`shared_binary_label_disagreements=${sharedBinaryDisagreements.length}`);
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);

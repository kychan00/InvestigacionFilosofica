import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "benchmark/interdisciplinary-conjunction-candidate-audit-v1.manifest.json");
const MANUAL = path.join(ROOT, "benchmark/interdisciplinary-conjunction-candidate-audit-v1.manual.jsonl");
const QUERIES = path.join(ROOT, "benchmark/validation-multilingual-ab-v1.queries.json");
const OUT_JUDGMENTS = path.join(ROOT, "benchmark/interdisciplinary-conjunction-candidate-audit-v1.judgments.jsonl");
const OUT_JSON = path.join(ROOT, "benchmark/interdisciplinary-conjunction-candidate-audit-v1.report.json");
const OUT_MD = path.join(ROOT, "benchmark/interdisciplinary-conjunction-candidate-audit-v1.report.md");

function readJsonl(file) {
  return fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, i) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`${file}:${i + 1}: ${error.message}`); }
    });
}

for (const file of [MANIFEST, MANUAL, QUERIES]) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${path.relative(ROOT, file)}`);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const manual = readJsonl(MANUAL);
const validation = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const threshold = Number(validation.evaluation?.relevantThreshold ?? 2);
const queryIds = validation.queries.map(q => q.id);
const queryMap = new Map(validation.queries.map(q => [q.id, q]));

if (manifest.candidatePairsUnion !== manifest.items.length) {
  throw new Error(`Manifest mismatch: candidatePairsUnion=${manifest.candidatePairsUnion}, items=${manifest.items.length}`);
}

const manualByAudit = new Map();
for (const row of manual) {
  const id = String(row.audit_id || "");
  if (!/^HCJ\d{3}$/.test(id)) throw new Error(`Invalid audit_id in manual judgments: ${id}`);
  if (manualByAudit.has(id)) throw new Error(`Duplicate manual audit_id: ${id}`);
  const relevance = Number(row.human_relevance);
  if (!Number.isInteger(relevance) || relevance < 0 || relevance > 3) {
    throw new Error(`Invalid human_relevance for ${id}: ${row.human_relevance}`);
  }
  manualByAudit.set(id, {
    human_relevance: relevance,
    human_note: String(row.human_note || "")
  });
}

const expectedManualIds = manifest.items
  .filter(item => !item.prior_human)
  .map(item => item.audit_id)
  .sort();
const actualManualIds = [...manualByAudit.keys()].sort();
if (JSON.stringify(expectedManualIds) !== JSON.stringify(actualManualIds)) {
  const expected = new Set(expectedManualIds);
  const actual = new Set(actualManualIds);
  const missing = expectedManualIds.filter(id => !actual.has(id));
  const extra = actualManualIds.filter(id => !expected.has(id));
  throw new Error(`Manual judgments mismatch. missing=${missing.join(",") || "none"} extra=${extra.join(",") || "none"}`);
}

const judgments = manifest.items.map(item => {
  const source = item.prior_human ? "reused-prior-human" : "manual-HCJ";
  const human = item.prior_human || manualByAudit.get(item.audit_id);
  if (!human) throw new Error(`Missing judgment for ${item.query_id} / ${item.record_id}`);
  return {
    audit_id: item.audit_id || item.prior_human?.audit_id || null,
    query_id: item.query_id,
    record_id: item.record_id,
    human_relevance: Number(human.human_relevance),
    human_note: String(human.human_note || ""),
    source
  };
});

if (judgments.length !== manifest.candidatePairsUnion) {
  throw new Error(`Expected ${manifest.candidatePairsUnion} final judgments, got ${judgments.length}`);
}

const judgmentByPair = new Map(judgments.map(j => [`${j.query_id}\u0000${j.record_id}`, j]));

function profileAnalysis(profileId) {
  let baselineOnlyRelevant = 0;
  let profileOnlyRelevant = 0;
  let baselineOnlyOrdinal = 0;
  let profileOnlyOrdinal = 0;
  const perQuery = [];

  for (const queryId of queryIds) {
    const items = manifest.items.filter(item => item.query_id === queryId && item.memberships?.[profileId]);
    let aRel = 0;
    let bRel = 0;
    let aOrdinal = 0;
    let bOrdinal = 0;

    for (const item of items) {
      const judgment = judgmentByPair.get(`${item.query_id}\u0000${item.record_id}`);
      if (!judgment) throw new Error(`No judgment for ${item.query_id} / ${item.record_id}`);
      const membership = item.memberships[profileId];
      const rel = judgment.human_relevance >= threshold ? 1 : 0;
      if (membership.side === "baseline-only") {
        aRel += rel;
        aOrdinal += judgment.human_relevance;
      } else if (membership.side === "profile-only") {
        bRel += rel;
        bOrdinal += judgment.human_relevance;
      } else {
        throw new Error(`Unexpected side for ${profileId}: ${membership.side}`);
      }
    }

    baselineOnlyRelevant += aRel;
    profileOnlyRelevant += bRel;
    baselineOnlyOrdinal += aOrdinal;
    profileOnlyOrdinal += bOrdinal;

    const net = bRel - aRel;
    perQuery.push({
      query_id: queryId,
      query: queryMap.get(queryId)?.query || queryId,
      language: queryMap.get(queryId)?.language || null,
      family: queryMap.get(queryId)?.family || null,
      changed_pairs: items.length,
      baseline_only_relevant: aRel,
      profile_only_relevant: bRel,
      net_relevant: net,
      delta_p10: Number((net / 10).toFixed(4)),
      baseline_only_ordinal: aOrdinal,
      profile_only_ordinal: bOrdinal,
      ordinal_delta: bOrdinal - aOrdinal
    });
  }

  const netRelevant = profileOnlyRelevant - baselineOnlyRelevant;
  const improved = perQuery.filter(q => q.net_relevant > 0).length;
  const worsened = perQuery.filter(q => q.net_relevant < 0).length;
  const tied = perQuery.filter(q => q.net_relevant === 0).length;

  const byFamily = {};
  for (const family of [...new Set(perQuery.map(q => q.family))]) {
    const rows = perQuery.filter(q => q.family === family);
    const net = rows.reduce((sum, q) => sum + q.net_relevant, 0);
    byFamily[family] = {
      queries: rows.length,
      net_relevant: net,
      delta_p10: Number((net / (rows.length * 10)).toFixed(4))
    };
  }

  const byLanguage = {};
  for (const language of [...new Set(perQuery.map(q => q.language))]) {
    const rows = perQuery.filter(q => q.language === language);
    const net = rows.reduce((sum, q) => sum + q.net_relevant, 0);
    byLanguage[language] = {
      queries: rows.length,
      net_relevant: net,
      delta_p10: Number((net / (rows.length * 10)).toFixed(4))
    };
  }

  return {
    profile: profileId,
    queries: queryIds.length,
    baseline_only_relevant: baselineOnlyRelevant,
    profile_only_relevant: profileOnlyRelevant,
    net_relevant: netRelevant,
    exact_paired_delta_p10: Number((netRelevant / (queryIds.length * 10)).toFixed(4)),
    baseline_only_ordinal: baselineOnlyOrdinal,
    profile_only_ordinal: profileOnlyOrdinal,
    ordinal_delta: profileOnlyOrdinal - baselineOnlyOrdinal,
    improved_queries: improved,
    worsened_queries: worsened,
    tied_queries: tied,
    byFamily,
    byLanguage,
    perQuery
  };
}

const profileIds = Object.keys(manifest.profiles || {});
const analyses = Object.fromEntries(profileIds.map(id => [id, profileAnalysis(id)]));

const report = {
  schemaVersion: 1,
  name: "Interdisciplinary conjunction candidate human audit v1",
  methodology: "Development-only human audit of every query-document pair whose Top-10 membership differs between the frozen multilingual B ranking and either tuned conjunction profile. Existing human labels are reused only for identical query-document pairs; unresolved candidates were judged blind to side, rank, score, evidence bucket, and profile membership. Shared Top-10 rows cancel, so paired ΔP@10 is exact for the frozen B pools but is tuning evidence, not independent validation.",
  warning: "This is development/tuning evidence. Do not reuse these queries or labels as independent validation of the final conjunction ranking change.",
  relevantThreshold: threshold,
  candidatePairs: manifest.candidatePairsUnion,
  priorHumanReused: manifest.priorHumanReused,
  newlyJudged: manual.length,
  judgments: judgments.length,
  comments: judgments.filter(j => j.human_note.trim()).length,
  profiles: analyses
};

fs.writeFileSync(OUT_JUDGMENTS, judgments.map(j => JSON.stringify(j)).join("\n") + "\n", "utf8");
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const lines = [];
lines.push("# Interdisciplinary conjunction candidate human audit v1", "");
lines.push(report.methodology, "", `> ${report.warning}`, "");
lines.push("## Summary", "");
lines.push(`- candidate query-document pairs: ${report.candidatePairs}`);
lines.push(`- prior human labels reused: ${report.priorHumanReused}`);
lines.push(`- newly judged blind: ${report.newlyJudged}`);
lines.push(`- final judgments: ${report.judgments}`);
lines.push(`- judgments with comments: ${report.comments}/${report.judgments}`, "");

lines.push("## Profile comparison", "");
lines.push("| profile | baseline-only rel | profile-only rel | net relevant | exact paired ΔP@10 | ordinal Δ | improved/worsened/tied |");
lines.push("|---|---:|---:|---:|---:|---:|---:|");
for (const id of profileIds) {
  const r = analyses[id];
  lines.push(`| ${id} | ${r.baseline_only_relevant} | ${r.profile_only_relevant} | ${r.net_relevant >= 0 ? "+" : ""}${r.net_relevant} | ${r.exact_paired_delta_p10 >= 0 ? "+" : ""}${r.exact_paired_delta_p10} | ${r.ordinal_delta >= 0 ? "+" : ""}${r.ordinal_delta} | ${r.improved_queries}/${r.worsened_queries}/${r.tied_queries} |`);
}

for (const id of profileIds) {
  const r = analyses[id];
  lines.push("", `## ${id}`, "");
  lines.push("### By family", "");
  lines.push("| family | queries | net relevant | ΔP@10 |");
  lines.push("|---|---:|---:|---:|");
  for (const [family, item] of Object.entries(r.byFamily)) {
    lines.push(`| ${family} | ${item.queries} | ${item.net_relevant >= 0 ? "+" : ""}${item.net_relevant} | ${item.delta_p10 >= 0 ? "+" : ""}${item.delta_p10} |`);
  }
  lines.push("", "### By language", "");
  lines.push("| language | queries | net relevant | ΔP@10 |");
  lines.push("|---|---:|---:|---:|");
  for (const [language, item] of Object.entries(r.byLanguage)) {
    lines.push(`| ${language} | ${item.queries} | ${item.net_relevant >= 0 ? "+" : ""}${item.net_relevant} | ${item.delta_p10 >= 0 ? "+" : ""}${item.delta_p10} |`);
  }
  lines.push("", "### Per query", "");
  lines.push("| query | lang | changed pairs | baseline rel | profile rel | net | ΔP@10 | ordinal Δ |");
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|");
  for (const q of r.perQuery) {
    if (!q.changed_pairs) continue;
    lines.push(`| ${q.query_id} · ${q.query} | ${q.language} | ${q.changed_pairs} | ${q.baseline_only_relevant} | ${q.profile_only_relevant} | ${q.net_relevant >= 0 ? "+" : ""}${q.net_relevant} | ${q.delta_p10 >= 0 ? "+" : ""}${q.delta_p10} | ${q.ordinal_delta >= 0 ? "+" : ""}${q.ordinal_delta} |`);
  }
}

fs.writeFileSync(OUT_MD, lines.join("\n") + "\n", "utf8");

console.log("INTERDISCIPLINARY CONJUNCTION CANDIDATE HUMAN ANALYSIS: PASS");
console.log(`candidate_pairs=${report.candidatePairs}`);
console.log(`prior_human_reused=${report.priorHumanReused}`);
console.log(`newly_judged=${report.newlyJudged}`);
console.log(`judgments=${report.judgments}`);
for (const id of profileIds) {
  const r = analyses[id];
  console.log(`${id}: baseline_rel=${r.baseline_only_relevant} profile_rel=${r.profile_only_relevant} net=${r.net_relevant} delta_p10=${r.exact_paired_delta_p10} ordinal_delta=${r.ordinal_delta} queries=${r.improved_queries}/${r.worsened_queries}/${r.tied_queries}`);
}
console.log(`judgments_out=${path.relative(ROOT, OUT_JUDGMENTS)}`);
console.log(`json=${path.relative(ROOT, OUT_JSON)}`);
console.log(`markdown=${path.relative(ROOT, OUT_MD)}`);

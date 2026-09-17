import fs from "node:fs";
import path from "node:path";

import { normalizeText, parseQuery } from "../../src/core/parser.js";
import { QUERY_AREA_TERMS, QUERY_DOMAIN_TERMS } from "../../src/data/query-lexicon.js";

const ROOT = process.cwd();
const RUN = path.join(ROOT, "benchmark/runs/heldout-multilingual-ab-v1-1f2232d.jsonl");
const MANIFEST = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.manifest.json");
const JUDGMENTS = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.judgments.jsonl");
const QUERIES = path.join(ROOT, "benchmark/validation-multilingual-ab-v1.queries.json");
const MAP = path.join(ROOT, "src/data/philosophy-map.json");
const OUT_JSON = path.join(ROOT, "benchmark/interdisciplinary-conjunction-profiles-v1.json");
const OUT_MD = path.join(ROOT, "benchmark/interdisciplinary-conjunction-profiles-v1.md");

function readJsonl(file) {
  return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line, i) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`${file}:${i + 1}: ${error.message}`); }
  });
}

function phrasePresent(text, phrase) {
  const p = normalizeText(phrase || "");
  if (!p) return false;
  return ` ${normalizeText(text || "")} `.includes(` ${p} `);
}

function termsForArea(areaId) {
  const out = [];
  for (const entry of QUERY_AREA_TERMS) {
    if (entry.areaId !== areaId) continue;
    if (entry.english) out.push(entry.english);
    for (const values of Object.values(entry.terms || {})) out.push(...(values || []));
  }
  return [...new Set(out.map(normalizeText).filter(Boolean))];
}

function termsForDomain(domainId) {
  const entry = QUERY_DOMAIN_TERMS.find(item => item.id === domainId);
  if (!entry) return [];
  const out = [entry.english];
  for (const values of Object.values(entry.terms || {})) out.push(...(values || []));
  return [...new Set(out.map(normalizeText).filter(Boolean))];
}

function allGroupsPresent(text, groups) {
  return groups.length > 0 && groups.every(group => group.some(term => phrasePresent(text, term)));
}

function evidenceFor(row, parsed) {
  const areaGroups = (parsed.explicitAreas || []).map(x => termsForArea(x.id)).filter(x => x.length);
  const domainGroups = (parsed.domains || []).map(x => termsForDomain(x.id)).filter(x => x.length);
  const hasAbstract = Boolean(String(row.abstract || "").trim());
  const text = `${row.title || ""}\n${row.abstract || ""}`;
  const area = allGroupsPresent(text, areaGroups);
  const domain = allGroupsPresent(text, domainGroups);
  const bucket = area && domain ? "both" : area ? "area-only" : domain ? "domain-only" : "neither";
  return { area, domain, bucket, hasAbstract };
}

const profiles = [
  { id: "baseline", both: 0, areaOnly: 0, domainOnly: 0, neitherWithAbstract: 0, neitherWithoutAbstract: 0 },
  { id: "both-plus-1", both: 1, areaOnly: 0, domainOnly: 0, neitherWithAbstract: 0, neitherWithoutAbstract: 0 },
  { id: "area-minus-1", both: 0, areaOnly: -1, domainOnly: 0, neitherWithAbstract: 0, neitherWithoutAbstract: 0 },
  { id: "area-minus-2", both: 0, areaOnly: -2, domainOnly: 0, neitherWithAbstract: 0, neitherWithoutAbstract: 0 },
  { id: "area-minus-3", both: 0, areaOnly: -3, domainOnly: 0, neitherWithAbstract: 0, neitherWithoutAbstract: 0 },
  { id: "conservative", both: 1, areaOnly: -2, domainOnly: 0, neitherWithAbstract: -1, neitherWithoutAbstract: 0 },
  { id: "moderate", both: 2, areaOnly: -2, domainOnly: 0, neitherWithAbstract: -1, neitherWithoutAbstract: 0 },
  { id: "asymmetric", both: 1, areaOnly: -3, domainOnly: 0, neitherWithAbstract: -1, neitherWithoutAbstract: 0 }
];

function adjustment(profile, evidence) {
  if (evidence.bucket === "both") return profile.both;
  if (evidence.bucket === "area-only") return profile.areaOnly;
  if (evidence.bucket === "domain-only") return profile.domainOnly;
  return evidence.hasAbstract ? profile.neitherWithAbstract : profile.neitherWithoutAbstract;
}

function pairwiseAccuracy(rows, scoreKey) {
  let wins = 0;
  let ties = 0;
  let pairs = 0;
  const byQuery = new Map();
  for (const row of rows) {
    if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, []);
    byQuery.get(row.query_id).push(row);
  }
  for (const subset of byQuery.values()) {
    const rel = subset.filter(x => x.relevant);
    const non = subset.filter(x => !x.relevant);
    for (const a of rel) for (const b of non) {
      pairs++;
      if (a[scoreKey] > b[scoreKey]) wins++;
      else if (a[scoreKey] === b[scoreKey]) ties++;
    }
  }
  return {
    pairs,
    wins,
    ties,
    accuracy: pairs ? Number(((wins + ties * 0.5) / pairs).toFixed(4)) : null
  };
}

function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

for (const file of [RUN, MANIFEST, JUDGMENTS, QUERIES, MAP]) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${path.relative(ROOT, file)}`);
}

const run = readJsonl(RUN);
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const judgments = readJsonl(JUDGMENTS);
const validation = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const philosophyMap = JSON.parse(fs.readFileSync(MAP, "utf8"));
const threshold = Number(validation.evaluation?.relevantThreshold ?? 2);
const queryMap = new Map(validation.queries.map(q => [q.id, q]));
const judgmentMap = new Map(judgments.map(j => [j.audit_id, j]));

const runMap = new Map(run.map(row => [`${row.query_id}\u0000${row.condition}\u0000${row.record_id}`, row]));
const judged = manifest.items.map(item => {
  const condition = item.selection_side === "A-only" ? "A" : "B";
  const row = runMap.get(`${item.query_id}\u0000${condition}\u0000${item.record_id}`);
  const human = judgmentMap.get(item.audit_id);
  const query = queryMap.get(item.query_id);
  if (!row || !human || !query) throw new Error(`Incomplete row for ${item.audit_id}`);
  const parsed = parseQuery(query.query, philosophyMap);
  const evidence = evidenceFor(row, parsed);
  return {
    audit_id: item.audit_id,
    query_id: item.query_id,
    family: query.family,
    language: query.language,
    condition,
    record_id: item.record_id,
    title: row.title || "",
    human_relevance: Number(human.human_relevance),
    relevant: Number(human.human_relevance) >= threshold,
    baselineScore: Number(row.score ?? row.ranking?.baseScore ?? 0),
    evidence
  };
});

const parsedByQuery = new Map(validation.queries.map(q => [q.id, parseQuery(q.query, philosophyMap)]));

const results = profiles.map(profile => {
  const rows = judged.map(row => {
    const adj = adjustment(profile, row.evidence);
    return { ...row, adjustment: adj, adjustedScore: row.baselineScore + adj };
  });

  const relevantScores = rows.filter(x => x.relevant).map(x => x.adjustedScore);
  const nonScores = rows.filter(x => !x.relevant).map(x => x.adjustedScore);
  const pairwise = pairwiseAccuracy(rows, "adjustedScore");

  let bQueriesChanged = 0;
  let bChangedPairs = 0;
  const bStructural = [];
  for (const query of validation.queries) {
    const parsed = parsedByQuery.get(query.id);
    const pool = run.filter(row => row.query_id === query.id && row.condition === "B");
    const rescored = pool.map(row => {
      const evidence = evidenceFor(row, parsed);
      const adj = adjustment(profile, evidence);
      return { row, evidence, adjustedScore: Number(row.score ?? row.ranking?.baseScore ?? 0) + adj };
    }).sort((a, b) => b.adjustedScore - a.adjustedScore || Number(a.row.rank) - Number(b.row.rank));
    const oldTop = new Set(pool.filter(x => Number(x.rank) <= 10).map(x => x.record_id));
    const newTopRows = rescored.slice(0, 10);
    const newTop = new Set(newTopRows.map(x => x.row.record_id));
    const oldOnly = [...oldTop].filter(id => !newTop.has(id));
    const newOnly = newTopRows.filter(x => !oldTop.has(x.row.record_id));
    const changedPairs = oldOnly.length + newOnly.length;
    if (changedPairs) bQueriesChanged++;
    bChangedPairs += changedPairs;
    bStructural.push({
      query_id: query.id,
      changedPairs,
      newOnly: newOnly.map(x => ({ rank_old: x.row.rank, record_id: x.row.record_id, title: x.row.title, bucket: x.evidence.bucket, adjustedScore: x.adjustedScore }))
    });
  }

  return {
    profile,
    human: {
      relevantMeanScore: Number(mean(relevantScores).toFixed(3)),
      nonRelevantMeanScore: Number(mean(nonScores).toFixed(3)),
      separation: Number((mean(relevantScores) - mean(nonScores)).toFixed(3)),
      pairwise
    },
    structuralB: {
      queriesChanged: bQueriesChanged,
      changedTop10Pairs: bChangedPairs,
      perQuery: bStructural
    }
  };
});

const baseline = results.find(x => x.profile.id === "baseline");
for (const result of results) {
  result.human.pairwiseDeltaVsBaseline = result.human.pairwise.accuracy === null || baseline.human.pairwise.accuracy === null
    ? null
    : Number((result.human.pairwise.accuracy - baseline.human.pairwise.accuracy).toFixed(4));
  result.human.separationDeltaVsBaseline = Number((result.human.separation - baseline.human.separation).toFixed(3));
}

const report = {
  schemaVersion: 1,
  name: "Interdisciplinary conjunction profile simulation v1",
  methodology: "Development-only simulation on the 68 already-adjudicated changed rows. Human metrics measure score separation and within-query relevant-vs-nonrelevant pairwise ordering only; they are not Top-10 effectiveness estimates. Structural B metrics rerank the frozen B pools without assigning relevance to newly entering rows.",
  warning: "This dataset is now tuning data and must not be reused as independent validation for the eventual conjunction ranking change.",
  threshold,
  judgedRows: judged.length,
  profiles: results
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const lines = [];
lines.push("# Interdisciplinary conjunction profile simulation v1", "", report.methodology, "", `> ${report.warning}`, "");
lines.push("## Profiles", "");
lines.push("| profile | rel mean | nonrel mean | separation | Δ separation | pairwise acc. | Δ pairwise | B queries changed | B changed Top10 pairs |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const r of results) {
  lines.push(`| ${r.profile.id} | ${r.human.relevantMeanScore} | ${r.human.nonRelevantMeanScore} | ${r.human.separation} | ${r.human.separationDeltaVsBaseline >= 0 ? "+" : ""}${r.human.separationDeltaVsBaseline} | ${r.human.pairwise.accuracy ?? "n/a"} | ${r.human.pairwiseDeltaVsBaseline >= 0 ? "+" : ""}${r.human.pairwiseDeltaVsBaseline} | ${r.structuralB.queriesChanged} | ${r.structuralB.changedTop10Pairs} |`);
}

lines.push("", "## Profile definitions", "");
for (const r of results) {
  const p = r.profile;
  lines.push(`- ${p.id}: both=${p.both}, area-only=${p.areaOnly}, domain-only=${p.domainOnly}, neither-with-abstract=${p.neitherWithAbstract}, neither-without-abstract=${p.neitherWithoutAbstract}`);
}

lines.push("", "## Structural B changes by profile", "");
for (const r of results.filter(x => x.profile.id !== "baseline")) {
  lines.push(`### ${r.profile.id}`, "");
  const changed = r.structuralB.perQuery.filter(x => x.changedPairs > 0);
  if (!changed.length) {
    lines.push("- no Top-10 membership changes", "");
    continue;
  }
  for (const item of changed) {
    lines.push(`- ${item.query_id}: changedPairs=${item.changedPairs}`);
    for (const row of item.newOnly) lines.push(`  - enters: old-rank=${row.rank_old} · bucket=${row.bucket} · score=${row.adjustedScore} · ${row.title}`);
  }
  lines.push("");
}

fs.writeFileSync(OUT_MD, lines.join("\n") + "\n", "utf8");

console.log("INTERDISCIPLINARY CONJUNCTION PROFILE SIMULATION: PASS");
console.log(`judged_rows=${judged.length}`);
for (const r of results) {
  console.log(`${r.profile.id}: pairwise=${r.human.pairwise.accuracy} delta=${r.human.pairwiseDeltaVsBaseline} separation=${r.human.separation} b_changed_pairs=${r.structuralB.changedTop10Pairs}`);
}
console.log(`json=${path.relative(ROOT, OUT_JSON)}`);
console.log(`markdown=${path.relative(ROOT, OUT_MD)}`);

import fs from "node:fs";
import path from "node:path";

import { normalizeText, parseQuery } from "../../src/core/parser.js";
import {
  QUERY_AREA_TERMS,
  QUERY_DOMAIN_TERMS
} from "../../src/data/query-lexicon.js";

const ROOT = process.cwd();
const SAMPLE_PATH = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.sample.jsonl");
const MANIFEST_PATH = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.manifest.json");
const JUDGMENTS_PATH = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.judgments.jsonl");
const QUERIES_PATH = path.join(ROOT, "benchmark/validation-multilingual-ab-v1.queries.json");
const MAP_PATH = path.join(ROOT, "src/data/philosophy-map.json");
const OUT_JSON = path.join(ROOT, "benchmark/interdisciplinary-conjunction-diagnostic-v1.json");
const OUT_MD = path.join(ROOT, "benchmark/interdisciplinary-conjunction-diagnostic-v1.md");

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`${filePath}:${index + 1}: ${error.message}`); }
    });
}

function phrasePresent(text, phrase) {
  const haystack = ` ${normalizeText(text || "")} `;
  const needle = ` ${normalizeText(phrase || "")} `;
  return Boolean(normalizeText(phrase || "")) && haystack.includes(needle);
}

function termsForArea(areaId) {
  const terms = [];
  for (const entry of QUERY_AREA_TERMS) {
    if (entry.areaId !== areaId) continue;
    if (entry.english) terms.push(entry.english);
    for (const values of Object.values(entry.terms || {})) terms.push(...(values || []));
  }
  return [...new Set(terms.map(normalizeText).filter(Boolean))];
}

function termsForDomain(domainId) {
  const entry = QUERY_DOMAIN_TERMS.find(item => item.id === domainId);
  if (!entry) return [];
  const terms = [entry.english];
  for (const values of Object.values(entry.terms || {})) terms.push(...(values || []));
  return [...new Set(terms.map(normalizeText).filter(Boolean))];
}

function allGroupsPresent(text, groups) {
  return groups.length > 0 && groups.every(group => group.some(term => phrasePresent(text, term)));
}

function bucket(area, domain) {
  if (area && domain) return "both";
  if (area) return "area-only";
  if (domain) return "domain-only";
  return "neither";
}

function summarize(rows, threshold) {
  const total = rows.length;
  const relevant = rows.filter(row => row.human_relevance >= threshold).length;
  const central = rows.filter(row => row.human_relevance === 3).length;
  return {
    rows: total,
    relevant,
    central,
    relevantRate: total ? Number((relevant / total).toFixed(4)) : null
  };
}

for (const file of [SAMPLE_PATH, MANIFEST_PATH, JUDGMENTS_PATH, QUERIES_PATH, MAP_PATH]) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${path.relative(ROOT, file)}`);
}

const sample = readJsonl(SAMPLE_PATH);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const judgments = readJsonl(JUDGMENTS_PATH);
const validation = JSON.parse(fs.readFileSync(QUERIES_PATH, "utf8"));
const philosophyMap = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
const threshold = Number(validation.evaluation?.relevantThreshold ?? 2);

const manifestByAudit = new Map(manifest.items.map(item => [item.audit_id, item]));
const judgmentByAudit = new Map(judgments.map(item => [item.audit_id, item]));
const queryById = new Map(validation.queries.map(item => [item.id, item]));

const rows = sample.map(item => {
  const human = judgmentByAudit.get(item.audit_id);
  const hidden = manifestByAudit.get(item.audit_id);
  const queryMeta = queryById.get(item.query_id);
  if (!human || !hidden || !queryMeta) throw new Error(`Incomplete metadata for ${item.audit_id}`);

  const parsed = parseQuery(item.query, philosophyMap);
  const areaGroups = (parsed.explicitAreas || []).map(area => termsForArea(area.id)).filter(group => group.length);
  const domainGroups = (parsed.domains || []).map(domain => termsForDomain(domain.id)).filter(group => group.length);

  if (!areaGroups.length || !domainGroups.length) {
    throw new Error(`${item.audit_id}: query is not an explicit area+domain conjunction: ${item.query}`);
  }

  const title = item.title || "";
  const abstract = item.abstract || "";
  const titleAbstract = `${title}\n${abstract}`;

  const titleArea = allGroupsPresent(title, areaGroups);
  const titleDomain = allGroupsPresent(title, domainGroups);
  const textArea = allGroupsPresent(titleAbstract, areaGroups);
  const textDomain = allGroupsPresent(titleAbstract, domainGroups);

  return {
    audit_id: item.audit_id,
    query_id: item.query_id,
    query: item.query,
    language: queryMeta.language,
    family: queryMeta.family,
    side: hidden.selection_side,
    translation_mode: hidden.b_translation_mode || null,
    title: item.title || "",
    has_abstract: Boolean(String(item.abstract || "").trim()),
    human_relevance: Number(human.human_relevance),
    relevant: Number(human.human_relevance) >= threshold,
    title_area: titleArea,
    title_domain: titleDomain,
    title_conjunction: titleArea && titleDomain,
    title_bucket: bucket(titleArea, titleDomain),
    text_area: textArea,
    text_domain: textDomain,
    text_conjunction: textArea && textDomain,
    text_bucket: bucket(textArea, textDomain)
  };
});

const bucketNames = ["both", "area-only", "domain-only", "neither"];
const titleBuckets = Object.fromEntries(bucketNames.map(name => [name, summarize(rows.filter(row => row.title_bucket === name), threshold)]));
const textBuckets = Object.fromEntries(bucketNames.map(name => [name, summarize(rows.filter(row => row.text_bucket === name), threshold)]));

const families = [...new Set(rows.map(row => row.family))];
const byFamily = Object.fromEntries(families.map(family => {
  const subset = rows.filter(row => row.family === family);
  return [family, {
    total: summarize(subset, threshold),
    titleConjunction: summarize(subset.filter(row => row.title_conjunction), threshold),
    textConjunction: summarize(subset.filter(row => row.text_conjunction), threshold)
  }];
}));

const translationOnly = rows.filter(row => row.side === "B-only" && row.translation_mode === "translation-only");
const report = {
  schemaVersion: 1,
  name: "Interdisciplinary conjunction diagnostic v1",
  methodology: "Development-only diagnostic over the frozen 68-row held-out A/B delta after human adjudication. It measures whether explicit philosophical-area and academic-domain terms are jointly evidenced in title alone or title+abstract. Because these labels are now being inspected for tuning, this set must not be reused as independent validation for a future conjunction-ranking change.",
  relevantThreshold: threshold,
  rows: rows.length,
  summary: {
    total: summarize(rows, threshold),
    withAbstract: rows.filter(row => row.has_abstract).length,
    titleConjunction: summarize(rows.filter(row => row.title_conjunction), threshold),
    textConjunction: summarize(rows.filter(row => row.text_conjunction), threshold),
    titleBuckets,
    textBuckets,
    translationOnly: {
      total: summarize(translationOnly, threshold),
      titleConjunction: summarize(translationOnly.filter(row => row.title_conjunction), threshold),
      textConjunction: summarize(translationOnly.filter(row => row.text_conjunction), threshold)
    },
    byFamily
  },
  rowsDetail: rows
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const lines = [];
lines.push("# Interdisciplinary conjunction diagnostic v1", "");
lines.push(report.methodology, "");
lines.push("## Overall", "");
lines.push(`- judged changed rows: ${rows.length}`);
lines.push(`- relevant rows (>=${threshold}): ${report.summary.total.relevant}/${rows.length} (${report.summary.total.relevantRate})`);
lines.push(`- rows with abstract: ${report.summary.withAbstract}/${rows.length}`);
lines.push(`- title conjunction: ${report.summary.titleConjunction.relevant}/${report.summary.titleConjunction.rows} relevant (${report.summary.titleConjunction.relevantRate ?? "n/a"})`);
lines.push(`- title+abstract conjunction: ${report.summary.textConjunction.relevant}/${report.summary.textConjunction.rows} relevant (${report.summary.textConjunction.relevantRate ?? "n/a"})`, "");

lines.push("## Buckets", "");
lines.push("| evidence | bucket | rows | relevant | relevant rate |");
lines.push("|---|---|---:|---:|---:|");
for (const [label, buckets] of [["title", titleBuckets], ["title+abstract", textBuckets]]) {
  for (const name of bucketNames) {
    const item = buckets[name];
    lines.push(`| ${label} | ${name} | ${item.rows} | ${item.relevant} | ${item.relevantRate ?? "n/a"} |`);
  }
}

lines.push("", "## Translation-only B rows", "");
lines.push(`- total relevant: ${report.summary.translationOnly.total.relevant}/${report.summary.translationOnly.total.rows} (${report.summary.translationOnly.total.relevantRate ?? "n/a"})`);
lines.push(`- title conjunction relevant: ${report.summary.translationOnly.titleConjunction.relevant}/${report.summary.translationOnly.titleConjunction.rows} (${report.summary.translationOnly.titleConjunction.relevantRate ?? "n/a"})`);
lines.push(`- title+abstract conjunction relevant: ${report.summary.translationOnly.textConjunction.relevant}/${report.summary.translationOnly.textConjunction.rows} (${report.summary.translationOnly.textConjunction.relevantRate ?? "n/a"})`, "");

lines.push("## By family", "");
lines.push("| family | total rel/rows | title conjunction rel/rows | title+abstract conjunction rel/rows |");
lines.push("|---|---:|---:|---:|");
for (const family of families) {
  const item = byFamily[family];
  lines.push(`| ${family} | ${item.total.relevant}/${item.total.rows} | ${item.titleConjunction.relevant}/${item.titleConjunction.rows} | ${item.textConjunction.relevant}/${item.textConjunction.rows} |`);
}

lines.push("", "## Relevant rows lacking conjunction evidence", "");
lines.push("These are important false-negative risks for any hard conjunction filter.", "");
for (const row of rows.filter(row => row.relevant && !row.text_conjunction)) {
  lines.push(`- ${row.audit_id} · ${row.query_id} · rel=${row.human_relevance} · ${row.side} · ${row.title}`);
}

lines.push("", "## Irrelevant/tangential rows with conjunction evidence", "");
lines.push("These are important false-positive risks for a conjunction bonus.", "");
for (const row of rows.filter(row => !row.relevant && row.text_conjunction)) {
  lines.push(`- ${row.audit_id} · ${row.query_id} · rel=${row.human_relevance} · ${row.side} · ${row.title}`);
}

fs.writeFileSync(OUT_MD, lines.join("\n") + "\n", "utf8");

console.log("INTERDISCIPLINARY CONJUNCTION DIAGNOSTIC: PASS");
console.log(`rows=${rows.length}`);
console.log(`relevant=${report.summary.total.relevant}/${rows.length}`);
console.log(`with_abstract=${report.summary.withAbstract}/${rows.length}`);
console.log(`title_conjunction=${report.summary.titleConjunction.relevant}/${report.summary.titleConjunction.rows}`);
console.log(`text_conjunction=${report.summary.textConjunction.relevant}/${report.summary.textConjunction.rows}`);
console.log(`translation_only=${report.summary.translationOnly.total.relevant}/${report.summary.translationOnly.total.rows}`);
console.log(`translation_only_title_conjunction=${report.summary.translationOnly.titleConjunction.relevant}/${report.summary.translationOnly.titleConjunction.rows}`);
console.log(`translation_only_text_conjunction=${report.summary.translationOnly.textConjunction.relevant}/${report.summary.translationOnly.textConjunction.rows}`);
console.log(`json=${path.relative(ROOT, OUT_JSON)}`);
console.log(`markdown=${path.relative(ROOT, OUT_MD)}`);

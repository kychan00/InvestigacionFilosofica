import fs from "node:fs";

import { parseQuery, normalizeText } from "../../src/core/parser.js";
import { expandQuery } from "../../src/core/expander.js";

const QUERIES = "benchmark/queries.json";
const MAP = "src/data/philosophy-map.json";
const BASE_RUN = "benchmark/runs/human-v1.0-1064fdb.jsonl";
const V2_RUN = "benchmark/runs/human-v1.0-ranking-v2-e6ad110.jsonl";
const OUT_MD = "benchmark/interdisciplinary-expansion-diagnostic.md";
const OUT_JSON = "benchmark/interdisciplinary-expansion-diagnostic.json";

function readJsonl(path) {
  return fs.readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
}

function key(text = "") {
  return normalizeText(text).replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function rowsFor(run, queryId) {
  return run
    .filter(row => row.query_id === queryId)
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

function matchedQueryTexts(row) {
  return (row.matchedQueries || []).map(item => String(item.query || "")).filter(Boolean);
}

function summarizeRun(run, query, expansions) {
  const rows = rowsFor(run, query.id);
  const originalKey = key(query.query);
  const expansionKeys = new Map(expansions.map(item => [key(item.query), item]));

  const counts = expansions.map(expansion => {
    const expansionKey = key(expansion.query);
    const matched = rows.filter(row =>
      matchedQueryTexts(row).some(text => key(text) === expansionKey)
    );
    return {
      query: expansion.query,
      type: expansion.type,
      weight: expansion.weight,
      rows: matched.length,
      top10: matched.filter(row => Number(row.rank) <= 10).length,
    };
  });

  const expansionOnly = rows.filter(row => {
    const matches = matchedQueryTexts(row).map(key);
    const matchedOriginal = matches.includes(originalKey);
    const matchedKnownExpansion = matches.some(match => expansionKeys.has(match) && match !== originalKey);
    return !matchedOriginal && matchedKnownExpansion;
  });

  return {
    counts,
    expansionOnlyTop: expansionOnly.slice(0, 8).map(row => ({
      rank: row.rank,
      title: row.title || "",
      providers: row.providers || [],
      matchedQueries: matchedQueryTexts(row),
    })),
  };
}

const benchmark = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const philosophyMap = JSON.parse(fs.readFileSync(MAP, "utf8"));
const baseRun = readJsonl(BASE_RUN);
const v2Run = readJsonl(V2_RUN);

const targetQueries = benchmark.queries.filter(query => query.intent === "interdisciplinary-challenge");

const items = targetQueries.map(query => {
  const parsed = parseQuery(query.query, philosophyMap);
  const expansions = expandQuery(parsed, philosophyMap, { maxQueries: 6 });

  return {
    id: query.id,
    query: query.query,
    language: query.language,
    family: query.family,
    parsed: {
      explicitAreas: (parsed.explicitAreas || []).map(area => area.id),
      concepts: (parsed.concepts || []).map(concept => concept.id),
      philosophers: (parsed.philosophers || []).map(philosopher => philosopher.id),
      works: (parsed.works || []).map(work => work.id),
    },
    expansions,
    baseline: summarizeRun(baseRun, query, expansions),
    rankingV2: summarizeRun(v2Run, query, expansions),
  };
});

const report = {
  schemaVersion: 1,
  note: "Diagnostic only. Shows how interdisciplinary benchmark queries are parsed and expanded, and which frozen-pool rows were retrieved only through non-original expansions.",
  items,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");

const md = [];
md.push("# Interdisciplinary expansion diagnostic", "", report.note, "");

for (const item of items) {
  md.push(`## ${item.id} — ${item.query}`, "");
  md.push(`- explicitAreas: ${item.parsed.explicitAreas.join(", ") || "—"}`);
  md.push(`- concepts: ${item.parsed.concepts.join(", ") || "—"}`);
  md.push(`- philosophers: ${item.parsed.philosophers.join(", ") || "—"}`);
  md.push(`- works: ${item.parsed.works.join(", ") || "—"}`, "");

  md.push("### Generated expansions", "");
  md.push("| Type | Weight | Query |");
  md.push("|---|---:|---|");
  for (const expansion of item.expansions) {
    md.push(`| ${expansion.type} | ${expansion.weight} | ${expansion.query} |`);
  }

  for (const [label, data] of [["Baseline", item.baseline], ["Ranking v2", item.rankingV2]]) {
    md.push("", `### ${label} retrieval contribution`, "");
    md.push("| Expansion | Type | Rows in Top20 | Rows in Top10 |");
    md.push("|---|---|---:|---:|");
    for (const count of data.counts) {
      md.push(`| ${count.query} | ${count.type} | ${count.rows} | ${count.top10} |`);
    }

    md.push("", "Expansion-only rows near the top:", "");
    if (!data.expansionOnlyTop.length) {
      md.push("- none");
    } else {
      for (const row of data.expansionOnlyTop) {
        md.push(`- r${row.rank} · ${row.providers.join(" + ") || "—"} · ${row.title} · matched=[${row.matchedQueries.join(" | ")}]`);
      }
    }
  }

  md.push("");
}

fs.writeFileSync(OUT_MD, md.join("\n") + "\n", "utf8");

console.log("INTERDISCIPLINARY EXPANSION DIAGNOSTIC: PASS");
console.log(`queries=${items.length}`);
for (const item of items) {
  console.log(`${item.id}: areas=${item.parsed.explicitAreas.join(",") || "none"} expansions=${item.expansions.map(x => x.query).join(" || ")}`);
}
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);

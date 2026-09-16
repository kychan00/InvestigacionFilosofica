import fs from "node:fs";

import {
  normalizeText,
  parseQuery
} from "../../src/core/parser.js";

import {
  expandQuery
} from "../../src/core/expander.js";

const QUERIES_PATH = "benchmark/queries.json";
const MAP_PATH = "src/data/philosophy-map.json";
const OUT_JSON = "benchmark/multilingual-parser-diagnostic.json";
const OUT_MD = "benchmark/multilingual-parser-diagnostic.md";

const STOPWORDS = new Set([
  // Spanish
  "a", "al", "de", "del", "el", "la", "las", "los", "en", "y", "o", "por", "para", "con", "sobre",
  // English
  "a", "an", "and", "of", "the", "in", "on", "for", "to", "with", "about",
  // German
  "am", "an", "auf", "bei", "das", "dem", "den", "der", "des", "die", "ein", "eine", "einer", "im", "in", "mit", "und", "von", "zu", "zur", "zum",
  // French
  "a", "au", "aux", "dans", "de", "des", "du", "en", "et", "la", "le", "les", "sur", "avec", "pour",
  // Portuguese
  "a", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "para", "por", "sobre"
]);

function semanticTokens(text = "") {
  return normalizeText(text)
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !STOPWORDS.has(token));
}

function matchedSemanticTokens(parsed) {
  const tokens = new Set();
  const groups = [
    parsed.philosophers || [],
    parsed.concepts || [],
    parsed.works || [],
    parsed.explicitAreas || []
  ];

  for (const group of groups) {
    for (const item of group) {
      for (const token of semanticTokens(item.matched || "")) {
        tokens.add(token);
      }
    }
  }

  return tokens;
}

function residualTokens(parsed) {
  const recognized = matchedSemanticTokens(parsed);
  return semanticTokens(parsed.original)
    .filter(token => !recognized.has(token));
}

function ids(items = []) {
  return items.map(item => item.id);
}

function mdCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

const benchmark = JSON.parse(fs.readFileSync(QUERIES_PATH, "utf8"));
const philosophyMap = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));

const rows = benchmark.queries.map(query => {
  const parsed = parseQuery(query.query, philosophyMap);
  const expansions = expandQuery(parsed, philosophyMap, { maxQueries: 6 });

  return {
    query_id: query.id,
    family: query.family,
    intent: query.intent,
    query: query.query,
    expected_language: query.language,
    detected_language: parsed.language,
    language_match: parsed.language === query.language,
    philosophers: ids(parsed.philosophers),
    concepts: ids(parsed.concepts),
    works: ids(parsed.works),
    explicit_areas: ids(parsed.explicitAreas),
    inferred_areas: ids(parsed.areas),
    residual_tokens: residualTokens(parsed),
    expansions: expansions.map(item => ({
      type: item.type,
      weight: item.weight,
      query: item.query
    }))
  };
});

const byLanguage = {};
for (const language of benchmark.languages) {
  const langRows = rows.filter(row => row.expected_language === language);
  const matched = langRows.filter(row => row.language_match).length;
  byLanguage[language] = {
    queries: langRows.length,
    language_detected_correctly: matched,
    language_detection_rate: langRows.length ? matched / langRows.length : 0
  };
}

const interdisciplinary = rows.filter(
  row => row.intent === "interdisciplinary-challenge"
);

const interdisciplinaryAreaCoverage = {};
for (const language of benchmark.languages) {
  const langRows = interdisciplinary.filter(
    row => row.expected_language === language
  );
  const recognized = langRows.filter(
    row => row.explicit_areas.length > 0
  ).length;

  interdisciplinaryAreaCoverage[language] = {
    queries: langRows.length,
    explicit_area_recognized: recognized,
    rate: langRows.length ? recognized / langRows.length : 0
  };
}

const summary = {
  benchmark_queries: rows.length,
  language_detection_correct: rows.filter(row => row.language_match).length,
  language_detection_rate: rows.length
    ? rows.filter(row => row.language_match).length / rows.length
    : 0,
  interdisciplinary_queries: interdisciplinary.length,
  interdisciplinary_explicit_area_recognized: interdisciplinary.filter(
    row => row.explicit_areas.length > 0
  ).length,
  interdisciplinary_with_only_original_expansion: interdisciplinary.filter(
    row => row.expansions.length === 1 && row.expansions[0]?.type === "original"
  ).length
};

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  purpose: "Diagnostic only: quantify current multilingual parser and expansion coverage before changing retrieval behavior.",
  summary,
  byLanguage,
  interdisciplinaryAreaCoverage,
  rows
};

fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2) + "\n", "utf8");

const md = [];
md.push("# Multilingual parser diagnostic");
md.push("");
md.push("Diagnostic only. This report measures the current parser/expander behavior; it does not introduce new translations or retrieval rules.");
md.push("");
md.push("## Summary");
md.push("");
md.push(`- benchmark queries: ${summary.benchmark_queries}`);
md.push(`- language detected correctly: ${summary.language_detection_correct}/${summary.benchmark_queries} (${(summary.language_detection_rate * 100).toFixed(1)}%)`);
md.push(`- interdisciplinary queries: ${summary.interdisciplinary_queries}`);
md.push(`- interdisciplinary explicit philosophical area recognized: ${summary.interdisciplinary_explicit_area_recognized}/${summary.interdisciplinary_queries}`);
md.push(`- interdisciplinary queries with only the original expansion: ${summary.interdisciplinary_with_only_original_expansion}/${summary.interdisciplinary_queries}`);
md.push("");
md.push("## Language detection");
md.push("");
md.push("| language | correct | total | rate |");
md.push("|---|---:|---:|---:|");
for (const language of benchmark.languages) {
  const item = byLanguage[language];
  md.push(`| ${language} | ${item.language_detected_correctly} | ${item.queries} | ${(item.language_detection_rate * 100).toFixed(1)}% |`);
}
md.push("");
md.push("## Interdisciplinary explicit-area coverage");
md.push("");
md.push("| language | recognized | total | rate |");
md.push("|---|---:|---:|---:|");
for (const language of benchmark.languages) {
  const item = interdisciplinaryAreaCoverage[language];
  md.push(`| ${language} | ${item.explicit_area_recognized} | ${item.queries} | ${(item.rate * 100).toFixed(1)}% |`);
}
md.push("");
md.push("## Interdisciplinary queries");
md.push("");
md.push("| id | query | detected lang | explicit areas | residual semantic tokens | expansions |");
md.push("|---|---|---|---|---|---|");
for (const row of interdisciplinary) {
  const expansionText = row.expansions
    .map(item => `${item.type}:${item.query}`)
    .join(" · ");
  md.push(
    `| ${mdCell(row.query_id)} | ${mdCell(row.query)} | ${mdCell(row.detected_language)} | ${mdCell(row.explicit_areas.join(", ") || "—")} | ${mdCell(row.residual_tokens.join(", ") || "—")} | ${mdCell(expansionText)} |`
  );
}
md.push("");
md.push("## All benchmark queries");
md.push("");
md.push("| id | expected | detected | philosophers | concepts | works | explicit areas | residual tokens |");
md.push("|---|---|---|---|---|---|---|---|");
for (const row of rows) {
  md.push(
    `| ${mdCell(row.query_id)} | ${mdCell(row.expected_language)} | ${mdCell(row.detected_language)} | ${mdCell(row.philosophers.join(", ") || "—")} | ${mdCell(row.concepts.join(", ") || "—")} | ${mdCell(row.works.join(", ") || "—")} | ${mdCell(row.explicit_areas.join(", ") || "—")} | ${mdCell(row.residual_tokens.join(", ") || "—")} |`
  );
}
md.push("");
md.push("## Interpretation boundary");
md.push("");
md.push("This diagnostic describes parser coverage only. It does not estimate ranking quality and must not be read as an evaluation of retrieval relevance.");

fs.writeFileSync(OUT_MD, md.join("\n") + "\n", "utf8");

console.log("MULTILINGUAL PARSER DIAGNOSTIC: PASS");
console.log(`queries=${summary.benchmark_queries}`);
console.log(`language_detection=${summary.language_detection_correct}/${summary.benchmark_queries}`);
console.log(`interdisciplinary_area_recognition=${summary.interdisciplinary_explicit_area_recognized}/${summary.interdisciplinary_queries}`);
console.log(`interdisciplinary_original_only=${summary.interdisciplinary_with_only_original_expansion}/${summary.interdisciplinary_queries}`);
console.log(`json=${OUT_JSON}`);
console.log(`markdown=${OUT_MD}`);

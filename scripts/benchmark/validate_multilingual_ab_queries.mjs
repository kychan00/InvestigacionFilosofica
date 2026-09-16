import fs from "node:fs";
import { parseQuery, normalizeText } from "../../src/core/parser.js";
import { expandQuery } from "../../src/core/expander.js";

const VALIDATION = "benchmark/validation-multilingual-ab-v1.queries.json";
const BENCHMARK = "benchmark/queries.json";
const MAP = "src/data/philosophy-map.json";

const validation = JSON.parse(fs.readFileSync(VALIDATION, "utf8"));
const benchmark = JSON.parse(fs.readFileSync(BENCHMARK, "utf8"));
const philosophyMap = JSON.parse(fs.readFileSync(MAP, "utf8"));

function fail(message) {
  throw new Error(message);
}

if (validation.queries.length !== 20) fail(`Expected 20 held-out queries, found ${validation.queries.length}`);

const languages = ["es", "en", "de", "fr", "pt"];
const languageCounts = new Map(languages.map(language => [language, 0]));
const familyCounts = new Map();
const ids = new Set();
const texts = new Set();
const priorTexts = new Set(benchmark.queries.map(query => normalizeText(query.query)));

let exactLanguage = 0;
let safeEnglishPaths = 0;
let englishControls = 0;

for (const query of validation.queries) {
  if (ids.has(query.id)) fail(`Duplicate id: ${query.id}`);
  ids.add(query.id);

  const normalized = normalizeText(query.query);
  if (texts.has(normalized)) fail(`Duplicate query text: ${query.query}`);
  texts.add(normalized);
  if (priorTexts.has(normalized)) fail(`Held-out query duplicates development benchmark: ${query.query}`);

  if (!languageCounts.has(query.language)) fail(`Unexpected language ${query.language}`);
  languageCounts.set(query.language, languageCounts.get(query.language) + 1);
  familyCounts.set(query.family, (familyCounts.get(query.family) || 0) + 1);

  const parsed = parseQuery(query.query, philosophyMap);
  if (parsed.language === query.language) exactLanguage++;

  if (!parsed.explicitAreas.some(area => area.id === query.expectedArea)) {
    fail(`${query.id}: missing expected area ${query.expectedArea}`);
  }
  if (!parsed.domains.some(domain => domain.id === query.expectedDomain)) {
    fail(`${query.id}: missing expected domain ${query.expectedDomain}`);
  }

  const baseline = expandQuery(parsed, philosophyMap, { maxQueries: 1 });
  if (baseline.length !== 1 || baseline[0].type !== "original" || normalizeText(baseline[0].query) !== normalized) {
    fail(`${query.id}: maxQueries=1 is not original-only`);
  }

  const expanded = expandQuery(parsed, philosophyMap, { maxQueries: 5 });
  const expectedEnglish = normalizeText(query.expectedEnglish);
  const translation = expanded.find(item => item.type === "translation" && normalizeText(item.query) === expectedEnglish);

  if (query.language === "en") {
    englishControls++;
    if (expanded.length !== 1 || normalizeText(expanded[0].query) !== expectedEnglish) {
      fail(`${query.id}: English control should deduplicate to the original query`);
    }
  } else {
    if (!translation) fail(`${query.id}: missing safe English translation ${query.expectedEnglish}`);
    safeEnglishPaths++;
  }
}

for (const language of languages) {
  if (languageCounts.get(language) !== 4) fail(`${language}: expected 4 queries, found ${languageCounts.get(language)}`);
}
for (const [family, count] of familyCounts) {
  if (count !== 5) fail(`${family}: expected 5 languages, found ${count}`);
}
if (familyCounts.size !== 4) fail(`Expected 4 families, found ${familyCounts.size}`);

console.log("MULTILINGUAL HELD-OUT QUERY VALIDATION: PASS");
console.log(`queries=${validation.queries.length}`);
console.log(`families=${familyCounts.size}`);
console.log(`languages=${languages.length}`);
console.log(`language_detection=${exactLanguage}/${validation.queries.length}`);
console.log(`non_english_safe_english_path=${safeEnglishPaths}/16`);
console.log(`english_controls_deduplicated=${englishControls}/4`);
console.log(`overlap_with_development_queries=0`);
for (const language of languages) console.log(`${language}=${languageCounts.get(language)}`);

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RANK_PATH = path.join(ROOT, "src/core/rank.js");
const TEST_PATH = path.join(ROOT, "tests/interdisciplinary-conjunction-ranking.test.mjs");

if (!fs.existsSync(RANK_PATH)) {
  throw new Error(`Missing ${path.relative(ROOT, RANK_PATH)}`);
}

let rank = fs.readFileSync(RANK_PATH, "utf8");

const importBlock = `import { normalizeText } from "./parser.js";\nimport { disciplineScore } from "./discipline.js";`;
const importReplacement = `${importBlock}\nimport {\n  interdisciplinaryConjunctionAdjustment\n} from "./interdisciplinary-conjunction.js";`;

const v2Block = `  const v2 =\n    rankingV2Adjustment(\n      result,\n      parsed\n    );`;
const v2Replacement = `${v2Block}\n\n  const conjunction =\n    interdisciplinaryConjunctionAdjustment(\n      result,\n      parsed\n    );`;

const sortBlock = `  const rankingSortScore =\n    clamp(\n      baseScore +\n      v2.total,\n      0,\n      100\n    );`;
const sortReplacement = `  const rankingSortScore =\n    clamp(\n      baseScore +\n      v2.total +\n      conjunction.total,\n      0,\n      100\n    );`;

const diagnosticBlock = `      v2Adjustment:\n        Math.round(\n          v2.total * 100\n        ) / 100`;
const diagnosticReplacement = `${diagnosticBlock},\n\n      conjunctionApplies:\n        conjunction.applies,\n\n      conjunctionBucket:\n        conjunction.bucket,\n\n      conjunctionAreaMatched:\n        conjunction.areaMatched,\n\n      conjunctionDomainMatched:\n        conjunction.domainMatched,\n\n      conjunctionHasAbstract:\n        conjunction.hasAbstract,\n\n      conjunctionAdjustment:\n        conjunction.total`;

function replaceExactlyOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) {
    throw new Error(`Could not find expected ${label} anchor in src/core/rank.js`);
  }
  if (source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`Expected exactly one ${label} anchor in src/core/rank.js`);
  }
  return source.replace(needle, replacement);
}

const alreadyApplied =
  rank.includes("interdisciplinaryConjunctionAdjustment") &&
  rank.includes("conjunctionAdjustment:");

if (!alreadyApplied) {
  rank = replaceExactlyOnce(rank, importBlock, importReplacement, "import");
  rank = replaceExactlyOnce(rank, v2Block, v2Replacement, "v2 adjustment");
  rank = replaceExactlyOnce(rank, sortBlock, sortReplacement, "ranking sort score");
  rank = replaceExactlyOnce(rank, diagnosticBlock, diagnosticReplacement, "ranking diagnostics");
  fs.writeFileSync(RANK_PATH, rank, "utf8");
}

const testContent = `import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\n\nimport { parseQuery } from "../src/core/parser.js";\nimport {\n  interdisciplinaryConjunctionAdjustment\n} from "../src/core/interdisciplinary-conjunction.js";\nimport { rankResult } from "../src/core/rank.js";\n\nconst philosophyMap = JSON.parse(\n  fs.readFileSync(\n    new URL(\n      "../src/data/philosophy-map.json",\n      import.meta.url\n    ),\n    "utf8"\n  )\n);\n\nfunction parsed(query) {\n  return parseQuery(query, philosophyMap);\n}\n\nfunction result(title, abstract = null) {\n  return {\n    title,\n    abstract,\n    authors: [],\n    providers: [],\n    topics: [],\n    matchedQueries: [],\n    citedBy: 0\n  };\n}\n\ntest("conjunción explícita premia evidencia de ambos lados", () => {\n  const signal = interdisciplinaryConjunctionAdjustment(\n    result("Logic in Linguistics"),\n    parsed("lógica en lingüística")\n  );\n\n  assert.equal(signal.applies, true);\n  assert.equal(signal.bucket, "both");\n  assert.equal(signal.total, 2);\n});\n\ntest("conjunción explícita penaliza area-only", () => {\n  const signal = interdisciplinaryConjunctionAdjustment(\n    result("Formal Logic and Argumentation"),\n    parsed("lógica en lingüística")\n  );\n\n  assert.equal(signal.bucket, "area-only");\n  assert.equal(signal.total, -2);\n});\n\ntest("conjunción explícita deja domain-only neutral", () => {\n  const signal = interdisciplinaryConjunctionAdjustment(\n    result("Caminhos em Linguística Aplicada"),\n    parsed("lógica en lingüística")\n  );\n\n  assert.equal(signal.bucket, "domain-only");\n  assert.equal(signal.total, 0);\n});\n\ntest("neither sólo se penaliza cuando hay abstract disponible", () => {\n  const query = parsed("lógica en lingüística");\n\n  const withAbstract = interdisciplinaryConjunctionAdjustment(\n    result(\n      "Reasoning in Formal Systems",\n      "A study of inference and proof."\n    ),\n    query\n  );\n\n  const withoutAbstract = interdisciplinaryConjunctionAdjustment(\n    result("Reasoning in Formal Systems"),\n    query\n  );\n\n  assert.equal(withAbstract.bucket, "neither");\n  assert.equal(withAbstract.total, -1);\n  assert.equal(withoutAbstract.bucket, "neither");\n  assert.equal(withoutAbstract.total, 0);\n});\n\ntest("consultas no interdisciplinarias no reciben ajuste", () => {\n  const signal = interdisciplinaryConjunctionAdjustment(\n    result("Freedom in Kant"),\n    parsed("libertad en Kant")\n  );\n\n  assert.equal(signal.applies, false);\n  assert.equal(signal.bucket, "not-applicable");\n  assert.equal(signal.total, 0);\n});\n\ntest("rankResult expone y aplica el diagnóstico de conjunción", () => {\n  const ranked = rankResult(\n    {\n      ...result("Logic in Linguistics"),\n      matchedQueries: [\n        {\n          query: "logic in linguistics",\n          weight: 0.9\n        }\n      ]\n    },\n    parsed("lógica en lingüística"),\n    philosophyMap\n  );\n\n  assert.equal(ranked.ranking.conjunctionApplies, true);\n  assert.equal(ranked.ranking.conjunctionBucket, "both");\n  assert.equal(ranked.ranking.conjunctionAreaMatched, true);\n  assert.equal(ranked.ranking.conjunctionDomainMatched, true);\n  assert.equal(ranked.ranking.conjunctionAdjustment, 2);\n});\n`;

if (fs.existsSync(TEST_PATH)) {
  const existing = fs.readFileSync(TEST_PATH, "utf8");
  if (existing !== testContent) {
    throw new Error(`${path.relative(ROOT, TEST_PATH)} already exists with unexpected content`);
  }
} else {
  fs.writeFileSync(TEST_PATH, testContent, "utf8");
}

console.log("INTERDISCIPLINARY CONJUNCTION V1 PATCH: PASS");
console.log(`rank=${path.relative(ROOT, RANK_PATH)}`);
console.log(`test=${path.relative(ROOT, TEST_PATH)}`);
console.log(`already_applied=${alreadyApplied}`);

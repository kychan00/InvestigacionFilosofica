import fs from "node:fs";
import path from "node:path";

import { normalizeText, parseQuery } from "../../src/core/parser.js";
import { QUERY_AREA_TERMS, QUERY_DOMAIN_TERMS } from "../../src/data/query-lexicon.js";

const ROOT = process.cwd();
const RUN = path.join(ROOT, "benchmark/runs/heldout-multilingual-ab-v1-1f2232d.jsonl");
const PRIOR_MANIFEST = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.manifest.json");
const PRIOR_JUDGMENTS = path.join(ROOT, "benchmark/multilingual-ab-delta-audit-v1.judgments.jsonl");
const QUERIES = path.join(ROOT, "benchmark/validation-multilingual-ab-v1.queries.json");
const MAP = path.join(ROOT, "src/data/philosophy-map.json");
const SAMPLE_OUT = path.join(ROOT, "benchmark/interdisciplinary-conjunction-candidate-audit-v1.sample.jsonl");
const MANIFEST_OUT = path.join(ROOT, "benchmark/interdisciplinary-conjunction-candidate-audit-v1.manifest.json");
const MANUAL_OUT = path.join(ROOT, "benchmark/interdisciplinary-conjunction-candidate-audit-v1.manual.txt");
const SEED = 20260917;

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

const profiles = {
  conservative: { both: 1, areaOnly: -2, domainOnly: 0, neitherWithAbstract: -1, neitherWithoutAbstract: 0 },
  moderate: { both: 2, areaOnly: -2, domainOnly: 0, neitherWithAbstract: -1, neitherWithoutAbstract: 0 }
};

function adjustment(profile, evidence) {
  if (evidence.bucket === "both") return profile.both;
  if (evidence.bucket === "area-only") return profile.areaOnly;
  if (evidence.bucket === "domain-only") return profile.domainOnly;
  return evidence.hasAbstract ? profile.neitherWithAbstract : profile.neitherWithoutAbstract;
}

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, seed) {
  const out = [...items];
  const random = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

for (const file of [RUN, PRIOR_MANIFEST, PRIOR_JUDGMENTS, QUERIES, MAP]) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${path.relative(ROOT, file)}`);
}

const run = readJsonl(RUN);
const priorManifest = JSON.parse(fs.readFileSync(PRIOR_MANIFEST, "utf8"));
const priorJudgments = readJsonl(PRIOR_JUDGMENTS);
const validation = JSON.parse(fs.readFileSync(QUERIES, "utf8"));
const philosophyMap = JSON.parse(fs.readFileSync(MAP, "utf8"));
const queryMap = new Map(validation.queries.map(q => [q.id, q]));
const parsedMap = new Map(validation.queries.map(q => [q.id, parseQuery(q.query, philosophyMap)]));

const priorJudgmentByAudit = new Map(priorJudgments.map(j => [j.audit_id, j]));
const priorByPair = new Map();
for (const item of priorManifest.items || []) {
  const judgment = priorJudgmentByAudit.get(item.audit_id);
  if (!judgment) continue;
  priorByPair.set(`${item.query_id}\u0000${item.record_id}`, {
    audit_id: item.audit_id,
    human_relevance: Number(judgment.human_relevance),
    human_note: String(judgment.human_note || "")
  });
}

const candidates = new Map();
const perProfileCounts = {};

for (const [profileId, profile] of Object.entries(profiles)) {
  let changedPairsTotal = 0;
  let queriesChanged = 0;

  for (const query of validation.queries) {
    const parsed = parsedMap.get(query.id);
    const pool = run.filter(row => row.query_id === query.id && row.condition === "B");
    if (pool.length < 10) throw new Error(`${query.id}: incomplete B pool`);

    const baselineTopRows = pool.filter(row => Number(row.rank) <= 10).sort((a, b) => Number(a.rank) - Number(b.rank));
    const baselineTop = new Map(baselineTopRows.map(row => [row.record_id, row]));

    const rescored = pool.map(row => {
      const evidence = evidenceFor(row, parsed);
      const adjustedScore = Number(row.score ?? row.ranking?.baseScore ?? 0) + adjustment(profile, evidence);
      return { row, evidence, adjustedScore };
    }).sort((a, b) => b.adjustedScore - a.adjustedScore || Number(a.row.rank) - Number(b.row.rank));

    const profileTopRows = rescored.slice(0, 10);
    const profileTop = new Map(profileTopRows.map(item => [item.row.record_id, item]));

    const baselineOnly = baselineTopRows.filter(row => !profileTop.has(row.record_id));
    const profileOnly = profileTopRows.filter(item => !baselineTop.has(item.row.record_id));
    const changedPairs = baselineOnly.length + profileOnly.length;
    if (!changedPairs) continue;

    queriesChanged++;
    changedPairsTotal += changedPairs;

    for (const row of baselineOnly) {
      const key = `${query.id}\u0000${row.record_id}`;
      if (!candidates.has(key)) candidates.set(key, { query, row, memberships: {} });
      candidates.get(key).memberships[profileId] = {
        side: "baseline-only",
        baseline_rank: Number(row.rank),
        profile_rank: null,
        adjusted_score: null
      };
    }

    for (let i = 0; i < profileOnly.length; i++) {
      const item = profileOnly[i];
      const key = `${query.id}\u0000${item.row.record_id}`;
      if (!candidates.has(key)) candidates.set(key, { query, row: item.row, memberships: {} });
      const rank = profileTopRows.findIndex(x => x.row.record_id === item.row.record_id) + 1;
      candidates.get(key).memberships[profileId] = {
        side: "profile-only",
        baseline_rank: Number(item.row.rank),
        profile_rank: rank,
        adjusted_score: item.adjustedScore
      };
    }
  }

  perProfileCounts[profileId] = { queriesChanged, changedPairs: changedPairsTotal };
}

const allCandidates = [...candidates.values()].map(item => {
  const prior = priorByPair.get(`${item.query.id}\u0000${item.row.record_id}`) || null;
  return {
    query_id: item.query.id,
    query: item.query.query,
    language: item.query.language,
    family: item.query.family,
    record_id: item.row.record_id,
    title: item.row.title || "",
    authors: item.row.authors || [],
    year: item.row.year ?? null,
    type: item.row.type || null,
    document_language: item.row.language || null,
    journal: item.row.journal || null,
    publisher: item.row.publisher || null,
    abstract: item.row.abstract || null,
    memberships: item.memberships,
    prior_human: prior
  };
});

const unresolved = shuffle(allCandidates.filter(item => !item.prior_human), SEED);
const sample = unresolved.map((item, index) => ({
  audit_id: `HCJ${String(index + 1).padStart(3, "0")}`,
  query_id: item.query_id,
  query: item.query,
  record_id: item.record_id,
  title: item.title,
  authors: item.authors,
  year: item.year,
  type: item.type,
  document_language: item.document_language,
  journal: item.journal,
  publisher: item.publisher,
  abstract: item.abstract
}));

const sampleIdByPair = new Map(sample.map(row => [`${row.query_id}\u0000${row.record_id}`, row.audit_id]));
const manifest = {
  schemaVersion: 1,
  name: "Interdisciplinary conjunction candidate blind development audit v1",
  seed: SEED,
  methodology: "Blind development audit of every query-document pair whose Top-10 membership differs between the frozen B ranking and either the conservative or moderate conjunction profile. Existing human judgments are reused only for the identical query-document pair. Public unresolved sample hides baseline/profile side, rank, score, evidence bucket, and profile membership.",
  warning: "Development/tuning data only. Do not use this audit as independent validation of the eventual conjunction change.",
  profiles,
  perProfileCounts,
  candidatePairsUnion: allCandidates.length,
  priorHumanReused: allCandidates.filter(x => x.prior_human).length,
  unresolved: unresolved.length,
  items: allCandidates.map(item => ({
    query_id: item.query_id,
    language: item.language,
    family: item.family,
    record_id: item.record_id,
    memberships: item.memberships,
    prior_human: item.prior_human,
    audit_id: item.prior_human ? null : sampleIdByPair.get(`${item.query_id}\u0000${item.record_id}`)
  }))
};

fs.writeFileSync(SAMPLE_OUT, sample.map(row => JSON.stringify(row)).join("\n") + (sample.length ? "\n" : ""), "utf8");
fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2) + "\n", "utf8");

function val(v, fallback = "No disponible.") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function authorText(authors) {
  if (!Array.isArray(authors) || !authors.length) return "No disponibles.";
  return authors.join(", ");
}

const blocks = sample.map(row => `============================================================\n${row.audit_id}\n============================================================\n\nConsulta:\n${val(row.query)}\n\nTítulo:\n${val(row.title)}\n\nAutores:\n${authorText(row.authors)}\n\nAño:\n${val(row.year)}\n\nTipo:\n${val(row.type)}\n\nIdioma del documento:\n${val(row.document_language)}\n\nRevista:\n${val(row.journal)}\n\nEditorial:\n${val(row.publisher)}\n\nResumen / abstract:\n${row.abstract ? String(row.abstract).trim() : "Abstract no disponible."}\n\n\n## ¿Qué tan relevante es este documento para la consulta?\n\n0 · No relevante\nNo aborda sustantivamente la consulta; es ruido o falso positivo.\n\n1 · Relacionado / tangencial\nEl tema está relacionado, pero el filósofo, obra, concepto o problema consultado es periférico.\n\n2 · Relevante\nAborda sustantivamente el objeto consultado como una parte importante del documento.\n\n3 · Central\nEstá específicamente centrado y directamente dedicado al objeto de la consulta.\n\nRespuesta:\n[0 / 1 / 2 / 3]\n\nNota opcional — puede usarla para justificar el juicio:\n[Escriba aquí o déjelo vacío]\n`).join("\n");

const header = `AUDITORÍA CIEGA DE CANDIDATOS · CONJUNCIÓN INTERDISCIPLINARIA V1\n\nPares candidatos únicos: ${allCandidates.length}\nJuicios humanos previos reutilizados: ${manifest.priorHumanReused}\nPendientes manuales: ${sample.length}\n\nIMPORTANTE:\nEste archivo oculta si el documento entra o sale, su rango, score, bucket de evidencia y el perfil que lo cambió. Es exclusivamente desarrollo/tuning.\n\n`;
fs.writeFileSync(MANUAL_OUT, header + blocks + "\n", "utf8");

console.log("INTERDISCIPLINARY CONJUNCTION CANDIDATE AUDIT BUILD: PASS");
console.log(`candidate_pairs_union=${allCandidates.length}`);
console.log(`prior_human_reused=${manifest.priorHumanReused}`);
console.log(`unresolved=${sample.length}`);
for (const [id, counts] of Object.entries(perProfileCounts)) {
  console.log(`${id}: queries_changed=${counts.queriesChanged} changed_pairs=${counts.changedPairs}`);
}
console.log(`sample=${path.relative(ROOT, SAMPLE_OUT)}`);
console.log(`manifest=${path.relative(ROOT, MANIFEST_OUT)}`);
console.log(`manual=${path.relative(ROOT, MANUAL_OUT)}`);

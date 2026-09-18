import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sha256Text } from '../core/hashing.mjs';
import { readJsonl } from '../core/jsonl.mjs';

const MANIFEST_PATH = 'benchmark/qwen3/ranking/audit/qwen3-ranking-v1-delta-audit.manifest.json';
const SAMPLE_PATH = 'benchmark/qwen3/ranking/audit/qwen3-ranking-v1-delta-audit.sample.jsonl';
const JUDGMENTS_PATH = 'benchmark/qwen3/ranking/audit/qwen3-ranking-v1-delta-audit.judgments.jsonl';
const JUDGMENTS_META_PATH = 'benchmark/qwen3/ranking/audit/qwen3-ranking-v1-delta-audit.judgments.meta.json';

const REPORT_PATH = 'benchmark/qwen3/ranking/reports/qwen3-ranking-v1-human-delta.json';
const REPORT_MD_PATH = 'benchmark/qwen3/ranking/reports/qwen3-ranking-v1-human-delta.md';

const AUDIT_FREEZE_COMMIT = '800f938';
const JUDGMENTS_FREEZE_COMMIT = '5987766';
const AB_SHA256 = '739a21abc41d34f8274a9be693e5d80b38845665d376a169c7f90214ff9c66d4';
const SAMPLE_SHA256 = '11fe8e4f5ee4ffbe64cbfa4a2b4346955c75fe136618539c08c3f6f347aa9068';
const JUDGMENTS_SHA256 = '59a0d3e67677df21f298f184d939530120cdc5778862d936f711b8062eb03cd1';
const JUDGMENTS_META_SHA256 = 'af12c4d47da6e80bab77464d8937a5d4e2bd40681484e34fa7877ca0cb7e7861';

const EXPECTED_AUDIT_ROWS = 352;
const EXPECTED_SIDE_ROWS = 176;
const EXPECTED_QUERIES = 50;
const TOP_K = 10;
const RELEVANT_THRESHOLD = 2;

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function sum(rows, fn) {
  return rows.reduce((total, row) => total + fn(row), 0);
}

function relevant(row) {
  return Number(row.human_relevance) >= RELEVANT_THRESHOLD ? 1 : 0;
}

function groupSummary(queryRows, field) {
  const groups = new Map();
  for (const row of queryRows) {
    const key = row[field] ?? 'unknown';
    if (!groups.has(key)) {
      groups.set(key, {
        queries: 0,
        net_relevant_gain: 0,
        delta_p10_sum: 0,
        improved_queries: 0,
        worsened_queries: 0,
        tied_queries: 0,
      });
    }
    const group = groups.get(key);
    group.queries += 1;
    group.net_relevant_gain += row.delta_relevant;
    group.delta_p10_sum += row.delta_p10;
    if (row.delta_relevant > 0) group.improved_queries += 1;
    else if (row.delta_relevant < 0) group.worsened_queries += 1;
    else group.tied_queries += 1;
  }

  return Object.fromEntries(
    [...groups.entries()].map(([key, group]) => [
      key,
      {
        queries: group.queries,
        net_relevant_gain: group.net_relevant_gain,
        mean_delta_p10: round(group.delta_p10_sum / group.queries),
        improved_queries: group.improved_queries,
        worsened_queries: group.worsened_queries,
        tied_queries: group.tied_queries,
      },
    ]),
  );
}

function renderMarkdown(report) {
  const lines = [
    '# Qwen3 ranking v1 — human Top-10 delta',
    '',
    '> Development-only human audit on the complete A/B Top-10 symmetric difference. The audit was frozen before A/B provenance was joined back to the judgments.',
    '',
    '## Exact Top-10 effect',
    '',
    `- A-only relevant: ${report.overall.a_only_relevant}/${report.overall.a_only_rows}`,
    `- B-only relevant: ${report.overall.b_only_relevant}/${report.overall.b_only_rows}`,
    `- Net relevant gain in B: +${report.overall.net_relevant_gain}`,
    `- Exact ΔP@10 (B − A): +${report.overall.delta_p10.toFixed(3)}`,
    `- Queries improved / worsened / tied: ${report.overall.improved_queries} / ${report.overall.worsened_queries} / ${report.overall.tied_queries}`,
    `- Ordinal relevance total, A-only → B-only: ${report.overall.a_only_ordinal} → ${report.overall.b_only_ordinal} (Δ +${report.overall.net_ordinal_gain})`,
    '',
    'The absolute human P@10 of A and B is not identified by this delta audit because the 324 shared Top-10 query-document slots were deliberately not adjudicated. Shared slots cancel exactly in B − A, so ΔP@10 is exact.',
    '',
    '## By language',
    '',
    '| Language | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(report.by_language).map(([key, value]) =>
      `| ${key} | ${value.queries} | ${value.net_relevant_gain >= 0 ? '+' : ''}${value.net_relevant_gain} | ${value.mean_delta_p10 >= 0 ? '+' : ''}${value.mean_delta_p10.toFixed(3)} | ${value.improved_queries} | ${value.worsened_queries} | ${value.tied_queries} |`),
    '',
    '## By intent',
    '',
    '| Intent | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(report.by_intent).map(([key, value]) =>
      `| ${key} | ${value.queries} | ${value.net_relevant_gain >= 0 ? '+' : ''}${value.net_relevant_gain} | ${value.mean_delta_p10 >= 0 ? '+' : ''}${value.mean_delta_p10.toFixed(3)} | ${value.improved_queries} | ${value.worsened_queries} | ${value.tied_queries} |`),
    '',
    '## By family',
    '',
    '| Family | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(report.by_family).map(([key, value]) =>
      `| ${key} | ${value.queries} | ${value.net_relevant_gain >= 0 ? '+' : ''}${value.net_relevant_gain} | ${value.mean_delta_p10 >= 0 ? '+' : ''}${value.mean_delta_p10.toFixed(3)} | ${value.improved_queries} | ${value.worsened_queries} | ${value.tied_queries} |`),
    '',
    '## Interpretation boundary',
    '',
    '- These 50 queries are ranking-development queries, not a new independent end-to-end validation set.',
    '- The result evaluates pure Qwen raw-score reranking of the same frozen production Top-20 pool.',
    '- No threshold, score blending, retrieval expansion, or new candidate membership is involved.',
    '- A fresh query validation is still required before treating this as an end-to-end production validation result.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export async function analyzeRankingHumanDelta() {
  const [
    manifestText,
    { text: sampleText, records: sampleRows },
    { text: judgmentsText, records: judgmentRows },
    judgmentsMetaText,
  ] = await Promise.all([
    readFile(resolve(MANIFEST_PATH), 'utf8'),
    readJsonl(resolve(SAMPLE_PATH)),
    readJsonl(resolve(JUDGMENTS_PATH)),
    readFile(resolve(JUDGMENTS_META_PATH), 'utf8'),
  ]);

  if (sha256Text(sampleText) !== SAMPLE_SHA256) throw new Error('blind audit sample SHA mismatch');
  if (sha256Text(judgmentsText) !== JUDGMENTS_SHA256) throw new Error('human judgments SHA mismatch');
  if (sha256Text(judgmentsMetaText) !== JUDGMENTS_META_SHA256) throw new Error('human judgments metadata SHA mismatch');

  const manifest = JSON.parse(manifestText);
  const judgmentsMeta = JSON.parse(judgmentsMetaText);

  if (manifest.ab_run_sha256 !== AB_SHA256) throw new Error('manifest A/B SHA mismatch');
  if (manifest.sample_sha256 !== SAMPLE_SHA256) throw new Error('manifest sample SHA mismatch');
  if (manifest.audit_rows !== EXPECTED_AUDIT_ROWS) throw new Error('manifest audit row count mismatch');
  if (manifest.relevant_threshold !== RELEVANT_THRESHOLD) throw new Error('manifest relevance threshold mismatch');

  if (judgmentsMeta.row_count !== EXPECTED_AUDIT_ROWS) throw new Error('judgment metadata row count mismatch');
  if (judgmentsMeta.relevant_threshold !== RELEVANT_THRESHOLD) throw new Error('judgment metadata relevance threshold mismatch');
  if (judgmentsMeta.judgments_sha256 !== JUDGMENTS_SHA256) throw new Error('judgment metadata SHA pointer mismatch');
  if (judgmentsMeta.contains_ab_condition !== false) throw new Error('judgments unexpectedly contain A/B condition');
  if (judgmentsMeta.contains_rank !== false) throw new Error('judgments unexpectedly contain ranks');
  if (judgmentsMeta.contains_qwen_score !== false) throw new Error('judgments unexpectedly contain Qwen scores');

  if (sampleRows.length !== EXPECTED_AUDIT_ROWS) throw new Error('sample row count mismatch');
  if (judgmentRows.length !== EXPECTED_AUDIT_ROWS) throw new Error('judgment row count mismatch');
  if (!Array.isArray(manifest.items) || manifest.items.length !== EXPECTED_AUDIT_ROWS) throw new Error('manifest item count mismatch');

  const sampleById = new Map(sampleRows.map((row) => [row.audit_id, row]));
  const judgmentById = new Map();
  for (const row of judgmentRows) {
    if (judgmentById.has(row.audit_id)) throw new Error(`duplicate judgment ${row.audit_id}`);
    if (![0, 1, 2, 3].includes(Number(row.human_relevance))) throw new Error(`invalid judgment ${row.audit_id}`);
    judgmentById.set(row.audit_id, row);
  }

  const joined = manifest.items.map((item) => {
    const sample = sampleById.get(item.audit_id);
    const judgment = judgmentById.get(item.audit_id);
    if (!sample) throw new Error(`missing sample row ${item.audit_id}`);
    if (!judgment) throw new Error(`missing judgment row ${item.audit_id}`);
    return { ...item, ...sample, ...judgment };
  });

  const aOnly = joined.filter((row) => row.selection_side === 'A-only');
  const bOnly = joined.filter((row) => row.selection_side === 'B-only');
  if (aOnly.length !== EXPECTED_SIDE_ROWS || bOnly.length !== EXPECTED_SIDE_ROWS) {
    throw new Error(`unexpected A/B side counts: ${aOnly.length}/${bOnly.length}`);
  }

  const perQueryMap = new Map();
  for (const row of joined) {
    if (!perQueryMap.has(row.query_id)) perQueryMap.set(row.query_id, { A: [], B: [], meta: row });
    const group = perQueryMap.get(row.query_id);
    group[row.selection_side === 'A-only' ? 'A' : 'B'].push(row);
  }
  if (perQueryMap.size !== EXPECTED_QUERIES) throw new Error(`expected ${EXPECTED_QUERIES} queries`);

  const perQuery = [...perQueryMap.entries()].map(([queryId, group]) => {
    if (group.A.length !== group.B.length) throw new Error(`${queryId}: asymmetric changed Top-10 membership`);
    const aRelevant = sum(group.A, relevant);
    const bRelevant = sum(group.B, relevant);
    const aOrdinal = sum(group.A, (row) => Number(row.human_relevance));
    const bOrdinal = sum(group.B, (row) => Number(row.human_relevance));
    return {
      query_id: queryId,
      query: group.meta.query,
      query_language: group.meta.query_language,
      intent: group.meta.intent,
      family: group.meta.family,
      changed_each_side: group.A.length,
      a_only_relevant: aRelevant,
      b_only_relevant: bRelevant,
      delta_relevant: bRelevant - aRelevant,
      delta_p10: round((bRelevant - aRelevant) / TOP_K),
      a_only_ordinal: aOrdinal,
      b_only_ordinal: bOrdinal,
      delta_ordinal: bOrdinal - aOrdinal,
    };
  }).sort((left, right) => left.query_id.localeCompare(right.query_id));

  const aRelevant = sum(aOnly, relevant);
  const bRelevant = sum(bOnly, relevant);
  const netRelevant = bRelevant - aRelevant;
  const sharedTop10Slots = EXPECTED_QUERIES * TOP_K - EXPECTED_SIDE_ROWS;

  const report = {
    schema_version: 'qwen3-ranking-human-delta-report-v1',
    ranking_experiment_id: 'qwen3-ranking-v1',
    purpose: 'development-human-top10-delta-evaluation',
    relevant_threshold: RELEVANT_THRESHOLD,
    top_k: TOP_K,
    exact_delta_only: true,
    absolute_p10_identified: false,
    reason_absolute_p10_not_identified: 'The blind audit adjudicated only the A/B Top-10 symmetric difference; shared Top-10 slots were not adjudicated.',
    freezes: {
      audit_sample_commit: AUDIT_FREEZE_COMMIT,
      human_judgments_commit: JUDGMENTS_FREEZE_COMMIT,
      ab_sha256: AB_SHA256,
      sample_sha256: SAMPLE_SHA256,
      judgments_sha256: JUDGMENTS_SHA256,
      judgments_metadata_sha256: JUDGMENTS_META_SHA256,
    },
    overall: {
      queries: EXPECTED_QUERIES,
      top10_slots_per_condition: EXPECTED_QUERIES * TOP_K,
      shared_top10_slots: sharedTop10Slots,
      changed_top10_pairs: EXPECTED_AUDIT_ROWS,
      a_only_rows: aOnly.length,
      b_only_rows: bOnly.length,
      a_only_relevant: aRelevant,
      b_only_relevant: bRelevant,
      net_relevant_gain: netRelevant,
      delta_p10: round(netRelevant / (EXPECTED_QUERIES * TOP_K)),
      improved_queries: perQuery.filter((row) => row.delta_relevant > 0).length,
      worsened_queries: perQuery.filter((row) => row.delta_relevant < 0).length,
      tied_queries: perQuery.filter((row) => row.delta_relevant === 0).length,
      a_only_ordinal: sum(aOnly, (row) => Number(row.human_relevance)),
      b_only_ordinal: sum(bOnly, (row) => Number(row.human_relevance)),
      net_ordinal_gain: sum(bOnly, (row) => Number(row.human_relevance)) - sum(aOnly, (row) => Number(row.human_relevance)),
    },
    by_language: groupSummary(perQuery, 'query_language'),
    by_intent: groupSummary(perQuery, 'intent'),
    by_family: groupSummary(perQuery, 'family'),
    strongest_improvements: [...perQuery]
      .sort((left, right) => right.delta_relevant - left.delta_relevant || right.delta_ordinal - left.delta_ordinal)
      .slice(0, 10),
    strongest_regressions: [...perQuery]
      .sort((left, right) => left.delta_relevant - right.delta_relevant || left.delta_ordinal - right.delta_ordinal)
      .slice(0, 10),
    per_query: perQuery,
    methodology: {
      human_audit_blind_to_ab_before_freeze: true,
      human_judgments_used_by_qwen: false,
      qwen_used_as_relevance_judge: false,
      query_set_role: 'development',
      fresh_independent_end_to_end_validation: false,
    },
  };

  const reportText = `${JSON.stringify(report, null, 2)}\n`;
  const reportMd = renderMarkdown(report);
  await mkdir(dirname(resolve(REPORT_PATH)), { recursive: true });
  await writeFile(resolve(REPORT_PATH), reportText, 'utf8');
  await writeFile(resolve(REPORT_MD_PATH), reportMd, 'utf8');

  return {
    report,
    hashes: {
      json: sha256Text(reportText),
      markdown: sha256Text(reportMd),
    },
  };
}

async function main() {
  const { report, hashes } = await analyzeRankingHumanDelta();
  console.log('Qwen3 ranking human delta analysis complete');
  console.log(`A_only_relevant=${report.overall.a_only_relevant}/${report.overall.a_only_rows}`);
  console.log(`B_only_relevant=${report.overall.b_only_relevant}/${report.overall.b_only_rows}`);
  console.log(`net_relevant_gain=+${report.overall.net_relevant_gain}`);
  console.log(`exact_delta_p10=+${report.overall.delta_p10.toFixed(3)}`);
  console.log(`queries_improved=${report.overall.improved_queries}`);
  console.log(`queries_worsened=${report.overall.worsened_queries}`);
  console.log(`queries_tied=${report.overall.tied_queries}`);
  console.log(`ordinal_delta=+${report.overall.net_ordinal_gain}`);
  console.log('absolute_p10_identified=false');
  console.log(`report_sha256=${hashes.json}`);
  console.log(`markdown_sha256=${hashes.markdown}`);
  console.log(`report=${REPORT_PATH}`);
  console.log(`markdown=${REPORT_MD_PATH}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

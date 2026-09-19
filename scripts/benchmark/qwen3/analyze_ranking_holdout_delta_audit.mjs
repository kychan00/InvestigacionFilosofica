import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sha256Text } from '../core/hashing.mjs';
import { readJsonl } from '../core/jsonl.mjs';

const AB_PATH = 'benchmark/qwen3/ranking/validation/runs/qwen3-ranking-holdout-v1-ab.jsonl';
const AB_META_PATH = 'benchmark/qwen3/ranking/validation/runs/qwen3-ranking-holdout-v1-ab.meta.json';
const SAMPLE_PATH = 'benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.sample.jsonl';
const SAMPLE_META_PATH = 'benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.sample.meta.json';
const JUDGMENTS_PATH = 'benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.judgments.jsonl';
const JUDGMENTS_META_PATH = 'benchmark/qwen3/ranking/validation/audit/qwen3-ranking-holdout-v1-delta-audit.judgments.meta.json';

const REPORT_PATH = 'benchmark/qwen3/ranking/validation/reports/qwen3-ranking-holdout-v1-human-delta.json';
const REPORT_MD_PATH = 'benchmark/qwen3/ranking/validation/reports/qwen3-ranking-holdout-v1-human-delta.md';

const AB_FREEZE_COMMIT = '10afea1';
const SAMPLE_FREEZE_COMMIT = '0ffceb0';
const JUDGMENTS_FREEZE_COMMIT = '18479e5';

const AB_SHA256 = '6682bf7c19cd9acc77a589483977478857493e0a7f81ce1c086c83ce6c8851aa';
const AB_META_SHA256 = 'd4413cf9a87b0e2b4fc7a5b7fd28ea922509b851f75c34c45714d4d319ba6fe2';
const SAMPLE_SHA256 = '2981bcd4c48e59a40492d13163e9cc0a1f92e960aa7bd82bcda00f60250fc033';
const SAMPLE_META_SHA256 = 'ae546efc00fe76779f22e47768b57a53d3cce6c8d2181308c20719cf926e951d';
const JUDGMENTS_SHA256 = 'bb1a44f71605b5415a2b9a47a111d6557c32f6f77c399613bc7afb87a5ba26a1';
const JUDGMENTS_META_SHA256 = '9a99a82d96eac66ec1d102a714833cd4e0011e210d580af17e4a9582302250f0';

const AUDIT_VERSION = 'qwen3-ranking-holdout-v1-delta-audit-v1';
const AUDIT_ID_PREFIX = 'QRH';
const EXPECTED_AUDIT_ROWS = 160;
const EXPECTED_SIDE_ROWS = 80;
const EXPECTED_QUERIES = 25;
const EXPECTED_CHANGED_QUERIES = 24;
const POOL_DEPTH = 20;
const TOP_K = 10;
const RELEVANT_THRESHOLD = 2;

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function signed(value, digits = null) {
  const rendered = digits === null ? String(value) : Number(value).toFixed(digits);
  return value > 0 ? `+${rendered}` : rendered;
}

function sum(rows, fn) {
  return rows.reduce((total, row) => total + fn(row), 0);
}

function relevant(row) {
  return Number(row.human_relevance) >= RELEVANT_THRESHOLD ? 1 : 0;
}

function key(queryId, recordId) {
  return `${queryId}\u0000${recordId}`;
}

function blindOrderKey(queryId, recordId) {
  return sha256Text(`${AUDIT_VERSION}\u0000${queryId}\u0000${recordId}`);
}

function cleanNullableString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function cleanAuthors(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((author) => typeof author === 'string')
    .map((author) => author.trim())
    .filter(Boolean);
}

function publicRow(auditId, row) {
  return {
    audit_id: auditId,
    query: String(row.query || '').trim(),
    query_language: cleanNullableString(row.query_language),
    family: cleanNullableString(row.family),
    intent: cleanNullableString(row.intent),
    title: String(row.title || '').trim(),
    authors: cleanAuthors(row.authors),
    year: Number.isInteger(row.year) ? row.year : null,
    type: cleanNullableString(row.type),
    document_language: cleanNullableString(row.language),
    journal: cleanNullableString(row.journal),
    publisher: cleanNullableString(row.publisher),
    abstract: cleanNullableString(row.abstract),
    human_relevance: null,
    human_note: '',
  };
}

function stablePublicEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function groupSummary(queryRows, field) {
  const groups = new Map();
  for (const row of queryRows) {
    const groupKey = row[field] ?? 'unknown';
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        queries: 0,
        net_relevant_gain: 0,
        delta_p10_sum: 0,
        improved_queries: 0,
        worsened_queries: 0,
        tied_queries: 0,
      });
    }

    const group = groups.get(groupKey);
    group.queries += 1;
    group.net_relevant_gain += row.delta_relevant;
    group.delta_p10_sum += row.delta_p10;
    if (row.delta_relevant > 0) group.improved_queries += 1;
    else if (row.delta_relevant < 0) group.worsened_queries += 1;
    else group.tied_queries += 1;
  }

  return Object.fromEntries(
    [...groups.entries()].map(([groupKey, group]) => [
      groupKey,
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

function renderBreakdown(title, values) {
  return [
    `## ${title}`,
    '',
    '| Group | Queries | Net relevant | Mean ΔP@10 | Improved | Worse | Tied |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(values).map(([groupKey, value]) =>
      `| ${groupKey} | ${value.queries} | ${signed(value.net_relevant_gain)} | ${signed(value.mean_delta_p10, 3)} | ${value.improved_queries} | ${value.worsened_queries} | ${value.tied_queries} |`),
    '',
  ];
}

function renderMarkdown(report) {
  return [
    '# Qwen3 ranking holdout v1 — human Top-10 delta',
    '',
    '> Fresh internal validation on 25 preregistered multilingual queries. Human judgments were frozen while A/B identity remained hidden; the A/B mapping was reconstructed deterministically only for this analysis.',
    '',
    '## Exact Top-10 effect',
    '',
    `- A-only relevant: ${report.overall.a_only_relevant}/${report.overall.a_only_rows}`,
    `- B-only relevant: ${report.overall.b_only_relevant}/${report.overall.b_only_rows}`,
    `- Net relevant gain in B: ${signed(report.overall.net_relevant_gain)}`,
    `- Exact ΔP@10 (B − A): ${signed(report.overall.delta_p10, 3)}`,
    `- Queries improved / worsened / tied: ${report.overall.improved_queries} / ${report.overall.worsened_queries} / ${report.overall.tied_queries}`,
    `- Ordinal relevance total, A-only → B-only: ${report.overall.a_only_ordinal} → ${report.overall.b_only_ordinal} (Δ ${signed(report.overall.net_ordinal_gain)})`,
    '',
    `Absolute human P@10 is not identified because the ${report.overall.shared_top10_slots} shared Top-10 query-document slots were deliberately not adjudicated. Those shared slots cancel exactly in B − A, so ΔP@10 is exact.`,
    '',
    ...renderBreakdown('By language', report.by_language),
    ...renderBreakdown('By intent', report.by_intent),
    ...renderBreakdown('By family', report.by_family),
    '## Interpretation boundary',
    '',
    '- This is a fresh internal validation set, distinct from the 50 ranking-development queries and the earlier classifier holdout.',
    '- It evaluates pure Qwen raw-score reranking of the same frozen production Top-20 candidate pool for each query.',
    '- No threshold, score blending, retrieval expansion, candidate-pool change, or holdout-label tuning is involved.',
    '- The result is not external independent validation.',
    '- Absolute P@10, P@5, MRR, and nDCG are not identified by this symmetric-difference audit.',
    '',
  ].join('\n') + '\n';
}

function reconstructAuditMapping(abRows) {
  const byQuery = new Map();
  for (const row of abRows) {
    if (!byQuery.has(row.query_id)) byQuery.set(row.query_id, { A: [], B: [] });
    const group = byQuery.get(row.query_id);
    if (!group[row.condition]) throw new Error(`unknown A/B condition: ${row.condition}`);
    group[row.condition].push(row);
  }

  if (byQuery.size !== EXPECTED_QUERIES) {
    throw new Error(`expected ${EXPECTED_QUERIES} queries, got ${byQuery.size}`);
  }

  const changed = [];
  for (const [queryId, conditions] of byQuery) {
    const a = [...conditions.A].sort((left, right) => Number(left.rank) - Number(right.rank));
    const b = [...conditions.B].sort((left, right) => Number(left.rank) - Number(right.rank));
    if (a.length !== POOL_DEPTH || b.length !== POOL_DEPTH) {
      throw new Error(`${queryId}: incomplete A/B pool`);
    }

    const aById = new Map(a.map((row) => [row.record_id, row]));
    const bById = new Map(b.map((row) => [row.record_id, row]));
    if (aById.size !== POOL_DEPTH || bById.size !== POOL_DEPTH) {
      throw new Error(`${queryId}: duplicate A/B records`);
    }
    for (const recordId of aById.keys()) {
      if (!bById.has(recordId)) throw new Error(`${queryId}: A/B pool membership differs`);
    }

    const a10 = a.filter((row) => Number(row.rank) <= TOP_K);
    const b10 = b.filter((row) => Number(row.rank) <= TOP_K);
    const a10Ids = new Set(a10.map((row) => row.record_id));
    const b10Ids = new Set(b10.map((row) => row.record_id));

    for (const row of a10) {
      if (!b10Ids.has(row.record_id)) {
        changed.push({
          query_id: queryId,
          record_id: row.record_id,
          selection_side: 'A-only',
          public_source: row,
        });
      }
    }
    for (const row of b10) {
      if (!a10Ids.has(row.record_id)) {
        changed.push({
          query_id: queryId,
          record_id: row.record_id,
          selection_side: 'B-only',
          public_source: row,
        });
      }
    }
  }

  if (changed.length !== EXPECTED_AUDIT_ROWS) {
    throw new Error(`expected ${EXPECTED_AUDIT_ROWS} changed Top-10 pairs, got ${changed.length}`);
  }

  const pairKeys = new Set(changed.map((item) => key(item.query_id, item.record_id)));
  if (pairKeys.size !== EXPECTED_AUDIT_ROWS) throw new Error('duplicate changed query-document pair');

  const ordered = changed
    .map((item) => ({
      item,
      blind_key: blindOrderKey(item.query_id, item.record_id),
    }))
    .sort((left, right) =>
      left.blind_key.localeCompare(right.blind_key)
      || left.item.query_id.localeCompare(right.item.query_id)
      || left.item.record_id.localeCompare(right.item.record_id));

  return ordered.map(({ item }, index) => ({
    audit_id: `${AUDIT_ID_PREFIX}${String(index + 1).padStart(3, '0')}`,
    ...item,
  }));
}

export async function analyzeRankingHoldoutHumanDelta() {
  const [
    { text: abText, records: abRows },
    abMetaText,
    { text: sampleText, records: sampleRows },
    sampleMetaText,
    { text: judgmentsText, records: judgmentRows },
    judgmentsMetaText,
  ] = await Promise.all([
    readJsonl(resolve(AB_PATH)),
    readFile(resolve(AB_META_PATH), 'utf8'),
    readJsonl(resolve(SAMPLE_PATH)),
    readFile(resolve(SAMPLE_META_PATH), 'utf8'),
    readJsonl(resolve(JUDGMENTS_PATH)),
    readFile(resolve(JUDGMENTS_META_PATH), 'utf8'),
  ]);

  if (sha256Text(abText) !== AB_SHA256) throw new Error('A/B SHA mismatch');
  if (sha256Text(abMetaText) !== AB_META_SHA256) throw new Error('A/B metadata SHA mismatch');
  if (sha256Text(sampleText) !== SAMPLE_SHA256) throw new Error('blind sample SHA mismatch');
  if (sha256Text(sampleMetaText) !== SAMPLE_META_SHA256) throw new Error('blind sample metadata SHA mismatch');
  if (sha256Text(judgmentsText) !== JUDGMENTS_SHA256) throw new Error('human judgments SHA mismatch');
  if (sha256Text(judgmentsMetaText) !== JUDGMENTS_META_SHA256) throw new Error('human judgments metadata SHA mismatch');

  const abMeta = JSON.parse(abMetaText);
  const sampleMeta = JSON.parse(sampleMetaText);
  const judgmentsMeta = JSON.parse(judgmentsMetaText);

  if (abMeta.same_pool_per_condition !== true) throw new Error('A/B did not preserve the same candidate pool');
  if (abMeta.human_labels_used !== false) throw new Error('A/B unexpectedly used human labels');
  if (sampleMeta.private_mapping_artifact_written !== false) throw new Error('blind sample metadata indicates a private mapping existed');
  if (sampleMeta.row_count !== EXPECTED_AUDIT_ROWS) throw new Error('sample metadata row count mismatch');
  if (sampleMeta.relevant_threshold !== RELEVANT_THRESHOLD) throw new Error('sample relevance threshold mismatch');

  if (judgmentsMeta.row_count !== EXPECTED_AUDIT_ROWS) throw new Error('judgment metadata row count mismatch');
  if (judgmentsMeta.relevant_threshold !== RELEVANT_THRESHOLD) throw new Error('judgment relevance threshold mismatch');
  if (judgmentsMeta.judgments_sha256 !== JUDGMENTS_SHA256) throw new Error('judgment metadata SHA pointer mismatch');
  for (const field of [
    'contains_ab_condition',
    'contains_rank',
    'contains_qwen_score',
    'contains_query_id',
    'contains_record_id',
    'contains_provider_provenance',
  ]) {
    if (judgmentsMeta[field] !== false) throw new Error(`judgments unexpectedly expose ${field}`);
  }

  if (sampleRows.length !== EXPECTED_AUDIT_ROWS) throw new Error('sample row count mismatch');
  if (judgmentRows.length !== EXPECTED_AUDIT_ROWS) throw new Error('judgment row count mismatch');

  const reconstructed = reconstructAuditMapping(abRows);
  const sampleById = new Map(sampleRows.map((row) => [row.audit_id, row]));
  const judgmentById = new Map();

  for (const row of judgmentRows) {
    if (judgmentById.has(row.audit_id)) throw new Error(`duplicate judgment ${row.audit_id}`);
    if (![0, 1, 2, 3].includes(Number(row.human_relevance))) {
      throw new Error(`invalid human relevance for ${row.audit_id}`);
    }
    judgmentById.set(row.audit_id, row);
  }

  const joined = reconstructed.map((item) => {
    const sample = sampleById.get(item.audit_id);
    const judgment = judgmentById.get(item.audit_id);
    if (!sample) throw new Error(`missing blind sample row ${item.audit_id}`);
    if (!judgment) throw new Error(`missing human judgment ${item.audit_id}`);

    const expectedPublic = publicRow(item.audit_id, item.public_source);
    if (!stablePublicEqual(sample, expectedPublic)) {
      throw new Error(`reconstructed mapping does not reproduce frozen public row ${item.audit_id}`);
    }

    return {
      audit_id: item.audit_id,
      query_id: item.query_id,
      record_id: item.record_id,
      selection_side: item.selection_side,
      query: sample.query,
      query_language: sample.query_language,
      family: sample.family,
      intent: sample.intent,
      human_relevance: Number(judgment.human_relevance),
      human_note: judgment.human_note || '',
    };
  });

  const aOnly = joined.filter((row) => row.selection_side === 'A-only');
  const bOnly = joined.filter((row) => row.selection_side === 'B-only');
  if (aOnly.length !== EXPECTED_SIDE_ROWS || bOnly.length !== EXPECTED_SIDE_ROWS) {
    throw new Error(`unexpected A/B side counts: ${aOnly.length}/${bOnly.length}`);
  }

  const queryMetaById = new Map();
  for (const row of abRows) {
    if (!queryMetaById.has(row.query_id)) {
      queryMetaById.set(row.query_id, {
        query_id: row.query_id,
        query: row.query,
        query_language: row.query_language,
        family: row.family,
        intent: row.intent,
      });
    }
  }
  if (queryMetaById.size !== EXPECTED_QUERIES) {
    throw new Error(`expected ${EXPECTED_QUERIES} total A/B queries`);
  }

  const changedQueryIds = new Set(joined.map((row) => row.query_id));
  if (changedQueryIds.size !== EXPECTED_CHANGED_QUERIES) {
    throw new Error(`expected ${EXPECTED_CHANGED_QUERIES} queries with changed Top-10 membership, got ${changedQueryIds.size}`);
  }

  const perQueryMap = new Map(
    [...queryMetaById.entries()].map(([queryId, meta]) => [
      queryId,
      { A: [], B: [], meta },
    ]),
  );
  for (const row of joined) {
    const group = perQueryMap.get(row.query_id);
    if (!group) throw new Error(`unknown query in reconstructed audit: ${row.query_id}`);
    group[row.selection_side === 'A-only' ? 'A' : 'B'].push(row);
  }

  const perQuery = [...perQueryMap.entries()].map(([queryId, group]) => {
    if (group.A.length !== group.B.length) {
      throw new Error(`${queryId}: asymmetric changed Top-10 membership`);
    }
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
  const aOrdinal = sum(aOnly, (row) => Number(row.human_relevance));
  const bOrdinal = sum(bOnly, (row) => Number(row.human_relevance));
  const sharedTop10Slots = EXPECTED_QUERIES * TOP_K - EXPECTED_SIDE_ROWS;

  const report = {
    schema_version: 'qwen3-ranking-holdout-human-delta-report-v1',
    validation_id: 'qwen3-ranking-holdout-v1',
    purpose: 'fresh-internal-human-top10-delta-validation',
    relevant_threshold: RELEVANT_THRESHOLD,
    top_k: TOP_K,
    exact_delta_only: true,
    exact_human_delta_p10_identified: true,
    absolute_p10_identified: false,
    reason_absolute_p10_not_identified: 'Only the A/B Top-10 symmetric difference was human-adjudicated; shared Top-10 slots were not adjudicated.',
    freezes: {
      ab_commit: AB_FREEZE_COMMIT,
      blind_sample_commit: SAMPLE_FREEZE_COMMIT,
      human_judgments_commit: JUDGMENTS_FREEZE_COMMIT,
      ab_sha256: AB_SHA256,
      ab_metadata_sha256: AB_META_SHA256,
      sample_sha256: SAMPLE_SHA256,
      sample_metadata_sha256: SAMPLE_META_SHA256,
      judgments_sha256: JUDGMENTS_SHA256,
      judgments_metadata_sha256: JUDGMENTS_META_SHA256,
    },
    overall: {
      queries: EXPECTED_QUERIES,
      queries_with_changed_top10: changedQueryIds.size,
      queries_with_unchanged_top10: EXPECTED_QUERIES - changedQueryIds.size,
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
      a_only_ordinal: aOrdinal,
      b_only_ordinal: bOrdinal,
      net_ordinal_gain: bOrdinal - aOrdinal,
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
      fresh_queries_preregistered_before_retrieval: true,
      human_judgments_frozen_before_unblinding: true,
      private_ab_mapping_available_during_adjudication: false,
      mapping_reconstructed_deterministically_after_judgment_freeze: true,
      human_judgments_used_by_qwen: false,
      qwen_used_as_relevance_judge: false,
      threshold_used_for_ranking: false,
      score_blending: false,
      candidate_pool_changed_by_qwen: false,
      holdout_labels_used_for_tuning: false,
      query_set_role: 'fresh-internal-validation',
      fresh_internal_ranking_validation: true,
      external_independent_validation: false,
    },
  };

  const reportText = JSON.stringify(report, null, 2) + '\n';
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
  const { report, hashes } = await analyzeRankingHoldoutHumanDelta();
  console.log('Qwen3 ranking holdout human delta analysis complete');
  console.log(`queries_with_changed_top10=${report.overall.queries_with_changed_top10}`);
  console.log(`queries_with_unchanged_top10=${report.overall.queries_with_unchanged_top10}`);
  console.log(`A_only_relevant=${report.overall.a_only_relevant}/${report.overall.a_only_rows}`);
  console.log(`B_only_relevant=${report.overall.b_only_relevant}/${report.overall.b_only_rows}`);
  console.log(`net_relevant_gain=${signed(report.overall.net_relevant_gain)}`);
  console.log(`exact_delta_p10=${signed(report.overall.delta_p10, 3)}`);
  console.log(`queries_improved=${report.overall.improved_queries}`);
  console.log(`queries_worsened=${report.overall.worsened_queries}`);
  console.log(`queries_tied=${report.overall.tied_queries}`);
  console.log(`ordinal_delta=${signed(report.overall.net_ordinal_gain)}`);
  console.log('absolute_p10_identified=false');
  console.log('fresh_internal_validation=true');
  console.log('external_independent_validation=false');
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

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { readJsonl, serializeJsonl, writeJsonlAtomic } from '../core/jsonl.mjs';

const MANIFEST_PATH = 'benchmark/qwen3/configs/qwen3-reranker-v1-holdout-v1.inference.json';

function sha256Text(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function pairKey(row) {
  return `${row.query_id}\u0000${row.record_id}`;
}

async function writeJson(path, value) {
  const resolved = resolve(path);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function buildHoldoutPredictions(manifestPath = MANIFEST_PATH) {
  const manifest = JSON.parse(await readFile(resolve(manifestPath), 'utf8'));
  const scorePath = resolve(manifest.inference.raw_output);
  const scoreMetaPath = resolve(manifest.inference.raw_metadata);
  const datasetPath = resolve(manifest.dataset.path);

  const [{ text: scoreText, records: scores }, scoreMetaText, { records: dataset }] = await Promise.all([
    readJsonl(scorePath),
    readFile(scoreMetaPath, 'utf8'),
    readJsonl(datasetPath),
  ]);
  const scoreMeta = JSON.parse(scoreMetaText);

  if (scores.length !== manifest.dataset.rows) {
    throw new Error(`holdout score row mismatch: expected ${manifest.dataset.rows}, got ${scores.length}`);
  }
  if (dataset.length !== manifest.dataset.rows) {
    throw new Error(`holdout dataset row mismatch: expected ${manifest.dataset.rows}, got ${dataset.length}`);
  }

  const scoreSha = sha256Text(scoreText);
  if (scoreMeta.output_sha256 !== scoreSha) {
    throw new Error('holdout raw score SHA does not match score metadata');
  }
  if (scoreMeta.dataset_sha256 !== manifest.dataset.sha256) {
    throw new Error('holdout score metadata dataset SHA mismatch');
  }
  if (scoreMeta.instruction_sha256 !== manifest.instruction.sha256) {
    throw new Error('holdout score metadata instruction SHA mismatch');
  }
  if (scoreMeta.revision !== manifest.model.revision) {
    throw new Error('holdout score metadata model revision mismatch');
  }

  const datasetPairs = new Set(dataset.map(pairKey));
  const scorePairs = new Set(scores.map(pairKey));
  if (datasetPairs.size !== manifest.dataset.rows || scorePairs.size !== manifest.dataset.rows) {
    throw new Error('holdout dataset or scores contain duplicate query-document pairs');
  }
  for (const key of datasetPairs) {
    if (!scorePairs.has(key)) throw new Error(`missing holdout score for ${key.replace('\u0000', ' / ')}`);
  }

  const threshold = Number(manifest.prediction.fixed_binary_threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error('invalid frozen holdout threshold');
  }
  if (manifest.prediction.threshold_retuning !== false) {
    throw new Error('holdout prediction manifest permits threshold retuning');
  }

  const byPair = new Map(scores.map((row) => [pairKey(row), row]));
  const predictions = dataset.map((row) => {
    const score = byPair.get(pairKey(row));
    const rawScore = Number(score.raw_score);
    if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 1) {
      throw new Error(`invalid raw score for ${row.query_id} / ${row.record_id}`);
    }
    return {
      schema_version: 'qwen3-holdout-prediction-v1',
      validation_id: manifest.validation_id,
      query_id: row.query_id,
      record_id: row.record_id,
      raw_score: rawScore,
      fixed_threshold: threshold,
      predicted_relevant: rawScore >= threshold,
    };
  });

  const outputText = serializeJsonl(predictions);
  const outputSha = sha256Text(outputText);
  await writeJsonlAtomic(resolve(manifest.prediction.output), predictions);

  const metadata = {
    schema_version: 'qwen3-holdout-prediction-meta-v1',
    validation_id: manifest.validation_id,
    purpose: 'frozen-pre-adjudication-predictions',
    model: manifest.model.name,
    revision: manifest.model.revision,
    instruction_sha256: manifest.instruction.sha256,
    dataset_sha256: manifest.dataset.sha256,
    raw_scores_path: manifest.inference.raw_output,
    raw_scores_sha256: scoreSha,
    fixed_binary_threshold: threshold,
    threshold_source: manifest.prediction.threshold_source,
    threshold_retuning: false,
    row_count: predictions.length,
    output_path: manifest.prediction.output,
    output_sha256: outputSha,
    human_labels_used: false,
    production_ranking_changed: false,
  };
  await writeJson(manifest.prediction.metadata, metadata);

  return { predictions, metadata };
}

async function main() {
  const result = await buildHoldoutPredictions();
  console.log('Qwen3 holdout predictions frozen');
  console.log(`rows=${result.metadata.row_count}`);
  console.log(`fixed_threshold=${result.metadata.fixed_binary_threshold}`);
  console.log(`raw_scores_sha256=${result.metadata.raw_scores_sha256}`);
  console.log(`predictions_sha256=${result.metadata.output_sha256}`);
  console.log(`output=${result.metadata.output_path}`);
  console.log(`meta=${MANIFEST_PATH.replace('configs/qwen3-reranker-v1-holdout-v1.inference.json', 'validation/scores/qwen3-reranker-v1-holdout-v1.predictions.meta.json')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

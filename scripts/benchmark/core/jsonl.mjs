import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function parseJsonlText(text, { source = 'JSONL input' } = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('parseJsonlText expects text');
  }

  const records = [];
  const lines = text.split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === '') continue;

    try {
      records.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`${source}: invalid JSON on line ${index + 1}: ${error.message}`);
    }
  }

  return records;
}

export function serializeJsonl(records) {
  if (!Array.isArray(records)) {
    throw new TypeError('serializeJsonl expects an array');
  }

  return records.length === 0
    ? ''
    : `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}

export async function readJsonl(path) {
  const text = await readFile(path, 'utf8');
  return {
    text,
    records: parseJsonlText(text, { source: path }),
  };
}

export async function writeJsonlAtomic(path, records) {
  const text = serializeJsonl(records);
  await mkdir(dirname(path), { recursive: true });

  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, text, 'utf8');
  await rename(temporaryPath, path);

  return text;
}

import { createHash } from 'node:crypto';

export function sha256Text(value) {
  if (typeof value !== 'string') {
    throw new TypeError('sha256Text expects a string');
  }

  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }

  return value;
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Json(value) {
  return sha256Text(stableJson(value));
}

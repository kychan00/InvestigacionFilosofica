export function binaryMetrics(rows, { labelOf, predictionOf }) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const row of rows) {
    const actual = Boolean(labelOf(row));
    const predicted = Boolean(predictionOf(row));
    if (actual && predicted) tp += 1;
    else if (!actual && predicted) fp += 1;
    else if (!actual && !predicted) tn += 1;
    else fn += 1;
  }

  const n = rows.length;
  const safe = (num, den) => (den === 0 ? null : num / den);
  const precision = safe(tp, tp + fp);
  const recall = safe(tp, tp + fn);
  const specificity = safe(tn, tn + fp);
  const accuracy = safe(tp + tn, n);
  const f1 = precision == null || recall == null || precision + recall === 0
    ? null
    : (2 * precision * recall) / (precision + recall);
  const balancedAccuracy = recall == null || specificity == null
    ? null
    : (recall + specificity) / 2;

  return {
    n,
    positives: tp + fn,
    negatives: tn + fp,
    tp,
    fp,
    tn,
    fn,
    accuracy,
    precision,
    recall,
    specificity,
    f1,
    balanced_accuracy: balancedAccuracy,
  };
}

export function cohenKappaBinary(rows, { labelOf, predictionOf }) {
  if (rows.length === 0) return null;
  const metrics = binaryMetrics(rows, { labelOf, predictionOf });
  const observed = metrics.accuracy;
  const actualPositive = metrics.positives / metrics.n;
  const predictedPositive = (metrics.tp + metrics.fp) / metrics.n;
  const expected = (
    actualPositive * predictedPositive
    + (1 - actualPositive) * (1 - predictedPositive)
  );
  if (expected === 1) return 1;
  return (observed - expected) / (1 - expected);
}

export function rocAuc(rows, { labelOf, scoreOf }) {
  const positives = rows.filter((row) => labelOf(row));
  const negatives = rows.filter((row) => !labelOf(row));
  if (positives.length === 0 || negatives.length === 0) return null;

  let wins = 0;
  let ties = 0;
  for (const positive of positives) {
    const ps = scoreOf(positive);
    for (const negative of negatives) {
      const ns = scoreOf(negative);
      if (ps > ns) wins += 1;
      else if (ps === ns) ties += 1;
    }
  }
  return (wins + 0.5 * ties) / (positives.length * negatives.length);
}

export function averagePrecision(rows, { labelOf, scoreOf }) {
  const sorted = [...rows].sort((a, b) => {
    const delta = scoreOf(b) - scoreOf(a);
    if (delta !== 0) return delta;
    return String(a.query_id).localeCompare(String(b.query_id))
      || String(a.record_id).localeCompare(String(b.record_id));
  });
  const positiveCount = sorted.filter((row) => labelOf(row)).length;
  if (positiveCount === 0) return null;

  let seenPositive = 0;
  let precisionSum = 0;
  sorted.forEach((row, index) => {
    if (!labelOf(row)) return;
    seenPositive += 1;
    precisionSum += seenPositive / (index + 1);
  });
  return precisionSum / positiveCount;
}

function averageRanks(values) {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value || a.index - b.index);
  const ranks = new Array(values.length);
  let start = 0;
  while (start < indexed.length) {
    let end = start + 1;
    while (end < indexed.length && indexed[end].value === indexed[start].value) end += 1;
    const averageRank = ((start + 1) + end) / 2;
    for (let i = start; i < end; i += 1) ranks[indexed[i].index] = averageRank;
    start = end;
  }
  return ranks;
}

function pearson(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) return null;
  return numerator / Math.sqrt(denomX * denomY);
}

export function spearman(rows, { xOf, yOf }) {
  if (rows.length < 2) return null;
  const xs = averageRanks(rows.map(xOf));
  const ys = averageRanks(rows.map(yOf));
  return pearson(xs, ys);
}

export function thresholdSweep(rows, { labelOf, scoreOf }) {
  const thresholds = [...new Set(rows.map(scoreOf))].sort((a, b) => a - b);
  const candidates = [...new Set([0, ...thresholds, 1])].sort((a, b) => a - b);
  return candidates.map((threshold) => ({
    threshold,
    ...binaryMetrics(rows, {
      labelOf,
      predictionOf: (row) => scoreOf(row) >= threshold,
    }),
  }));
}

export function selectBestF1Threshold(sweep) {
  if (sweep.length === 0) return null;
  return [...sweep].sort((a, b) => {
    const f1Delta = (b.f1 ?? -1) - (a.f1 ?? -1);
    if (f1Delta !== 0) return f1Delta;
    const baDelta = (b.balanced_accuracy ?? -1) - (a.balanced_accuracy ?? -1);
    if (baDelta !== 0) return baDelta;
    const precisionDelta = (b.precision ?? -1) - (a.precision ?? -1);
    if (precisionDelta !== 0) return precisionDelta;
    return b.threshold - a.threshold;
  })[0];
}

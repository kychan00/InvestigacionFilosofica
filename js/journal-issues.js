const ISSUE_COLORS = [
  "#0f62fe",
  "#8a3ffc",
  "#007d79",
  "#d02670",
  "#b28600",
  "#198038",
  "#1192e8",
  "#9f1853",
  "#6929c4",
  "#005d5d",
  "#fa4d56",
  "#a56eff",
  "#009d9a",
  "#ee5396",
  "#24a148",
  "#4589ff"
];

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function numericIssue(value) {
  const number = Number.parseInt(String(value || "").replace(/^0+/, ""), 10);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function explicitIssueNumber(record) {
  for (const candidate of [
    record?.issueNumber,
    record?.issue,
    record?.number,
    record?.numero,
    record?.issue?.number
  ]) {
    const parsed = numericIssue(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function issueNumberFromText(value) {
  const text = clean(value);
  if (!text) return null;

  const patterns = [
    /\bv\d+i0*(\d{1,3})(?=[./_\s-]|$)/i,
    /\b\d{1,3}\s*\(\s*0*(\d{1,3})\s*\)/i,
    /(?:^|[./_-])i(?:ssue)?\s*0*(\d{1,3})(?=[./_\s-]|$)/i,
    /\b(?:n[úu]m(?:ero)?\.?|nro\.?|no\.?|issue)\s*[:#.]?\s*0*(\d{1,3})\b/i,
    /\b(?:vol(?:umen)?\.?\s*\d+\s*)?(?:n[úu]m(?:ero)?\.?|issue)\s*0*(\d{1,3})\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = numericIssue(match?.[1]);
    if (parsed) return parsed;
  }

  return null;
}

function issueNumberFromRecord(record) {
  const explicit = explicitIssueNumber(record);
  if (explicit) return { number: explicit, source: "metadata" };

  const doi = issueNumberFromText(record?.doi);
  if (doi) return { number: doi, source: "doi" };

  for (const value of [
    ...(record?.bibliographicSources || []),
    record?.issue,
    record?.number,
    record?.issueLabel,
    record?.issueTitle,
    record?.citation,
    record?.source,
    record?.sourceId
  ]) {
    const parsed = issueNumberFromText(value);
    if (parsed) return { number: parsed, source: "bibliographic" };
  }

  return { number: null, source: "fallback" };
}

function issueYear(record) {
  const value = Number(record?.year);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function colorIndex(key, number) {
  if (number) return (number - 1) % ISSUE_COLORS.length;

  let hash = 2166136261;
  for (const char of String(key || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % ISSUE_COLORS.length;
}

export function journalIssueInfo(record) {
  const { number, source } = issueNumberFromRecord(record);
  const year = issueYear(record);

  if (number) {
    const key = "issue:" + number;
    return {
      key,
      number,
      year,
      label: "Núm. " + number,
      shortLabel: "N" + number,
      color: ISSUE_COLORS[colorIndex(key, number)],
      source,
      identified: true
    };
  }

  const key = year ? "year:" + year : "unknown";
  return {
    key,
    number: null,
    year,
    label: year ? year + " · número no identificado" : "Número no identificado",
    shortLabel: year ? String(year) : "s/n",
    color: "#6f6f6f",
    source: "fallback",
    identified: false
  };
}

export function journalIssueGroups(records) {
  const map = new Map();

  for (const record of records || []) {
    const issue = journalIssueInfo(record);
    const current = map.get(issue.key) || {
      ...issue,
      count: 0,
      records: []
    };
    current.count += 1;
    current.records.push(record);
    map.set(issue.key, current);
  }

  return [...map.values()].sort((left, right) => {
    if (left.number && right.number) return right.number - left.number;
    if (left.number) return -1;
    if (right.number) return 1;
    return Number(right.year || 0) - Number(left.year || 0);
  });
}

export function journalIssueColor(record) {
  return journalIssueInfo(record).color;
}

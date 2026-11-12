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

function issueDescriptor(value) {
  const text = clean(value).replace(/[–—]/g, "-");
  if (!text) return null;

  const direct = text.match(/^0*(\d{1,3})(?:\s*-\s*0*(\d{1,3}))?$/);
  if (!direct) return null;

  const first = numericIssue(direct[1]);
  const second = numericIssue(direct[2]);

  if (!first) return null;

  const numbers = second && second !== first
    ? [first, second]
    : [first];

  return {
    numbers,
    number: numbers.length === 1 ? first : null,
    sortNumber: Math.max(...numbers),
    slug: numbers.join("-"),
    display: numbers.join("–")
  };
}

function explicitIssue(record) {
  const issueNumbers = Array.isArray(record?.issueNumbers)
    ? record.issueNumbers.map(numericIssue).filter(Boolean)
    : [];

  if (issueNumbers.length) {
    return issueDescriptor(issueNumbers.join("-"));
  }

  for (const candidate of [
    record?.issueLabel,
    record?.issue,
    record?.issueNumber,
    record?.number,
    record?.numero,
    record?.issue?.number
  ]) {
    const parsed = issueDescriptor(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function issueFromText(value) {
  const text = clean(value).replace(/[–—]/g, "-");
  if (!text) return null;

  const patterns = [
    /\bv\d+i0*(\d{1,3})(?:\s*-\s*0*(\d{1,3}))?(?=[./_\s-]|$)/i,
    /(?:^|[./_-])i(?:ssue)?\s*0*(\d{1,3})(?:\s*-\s*0*(\d{1,3}))?(?=[./_\s-]|$)/i,
    /\b(?:n[úu]m(?:ero)?s?\.?|nro\.?|no\.?|issue)\s*[:#.]?\s*0*(\d{1,3})(?:\s*-\s*0*(\d{1,3}))?\b/i,
    /\b\d{1,3}\s*\(\s*0*(\d{1,3})(?:\s*-\s*0*(\d{1,3}))?\s*\)/i,
    /\b(?:vol(?:umen)?\.?\s*\d+\s*)?(?:n[úu]m(?:ero)?s?\.?|issue)\s*0*(\d{1,3})(?:\s*-\s*0*(\d{1,3}))?\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const parsed = issueDescriptor(
      match[2] ? match[1] + "-" + match[2] : match[1]
    );
    if (parsed) return parsed;
  }

  return null;
}

function issueFromRecord(record) {
  const explicit = explicitIssue(record);
  if (explicit) return { ...explicit, source: "metadata" };

  const doi = issueFromText(record?.doi);
  if (doi) return { ...doi, source: "doi" };

  for (const value of [
    ...(record?.bibliographicSources || []),
    record?.issueTitle,
    record?.citation,
    record?.source,
    record?.sourceId
  ]) {
    const parsed = issueFromText(value);
    if (parsed) return { ...parsed, source: "bibliographic" };
  }

  return null;
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
  const issue = issueFromRecord(record);
  const year = issueYear(record);

  if (issue) {
    const key = "issue:" + issue.slug;
    return {
      key,
      number: issue.number,
      numbers: issue.numbers,
      sortNumber: issue.sortNumber,
      year,
      label: "Núm. " + issue.display,
      shortLabel: "N" + issue.display,
      color: ISSUE_COLORS[colorIndex(key, issue.sortNumber)],
      source: issue.source,
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
    if (left.identified && right.identified) {
      return Number(right.sortNumber || right.number || 0) -
        Number(left.sortNumber || left.number || 0);
    }
    if (left.identified) return -1;
    if (right.identified) return 1;
    return Number(right.year || 0) - Number(left.year || 0);
  });
}

export function journalIssueColor(record) {
  return journalIssueInfo(record).color;
}

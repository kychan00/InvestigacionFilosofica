/*
 * Academic chronology: group only by dates actually reported by sources.
 * A year-only index record is never assigned an invented publication month.
 */

import { assessAuthorWorkDate } from "./author-temporal-review.js?v=20261128-history-temporal-07c-v1";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function validYear(value) {
  if (value === null || value === undefined || value === "") return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= -10000 && year !== 0 && year <= 3000
    ? year
    : null;
}

function validMonth(value) {
  if (value === null || value === undefined || value === "") return null;
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? month
    : null;
}

export function authorWorkDate(work = {}) {
  const raw = [
    work.publicationDate,
    work.publication_date,
    work.publishedDate,
    work.published_date,
    work.date
  ].find(value => typeof value === "string" && value.trim());

  const dateMatch = String(raw || "").trim()
    .match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  const dateYear = dateMatch ? validYear(dateMatch[1]) : null;
  const dateMonth = dateMatch ? validMonth(dateMatch[2]) : null;
  const declaredYear = validYear(work.year);
  const year = declaredYear ?? dateYear;

  // Date must agree with the bibliographic year to justify a month.
  const consistentDate = dateYear && dateYear === year;
  const month = consistentDate
    ? dateMonth
    : validMonth(work.month);

  return {
    year,
    month: month ?? null,
    precision: year === null
      ? "unknown"
      : month === null ? "year" : "month"
  };
}

export function buildAuthorTimeline(
  works = [],
  granularity = "year",
  {history=null} = {}
) {
  const mode = granularity === "month" ? "month" : "year";
  const rows = Array.isArray(works) ? works : [];
  const map = new Map();
  let dated = 0;
  let monthsKnown = 0;
  let dateReview = 0;

  rows.forEach((work, index) => {
    const reportedDate = authorWorkDate(work);
    const audit = assessAuthorWorkDate(work,reportedDate,history);
    const needsReview = audit?.review===true;
    const {year,month} = needsReview?{year:null,month:null}:reportedDate;
    if(needsReview)dateReview++;
    if (year !== null) dated++;
    if (year !== null && month !== null) monthsKnown++;

    const key = needsReview ? "review" : mode === "year"
      ? year === null ? "y:unknown" : "y:" + year
      : year === null
        ? "m:unknown"
        : month === null
          ? "m:" + year + "-unknown"
          : "m:" + year + "-" + String(month).padStart(2, "0");

    if (!map.has(key)) {
      const formattedYear = year < 0 ? Math.abs(year) + " a. C." : String(year);
      const label = needsReview ? "Fecha por revisar" : year === null
        ? "Sin fecha"
        : mode === "year"
          ? formattedYear
          : month === null
            ? formattedYear + " · Mes no registrado"
            : MONTHS_ES[month - 1] + " de " + formattedYear;

      map.set(key, {
        key,
        label,
        year,
        month,
        ...(needsReview?{needsReview:true}:{}),
        count: 0,
        nodes: []
      });
    }

    const group = map.get(key);
    group.count++;
    group.nodes.push({ index, work, ...(audit?{dateAudit:audit}:{}) });
  });

  const groups = [...map.values()].sort((left, right) =>
    (left.needsReview?10000:left.year ?? 9999) - (right.needsReview?10000:right.year ?? 9999) ||
    (left.month ?? 13) - (right.month ?? 13) ||
    left.key.localeCompare(right.key, "es")
  );

  for (const group of groups) {
    group.nodes.sort((left, right) =>
      String(left.work.title || "").localeCompare(
        String(right.work.title || ""), "es"
      ) || left.index - right.index
    );
  }

  return {
    granularity: mode,
    total: rows.length,
    dated,
    undated: rows.length - dated - dateReview,
    ...(dateReview?{dateReview}:{}),
    monthsKnown,
    groups
  };
}

import { normalizeText } from "./parser.js";
import {
  QUERY_AREA_TERMS,
  QUERY_DOMAIN_TERMS
} from "../data/query-lexicon.js";


function uniqueTerms(values = []) {
  return [
    ...new Set(
      values
        .map(value => normalizeText(value || ""))
        .filter(Boolean)
    )
  ];
}


function phrasePresent(text, phrase) {
  const normalizedPhrase =
    normalizeText(phrase || "");

  if (!normalizedPhrase) {
    return false;
  }

  const haystack =
    ` ${normalizeText(text || "")} `;

  return haystack.includes(
    ` ${normalizedPhrase} `
  );
}


function termsForArea(area) {
  const values = [
    area?.matched,
    area?.matchedEnglish,
    area?.name_es,
    area?.name_en
  ];

  for (const entry of QUERY_AREA_TERMS) {
    if (entry.areaId !== area?.id) {
      continue;
    }

    values.push(entry.english);

    for (const terms of
      Object.values(entry.terms || {})) {
      values.push(...(terms || []));
    }
  }

  return uniqueTerms(values);
}


function termsForDomain(domain) {
  const values = [
    domain?.matched,
    domain?.matchedEnglish,
    domain?.name_en
  ];

  const entry =
    QUERY_DOMAIN_TERMS.find(
      item => item.id === domain?.id
    );

  if (entry) {
    values.push(entry.english);

    for (const terms of
      Object.values(entry.terms || {})) {
      values.push(...(terms || []));
    }
  }

  return uniqueTerms(values);
}


function allGroupsPresent(text, groups) {
  return (
    groups.length > 0 &&
    groups.every(group =>
      group.some(term =>
        phrasePresent(text, term)
      )
    )
  );
}


export const INTERDISCIPLINARY_CONJUNCTION_PROFILE =
  Object.freeze({
    both: 2,
    areaOnly: -2,
    domainOnly: 0,
    neitherWithAbstract: -1,
    neitherWithoutAbstract: 0
  });


export function interdisciplinaryConjunctionAdjustment(
  result,
  parsed
) {
  const explicitAreas =
    parsed.explicitAreas || [];

  const domains =
    parsed.domains || [];

  const hasAbstract =
    Boolean(
      String(result.abstract || "").trim()
    );

  if (
    explicitAreas.length === 0 ||
    domains.length === 0
  ) {
    return {
      applies: false,
      bucket: "not-applicable",
      areaMatched: false,
      domainMatched: false,
      hasAbstract,
      total: 0
    };
  }

  const areaGroups =
    explicitAreas
      .map(termsForArea)
      .filter(group => group.length > 0);

  const domainGroups =
    domains
      .map(termsForDomain)
      .filter(group => group.length > 0);

  /*
   * Si el léxico no puede representar alguna
   * restricción explícita, no inventamos una
   * penalización. Es preferible quedar neutros.
   */
  if (
    areaGroups.length !== explicitAreas.length ||
    domainGroups.length !== domains.length
  ) {
    return {
      applies: false,
      bucket: "unresolved-constraint",
      areaMatched: false,
      domainMatched: false,
      hasAbstract,
      total: 0
    };
  }

  const text = [
    result.title || "",
    result.abstract || ""
  ].join("\n");

  const areaMatched =
    allGroupsPresent(
      text,
      areaGroups
    );

  const domainMatched =
    allGroupsPresent(
      text,
      domainGroups
    );

  let bucket;
  let total;

  if (areaMatched && domainMatched) {
    bucket = "both";
    total =
      INTERDISCIPLINARY_CONJUNCTION_PROFILE.both;
  } else if (areaMatched) {
    bucket = "area-only";
    total =
      INTERDISCIPLINARY_CONJUNCTION_PROFILE.areaOnly;
  } else if (domainMatched) {
    bucket = "domain-only";
    total =
      INTERDISCIPLINARY_CONJUNCTION_PROFILE.domainOnly;
  } else {
    bucket = "neither";
    total = hasAbstract
      ? INTERDISCIPLINARY_CONJUNCTION_PROFILE.neitherWithAbstract
      : INTERDISCIPLINARY_CONJUNCTION_PROFILE.neitherWithoutAbstract;
  }

  return {
    applies: true,
    bucket,
    areaMatched,
    domainMatched,
    hasAbstract,
    total
  };
}

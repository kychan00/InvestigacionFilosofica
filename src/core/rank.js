import { normalizeText } from "./parser.js";
import { disciplineScore } from "./discipline.js";


function clamp(value, min = 0, max = 1) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}


function tokenSet(text = "") {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter(Boolean)
  );
}


function tokenOverlap(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);

  if (!A.size || !B.size) {
    return 0;
  }

  let common = 0;

  for (const token of A) {
    if (B.has(token)) {
      common++;
    }
  }

  return common / A.size;
}


function bestQuerySignal(result) {
  const matches =
    result.matchedQueries || [];

  if (!matches.length) {
    return 0;
  }

  return Math.max(
    ...matches.map(
      item => item.weight ?? 0
    )
  );
}


function titleContainsAny(
  title,
  values = []
) {
  const normalizedTitle =
    normalizeText(title || "");

  return values.some(value => {
    const normalized =
      normalizeText(value || "");

    return (
      normalized &&
      normalizedTitle.includes(
        normalized
      )
    );
  });
}


function getPhilosopherAliases(
  philosopher,
  philosophyMap
) {
  const full =
    (philosophyMap.philosophers || [])
      .find(
        item =>
          item.id === philosopher.id
      );

  if (!full) {
    return [
      philosopher.name
    ];
  }

  return [
    full.name,
    ...(full.aliases || [])
  ];
}


function relatedWorksForQuery(
  parsed,
  philosophyMap
) {
  const result = [];

  const philosopherIds =
    new Set(
      (parsed.philosophers || [])
        .map(x => x.id)
    );

  const conceptIds =
    new Set(
      (parsed.concepts || [])
        .map(x => x.id)
    );

  for (const work of
    philosophyMap.works || []) {

    if (
      !philosopherIds.has(
        work.author
      )
    ) {
      continue;
    }

    const workConcepts =
      new Set(
        work.concepts || []
      );

    let conceptOverlap = 0;

    for (const conceptId of conceptIds) {
      if (
        workConcepts.has(
          conceptId
        )
      ) {
        conceptOverlap++;
      }
    }

    if (
      conceptIds.size === 0 ||
      conceptOverlap > 0
    ) {
      result.push({
        work,
        conceptOverlap
      });
    }
  }

  return result;
}


function queryMatchScore(
  result,
  parsed,
  philosophyMap
) {
  const title =
    result.title || "";

  /*
   * 1. Coincidencia con consulta original.
   */
  const originalOverlap =
    tokenOverlap(
      parsed.original || "",
      title
    );

  /*
   * 2. Coincidencia con las expansiones
   * que realmente encontraron este resultado.
   *
   * Esto es crucial para búsquedas ES → EN.
   */
  let bestExpansionOverlap = 0;
  let bestExpansionWeight = 0;

  for (const match of
    result.matchedQueries || []) {

    const overlap =
      tokenOverlap(
        match.query || "",
        title
      );

    const weight =
      match.weight ?? 0;

    const weighted =
      overlap * weight;

    if (
      weighted >
      bestExpansionOverlap
    ) {
      bestExpansionOverlap =
        weighted;

      bestExpansionWeight =
        weight;
    }
  }

  /*
   * Filósofo explícito.
   */
  let philosopherBonus = 0;

  for (const philosopher of
    parsed.philosophers || []) {

    const aliases =
      getPhilosopherAliases(
        philosopher,
        philosophyMap
      );

    if (
      titleContainsAny(
        title,
        aliases
      )
    ) {
      philosopherBonus = 0.20;
      break;
    }
  }

  /*
   * Conceptos explícitos.
   */
  let conceptBonus = 0;

  for (const concept of
    parsed.concepts || []) {

    const fullConcept =
      (philosophyMap.concepts || [])
        .find(
          item =>
            item.id === concept.id
        );

    const values = [
      concept.name_es,
      concept.name_en,
      ...(fullConcept?.aliases_es || []),
      ...(fullConcept?.aliases_en || [])
    ].filter(Boolean);

    const titleTokens =
      tokenSet(title);

    let bestCoverage = 0;

    for (const value of values) {
      const conceptTokens =
        tokenSet(value);

      if (!conceptTokens.size) {
        continue;
      }

      let common = 0;

      for (const token of conceptTokens) {
        if (titleTokens.has(token)) {
          common++;
        }
      }

      const coverage =
        common /
        conceptTokens.size;

      bestCoverage =
        Math.max(
          bestCoverage,
          coverage
        );
    }

    /*
     * No exigimos orden idéntico:
     *
     * mente-cuerpo
     * cuerpo-mente
     *
     * pueden representar el mismo concepto.
     */
    if (bestCoverage >= 0.60) {
      conceptBonus +=
        0.10 * bestCoverage;
    }
  }

  return clamp(
    originalOverlap * 0.20 +
    bestExpansionOverlap * 0.45 +
    philosopherBonus +
    conceptBonus +
    bestExpansionWeight * 0.10
  );
}


function philosophicalScore(
  result,
  parsed,
  philosophyMap
) {
  const title =
    result.title || "";

  let score = 0;

  /*
   * Filósofo explícito en el título.
   */
  for (const philosopher of
    parsed.philosophers || []) {

    const aliases =
      getPhilosopherAliases(
        philosopher,
        philosophyMap
      );

    if (
      titleContainsAny(
        title,
        aliases
      )
    ) {
      score += 0.30;
    }
  }

  /*
   * Conceptos explícitos de la consulta.
   */
  for (const concept of
    parsed.concepts || []) {

    const fullConcept =
      (philosophyMap.concepts || [])
        .find(
          item =>
            item.id === concept.id
        );

    const values = [
      concept.name_es,
      concept.name_en,
      ...(fullConcept?.aliases_es || []),
      ...(fullConcept?.aliases_en || [])
    ].filter(Boolean);

    const normalizedTitle =
      normalizeText(title);

    const titleTokens =
      tokenSet(title);

    let bestCoverage = 0;

    for (const value of values) {
      const normalizedValue =
        normalizeText(value);

      if (
        normalizedValue &&
        normalizedTitle.includes(
          normalizedValue
        )
      ) {
        bestCoverage = 1;
        break;
      }

      const valueTokens =
        tokenSet(value);

      if (!valueTokens.size) {
        continue;
      }

      let common = 0;

      for (const token of valueTokens) {
        if (titleTokens.has(token)) {
          common++;
        }
      }

      bestCoverage =
        Math.max(
          bestCoverage,
          common / valueTokens.size
        );
    }

    if (bestCoverage >= 0.60) {
      score +=
        0.25 * bestCoverage;
    }
  }

  /*
   * Obras directamente reconocidas
   * en la consulta.
   */
  for (const work of
    parsed.works || []) {

    if (
      titleContainsAny(
        title,
        [work.canonicalTitle]
      )
    ) {
      score += 0.50;
    }
  }

  /*
   * Obras canónicas relacionadas con
   * el filósofo + concepto buscados.
   */
  const relatedWorks =
    relatedWorksForQuery(
      parsed,
      philosophyMap
    );

  for (const item of relatedWorks) {
    const work = item.work;

    const titles = [
      work.canonical_title
    ];

    for (
      const translations of
      Object.values(
        work.titles || {}
      )
    ) {
      titles.push(
        ...translations
      );
    }

    if (
      titleContainsAny(
        title,
        titles
      )
    ) {
      score += 0.35;

      if (
        item.conceptOverlap > 0
      ) {
        score += 0.15;
      }
    }
  }

  /*
   * Topics de OpenAlex:
   * señal débil, nunca dominante.
   */
  const topicNames =
    (result.topics || [])
      .map(
        topic =>
          normalizeText(
            topic.name || ""
          )
      );

  for (const area of
    parsed.areas || []) {

    if (
      area.confidence < 0.40
    ) {
      continue;
    }

    const names = [
      area.name_es,
      area.name_en
    ]
      .filter(Boolean)
      .map(normalizeText);

    if (
      topicNames.some(topic =>
        names.some(name =>
          topic.includes(name) ||
          name.includes(topic)
        )
      )
    ) {
      score +=
        0.08 *
        area.confidence;
    }
  }

  return clamp(score);
}


function thematicDispersionPenalty(
  result,
  parsed
) {
  const titleTokens =
    tokenSet(
      result.title || ""
    );

  if (
    titleTokens.size < 8
  ) {
    return 0;
  }

  let matchedCore = 0;

  for (const philosopher of
    parsed.philosophers || []) {

    const surname =
      normalizeText(
        philosopher.name
          .split(" ")
          .at(-1)
      );

    if (
      titleTokens.has(
        surname
      )
    ) {
      matchedCore++;
    }
  }

  for (const concept of
    parsed.concepts || []) {

    const candidates = [
      concept.name_es,
      concept.name_en
    ]
      .filter(Boolean)
      .flatMap(
        term =>
          [...tokenSet(term)]
      );

    if (
      candidates.some(token =>
        titleTokens.has(token)
      )
    ) {
      matchedCore++;
    }
  }

  const expectedCore =
    (parsed.philosophers?.length || 0) +
    (parsed.concepts?.length || 0);

  if (
    expectedCore === 0
  ) {
    return 0;
  }

  const coverage =
    matchedCore /
    expectedCore;

  /*
   * Títulos muy largos con sólo una
   * parte de la consulta explícita
   * reciben una pequeña penalización.
   */
  if (
    titleTokens.size >= 14 &&
    coverage < 1
  ) {
    return 0.10;
  }

  if (
    titleTokens.size >= 20
  ) {
    return 0.05;
  }

  return 0;
}


function consensusScore(result) {
  const matches =
    result.matchedQueries || [];

  const providers =
    result.providers || [];

  const queryConsensus =
    matches.length
      ? Math.min(
          1,
          0.20 +
          (matches.length - 1) *
            0.25
        )
      : 0;

  const sourceConsensus =
    providers.length <= 1
      ? 0
      : Math.min(
          1,
          (providers.length - 1) *
            0.50
        );

  return clamp(
    queryConsensus * 0.75 +
    sourceConsensus * 0.25
  );
}


function bibliographicScore(result) {
  let score = 0;

  if (result.doi) score += 0.35;
  if (result.authors?.length) score += 0.20;
  if (result.year) score += 0.10;
  if (result.journal) score += 0.10;
  if (result.publisher) score += 0.05;
  if (result.type) score += 0.05;
  if (result.language) score += 0.05;

  if (
    result.openAccess?.url
  ) {
    score += 0.10;
  }

  return clamp(score);
}


function impactScore(result) {
  const citations =
    Number(
      result.citedBy || 0
    );

  if (citations <= 0) {
    return 0;
  }

  return clamp(
    Math.log10(
      citations + 1
    ) / 4
  );
}


function levelFromScore(score) {
  if (score >= 85) {
    return "P1";
  }

  if (score >= 65) {
    return "P2";
  }

  if (score >= 40) {
    return "P3";
  }

  return "P4";
}


export function rankResult(
  result,
  parsed,
  philosophyMap
) {
  const Q =
    queryMatchScore(
      result,
      parsed,
      philosophyMap
    );

  const P =
    philosophicalScore(
      result,
      parsed,
      philosophyMap
    );

  const discipline =
    disciplineScore(
      result,
      parsed,
      philosophyMap
    );

  const D =
    discipline.score;

  const S =
    consensusScore(result);

  const B =
    bibliographicScore(
      result
    );

  const I =
    impactScore(result);

  const penalty =
    thematicDispersionPenalty(
      result,
      parsed
    );

  const total =
    Q * 0.28 +
    P * 0.30 +
    D * 0.20 +
    S * 0.10 +
    B * 0.08 +
    I * 0.04 -
    penalty;

  const score =
    Math.round(
      clamp(total) * 100
    );

  return {
    ...result,

    relevanceScore:
      score,

    relevanceLevel:
      levelFromScore(score),

    metadataConfidence:
      Math.round(B * 100),

    ranking: {
      query:
        Math.round(Q * 100),

      philosophy:
        Math.round(P * 100),

      discipline:
        Math.round(D * 100),

      disciplineDetails:
        discipline.details,

      consensus:
        Math.round(S * 100),

      bibliography:
        Math.round(B * 100),

      impact:
        Math.round(I * 100),

      penalty:
        Math.round(
          penalty * 100
        )
    }
  };
}


export function rankResults(
  results,
  parsed,
  philosophyMap
) {
  return results
    .map(
      result =>
        rankResult(
          result,
          parsed,
          philosophyMap
        )
    )
    .sort(
      (a, b) =>
        b.relevanceScore -
        a.relevanceScore
    );
}

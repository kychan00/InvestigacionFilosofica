import {
  normalizeText
} from "./parser.js";


function containsText(
  text,
  value
) {
  const a =
    normalizeText(
      text || ""
    );

  const b =
    normalizeText(
      value || ""
    );

  return Boolean(
    a &&
    b &&
    a.includes(b)
  );
}


function philosopherReasons(
  result,
  parsed,
  philosophyMap
) {
  const reasons = [];

  for (const detected of
    parsed.philosophers || []) {

    const full =
      (philosophyMap.philosophers || [])
        .find(
          item =>
            item.id === detected.id
        );

    const names = [
      detected.name,
      full?.name,
      ...(full?.aliases || [])
    ].filter(Boolean);

    if (
      names.some(
        name =>
          containsText(
            result.title,
            name
          )
      )
    ) {
      reasons.push(
        `El título menciona a ${detected.name}.`
      );
    }
  }

  return reasons;
}


function conceptReasons(
  result,
  parsed,
  philosophyMap
) {
  const reasons = [];

  for (const detected of
    parsed.concepts || []) {

    const full =
      (philosophyMap.concepts || [])
        .find(
          item =>
            item.id === detected.id
        );

    const names = [
      detected.name_es,
      detected.name_en,
      full?.name_es,
      full?.name_en,
      ...(full?.aliases_es || []),
      ...(full?.aliases_en || [])
    ].filter(Boolean);

    if (
      names.some(
        name =>
          containsText(
            result.title,
            name
          )
      )
    ) {
      reasons.push(
        `El título coincide con el concepto ${
          detected.name_es ||
          detected.name_en ||
          detected.id
        }.`
      );
    }
  }

  return reasons;
}


function workReasons(
  result,
  parsed
) {
  const reasons = [];

  for (const work of
    parsed.works || []) {

    if (
      containsText(
        result.title,
        work.canonicalTitle
      )
    ) {
      reasons.push(
        `Coincide directamente con la obra ${work.canonicalTitle}.`
      );
    }
  }

  return reasons;
}


function queryReasons(result) {
  const matches =
    result.matchedQueries || [];

  if (!matches.length) {
    return [];
  }

  if (matches.length === 1) {
    return [
      `Encontrado mediante la búsqueda “${matches[0].query}”.`
    ];
  }

  return [
    `Fue encontrado mediante ${matches.length} variantes distintas de la consulta.`
  ];
}


function providerReasons(result) {
  const providers =
    result.providers || [];

  if (
    providers.length > 1
  ) {
    return [
      `El mismo trabajo fue identificado por ${providers.join(" y ")}.`
    ];
  }

  if (
    providers.length === 1
  ) {
    return [
      `Registro recuperado desde ${providers[0]}.`
    ];
  }

  return [];
}


function disciplineReasons(result) {
  const ranking =
    result.ranking || {};

  const details =
    ranking.disciplineDetails ||
    {};

  const reasons = [];

  if (
    (details.philosophyTopics || 0) >= 35
  ) {
    reasons.push(
      "Sus temas bibliográficos están clasificados dentro de filosofía."
    );
  }

  if (
    (details.philosophyJournal || 0) >= 30
  ) {
    reasons.push(
      "La publicación o revista aporta evidencia disciplinaria filosófica."
    );
  }

  if (
    (details.outsideTopics || 0) > 0 ||
    (details.outsideJournal || 0) > 0
  ) {
    reasons.push(
      "También presenta señales interdisciplinarias, consideradas en la puntuación."
    );
  }

  return reasons;
}


function bibliographyReasons(result) {
  const reasons = [];

  if (
    result.doi
  ) {
    reasons.push(
      "Dispone de DOI verificable."
    );
  }

  if (
    result.authors?.length &&
    result.year
  ) {
    reasons.push(
      "Tiene autoría y fecha bibliográfica identificadas."
    );
  }

  if (
    result.openAccess?.isOpen
  ) {
    reasons.push(
      "OpenAlex indica disponibilidad en acceso abierto."
    );
  }

  return reasons;
}


function strongestReasons(
  reasons,
  max = 6
) {
  return [
    ...new Set(reasons)
  ].slice(
    0,
    max
  );
}


export function explainResult(
  result,
  parsed,
  philosophyMap
) {
  const reasons =
    strongestReasons([
      ...philosopherReasons(
        result,
        parsed,
        philosophyMap
      ),

      ...conceptReasons(
        result,
        parsed,
        philosophyMap
      ),

      ...workReasons(
        result,
        parsed
      ),

      ...disciplineReasons(
        result
      ),

      ...queryReasons(
        result
      ),

      ...providerReasons(
        result
      ),

      ...bibliographyReasons(
        result
      )
    ]);


  const matches =
    (result.matchedQueries || [])
      .map(item => ({
        query:
          item.query,

        weight:
          item.weight,

        type:
          item.type
      }));


  return {
    score:
      result.relevanceScore,

    level:
      result.relevanceLevel,

    dimensions: {
      query:
        result.ranking?.query ?? 0,

      philosophy:
        result.ranking?.philosophy ?? 0,

      discipline:
        result.ranking?.discipline ?? 0,

      consensus:
        result.ranking?.consensus ?? 0,

      bibliography:
        result.ranking?.bibliography ?? 0,

      impact:
        result.ranking?.impact ?? 0
    },

    reasons,

    matchedQueries:
      matches,

    providers:
      result.providers || []
  };
}

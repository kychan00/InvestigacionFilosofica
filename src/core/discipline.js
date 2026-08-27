import { normalizeText } from "./parser.js";


function clamp(value, min = 0, max = 1) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}


function containsPhrase(text, phrase) {
  const a = normalizeText(text || "");
  const b = normalizeText(phrase || "");

  return Boolean(
    a &&
    b &&
    a.includes(b)
  );
}


function containsAny(text, phrases = []) {
  return phrases.some(
    phrase =>
      containsPhrase(text, phrase)
  );
}


function topicNames(result) {
  return (result.topics || [])
    .map(topic => topic.name || "")
    .filter(Boolean);
}


function topicCorpus(result) {
  return topicNames(result).join(" ");
}


/*
 * Evidencia disciplinaria fuerte.
 *
 * Aquí NO ponemos conceptos de la consulta
 * como "free will", "mind-body", "justice", etc.
 *
 * Buscamos señales de que OpenAlex realmente
 * está clasificando el trabajo dentro de filosofía.
 */
const STRONG_PHILOSOPHY_TOPIC_TERMS = [
  "philosophical thought",
  "philosophical ethics",
  "philosophy and theoretical science",
  "classical philosophy",
  "historical philosophy",
  "wittgensteinian philosophy",
  "spanish philosophy",
  "philosophical analysis",
  "epistemology, ethics, and metaphysics",
  "metaphysics and epistemology",
  "philosophy of mind",
  "political philosophy",
  "philosophy of science",
  "philosophy of language",
  "phenomenology",
  "existential philosophy"
];


const GENERAL_PHILOSOPHY_TOPIC_TERMS = [
  "philosophy",
  "philosophical",
  "metaphysics",
  "epistemology",
  "ontology",
  "phenomenology",
  "hermeneutics"
];


const PHILOSOPHY_JOURNAL_TERMS = [
  "philosophy",
  "philosophical",
  "filosofia",
  "filosofía",
  "theoria",
  "theoría",
  "metaphysics",
  "phenomenology",
  "nous",
  "noûs"
];


/*
 * Señales fuertes de disciplinas externas.
 *
 * No significan que el artículo sea malo.
 * Significan que quizá no sea principalmente
 * un trabajo filosófico.
 */
const OUTSIDE_TOPIC_TERMS = [
  "health",
  "healthcare",
  "medicine",
  "medical",
  "clinical",
  "psychiatry",
  "psychiatric",
  "neurology",
  "neuroscience",

  "obesity",
  "nutrition",
  "lifestyle",

  "genetics",
  "genotype",
  "genomics",

  "chemistry",
  "chemical",

  "psychological treatments",
  "psychology of",
  "mental health",
  "psychosomatic",

  "public policy",
  "governance",
  "sociology",
  "social and cultural",

  "management",
  "organizational",

  "educational theories",
  "pedagogy",

  "engineering",
  "agriculture"
];


const OUTSIDE_JOURNAL_TERMS = [
  "medical",
  "medico",
  "médico",
  "medicine",
  "clinical",
  "psychiatry",
  "psychiatric",
  "neuroscience",
  "neurology",
  "hospital",
  "health",
  "psychology",
  "epidemiology",
  "nutrition"
];


function philosophyTopicEvidence(result) {
  const topics =
    topicCorpus(result);

  if (
    containsAny(
      topics,
      STRONG_PHILOSOPHY_TOPIC_TERMS
    )
  ) {
    return 0.55;
  }

  if (
    containsAny(
      topics,
      GENERAL_PHILOSOPHY_TOPIC_TERMS
    )
  ) {
    return 0.35;
  }

  return 0;
}


function philosophyJournalEvidence(result) {
  const journal =
    result.journal || "";

  if (
    containsAny(
      journal,
      PHILOSOPHY_JOURNAL_TERMS
    )
  ) {
    return 0.35;
  }

  return 0;
}


/*
 * Un filósofo explícito en el título es evidencia
 * útil, pero NO suficiente para decir que el
 * documento pertenece a filosofía.
 *
 * "Descartes and psychiatry" sigue mencionando
 * a Descartes.
 */
function philosopherEvidence(
  result,
  parsed,
  philosophyMap
) {
  const title =
    result.title || "";

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
      containsAny(
        title,
        names
      )
    ) {
      return 0.10;
    }
  }

  return 0;
}


/*
 * Los conceptos ya tienen mucho peso en Q y P.
 *
 * En D sólo aportan una señal pequeña, y únicamente
 * si OpenAlex los reconoce además como topic.
 */
function conceptTopicEvidence(
  result,
  parsed,
  philosophyMap
) {
  const topics =
    topicCorpus(result);

  let hits = 0;

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
      containsAny(
        topics,
        names
      )
    ) {
      hits++;
    }
  }

  return Math.min(
    hits * 0.05,
    0.10
  );
}


function areaEvidence(
  result,
  parsed
) {
  const topics =
    topicCorpus(result);

  let best = 0;

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
    ].filter(Boolean);

    if (
      containsAny(
        topics,
        names
      )
    ) {
      best = Math.max(
        best,
        0.20 * area.confidence
      );
    }
  }

  return best;
}


function outsideTopicEvidence(result) {
  const topics =
    topicCorpus(result);

  let hits = 0;

  for (const term of
    OUTSIDE_TOPIC_TERMS) {

    if (
      containsPhrase(
        topics,
        term
      )
    ) {
      hits++;
    }
  }

  return Math.min(
    hits * 0.18,
    0.65
  );
}


function outsideJournalEvidence(result) {
  const journal =
    result.journal || "";

  if (
    containsAny(
      journal,
      OUTSIDE_JOURNAL_TERMS
    )
  ) {
    return 0.35;
  }

  return 0;
}


export function disciplineScore(
  result,
  parsed,
  philosophyMap
) {
  const philosophyTopics =
    philosophyTopicEvidence(
      result
    );

  const philosophyJournal =
    philosophyJournalEvidence(
      result
    );

  const philosopher =
    philosopherEvidence(
      result,
      parsed,
      philosophyMap
    );

  const conceptTopics =
    conceptTopicEvidence(
      result,
      parsed,
      philosophyMap
    );

  const areas =
    areaEvidence(
      result,
      parsed
    );

  const outsideTopics =
    outsideTopicEvidence(
      result
    );

  const outsideJournal =
    outsideJournalEvidence(
      result
    );


  /*
   * Base deliberadamente baja.
   *
   * Si OpenAlex no nos da evidencia disciplinaria,
   * no debemos inventar una confianza alta.
   */
  const base = 0.15;


  const positive =
    philosophyTopics +
    philosophyJournal +
    philosopher +
    conceptTopics +
    areas;


  const outside =
    clamp(
      outsideTopics +
      outsideJournal
    );


  /*
   * La evidencia filosófica fuerte puede coexistir
   * legítimamente con medicina, psicología, etc.
   *
   * Ejemplo:
   * un artículo de filosofía de la medicina.
   *
   * Por eso la evidencia externa no siempre se
   * resta completa.
   */
  let penaltyFactor;

  if (
    philosophyTopics >= 0.55 ||
    philosophyJournal >= 0.35
  ) {
    penaltyFactor = 0.30;
  } else if (
    positive >= 0.35
  ) {
    penaltyFactor = 0.65;
  } else {
    penaltyFactor = 1.00;
  }


  const appliedPenalty =
    outside *
    penaltyFactor;


  const score =
    clamp(
      base +
      positive -
      appliedPenalty
    );


  return {
    score,

    details: {
      philosophyTopics:
        Math.round(
          philosophyTopics * 100
        ),

      philosophyJournal:
        Math.round(
          philosophyJournal * 100
        ),

      philosopher:
        Math.round(
          philosopher * 100
        ),

      conceptTopics:
        Math.round(
          conceptTopics * 100
        ),

      areas:
        Math.round(
          areas * 100
        ),

      outsideTopics:
        Math.round(
          outsideTopics * 100
        ),

      outsideJournal:
        Math.round(
          outsideJournal * 100
        ),

      appliedPenalty:
        Math.round(
          appliedPenalty * 100
        )
    }
  };
}

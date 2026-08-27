import { normalizeText } from "./parser.js";


function queryKey(text) {
  return normalizeText(text)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function uniqueQueries(items) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = queryKey(item.query);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(item);
  }

  return out;
}


function getPhilosopherName(parsed) {
  if (!parsed.philosophers?.length) {
    return null;
  }

  return parsed.philosophers[0].name;
}


function getConceptTerms(parsed) {
  return (parsed.concepts || []).map(concept => ({
    id: concept.id,
    es: concept.name_es,
    en: concept.name_en || concept.name_es
  }));
}


function getAreaTerms(parsed) {
  return (parsed.explicitAreas || []).map(area => ({
    id: area.id,
    es: area.name_es,
    en: area.name_en || area.name_es
  }));
}


function getPrimaryTerms(parsed) {
  const concepts = getConceptTerms(parsed);

  if (concepts.length) {
    return concepts;
  }

  return getAreaTerms(parsed);
}


function buildLiteralVariants(parsed) {
  const results = [];

  const philosopher = getPhilosopherName(parsed);
  const terms = getPrimaryTerms(parsed);

  if (!philosopher || !terms.length) {
    return results;
  }

  const spanish = terms
    .map(term => term.es)
    .filter(Boolean)
    .join(" ");

  if (spanish) {
    results.push({
      query: `${philosopher} ${spanish}`,
      type: "literal",
      weight: 0.98,
      reason: "philosopher-first"
    });
  }

  return results;
}


function buildTranslations(parsed) {
  const results = [];

  const philosopher = getPhilosopherName(parsed);
  const terms = getPrimaryTerms(parsed);

  if (!terms.length) {
    return results;
  }

  const english = terms
    .map(term => term.en)
    .filter(Boolean)
    .join(" ");

  if (!english) {
    return results;
  }

  results.push({
    query: philosopher
      ? `${philosopher} ${english}`
      : english,

    type: "translation",
    weight: 0.90,
    reason: "english-translation"
  });

  return results;
}


const CONCEPT_EXPANSIONS = {
  freedom: [
    {
      term: "autonomy",
      weight: 0.78
    },
    {
      term: "free will",
      weight: 0.74
    }
  ],

  free_will: [
    {
      term: "freedom",
      weight: 0.76
    },
    {
      term: "moral responsibility",
      weight: 0.72
    }
  ],

  justice: [
    {
      term: "distributive justice",
      weight: 0.78
    },
    {
      term: "theory of justice",
      weight: 0.74
    }
  ],

  mind_body: [
    {
      term: "dualism",
      weight: 0.74
    }
  ],

  being: [
    {
      term: "ontology",
      weight: 0.76
    },
    {
      term: "existence",
      weight: 0.72
    }
  ],

  knowledge: [
    {
      term: "epistemology",
      weight: 0.80
    },
    {
      term: "theory of knowledge",
      weight: 0.76
    }
  ],

  truth: [
    {
      term: "theory of truth",
      weight: 0.76
    }
  ],

  virtue: [
    {
      term: "virtue ethics",
      weight: 0.80
    }
  ],

  determinism: [
    {
      term: "causal determinism",
      weight: 0.74
    }
  ]
};


function buildConceptualVariants(parsed) {
  const results = [];

  const philosopher = getPhilosopherName(parsed);
  const concepts = getConceptTerms(parsed);

  if (!concepts.length) {
    return results;
  }

  /*
   * La clave:
   *
   * al expandir un concepto conservamos
   * todos los demás conceptos de la consulta.
   *
   * Ejemplo:
   *
   * free will + determinism
   *
   * =>
   * freedom + determinism
   *
   * no simplemente:
   * freedom
   */

  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i];

    const expansions =
      CONCEPT_EXPANSIONS[concept.id] || [];

    for (const expansion of expansions) {
      const terms = concepts.map(
        (current, index) => {
          if (index === i) {
            return expansion.term;
          }

          return current.en;
        }
      );

      const cleanedTerms = [];

      for (const term of terms) {
        const key = queryKey(term);

        const alreadyPresent =
          cleanedTerms.some(
            existing =>
              queryKey(existing) === key
          );

        if (!alreadyPresent) {
          cleanedTerms.push(term);
        }
      }

      const body = cleanedTerms.join(" ");

      const query = philosopher
        ? `${philosopher} ${body}`
        : body;

      results.push({
        query,
        type: "conceptual",
        weight: expansion.weight,
        reason: `concept:${concept.id}`
      });
    }
  }

  return results;
}


function philosopherFromId(
  philosopherId,
  philosophyMap
) {
  const philosopher =
    (philosophyMap.philosophers || [])
      .find(
        item => item.id === philosopherId
      );

  return philosopher?.name || null;
}


function buildWorkVariants(
  parsed,
  philosophyMap
) {
  const results = [];

  for (const work of parsed.works || []) {
    const author = philosopherFromId(
      work.author,
      philosophyMap
    );

    results.push({
      query: work.canonicalTitle,
      type: "work",
      weight: 0.95,
      reason: `work:${work.id}`
    });

    if (author) {
      results.push({
        query:
          `${author} ${work.canonicalTitle}`,

        type: "work-author",
        weight: 0.93,
        reason: `work-author:${work.id}`
      });
    }
  }

  return results;
}


export function expandQuery(
  parsed,
  philosophyMap,
  options = {}
) {
  const maxQueries =
    options.maxQueries ?? 6;

  const expansions = [
    {
      query: parsed.original,
      type: "original",
      weight: 1.00,
      reason: "user-query"
    },

    ...buildLiteralVariants(parsed),

    ...buildWorkVariants(
      parsed,
      philosophyMap
    ),

    ...buildTranslations(parsed),

    ...buildConceptualVariants(parsed)
  ];

  return uniqueQueries(expansions)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxQueries);
}

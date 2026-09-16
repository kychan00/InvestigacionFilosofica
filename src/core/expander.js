import { normalizeText } from "./parser.js";


const EXPANSION_STOPWORDS = new Set([
  // Spanish
  "a", "al", "de", "del", "el", "la", "las", "los", "en", "y", "o", "por", "para", "con", "sobre",

  // English
  "a", "an", "and", "of", "the", "in", "on", "for", "to", "with", "about",

  // German
  "am", "an", "auf", "bei", "das", "dem", "den", "der", "des", "die", "ein", "eine", "einer", "im", "in", "mit", "und", "von", "zu", "zur", "zum",

  // French
  "a", "au", "aux", "dans", "de", "des", "du", "en", "et", "la", "le", "les", "sur", "avec", "pour",

  // Portuguese
  "a", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "para", "por", "sobre"
]);


function queryKey(text) {
  return normalizeText(text)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function semanticTokens(text = "") {
  return queryKey(text)
    .split(" ")
    .filter(Boolean)
    .filter(token =>
      !EXPANSION_STOPWORDS.has(token)
    );
}


function residualConstraintTokens(parsed) {
  const original = new Set(
    semanticTokens(parsed.original)
  );

  const recognized = new Set();

  const groups = [
    parsed.philosophers || [],
    parsed.concepts || [],
    parsed.works || [],
    parsed.explicitAreas || [],
    parsed.domains || []
  ];

  for (const group of groups) {
    for (const item of group) {
      for (const token of
        semanticTokens(item.matched || "")) {
        recognized.add(token);
      }
    }
  }

  return [...original]
    .filter(token =>
      !recognized.has(token)
    );
}


function preservesResidualConstraints(
  query,
  residualTokens
) {
  if (!residualTokens.length) {
    return true;
  }

  const candidate = new Set(
    semanticTokens(query)
  );

  return residualTokens.every(token =>
    candidate.has(token)
  );
}


function containsPhrase(query, phrase) {
  if (!phrase) return false;

  const haystack = ` ${queryKey(query)} `;
  const needle = ` ${queryKey(phrase)} `;
  return haystack.includes(needle);
}


function preservesRecognizedConstraints(
  query,
  parsed
) {
  for (const area of parsed.explicitAreas || []) {
    const acceptable = [
      area.matched,
      area.matchedEnglish || area.name_en
    ].filter(Boolean);

    if (
      acceptable.length &&
      !acceptable.some(term =>
        containsPhrase(query, term)
      )
    ) {
      return false;
    }
  }

  for (const domain of parsed.domains || []) {
    const acceptable = [
      domain.matched,
      domain.matchedEnglish || domain.name_en
    ].filter(Boolean);

    if (
      acceptable.length &&
      !acceptable.some(term =>
        containsPhrase(query, term)
      )
    ) {
      return false;
    }
  }

  return true;
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
    source: area.matched || area.name_es,
    en:
      area.matchedEnglish ||
      area.name_en ||
      area.name_es
  }));
}


function getDomainTerms(parsed) {
  return (parsed.domains || [])
    .map(domain =>
      domain.matchedEnglish ||
      domain.name_en
    )
    .filter(Boolean);
}


function getPrimaryTerms(parsed) {
  const concepts = getConceptTerms(parsed);

  if (concepts.length) {
    return concepts;
  }

  return getAreaTerms(parsed);
}


function withEnglishDomains(query, parsed) {
  const domains = getDomainTerms(parsed);

  if (!domains.length) {
    return query;
  }

  return `${query} in ${domains.join(" ")}`;
}


function buildLiteralVariants(parsed) {
  const results = [];

  /*
   * Literal philosopher-first rewrites are intentionally disabled when
   * external academic-domain constraints are present. Mixing a canonical
   * philosopher name with an untranslated domain would be less predictable
   * than either the original query or the complete English translation.
   */
  if (parsed.domains?.length) {
    return results;
  }

  const philosopher = getPhilosopherName(parsed);
  const terms = getPrimaryTerms(parsed);

  if (!philosopher || !terms.length) {
    return results;
  }

  const sourceTerms = terms
    .map(term => term.es || term.source)
    .filter(Boolean)
    .join(" ");

  if (sourceTerms) {
    results.push({
      query: `${philosopher} ${sourceTerms}`,
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

  const core = philosopher
    ? `${philosopher} ${english}`
    : english;

  results.push({
    query: withEnglishDomains(core, parsed),
    type: "translation",
    weight: 0.90,
    reason: parsed.domains?.length
      ? "english-translation-complete"
      : "english-translation"
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

      const core = philosopher
        ? `${philosopher} ${body}`
        : body;

      results.push({
        query: withEnglishDomains(core, parsed),
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
      query: withEnglishDomains(
        work.canonicalTitle,
        parsed
      ),
      type: "work",
      weight: 0.95,
      reason: `work:${work.id}`
    });

    if (author) {
      results.push({
        query: withEnglishDomains(
          `${author} ${work.canonicalTitle}`,
          parsed
        ),
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

  const residualTokens =
    residualConstraintTokens(parsed);

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

  /*
   * Two safety invariants now apply:
   *
   * 1. unknown substantive tokens must survive verbatim;
   * 2. recognized philosophical-area and academic-domain constraints must
   *    survive either in their original wording or in their exact English
   *    equivalent.
   *
   * This permits:
   *   ontología en informática -> ontology in computer science
   *
   * while still rejecting:
   *   ontología en informática -> Metaphysics
   *
   * and also rejects incomplete translation when an unknown qualifier is
   * present, e.g. "ontología en informática pediátrica".
   */
  return uniqueQueries(expansions)
    .filter(item =>
      item.type === "original" ||
      (
        preservesResidualConstraints(
          item.query,
          residualTokens
        ) &&
        preservesRecognizedConstraints(
          item.query,
          parsed
        )
      )
    )
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxQueries);
}

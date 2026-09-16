import {
  QUERY_AREA_TERMS,
  QUERY_DOMAIN_TERMS,
  QUERY_LANGUAGE_WORDS
} from "../data/query-lexicon.js";


export function normalizeText(text = "") {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function phraseMatch(text, phrase) {
  const haystack = ` ${normalizeText(text)} `;
  const needle = ` ${normalizeText(phrase)} `;
  return haystack.includes(needle);
}


function uniqueById(items) {
  const map = new Map();

  for (const item of items) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }

  return [...map.values()];
}


function candidateList(item) {
  const out = [];

  for (const language of ["es", "en", "de", "fr", "pt"]) {
    const name = item[`name_${language}`];
    if (name) {
      out.push({
        text: name,
        language
      });
    }

    for (const alias of item[`aliases_${language}`] || []) {
      out.push({
        text: alias,
        language
      });
    }
  }

  return out;
}


function lexiconMatch(text, entry) {
  const matches = [];

  for (const [language, terms] of Object.entries(entry.terms || {})) {
    for (const term of terms || []) {
      if (phraseMatch(text, term)) {
        matches.push({
          language,
          term
        });
      }
    }
  }

  if (!matches.length) {
    return null;
  }

  matches.sort(
    (a, b) =>
      normalizeText(b.term).length -
      normalizeText(a.term).length
  );

  return {
    matched: matches[0].term,
    matchedLanguages: [
      ...new Set(
        matches.map(item => item.language)
      )
    ]
  };
}


function detectQueryLanguage(text, groups = []) {
  const scores = new Map(
    Object.keys(QUERY_LANGUAGE_WORDS)
      .map(language => [language, 0])
  );

  for (const group of groups) {
    for (const item of group || []) {
      for (const language of item.matchedLanguages || []) {
        scores.set(
          language,
          (scores.get(language) || 0) + 4
        );
      }

      if (item.matchedLanguage) {
        scores.set(
          item.matchedLanguage,
          (scores.get(item.matchedLanguage) || 0) + 4
        );
      }
    }
  }

  const tokens = new Set(
    normalizeText(text)
      .split(/\s+/)
      .filter(Boolean)
  );

  for (const [language, words] of Object.entries(QUERY_LANGUAGE_WORDS)) {
    for (const word of words) {
      if (tokens.has(normalizeText(word))) {
        scores.set(
          language,
          (scores.get(language) || 0) + 1
        );
      }
    }
  }

  const original = String(text || "");

  if (/[ß]/i.test(original)) {
    scores.set("de", (scores.get("de") || 0) + 3);
  }

  if (/[ãõ]/i.test(original)) {
    scores.set("pt", (scores.get("pt") || 0) + 3);
  }

  if (/[¿¡ñ]/i.test(original)) {
    scores.set("es", (scores.get("es") || 0) + 3);
  }

  if (/[œ]/i.test(original)) {
    scores.set("fr", (scores.get("fr") || 0) + 3);
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1]);

  if (!ranked.length || ranked[0][1] <= 0) {
    return "unknown";
  }

  if (
    ranked.length > 1 &&
    ranked[0][1] === ranked[1][1]
  ) {
    return "unknown";
  }

  return ranked[0][0];
}


function detectPhilosophers(text, map) {
  const results = [];

  for (const philosopher of map.philosophers || []) {
    const candidates = [
      philosopher.name,
      ...(philosopher.aliases || [])
    ];

    for (const candidate of candidates) {
      if (phraseMatch(text, candidate)) {
        results.push({
          id: philosopher.id,
          name: philosopher.name,
          matched: candidate,
          confidence: 1.0,
          areas: philosopher.areas || []
        });

        break;
      }
    }
  }

  return uniqueById(results);
}


function detectConcepts(text, map) {
  const results = [];

  for (const concept of map.concepts || []) {
    for (const candidate of candidateList(concept)) {
      if (phraseMatch(text, candidate.text)) {
        results.push({
          id: concept.id,
          name_es: concept.name_es,
          name_en: concept.name_en,
          matched: candidate.text,
          matchedLanguage: candidate.language,
          matchedLanguages: [candidate.language],
          confidence: 1.0,
          areas: concept.areas || []
        });

        break;
      }
    }
  }

  return uniqueById(results);
}


function detectAreasDirectly(text, map) {
  const results = [];
  const areaIndex = new Map(
    (map.areas || []).map(area => [area.id, area])
  );

  /*
   * The multilingual lexicon comes first because it can preserve the
   * lexical meaning that the user actually wrote. In particular,
   * "ontología" translates to "ontology", not to the broader canonical
   * area label "Metaphysics".
   */
  for (const entry of QUERY_AREA_TERMS) {
    const match = lexiconMatch(text, entry);
    if (!match) continue;

    const area = areaIndex.get(entry.areaId);
    if (!area) continue;

    results.push({
      id: area.id,
      name_es: area.name_es,
      name_en: area.name_en,
      matched: match.matched,
      matchedEnglish: entry.english,
      matchedLanguages: match.matchedLanguages,
      confidence: 1.0,
      reason: "explicit-multilingual"
    });
  }

  for (const area of map.areas || []) {
    for (const candidate of candidateList(area)) {
      if (phraseMatch(text, candidate.text)) {
        results.push({
          id: area.id,
          name_es: area.name_es,
          name_en: area.name_en,
          matched: candidate.text,
          matchedEnglish: area.name_en,
          matchedLanguage: candidate.language,
          matchedLanguages: [candidate.language],
          confidence: 1.0,
          reason: "explicit"
        });

        break;
      }
    }
  }

  return uniqueById(results);
}


function detectDomains(text) {
  const results = [];

  for (const entry of QUERY_DOMAIN_TERMS) {
    const match = lexiconMatch(text, entry);
    if (!match) continue;

    results.push({
      id: entry.id,
      name_en: entry.english,
      matched: match.matched,
      matchedEnglish: entry.english,
      matchedLanguages: match.matchedLanguages,
      confidence: 1.0
    });
  }

  return uniqueById(results);
}


function inferAreas(
  directAreas,
  concepts,
  philosophers,
  works,
  map
) {
  const scores = new Map();

  function addScore(areaId, amount, reason) {
    if (!scores.has(areaId)) {
      scores.set(areaId, {
        score: 0,
        reasons: []
      });
    }

    const item = scores.get(areaId);
    item.score += amount;
    item.reasons.push(reason);
  }

  for (const area of directAreas) {
    addScore(area.id, 1.0, "explicit");
  }

  for (const concept of concepts) {
    for (const areaId of concept.areas || []) {
      addScore(areaId, 0.55, `concept:${concept.id}`);
    }
  }

  for (const work of works) {
    for (const areaId of work.areas || []) {
      addScore(areaId, 0.85, `work:${work.id}`);
    }
  }

  for (const philosopher of philosophers) {
    for (const areaId of philosopher.areas || []) {
      addScore(areaId, 0.15, `philosopher:${philosopher.id}`);
    }
  }

  const areaIndex = new Map(
    (map.areas || []).map(area => [area.id, area])
  );

  return [...scores.entries()]
    .map(([id, data]) => {
      const area = areaIndex.get(id);

      return {
        id,
        name_es: area?.name_es || id,
        name_en: area?.name_en || id,
        confidence: Math.min(data.score, 1),
        reasons: data.reasons
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}


function detectWorks(text, map) {
  const results = [];

  for (const work of map.works || []) {
    const titles = [];

    for (const [language, values] of Object.entries(work.titles || {})) {
      for (const value of values) {
        titles.push({
          text: value,
          language
        });
      }
    }

    if (work.canonical_title) {
      titles.push({
        text: work.canonical_title,
        language: "en"
      });
    }

    for (const title of titles) {
      if (phraseMatch(text, title.text)) {
        results.push({
          id: work.id,
          author: work.author,
          canonicalTitle: work.canonical_title,
          matched: title.text,
          matchedLanguage: title.language,
          matchedLanguages: [title.language],
          confidence: 1.0,
          areas: work.areas || []
        });

        break;
      }
    }
  }

  return uniqueById(results);
}


export function parseQuery(text, philosophyMap) {
  const original = String(text || "").trim();

  const philosophers = detectPhilosophers(
    original,
    philosophyMap
  );

  const concepts = detectConcepts(
    original,
    philosophyMap
  );

  const explicitAreas = detectAreasDirectly(
    original,
    philosophyMap
  );

  const works = detectWorks(
    original,
    philosophyMap
  );

  const domains = detectDomains(original);

  const areas = inferAreas(
    explicitAreas,
    concepts,
    philosophers,
    works,
    philosophyMap
  );

  return {
    original,
    normalized: normalizeText(original),
    language: detectQueryLanguage(
      original,
      [
        concepts,
        works,
        explicitAreas,
        domains
      ]
    ),

    philosophers,
    concepts,
    works,
    explicitAreas,
    domains,
    areas
  };
}

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

function detectLanguage(text) {
  const original = String(text || "");
  const normalized = normalizeText(original);

  if (/[áéíóúüñ¿¡]/i.test(original)) {
    return "es";
  }

  const spanishHints = [
    "filosofia",
    "libertad",
    "albedrio",
    "determinismo",
    "verdad",
    "conocimiento",
    "justicia",
    "mente",
    "cuerpo",
    "razon",
    "virtud",
    "ser",
    "tiempo",
    "etica",
    "estetica",
    "epistemologia",
    "metafisica",
    "conciencia",
    "lenguaje",
    "de",
    "del",
    "en",
    "y"
  ];

  const englishHints = [
    "philosophy",
    "freedom",
    "will",
    "determinism",
    "truth",
    "knowledge",
    "justice",
    "mind",
    "body",
    "reason",
    "virtue",
    "being",
    "time",
    "ethics",
    "aesthetics",
    "epistemology",
    "metaphysics",
    "consciousness",
    "language",
    "of",
    "the",
    "and"
  ];

  let es = 0;
  let en = 0;

  for (const word of spanishHints) {
    if (phraseMatch(normalized, word)) es++;
  }

  for (const word of englishHints) {
    if (phraseMatch(normalized, word)) en++;
  }

  if (es > en) return "es";
  if (en > es) return "en";

  return "unknown";
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
    const candidates = [
      concept.name_es,
      concept.name_en,
      ...(concept.aliases_es || []),
      ...(concept.aliases_en || [])
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (phraseMatch(text, candidate)) {
        results.push({
          id: concept.id,
          name_es: concept.name_es,
          name_en: concept.name_en,
          matched: candidate,
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

  for (const area of map.areas || []) {
    const candidates = [
      area.name_es,
      area.name_en,
      ...(area.aliases_es || []),
      ...(area.aliases_en || [])
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (phraseMatch(text, candidate)) {
        results.push({
          id: area.id,
          name_es: area.name_es,
          name_en: area.name_en,
          matched: candidate,
          confidence: 1.0,
          reason: "explicit"
        });

        break;
      }
    }
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
    addScore(
      area.id,
      1.0,
      "explicit"
    );
  }

  for (const concept of concepts) {
    for (const areaId of concept.areas || []) {
      addScore(
        areaId,
        0.55,
        `concept:${concept.id}`
      );
    }
  }

  for (const work of works) {
    for (const areaId of work.areas || []) {
      addScore(
        areaId,
        0.85,
        `work:${work.id}`
      );
    }
  }

  for (const philosopher of philosophers) {
    for (const areaId of philosopher.areas || []) {
      addScore(
        areaId,
        0.15,
        `philosopher:${philosopher.id}`
      );
    }
  }

  const areaIndex = new Map(
    (map.areas || []).map(
      area => [area.id, area]
    )
  );

  return [...scores.entries()]
    .map(([id, data]) => {
      const area = areaIndex.get(id);

      return {
        id,
        name_es: area?.name_es || id,
        name_en: area?.name_en || id,
        confidence: Math.min(
          data.score,
          1
        ),
        reasons: data.reasons
      };
    })
    .sort(
      (a, b) =>
        b.confidence - a.confidence
    );
}

function detectWorks(text, map) {
  const results = [];

  for (const work of map.works || []) {
    const titles = [];

    for (const values of Object.values(work.titles || {})) {
      titles.push(...values);
    }

    if (work.canonical_title) {
      titles.push(work.canonical_title);
    }

    for (const title of titles) {
      if (phraseMatch(text, title)) {
        results.push({
          id: work.id,
          author: work.author,
          canonicalTitle: work.canonical_title,
          matched: title,
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
    language: detectLanguage(original),

    philosophers,
    concepts,
    works,
    explicitAreas,
    areas
  };
}

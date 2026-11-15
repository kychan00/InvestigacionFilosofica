const RELATION_CATEGORY_DEFINITIONS = Object.freeze([
  ["Ética", /\b(?:etic|moral|virtud|deber|responsab|dignidad|bioetic|clemencia|bien|mal)\w*\b/],
  ["Política", /\b(?:politic|democr|estado|ciudadan|gobiern|poder|socialis|capitalis|neoliberal|ideolog|libertad|emancip)\w*\b/],
  ["Epistemología", /\b(?:epistem|conocim|verdad|certeza|creencia|saber|objetividad|perspectiv|incomprension)\w*\b/],
  ["Ontología", /\b(?:ontolog|metafis|ser|existencia|sustancia|realidad|objeto|cosa-en-si|noou?meno|noumeno|inmendabilidad|inenmendabilidad)\w*\b/],
  ["Estética", /\b(?:estetic|arte|artist|belleza|fotorreal|museo|imagen|visual|fotograf|kandinsky)\w*\b/],
  ["Lenguaje y hermenéutica", /\b(?:lenguaj|linguist|semantic|signific|hermeneut|interpret|discurso|deconstru|derrida|logos|sintaxis|nombre)\w*\b/],
  ["Lógica y argumentación", /\b(?:logic|argument|falacia|razonam|inferencia|dialectic|proposicion|cuantificacion)\w*\b/],
  ["Fenomenología y existencia", /\b(?:fenomenolog|experiencia|percepcion|vacuidad|nihilism|absurd|angust|desamor|sinsentido|heidegger|husserl|merleau|asco)\w*\b/],
  ["Teoría crítica y marxismo", /\b(?:teoria critica|marx|marxism|adorno|horkheimer|benjamin|habermas|ranciere|cosific|mercancia|alienacion|capitalismo tardio)\w*\b/],
  ["Historia de la filosofía", /\b(?:historia de la filosofia|filosofia antigua|filosofia moderna|ilustracion|platon|aristotel|kant|hegel|nietzsche|voltaire|rousseau|maquiavelo|sade|levinas|foucault|deleuze|spinoza|descartes|galileo|copernic)\w*\b/],
  ["Educación", /\b(?:educa|pedagog|ensenan|aprendiz|universidad|formacion|estudiante|autogobierno)\w*\b/],
  ["Ciencia y filosofía de la ciencia", /\b(?:filosofia de la ciencia|ciencia|cientific|positivis|fisica|teoria m|teoria de cuerdas|galileo|copernic|arch[eé])\w*\b/],
  ["Tecnología y sociedad", /\b(?:tecnolog|digital|internet|algorit|inteligencia artificial|vigilancia algor|virtual|redes sociales)\w*\b/],
  ["Filosofía de la mente", /\b(?:mente|conciencia|alma|psicoanal|freud|cognitiv|deseo|afecto|pasion|vida animica)\w*\b/],
  ["Religión", /\b(?:relig|teolog|dios|fe|cristian|jesuit|sagrad|mosaico|biblia|jesus)\w*\b/],
  ["Género y feminismos", /\b(?:feminis|genero|mujer|mujeres|sexismo|sexualidad|segregacion)\w*\b/],
  ["Cultura e interculturalidad", /\b(?:cultur|sociedad|identidad|intercultural|colonial|decolonial|indigen|pueblos originarios|latinoamerica|comunidad|memoria|racismo|discriminacion)\w*\b/],
  ["Literatura y creación", /\b(?:literatur|poesia|poema|novela|ficcion|cuento|creacion|saramago|murakami|knausgard|ashbery|rulfo)\w*\b/],
  ["Recepción filosófica", /\b(?:resena|recension|entrevista|noticia bibliografica|avance de publicacion|comentario de libro)\w*\b/]
]);

export const PROTREPSIS_RELATION_CATEGORY_LABELS = Object.freeze(
  RELATION_CATEGORY_DEFINITIONS.map(([label]) => label).concat("Filosofía y cultura")
);

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  const output = [];
  const seen = new Set();
  for (const value of values || []) {
    const clean = String(value || "").trim();
    const key = normalize(clean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }
  return output;
}

function hasRule(rule, text) {
  return Boolean(text) && rule.test(text);
}

function documentKindBonus(label, record) {
  const kind = normalize(record?.editorialDocumentKind || record?.documentKind);
  if (!kind) return 0;
  if (kind.includes("review interview") || kind.includes("bibliographic")) {
    return label === "Recepción filosófica" ? 8 : 0;
  }
  if (kind.includes("creative") || kind.includes("non article")) {
    return label === "Literatura y creación" ? 8 : 0;
  }
  if (kind.includes("translation")) {
    if (label === "Historia de la filosofía") return 6;
    if (label === "Literatura y creación") return 2;
  }
  return 0;
}

export function protrepsisRelationCategoryMetadata(record, { limit = 4 } = {}) {
  const editorialKeywords = unique(record?.editorialKeywords || []);
  const keywordText = normalize(editorialKeywords.join(" "));
  const titleText = normalize([record?.title, ...(record?.titleVariants || [])].filter(Boolean).join(" "));
  const abstractText = normalize([record?.abstract, ...(record?.abstractVariants || [])].filter(Boolean).join(" "));
  const subjectText = normalize((record?.subjects || []).join(" "));
  const verifiedAbsent = String(record?.editorialKeywordStatus || "") === "verified-absent";

  const scored = RELATION_CATEGORY_DEFINITIONS.map(([label, rule], order) => {
    let score = documentKindBonus(label, record);
    const sources = [];
    if (hasRule(rule, keywordText)) {
      score += 8;
      sources.push("keywords");
    }
    if (hasRule(rule, titleText)) {
      score += 4;
      sources.push("title");
    }
    if (hasRule(rule, subjectText)) {
      score += editorialKeywords.length ? 1 : 2;
      sources.push("subjects");
    }
    if (hasRule(rule, abstractText)) {
      score += editorialKeywords.length ? 1 : 2;
      sources.push("abstract");
    }
    return { label, score, order, sources };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);

  let categories = scored.slice(0, Math.max(1, limit)).map(item => item.label);
  if (!categories.length) {
    const kind = normalize(record?.editorialDocumentKind || record?.documentKind);
    if (kind.includes("review") || kind.includes("interview") || kind.includes("bibliographic")) {
      categories = ["Recepción filosófica"];
    } else if (kind.includes("creative") || kind.includes("non article")) {
      categories = ["Literatura y creación"];
    } else if (kind.includes("translation")) {
      categories = ["Historia de la filosofía"];
    } else {
      categories = ["Filosofía y cultura"];
    }
  }

  const origin = editorialKeywords.length
    ? "keyword-derived"
    : verifiedAbsent
      ? "text-derived-no-keywords"
      : "text-derived";

  return {
    categories,
    primary: categories[0],
    origin,
    label: "Categorías de relación",
    note: editorialKeywords.length
      ? "Clasificación de navegación derivada principalmente de las palabras clave editoriales verificadas; título y resumen pueden añadir relaciones complementarias."
      : verifiedAbsent
        ? "Clasificación de navegación derivada del título, resumen y tipo documental porque esta publicación fue verificada sin palabras clave editoriales."
        : "Clasificación de navegación derivada del título y el resumen; no sustituye metadatos editoriales."
  };
}

export function protrepsisRelationCategories(record, options = {}) {
  return protrepsisRelationCategoryMetadata(record, options).categories;
}

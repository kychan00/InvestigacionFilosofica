const RELATION_CATEGORY_DEFINITIONS = Object.freeze([
  ["Teoría de la argumentación", /\b(?:argument|contraargument|metaargument|razon(?:es|amiento)?|ponderacion|esquema argumentativo|premisa|conclusion|fuerza argumentativa)\w*\b/],
  ["Lógica", /\b(?:logic|deduc|inferenc|silog|entimem|validez|proposicion|modus ponens|generalismo|particularismo|condicional|formal)\w*\b/],
  ["Retórica", /\b(?:retoric|persuasi|epidict|topica|declamacion|pistis|fides|orador|discurso figurado)\w*\b/],
  ["Dialéctica y pragma-dialéctica", /\b(?:dialect|pragma[ -]?dialect|discusion critica|dialog|polilogo|desacuerdo|adversarial|eristic)\w*\b/],
  ["Falacias y evaluación", /\b(?:falacia|evaluacion|derrotador|socavador|atenuador|refutacion|objecion|recusacion|error argumentativo)\w*\b/],
  ["Ética y bioética", /\b(?:etic|moral|bioetic|virtud|felicidad|dilema moral|medicina)\w*\b/],
  ["Política y deliberación", /\b(?:politic|democr|ciudadan|deliberacion|justicia|igualdad|redistribucion|reconocimiento|esfera publica|pluralismo|convivencia)\w*\b/],
  ["Educación y didáctica", /\b(?:educa|ensenan|aprendiz|didact|docencia|estudiante|formacion|escuela|pedagog|curso)\w*\b/],
  ["Derecho y argumentación jurídica", /\b(?:derecho|jurid|penal|acusatorio|legal|tribunal)\w*\b/],
  ["Epistemología y racionalidad", /\b(?:epistem|conocim|verdad|racional|razonabilidad|justific|objetividad|antirrealismo|realismo)\w*\b/],
  ["Lenguaje, pragmática y discurso", /\b(?:lenguaj|pragmat|acto de habla|texto|narrativ|semant|discurso|comunic|ilocucion|silencio)\w*\b/],
  ["Historia de la filosofía", /\b(?:aristotel|platon|socrates|jenofonte|boecio|schopenhauer|sade|milton|beauvoir|vaz ferreira|antiguedad|grecia|roma|quintiliano|seneca)\w*\b/],
  ["Cultura e historia intelectual", /\b(?:cultur|mexic|jalisco|cuba|reformismo|prensa|siglo xix|che guevara|fidel castro|anahuac|alfonso reyes)\w*\b/],
  ["Tecnología y sociedad", /\b(?:tecnolog|electronic|digital|internet|redes|plataforma)\w*\b/],
  ["Recepción y reseñas", /\b(?:resena|recension|review|manual de argumentacion|obra immanent reasoning|coleccion tablero de disertaciones)\w*\b/]
]);

export const QUADRIPARTITA_RELATION_CATEGORY_LABELS = Object.freeze(
  RELATION_CATEGORY_DEFINITIONS.map(([label]) => label).concat("Filosofía y argumentación")
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
  rule.lastIndex = 0;
  return Boolean(text) && rule.test(text);
}

function documentKindBonus(label, record) {
  const kind = normalize(record?.editorialDocumentKind || record?.documentKind);
  const title = normalize(record?.title);
  const isReview = kind.includes("review") || title.includes("resena") || title.includes("recension");
  if (isReview && label === "Recepción y reseñas") return 10;
  return 0;
}

export function quadripartitaRelationCategoryMetadata(record, { limit = 4 } = {}) {
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
    // "Teoría de la argumentación" es la categoría transversal de la revista.
    // Conserva su relación, pero en empates cede la categoría principal a
    // áreas más específicas (Lógica, Retórica, Política, Bioética, etc.).
    if (label === "Teoría de la argumentación" && score > 1) score -= 1;
    return { label, score, order, sources };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);

  let categories = scored.slice(0, Math.max(1, limit)).map(item => item.label);
  if (!categories.length) {
    const kind = normalize(record?.editorialDocumentKind || record?.documentKind);
    const title = normalize(record?.title);
    categories = kind.includes("review") || title.includes("resena")
      ? ["Recepción y reseñas"]
      : ["Filosofía y argumentación"];
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
      ? "Clasificación de navegación derivada principalmente de las palabras clave editoriales verificadas de Quadripartita Ratio; título y resumen sólo añaden relaciones complementarias."
      : verifiedAbsent
        ? "Clasificación de navegación derivada del título, resumen y tipo documental porque esta publicación fue verificada sin palabras clave editoriales."
        : "Clasificación de navegación derivada del título y el resumen; no sustituye metadatos editoriales."
  };
}

export function quadripartitaRelationCategories(record, options = {}) {
  return quadripartitaRelationCategoryMetadata(record, options).categories;
}

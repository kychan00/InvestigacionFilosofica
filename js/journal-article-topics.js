const TOPIC_RULES = [
  ["Epistemología crítica", /\bepistemolog(?:ia|ico|ica|icamente)\s+critic|\bcritica\s+epistemolog/],
  ["Violencia cultural", /\bviolencia\s+cultural\b/],
  ["Discriminación racial", /\bdiscriminacion\s+racial\b|\bracismo\b/],
  ["Estudiantes indígenas", /\bestudiantes?\s+(?:indigenas|de\s+pueblos?\s+originarios)\b/],
  ["Educación intercultural", /\beducacion\s+intercultural\b|\binterculturalidad\s+educativ/],
  ["Justicia epistémica", /\bjusticia\s+epistemic/],
  ["Violencia simbólica", /\bviolencia\s+simbolic/],
  ["Exclusión epistémica", /\bexclusion\s+epistemic|\binjusticia\s+epistemic/],
  ["Pueblos originarios", /\bpueblos?\s+originarios\b|\bpueblos?\s+indigenas\b|\bsaberes?\s+indigenas\b/],
  ["Interculturalidad", /\bintercultural/],
  ["Colonialidad", /\bcolonialidad\b|\bcolonialismo\b/],
  ["Decolonialidad", /\bdecolonial|\bdescoloniz/],
  ["Racismo", /\bracis(?:mo|ta|tas)\b|\bracializacion\b/],
  ["Discriminación", /\bdiscriminacion\b/],
  ["Violencia", /\bviolencia\b/],
  ["Educación", /\beducacion\b|\bpedagog|\bensenanza\b|\baprendizaje\b/],
  ["Justicia", /\bjusticia\b/],
  ["Poder", /\bpoder\b|\bhegemon|\bdominacion\b/],
  ["Epistemología", /\bepistemolog|\bconocimiento\b|\bsaber(?:es)?\b/],
  ["Verdad", /\bverdad\b|\bproduccion\s+de\s+verdad\b/],
  ["Ética", /\betica\b|\bmoral\b|\bvirtud\b|\bresponsabilidad\b/],
  ["Bioética", /\bbioetica\b/],
  ["Política", /\bpolitic|\bdemocr|\bestado\b|\bciudadan/],
  ["Ontología", /\bontolog|\bser\b|\bexistencia\b/],
  ["Metafísica", /\bmetafis|\bsustancia\b/],
  ["Fenomenología", /\bfenomenolog|\bhusserl\b|\bheidegger\b|\bmerleau/],
  ["Filosofía de la mente", /\bfilosofia\s+de\s+la\s+mente\b|\bmente\b|\bconciencia\b/],
  ["Lenguaje", /\blenguaje\b|\blinguist|\bsemant|\bdiscurso\b/],
  ["Hermenéutica", /\bhermeneut|\binterpretacion\b/],
  ["Lógica", /\blogic|\binferencia\b|\bfalacia\b/],
  ["Argumentación", /\bargument|\brazonamiento\b/],
  ["Dialéctica", /\bdialectic/],
  ["Teoría crítica", /\bteoria\s+critica\b|\bfrankfurt\b|\badorno\b|\bhorkheimer\b/],
  ["Marxismo", /\bmarx(?:ismo|ista)?\b|\bmarx\b/],
  ["Feminismo", /\bfeminis/],
  ["Género", /\bgenero\b|\bsexo\b|\bsexualidad\b/],
  ["Estética", /\bestetic|\bbelleza\b/],
  ["Arte", /\barte\b|\bartistic/],
  ["Literatura", /\bliteratur|\bpoesia\b|\bnovela\b|\bficcion\b/],
  ["Religión", /\brelig|\bteolog|\bdios\b|\bfe\b/],
  ["Ciencia", /\bciencia\b|\bcientific/],
  ["Tecnología", /\btecnolog|\bdigital\b|\binternet\b|\balgoritm/],
  ["Inteligencia artificial", /\binteligencia\s+artificial\b|\bmachine\s+learning\b/],
  ["Historia de la filosofía", /\bhistoria\s+de\s+la\s+filosofia\b|\bfilosofia\s+antigua\b|\bfilosofia\s+moderna\b/]
];

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  const seen = new Set();
  const output = [];
  for (const value of values || []) {
    const clean = String(value || "").trim().replace(/\s+/g, " ");
    if (!clean) continue;
    const key = normalize(clean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }
  return output;
}

export function derivedArticleTopics(record, limit = 8) {
  const text = normalize([
    record?.title,
    ...(record?.titleVariants || []),
    record?.abstract,
    ...(record?.abstractVariants || [])
  ].filter(Boolean).join(" "));
  if (!text) return [];

  const topics = [];
  for (const [label, rule] of TOPIC_RULES) {
    if (rule.test(text)) topics.push(label);
    if (topics.length >= limit) break;
  }
  return topics;
}

export function articleTopicMetadata(record, { derive = true, limit = 8 } = {}) {
  const editorial = unique(record?.editorialKeywords || []);
  if (editorial.length) {
    return {
      topics: editorial.slice(0, limit),
      allTopics: editorial,
      origin: "editorial",
      label: "Palabras clave editoriales",
      note: "Publicadas por la revista en la ficha original del artículo."
    };
  }

  const documented = unique(record?.subjects || []);
  if (documented.length) {
    const openAlex = String(record?.historicalSource || "").toLowerCase().includes("openalex");
    return {
      topics: documented.slice(0, limit),
      allTopics: documented,
      origin: openAlex ? "bibliographic" : "documented",
      label: openAlex ? "Temas bibliográficos" : "Temas documentados",
      note: openAlex
        ? "Etiquetas bibliográficas recuperadas de OpenAlex; no equivalen a palabras clave editoriales de la revista."
        : "Metadatos temáticos documentados en el registro."
    };
  }

  const derived = derive ? derivedArticleTopics(record, limit) : [];
  return {
    topics: derived,
    allTopics: derived,
    origin: "derived",
    label: "Temas del texto",
    note: "Derivados del título y el resumen para navegación; no sustituyen palabras clave editoriales."
  };
}

export function articleTopics(record, options = {}) {
  return articleTopicMetadata(record, options).topics;
}

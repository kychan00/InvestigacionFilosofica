/* Sincronía — capas distintas: etiquetas documentadas y categorías de relación.
 * Las categorías son interpretación para navegación, nunca keywords editoriales.
 * No se modifica ningún campo del corpus ni se inventan temas publicados.
 */
const CATEGORY_RULES = Object.freeze([
  ["Literatura y creación", /\b(?:literatur|literatura comparada|poesi|poema|poetica|narrativ|novela|cuento|ficcion|dramaturg|teatro|escritura creativa|ensayo literario|literary|poetry|fiction)\w*\b/],
  ["Crítica literaria y teoría narrativa", /\b(?:critica literaria|teoria literaria|intertextual|narratolog|genero literario|analisis literario|recepti(?:on|vidad) literaria|semiotica literaria|narratology|literary criticism)\w*\b/],
  ["Filosofía y epistemología", /\b(?:filosof|epistemolog|metafis|ontolog|gnoseolog|conocimiento|hermeneut|fenomenolog|filosofi|philosoph|epistemol)\w*\b/],
  ["Ética y pensamiento moral", /\b(?:etic|moral|bioetic|deontolog|virtud|dilema moral|responsabilidad moral|ethical|ethics|moralidade)\w*\b/],
  ["Política y democracia", /\b(?:politic|democr|ciudadan|gobernan|participacion politica|estado de derecho|partidos politicos|representacion politica|political|democracy)\w*\b/],
  ["Historia y memoria", /\b(?:historiograf|memoria historic|historia social|historia cultural|historia de mexico|siglo xix|siglo xx|archivo historico|pasado colectivo|historic|history|historia)\w*\b/],
  ["Cultura e identidad", /\b(?:cultur|identidad|patrimonio|tradicion|costumbre|representacion cultural|intercultural|multicultural|simbolic|culture|identity|cultura)\w*\b/],
  ["Antropología y pueblos originarios", /\b(?:antropolog|etnograf|etnolog|pueblo(?:s)? originario|indigen|comunidad indigena|cosmovision|nahua|maya|zapotec|wixarika|anthropolog|indigenous)\w*\b/],
  ["Género, feminismos y sexualidades", /\b(?:feminis|genero|perspectiva de genero|mujeres|mujer|masculinidad|sexualidad|queer|patriarc|violencia de genero|gender|feminism|sexualidade)\w*\b/],
  ["Educación y pedagogía", /\b(?:educac|pedagog|didactic|ensenan|aprendiz|escuela|docencia|universidad|estudiante|curricul|formacion docente|educational|teaching|aprendizagem)\w*\b/],
  ["Lenguaje y lingüística", /\b(?:linguist|lenguaj|lexic|gramatic|sintax|pragmatica linguistica|semantica linguistica|traduccion|discurso linguistico|idioma|language|linguistics|linguagem)\w*\b/],
  ["Comunicación, medios y periodismo", /\b(?:comunicacion|periodis|prensa|medios de comunicacion|television|radiofon|fotoperiodismo|noticier|audiovisual|mass media|journalism|communication)\w*\b/],
  ["Arte, estética y patrimonio", /\b(?:estetic|artistic|artes visuales|historia del arte|pintura|escultura|fotografia|cine|musica|museo|arquitectura|performance|visual art|film studies|cinema|estetica)\w*\b/],
  ["Tecnología y cultura digital", /\b(?:tecnolog|digital|internet|redes sociales|inteligencia artificial|ciber|virtual|algoritm|software|informat|plataforma digital|technology|technological|digitalidade)\w*\b/],
  ["Religiones, mitos y espiritualidad", /\b(?:religio|teolog|espiritual|cristian|catolic|islam|budis|iglesia|biblia|sagrad|mitolog|mito|religion|religious|espiritualidade)\w*\b/],
  ["Psicología y subjetividad", /\b(?:psicolog|psicoanal|subjetividad|identidad personal|emocion|afecto|trauma|salud mental|cognicion|personalidad|psycholog|subjectivit)\w*\b/],
  ["Sociología y vida social", /\b(?:sociolog|desigualdad social|clase social|estratific|vida cotidiana|movimientos sociales|tejido social|sociedad civil|socializ|sociology|social inequality)\w*\b/],
  ["Estudios latinoamericanos", /\b(?:latinoameric|america latina|iberoameric|mexico|mexican|jalisco|brasil|chile|argentina|colombia|caribe|latin america|latin american|latinoamerica)\w*\b/],
  ["Migración, fronteras y territorio", /\b(?:migrac|migrante|inmigrac|emigrac|fronter|territorial|territorio|diaspora|refugiad|desplazamiento forzado|migration|border|migra)\w*\b/],
  ["Derechos humanos y justicia", /\b(?:derechos humanos|derecho human|justicia social|discriminac|exclusion social|violencia estructural|paz social|derecho constitucional|derecho penal|human rights|human right|humanos)\w*\b/],
  ["Economía, trabajo y desigualdad", /\b(?:econom|trabajo|laboral|capitalismo|neoliberal|pobreza|mercado|consumo|produccion social|precariedad|desarrollo economico|economic|labour|labor market)\w*\b/],
  ["Medio ambiente y ecología", /\b(?:ambient|ecolog|naturalez|sustentab|sostenib|cambio climatico|biodivers|recursos naturales|agua potable|contaminacion|environment|ecology|ecologico)\w*\b/],
  ["Ciencia, salud y sociedad", /\b(?:ciencia|cientific|salud publica|medicina|enfermedad|epidemiolog|investigacion cientifica|biotecnolog|science|health|scientific|saude)\w*\b/],
  ["Reseñas, entrevistas y recepción", /\b(?:resena|recension|rese[ñn]a|entrevista|conversacion con|comentario de libro|presentacion de libro|book review|interview|review essay)\w*\b/]
]);

export const SINCRONIA_RELATION_CATEGORY_LABELS = Object.freeze(
  CATEGORY_RULES.map(([label]) => label).concat("Humanidades y cultura")
);

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
  const result = [];
  const seen = new Set();
  for (const value of values || []) {
    const label = String(value || "").trim().replace(/\s+/g, " ");
    const key = normalize(label);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(label);
    }
  }
  return result;
}

function verifiedEditorialKeywords(record) {
  const source = String(record?.editorialKeywordSource || "");
  return source === "verified-publication" || source === "ojs-article"
    ? unique(record?.editorialKeywords)
    : [];
}

/* Estas son etiquetas recuperadas, no inferidas del resumen. Si el registro
 * solo ofrece título/resumen, el área de palabras clave queda explícitamente
 * vacía, aunque sí tenga categorías de navegación derivadas.
 */
export function sincroniaKeywordMetadata(record, { limit = 12 } = {}) {
  const editorial = verifiedEditorialKeywords(record);
  if (editorial.length) {
    return {
      topics: editorial.slice(0, limit),
      allTopics: editorial,
      origin: "editorial",
      label: "Palabras clave editoriales",
      note: "Palabras clave verificadas en la publicación original de Sincronía.",
      emptyLabel: ""
    };
  }

  const bibliographic = unique(record?.subjects);
  if (bibliographic.length) {
    return {
      topics: bibliographic.slice(0, limit),
      allTopics: bibliographic,
      origin: "bibliographic",
      label: "Temas bibliográficos registrados",
      note: "Etiquetas temáticas presentes en el registro; no se presentan como palabras clave editoriales verificadas.",
      emptyLabel: ""
    };
  }

  return {
    topics: [],
    allTopics: [],
    origin: "none",
    label: "Temas bibliográficos registrados",
    note: "Este registro no aporta palabras clave editoriales verificadas ni etiquetas temáticas documentadas.",
    emptyLabel: "Sin palabras clave verificadas"
  };
}

export function sincroniaKeywords(record) {
  return sincroniaKeywordMetadata(record, { limit: Number.POSITIVE_INFINITY }).allTopics;
}

export function sincroniaRelationCategoryMetadata(record, { limit = 4 } = {}) {
  const verified = verifiedEditorialKeywords(record);
  const subjects = unique(record?.subjects);
  const editorialText = normalize(verified.join(" "));
  const subjectsText = normalize(subjects.join(" "));
  const titleText = normalize([record?.title, ...(record?.titleVariants || [])].join(" "));
  const abstractText = normalize([record?.abstract, ...(record?.abstractVariants || [])].join(" "));
  const kind = normalize(record?.documentKind || record?.editorialDocumentKind);
  const title = normalize(record?.title);

  const ranked = CATEGORY_RULES.map(([label, rule], order) => {
    let score = 0;
    if (rule.test(editorialText)) score += 9;
    if (rule.test(subjectsText)) score += verified.length ? 3 : 7;
    if (rule.test(titleText)) score += 5;
    if (rule.test(abstractText)) score += 1;
    if (label === "Reseñas, entrevistas y recepción" &&
      /\b(?:review|interview|resena|entrevista|bibliographic)\b/.test(kind)) score += 12;
    if (label === "Literatura y creación" &&
      /\b(?:creative|poetry|poem|literary)\b/.test(kind)) score += 12;
    return { label, score, order };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);

  let categories = ranked.slice(0, Math.max(1, Math.floor(limit) || 1)).map(item => item.label);
  if (!categories.length) {
    if (/\b(?:resena|entrevista|review|interview)\b/.test(title + " " + kind)) {
      categories = ["Reseñas, entrevistas y recepción"];
    } else if (/\b(?:poetry|poema|cuento|creacion literaria|creative)\b/.test(title + " " + kind)) {
      categories = ["Literatura y creación"];
    } else {
      categories = ["Humanidades y cultura"];
    }
  }

  return {
    categories,
    primary: categories[0],
    origin: verified.length ? "keyword-derived" : subjects.length ? "metadata-derived" : "text-derived",
    label: "Categorías de relación",
    note: verified.length
      ? "Categorías de navegación priorizadas por palabras clave editoriales verificadas; el título y el resumen sólo complementan las relaciones."
      : subjects.length
        ? "Categorías de navegación derivadas de temas bibliográficos del registro, título y resumen. No son palabras clave editoriales de Sincronía."
        : "Categorías de navegación derivadas del título, resumen o tipo documental; no se han inventado palabras clave editoriales."
  };
}

export function sincroniaRelationCategories(record, options = {}) {
  return sincroniaRelationCategoryMetadata(record, options).categories;
}

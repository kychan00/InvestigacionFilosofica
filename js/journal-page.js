import { protrepsisMissingKeywordStatus } from "./protrepsis-editorial-status.js";
import { JournalSemanticAtlas } from "./journal-atlas.js?v=20261113-topic-tags-v1";
import {
  articleTopicMetadata,
  articleTopics
} from "./journal-article-topics.js?v=20261113-categories-v2";
import {
  protrepsisRelationCategories,
  protrepsisRelationCategoryMetadata
} from "./protrepsis-relation-categories.js?v=20261114-relations-v1";
import {
  quadripartitaRelationCategories,
  quadripartitaRelationCategoryMetadata
} from "./quadripartita-relation-categories.js?v=20261114-relations-v1";
import {
  journalIssueGroups,
  journalIssueInfo
} from "./journal-issues.js?v=20261112-history-v2";

const SITE_ROOT = new URL("../", import.meta.url);
const DATA_URL = new URL("src/data/cucsh-filosofia.json", SITE_ROOT);
const PROTREPSIS_KEYWORDS_URL = new URL("src/data/protrepsis-editorial-keywords.json", SITE_ROOT);
const PROTREPSIS_RECOVERY_URL = new URL("src/data/protrepsis-editorial-recovery-queue.json", SITE_ROOT);
const QUADRIPARTITA_KEYWORDS_URL = new URL("src/data/quadripartita-editorial-keywords.json", SITE_ROOT);
const QUADRIPARTITA_RECOVERY_URL = new URL("src/data/quadripartita-editorial-recovery-queue.json", SITE_ROOT);
const PAGE_SIZE = 18;

const JOURNALS = {
  protrepsis: {
    label: "Protrepsis",
    matcher: value => /protrepsis/i.test(value || ""),
    source: "http://protrepsis.cucsh.udg.mx/",
    accent: "#0f62fe",
    accent2: "#78a9ff",
    mark: "Π",
    motto: "Archivo editorial · filosofía · CUCSH"
  },
  sincronia: {
    label: "Sincronía",
    matcher: value => /sincron/i.test(value || ""),
    source: "https://revistasincronia.cucsh.udg.mx/index.php/sincronia",
    accent: "#8a3ffc",
    accent2: "#d4bbff",
    mark: "Σ",
    motto: "Archivo interdisciplinario · CUCSH"
  },
  quadripartita: {
    label: "Quadripartita Ratio",
    matcher: value => /quadripartita/i.test(value || ""),
    source: "https://quadripartitaratio.cucsh.udg.mx/",
    accent: "#007d79",
    accent2: "#3ddbd9",
    mark: "Q",
    motto: "Archivo editorial · razón · argumentación"
  }
};

const CATEGORY_RULES = [
  ["Ética", /\b(etic|moral|virtud|responsab|bioetic|deontolog)/],
  ["Política", /\b(politic|democr|poder|estado|justicia|ciudadan|marx|capital|ideolog)/],
  ["Epistemología", /\b(epistem|conocim|verdad|certeza|creencia|saber|ciencia)/],
  ["Ontología", /\b(ontolog|metafis|ser\b|existenc|realidad|sustancia)/],
  ["Estética", /\b(estetic|arte\b|belleza|poetic|literatur|imagen|musica)/],
  ["Lenguaje", /\b(lenguaj|linguist|signific|semant|discurso|hermeneut|interpret)/],
  ["Lógica y argumentación", /\b(logic|argument|falacia|razonam|inferencia|dialectic)/],
  ["Fenomenología", /\b(fenomen|husserl|heidegger|merleau|conciencia|experiencia)/],
  ["Teoría crítica", /\b(critic|frankfurt|adorno|horkheimer|benjamin|habermas|cosific)/],
  ["Historia de la filosofía", /\b(histori|antigu|medieval|modern|contempor|platon|aristotel|kant|hegel|nietzsche)/],
  ["Educación", /\b(educa|pedagog|ensenan|aprendiz|universidad|formacion)/],
  ["Tecnología y sociedad", /\b(tecnolog|digital|internet|algorit|inteligencia artificial|virtual)/],
  ["Cultura y sociedad", /\b(cultur|socied|identidad|memoria|genero|femin|colon|america latina|mexic)/],
  ["Religión", /\b(relig|dios|teolog|fe\b|crist|sagrad)/]
];

const CATEGORY_COLORS = {
  "Ética": "#fa4d56",
  "Política": "#da1e28",
  "Epistemología": "#0f62fe",
  "Ontología": "#6929c4",
  "Estética": "#d02670",
  "Lenguaje": "#1192e8",
  "Lógica y argumentación": "#005d5d",
  "Fenomenología": "#8a3ffc",
  "Teoría crítica": "#a2191f",
  "Historia de la filosofía": "#6f6f6f",
  "Educación": "#198038",
  "Tecnología y sociedad": "#0072c3",
  "Cultura y sociedad": "#b28600",
  "Religión": "#9f1853",
  "Lenguaje y hermenéutica": "#1192e8",
  "Fenomenología y existencia": "#8a3ffc",
  "Teoría crítica y marxismo": "#a2191f",
  "Ciencia y filosofía de la ciencia": "#0043ce",
  "Filosofía de la mente": "#007d79",
  "Género y feminismos": "#d12771",
  "Cultura e interculturalidad": "#b28600",
  "Literatura y creación": "#8a3800",
  "Recepción filosófica": "#6f6f6f",
  "Filosofía y cultura": "#525252",
  "Otros": "#525252"
};

const journalId = document.body.dataset.journal;
const supportsCuratorialFacets = journalId === "protrepsis" || journalId === "quadripartita";
const config = JOURNALS[journalId] || JOURNALS.protrepsis;

const state = {
  records: [],
  query: "",
  decade: "all",
  language: "all",
  category: "all",
  keyword: "all",
  issue: "all",
  doiOnly: false,
  abstractOnly: false,
  sort: "newest",
  limit: PAGE_SIZE,
  view: "archive"
};

const el = {
  total: document.querySelector("#journal-total"),
  span: document.querySelector("#journal-year-span"),
  authors: document.querySelector("#journal-author-total"),
  doiRate: document.querySelector("#journal-doi-rate"),
  abstractRate: document.querySelector("#journal-abstract-rate"),
  query: document.querySelector("#journal-query"),
  decade: document.querySelector("#journal-decade"),
  language: document.querySelector("#journal-language"),
  issue: document.querySelector("#journal-issue"),
  category: document.querySelector("#journal-category"),
  doiOnly: document.querySelector("#journal-doi-only"),
  abstractOnly: document.querySelector("#journal-abstract-only"),
  sort: document.querySelector("#journal-sort"),
  reset: document.querySelector("#journal-reset"),
  status: document.querySelector("#journal-results-status"),
  results: document.querySelector("#journal-card-grid"),
  loadMore: document.querySelector("#journal-load-more"),
  categories: document.querySelector("#journal-category-chips"),
  categoryAll: document.querySelector("#journal-category-all"),
  issueAll: document.querySelector("#journal-issue-all"),
  issues: document.querySelector("#journal-issue-chips"),
  topics: document.querySelector("#journal-topic-chips"),
  authorsList: document.querySelector("#journal-author-chips"),
  archivePanel: document.querySelector("#journal-archive-panel"),
  atlasPanel: document.querySelector("#journal-atlas-panel"),
  insightsPanel: document.querySelector("#journal-insights-panel"),
  atlasCanvas: document.querySelector("#journal-atlas-canvas"),
  atlasStatus: document.querySelector("#journal-atlas-status"),
  atlasDetail: document.querySelector("#journal-atlas-detail"),
  atlasRelations: document.querySelector("#journal-atlas-relations"),
  atlasLegend: document.querySelector("#journal-atlas-legend"),
  atlasControls: document.querySelector("#journal-atlas-controls"),
  qwenToggle: document.querySelector("#journal-qwen-toggle"),
  qwenNote: document.querySelector("#journal-qwen-note"),
  filterToggle: document.querySelector("#journal-filter-toggle"),
  filterBlock: document.querySelector(".journal-filter-block"),
  tabs: [...document.querySelectorAll("[data-journal-view]")]
};

let atlas = null;

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function authors(record) {
  return (record.authors || [])
    .map(author => author?.name || author?.sourceName)
    .filter(Boolean);
}

function broadCategoryFor(record) {
  const text = normalize([
    record.title,
    record.abstract,
    ...(record.subjects || [])
  ].join(" "));
  for (const [label, rule] of CATEGORY_RULES) {
    if (rule.test(text)) return label;
  }
  return "Otros";
}

function uniqueStrings(values, preserveCase = false) {
  const output = [];
  const seen = new Set();
  for (const value of values || []) {
    const clean = String(value || "").trim();
    const key = preserveCase ? clean : clean.toLocaleLowerCase("es");
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }
  return output;
}

function normalizeDoi(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
    .replace(/[.,;]+$/, "");
}

function hasVerifiedEditorialKeywordSource(record) {
  return ["verified-publication", "ojs-article"].includes(
    String(record?.editorialKeywordSource || "").trim()
  );
}

function editorialKeywordsFor(record) {
  return hasVerifiedEditorialKeywordSource(record)
    ? uniqueStrings(record?.editorialKeywords || [], true)
    : [];
}

function isCuratorialRecord(record) {
  return record?.journal === "Protrepsis" || record?.journal === "Quadripartita Ratio";
}

function quadripartitaMissingKeywordStatus(record) {
  if (String(record?.editorialKeywordStatus || "") === "verified-absent") {
    return {
      label: "Sin palabras clave editoriales",
      className: "is-keywords-absent",
      note: "La publicación fue verificada en Quadripartita Ratio sin bloque editorial de Palabras clave/Keywords. Las categorías de relación se derivan por separado."
    };
  }
  return {
    label: "Sin palabras clave editoriales verificadas",
    className: "",
    note: "No hay palabras clave editoriales verificadas para este registro."
  };
}

function keywordMetadataFor(record) {
  if (!isCuratorialRecord(record)) {
    return articleTopicMetadata(record, { derive: false, limit: 8 });
  }
  const editorial = editorialKeywordsFor(record);
  const missingStatus = record?.journal === "Protrepsis"
    ? protrepsisMissingKeywordStatus(record)
    : quadripartitaMissingKeywordStatus(record);
  const journalLabel = record?.journal === "Protrepsis" ? "Protrepsis" : "Quadripartita Ratio";
  return {
    topics: editorial.slice(0, 12),
    allTopics: editorial,
    origin: editorial.length ? "editorial" : "none",
    label: "Palabras clave editoriales",
    note: editorial.length
      ? "Publicadas por " + journalLabel + " y verificadas contra la publicación."
      : missingStatus.note,
    emptyLabel: missingStatus.label,
    emptyClass: missingStatus.className
  };
}

function categoryMetadataFor(record) {
  if (record?.journal === "Protrepsis") {
    const relation = protrepsisRelationCategoryMetadata(record, { limit: 4 });
    return {
      ...relation,
      topics: relation.categories,
      allTopics: relation.categories
    };
  }
  if (record?.journal === "Quadripartita Ratio") {
    const relation = quadripartitaRelationCategoryMetadata(record, { limit: 4 });
    return {
      ...relation,
      topics: relation.categories,
      allTopics: relation.categories
    };
  }
  const broad = broadCategoryFor(record);
  return {
    topics: [broad],
    allTopics: [broad],
    origin: "derived",
    label: "Categoría de navegación",
    note: "Clasificación amplia derivada para navegar esta colección."
  };
}

function categoriesFor(record) {
  if (record?.journal === "Protrepsis") {
    return protrepsisRelationCategories(record, { limit: 4 });
  }
  if (record?.journal === "Quadripartita Ratio") {
    return quadripartitaRelationCategories(record, { limit: 4 });
  }
  return [broadCategoryFor(record)];
}

function applyProtrepsisKeywordOverlay(records, overlay) {
  const entries = Array.isArray(overlay?.records) ? overlay.records : [];
  const byDoi = new Map(
    entries
      .map(entry => [normalizeDoi(entry?.doi), entry])
      .filter(([doi]) => doi)
  );

  return records.map(record => {
    if (record?.journal !== "Protrepsis") return record;
    const entry = byDoi.get(normalizeDoi(record?.doi));
    if (!entry) return record;

    const keywords = uniqueStrings(entry.keywords || [], true);
    if (!keywords.length) return record;

    return {
      ...record,
      editorialKeywords: keywords,
      editorialKeywordSource: "verified-publication",
      editorialKeywordEvidence: entry.evidence || null,
      editorialKeywordVerifiedAt: entry.verifiedAt || null,
      subjects: uniqueStrings([...(record.subjects || []), ...keywords])
    };
  });
}

function applyProtrepsisEditorialResolution(records, recovery) {
  const entries = Array.isArray(recovery?.resolvedWithoutEditorialKeywords)
    ? recovery.resolvedWithoutEditorialKeywords
    : [];
  const byDoi = new Map(
    entries
      .map(entry => [normalizeDoi(entry?.doi), entry])
      .filter(([doi]) => doi)
  );

  return records.map(record => {
    if (record?.journal !== "Protrepsis") return record;
    const entry = byDoi.get(normalizeDoi(record?.doi));
    if (!entry) return record;
    return {
      ...record,
      editorialKeywordStatus: entry.editorialKeywordStatus || "verified-absent",
      editorialKeywordAbsenceEvidence: entry.evidence || [],
      editorialKeywordVerifiedAt: entry.verifiedAt || record.editorialKeywordVerifiedAt || null,
      editorialDocumentKind: entry.documentKind || null
    };
  });
}

function applyQuadripartitaKeywordOverlay(records, overlay) {
  const entries = Array.isArray(overlay?.records) ? overlay.records : [];
  const byDoi = new Map(
    entries
      .map(entry => [normalizeDoi(entry?.doi), entry])
      .filter(([doi]) => doi)
  );

  return records.map(record => {
    if (record?.journal !== "Quadripartita Ratio") return record;
    const entry = byDoi.get(normalizeDoi(record?.doi));
    if (!entry) return record;

    const keywords = uniqueStrings(entry.keywords || [], true);
    if (!keywords.length) return record;

    return {
      ...record,
      editorialKeywords: keywords,
      editorialKeywordSource: "verified-publication",
      editorialKeywordEvidence: entry.evidence || null,
      editorialKeywordVerifiedAt: entry.verifiedAt || null,
      subjects: uniqueStrings([...(record.subjects || []), ...keywords])
    };
  });
}

function applyQuadripartitaEditorialResolution(records, recovery) {
  const entries = Array.isArray(recovery?.resolvedWithoutEditorialKeywords)
    ? recovery.resolvedWithoutEditorialKeywords
    : [];
  const byDoi = new Map(
    entries
      .map(entry => [normalizeDoi(entry?.doi), entry])
      .filter(([doi]) => doi)
  );

  return records.map(record => {
    if (record?.journal !== "Quadripartita Ratio") return record;
    const entry = byDoi.get(normalizeDoi(record?.doi));
    if (!entry) return record;
    return {
      ...record,
      editorialKeywordStatus: entry.editorialKeywordStatus || "verified-absent",
      editorialKeywordAbsenceEvidence: entry.evidence || [],
      editorialKeywordVerifiedAt: entry.verifiedAt || record.editorialKeywordVerifiedAt || null,
      editorialDocumentKind: entry.documentKind || null
    };
  });
}

function categoryFor(record) {
  return categoriesFor(record)[0] || broadCategoryFor(record);
}

const CURATORIAL_CATEGORY_COLORS = [
  "#0f62fe", "#007d79", "#8a3ffc", "#a2191f", "#198038",
  "#b28600", "#9f1853", "#005d5d", "#6929c4", "#1192e8"
];

function categoryColorFor(label) {
  if (CATEGORY_COLORS[label]) return CATEGORY_COLORS[label];
  const key = normalize(label);
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return CURATORIAL_CATEGORY_COLORS[hash % CURATORIAL_CATEGORY_COLORS.length];
}

function recordText(record) {
  return normalize([
    record.title,
    record.abstract,
    record.year,
    record.language,
    ...authors(record),
    ...editorialKeywordsFor(record),
    ...(isCuratorialRecord(record)
      ? []
      : articleTopics(record, { derive: false, limit: 12 })),
    ...categoriesFor(record),
    broadCategoryFor(record)
  ].join(" "));
}

function linkFor(record) {
  return record.urls?.canonical ||
    record.urls?.doi ||
    (record.doi ? "https://doi.org/" + record.doi : "");
}

function authorSearchUrl(name) {
  const url = new URL("", SITE_ROOT);
  url.searchParams.set("view", "author");
  url.searchParams.set("author", String(name || "").trim());
  url.hash = "results";
  return url.href;
}

function authorLink(name, className = "journal-author-link") {
  const link = document.createElement("a");
  link.className = className;
  link.href = authorSearchUrl(name);
  link.textContent = name;
  link.title = "Buscar a " + name + " en toda la red";
  return link;
}

function decadeFor(year) {
  const value = Number(year);
  if (!Number.isFinite(value) || value < 1000) return "s/f";
  return String(Math.floor(value / 10) * 10);
}

function metadata(records) {
  const years = records.map(row => Number(row.year)).filter(Number.isFinite);
  const uniqueAuthors = new Set(records.flatMap(authors));
  const doi = records.filter(row => row.doi).length;
  const abstracts = records.filter(row => row.abstract).length;
  return {
    years,
    uniqueAuthors,
    doi,
    abstracts
  };
}

function frequency(values) {
  const map = new Map();
  for (const value of values.filter(Boolean)) {
    map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
}

function allCategories() {
  return frequency(state.records.flatMap(categoriesFor));
}

function filteredRecords() {
  const query = normalize(state.query);
  const rows = state.records.filter(record => {
    if (query && !recordText(record).includes(query)) return false;
    if (state.decade !== "all" && decadeFor(record.year) !== state.decade) return false;
    if (state.language !== "all" && String(record.language || "s/f") !== state.language) return false;
    if (state.issue !== "all" && journalIssueInfo(record).key !== state.issue) return false;
    if (state.category !== "all" && !categoriesFor(record).includes(state.category)) return false;
    if (supportsCuratorialFacets &&
        state.keyword !== "all" &&
        !editorialKeywordsFor(record).includes(state.keyword)) return false;
    if (state.doiOnly && !record.doi) return false;
    if (state.abstractOnly && !record.abstract) return false;
    return true;
  });

  rows.sort((a, b) => {
    if (state.sort === "oldest") return Number(a.year || 9999) - Number(b.year || 9999);
    if (state.sort === "title") return String(a.title || "").localeCompare(String(b.title || ""), "es");
    if (state.sort === "authors") return String(authors(a)[0] || "").localeCompare(String(authors(b)[0] || ""), "es");
    return Number(b.year || 0) - Number(a.year || 0) ||
      String(a.title || "").localeCompare(String(b.title || ""), "es");
  });
  return rows;
}

function chip(label, className = "") {
  const span = document.createElement("span");
  span.className = "journal-chip " + className;
  span.textContent = label;
  return span;
}

function card(record, index) {
  const article = document.createElement("article");
  article.className = "journal-card";
  article.dataset.category = categoriesFor(record).join("|");

  const rail = document.createElement("div");
  rail.className = "journal-card-rail";
  rail.innerHTML = "<strong>" + String(index + 1).padStart(3, "0") + "</strong><span>" +
    escapeHtml(config.mark) + "</span>";

  const body = document.createElement("div");
  body.className = "journal-card-body";

  const pins = document.createElement("div");
  pins.className = "journal-card-pins";
  const issue = journalIssueInfo(record);
  const issueChip = chip(issue.label, "pin-issue");
  issueChip.style.setProperty("--issue-color", issue.color);
  const yearChip = chip(record.year || "s/f", "pin-year");
  if (record.issueYear) yearChip.title = "Año editorial del fascículo";
  pins.append(
    yearChip,
    issueChip,
    chip(record.language || "idioma s/f", "pin-language")
  );
  if (record.doi) pins.append(chip("DOI", "pin-doi"));
  if (record.abstract) pins.append(chip("resumen", "pin-abstract"));

  const title = document.createElement("h3");
  title.textContent = record.title || "Sin título";

  const byline = document.createElement("p");
  byline.className = "journal-card-byline";
  const recordAuthors = authors(record);
  if (recordAuthors.length) {
    recordAuthors.forEach((name, authorIndex) => {
      if (authorIndex) byline.append(document.createTextNode(" · "));
      byline.append(authorLink(name));
    });
  } else {
    byline.textContent = "Autor no indicado";
  }

  const category = document.createElement("div");
  category.className = "journal-card-taxonomy";

  const topicMeta = articleTopicMetadata(record, {
    derive: false,
    limit: isCuratorialRecord(record) ? 8 : 4
  });
  const categoryMeta = categoryMetadataFor(record);
  const keywordMeta = keywordMetadataFor(record);

  if (isCuratorialRecord(record)) {
    const relationGroup = document.createElement("div");
    relationGroup.className = "journal-card-topic-group journal-card-category-group relation-category-group";
    relationGroup.dataset.topicOrigin = categoryMeta.origin;
    relationGroup.title = categoryMeta.note;

    const relationLabel = document.createElement("span");
    relationLabel.className = "journal-card-topic-label";
    relationLabel.textContent = categoryMeta.label;

    const relationList = document.createElement("div");
    relationList.className = "journal-card-topic-list";
    for (const relation of categoryMeta.topics) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "journal-chip subject-chip relation-category-chip";
      button.dataset.taxonomyFacet = "category";
      button.dataset.taxonomyValue = relation;
      button.textContent = relation;
      button.title = "Filtrar " + config.label + " por la categoría de relación «" + relation + "»";
      button.style.setProperty("--chip-color", categoryColorFor(relation));
      const selected = state.category === relation;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-controls", "journal-card-grid");
      button.addEventListener("click", () => selectTaxonomyFacet("category", relation, { revealResults: true }));
      relationList.append(button);
    }
    relationGroup.append(relationLabel, relationList);
    category.append(relationGroup);

    const keywordGroup = document.createElement("div");
    keywordGroup.className = "journal-card-topic-group journal-card-keyword-group";
    keywordGroup.dataset.topicOrigin = keywordMeta.origin;
    keywordGroup.title = keywordMeta.note;

    const keywordLabel = document.createElement("span");
    keywordLabel.className = "journal-card-topic-label";
    keywordLabel.textContent = keywordMeta.label;

    if (keywordMeta.topics.length) {
      const keywordList = document.createElement("div");
      keywordList.className = "journal-card-topic-list";
      for (const keyword of keywordMeta.topics) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "journal-chip subject-chip keyword-filter-chip topic-" + keywordMeta.origin;
        button.dataset.taxonomyFacet = "keyword";
        button.dataset.taxonomyValue = keyword;
        button.textContent = keyword;
        button.title = "Filtrar " + config.label + " por la palabra clave «" + keyword + "»";
        button.style.setProperty("--chip-color", categoryColorFor(keyword));
        const selected = state.keyword === keyword;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
        button.setAttribute("aria-controls", "journal-card-grid");
        button.addEventListener("click", () => selectTaxonomyFacet("keyword", keyword, { revealResults: true }));
        keywordList.append(button);
      }
      const hiddenCount = Math.max(0, keywordMeta.allTopics.length - keywordMeta.topics.length);
      if (hiddenCount) keywordList.append(chip("+" + hiddenCount, "subject-chip topic-more"));
      keywordGroup.append(keywordLabel, keywordList);
    } else {
      keywordGroup.classList.add(keywordMeta.emptyClass);
      const empty = document.createElement("span");
      empty.className = "journal-card-topic-empty";
      empty.textContent = keywordMeta.emptyLabel;
      keywordGroup.append(keywordLabel, empty);
    }
    category.append(keywordGroup);
  } else {
    const broadCategory = broadCategoryFor(record);
    const broadChip = chip("Área general · " + broadCategory, "category-chip broad-category-chip");
    broadChip.title = "Área filosófica amplia derivada para navegación.";
    broadChip.style.setProperty("--chip-color", CATEGORY_COLORS[broadCategory] || CATEGORY_COLORS.Otros);
    category.append(broadChip);

    if (topicMeta.topics.length) {
      const topicGroup = document.createElement("div");
      topicGroup.className = "journal-card-topic-group journal-card-category-group";
      topicGroup.dataset.topicOrigin = topicMeta.origin;
      topicGroup.title = topicMeta.note;
      const topicLabel = document.createElement("span");
      topicLabel.className = "journal-card-topic-label";
      topicLabel.textContent = topicMeta.label;
      const topicList = document.createElement("div");
      topicList.className = "journal-card-topic-list";
      for (const subject of topicMeta.topics) {
        topicList.append(chip(subject, "subject-chip topic-" + topicMeta.origin));
      }
      topicGroup.append(topicLabel, topicList);
      category.append(topicGroup);
    }
  }

  const excerpt = document.createElement("p");
  excerpt.className = "journal-card-excerpt";
  excerpt.textContent = record.abstract
    ? String(record.abstract).replace(/\s+/g, " ").slice(0, 260) + (record.abstract.length > 260 ? "…" : "")
    : "Este registro no publica resumen en el corpus local.";

  const actions = document.createElement("div");
  actions.className = "journal-card-actions";
  const href = linkFor(record);
  if (href) {
    const open = document.createElement("a");
    open.href = href;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.textContent = "Abrir registro ↗";
    actions.append(open);
  }
  const inspect = document.createElement("button");
  inspect.type = "button";
  inspect.textContent = "Metadatos";
  inspect.addEventListener("click", () => article.classList.toggle("is-expanded"));
  actions.append(inspect);

  const editorialDetails = record.journal === "Quadripartita Ratio" && record.issueYear
    ? "<div><dt>Año editorial del número</dt><dd>" + escapeHtml(record.issueYear) + "</dd></div>" +
      (record.publicationDate
        ? "<div><dt>Fecha de publicación OJS</dt><dd>" + escapeHtml(record.publicationDate) + "</dd></div>"
        : "") +
      (record.editorialSource
        ? "<div><dt>Fuente de la edición</dt><dd><a href=\"" + escapeHtml(record.editorialSource) + "\" target=\"_blank\" rel=\"noopener noreferrer\">Archivo editorial ↗</a></dd></div>"
        : "")
    : "";
  const taxonomyDetails = isCuratorialRecord(record)
    ? "<div><dt>Categorías de relación</dt><dd>" +
        escapeHtml(categoryMeta.allTopics.join(" · ")) +
        " <small>" + escapeHtml(categoryMeta.note) + "</small></dd></div>" +
      "<div><dt>Palabras clave editoriales</dt><dd>" +
        escapeHtml(keywordMeta.allTopics.join(" · ") || keywordMeta.emptyLabel) +
        " <small>" + escapeHtml(keywordMeta.note) + "</small></dd></div>"
    : "<div><dt>Área general</dt><dd>" + escapeHtml(broadCategoryFor(record)) +
        " <small>clasificación filosófica amplia derivada</small></dd></div>";

  const details = document.createElement("div");
  details.className = "journal-card-details";
  details.innerHTML =
    "<dl>" +
    editorialDetails +
    "<div><dt>Revista</dt><dd>" + escapeHtml(record.journal || config.label) + "</dd></div>" +
    "<div><dt>DOI</dt><dd>" + escapeHtml(record.doi || "No indicado") + "</dd></div>" +
    "<div><dt>Número editorial</dt><dd>" + escapeHtml(journalIssueInfo(record).label) + "</dd></div>" +
    taxonomyDetails +
    "</dl>";

  body.append(pins, title, byline, category, excerpt, actions, details);
  article.append(rail, body);
  return article;
}

function syncCuratorialChips() {
  if (!supportsCuratorialFacets) return;
  for (const [container, facet] of [[el.categories, "category"], [el.issues, "issue"], [el.topics, "keyword"]]) {
    container?.querySelectorAll("[data-taxonomy-value]").forEach(button => {
      const selected = state[facet] === button.dataset.taxonomyValue;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  for (const [button, facet] of [[el.categoryAll, "category"], [el.issueAll, "issue"]]) {
    if (!button) continue;
    const showAll = state[facet] === "all";
    button.setAttribute("aria-pressed", String(showAll));
    button.classList.toggle("is-current", showAll);
    button.classList.toggle("has-selection", !showAll);
  }
}

let facetFeedbackTimer = null;
let facetPulseTimer = null;

function announceFacetSelection(facet, value, { revealResults = false } = {}) {
  if (!supportsCuratorialFacets) return;

  let feedback = document.querySelector("#journal-filter-feedback");
  if (!feedback) {
    feedback = document.createElement("div");
    feedback.id = "journal-filter-feedback";
    feedback.className = "journal-filter-feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    feedback.setAttribute("aria-atomic", "true");
    document.body.append(feedback);
  }

  const active = value !== "all";
  const facetName = facet === "category"
    ? "Categoría"
    : facet === "keyword"
      ? "Palabra clave"
      : "Número";
  feedback.textContent = active
    ? "✓ " + facetName + " activa · " + value
    : "✓ " + facetName + " restablecido";
  feedback.classList.remove("is-visible");
  void feedback.offsetWidth;
  feedback.classList.add("is-visible");

  clearTimeout(facetFeedbackTimer);
  facetFeedbackTimer = setTimeout(() => feedback.classList.remove("is-visible"), 2200);

  if (el.results) {
    el.results.classList.remove("is-filter-refreshing");
    void el.results.offsetWidth;
    el.results.classList.add("is-filter-refreshing");
    clearTimeout(facetPulseTimer);
    facetPulseTimer = setTimeout(() => el.results?.classList.remove("is-filter-refreshing"), 700);
  }

  if (revealResults && state.view === "archive" && el.results) {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    requestAnimationFrame(() => {
      el.results.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start"
      });
    });
  }
}

function selectTaxonomyFacet(facet, value, options = {}) {
  if (facet !== "category" && facet !== "issue" && facet !== "keyword") return;
  // A second tap releases the same tag. Clearing a single facet keeps
  // the rest of the researcher's filters intact.
  const next = supportsCuratorialFacets && value !== "all" && state[facet] === value ? "all" : value;
  state[facet] = next;
  const select = facet === "category" ? el.category : facet === "issue" ? el.issue : null;
  if (select) select.value = next;
  state.limit = PAGE_SIZE;
  renderArchive();
  announceFacetSelection(facet, next, options);
  if (state.view === "atlas") buildAtlas();
}

function hasActiveFilters() {
  return Boolean(
    String(state.query || "").trim() ||
    state.decade !== "all" ||
    state.language !== "all" ||
    state.category !== "all" ||
    state.keyword !== "all" ||
    state.issue !== "all" ||
    state.doiOnly ||
    state.abstractOnly
  );
}

function renderArchive() {
  const records = filteredRecords();
  const visible = records.slice(0, state.limit);
  el.results.replaceChildren(...visible.map(card));
  el.status.textContent =
    records.length + (records.length === 1 ? " artículo" : " artículos") +
    (hasActiveFilters() ? " · filtros activos" : "");
  el.loadMore.hidden = visible.length >= records.length;
  el.loadMore.textContent = visible.length < records.length
    ? "Cargar " + Math.min(PAGE_SIZE, records.length - visible.length) + " más"
    : "Todo cargado";
  syncCuratorialChips();
}

function fillSelect(select, rows, allLabel) {
  if (!select) return;
  const current = select.value;
  select.replaceChildren(new Option(allLabel, "all"));
  for (const [value, count, displayLabel] of rows) {
    select.append(new Option((displayLabel || value) + " · " + count, value));
  }
  if ([...select.options].some(option => option.value === current)) select.value = current;
}

function buildTaxonomy() {
  const meta = metadata(state.records);
  const yearMin = meta.years.length ? Math.min(...meta.years) : null;
  const yearMax = meta.years.length ? Math.max(...meta.years) : null;
  el.total.textContent = state.records.length;
  el.span.textContent = yearMin && yearMax ? yearMin + "—" + yearMax : "s/f";
  el.authors.textContent = meta.uniqueAuthors.size;
  el.doiRate.textContent = state.records.length ? Math.round(meta.doi / state.records.length * 100) + "%" : "0%";
  el.abstractRate.textContent = state.records.length ? Math.round(meta.abstracts / state.records.length * 100) + "%" : "0%";

  fillSelect(el.decade, frequency(state.records.map(row => decadeFor(row.year))), "Todas las décadas");
  fillSelect(el.language, frequency(state.records.map(row => String(row.language || "s/f"))), "Todos los idiomas");
  fillSelect(
    el.issue,
    journalIssueGroups(state.records).map(group => [group.key, group.count, group.label]),
    "Todos los números"
  );
  if (el.issue) {
    [...el.issue.options].forEach(option => {
      if (option.value === "all") return;
      const group = journalIssueGroups(state.records).find(item => item.key === option.value);
      if (group) option.textContent = group.label + " · " + group.count;
    });
  }
  fillSelect(
    el.category,
    allCategories(),
    "Todas las categorías"
  );

  el.categories.replaceChildren();
  const navigationCategories = allCategories();
  const visibleCategories = supportsCuratorialFacets ? navigationCategories : navigationCategories.slice(0, 10);
  for (const [label, count] of visibleCategories) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "taxonomy-chip";
    button.dataset.taxonomyFacet = "category";
    button.dataset.taxonomyValue = label;
    button.setAttribute("aria-pressed", String(state.category === label));
    button.setAttribute("aria-controls", "journal-card-grid");
    button.style.setProperty("--chip-color", categoryColorFor(label));
    button.innerHTML = "<span>" + escapeHtml(label) + "</span><strong>" + count + "</strong>";
    button.addEventListener("click", () => selectTaxonomyFacet("category", label, { revealResults: true }));
    el.categories.append(button);
  }

  el.issues?.replaceChildren();
  for (const group of journalIssueGroups(state.records)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "taxonomy-chip issue-taxonomy-chip";
    button.dataset.taxonomyFacet = "issue";
    button.dataset.taxonomyValue = group.key;
    button.setAttribute("aria-pressed", String(state.issue === group.key));
    button.setAttribute("aria-controls", "journal-card-grid");
    button.style.setProperty("--chip-color", group.color);
    button.innerHTML = "<span>" + escapeHtml(group.label) + "</span><strong>" + group.count + "</strong>";
    button.addEventListener("click", () => selectTaxonomyFacet("issue", group.key, { revealResults: true }));
    el.issues?.append(button);
  }

  const subjects = supportsCuratorialFacets
    ? frequency(state.records.flatMap(editorialKeywordsFor))
    : frequency(state.records.flatMap(row => row.subjects || []));
  el.topics.replaceChildren();
  for (const [label, count] of subjects.slice(0, 24)) {
    const item = supportsCuratorialFacets ? document.createElement("button") : document.createElement("span");
    item.className = "topic-chip" + (supportsCuratorialFacets ? " topic-category-filter" : "");
    if (supportsCuratorialFacets) {
      item.type = "button";
      item.dataset.taxonomyFacet = "keyword";
      item.dataset.taxonomyValue = label;
      item.setAttribute("aria-pressed", String(state.keyword === label));
      item.title = "Filtrar por la palabra clave «" + label + "»";
      item.addEventListener("click", () => selectTaxonomyFacet("keyword", label));
    }
    item.innerHTML = "<span>" + escapeHtml(label) + "</span><strong>" + count + "</strong>";
    el.topics.append(item);
  }
  if (!subjects.length) el.topics.innerHTML = '<p class="taxonomy-empty">' +
    (supportsCuratorialFacets
      ? "Aún no hay palabras clave editoriales verificadas en esta colección."
      : "El corpus no contiene categorías temáticas para esta colección.") +
    "</p>";

  const authorFreq = frequency(state.records.flatMap(authors));
  el.authorsList.replaceChildren();
  for (const [label, count] of authorFreq.slice(0, 12)) {
    const item = document.createElement("a");
    item.className = "author-chip";
    item.href = authorSearchUrl(label);
    item.title = "Buscar a " + label + " en toda la red";
    item.innerHTML = "<span>" + escapeHtml(label) + "</span><strong>" + count + "</strong>";
    el.authorsList.append(item);
  }
}

function resetFilters() {
  state.query = "";
  state.decade = "all";
  state.language = "all";
  state.category = "all";
  state.keyword = "all";
  state.issue = "all";
  state.doiOnly = false;
  state.abstractOnly = false;
  state.sort = "newest";
  state.limit = PAGE_SIZE;
  el.query.value = "";
  el.decade.value = "all";
  el.language.value = "all";
  if (el.issue) el.issue.value = "all";
  el.category.value = "all";
  el.doiOnly.checked = false;
  el.abstractOnly.checked = false;
  el.sort.value = "newest";
  renderArchive();
}

function switchView(view) {
  state.view = view;
  for (const tab of el.tabs) {
    const selected = tab.dataset.journalView === view;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  }
  el.archivePanel.hidden = view !== "archive";
  el.atlasPanel.hidden = view !== "atlas";
  el.insightsPanel.hidden = view !== "insights";
  if (view === "atlas") buildAtlas();
}

async function buildAtlas() {
  atlas ||= new JournalSemanticAtlas({
    canvas: el.atlasCanvas,
    status: el.atlasStatus,
    detail: el.atlasDetail,
    relations: el.atlasRelations,
    legend: el.atlasLegend,
    controls: el.atlasControls,
    accent: config.accent
  });
  atlas.setQwenEnabled(el.qwenToggle?.getAttribute("aria-pressed") === "true");
  try {
    await atlas.build(filteredRecords(), {
      categoryFor,
      issueFor: journalIssueInfo,
      colorFor: record => journalIssueInfo(record).color
    });
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.error(error);
    el.atlasStatus.textContent = "No se pudo construir la capa semántica; pruebe de nuevo.";
  }
}

function wire() {
  el.query?.addEventListener("input", event => {
    state.query = event.target.value;
    state.limit = PAGE_SIZE;
    renderArchive();
  });
  for (const [control, key] of [
    [el.decade, "decade"],
    [el.language, "language"],
    [el.issue, "issue"],
    [el.category, "category"],
    [el.sort, "sort"]
  ]) {
    control?.addEventListener("change", event => {
      state[key] = event.target.value;
      state.limit = PAGE_SIZE;
      renderArchive();
      if (state.view === "atlas") buildAtlas();
    });
  }
  el.doiOnly?.addEventListener("change", event => {
    state.doiOnly = event.target.checked;
    state.limit = PAGE_SIZE;
    renderArchive();
    if (state.view === "atlas") buildAtlas();
  });
  el.abstractOnly?.addEventListener("change", event => {
    state.abstractOnly = event.target.checked;
    state.limit = PAGE_SIZE;
    renderArchive();
    if (state.view === "atlas") buildAtlas();
  });
  el.reset?.addEventListener("click", resetFilters);
  el.categoryAll?.addEventListener("click", () => selectTaxonomyFacet("category", "all"));
  el.issueAll?.addEventListener("click", () => selectTaxonomyFacet("issue", "all"));
  el.loadMore?.addEventListener("click", () => {
    state.limit += PAGE_SIZE;
    renderArchive();
  });
  for (const tab of el.tabs) tab.addEventListener("click", () => switchView(tab.dataset.journalView));

  const syncFilterDisclosure = () => {
    if (!el.filterBlock || !el.filterToggle) return;
    const compact = matchMedia("(max-width: 820px)").matches;
    if (!compact) {
      el.filterBlock.classList.remove("is-collapsed");
      el.filterToggle.setAttribute("aria-expanded", "true");
      el.filterToggle.textContent = "Ocultar";
      return;
    }
    if (!el.filterBlock.dataset.mobileInitialized) {
      el.filterBlock.classList.add("is-collapsed");
      el.filterBlock.dataset.mobileInitialized = "true";
    }
    const open = !el.filterBlock.classList.contains("is-collapsed");
    el.filterToggle.setAttribute("aria-expanded", String(open));
    el.filterToggle.textContent = open ? "Ocultar" : "Mostrar filtros";
  };

  el.filterToggle?.addEventListener("click", () => {
    el.filterBlock?.classList.toggle("is-collapsed");
    const open = !el.filterBlock?.classList.contains("is-collapsed");
    el.filterToggle.setAttribute("aria-expanded", String(open));
    el.filterToggle.textContent = open ? "Ocultar" : "Mostrar filtros";
  });
  addEventListener("resize", syncFilterDisclosure, { passive: true });
  syncFilterDisclosure();

  el.qwenToggle?.addEventListener("click", () => {
    const active = el.qwenToggle.getAttribute("aria-pressed") !== "true";
    el.qwenToggle.setAttribute("aria-pressed", String(active));
    el.qwenToggle.textContent = active ? "Capa Qwen activa" : "Activar capa Qwen";
    el.qwenNote.textContent = active
      ? "Solo se dibujan como Qwen las relaciones entre registros con vectores verificados; el resto conserva respaldo textual."
      : "Qwen es opcional y experimental. Sin activarlo, el Atlas usa similitud textual local.";
    buildAtlas();
  });
}

async function load() {
  document.documentElement.style.setProperty("--journal-accent", config.accent);
  document.documentElement.style.setProperty("--journal-accent-2", config.accent2);
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const payload = await response.json();

    let records = (Array.isArray(payload.records) ? payload.records : [])
      .filter(record => config.matcher(record.journal));

    if (supportsCuratorialFacets) {
      const keywordUrl = journalId === "protrepsis" ? PROTREPSIS_KEYWORDS_URL : QUADRIPARTITA_KEYWORDS_URL;
      const recoveryUrl = journalId === "protrepsis" ? PROTREPSIS_RECOVERY_URL : QUADRIPARTITA_RECOVERY_URL;
      const applyKeywords = journalId === "protrepsis"
        ? applyProtrepsisKeywordOverlay
        : applyQuadripartitaKeywordOverlay;
      const applyResolution = journalId === "protrepsis"
        ? applyProtrepsisEditorialResolution
        : applyQuadripartitaEditorialResolution;
      try {
        const [keywordResponse, recoveryResponse] = await Promise.all([
          fetch(keywordUrl, { cache: "no-store" }),
          fetch(recoveryUrl, { cache: "no-store" })
        ]);
        if (keywordResponse.ok) {
          records = applyKeywords(records, await keywordResponse.json());
        } else {
          console.warn("No se pudo cargar la capa curada de palabras clave de " + config.label + ":", keywordResponse.status);
        }
        if (recoveryResponse.ok) {
          records = applyResolution(records, await recoveryResponse.json());
        } else {
          console.warn("No se pudo cargar el cierre editorial de " + config.label + ":", recoveryResponse.status);
        }
      } catch (keywordError) {
        console.warn("Las capas curatoriales de " + config.label + " no están disponibles.", keywordError);
      }
    }

    state.records = records;
    buildTaxonomy();
    renderArchive();
    if (!state.records.length) {
      el.status.textContent = "La página está lista, pero este corpus todavía no contiene registros publicados de " + config.label + ".";
    }
  } catch (error) {
    console.error("No se pudo cargar el corpus de la revista.", error);
    el.status.textContent = "No se pudo cargar el corpus universitario.";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

wire();
load();

import { JournalSemanticAtlas } from "./journal-atlas.js?v=20261111-v6";
import {
  journalIssueGroups,
  journalIssueInfo
} from "./journal-issues.js?v=20261111-v1";

const SITE_ROOT = new URL("../", import.meta.url);
const DATA_URL = new URL("src/data/cucsh-filosofia.json", SITE_ROOT);
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
  "Otros": "#525252"
};

const journalId = document.body.dataset.journal;
const config = JOURNALS[journalId] || JOURNALS.protrepsis;

const state = {
  records: [],
  query: "",
  decade: "all",
  language: "all",
  category: "all",
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
  issues: document.querySelector("#journal-issue-chips"),
  topics: document.querySelector("#journal-topic-chips"),
  authorsList: document.querySelector("#journal-author-chips"),
  archivePanel: document.querySelector("#journal-archive-panel"),
  atlasPanel: document.querySelector("#journal-atlas-panel"),
  insightsPanel: document.querySelector("#journal-insights-panel"),
  atlasCanvas: document.querySelector("#journal-atlas-canvas"),
  atlasStatus: document.querySelector("#journal-atlas-status"),
  atlasDetail: document.querySelector("#journal-atlas-detail"),
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

function categoryFor(record) {
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

function recordText(record) {
  return normalize([
    record.title,
    record.abstract,
    record.year,
    record.language,
    ...authors(record),
    ...(record.subjects || []),
    categoryFor(record)
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
  return frequency(state.records.map(categoryFor));
}

function filteredRecords() {
  const query = normalize(state.query);
  const rows = state.records.filter(record => {
    if (query && !recordText(record).includes(query)) return false;
    if (state.decade !== "all" && decadeFor(record.year) !== state.decade) return false;
    if (state.language !== "all" && String(record.language || "s/f") !== state.language) return false;
    if (state.issue !== "all" && journalIssueInfo(record).key !== state.issue) return false;
    if (state.category !== "all" && categoryFor(record) !== state.category) return false;
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
  article.dataset.category = categoryFor(record);

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
  pins.append(
    chip(record.year || "s/f", "pin-year"),
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
  const categoryChip = chip(categoryFor(record), "category-chip");
  categoryChip.style.setProperty("--chip-color", CATEGORY_COLORS[categoryFor(record)] || CATEGORY_COLORS.Otros);
  category.append(categoryChip);
  for (const subject of (record.subjects || []).slice(0, 4)) {
    category.append(chip(subject, "subject-chip"));
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

  const details = document.createElement("div");
  details.className = "journal-card-details";
  details.innerHTML =
    "<dl>" +
    "<div><dt>Revista</dt><dd>" + escapeHtml(record.journal || config.label) + "</dd></div>" +
    "<div><dt>DOI</dt><dd>" + escapeHtml(record.doi || "No indicado") + "</dd></div>" +
    "<div><dt>Número editorial</dt><dd>" + escapeHtml(journalIssueInfo(record).label) + "</dd></div>" +
    "<div><dt>Categoría</dt><dd>" + escapeHtml(categoryFor(record)) + " <small>derivada para navegación</small></dd></div>" +
    "<div><dt>Temas declarados</dt><dd>" + escapeHtml((record.subjects || []).join(" · ") || "No indicados") + "</dd></div>" +
    "</dl>";

  body.append(pins, title, byline, category, excerpt, actions, details);
  article.append(rail, body);
  return article;
}

function renderArchive() {
  const records = filteredRecords();
  const visible = records.slice(0, state.limit);
  el.results.replaceChildren(...visible.map(card));
  el.status.textContent =
    records.length + (records.length === 1 ? " artículo" : " artículos") +
    (state.records.length !== records.length ? " · filtros activos" : "");
  el.loadMore.hidden = visible.length >= records.length;
  el.loadMore.textContent = visible.length < records.length
    ? "Cargar " + Math.min(PAGE_SIZE, records.length - visible.length) + " más"
    : "Todo cargado";
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
  fillSelect(el.category, allCategories(), "Todas las categorías");

  el.categories.replaceChildren();
  for (const [label, count] of allCategories().slice(0, 10)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "taxonomy-chip";
    button.style.setProperty("--chip-color", CATEGORY_COLORS[label] || CATEGORY_COLORS.Otros);
    button.innerHTML = "<span>" + escapeHtml(label) + "</span><strong>" + count + "</strong>";
    button.addEventListener("click", () => {
      state.category = label;
      el.category.value = label;
      state.limit = PAGE_SIZE;
      renderArchive();
    });
    el.categories.append(button);
  }

  el.issues?.replaceChildren();
  for (const group of journalIssueGroups(state.records).slice(0, 16)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "taxonomy-chip issue-taxonomy-chip";
    button.style.setProperty("--chip-color", group.color);
    button.innerHTML = "<span>" + escapeHtml(group.label) + "</span><strong>" + group.count + "</strong>";
    button.addEventListener("click", () => {
      state.issue = group.key;
      if (el.issue) el.issue.value = group.key;
      state.limit = PAGE_SIZE;
      renderArchive();
      if (state.view === "atlas") buildAtlas();
    });
    el.issues?.append(button);
  }

  const subjects = frequency(state.records.flatMap(row => row.subjects || []));
  el.topics.replaceChildren();
  for (const [label, count] of subjects.slice(0, 14)) {
    const item = document.createElement("span");
    item.className = "topic-chip";
    item.innerHTML = "<span>" + escapeHtml(label) + "</span><strong>" + count + "</strong>";
    el.topics.append(item);
  }
  if (!subjects.length) el.topics.innerHTML = '<p class="taxonomy-empty">El corpus no publica temas declarados para esta colección.</p>';

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
    state.records = (Array.isArray(payload.records) ? payload.records : [])
      .filter(record => config.matcher(record.journal));
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

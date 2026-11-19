import { searchPhilosophy } from "../src/core/search-engine.js?v=20261112-orcid-production-v2";

const INVENTORY_URL = "./src/data/latin-american-philosophers-metadata.json";
const MANIFEST_URL = "./src/data/philosopher-works/manifest.json";
const AUTHOR_BASE = "./src/data/philosopher-works/authors/";
const PAGE_SIZE = 80;
const PERIOD_BATCH_SIZE = 40;
const HYDRATION_CONCURRENCY = 4;

const directory = document.querySelector("#author-directory");
const directoryStatus = document.querySelector("#directory-status");
const searchInput = document.querySelector("#author-search");
const filterButtons = [...document.querySelectorAll("[data-status-filter]")];
const loadMore = document.querySelector("#load-more-authors");
const loadMorePeriodAuthors = document.querySelector("#load-more-period-authors");
const periodizedAuthors = document.querySelector("#periodized-authors");
const periodizationStatus = document.querySelector("#periodization-status");
const worksSection = document.querySelector("#con-obra");
const explorerSearch = document.querySelector("#period-author-search");
const explorerStatus = document.querySelector("#author-explorer-status");
const explorerResults = document.querySelector("#author-explorer-results");
const explorerPeriodButtons = [...document.querySelectorAll("[data-explorer-period]")];
const collapsePeriodsButton = document.querySelector("#collapse-periods");
const expandPeriodsButton = document.querySelector("#expand-periods");

const authorDialog = document.querySelector("#author-dialog");
const authorDialogClose = document.querySelector("#author-dialog-close");
const authorDialogTitle = document.querySelector("#author-dialog-title");
const authorDialogLife = document.querySelector("#author-dialog-life");
const authorDialogBody = document.querySelector("#author-dialog-body");
const authorDialogPrev = document.querySelector("#author-dialog-prev");
const authorDialogNext = document.querySelector("#author-dialog-next");
const authorDialogShare = document.querySelector("#author-dialog-share");
const authorDossierIndex = document.querySelector("#author-dossier-index");
const authorDossierStatus = document.querySelector("#author-dossier-status");
const authorDossierPeriodRoman = document.querySelector("#author-dossier-period-roman");
const authorDossierPeriodLabel = document.querySelector("#author-dossier-period-label");
const authorDossierMonogram = document.querySelector("#author-dossier-monogram");
const authorDossierAliases = document.querySelector("#author-dossier-aliases");
const authorDossierWorks = document.querySelector("#author-dossier-works");
const authorDossierContributions = document.querySelector("#author-dossier-contributions");
const authorDossierSources = document.querySelector("#author-dossier-sources");
const authorDossierCoverage = document.querySelector("#author-dossier-coverage");

let authors = [];
let seededCount = 0;
let currentFilter = "all";
let visibleCount = PAGE_SIZE;
let hydratedAuthors = [];
let periodCursor = 0;
let periodLoading = false;
let periodHydrationStarted = false;
let currentAuthorId = null;
let dialogReturnHash = "";
let liveResearchController = null;
let philosophyMapPromise = null;
let explorerPeriod = "all";
let explorerSearchTimer = null;
let explorerSearchToken = 0;
const collapsedPeriods = new Set(["colonial", "madura", "sigloxx", "por-ubicar"]);

const authorCache = new Map();
const liveResearchCache = new Map();

const PERIODS = [
  {
    id: "originarios",
    roman: "I",
    title: "Filosofías de algunos pueblos originarios",
    note: "Primera época del libro · ubicación cronológica orientativa"
  },
  {
    id: "colonial",
    roman: "II",
    title: "Filosofía colonial en la modernidad temprana",
    note: "Segunda época del libro · ubicación cronológica orientativa"
  },
  {
    id: "madura",
    roman: "III",
    title: "Filosofía ante la modernidad madura",
    note: "Tercera época del libro · ubicación cronológica orientativa"
  },
  {
    id: "sigloxx",
    roman: "IV",
    title: "Corrientes filosóficas del siglo XX",
    note: "Segunda parte del libro · ubicación cronológica orientativa"
  },
  {
    id: "por-ubicar",
    roman: "·",
    title: "Por ubicar con mayor precisión",
    note: "Fichas sin fecha suficiente para una adscripción cronológica responsable"
  }
];

function normalizedInventory(payload) {
  if (Array.isArray(payload)) return payload;
  return payload.philosophers || payload.authors || payload.items || [];
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function canonicalId(value) {
  return String(value).padStart(4, "0");
}

function humanize(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function authorHasSeed(author) {
  return Number(author.id) <= seededCount;
}

function filteredAuthors() {
  const needle = normalizeText(searchInput?.value);
  return authors.filter(author => {
    const seeded = authorHasSeed(author);
    if (currentFilter === "seeded" && !seeded) return false;
    if (currentFilter === "pending" && seeded) return false;
    return !needle || normalizeText(author.name).includes(needle);
  });
}

function makeAuthorCard(author) {
  const seeded = authorHasSeed(author);
  const card = document.createElement(seeded ? "button" : "article");
  card.className = `author-card${seeded ? " author-card--interactive" : ""}`;

  if (seeded) {
    card.type = "button";
    card.dataset.authorId = String(author.id);
    card.setAttribute("aria-label", `Abrir ficha de ${author.name}`);
  }

  card.innerHTML = `
    <div class="author-card-topline">
      <span class="author-id">#${canonicalId(author.id)}</span>
      <span class="author-card-kind">FICHA</span>
    </div>
    <span class="author-card-monogram" aria-hidden="true"></span>
    <h3></h3>
    <div class="author-card-footer">
      <span class="author-state ${seeded ? "seeded" : "pending"}">
        ${seeded ? "Bibliografía documentada" : "Sin ficha"}
      </span>
      <span class="author-card-open" aria-hidden="true">Abrir →</span>
    </div>
  `;
  card.querySelector("h3").textContent = author.name;
  card.querySelector(".author-card-monogram").textContent = dossierMonogram(author.name);

  if (seeded) {
    card.addEventListener("click", () => openAuthorDialog(author.id));
  }

  return card;
}

function renderDirectory({ reset = false } = {}) {
  if (reset) visibleCount = PAGE_SIZE;
  const matches = filteredAuthors();
  const shown = matches.slice(0, visibleCount);
  directory.replaceChildren(...shown.map(makeAuthorCard));
  directoryStatus.textContent =
    `${matches.length.toLocaleString("es-MX")} autores · mostrando ${shown.length.toLocaleString("es-MX")}`;
  loadMore.hidden = shown.length >= matches.length;
}

function setFilter(value) {
  currentFilter = value;
  for (const button of filterButtons) {
    const active = button.dataset.statusFilter === value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  renderDirectory({ reset: true });
}

function earliestYear(record) {
  const workYears = (record.works || [])
    .map(work => work?.original_date?.year)
    .filter(Number.isFinite);
  if (workYears.length) return Math.min(...workYears);

  const born = record.life?.born?.year ?? record.life?.birth_year;
  return Number.isFinite(born) ? born : null;
}

function inferPeriod(record) {
  const year = earliestYear(record);
  const name = normalizeText(record.canonical_name);

  const originarioNames = [
    "tlacaelel", "nezahualcoyotl", "quetzalcoatl",
    "atzayacatl", "ayocuan", "cuauhtemoc", "tupac yupanqui"
  ];

  if (originarioNames.some(token => name.includes(token))) return "originarios";
  if (year === null) return "por-ubicar";

  // Heurística cronológica para la primera arquitectura.
  // No pretende sustituir la futura curación por capítulo/corriente del libro.
  if (year < 1492) return "originarios";
  if (year < 1750) return "colonial";
  if (year < 1900) return "madura";
  return "sigloxx";
}

function recordKeywords(record, limit = 3) {
  const terms = [];
  const seen = new Set();

  const add = keyword => {
    if (keyword?.provenance === "inferred") return;
    const term = String(keyword?.term || "").trim();
    const key = normalizeText(term);
    if (!term || seen.has(key)) return;
    seen.add(key);
    terms.push(term);
  };

  for (const work of record.works || []) {
    for (const keyword of work.keywords || []) add(keyword);
  }
  for (const contribution of record.non_bibliographic_contributions || []) {
    for (const keyword of contribution.keywords || []) add(keyword);
  }

  return terms.slice(0, limit);
}

function recordLife(record) {
  const born = record.life?.born?.year ?? record.life?.birth_year;
  const died = record.life?.died?.year ?? record.life?.death_year;
  if (Number.isFinite(born) && Number.isFinite(died)) return `${born}–${died}`;
  if (Number.isFinite(born)) return `n. ${born}`;
  if (Number.isFinite(died)) return `† ${died}`;
  return "Fechas no fijadas";
}

function explorerCardMetrics(record) {
  return {
    works: Array.isArray(record.works) ? record.works.length : 0,
    contributions: Array.isArray(record.non_bibliographic_contributions)
      ? record.non_bibliographic_contributions.length
      : 0,
    sources: Array.isArray(record.sources) ? record.sources.length : 0
  };
}

function makeMiniAuthor(record) {
  const period = periodMetaFor(record);
  const metrics = explorerCardMetrics(record);
  const keywords = recordKeywords(record);

  const card = document.createElement("button");
  card.type = "button";
  card.className = `mini-author author-profile-card period-${period.id}`;
  card.dataset.authorId = String(record.author_id);
  card.setAttribute("aria-label", `Abrir ficha de ${record.canonical_name}`);

  card.innerHTML = `
    <div class="author-profile-topline">
      <span class="author-profile-index">#${canonicalId(record.author_id)}</span>
      <span class="author-profile-era">${period.roman}</span>
    </div>
    <span class="author-profile-monogram" aria-hidden="true"></span>
    <div class="author-profile-copy">
      <strong></strong>
      <small class="author-profile-life"></small>
    </div>
    <div class="author-profile-metrics" aria-label="Resumen bibliográfico">
      <span><b>${metrics.works}</b> obras</span>
      <span><b>${metrics.contributions}</b> contrib.</span>
      <span><b>${metrics.sources}</b> fuentes</span>
    </div>
    <div class="author-profile-chips" aria-label="Temas documentados"></div>
    <span class="author-profile-open">Abrir dossier <i aria-hidden="true">→</i></span>
  `;

  card.querySelector(".author-profile-monogram").textContent =
    dossierMonogram(record.canonical_name);
  card.querySelector("strong").textContent = record.canonical_name;
  card.querySelector(".author-profile-life").textContent = recordLife(record);

  const chipBox = card.querySelector(".author-profile-chips");
  if (keywords.length) {
    for (const keyword of keywords) {
      const chip = document.createElement("span");
      chip.textContent = keyword;
      chipBox.append(chip);
    }
  } else {
    const chip = document.createElement("span");
    chip.textContent = metrics.works
      ? "bibliografía documentada"
      : "contribución documentada";
    chipBox.append(chip);
  }

  card.addEventListener("click", () => openAuthorDialog(record.author_id));
  return card;
}

function periodGroup(period, records) {
  const section = document.createElement("section");
  const collapsed = collapsedPeriods.has(period.id);
  section.className =
    `period-author-group period-${period.id}${collapsed ? " is-collapsed" : ""}`;
  section.id = `coleccion-${period.id}`;

  const header = document.createElement("header");
  const bodyId = `period-body-${period.id}`;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "period-group-toggle";
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.setAttribute("aria-controls", bodyId);
  toggle.innerHTML = `
    <span class="period-group-roman">${period.roman}</span>
    <div class="period-group-copy"><h3></h3><small></small></div>
    <small class="period-count"></small>
    <span class="period-group-chevron" aria-hidden="true">⌄</span>
  `;
  toggle.querySelector("h3").textContent = period.title;
  toggle.querySelector(".period-group-copy small").textContent = period.note;
  toggle.querySelector(".period-count").textContent =
    `${records.length.toLocaleString("es-MX")} ${records.length === 1 ? "ficha" : "fichas"} cargadas`;

  const body = document.createElement("div");
  body.id = bodyId;
  body.className = "period-group-body";
  body.hidden = collapsed;

  const list = document.createElement("div");
  list.className = "period-author-list";
  list.replaceChildren(...records.map(makeMiniAuthor));
  body.append(list);

  toggle.addEventListener("click", () => {
    const nextCollapsed = !collapsedPeriods.has(period.id);
    if (nextCollapsed) collapsedPeriods.add(period.id);
    else collapsedPeriods.delete(period.id);

    section.classList.toggle("is-collapsed", nextCollapsed);
    body.hidden = nextCollapsed;
    toggle.setAttribute("aria-expanded", String(!nextCollapsed));
  });

  header.append(toggle);
  section.append(header, body);
  return section;
}

function renderPeriodized() {
  const byPeriod = Object.fromEntries(PERIODS.map(period => [period.id, []]));

  for (const record of hydratedAuthors) {
    byPeriod[inferPeriod(record)].push(record);
  }

  const groups = PERIODS
    .filter(period => explorerPeriod === "all" || period.id === explorerPeriod)
    .filter(period => period.id !== "por-ubicar" || byPeriod[period.id].length)
    .filter(period => byPeriod[period.id].length)
    .map(period => periodGroup(period, byPeriod[period.id]));

  periodizedAuthors.replaceChildren(...groups);
}

function setExplorerPeriod(value, { render = true } = {}) {
  explorerPeriod = value;
  for (const button of explorerPeriodButtons) {
    const active = button.dataset.explorerPeriod === value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  if (!render) return;
  if (normalizeText(explorerSearch?.value).trim()) renderExplorerSearch();
  else renderPeriodized();
}

async function renderExplorerSearch() {
  const query = normalizeText(explorerSearch?.value).trim();
  const token = ++explorerSearchToken;

  if (query.length < 2) {
    explorerResults.hidden = true;
    explorerResults.replaceChildren();
    periodizedAuthors.hidden = false;
    renderPeriodized();
    explorerStatus.textContent =
      "Explore las épocas o escriba al menos dos letras para buscar cualquier ficha del inventario.";
    return;
  }

  const inventoryMatches = authors
    .filter(author => normalizeText(author.name).includes(query))
    .slice(0, 48);

  periodizedAuthors.hidden = true;
  explorerResults.hidden = false;
  explorerResults.innerHTML = '<p class="explorer-loading">Buscando fichas bibliográficas…</p>';
  explorerStatus.textContent =
    `${inventoryMatches.length.toLocaleString("es-MX")} coincidencias por nombre · cargando metadatos…`;

  const records = await fetchBatch(inventoryMatches.map(author => Number(author.id)));
  if (token !== explorerSearchToken) return;

  const filtered = explorerPeriod === "all"
    ? records
    : records.filter(record => inferPeriod(record) === explorerPeriod);

  explorerResults.replaceChildren(...filtered.map(makeMiniAuthor));
  explorerStatus.textContent = filtered.length
    ? `${filtered.length.toLocaleString("es-MX")} fichas encontradas${explorerPeriod === "all" ? "" : " en esta época"}.`
    : "No hay coincidencias documentadas con este filtro.";

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "explorer-empty";
    empty.textContent = "Pruebe otro nombre o cambie la época seleccionada.";
    explorerResults.append(empty);
  }
}

async function fetchAuthorRecord(id) {
  const numericId = Number(id);
  if (authorCache.has(numericId)) return authorCache.get(numericId);

  const url = `${AUTHOR_BASE}${canonicalId(numericId)}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url}`);

  const record = await response.json();
  authorCache.set(numericId, record);
  return record;
}

async function fetchBatch(ids) {
  const records = [];
  let cursor = 0;

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        records.push(await fetchAuthorRecord(id));
      } catch (error) {
        console.warn(error);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(HYDRATION_CONCURRENCY, ids.length) }, worker)
  );

  return records.sort((a, b) => a.author_id - b.author_id);
}

async function loadNextPeriodBatch() {
  if (periodLoading || periodCursor >= seededCount) return;

  periodHydrationStarted = true;
  periodLoading = true;
  loadMorePeriodAuthors.disabled = true;

  const from = periodCursor + 1;
  const to = Math.min(periodCursor + PERIOD_BATCH_SIZE, seededCount);
  periodizationStatus.textContent =
    `Cargando fichas ${from.toLocaleString("es-MX")}–${to.toLocaleString("es-MX")} de ${seededCount.toLocaleString("es-MX")}…`;

  const ids = Array.from({ length: to - from + 1 }, (_, index) => from + index);
  const records = await fetchBatch(ids);

  const existing = new Map(hydratedAuthors.map(record => [record.author_id, record]));
  for (const record of records) existing.set(record.author_id, record);

  hydratedAuthors = [...existing.values()].sort((a, b) => a.author_id - b.author_id);
  periodCursor = to;
  renderPeriodized();

  periodizationStatus.textContent =
    `${hydratedAuthors.length.toLocaleString("es-MX")} de ${seededCount.toLocaleString("es-MX")} fichas cargadas. La ubicación cronológica es orientativa y la adscripción por corriente sólo se muestra cuando existe respaldo suficiente.`;

  loadMorePeriodAuthors.hidden = periodCursor >= seededCount;
  loadMorePeriodAuthors.disabled = false;
  periodLoading = false;
}

async function waitForPeriodIdle() {
  if (!periodLoading) return;
  await new Promise(resolve => {
    const check = () => {
      if (!periodLoading) resolve();
      else setTimeout(check, 40);
    };
    check();
  });
}

async function ensurePeriodAvailable(periodId) {
  await waitForPeriodIdle();

  let target = document.querySelector(`#coleccion-${periodId}`);
  let attempts = 0;

  while (!target && periodCursor < seededCount && attempts < 4) {
    await loadNextPeriodBatch();
    await waitForPeriodIdle();
    target = document.querySelector(`#coleccion-${periodId}`);
    attempts += 1;
  }

  return target || worksSection;
}

function lifeText(record) {
  return recordLife(record) === "Fechas no fijadas"
    ? "Fechas no fijadas en esta ficha"
    : recordLife(record);
}

function periodMetaFor(record) {
  const id = inferPeriod(record);
  return PERIODS.find(period => period.id === id) || PERIODS.at(-1);
}

function dossierMonogram(name) {
  const parts = String(name || "Φ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(part => !["de", "del", "la", "las", "los", "y", "e"].includes(part.toLowerCase()));
  if (!parts.length) return "Φ";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts.at(-1)[0]).toUpperCase();
}

function coverageText(record) {
  const status = record.coverage?.works_status;
  if (status === "selected_originals_and_contributions_not_exhaustive") {
    return "Selección bibliográfica en expansión · no exhaustiva";
  }
  if (status) return humanize(status);
  return "Cobertura bibliográfica documentada en esta ficha";
}

function workYear(work) {
  return work?.original_date?.year ?? work?.first_publication_year ?? null;
}

function aggregateKeywords(record) {
  const terms = [];
  const seen = new Set();
  for (const work of record.works || []) {
    for (const keyword of work.keywords || []) {
      const term = String(keyword?.term || "").trim();
      const key = normalizeText(term);
      if (!term || seen.has(key)) continue;
      seen.add(key);
      terms.push(term);
    }
  }
  return terms.slice(0, 14);
}

function aggregateLanguages(record) {
  const languages = [];
  const seen = new Set();
  for (const work of record.works || []) {
    const language = String(work?.original_language || "").trim();
    const key = normalizeText(language);
    if (!language || seen.has(key)) continue;
    seen.add(key);
    languages.push(language);
  }
  return languages;
}

function createChip(text, className = "author-dossier-chip") {
  const chip = document.createElement("span");
  chip.className = className;
  chip.textContent = text;
  return chip;
}

function appendOverview(record, container) {
  const section = document.createElement("section");
  section.id = "author-dossier-overview";
  section.className = "author-dossier-section author-dossier-overview";

  const eyebrow = document.createElement("p");
  eyebrow.className = "author-dossier-section-index";
  eyebrow.textContent = "I / PANORAMA DEL ARCHIVO";

  const heading = document.createElement("h3");
  heading.textContent = "Una ficha para leer, no sólo para contar.";

  const works = Array.isArray(record.works) ? record.works : [];
  const contributions = Array.isArray(record.non_bibliographic_contributions)
    ? record.non_bibliographic_contributions
    : [];
  const years = works.map(workYear).filter(Number.isFinite).sort((a,b) => a-b);
  const languages = aggregateLanguages(record);
  const keywords = aggregateKeywords(record);

  const intro = document.createElement("p");
  intro.className = "author-dossier-lede";
  const pieces = [
    `${works.length} ${works.length === 1 ? "obra documentada" : "obras documentadas"}`,
    `${contributions.length} ${contributions.length === 1 ? "contribución intelectual" : "contribuciones intelectuales"}`
  ];
  if (years.length) pieces.push(`arco documental ${years[0]}–${years.at(-1)}`);
  intro.textContent = pieces.join(" · ") + ".";

  const facts = document.createElement("div");
  facts.className = "author-dossier-facts";

  const factData = [
    ["Cronología", years.length ? `${years[0]}–${years.at(-1)}` : "Sin fecha suficiente"],
    ["Lenguas", languages.length ? languages.join(" · ") : "No fijadas"],
    ["Cobertura", coverageText(record)]
  ];

  for (const [label, value] of factData) {
    const fact = document.createElement("div");
    const dt = document.createElement("span");
    dt.textContent = label;
    const dd = document.createElement("strong");
    dd.textContent = value;
    fact.append(dt, dd);
    facts.append(fact);
  }

  section.append(eyebrow, heading, intro, facts);

  if (works.length) {
    const timelineBlock = document.createElement("div");
    timelineBlock.className = "author-dossier-timeline-block";

    const timelineLabel = document.createElement("p");
    timelineLabel.className = "author-dossier-block-label";
    timelineLabel.textContent = "CARTOGRAFÍA TEMPORAL DE LAS OBRAS";

    const timeline = document.createElement("div");
    timeline.className = "author-dossier-timeline";
    timeline.setAttribute("aria-label", "Cronología de las obras documentadas");

    const sortedWorks = [...works].sort((a,b) => (workYear(a) ?? 9999) - (workYear(b) ?? 9999));
    sortedWorks.forEach((work, index) => {
      const item = document.createElement("article");
      item.className = "author-dossier-timeline-item";

      const node = document.createElement("span");
      node.className = "author-dossier-timeline-node";
      node.textContent = String(index + 1).padStart(2, "0");

      const year = document.createElement("strong");
      year.textContent = workYear(work) ?? "s. f.";

      const title = document.createElement("p");
      title.textContent = work.title || "Título no disponible";

      item.append(node, year, title);
      timeline.append(item);
    });

    timelineBlock.append(timelineLabel, timeline);
    section.append(timelineBlock);
  }

  if (keywords.length) {
    const keywordBlock = document.createElement("div");
    keywordBlock.className = "author-dossier-keyword-block";
    const label = document.createElement("p");
    label.textContent = "VOCABULARIO DE LA FICHA";
    const chips = document.createElement("div");
    chips.className = "author-dossier-chips";
    chips.replaceChildren(...keywords.map(term => createChip(term)));
    keywordBlock.append(label, chips);
    section.append(keywordBlock);
  }

  if (contributions.length) {
    const contributionBlock = document.createElement("div");
    contributionBlock.className = "author-dossier-contribution-block";
    const label = document.createElement("p");
    label.className = "author-dossier-block-label";
    label.textContent = "EJES DOCUMENTADOS";

    const list = document.createElement("div");
    list.className = "author-dossier-contribution-grid";

    for (const contribution of contributions) {
      const card = document.createElement("article");
      const mark = document.createElement("span");
      mark.textContent = "✦";
      const title = document.createElement("strong");
      title.textContent = contribution.title || "Contribución documentada";
      const meta = document.createElement("small");
      meta.textContent = humanize(contribution.kind);
      card.append(mark, title);
      if (contribution.kind) card.append(meta);
      list.append(card);
    }

    contributionBlock.append(label, list);
    section.append(contributionBlock);
  }

  container.append(section);
}

function createEvidenceLink(url, label) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function appendWorkList(record, container) {
  const section = document.createElement("section");
  section.id = "author-dossier-works-section";
  section.className = "author-dossier-section author-dossier-works";

  const eyebrow = document.createElement("p");
  eyebrow.className = "author-dossier-section-index";
  eyebrow.textContent = "II / OBRAS DOCUMENTADAS";

  const headingRow = document.createElement("div");
  headingRow.className = "author-dossier-section-heading";
  const heading = document.createElement("h3");
  heading.textContent = "Obras, manuscritos y documentos.";
  const works = Array.isArray(record.works) ? [...record.works] : [];
  const count = document.createElement("span");
  count.textContent = works.length.toLocaleString("es-MX");
  headingRow.append(heading, count);

  section.append(eyebrow, headingRow);

  if (!works.length) {
    const empty = document.createElement("p");
    empty.className = "author-dialog-empty";
    empty.textContent = "Esta ficha conserva contribuciones o actividad intelectual, pero todavía no tiene una obra bibliográfica suficientemente documentada.";
    section.append(empty);
    container.append(section);
    return;
  }

  works.sort((a,b) => (workYear(a) ?? 9999) - (workYear(b) ?? 9999));

  const list = document.createElement("div");
  list.className = "author-dossier-work-grid";

  works.forEach((work, index) => {
    const card = document.createElement("article");
    card.className = "author-work-card";

    const rail = document.createElement("div");
    rail.className = "author-work-rail";
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const year = document.createElement("strong");
    year.textContent = workYear(work) ?? "s. f.";
    rail.append(number, year);

    const copy = document.createElement("div");
    copy.className = "author-work-copy";

    const typeLine = document.createElement("p");
    typeLine.className = "author-work-type";
    const descriptors = [
      humanize(work.work_type),
      work.original_language,
      humanize(work.authorship_status)
    ].filter(Boolean);
    typeLine.textContent = descriptors.join(" · ");

    const title = document.createElement("h4");
    title.textContent = work.title || "Título no disponible";

    copy.append(typeLine, title);

    if (Array.isArray(work.coauthors) && work.coauthors.length) {
      const coauthors = document.createElement("p");
      coauthors.className = "author-work-coauthors";
      coauthors.textContent = "Con: " + work.coauthors.join(" · ");
      copy.append(coauthors);
    }

    if (Array.isArray(work.keywords) && work.keywords.length) {
      const chips = document.createElement("div");
      chips.className = "author-dossier-chips author-work-keywords";
      for (const keyword of work.keywords.slice(0, 8)) {
        if (keyword?.term) chips.append(createChip(keyword.term));
      }
      if (chips.childElementCount) copy.append(chips);
    }

    if (work.notes) {
      const note = document.createElement("p");
      note.className = "author-work-note";
      note.textContent = work.notes;
      copy.append(note);
    }

    const links = document.createElement("div");
    links.className = "author-work-links";

    if (work.identifiers?.doi) {
      links.append(createEvidenceLink(
        "https://doi.org/" + String(work.identifiers.doi).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, ""),
        "DOI ↗"
      ));
    }

    const evidence = (work.evidence_urls || []).filter(url => /^https?:\/\//.test(url));
    evidence.slice(0, 4).forEach((url, evidenceIndex) => {
      links.append(createEvidenceLink(url, `Evidencia ${evidenceIndex + 1} ↗`));
    });

    if (Array.isArray(work.identifiers?.isbn) && work.identifiers.isbn.length) {
      const isbn = document.createElement("span");
      isbn.textContent = "ISBN " + work.identifiers.isbn.join(" · ");
      links.append(isbn);
    }

    if (links.childElementCount) copy.append(links);

    card.append(rail, copy);
    list.append(card);
  });

  section.append(list);
  container.append(section);
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantNameTokens(value) {
  const stop = new Set(["de","del","la","las","los","y","e","da","do","dos","das"]);
  return normalizeName(value).split(" ").filter(token => token.length > 1 && !stop.has(token));
}

function authorMatchScore(item, record) {
  const variants = [
    record.canonical_name,
    ...(record.alternate_names || [])
  ].map(normalizeName).filter(Boolean);

  const resultAuthors = (item.authors || [])
    .map(author => normalizeName(author?.name || author?.sourceName))
    .filter(Boolean);

  let best = 0;
  for (const candidate of resultAuthors) {
    for (const variant of variants) {
      if (candidate === variant) best = Math.max(best, 100);
      else if (candidate.length > 5 && (candidate.includes(variant) || variant.includes(candidate))) {
        best = Math.max(best, 90);
      } else {
        const vt = significantNameTokens(variant);
        const ct = significantNameTokens(candidate);
        if (!vt.length || !ct.length) continue;
        const overlap = vt.filter(token => ct.includes(token)).length;
        const surnameMatch = vt.at(-1) && ct.includes(vt.at(-1));
        if (surnameMatch && overlap >= Math.min(2, vt.length)) best = Math.max(best, 78);
      }
    }
  }
  return best;
}

function normalizedDoi(value) {
  return String(value || "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .trim()
    .toLowerCase();
}

function normalizedTitle(value) {
  return normalizeName(value).replace(/\b(el|la|los|las|the|a|an)\b/g, " ").replace(/\s+/g, " ").trim();
}

function curatedOverlap(item, record) {
  const doi = normalizedDoi(item.doi || item.urls?.doi);
  const title = normalizedTitle(item.title);
  return (record.works || []).some(work => {
    const workDoi = normalizedDoi(work.identifiers?.doi);
    if (doi && workDoi && doi === workDoi) return true;
    return title && normalizedTitle(work.title) === title;
  });
}

function liveResultUrl(item) {
  return item.urls?.openAccess ||
    item.urls?.doi ||
    item.urls?.canonical ||
    item.urls?.landing ||
    item.urls?.reference ||
    item.url ||
    null;
}

function loadPhilosophyMap() {
  if (!philosophyMapPromise) {
    philosophyMapPromise = fetch("./src/data/philosophy-map.json")
      .then(response => {
        if (!response.ok) throw new Error("No se pudo cargar philosophy-map.json");
        return response.json();
      })
      .catch(error => {
        philosophyMapPromise = null;
        throw error;
      });
  }
  return philosophyMapPromise;
}

function providerLabel(item) {
  return [...new Set(item.providers || [])].join(" · ") || "Fuente federada";
}

function renderLiveResearchResults(record, response, resultsEl, statusEl) {
  const ranked = (response?.results || [])
    .map(item => ({ item, match: authorMatchScore(item, record) }))
    .filter(entry => entry.match >= 78)
    .sort((a,b) => b.match - a.match || (b.item.relevanceScore || 0) - (a.item.relevanceScore || 0))
    .slice(0, 16);

  const total = response?.results?.length || 0;
  const discarded = Math.max(0, total - ranked.length);
  resultsEl.replaceChildren();

  if (!ranked.length) {
    const empty = document.createElement("div");
    empty.className = "author-live-empty";
    empty.innerHTML = "<strong>No encontré una coincidencia de autoría suficientemente sólida.</strong><p>El motor devolvió resultados, pero esta vista descarta los que sólo mencionan el nombre o no traen autoría verificable.</p>";
    resultsEl.append(empty);
    statusEl.textContent = `${total} resultados revisados · 0 coincidencias de autoría conservadas`;
    return;
  }

  for (const { item, match } of ranked) {
    const card = document.createElement("article");
    card.className = "author-live-result";

    const head = document.createElement("div");
    head.className = "author-live-result-head";

    const source = document.createElement("span");
    source.textContent = providerLabel(item);

    const badge = document.createElement("strong");
    const overlap = curatedOverlap(item, record);
    badge.className = overlap ? "is-curated" : "is-candidate";
    badge.textContent = overlap ? "YA ESTÁ EN LA FICHA" : "CANDIDATA NUEVA";
    head.append(source, badge);

    const title = document.createElement("h4");
    title.textContent = item.title || "Sin título";

    const meta = document.createElement("p");
    const authorNames = (item.authors || []).map(author => author?.name || author?.sourceName).filter(Boolean);
    meta.textContent = [
      authorNames.join(", "),
      item.year,
      humanize(item.type),
      item.journal
    ].filter(Boolean).join(" · ");

    const foot = document.createElement("div");
    foot.className = "author-live-result-foot";

    const confidence = document.createElement("span");
    confidence.textContent = match >= 95 ? "Autoría coincidente" : "Autoría probable";
    foot.append(confidence);

    const url = liveResultUrl(item);
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Abrir registro ↗";
      foot.append(link);
    }

    card.append(head, title);
    if (meta.textContent) card.append(meta);
    card.append(foot);
    resultsEl.append(card);
  }

  statusEl.textContent =
    `${ranked.length} coincidencias de autoría mostradas · ${discarded} resultados descartados por ruido o autoría insuficiente`;
}

async function runLiveAuthorResearch(record, section) {
  const button = section.querySelector("[data-live-author-search]");
  const status = section.querySelector(".author-live-status");
  const results = section.querySelector(".author-live-results");
  if (!button || !status || !results) return;

  const cacheKey = record.author_id;
  if (liveResearchCache.has(cacheKey)) {
    renderLiveResearchResults(record, liveResearchCache.get(cacheKey), results, status);
    return;
  }

  liveResearchController?.abort();
  const controller = new AbortController();
  liveResearchController = controller;
  button.disabled = true;
  button.textContent = "Buscando…";
  status.textContent = "Consultando CUCSH Filosofía · Crossref · Internet Archive…";
  results.innerHTML = '<p class="author-dialog-loading">El motor federado está buscando obras por autoría.</p>';

  try {
    const map = await loadPhilosophyMap();
    const response = await searchPhilosophy(
      record.canonical_name,
      map,
      {
        maxQueries: 1,
        delayBetweenExpansions: 0,
        signal: controller.signal,
        openAlexPhilosophy: { enabled: false },
        cucshFilosofia: { enabled: true, rows: 12 },
        crossref: { enabled: true, rows: 12 },
        internetArchive: { enabled: true, rows: 12 },
        orcid: { enabled: false },
        onPartialResults: partial => {
          if (!controller.signal.aborted && liveResearchController === controller) {
            renderLiveResearchResults(record, partial, results, status);
          }
        }
      }
    );
    liveResearchCache.set(cacheKey, response);
    renderLiveResearchResults(record, response, results, status);
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.error(error);
    results.innerHTML = '<div class="author-live-empty"><strong>No fue posible completar la búsqueda.</strong><p>Puede intentarlo de nuevo; la ficha curada no se modifica.</p></div>';
    status.textContent = "Búsqueda federada no disponible en este momento.";
  } finally {
    if (liveResearchController === controller) {
      liveResearchController = null;
      button.disabled = false;
      button.textContent = "Buscar obras en el motor";
    }
  }
}

function appendLiveResearch(record, container) {
  const section = document.createElement("section");
  section.id = "author-dossier-research-section";
  section.className = "author-dossier-section author-dossier-live-research";

  const eyebrow = document.createElement("p");
  eyebrow.className = "author-dossier-section-index";
  eyebrow.textContent = "III / MOTOR DE INVESTIGACIÓN";

  const heading = document.createElement("h3");
  heading.textContent = "Buscar más allá de la ficha.";

  const intro = document.createElement("p");
  intro.className = "author-dossier-lede";
  intro.textContent = "Consulta en vivo el mismo motor federado de Investigación Filosófica. Estos resultados no se incorporan automáticamente a la bibliografía curada: sirven para descubrir y contrastar nuevas obras.";

  const controls = document.createElement("div");
  controls.className = "author-live-controls";
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.liveAuthorSearch = String(record.author_id);
  button.textContent = "Buscar obras en el motor";

  const status = document.createElement("p");
  status.className = "author-live-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.textContent = "Búsqueda bajo demanda · CUCSH Filosofía · Crossref · Internet Archive";

  controls.append(button, status);

  const legend = document.createElement("div");
  legend.className = "author-live-legend";
  legend.innerHTML = '<span><i class="is-curated"></i> Ya está en la ficha</span><span><i class="is-candidate"></i> Candidata nueva</span>';

  const results = document.createElement("div");
  results.className = "author-live-results";

  section.append(eyebrow, heading, intro, controls, legend, results);
  button.addEventListener("click", () => runLiveAuthorResearch(record, section));
  container.append(section);
}

function appendSources(record, container) {
  const section = document.createElement("section");
  section.id = "author-dossier-sources-section";
  section.className = "author-dossier-section author-dossier-sources";

  const eyebrow = document.createElement("p");
  eyebrow.className = "author-dossier-section-index";
  eyebrow.textContent = "IV / FUENTES";

  const headingRow = document.createElement("div");
  headingRow.className = "author-dossier-section-heading";
  const heading = document.createElement("h3");
  heading.textContent = "De dónde sale esta ficha.";
  const sources = (record.sources || []).filter(source => /^https?:\/\//.test(source?.url || ""));
  const count = document.createElement("span");
  count.textContent = sources.length.toLocaleString("es-MX");
  headingRow.append(heading, count);
  section.append(eyebrow, headingRow);

  if (!sources.length) {
    const empty = document.createElement("p");
    empty.className = "author-dialog-empty";
    empty.textContent = "Todavía no hay fuentes enlazables registradas en esta ficha.";
    section.append(empty);
    container.append(section);
    return;
  }

  const list = document.createElement("div");
  list.className = "author-source-grid";

  sources.forEach((source, index) => {
    const link = document.createElement("a");
    link.className = "author-source-card";
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const kind = document.createElement("small");
    kind.textContent = humanize(source.kind) || "fuente";
    const title = document.createElement("strong");
    title.textContent = source.title || "Fuente";
    const action = document.createElement("em");
    action.textContent = "Abrir fuente ↗";

    link.append(number, kind, title, action);
    list.append(link);
  });

  section.append(list);
  container.append(section);
}

function appendNotes(record, container) {
  const section = document.createElement("section");
  section.id = "author-dossier-notes-section";
  section.className = "author-dossier-section author-dossier-notes";

  const eyebrow = document.createElement("p");
  eyebrow.className = "author-dossier-section-index";
  eyebrow.textContent = "V / NOTAS DE INVESTIGACIÓN";

  const heading = document.createElement("h3");
  heading.textContent = "Lo que todavía exige cuidado.";
  section.append(eyebrow, heading);

  const notes = Array.isArray(record.research_notes)
    ? record.research_notes.filter(Boolean)
    : [];

  if (!notes.length) {
    const empty = document.createElement("p");
    empty.className = "author-dialog-empty";
    empty.textContent = "Esta ficha no contiene notas editoriales adicionales por ahora.";
    section.append(empty);
  } else {
    const list = document.createElement("ol");
    list.className = "author-note-list";
    notes.forEach((note, index) => {
      const item = document.createElement("li");
      const number = document.createElement("span");
      number.textContent = String(index + 1).padStart(2, "0");
      const text = document.createElement("p");
      text.textContent = note;
      item.append(number, text);
      list.append(item);
    });
    section.append(list);
  }

  container.append(section);
}

function renderDossierIdentity(record) {
  const works = Array.isArray(record.works) ? record.works : [];
  const contributions = Array.isArray(record.non_bibliographic_contributions)
    ? record.non_bibliographic_contributions
    : [];
  const sources = Array.isArray(record.sources) ? record.sources : [];
  const period = periodMetaFor(record);

  authorDialog.className = `author-dialog author-dossier period-${period.id}`;
  authorDialogTitle.textContent = record.canonical_name || "Autor";
  authorDialogLife.textContent = lifeText(record);
  authorDossierIndex.textContent = `ARCHIVO / #${canonicalId(record.author_id)}`;
  authorDossierStatus.textContent = "FICHA BIBLIOGRÁFICA · ARCHIVO VIVO";
  authorDossierPeriodRoman.textContent = period.roman;
  authorDossierPeriodLabel.textContent = period.title;
  authorDossierMonogram.textContent = dossierMonogram(record.canonical_name);
  authorDossierWorks.textContent = works.length.toLocaleString("es-MX");
  authorDossierContributions.textContent = contributions.length.toLocaleString("es-MX");
  authorDossierSources.textContent = sources.length.toLocaleString("es-MX");
  authorDossierCoverage.textContent = coverageText(record);

  const aliases = (record.alternate_names || [])
    .filter(Boolean)
    .filter(name => normalizeText(name) !== normalizeText(record.canonical_name));

  authorDossierAliases.replaceChildren();
  if (aliases.length) {
    const label = document.createElement("span");
    label.textContent = "También aparece como";
    const text = document.createElement("strong");
    text.textContent = aliases.join(" · ");
    authorDossierAliases.append(label, text);
    authorDossierAliases.hidden = false;
  } else {
    authorDossierAliases.hidden = true;
  }

  authorDialogPrev.disabled = record.author_id <= 1;
  authorDialogNext.disabled = record.author_id >= seededCount;
}

function renderAuthorDialog(record) {
  currentAuthorId = Number(record.author_id);
  renderDossierIdentity(record);
  authorDialogBody.replaceChildren();

  appendOverview(record, authorDialogBody);
  appendWorkList(record, authorDialogBody);
  appendLiveResearch(record, authorDialogBody);
  appendSources(record, authorDialogBody);
  appendNotes(record, authorDialogBody);

  authorDialog.querySelector(".author-dialog-shell")?.scrollTo({ top: 0, behavior: "auto" });
}

function authorHash(id) {
  return `#autor-${canonicalId(id)}`;
}

async function openAuthorDialog(id, { updateHistory = true } = {}) {
  liveResearchController?.abort();
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1 || numericId > seededCount) return;

  if (!authorDialog.open) {
    dialogReturnHash = location.hash.startsWith("#autor-") ? "" : location.hash;
  }

  currentAuthorId = numericId;
  const inventoryAuthor = authors.find(author => Number(author.id) === numericId);
  authorDialogTitle.textContent = inventoryAuthor?.name || "Cargando…";
  authorDialogLife.textContent = "";
  authorDossierIndex.textContent = `ARCHIVO / #${canonicalId(numericId)}`;
  authorDialogBody.innerHTML =
    '<p class="author-dialog-loading">Abriendo dossier bibliográfico…</p>';

  if (typeof authorDialog.showModal === "function") {
    if (!authorDialog.open) authorDialog.showModal();
  } else {
    authorDialog.setAttribute("open", "");
  }

  if (updateHistory && location.hash !== authorHash(numericId)) {
    history.replaceState(null, "", authorHash(numericId));
  }

  try {
    const record = await fetchAuthorRecord(numericId);
    renderAuthorDialog(record);
  } catch (error) {
    console.error(error);
    authorDialogBody.innerHTML =
      '<p class="author-dialog-empty">No fue posible cargar este dossier en este momento.</p>';
  }
}

function closeAuthorDialog({ restoreHistory = true } = {}) {
  liveResearchController?.abort();
  if (typeof authorDialog.close === "function" && authorDialog.open) {
    authorDialog.close();
  } else {
    authorDialog.removeAttribute("open");
  }

  currentAuthorId = null;
  if (restoreHistory && location.hash.startsWith("#autor-")) {
    history.replaceState(null, "", dialogReturnHash || location.pathname + location.search);
  }
}

async function navigateAuthor(offset) {
  if (!Number.isInteger(currentAuthorId)) return;
  const nextId = currentAuthorId + offset;
  if (nextId < 1 || nextId > seededCount) return;
  await openAuthorDialog(nextId);
}

async function shareCurrentAuthor() {
  if (!Number.isInteger(currentAuthorId)) return;
  const url = new URL(location.href);
  url.hash = authorHash(currentAuthorId);

  const original = authorDialogShare.textContent;
  try {
    await navigator.clipboard.writeText(url.href);
    authorDialogShare.textContent = "Enlace copiado";
  } catch {
    authorDialogShare.textContent = "Copie la URL";
  }
  setTimeout(() => {
    authorDialogShare.textContent = original;
  }, 1600);
}

async function init() {
  try {
    const [inventoryResponse, manifestResponse] = await Promise.all([
      fetch(INVENTORY_URL),
      fetch(MANIFEST_URL)
    ]);

    if (!inventoryResponse.ok || !manifestResponse.ok) {
      throw new Error("No se pudo cargar el archivo.");
    }

    const inventoryPayload = await inventoryResponse.json();
    const manifest = await manifestResponse.json();

    authors = normalizedInventory(inventoryPayload);
    seededCount = Number(manifest?.progress?.authors_seeded || 0);

    document.querySelector("#stat-total").textContent =
      authors.length.toLocaleString("es-MX");
    document.querySelector("#stat-seeded").textContent =
      seededCount.toLocaleString("es-MX");
    document.querySelector("#stat-records").textContent =
      Number(manifest?.progress?.works_or_contributions_seeded || 0).toLocaleString("es-MX");

    renderDirectory({ reset: true });

    const deepLink = location.hash.match(/^#autor-(\d{4})$/);
    if (deepLink) {
      const deepLinkId = Number(deepLink[1]);
      if (deepLinkId >= 1 && deepLinkId <= seededCount) {
        openAuthorDialog(deepLinkId, { updateHistory: false });
      }
    }

    periodizationStatus.textContent =
      `${seededCount.toLocaleString("es-MX")} fichas disponibles. Se cargarán en bloques de ${PERIOD_BATCH_SIZE} al llegar a esta sección.`;
    loadMorePeriodAuthors.hidden = seededCount === 0;

    if ("IntersectionObserver" in window && worksSection) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting) && !periodHydrationStarted) {
          observer.disconnect();
          loadNextPeriodBatch();
        }
      }, { rootMargin: "420px 0px" });
      observer.observe(worksSection);
    } else if (seededCount) {
      loadNextPeriodBatch();
    }
  } catch (error) {
    console.error(error);
    directoryStatus.textContent = "No fue posible cargar el inventario en este momento.";
    periodizationStatus.textContent = "No fue posible cargar las fichas bibliográficas.";
    loadMorePeriodAuthors.hidden = true;
  }
}

searchInput?.addEventListener("input", () => renderDirectory({ reset: true }));

explorerSearch?.addEventListener("input", () => {
  clearTimeout(explorerSearchTimer);
  explorerSearchTimer = setTimeout(renderExplorerSearch, 180);
});

for (const button of explorerPeriodButtons) {
  button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
  button.addEventListener("click", () => setExplorerPeriod(button.dataset.explorerPeriod));
}

collapsePeriodsButton?.addEventListener("click", () => {
  for (const period of PERIODS) collapsedPeriods.add(period.id);
  renderPeriodized();
});

expandPeriodsButton?.addEventListener("click", () => {
  collapsedPeriods.clear();
  renderPeriodized();
});

for (const button of filterButtons) {
  button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
  button.addEventListener("click", () => setFilter(button.dataset.statusFilter));
}

loadMore?.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderDirectory();
});

loadMorePeriodAuthors?.addEventListener("click", loadNextPeriodBatch);

for (const button of document.querySelectorAll("[data-period-jump]")) {
  button.addEventListener("click", async () => {
    const periodId = button.dataset.periodJump;
    collapsedPeriods.delete(periodId);

    const target = seededCount
      ? await ensurePeriodAvailable(periodId)
      : worksSection;

    renderPeriodized();
    const resolvedTarget = document.querySelector(`#coleccion-${periodId}`) || target;

    resolvedTarget?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
  });
}

authorDialogClose?.addEventListener("click", () => closeAuthorDialog());
authorDialogPrev?.addEventListener("click", () => navigateAuthor(-1));
authorDialogNext?.addEventListener("click", () => navigateAuthor(1));
authorDialogShare?.addEventListener("click", shareCurrentAuthor);
for (const button of document.querySelectorAll("[data-dossier-target]")) {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.dossierTarget);
    target?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
  });
}
authorDialog?.addEventListener("click", event => {
  if (event.target === authorDialog) closeAuthorDialog();
});
authorDialog?.addEventListener("cancel", event => {
  event.preventDefault();
  closeAuthorDialog();
});
addEventListener("popstate", () => {
  if (!location.hash.startsWith("#autor-") && authorDialog.open) {
    closeAuthorDialog({ restoreHistory: false });
  }
});

init();

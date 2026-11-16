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

const authorCache = new Map();

const PERIODS = [
  {
    id: "originarios",
    roman: "I",
    title: "Filosofías de algunos pueblos originarios",
    note: "Primera época del libro · clasificación automática provisional"
  },
  {
    id: "colonial",
    roman: "II",
    title: "Filosofía colonial en la modernidad temprana",
    note: "Segunda época del libro · clasificación automática provisional"
  },
  {
    id: "madura",
    roman: "III",
    title: "Filosofía ante la modernidad madura",
    note: "Tercera época del libro · clasificación automática provisional"
  },
  {
    id: "sigloxx",
    roman: "IV",
    title: "Corrientes filosóficas del siglo XX",
    note: "Segunda parte del libro · clasificación automática provisional"
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
    <span class="author-id">#${canonicalId(author.id)}</span>
    <h3></h3>
    <span class="author-state ${seeded ? "seeded" : "pending"}">
      ${seeded ? "● con obra documentada" : "○ pendiente"}
    </span>
  `;
  card.querySelector("h3").textContent = author.name;

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

  const born = record.life?.born?.year;
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

function makeMiniAuthor(record) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "mini-author";
  card.dataset.authorId = String(record.author_id);
  card.setAttribute("aria-label", `Abrir ficha de ${record.canonical_name}`);

  const worksCount = Array.isArray(record.works) ? record.works.length : 0;
  card.innerHTML = "<strong></strong><small></small>";
  card.querySelector("strong").textContent = record.canonical_name;
  card.querySelector("small").textContent =
    `#${canonicalId(record.author_id)} · ${worksCount} ${worksCount === 1 ? "obra documentada" : "obras documentadas"}`;
  card.addEventListener("click", () => openAuthorDialog(record.author_id));
  return card;
}

function periodGroup(period, records) {
  const section = document.createElement("section");
  section.className = `period-author-group period-${period.id}`;
  section.id = `coleccion-${period.id}`;

  const header = document.createElement("header");
  header.innerHTML = `
    <span>${period.roman}</span>
    <div><h3></h3><small></small></div>
    <small class="period-count"></small>
  `;
  header.querySelector("h3").textContent = period.title;
  header.querySelector("div small").textContent = period.note;
  header.querySelector(".period-count").textContent =
    `${records.length.toLocaleString("es-MX")} cargadas`;

  const list = document.createElement("div");
  list.className = "period-author-list";
  list.replaceChildren(...records.map(makeMiniAuthor));

  section.append(header, list);
  return section;
}

function renderPeriodized() {
  const byPeriod = Object.fromEntries(PERIODS.map(period => [period.id, []]));

  for (const record of hydratedAuthors) {
    byPeriod[inferPeriod(record)].push(record);
  }

  const groups = PERIODS
    .filter(period => period.id !== "por-ubicar" || byPeriod[period.id].length)
    .map(period => periodGroup(period, byPeriod[period.id]));

  periodizedAuthors.replaceChildren(...groups);
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
    `${hydratedAuthors.length.toLocaleString("es-MX")} de ${seededCount.toLocaleString("es-MX")} fichas cargadas. Periodización cronológica provisional; la clasificación fina por capítulo y corriente se curará después.`;

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
  const born = record.life?.born?.year;
  const died = record.life?.died?.year;
  if (Number.isFinite(born) && Number.isFinite(died)) return `${born}–${died}`;
  if (Number.isFinite(born)) return `n. ${born}`;
  if (Number.isFinite(died)) return `† ${died}`;
  return "Fechas no fijadas en esta ficha";
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
  return "Cobertura bibliográfica en construcción";
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

function appendSources(record, container) {
  const section = document.createElement("section");
  section.id = "author-dossier-sources-section";
  section.className = "author-dossier-section author-dossier-sources";

  const eyebrow = document.createElement("p");
  eyebrow.className = "author-dossier-section-index";
  eyebrow.textContent = "III / FUENTES";

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
  eyebrow.textContent = "IV / NOTAS DE INVESTIGACIÓN";

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
  appendSources(record, authorDialogBody);
  appendNotes(record, authorDialogBody);

  authorDialog.querySelector(".author-dialog-shell")?.scrollTo({ top: 0, behavior: "auto" });
}

function authorHash(id) {
  return `#autor-${canonicalId(id)}`;
}

async function openAuthorDialog(id, { updateHistory = true } = {}) {
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
    const target = seededCount
      ? await ensurePeriodAvailable(button.dataset.periodJump)
      : worksSection;

    target?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
  });
}

authorDialogClose?.addEventListener("click", () => closeAuthorDialog());
authorDialogPrev?.addEventListener("click", () => navigateAuthor(-1));
authorDialogNext?.addEventListener("click", () => navigateAuthor(1));
authorDialogShare?.addEventListener("click", shareCurrentAuthor);
authorDialog?.addEventListener("click", event => {
  if (event.target === authorDialog) closeAuthorDialog();
});
addEventListener("popstate", () => {
  if (!location.hash.startsWith("#autor-") && authorDialog.open) {
    closeAuthorDialog({ restoreHistory: false });
  }
});

init();

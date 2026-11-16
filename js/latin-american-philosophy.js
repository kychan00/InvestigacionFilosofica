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

let authors = [];
let seededCount = 0;
let currentFilter = "all";
let visibleCount = PAGE_SIZE;
let hydratedAuthors = [];
let periodCursor = 0;
let periodLoading = false;
let periodHydrationStarted = false;

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

function appendWorkList(record, container) {
  const section = document.createElement("section");
  section.className = "author-dialog-section";

  const heading = document.createElement("div");
  heading.className = "author-dialog-section-heading";
  const h3 = document.createElement("h3");
  h3.textContent = "Obras documentadas";
  const count = document.createElement("span");
  const works = Array.isArray(record.works) ? record.works : [];
  count.textContent = works.length.toLocaleString("es-MX");
  heading.append(h3, count);
  section.append(heading);

  if (!works.length) {
    const empty = document.createElement("p");
    empty.className = "author-dialog-empty";
    empty.textContent = "Esta ficha conserva contribuciones o actividad intelectual, pero todavía no tiene una obra bibliográfica suficientemente documentada.";
    section.append(empty);
  } else {
    const list = document.createElement("ol");
    list.className = "author-work-list";

    for (const work of works) {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = work.title || "Título no disponible";

      const meta = document.createElement("small");
      const year = work?.original_date?.year ?? work?.first_publication_year ?? "s. f.";
      const type = humanize(work.work_type);
      meta.textContent = [year, type].filter(Boolean).join(" · ");

      const note = document.createElement("p");
      note.textContent = work.notes || "";

      item.append(title, meta);
      if (work.notes) item.append(note);
      list.append(item);
    }
    section.append(list);
  }

  container.append(section);
}

function appendContributions(record, container) {
  const contributions = Array.isArray(record.non_bibliographic_contributions)
    ? record.non_bibliographic_contributions
    : [];
  if (!contributions.length) return;

  const section = document.createElement("section");
  section.className = "author-dialog-section";

  const heading = document.createElement("div");
  heading.className = "author-dialog-section-heading";
  const h3 = document.createElement("h3");
  h3.textContent = "Contribuciones intelectuales";
  const count = document.createElement("span");
  count.textContent = contributions.length.toLocaleString("es-MX");
  heading.append(h3, count);

  const list = document.createElement("ul");
  list.className = "author-contribution-list";

  for (const contribution of contributions) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = contribution.title || "Contribución documentada";
    const meta = document.createElement("small");
    meta.textContent = humanize(contribution.kind);
    item.append(title);
    if (contribution.kind) item.append(meta);
    list.append(item);
  }

  section.append(heading, list);
  container.append(section);
}

function appendSources(record, container) {
  const sources = (record.sources || []).filter(source => /^https?:\/\//.test(source?.url || ""));
  if (!sources.length) return;

  const section = document.createElement("section");
  section.className = "author-dialog-section";

  const heading = document.createElement("div");
  heading.className = "author-dialog-section-heading";
  const h3 = document.createElement("h3");
  h3.textContent = "Fuentes de la ficha";
  const count = document.createElement("span");
  count.textContent = sources.length.toLocaleString("es-MX");
  heading.append(h3, count);

  const list = document.createElement("ul");
  list.className = "author-source-list";

  for (const source of sources) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = source.title || source.kind || "Fuente";
    item.append(link);
    list.append(item);
  }

  section.append(heading, list);
  container.append(section);
}

function renderAuthorDialog(record) {
  authorDialogTitle.textContent = record.canonical_name || "Autor";
  authorDialogLife.textContent = lifeText(record);
  authorDialogBody.replaceChildren();

  appendWorkList(record, authorDialogBody);
  appendContributions(record, authorDialogBody);
  appendSources(record, authorDialogBody);

  const notes = Array.isArray(record.research_notes) ? record.research_notes.filter(Boolean) : [];
  if (notes.length) {
    const section = document.createElement("section");
    section.className = "author-dialog-section author-dialog-notes";
    const heading = document.createElement("h3");
    heading.textContent = "Notas de investigación";
    const list = document.createElement("ul");
    for (const note of notes.slice(0, 4)) {
      const item = document.createElement("li");
      item.textContent = note;
      list.append(item);
    }
    section.append(heading, list);
    authorDialogBody.append(section);
  }
}

async function openAuthorDialog(id) {
  const inventoryAuthor = authors.find(author => Number(author.id) === Number(id));
  authorDialogTitle.textContent = inventoryAuthor?.name || "Cargando…";
  authorDialogLife.textContent = "";
  authorDialogBody.innerHTML =
    '<p class="author-dialog-loading">Cargando ficha bibliográfica…</p>';

  if (typeof authorDialog.showModal === "function") {
    if (!authorDialog.open) authorDialog.showModal();
  } else {
    authorDialog.setAttribute("open", "");
  }

  try {
    const record = await fetchAuthorRecord(id);
    renderAuthorDialog(record);
  } catch (error) {
    console.error(error);
    authorDialogBody.innerHTML =
      '<p class="author-dialog-empty">No fue posible cargar esta ficha en este momento.</p>';
  }
}

function closeAuthorDialog() {
  if (typeof authorDialog.close === "function" && authorDialog.open) {
    authorDialog.close();
  } else {
    authorDialog.removeAttribute("open");
  }
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

authorDialogClose?.addEventListener("click", closeAuthorDialog);
authorDialog?.addEventListener("click", event => {
  if (event.target === authorDialog) closeAuthorDialog();
});

init();

const INVENTORY_URL = "./src/data/latin-american-philosophers-metadata.json";
const MANIFEST_URL = "./src/data/philosopher-works/manifest.json";
const AUTHOR_BASE = "./src/data/philosopher-works/authors/";
const PAGE_SIZE = 80;
const HYDRATION_CONCURRENCY = 8;

const directory = document.querySelector("#author-directory");
const directoryStatus = document.querySelector("#directory-status");
const searchInput = document.querySelector("#author-search");
const filterButtons = [...document.querySelectorAll("[data-status-filter]")];
const loadMore = document.querySelector("#load-more-authors");
const periodizedAuthors = document.querySelector("#periodized-authors");
const periodizationStatus = document.querySelector("#periodization-status");

let authors = [];
let seededCount = 0;
let currentFilter = "all";
let visibleCount = PAGE_SIZE;
let hydratedAuthors = [];

const PERIODS = [
  {
    id: "originarios",
    roman: "I",
    title: "Filosofías de algunos pueblos originarios",
    note: "Antes de la invasión europea · eje simbólico desde 1300"
  },
  {
    id: "colonial",
    roman: "II",
    title: "Filosofía colonial en la modernidad temprana",
    note: "Conquista, debate de la modernidad, escolástica, lógica y barroco"
  },
  {
    id: "madura",
    roman: "III",
    title: "Filosofía ante la modernidad madura",
    note: "Ilustración, independencia, liberalismo, krausismo y positivismo"
  },
  {
    id: "sigloxx",
    roman: "IV",
    title: "Corrientes filosóficas del siglo XX",
    note: "Antipositivismo y corrientes contemporáneas"
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

function authorCard(author) {
  const article = document.createElement("article");
  article.className = "author-card";
  const seeded = authorHasSeed(author);
  article.innerHTML = `
    <span class="author-id">#${canonicalId(author.id)}</span>
    <h3></h3>
    <span class="author-state ${seeded ? "seeded" : "pending"}">
      ${seeded ? "● con obra documentada" : "○ pendiente"}
    </span>
  `;
  article.querySelector("h3").textContent = author.name;
  return article;
}

function renderDirectory({ reset = false } = {}) {
  if (reset) visibleCount = PAGE_SIZE;
  const matches = filteredAuthors();
  const shown = matches.slice(0, visibleCount);
  directory.replaceChildren(...shown.map(authorCard));
  directoryStatus.textContent =
    `${matches.length.toLocaleString("es-MX")} autores · mostrando ${shown.length.toLocaleString("es-MX")}`;
  loadMore.hidden = shown.length >= matches.length;
}

function setFilter(value) {
  currentFilter = value;
  for (const button of filterButtons) {
    button.classList.toggle("is-active", button.dataset.statusFilter === value);
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
  if (year === null) return "sigloxx";
  if (year < 1492) return "originarios";
  if (year < 1750) return "colonial";
  if (year < 1900) return "madura";
  return "sigloxx";
}

function periodGroup(period, records) {
  const section = document.createElement("section");
  section.className = "period-author-group";
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
    `${records.length.toLocaleString("es-MX")} fichas`;

  const list = document.createElement("div");
  list.className = "period-author-list";
  for (const record of records) {
    const card = document.createElement("article");
    card.className = "mini-author";
    const worksCount = Array.isArray(record.works) ? record.works.length : 0;
    card.innerHTML = "<strong></strong><small></small>";
    card.querySelector("strong").textContent = record.canonical_name;
    card.querySelector("small").textContent =
      `#${canonicalId(record.author_id)} · ${worksCount} ${worksCount === 1 ? "obra" : "obras"} en seed`;
    list.append(card);
  }
  section.append(header, list);
  return section;
}

function renderPeriodized() {
  const byPeriod = Object.fromEntries(PERIODS.map(period => [period.id, []]));
  for (const record of hydratedAuthors) {
    byPeriod[inferPeriod(record)].push(record);
  }
  periodizedAuthors.replaceChildren(
    ...PERIODS.map(period => periodGroup(period, byPeriod[period.id]))
  );
}

async function fetchAuthorRecord(id) {
  const url = `${AUTHOR_BASE}${canonicalId(id)}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
  return response.json();
}

async function hydrateSeededAuthors() {
  if (!seededCount) return;
  periodizedAuthors.innerHTML =
    '<div class="period-loading">Clasificando las fichas por su fecha histórica…</div>';

  const ids = Array.from({ length: seededCount }, (_, index) => index + 1);
  const records = [];
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        records.push(await fetchAuthorRecord(id));
      } catch {
        // A missing file should not collapse the complete archive.
      }
      completed += 1;
      if (completed % 25 === 0 || completed === ids.length) {
        periodizationStatus.textContent =
          `Periodizando fichas: ${completed.toLocaleString("es-MX")} / ${ids.length.toLocaleString("es-MX")}…`;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(HYDRATION_CONCURRENCY, ids.length) }, worker)
  );

  hydratedAuthors = records.sort((a,b) => a.author_id - b.author_id);
  renderPeriodized();
  periodizationStatus.textContent =
    `${hydratedAuthors.length.toLocaleString("es-MX")} fichas organizadas en las grandes épocas del libro. Clasificación cronológica provisional; la corriente filosófica fina se curará después.`;
}

async function init() {
  try {
    const [inventoryResponse, manifestResponse] = await Promise.all([
      fetch(INVENTORY_URL),
      fetch(MANIFEST_URL)
    ]);
    if (!inventoryResponse.ok || !manifestResponse.ok) throw new Error("No se pudo cargar el archivo.");
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
    hydrateSeededAuthors();
  } catch (error) {
    console.error(error);
    directoryStatus.textContent = "No fue posible cargar el inventario en este momento.";
    periodizationStatus.textContent = "No fue posible cargar las fichas bibliográficas.";
  }
}

searchInput?.addEventListener("input", () => renderDirectory({ reset: true }));
for (const button of filterButtons) {
  button.addEventListener("click", () => setFilter(button.dataset.statusFilter));
}
loadMore?.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderDirectory();
});
for (const button of document.querySelectorAll("[data-period-jump]")) {
  button.addEventListener("click", () => {
    document.querySelector(`#coleccion-${button.dataset.periodJump}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

init();

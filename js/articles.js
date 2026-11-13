const DATA_URL = "./src/data/cucsh-filosofia.json";
const PAGE_SIZE = 24;

const journalConfig = {
  protrepsis: {
    label: "Protrepsis",
    matcher: value => /protrepsis/i.test(value || ""),
    description: "Revista de filosofía del CUCSH. Aquí se reúnen sus artículos como una colección propia, sin perder el enlace hacia la publicación original.",
    source: "http://protrepsis.cucsh.udg.mx/",
    page: "./revistas/udg/protrepsis.html"
  },
  sincronia: {
    label: "Sincronía",
    matcher: value => /sincron/i.test(value || ""),
    description: "Espacio dedicado a Sincronía dentro del archivo UdeG. La vista ya está preparada para recibir y ordenar su corpus completo como una colección independiente.",
    source: "https://revistasincronia.cucsh.udg.mx/index.php/sincronia",
    page: "./revistas/udg/sincronia.html"
  },
  quadripartita: {
    label: "Quadripartita Ratio",
    matcher: value => /quadripartita/i.test(value || ""),
    description: "Colección de Quadripartita Ratio integrada como revista independiente dentro de la Universidad de Guadalajara.",
    source: "https://quadripartitaratio.cucsh.udg.mx/",
    page: "./revistas/udg/quadripartita-ratio.html"
  }
};

const state = {
  records: [],
  journal: "protrepsis",
  query: "",
  limit: PAGE_SIZE
};

const elements = {
  total: document.querySelector("#articles-total"),
  title: document.querySelector("#journal-title"),
  description: document.querySelector("#journal-description"),
  source: document.querySelector("#journal-source-link"),
  page: document.querySelector("#journal-page-link"),
  status: document.querySelector("#journal-status"),
  search: document.querySelector("#journal-search"),
  results: document.querySelector("#journal-results"),
  loadMore: document.querySelector("#journal-load-more"),
  tabs: [...document.querySelectorAll("[data-journal]")]
};

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function recordSearchText(record) {
  const authors = (record.authors || [])
    .map(author => author?.name || author?.sourceName || "")
    .join(" ");

  return normalize([
    record.title,
    authors,
    record.abstract,
    ...(record.subjects || []),
    record.journal,
    record.year
  ].join(" "));
}

function selectedRecords() {
  const config = journalConfig[state.journal];
  const query = normalize(state.query);

  return state.records
    .filter(record => config.matcher(record.journal))
    .filter(record => !query || recordSearchText(record).includes(query))
    .sort((a, b) => {
      const yearA = Number(a.year || 0);
      const yearB = Number(b.year || 0);
      if (yearA !== yearB) return yearB - yearA;
      return String(a.title || "").localeCompare(String(b.title || ""), "es");
    });
}

function authorLabel(record) {
  const names = (record.authors || [])
    .map(author => author?.name || author?.sourceName)
    .filter(Boolean);

  return names.length ? names.join(" · ") : "Autor no indicado";
}

function recordLink(record) {
  return record.urls?.canonical || record.urls?.doi || (record.doi ? "https://doi.org/" + record.doi : "");
}

function articleCard(record, index) {
  const article = document.createElement("article");
  article.className = "article-card";

  const number = document.createElement("span");
  number.className = "article-card-index";
  number.textContent = String(index + 1).padStart(3, "0");

  const copy = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = record.title || "Sin título";
  const authors = document.createElement("p");
  authors.className = "article-card-authors";
  authors.textContent = authorLabel(record);
  copy.append(title, authors);

  const meta = document.createElement("div");
  meta.className = "article-card-meta";

  const year = document.createElement("span");
  year.textContent = record.year ? "Año · " + record.year : "Año no indicado";

  const journal = document.createElement("span");
  journal.textContent = record.journal || "Revista UdeG";

  meta.append(year, journal);

  if (record.doi) {
    const doi = document.createElement("span");
    doi.textContent = "DOI · " + record.doi;
    meta.append(doi);
  }

  const href = recordLink(record);
  if (href) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Abrir artículo ↗";
    meta.append(link);
  }

  article.append(number, copy, meta);
  return article;
}

function emptyState(config) {
  const wrapper = document.createElement("div");
  wrapper.className = "journal-empty";

  const title = document.createElement("h3");
  title.textContent = state.query
    ? "No encontramos coincidencias."
    : "La colección está preparada.";

  const copy = document.createElement("p");
  copy.textContent = state.query
    ? "Pruebe con otro título, autor o concepto dentro de esta revista."
    : "Todavía no hay registros de " + config.label + " en el corpus publicado que carga esta página. Cuando se incorpore su lote, aparecerá aquí automáticamente sin cambiar la navegación.";

  wrapper.append(title, copy);
  return wrapper;
}

function updateCounts() {
  const counts = {
    protrepsis: 0,
    sincronia: 0,
    quadripartita: 0
  };

  for (const record of state.records) {
    for (const [id, config] of Object.entries(journalConfig)) {
      if (config.matcher(record.journal)) {
        counts[id]++;
        break;
      }
    }
  }

  if (elements.total) {
    elements.total.textContent = String(
      counts.protrepsis + counts.sincronia + counts.quadripartita
    );
  }

  for (const [id, count] of Object.entries(counts)) {
    const element = document.querySelector("#count-" + id);
    if (element) element.textContent = count ? count + " artículos" : "sin registros";
  }
}

function syncUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("universidad", "udg");
  url.searchParams.set("revista", state.journal);
  url.hash = "revistas";
  history.replaceState(null, "", url);
}

function render() {
  const config = journalConfig[state.journal];
  const records = selectedRecords();

  elements.title.textContent = config.label;
  elements.description.textContent = config.description;
  elements.source.href = config.source;
  if (elements.page) elements.page.href = config.page;

  for (const tab of elements.tabs) {
    const selected = tab.dataset.journal === state.journal;
    tab.setAttribute("aria-selected", String(selected));
  }

  elements.results.replaceChildren();

  if (!records.length) {
    elements.results.append(emptyState(config));
    elements.status.textContent = state.query
      ? "0 coincidencias"
      : "Sin registros publicados en esta colección";
    elements.loadMore.hidden = true;
    return;
  }

  const visible = records.slice(0, state.limit);
  visible.forEach((record, index) => {
    elements.results.append(articleCard(record, index));
  });

  elements.status.textContent =
    records.length + (records.length === 1 ? " artículo" : " artículos") +
    (state.query ? " · búsqueda aplicada" : "");

  elements.loadMore.hidden = visible.length >= records.length;
}

function selectJournal(id, { updateUrl = true } = {}) {
  if (!journalConfig[id]) return;
  state.journal = id;
  state.limit = PAGE_SIZE;
  state.query = "";
  if (elements.search) elements.search.value = "";
  if (updateUrl) syncUrl();
  render();
}

for (const tab of elements.tabs) {
  tab.addEventListener("click", () => {
    selectJournal(tab.dataset.journal);
  });
}

elements.search?.addEventListener("input", event => {
  state.query = event.target.value;
  state.limit = PAGE_SIZE;
  render();
});

elements.loadMore?.addEventListener("click", () => {
  state.limit += PAGE_SIZE;
  render();
});

async function load() {
  const requested = new URLSearchParams(window.location.search).get("revista");
  if (requested && journalConfig[requested]) {
    state.journal = requested;
  }

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const payload = await response.json();
    state.records = Array.isArray(payload.records) ? payload.records : [];
    updateCounts();
    render();
  } catch (error) {
    console.error("No se pudo cargar el archivo de revistas CUCSH.", error);
    elements.status.textContent = "No se pudo cargar el corpus de artículos.";
    elements.results.replaceChildren(emptyState(journalConfig[state.journal]));
  }
}

load();

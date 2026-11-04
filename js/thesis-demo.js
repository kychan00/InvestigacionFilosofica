import {
  PAGE_SIZE,
  approvedInstitutionalUrl,
  filterOptions,
  pageSlice,
  searchTheses,
  validateIndex,
} from "../src/core/thesis-demo-search.js?v=20261104-t2ch";

const root = document.querySelector("#thesis-demo");
const form = document.querySelector("#thesis-search");
const results = document.querySelector("#thesis-results");
const status = document.querySelector("#thesis-status");
const searchInput = document.querySelector("#thesis-query");
const count = document.querySelector("#thesis-count");
const summary = document.querySelector("#thesis-summary");
const pagination = document.querySelector("#thesis-pagination");
const filters = {
  program: document.querySelector("#thesis-program"),
  degree: document.querySelector("#thesis-degree"),
  unit: document.querySelector("#thesis-unit"),
  fromYear: document.querySelector("#thesis-from-year"),
  toYear: document.querySelector("#thesis-to-year"),
};
const sort = document.querySelector("#thesis-sort");
const clear = document.querySelector("#thesis-clear");

let allRecords = [];
let currentPage = 1;
let loaded = false;

function element(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = String(text);
  return node;
}

function appendText(parent, tag, className, value) {
  if (value !== undefined && value !== null && value !== "") {
    parent.append(element(tag, className, value));
  }
}

function makeSelectOptions(select, values) {
  for (const value of values) {
    const option = element("option", "", value);
    option.value = value;
    select.append(option);
  }
}

function displayAuthors(record) {
  return record.authors.length ? record.authors.join(" · ") : "Autor no registrado";
}

function sourceCard(record) {
  const card = element("article", "td-result");
  const top = element("div", "td-result-top");
  top.append(
    element("span", "td-result-type", "Tesis · UdeG"),
    element("span", "td-result-year", record.year ?? "Año sin verificar"),
  );
  card.append(top);

  appendText(card, "h3", "td-result-title", record.title);
  appendText(card, "p", "td-result-authors", displayAuthors(record));

  const meta = element("div", "td-result-meta");
  const fields = [
    ["Programa", record.program || "Sin programa registrado"],
    ["Grado", record.degree || "Sin especificar"],
    ["Unidad académica", record.unit || "No registrada"],
  ];
  for (const [label, value] of fields) {
    const item = element("div", "td-meta-item");
    item.append(
      element("span", "td-meta-label", label),
      element("span", "td-meta-value", value),
    );
    meta.append(item);
  }
  card.append(meta);

  const detail = element("details", "td-details");
  const detailSummary = element("summary", "", "Ver metadatos de la tesis");
  const detailBody = element("div", "td-details-content");
  if (record.abstractExcerpt) {
    const note = element("p", "td-excerpt", record.abstractExcerpt);
    detailBody.append(element("strong", "", "Extracto del resumen institucional"), note);
  }
  if (record.keywords.length) {
    const keywords = element("div", "td-tags");
    for (const term of record.keywords) {
      keywords.append(element("span", "td-tag", term));
    }
    detailBody.append(element("strong", "", "Palabras clave"), keywords);
  }
  if (record.directors.length) {
    detailBody.append(
      element("strong", "", "Dirección"),
      element("p", "td-excerpt", record.directors.join(" · ")),
    );
  }
  detailBody.append(element("p", "td-source-id", "ID académico: " + record.id));
  if (record.handle) {
    detailBody.append(element("p", "td-source-id", "Handle: " + record.handle));
  }
  detail.append(detailSummary, detailBody);
  card.append(detail);

  const actions = element("div", "td-actions");
  const officialUrl = approvedInstitutionalUrl(record.sourceUrl);
  if (officialUrl) {
    const link = element("a", "td-primary-action", "Consultar en repositorio institucional ↗");
    link.href = officialUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Abrir la tesis en su repositorio institucional");
    actions.append(link);
  } else {
    actions.append(element("span", "td-no-link", "Enlace institucional no verificado"));
  }

  const copy = element("button", "td-secondary-action", "Copiar referencia");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    const citation = [
      displayAuthors(record),
      "(" + (record.year ?? "s. f.") + ").",
      record.title + ".",
      "Universidad de Guadalajara.",
      officialUrl || "",
    ].filter(Boolean).join(" ");
    try {
      await navigator.clipboard.writeText(citation);
      copy.textContent = "Referencia copiada";
    } catch {
      copy.textContent = "No se pudo copiar";
    }
  });
  actions.append(copy);
  card.append(actions);
  return card;
}

function selectedFilters() {
  return {
    query: searchInput.value,
    program: filters.program.value,
    degree: filters.degree.value,
    unit: filters.unit.value,
    fromYear: filters.fromYear.value,
    toYear: filters.toYear.value,
  };
}

function sortedRecords(records) {
  const ordered = [...records];
  if (sort.value === "title") {
    ordered.sort((a, b) => a.title.localeCompare(b.title, "es"));
  } else if (sort.value === "oldest") {
    ordered.sort((a, b) =>
      (a.year ?? 9999) - (b.year ?? 9999) ||
      a.title.localeCompare(b.title, "es")
    );
  } else {
    ordered.sort((a, b) =>
      (b.year ?? 0) - (a.year ?? 0) ||
      a.title.localeCompare(b.title, "es")
    );
  }
  return ordered;
}

function makePageButton(label, page, disabled, current = false) {
  const btn = element("button", "td-page-button", label);
  btn.type = "button";
  btn.disabled = disabled;
  if (current) btn.setAttribute("aria-current", "page");
  btn.addEventListener("click", () => {
    currentPage = page;
    render();
    root.querySelector("#thesis-result-heading").scrollIntoView({
      block: "start", behavior: "smooth",
    });
  });
  return btn;
}

function render() {
  if (!loaded) return;
  const matching = sortedRecords(searchTheses(allRecords, selectedFilters()));
  const page = pageSlice(matching, currentPage, PAGE_SIZE);
  currentPage = page.page;
  count.textContent = matching.length.toLocaleString("es-MX");
  summary.textContent = matching.length
    ? `Mostrando ${(page.page - 1) * PAGE_SIZE + 1}–${Math.min(page.page * PAGE_SIZE, matching.length)} de ${matching.length} tesis admitidas.`
    : "No se encontraron tesis para estos filtros. Pruebe otra consulta.";
  results.replaceChildren();

  for (const record of page.records) {
    results.append(sourceCard(record));
  }
  pagination.replaceChildren();
  if (matching.length > PAGE_SIZE) {
    pagination.append(
      makePageButton("← Anterior", page.page - 1, page.page === 1),
      element("span", "td-page-indicator", `Página ${page.page} de ${page.pages}`),
      makePageButton("Siguiente →", page.page + 1, page.page === page.pages),
    );
  }
  status.textContent = `Índice bibliográfico ${document.querySelector("#thesis-revision").textContent} · búsqueda local, sin rastreo ni PDF almacenados`;
}

async function loadData() {
  status.textContent = "Cargando referencias académicas verificadas…";
  try {
    const response = await fetch("./data/theses/demo-v1/index.json", {
      cache: "no-cache",
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = validateIndex(await response.json());
    allRecords = data.records;
    loaded = true;
    makeSelectOptions(filters.program, filterOptions(allRecords, "program"));
    makeSelectOptions(filters.degree, filterOptions(allRecords, "degree"));
    makeSelectOptions(filters.unit, filterOptions(allRecords, "unit"));
    document.querySelector("#thesis-total").textContent =
      data.totalIncluded.toLocaleString("es-MX");
    document.querySelector("#thesis-canonical-total").textContent =
      data.totalCanonical.toLocaleString("es-MX");
    document.querySelector("#thesis-revision").textContent = data.sourceRelease;

    const params = new URLSearchParams(location.search);
    const initialQuery = params.get("q");
    if (initialQuery) {
      searchInput.value = initialQuery;
      currentPage = 1;
    }

    render();
  } catch (error) {
    status.textContent = "No fue posible cargar el índice verificado. No mostraremos datos incompletos.";
    summary.textContent = "Compruebe su conexión y vuelva a intentar.";
    const retry = element("button", "td-primary-action", "Reintentar carga");
    retry.type = "button";
    retry.addEventListener("click", () => {
      retry.remove();
      loadData();
    }, { once: true });
    results.replaceChildren(retry);
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  currentPage = 1;
  render();
});
searchInput.addEventListener("input", () => {
  currentPage = 1;
  render();
});
for (const control of Object.values(filters)) {
  control.addEventListener("change", () => {
    currentPage = 1;
    render();
  });
}
sort.addEventListener("change", () => {
  currentPage = 1;
  render();
});
clear.addEventListener("click", () => {
  form.reset();
  currentPage = 1;
  render();
  searchInput.focus();
});

loadData();

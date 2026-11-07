import {
  PAGE_SIZE,
  approvedInstitutionalUrl,
  approvedReferenceUrl,
  filterOptions,
  pageSlice,
  searchTheses,
  validateIndex,
  validatePhilosophyIndex,
} from "../src/core/thesis-demo-search.js?v=20261105-v101";
import {
  approvedEditorialUdgUrl,
  editorialFilterOptions,
  searchEditorialUdg,
  validateEditorialUdgIndex,
} from "../src/core/editorial-udg-search.js?v=20261107-t2dg";
import {
  approvedUgtoRepositoryUrl,
  validateUgtoPhilosophyIndex,
} from "../src/core/ugto-philosophy-search.js?v=20261107-t2dh";

const root = document.querySelector("#thesis-demo");
const form = document.querySelector("#thesis-search");
const results = document.querySelector("#thesis-results");
const status = document.querySelector("#thesis-status");
const searchInput = document.querySelector("#thesis-query");
const count = document.querySelector("#thesis-count");
const summary = document.querySelector("#thesis-summary");
const pagination = document.querySelector("#thesis-pagination");
const sort = document.querySelector("#thesis-sort");
const clear = document.querySelector("#thesis-clear");
const institutionButtons = [...document.querySelectorAll("[data-thesis-institution]")];
const scopeButtons = [...document.querySelectorAll("[data-thesis-scope]")];
const scopeDescription = document.querySelector("#thesis-scope-description");
const heroEyebrow = document.querySelector("#thesis-hero-eyebrow");
const institutionCode = document.querySelector("#thesis-institution-code");
const philosophyPanel = document.querySelector("#philosophy-programs");
const philosophyContribute = document.querySelector("#philosophy-contribute");
const philosophyProgramList = document.querySelector("#philosophy-program-list");
const philosophyProgramsLabel = document.querySelector("#philosophy-programs-label");
const philosophyProgramsDescription = document.querySelector("#philosophy-programs-description");
const philosophyProgramsNote = document.querySelector("#philosophy-programs-note");
const editorialPanel = document.querySelector("#editorial-udg-intro");
const philosophyRoleWrap = document.querySelector("#thesis-philosophy-role-wrap");
const philosophyRole = document.querySelector("#thesis-philosophy-role");
const editorialOriginWrap = document.querySelector("#thesis-editorial-origin-wrap");
const editorialOrigin = document.querySelector("#thesis-editorial-origin");
const editorialFormatWrap = document.querySelector("#thesis-editorial-format-wrap");
const editorialFormat = document.querySelector("#thesis-editorial-format");
const scopeTag = document.querySelector("#thesis-scope-tag");
const heroLead = document.querySelector("#thesis-hero-lead");
const heroTotalLabel = document.querySelector("#thesis-total-label");
const heroFootnote = document.querySelector("#thesis-scope-footnote");
const resultLabel = document.querySelector("#thesis-result-label");
const humanitiesMethod = document.querySelector("#thesis-method-humanities");
const philosophyMethod = document.querySelector("#thesis-method-philosophy");
const editorialMethod = document.querySelector("#thesis-method-editorial");
const ugtoMethod = document.querySelector("#thesis-method-ugto");
const thesisFilterWraps = [
  document.querySelector("#thesis-program-wrap"),
  document.querySelector("#thesis-degree-wrap"),
  document.querySelector("#thesis-unit-wrap"),
  document.querySelector("#thesis-from-year-wrap"),
  document.querySelector("#thesis-to-year-wrap"),
];
const filters = {
  program: document.querySelector("#thesis-program"),
  degree: document.querySelector("#thesis-degree"),
  unit: document.querySelector("#thesis-unit"),
  fromYear: document.querySelector("#thesis-from-year"),
  toYear: document.querySelector("#thesis-to-year"),
};

const datasets = {
  udg: { humanities: null, philosophy: null, editorial: null },
  ugto: { philosophy: null },
};
let activeInstitution = "udg";
let activeScope = "humanities";
let allRecords = [];
let currentPage = 1;
let loaded = false;

const ROLE_LABELS = {
  "program-core": "Programa de Filosofía",
  "program-core-candidate": "Programa de Filosofía · por verificar",
  "philosophical-content": "Cruce filosófico",
  "curated-manual-classification": "Curaduría manual",
};

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

function resetSelect(select, label) {
  select.replaceChildren();
  const option = element("option", "", label);
  option.value = "";
  select.append(option);
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

function philosophyType(record) {
  if (record.philosophyStatus === "review") return "Filosofía · EN REVISIÓN";
  return "Filosofía · " + (ROLE_LABELS[record.philosophyRole] || "Referencia curada");
}

function activeDataset() {
  return datasets[activeInstitution]?.[activeScope] || null;
}

function isUdgPhilosophy() {
  return activeInstitution === "udg" && activeScope === "philosophy";
}

function isUgtoPhilosophy() {
  return activeInstitution === "ugto" && activeScope === "philosophy";
}

function isUdgEditorial() {
  return activeInstitution === "udg" && activeScope === "editorial";
}

function editorialCard(record) {
  const card = element("article", "td-result td-result-editorial");
  const top = element("div", "td-result-top");
  const originLabel = record.origin === "official-philosophy-category"
    ? "Editorial UdeG · Filosofía"
    : "Editorial UdeG · Relación verificada";
  top.append(
    element("span", "td-result-type", originLabel),
    element("span", "td-result-year", "Publicación"),
  );
  card.append(top);

  appendText(card, "h3", "td-result-title", record.title);
  appendText(card, "p", "td-result-authors", record.authors.join(" · "));

  const meta = element("div", "td-result-meta");
  const fields = [
    ["Procedencia", record.origin === "official-philosophy-category"
      ? "Categoría oficial Filosofía"
      : "Relación filosófica verificada"],
    ["Formato", record.formats.join(" · ")],
    ["Editorial", record.publisher],
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
  const detailSummary = element("summary", "", "Ver criterio y procedencia");
  const detailBody = element("div", "td-details-content");
  detailBody.append(
    element("strong", "", "Por qué aparece en este corpus"),
    element("p", "td-excerpt", record.criterion),
    element("p", "td-source-id", "ID: " + record.id),
  );
  detail.append(detailSummary, detailBody);
  card.append(detail);

  const actions = element("div", "td-actions");
  const referenceUrl = approvedEditorialUdgUrl(record.sourceUrl);
  if (referenceUrl) {
    const link = element("a", "td-primary-action", "Consultar ficha oficial ↗");
    link.href = referenceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Abrir la ficha oficial de esta publicación en Editorial UdeG");
    actions.append(link);
  } else {
    actions.append(element("span", "td-no-link", "Enlace editorial no verificado"));
  }

  const copy = element("button", "td-secondary-action", "Copiar referencia");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    const citation = [
      record.authors.join(" · "),
      "(s. f.).",
      record.title + ".",
      record.publisher + ".",
      referenceUrl || "",
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

function sourceCard(record) {
  if (isUdgEditorial()) return editorialCard(record);
  const udgPhilosophy = isUdgPhilosophy();
  const card = element("article", "td-result" + (record.philosophyStatus === "review" ? " td-result-review" : ""));
  const top = element("div", "td-result-top");
  top.append(
    element("span", "td-result-type", udgPhilosophy ? philosophyType(record) : `Tesis · ${record.institutionAcronym || "UdeG"}`),
    element("span", "td-result-year", record.year ?? "Año sin verificar"),
  );
  card.append(top);

  appendText(card, "h3", "td-result-title", record.title);
  appendText(card, "p", "td-result-authors", displayAuthors(record));

  const meta = element("div", "td-result-meta");
  const fields = [
    [udgPhilosophy ? "Programa real" : "Programa", record.program || "Sin programa registrado"],
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
  const detailSummary = element("summary", "", udgPhilosophy ? "Ver evidencia y metadatos" : "Ver metadatos de la tesis");
  const detailBody = element("div", "td-details-content");
  if (udgPhilosophy && record.philosophyEvidence) {
    detailBody.append(
      element("strong", "", "Por qué aparece en Filosofía"),
      element("p", "td-excerpt", record.philosophyEvidence),
    );
    if (record.philosophyStatus === "review") {
      detailBody.append(element(
        "p",
        "td-review-note",
        "Este registro permanece en revisión: se muestra para transparencia, pero no equivale a una admisión canónica.",
      ));
    }
    if (record.validationTier) {
      detailBody.append(
        element("strong", "", "Nivel de validación"),
        element("p", "td-excerpt", record.validationTier),
      );
    }
    if (record.externalCorroboration) {
      detailBody.append(
        element("strong", "", "Corroboración adicional"),
        element("p", "td-excerpt", record.externalCorroboration.note),
      );
      for (const [index, url] of (record.externalCorroboration.evidenceUrls || []).entries()) {
        const safe = approvedReferenceUrl(url);
        if (!safe) continue;
        const link = element("a", "td-method-link", `Evidencia adicional ${index + 1} ↗`);
        link.href = safe;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        detailBody.append(link);
      }
    }
  }
  if (record.abstractExcerpt) {
    detailBody.append(
      element("strong", "", "Extracto del resumen institucional"),
      element("p", "td-excerpt", record.abstractExcerpt),
    );
  }
  if (record.keywords.length) {
    const keywords = element("div", "td-tags");
    for (const term of record.keywords) keywords.append(element("span", "td-tag", term));
    detailBody.append(element("strong", "", "Palabras clave"), keywords);
  }
  if (record.directors.length) {
    detailBody.append(
      element("strong", "", "Dirección"),
      element("p", "td-excerpt", record.directors.join(" · ")),
    );
  }
  detailBody.append(element("p", "td-source-id", "ID: " + record.id));
  if (record.canonicalWorkId && record.canonicalWorkId !== record.id) {
    detailBody.append(element("p", "td-source-id", "ID canónico V2: " + record.canonicalWorkId));
  }
  if (record.handle) detailBody.append(element("p", "td-source-id", "Handle: " + record.handle));
  detail.append(detailSummary, detailBody);
  card.append(detail);

  const actions = element("div", "td-actions");
  const officialUrl = activeInstitution === "ugto"
    ? approvedUgtoRepositoryUrl(record.sourceUrl)
    : approvedInstitutionalUrl(record.sourceUrl);
  const referenceUrl = udgPhilosophy ? approvedReferenceUrl(record.sourceUrl) : officialUrl;
  if (referenceUrl) {
    const link = element(
      "a",
      "td-primary-action",
      officialUrl ? "Consultar en repositorio institucional ↗" : `Consultar ${record.sourceLabel || "fuente de referencia"} ↗`,
    );
    link.href = referenceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Abrir la fuente bibliográfica de esta tesis");
    actions.append(link);
  } else {
    actions.append(element("span", "td-no-link", "Enlace de referencia no verificado"));
  }

  const copy = element("button", "td-secondary-action", "Copiar referencia");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    const citation = [
      displayAuthors(record),
      "(" + (record.year ?? "s. f.") + ").",
      record.title + ".",
      (record.institution || "Universidad de Guadalajara") + ".",
      referenceUrl || "",
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
  if (isUdgEditorial()) {
    return {
      query: searchInput.value,
      origin: editorialOrigin.value,
      format: editorialFormat.value,
    };
  }
  return {
    query: searchInput.value,
    program: filters.program.value,
    degree: filters.degree.value,
    unit: filters.unit.value,
    fromYear: filters.fromYear.value,
    toYear: filters.toYear.value,
    philosophyRole: isUdgPhilosophy() ? philosophyRole.value : "",
  };
}

function sortedRecords(records) {
  const ordered = [...records];
  if (isUdgEditorial()) {
    ordered.sort((a, b) => a.title.localeCompare(b.title, "es"));
    return ordered;
  }
  if (sort.value === "title") {
    ordered.sort((a, b) => a.title.localeCompare(b.title, "es"));
  } else if (sort.value === "oldest") {
    ordered.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title, "es"));
  } else {
    ordered.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title, "es"));
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
    root.querySelector("#thesis-result-heading").scrollIntoView({ block: "start", behavior: "smooth" });
  });
  return btn;
}

function renderPrograms() {
  philosophyProgramList.replaceChildren();
  const dataset = activeDataset();
  for (const program of dataset?.documentedPhilosophyPrograms || []) {
    const card = element("article", "td-program-card");
    const countText = isUgtoPhilosophy()
      ? `${program.records} tesis públicas`
      : `${program.records} referencias · ${program.include} incluidas${program.review ? ` · ${program.review} en revisión` : ""}`;
    card.append(
      element("p", "td-program-kicker", isUgtoPhilosophy() ? "NIVEL DOCUMENTADO" : "PROGRAMA DOCUMENTADO"),
      element("h3", "", program.name),
      element("p", "td-program-count", countText),
    );
    const button = element("button", "td-program-action", "Ver programa →");
    button.type = "button";
    button.addEventListener("click", () => {
      filters.program.value = program.name;
      if (isUdgPhilosophy()) philosophyRole.value = "";
      currentPage = 1;
      render();
      document.querySelector("#thesis-result-heading").scrollIntoView({ block: "start", behavior: "smooth" });
    });
    card.append(button);
    philosophyProgramList.append(card);
  }
}

function populateFilters() {
  resetSelect(filters.program, "Todos los programas");
  resetSelect(filters.degree, "Todos los grados");
  resetSelect(filters.unit, "Todas las unidades");
  resetSelect(editorialFormat, "Todos los formatos");

  if (isUdgEditorial()) {
    makeSelectOptions(editorialFormat, editorialFilterOptions(allRecords, "formats"));
    return;
  }

  makeSelectOptions(filters.program, filterOptions(allRecords, "program"));
  makeSelectOptions(filters.degree, filterOptions(allRecords, "degree"));
  makeSelectOptions(filters.unit, filterOptions(allRecords, "unit"));
}

function render() {
  if (!loaded) return;
  const matching = sortedRecords(
    isUdgEditorial()
      ? searchEditorialUdg(allRecords, selectedFilters())
      : searchTheses(allRecords, selectedFilters()),
  );
  const page = pageSlice(matching, currentPage, PAGE_SIZE);
  currentPage = page.page;
  count.textContent = matching.length.toLocaleString("es-MX");

  if (isUdgEditorial()) {
    summary.textContent = matching.length
      ? `Mostrando ${(page.page - 1) * PAGE_SIZE + 1}–${Math.min(page.page * PAGE_SIZE, matching.length)} de ${matching.length} publicaciones filosóficas de Editorial UdeG.`
      : "No se encontraron publicaciones editoriales para estos filtros.";
  } else if (isUgtoPhilosophy()) {
    summary.textContent = matching.length
      ? `Mostrando ${(page.page - 1) * PAGE_SIZE + 1}–${Math.min(page.page * PAGE_SIZE, matching.length)} de ${matching.length} tesis públicas de Filosofía de la Universidad de Guanajuato.`
      : "No se encontraron tesis UG para estos filtros.";
  } else if (isUdgPhilosophy()) {
    summary.textContent = matching.length
      ? `Mostrando ${(page.page - 1) * PAGE_SIZE + 1}–${Math.min(page.page * PAGE_SIZE, matching.length)} de ${matching.length} referencias filosóficas.`
      : "No se encontraron referencias filosóficas para estos filtros.";
  } else {
    summary.textContent = matching.length
      ? `Mostrando ${(page.page - 1) * PAGE_SIZE + 1}–${Math.min(page.page * PAGE_SIZE, matching.length)} de ${matching.length} tesis admitidas.`
      : "No se encontraron tesis para estos filtros. Pruebe otra consulta.";
  }

  results.replaceChildren();
  for (const record of page.records) results.append(sourceCard(record));

  pagination.replaceChildren();
  if (matching.length > PAGE_SIZE) {
    pagination.append(
      makePageButton("← Anterior", page.page - 1, page.page === 1),
      element("span", "td-page-indicator", `Página ${page.page} de ${page.pages}`),
      makePageButton("Siguiente →", page.page + 1, page.page === page.pages),
    );
  }

  if (isUdgEditorial()) {
    status.textContent = `Editorial UdeG ${datasets.udg.editorial.revision} · 33 publicaciones filosóficas · 0 PDF almacenados`;
  } else if (isUgtoPhilosophy()) {
    status.textContent = `Universidad de Guanajuato ${datasets.ugto.philosophy.revision} · 59 tesis públicas · 0 PDF almacenados`;
  } else if (isUdgPhilosophy()) {
    status.textContent = `Vista Filosofía ${datasets.udg.philosophy.revision} · programa real preservado · 0 PDF almacenados`;
  } else {
    status.textContent = `Índice bibliográfico ${datasets.udg.humanities.sourceRelease} · búsqueda local, sin rastreo ni PDF almacenados`;
  }
}

function setInstitution(institution, { updateUrl = true, requestedScope = null } = {}) {
  if (!datasets[institution]) return;
  activeInstitution = institution;

  for (const button of institutionButtons) {
    const selected = button.dataset.thesisInstitution === institution;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.classList.toggle("td-scope-active", selected);
  }

  for (const button of scopeButtons) {
    button.hidden = button.dataset.thesisInstitutionScope !== institution;
  }

  const defaultScope = institution === "ugto" ? "philosophy" : "humanities";
  const candidate = requestedScope && datasets[institution][requestedScope]
    ? requestedScope
    : defaultScope;

  scopeDescription.textContent = institution === "ugto"
    ? "Filosofía reúne las tesis públicas visibles en las colecciones oficiales de Licenciatura, Maestría y Doctorado de la Universidad de Guanajuato."
    : "Humanidades conserva el corpus efectivo V2. Filosofía reúne el núcleo institucional y los cruces filosóficos curados sin alterar el programa real de cada tesis.";

  setScope(candidate, { updateUrl });
}

function setScope(scope, { updateUrl = true } = {}) {
  const dataset = datasets[activeInstitution]?.[scope];
  if (!dataset) return;

  activeScope = scope;
  allRecords = dataset.records;
  currentPage = 1;
  form.reset();
  populateFilters();

  const udgPhilosophy = isUdgPhilosophy();
  const ugtoPhilosophy = isUgtoPhilosophy();
  const editorial = isUdgEditorial();
  const philosophy = udgPhilosophy || ugtoPhilosophy;

  for (const button of scopeButtons) {
    if (button.dataset.thesisInstitutionScope !== activeInstitution) continue;
    const selected = button.dataset.thesisScope === scope;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.classList.toggle("td-scope-active", selected);
  }

  philosophyPanel.hidden = !philosophy;
  philosophyContribute.hidden = !udgPhilosophy;
  editorialPanel.hidden = !editorial;
  philosophyRoleWrap.hidden = !udgPhilosophy;
  editorialOriginWrap.hidden = !editorial;
  editorialFormatWrap.hidden = !editorial;
  for (const wrap of thesisFilterWraps) wrap.hidden = editorial;

  humanitiesMethod.hidden = !(activeInstitution === "udg" && scope === "humanities");
  philosophyMethod.hidden = !udgPhilosophy;
  editorialMethod.hidden = !editorial;
  ugtoMethod.hidden = !ugtoPhilosophy;

  searchInput.placeholder = editorial
    ? "Ej. ética, argumentación, Berkeley, epistemología…"
    : ugtoPhilosophy
      ? "Ej. Kierkegaard, Hume, Nietzsche, fenomenología…"
      : "Ej. filosofía, lenguaje, historia, territorio…";
  if (editorial) sort.value = "title";

  institutionCode.textContent = activeInstitution === "ugto" ? "UG" : "UdeG";
  heroEyebrow.replaceChildren(
    element("span", "td-live-dot"),
    document.createTextNode(activeInstitution === "ugto"
      ? " ARCHIVO ACADÉMICO / UNIVERSIDAD DE GUANAJUATO"
      : " ARCHIVO ACADÉMICO / UNIVERSIDAD DE GUADALAJARA"),
  );
  heroEyebrow.querySelector(".td-live-dot")?.setAttribute("aria-hidden", "true");

  if (ugtoPhilosophy) {
    philosophyProgramsLabel.textContent = "FILOSOFÍA / UNIVERSIDAD DE GUANAJUATO";
    document.querySelector("#philosophy-programs-title").textContent = "Tres niveles documentados en el repositorio institucional.";
    philosophyProgramsDescription.textContent = "La cobertura pública recuperada reúne tesis de Licenciatura, Maestría y Doctorado en Filosofía, preservando cada ficha institucional de origen.";
    philosophyProgramsNote.replaceChildren(
      element("strong", "", "Cobertura pública:"),
      document.createTextNode(" 59 tesis visibles al 7 de noviembre de 2026. El repositorio mantiene además 3 trabajos de investigación de Licenciatura en Filosofía en una colección separada; no se contabilizan aquí como tesis."),
    );
  } else {
    philosophyProgramsLabel.textContent = "PROGRAMAS DE FILOSOFÍA";
    document.querySelector("#philosophy-programs-title").textContent = "Tres programas documentados, sin inventar equivalencias.";
    philosophyProgramsDescription.textContent = "La vista incluye también tesis filosóficas de otros programas. Su programa académico original siempre permanece visible.";
    philosophyProgramsNote.replaceChildren(
      element("strong", "", "Doctorado:"),
      document.createTextNode(" no se publica un “Doctorado en Filosofía” porque no existe una autoridad institucional exacta confirmada. Doctorado en Humanidades no se relabela como Filosofía."),
    );
  }
  renderPrograms();

  if (editorial) {
    document.querySelector("#thesis-total").textContent = datasets.udg.editorial.counts.records.toLocaleString("es-MX");
    heroTotalLabel.textContent = "Obras filosóficas";
    heroLead.textContent = "Explore publicaciones filosóficas de Editorial Universidad de Guadalajara. El corpus distingue la categoría oficial Filosofía de relaciones filosóficas verificadas fuera de ese filtro y enlaza siempre a la ficha editorial de origen.";
    heroFootnote.textContent = "EDITORIAL UDG / FILOSOFÍA";
    document.querySelector("#thesis-revision").textContent = datasets.udg.editorial.revision;
    scopeTag.textContent = `EDITORIAL UDG · ${datasets.udg.editorial.counts.officialPhilosophyCategory} OFICIALES · ${datasets.udg.editorial.counts.verifiedPhilosophicalRelation} VERIFICADAS`;
    resultLabel.textContent = "obras encontradas";
  } else if (ugtoPhilosophy) {
    document.querySelector("#thesis-total").textContent = datasets.ugto.philosophy.counts.records.toLocaleString("es-MX");
    heroTotalLabel.textContent = "Tesis públicas";
    heroLead.textContent = "Explore las tesis públicas de Filosofía visibles en el Repositorio Institucional de la Universidad de Guanajuato. Cada resultado conserva su handle institucional y enlaza únicamente a la ficha oficial.";
    heroFootnote.textContent = "UNIVERSIDAD DE GUANAJUATO / FILOSOFÍA";
    document.querySelector("#thesis-revision").textContent = datasets.ugto.philosophy.revision;
    scopeTag.textContent = `UG · FILOSOFÍA · ${datasets.ugto.philosophy.counts.records} TESIS`;
    resultLabel.textContent = "tesis encontradas";
  } else if (udgPhilosophy) {
    document.querySelector("#thesis-total").textContent = datasets.udg.philosophy.metrics.records.toLocaleString("es-MX");
    heroTotalLabel.textContent = "Referencias filosóficas";
    heroLead.textContent = "Explore el inventario histórico de Licenciatura en Filosofía de la Biblioteca CUCSH, los programas filosóficos documentados y cruces filosóficos curados. Cada referencia conserva su procedencia y nivel de validación.";
    heroFootnote.textContent = "FILOSOFÍA / NÚCLEO + CRUCES CURADOS";
    document.querySelector("#thesis-revision").textContent = datasets.udg.philosophy.revision;
    scopeTag.textContent = `FILOSOFÍA · ${datasets.udg.philosophy.metrics.byStatus.include} INCLUDE · ${datasets.udg.philosophy.metrics.byStatus.review} REVIEW`;
    resultLabel.textContent = "referencias encontradas";
  } else {
    document.querySelector("#thesis-total").textContent = datasets.udg.humanities.totalIncluded.toLocaleString("es-MX");
    heroTotalLabel.textContent = "Tesis admitidas";
    heroLead.textContent = "Explore tesis de Humanidades identificadas y verificadas en el corpus institucional. Cada resultado conserva su procedencia y le conduce al repositorio de origen.";
    heroFootnote.textContent = "UDEG / HUMANIDADES / CORPUS EFECTIVO";
    document.querySelector("#thesis-revision").textContent = datasets.udg.humanities.sourceRelease;
    scopeTag.textContent = "UDEG · HUMANIDADES · INCLUDE";
    resultLabel.textContent = "tesis encontradas";
  }

  if (updateUrl) {
    const params = new URLSearchParams(location.search);
    if (activeInstitution === "ugto") params.set("institution", "ugto");
    else params.delete("institution");

    if (activeInstitution === "udg" && scope === "humanities") params.delete("scope");
    else params.set("scope", scope);

    params.delete("q");
    const query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? `?${query}` : ""));
  }
  render();
}

async function loadData() {
  status.textContent = "Cargando referencias académicas verificadas…";
  try {
    const [humanitiesResponse, philosophyResponse, editorialResponse, ugtoResponse] = await Promise.all([
      fetch("./data/theses/demo-v1/index.json", { cache: "no-cache" }),
      fetch("./data/theses/philosophy-v1/index.json", { cache: "no-cache" }),
      fetch("./data/editorial/udg-philosophy-v1/index.json", { cache: "no-cache" }),
      fetch("./data/theses/ugto-philosophy-v1/index.json", { cache: "no-cache" }),
    ]);
    if (!humanitiesResponse.ok) throw new Error("Humanities HTTP " + humanitiesResponse.status);
    if (!philosophyResponse.ok) throw new Error("Philosophy HTTP " + philosophyResponse.status);
    if (!editorialResponse.ok) throw new Error("Editorial UdeG HTTP " + editorialResponse.status);
    if (!ugtoResponse.ok) throw new Error("UG Filosofía HTTP " + ugtoResponse.status);

    datasets.udg.humanities = validateIndex(await humanitiesResponse.json());
    datasets.udg.philosophy = validatePhilosophyIndex(await philosophyResponse.json());
    datasets.udg.editorial = validateEditorialUdgIndex(await editorialResponse.json());
    datasets.ugto.philosophy = validateUgtoPhilosophyIndex(await ugtoResponse.json());
    loaded = true;

    document.querySelector("#thesis-canonical-total").textContent = datasets.udg.humanities.totalCanonical.toLocaleString("es-MX");
    document.querySelector("#thesis-scope-humanities-count").textContent = datasets.udg.humanities.totalIncluded.toLocaleString("es-MX");
    document.querySelector("#thesis-scope-philosophy-count").textContent = datasets.udg.philosophy.metrics.records.toLocaleString("es-MX");
    document.querySelector("#thesis-scope-editorial-count").textContent = datasets.udg.editorial.counts.records.toLocaleString("es-MX");
    document.querySelector("#thesis-scope-ugto-philosophy-count").textContent = datasets.ugto.philosophy.counts.records.toLocaleString("es-MX");

    const params = new URLSearchParams(location.search);
    const requestedInstitution = params.get("institution") === "ugto" ? "ugto" : "udg";
    const requestedScope = params.get("scope");
    const allowedScope = requestedInstitution === "ugto"
      ? "philosophy"
      : requestedScope === "philosophy" || requestedScope === "editorial"
        ? requestedScope
        : "humanities";

    setInstitution(requestedInstitution, { updateUrl: false, requestedScope: allowedScope });

    const initialQuery = params.get("q");
    if (initialQuery) {
      searchInput.value = initialQuery;
      currentPage = 1;
      render();
    }
  } catch (error) {
    console.error(error);
    status.textContent = "No fue posible cargar los índices verificados. No mostraremos datos incompletos.";
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

for (const button of scopeButtons) {
    button.hidden = button.dataset.thesisInstitutionScope !== institution;
  }

  const defaultScope = institution === "ugto" ? "philosophy" : "humanities";
  const candidate = requestedScope && datasets[institution][requestedScope]
    ? requestedScope
    : defaultScope;

  scopeDescription.textContent = institution === "ugto"
    ? "Filosofía reúne las tesis públicas visibles en las colecciones oficiales de Licenciatura, Maestría y Doctorado de la Universidad de Guanajuato."
    : "Humanidades conserva el corpus efectivo V2. Filosofía reúne el núcleo institucional y los cruces filosóficos curados sin alterar el programa real de cada tesis.";

  setScope(candidate, { updateUrl });
}

function setScope(scope, { updateUrl = true } = {}) {
  const dataset = datasets[activeInstitution]?.[scope];
  if (!dataset) return;

  activeScope = scope;
  allRecords = dataset.records;
  currentPage = 1;
  form.reset();
  populateFilters();

  const udgPhilosophy = isUdgPhilosophy();
  const ugtoPhilosophy = isUgtoPhilosophy();
  const editorial = isUdgEditorial();
  const philosophy = udgPhilosophy || ugtoPhilosophy;

  for (const button of scopeButtons) {
    if (button.dataset.thesisInstitutionScope !== activeInstitution) continue;
    const selected = button.dataset.thesisScope === scope;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.classList.toggle("td-scope-active", selected);
  }

  philosophyPanel.hidden = !philosophy;
  philosophyContribute.hidden = !udgPhilosophy;
  editorialPanel.hidden = !editorial;
  philosophyRoleWrap.hidden = !udgPhilosophy;
  editorialOriginWrap.hidden = !editorial;
  editorialFormatWrap.hidden = !editorial;
  for (const wrap of thesisFilterWraps) wrap.hidden = editorial;

  humanitiesMethod.hidden = !(activeInstitution === "udg" && scope === "humanities");
  philosophyMethod.hidden = !udgPhilosophy;
  editorialMethod.hidden = !editorial;
  ugtoMethod.hidden = !ugtoPhilosophy;

  searchInput.placeholder = editorial
    ? "Ej. ética, argumentación, Berkeley, epistemología…"
    : ugtoPhilosophy
      ? "Ej. Kierkegaard, Hume, Nietzsche, fenomenología…"
      : "Ej. filosofía, lenguaje, historia, territorio…";
  if (editorial) sort.value = "title";

  institutionCode.textContent = activeInstitution === "ugto" ? "UG" : "UdeG";
  heroEyebrow.replaceChildren(
    element("span", "td-live-dot"),
    document.createTextNode(activeInstitution === "ugto"
      ? " ARCHIVO ACADÉMICO / UNIVERSIDAD DE GUANAJUATO"
      : " ARCHIVO ACADÉMICO / UNIVERSIDAD DE GUADALAJARA"),
  );
  heroEyebrow.querySelector(".td-live-dot")?.setAttribute("aria-hidden", "true");

  if (ugtoPhilosophy) {
    philosophyProgramsLabel.textContent = "FILOSOFÍA / UNIVERSIDAD DE GUANAJUATO";
    document.querySelector("#philosophy-programs-title").textContent = "Tres niveles documentados en el repositorio institucional.";
    philosophyProgramsDescription.textContent = "La cobertura pública recuperada reúne tesis de Licenciatura, Maestría y Doctorado en Filosofía, preservando cada ficha institucional de origen.";
    philosophyProgramsNote.replaceChildren(
      element("strong", "", "Cobertura pública:"),
      document.createTextNode(" 59 tesis visibles al 7 de noviembre de 2026. El repositorio mantiene además 3 trabajos de investigación de Licenciatura en Filosofía en una colección separada; no se contabilizan aquí como tesis."),
    );
  } else {
    philosophyProgramsLabel.textContent = "PROGRAMAS DE FILOSOFÍA";
    document.querySelector("#philosophy-programs-title").textContent = "Tres programas documentados, sin inventar equivalencias.";
    philosophyProgramsDescription.textContent = "La vista incluye también tesis filosóficas de otros programas. Su programa académico original siempre permanece visible.";
    philosophyProgramsNote.replaceChildren(
      element("strong", "", "Doctorado:"),
      document.createTextNode(" no se publica un “Doctorado en Filosofía” porque no existe una autoridad institucional exacta confirmada. Doctorado en Humanidades no se relabela como Filosofía."),
    );
  }
  renderPrograms();

  if (editorial) {
    document.querySelector("#thesis-total").textContent = datasets.udg.editorial.counts.records.toLocaleString("es-MX");
    heroTotalLabel.textContent = "Obras filosóficas";
    heroLead.textContent = "Explore publicaciones filosóficas de Editorial Universidad de Guadalajara. El corpus distingue la categoría oficial Filosofía de relaciones filosóficas verificadas fuera de ese filtro y enlaza siempre a la ficha editorial de origen.";
    heroFootnote.textContent = "EDITORIAL UDG / FILOSOFÍA";
    document.querySelector("#thesis-revision").textContent = datasets.udg.editorial.revision;
    scopeTag.textContent = `EDITORIAL UDG · ${datasets.udg.editorial.counts.officialPhilosophyCategory} OFICIALES · ${datasets.udg.editorial.counts.verifiedPhilosophicalRelation} VERIFICADAS`;
    resultLabel.textContent = "obras encontradas";
  } else if (ugtoPhilosophy) {
    document.querySelector("#thesis-total").textContent = datasets.ugto.philosophy.counts.records.toLocaleString("es-MX");
    heroTotalLabel.textContent = "Tesis públicas";
    heroLead.textContent = "Explore las tesis públicas de Filosofía visibles en el Repositorio Institucional de la Universidad de Guanajuato. Cada resultado conserva su handle institucional y enlaza únicamente a la ficha oficial.";
    heroFootnote.textContent = "UNIVERSIDAD DE GUANAJUATO / FILOSOFÍA";
    document.querySelector("#thesis-revision").textContent = datasets.ugto.philosophy.revision;
    scopeTag.textContent = `UG · FILOSOFÍA · ${datasets.ugto.philosophy.counts.records} TESIS`;
    resultLabel.textContent = "tesis encontradas";
  } else if (udgPhilosophy) {
    document.querySelector("#thesis-total").textContent = datasets.udg.philosophy.metrics.records.toLocaleString("es-MX");
    heroTotalLabel.textContent = "Referencias filosóficas";
    heroLead.textContent = "Explore el inventario histórico de Licenciatura en Filosofía de la Biblioteca CUCSH, los programas filosóficos documentados y cruces filosóficos curados. Cada referencia conserva su procedencia y nivel de validación.";
    heroFootnote.textContent = "FILOSOFÍA / NÚCLEO + CRUCES CURADOS";
    document.querySelector("#thesis-revision").textContent = datasets.udg.philosophy.revision;
    scopeTag.textContent = `FILOSOFÍA · ${datasets.udg.philosophy.metrics.byStatus.include} INCLUDE · ${datasets.udg.philosophy.metrics.byStatus.review} REVIEW`;
    resultLabel.textContent = "referencias encontradas";
  } else {
    document.querySelector("#thesis-total").textContent = datasets.udg.humanities.totalIncluded.toLocaleString("es-MX");
    heroTotalLabel.textContent = "Tesis admitidas";
    heroLead.textContent = "Explore tesis de Humanidades identificadas y verificadas en el corpus institucional. Cada resultado conserva su procedencia y le conduce al repositorio de origen.";
    heroFootnote.textContent = "UDEG / HUMANIDADES / CORPUS EFECTIVO";
    document.querySelector("#thesis-revision").textContent = datasets.udg.humanities.sourceRelease;
    scopeTag.textContent = "UDEG · HUMANIDADES · INCLUDE";
    resultLabel.textContent = "tesis encontradas";
  }

  if (updateUrl) {
    const params = new URLSearchParams(location.search);
    if (activeInstitution === "ugto") params.set("institution", "ugto");
    else params.delete("institution");

    if (activeInstitution === "udg" && scope === "humanities") params.delete("scope");
    else params.set("scope", scope);

    params.delete("q");
    const query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? `?${query}` : ""));
  }
  render();
}

async function loadData() {
  status.textContent = "Cargando referencias académicas verificadas…";
  try {
    const [humanitiesResponse, philosophyResponse, editorialResponse] = await Promise.all([
      fetch("./data/theses/demo-v1/index.json", { cache: "no-cache" }),
      fetch("./data/theses/philosophy-v1/index.json", { cache: "no-cache" }),
      fetch("./data/editorial/udg-philosophy-v1/index.json", { cache: "no-cache" }),
    ]);
    if (!humanitiesResponse.ok) throw new Error("Humanities HTTP " + humanitiesResponse.status);
    if (!philosophyResponse.ok) throw new Error("Philosophy HTTP " + philosophyResponse.status);
    if (!editorialResponse.ok) throw new Error("Editorial UdeG HTTP " + editorialResponse.status);
    datasets.humanities = validateIndex(await humanitiesResponse.json());
    datasets.philosophy = validatePhilosophyIndex(await philosophyResponse.json());
    datasets.editorial = validateEditorialUdgIndex(await editorialResponse.json());
    loaded = true;

    document.querySelector("#thesis-canonical-total").textContent = datasets.humanities.totalCanonical.toLocaleString("es-MX");
    document.querySelector("#thesis-scope-humanities-count").textContent = datasets.humanities.totalIncluded.toLocaleString("es-MX");
    document.querySelector("#thesis-scope-philosophy-count").textContent = datasets.philosophy.metrics.records.toLocaleString("es-MX");
    document.querySelector("#thesis-scope-editorial-count").textContent = datasets.editorial.counts.records.toLocaleString("es-MX");

    const params = new URLSearchParams(location.search);
    const requestedScope = params.get("scope");
    setScope(
      requestedScope === "philosophy" || requestedScope === "editorial"
        ? requestedScope
        : "humanities",
      { updateUrl: false },
    );
    const initialQuery = params.get("q");
    if (initialQuery) {
      searchInput.value = initialQuery;
      currentPage = 1;
      render();
    }
  } catch {
    status.textContent = "No fue posible cargar los índices verificados. No mostraremos datos incompletos.";
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

for (const button of scopeButtons) button.addEventListener("click", () => setScope(button.dataset.thesisScope));
form.addEventListener("submit", event => { event.preventDefault(); currentPage = 1; render(); });
searchInput.addEventListener("input", () => { currentPage = 1; render(); });
for (const control of Object.values(filters)) control.addEventListener("change", () => { currentPage = 1; render(); });
philosophyRole.addEventListener("change", () => { currentPage = 1; render(); });
editorialOrigin.addEventListener("change", () => { currentPage = 1; render(); });
editorialFormat.addEventListener("change", () => { currentPage = 1; render(); });
sort.addEventListener("change", () => { currentPage = 1; render(); });
clear.addEventListener("click", () => {
  form.reset();
  currentPage = 1;
  render();
  searchInput.focus();
});

loadData();

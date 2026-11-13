/* Ficha bibliográfica compartida por los Atlas de revistas CUCSH.
 * Presenta exclusivamente los campos documentados: nunca inventa resúmenes.
 * HTML y enlaces se validan antes de incorporarse al panel.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeJournalExternalUrl(value) {
  if (typeof value !== "string") return "";
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch {
    return "";
  }
}

export function journalArticleSourceUrl(record = {}) {
  const fromOriginal = safeJournalExternalUrl(record.urls?.canonical);
  const fromDoi = safeJournalExternalUrl(record.urls?.doi);
  const doi = String(record.doi || "").trim();
  const resolvedDoi = doi && !/\s/.test(doi)
    ? safeJournalExternalUrl("https://doi.org/" + encodeURI(doi))
    : "";
  return fromOriginal || fromDoi || resolvedDoi || "";
}

export function journalArticleAbstract(record = {}) {
  // Never substitute an unrelated description, generated text or inference.
  const abstract = typeof record.abstract === "string" ? record.abstract.trim() : "";
  if (!abstract) {
    return '<section class="atlas-abstract-block atlas-abstract-empty" aria-label="Resumen del artículo">' +
      '<div class="atlas-abstract-heading"><span>RESUMEN / ABSTRACT</span></div>' +
      '<p>No hay resumen registrado para este artículo en el corpus.</p>' +
      '</section>';
  }
  const paragraphs = abstract.split(/\n\s*\n/g).map(p => p.trim()).filter(Boolean);
  return '<section class="atlas-abstract-block" aria-label="Resumen del artículo">' +
    '<div class="atlas-abstract-heading"><span>RESUMEN / ABSTRACT</span><small>Texto del registro bibliográfico</small></div>' +
    '<div class="atlas-abstract-body">' +
      paragraphs.map(p => '<p>' + escapeHtml(p).replace(/\n/g, "<br>") + '</p>').join("") +
    '</div>' +
    '</section>';
}

function property(label, value, { html = false } = {}) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  return '<div class="atlas-sheet-field"><dt>' + escapeHtml(label) + '</dt><dd>' +
    (html ? value : escapeHtml(value)) + '</dd></div>';
}

export function journalArticleSheet(record = {}, issue = {}, category = "General") {
  const authors = (Array.isArray(record.authors) ? record.authors : [])
    .map(author => typeof author === "string" ? author : author?.name || author?.sourceName)
    .filter(Boolean);
  const subjects = Array.isArray(record.subjects) ? record.subjects.filter(Boolean) : [];
  const link = journalArticleSourceUrl(record);
  const originalDoi = String(record.doi || "").trim();
  const doiUrl = originalDoi && !/\s/.test(originalDoi)
    ? safeJournalExternalUrl("https://doi.org/" + encodeURI(originalDoi))
    : "";
  const doiHtml = originalDoi
    ? (doiUrl
      ? '<a href="' + escapeHtml(doiUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(originalDoi) + ' ↗</a>'
      : escapeHtml(originalDoi))
    : "No indicado";

  const details = [
    property("Título", record.title || "Sin título"),
    property("Autoría", authors.join(" · ") || "No indicada"),
    property("Revista", record.journal || "No indicada"),
    property("Número editorial", issue.label || "No identificado"),
    property("Año", record.year || "No indicado"),
    property("Fecha registrada", record.editorialDate || record.date || ""),
    property("DOI", doiHtml, { html: true }),
    property("Idioma", record.language || ""),
    property("Temas declarados", subjects.join(" · ")),
    property("Categoría de navegación", category || "General")
  ].filter(Boolean).join("");

  return '<details class="atlas-article-sheet" data-article-sheet>' +
    '<summary class="atlas-article-sheet-toggle">' +
      '<span class="atlas-sheet-toggle-icon" aria-hidden="true">▤</span>' +
      '<span>Ver ficha del artículo</span>' +
      '<span class="atlas-sheet-toggle-arrow" aria-hidden="true">⌄</span>' +
    '</summary>' +
    '<div class="atlas-article-sheet-body">' +
      '<div class="atlas-article-sheet-title">' +
        '<span>FICHA BIBLIOGRÁFICA · ' + escapeHtml(issue.label || "EDICIÓN NO IDENTIFICADA") + '</span>' +
        '<strong>' + escapeHtml(record.title || "Sin título") + '</strong>' +
      '</div>' +
      '<dl class="atlas-article-sheet-fields">' + details + '</dl>' +
      '<p class="atlas-article-sheet-note">Los campos proceden del registro de la revista. La categoría es una clasificación de navegación, no una etiqueta editorial.</p>' +
      (link
        ? '<a class="atlas-article-sheet-open" href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">Leer artículo en la fuente original <span aria-hidden="true">↗</span></a>'
        : '<p class="atlas-article-sheet-unavailable">El registro no proporciona un enlace directo al artículo.</p>') +
    '</div>' +
  '</details>';
}

/**
 * Inventario histórico de reseñas y entrevistas de Protrepsis.
 * La recuperación DOI-first ya está cerrada; estas listas se conservan
 * únicamente para reconocer el género documental y nunca para inventar
 * palabras clave editoriales.
 */
export const PROTREPSIS_HISTORICAL_REVIEW_INTERVIEW_DOIS = Object.freeze([
  "10.32870/prot.i1.20",
  "10.32870/prot.i1.21",
  "10.32870/prot.i1.1",
  "10.32870/prot.i1.2",
  "10.32870/prot.i2.22",
  "10.32870/prot.i2.33",
  "10.32870/prot.i2.34",
  "10.32870/prot.i3.42",
  "10.32870/prot.i4.60",
  "10.32870/prot.i5.81",
  "10.32870/prot.i6.98",
  "10.32870/prot.i6.97",
  "10.32870/prot.i7-8.112",
  "10.32870/prot.i9-10.134",
  "10.32870/prot.i13.155",
  "10.32870/prot.i14.178",
]);

const historicalReviewsAndInterviews = new Set(
  PROTREPSIS_HISTORICAL_REVIEW_INTERVIEW_DOIS
);

/**
 * Cinco registros adicionales con género declarado en su título editorial.
 * Su estado de ausencia de keywords se obtiene de la auditoría cerrada.
 */
export const PROTREPSIS_ADDITIONAL_REVIEW_BIBLIOGRAPHIC_DOIS = Object.freeze([
  "10.32870/prot.i15.203",
  "10.32870/prot.i16.222",
  "10.32870/prot.i17.233",
  "10.32870/prot.i18.269",
  "10.32870/prot.i18.270"
]);

const additionalEditorialGenres = new Set(
  PROTREPSIS_ADDITIONAL_REVIEW_BIBLIOGRAPHIC_DOIS
);

function normalizeDoi(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
    .replace(/[.,;]+$/, "");
}

export function isProtrepsisHistoricalReviewOrInterview(record) {
  return String(record?.journal || "").trim().toLowerCase() === "protrepsis" &&
    historicalReviewsAndInterviews.has(normalizeDoi(record?.doi));
}

export function isProtrepsisExplicitReviewOrBibliographic(record) {
  return isProtrepsisHistoricalReviewOrInterview(record) ||
    (String(record?.journal || "").trim().toLowerCase() === "protrepsis" &&
      additionalEditorialGenres.has(normalizeDoi(record?.doi)));
}

export function protrepsisMissingKeywordStatus(record) {
  if (String(record?.editorialKeywordStatus || "") === "verified-absent") {
    const title = String(record?.title || "");
    const genre = /entrevista/i.test(title) ? "Entrevista"
      : /noticia bibliográfica/i.test(title) ? "Noticia bibliográfica"
      : /recensión/i.test(title) ? "Recensión"
      : /reseña/i.test(title) ? "Reseña"
      : "";
    return {
      label: (genre ? genre + " · " : "") + "Sin palabras clave editoriales",
      note: "Ausencia editorial verificada en la publicación. Las categorías de relación mostradas para este registro son derivadas y no se presentan como palabras clave de Protrepsis.",
      className: "is-keywords-absent"
    };
  }

  if (isProtrepsisExplicitReviewOrBibliographic(record)) {
    return {
      label: "Sin palabras clave verificadas",
      note: "No se cargó la resolución editorial de este registro. No se infieren palabras clave desde el título o el resumen.",
      className: "is-keywords-unverified"
    };
  }

  return {
    label: "Pendientes de recuperación",
    note: "No se cargó evidencia editorial suficiente para resolver este registro; no se infieren palabras clave.",
    className: "is-keywords-pending"
  };
}

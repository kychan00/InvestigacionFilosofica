/**
 * Auditoría DOI-first del archivo histórico de Protrepsis.
 * Estas 16 publicaciones son reseñas o entrevistas: todavía NO hay
 * evidencia verificada de palabras clave editoriales para ellas.
 * Esta clasificación NO implica que nunca hayan tenido keywords.
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
 * Sin evidencia literal de keywords: no se asignan ni se infieren etiquetas.
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
  if (isProtrepsisExplicitReviewOrBibliographic(record)) {
    const title = String(record?.title || "");
    const genre = /entrevista/i.test(title) ? "Entrevista"
      : /noticia bibliográfica/i.test(title) ? "Noticia bibliográfica"
      : /recensión/i.test(title) ? "Recensión"
      : /reseña/i.test(title) ? "Reseña"
      : "Reseña/entrevista";
    return {
      label: genre + " · Sin palabras clave verificadas",
      note: "Registro identificado como reseña, recensión, entrevista o noticia bibliográfica. No se han verificado palabras clave editoriales; esto no demuestra que la publicación carezca de ellas.",
      className: "is-keywords-unverified"
    };
  }
  return {
    label: "Pendientes de recuperación",
    note: "Pendientes de recuperación y verificación editorial; no se infieren desde el título, el resumen ni fuentes bibliográficas.",
    className: "is-keywords-pending"
  };
}

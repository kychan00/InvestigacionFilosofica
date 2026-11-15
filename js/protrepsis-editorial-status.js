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

export function protrepsisMissingKeywordStatus(record) {
  if (isProtrepsisHistoricalReviewOrInterview(record)) {
    return {
      label: "Reseña/entrevista · Sin palabras clave verificadas",
      note: "Registro histórico identificado como reseña o entrevista. No se han verificado palabras clave editoriales; esto no demuestra que la publicación carezca de ellas.",
      className: "is-keywords-unverified"
    };
  }
  return {
    label: "Pendientes de recuperación",
    note: "Pendientes de recuperación y verificación editorial; no se infieren desde el título, el resumen ni fuentes bibliográficas.",
    className: "is-keywords-pending"
  };
}

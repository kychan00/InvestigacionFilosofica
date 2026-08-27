import {
  francAll
} from "franc-min";


const FRANC_TO_ISO2 = {
  spa: "es",
  eng: "en",
  fra: "fr",
  deu: "de",
  ita: "it",
  por: "pt",
  nld: "nl",
  cat: "ca",
  rus: "ru",
  pol: "pl",
  tur: "tr",
  ell: "el",
  arb: "ar",
  heb: "he",
  jpn: "ja",
  kor: "ko",
  cmn: "zh"
};


const PHILOSOPHY_LANGUAGES = [
  "spa",
  "eng",
  "fra",
  "deu",
  "ita",
  "por",
  "nld",
  "cat",
  "rus",
  "pol",
  "tur",
  "ell",
  "arb",
  "heb",
  "jpn",
  "kor",
  "cmn"
];


/*
 * Sólo se usan como desempate cuando
 * franc-min devuelve una clasificación
 * poco separada.
 */
const FUNCTION_WORDS = {
  es: new Set([
    "al",
    "como",
    "con",
    "contra",
    "de",
    "del",
    "desde",
    "el",
    "en",
    "entre",
    "hacia",
    "la",
    "las",
    "los",
    "para",
    "por",
    "que",
    "sin",
    "sobre",
    "una",
    "uno",
    "y"
  ]),

  en: new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "amidst",
    "between",
    "by",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "or",
    "the",
    "to",
    "toward",
    "with",
    "without"
  ])
};


function cleanText(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /https?:\/\/\S+/gi,
      " "
    )
    .replace(
      /[^\p{L}\p{M}'’-]+/gu,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function tokensOf(
  value
) {
  return cleanText(value)
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}


function lexicalScore(
  text,
  language
) {
  const words =
    FUNCTION_WORDS[
      language
    ];

  if (!words) {
    return 0;
  }

  return tokensOf(text)
    .reduce(
      (score, token) =>
        score +
        (
          words.has(token)
            ? 1
            : 0
        ),
      0
    );
}


function resolveEnglishSpanishTie(
  text
) {
  const es =
    lexicalScore(
      text,
      "es"
    );

  const en =
    lexicalScore(
      text,
      "en"
    );


  /*
   * Exigimos una diferencia real.
   * Un 2–2 o 1–1 sigue siendo ambiguo.
   */
  if (
    en >= 2 &&
    en > es
  ) {
    return "en";
  }


  if (
    es >= 2 &&
    es > en
  ) {
    return "es";
  }


  return null;
}


export function languageCandidates(
  text
) {
  const cleaned =
    cleanText(text);


  if (
    cleaned.length < 12
  ) {
    return [];
  }


  return francAll(
    cleaned,
    {
      minLength: 12,
      only:
        PHILOSOPHY_LANGUAGES
    }
  )
    .filter(
      ([code]) =>
        FRANC_TO_ISO2[
          code
        ]
    )
    .map(
      ([code, score]) => ({
        code:
          FRANC_TO_ISO2[
            code
          ],

        francCode:
          code,

        score
      })
    );
}


export function detectTextLanguage(
  text
) {
  const cleaned =
    cleanText(text);

  const candidates =
    languageCandidates(
      cleaned
    );


  if (
    !candidates.length
  ) {
    return null;
  }


  const first =
    candidates[0];

  const second =
    candidates[1];


  /*
   * Sin competidor relevante podemos
   * aceptar el primero.
   */
  if (!second) {
    return first.code;
  }


  const margin =
    first.score -
    second.score;


  /*
   * franc-min está razonablemente seguro.
   */
  if (
    margin >= 0.08
  ) {
    return first.code;
  }


  /*
   * Caso dudoso español / inglés:
   * usamos palabras funcionales como
   * desempate, no vocabulario temático.
   *
   * Esto evita que expresiones como
   * "Ética de la Liberación" dominen un
   * título que gramaticalmente es inglés.
   */
  const topCodes =
    new Set(
      candidates
        .slice(
          0,
          4
        )
        .map(
          item =>
            item.code
        )
    );


  if (
    topCodes.has("es") &&
    topCodes.has("en")
  ) {
    const resolved =
      resolveEnglishSpanishTie(
        cleaned
      );

    if (resolved) {
      return resolved;
    }
  }


  /*
   * Si la librería no está suficientemente
   * segura, preferimos no inventar.
   */
  return null;
}


export function effectiveLanguage(
  item
) {
  const titleLanguage =
    detectTextLanguage(
      item.title
    );


  if (
    titleLanguage
  ) {
    return titleLanguage;
  }


  /*
   * Un abstract suele ofrecer mucha más
   * evidencia lingüística que un título.
   */
  const abstractLanguage =
    detectTextLanguage(
      item.abstract
    );


  if (
    abstractLanguage
  ) {
    return abstractLanguage;
  }


  /*
   * Último recurso:
   * metadata declarada por proveedor.
   */
  return (
    item.language ||
    null
  );
}

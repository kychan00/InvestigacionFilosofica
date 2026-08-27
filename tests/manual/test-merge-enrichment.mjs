import {
  searchOpenAlex
} from "./src/sources/openalex.js";

import {
  searchCrossref
} from "./src/sources/crossref.js";

import {
  mergeResults
} from "./src/core/merge-results.js";


const expansion = {
  query:
    "libertad en Kant",

  weight:
    1,

  type:
    "original"
};


const targetDoi =
  "10.15581/013.427";


const [
  openAlex,
  crossref
] =
  await Promise.all([
    searchOpenAlex(
      expansion,
      {
        perPage: 10
      }
    ),

    searchCrossref(
      expansion,
      {
        rows: 10
      }
    )
  ]);


const raw = [
  ...openAlex,
  ...crossref
];


const matchingRaw =
  raw.filter(
    item =>
      item.doi === targetDoi
  );


const merged =
  mergeResults(
    matchingRaw
  );


console.log(
  "\nDOI OBJETIVO:",
  targetDoi
);


console.log(
  "\nREGISTROS ANTES DE FUSIONAR:",
  matchingRaw.length
);


for (
  const item of matchingRaw
) {
  console.log(
    "\nPROVEEDOR:",
    item.providers.join(", ")
  );

  console.log(
    " título:",
    item.title
  );

  console.log(
    " autores:",
    item.authors
      .map(a => a.name)
      .join(", ") || "—"
  );

  console.log(
    " año:",
    item.year ?? "—"
  );

  console.log(
    " tipo:",
    item.type || "—"
  );

  console.log(
    " revista:",
    item.journal || "—"
  );

  console.log(
    " publisher:",
    item.publisher || "—"
  );

  console.log(
    " ISBN:",
    item.isbn?.join(", ") || "—"
  );

  console.log(
    " citas:",
    item.citedBy ?? "—"
  );

  console.log(
    " OA:",
    item.openAccess?.isOpen
      ? "sí"
      : "no/—"
  );

  console.log(
    " topics:",
    item.topics?.length || 0
  );
}


console.log(
  "\n========================================"
);

console.log(
  "REGISTRO FEDERADO"
);

console.log(
  "========================================"
);


if (!merged.length) {
  console.log(
    "No se encontró el DOI objetivo."
  );

  process.exit(0);
}


const item =
  merged[0];


console.log(
  "providers:",
  item.providers.join(", ")
);

console.log(
  "DOI:",
  item.doi
);

console.log(
  "título:",
  item.title
);

console.log(
  "autores:",
  item.authors
    .map(a => a.name)
    .join(", ") || "—"
);

console.log(
  "año:",
  item.year ?? "—"
);

console.log(
  "tipo:",
  item.type || "—"
);

console.log(
  "revista:",
  item.journal || "—"
);

console.log(
  "publisher:",
  item.publisher || "—"
);

console.log(
  "ISBN:",
  item.isbn?.join(", ") || "—"
);

console.log(
  "abstract:",
  item.abstract
    ? "sí"
    : "—"
);

console.log(
  "citas:",
  item.citedBy ?? "—"
);

console.log(
  "OA:",
  item.openAccess?.isOpen
    ? "sí"
    : "no/—"
);

console.log(
  "topics:",
  item.topics?.length || 0
);

console.log(
  "matchedQueries:",
  item.matchedQueries.length
);

console.log(
  "sourceRecords:",
  item.sourceRecords.length
);

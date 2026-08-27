import fs from "node:fs";

import {
  parseQuery
} from "./src/core/parser.js";

import {
  expandQuery
} from "./src/core/expander.js";

import {
  searchOpenAlex
} from "./src/sources/openalex.js";

import {
  searchCrossref
} from "./src/sources/crossref.js";

import {
  mergeResults
} from "./src/core/merge-results.js";

import {
  rankResults
} from "./src/core/rank.js";


const philosophyMap =
  JSON.parse(
    fs.readFileSync(
      new URL(
        "./src/data/philosophy-map.json",
        import.meta.url
      ),
      "utf8"
    )
  );


const userQuery =
  process.argv
    .slice(2)
    .join(" ")
    .trim()
  ||
  "libertad en Kant";


const parsed =
  parseQuery(
    userQuery,
    philosophyMap
  );


const expansions =
  expandQuery(
    parsed,
    philosophyMap,
    {
      maxQueries: 5
    }
  );


console.log(
  "\nCONSULTA:",
  userQuery
);


console.log(
  "\nEXPANSIONES:"
);

for (const expansion of expansions) {
  console.log(
    expansion.weight.toFixed(2),
    expansion.type.padEnd(12),
    expansion.query
  );
}


const raw = [];
const errors = [];


for (const expansion of expansions) {
  console.log(
    `\nBuscando: ${expansion.query}`
  );

  const [openAlexResult, crossrefResult] =
    await Promise.allSettled([
      searchOpenAlex(
        expansion,
        {
          perPage: 6
        }
      ),

      searchCrossref(
        expansion,
        {
          rows: 6
        }
      )
    ]);


  if (
    openAlexResult.status === "fulfilled"
  ) {
    raw.push(
      ...openAlexResult.value
    );
  } else {
    errors.push({
      provider: "OpenAlex",
      query: expansion.query,
      error:
        openAlexResult.reason?.message ||
        String(openAlexResult.reason)
    });
  }


  if (
    crossrefResult.status === "fulfilled"
  ) {
    raw.push(
      ...crossrefResult.value
    );
  } else {
    errors.push({
      provider: "Crossref",
      query: expansion.query,
      error:
        crossrefResult.reason?.message ||
        String(crossrefResult.reason)
    });
  }
}


const beforeMerge =
  raw.length;


const merged =
  mergeResults(raw);


const ranked =
  rankResults(
    merged,
    parsed,
    philosophyMap
  );


const multiProvider =
  ranked.filter(
    item =>
      item.providers.length > 1
  );


console.log(
  "\n=============================================="
);

console.log(
  "RESUMEN FEDERADO"
);

console.log(
  "=============================================="
);

console.log(
  "Apariciones totales:",
  beforeMerge
);

console.log(
  "Resultados únicos:",
  merged.length
);

console.log(
  "Apariciones fusionadas:",
  beforeMerge - merged.length
);

console.log(
  "Resultados con >1 proveedor:",
  multiProvider.length
);


if (errors.length) {
  console.log(
    "\nERRORES:"
  );

  for (const error of errors) {
    console.log(
      "-",
      error.provider,
      error.query,
      "→",
      error.error
    );
  }
}


console.log(
  "\n=============================================="
);

console.log(
  "RESULTADOS CON CONSENSO DE PROVEEDORES"
);

console.log(
  "=============================================="
);


if (!multiProvider.length) {
  console.log(
    "\nNinguno en esta muestra."
  );
}


for (
  const item of
  multiProvider.slice(0, 15)
) {
  console.log(
    `\n[${item.relevanceLevel}]`,
    `${item.relevanceScore}/100`,
    item.title
  );

  console.log(
    "   providers:",
    item.providers.join(", ")
  );

  console.log(
    "   DOI:",
    item.doi || "—"
  );

  console.log(
    "   consultas:",
    item.matchedQueries.length
  );

  console.log(
    "   S:",
    item.ranking.consensus
  );

  console.log(
    "   Q/P/D/S/B/I/PEN:",
    [
      item.ranking.query,
      item.ranking.philosophy,
      item.ranking.discipline,
      item.ranking.consensus,
      item.ranking.bibliography,
      item.ranking.impact,
      item.ranking.penalty
    ].join("/")
  );

  console.log(
    "   sourceRecords:",
    item.sourceRecords.length
  );
}


console.log(
  "\n=============================================="
);

console.log(
  "TOP 20 FEDERADO"
);

console.log(
  "=============================================="
);


for (
  let i = 0;
  i < Math.min(20, ranked.length);
  i++
) {
  const item =
    ranked[i];

  console.log(
    `\n${i + 1}.`,
    `[${item.relevanceLevel}]`,
    `${item.relevanceScore}/100`,
    item.title
  );

  console.log(
    "   providers:",
    item.providers.join(", ")
  );

  console.log(
    "   DOI:",
    item.doi || "—"
  );

  console.log(
    "   Q/P/D/S/B/I/PEN:",
    [
      item.ranking.query,
      item.ranking.philosophy,
      item.ranking.discipline,
      item.ranking.consensus,
      item.ranking.bibliography,
      item.ranking.impact,
      item.ranking.penalty
    ].join("/")
  );
}

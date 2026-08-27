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
  mergeResults
} from "./src/core/merge-results.js";

import {
  rankResults
} from "./src/core/rank.js";


const philosophyMap = JSON.parse(
  fs.readFileSync(
    new URL(
      "./src/data/philosophy-map.json",
      import.meta.url
    ),
    "utf8"
  )
);


const tests = [
  "epistemología de Hume",
  "justicia Rawls",
  "problema mente cuerpo Descartes",
  "Ser y tiempo Heidegger",
  "libre albedrío y determinismo"
];


function sleep(ms) {
  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}


async function runSearch(userQuery) {
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
    "\n\n=================================================="
  );

  console.log(
    "CONSULTA:",
    userQuery
  );

  console.log(
    "--------------------------------------------------"
  );

  console.log(
    "Filósofos:",
    parsed.philosophers
      .map(x => x.name)
      .join(", ") || "—"
  );

  console.log(
    "Conceptos:",
    parsed.concepts
      .map(x => x.id)
      .join(", ") || "—"
  );

  console.log(
    "Obras:",
    parsed.works
      .map(x => x.canonicalTitle)
      .join(", ") || "—"
  );

  console.log(
    "Áreas:",
    parsed.areas
      .filter(x => x.confidence >= 0.40)
      .map(
        x =>
          `${x.id}:${x.confidence.toFixed(2)}`
      )
      .join(", ") || "—"
  );


  console.log(
    "\nExpansiones:"
  );

  for (const item of expansions) {
    console.log(
      ` ${item.weight.toFixed(2)}`,
      item.type.padEnd(12),
      item.query
    );
  }


  const raw = [];


  for (const expansion of expansions) {
    try {
      const results =
        await searchOpenAlex(
          expansion,
          {
            perPage: 6
          }
        );

      raw.push(
        ...results
      );
    } catch (error) {
      console.log(
        "ERROR OpenAlex:",
        expansion.query,
        "→",
        error.message
      );
    }

    await sleep(500);
  }


  const merged =
    mergeResults(raw);


  const ranked =
    rankResults(
      merged,
      parsed,
      philosophyMap
    );


  console.log(
    "\nApariciones:",
    raw.length
  );

  console.log(
    "Únicos:",
    merged.length
  );

  console.log(
    "\nTOP 10:"
  );


  for (
    let i = 0;
    i < Math.min(10, ranked.length);
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
      "   consultas:",
      item.matchedQueries.length
    );

    console.log(
      "   DOI:",
      item.doi || "—"
    );
  }
}


for (const query of tests) {
  await runSearch(query);

  /*
   * Pausa adicional entre consultas
   * para no golpear OpenAlex innecesariamente.
   */
  await sleep(1500);
}

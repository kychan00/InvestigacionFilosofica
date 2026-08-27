import fs from "node:fs";

import {
  searchPhilosophy
} from "./src/core/search-engine.js";


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


const query =
  process.argv
    .slice(2)
    .join(" ")
    .trim()
  ||
  "libertad en Kant";


const response =
  await searchPhilosophy(
    query,
    philosophyMap,
    {
      maxQueries: 5,

      openAlex: {
        perPage: 6
      },

      crossref: {
        rows: 6
      },

      onProgress(state) {
        console.log(
          `[${state.completed}/${state.total}]`,
          state.expansion.query,
          "→",
          state.appearances,
          "apariciones"
        );
      }
    }
  );


console.log(
  "\n================================"
);

console.log(
  "MOTOR DE BÚSQUEDA"
);

console.log(
  "================================"
);

console.log(
  "Consulta:",
  response.query
);

console.log(
  "Apariciones:",
  response.stats.appearances
);

console.log(
  "Únicos:",
  response.stats.unique
);

console.log(
  "Fusionados:",
  response.stats.merged
);

console.log(
  "Multi-provider:",
  response.stats.multiProvider
);

console.log(
  "Proveedores:",
  response.stats.providers
);


console.log(
  "\nTOP 10:"
);


for (
  let i = 0;
  i <
    Math.min(
      10,
      response.results.length
    );
  i++
) {
  const item =
    response.results[i];

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
}


if (
  response.errors.length
) {
  console.log(
    "\nERRORES:"
  );

  for (
    const error of
    response.errors
  ) {
    console.log(
      "-",
      error.provider,
      error.query,
      "→",
      error.message
    );
  }
}

import fs from "node:fs";

import {
  parseQuery
} from "./src/core/parser.js";

import {
  expandQuery
} from "./src/core/expander.js";

import {
  searchCrossref
} from "./src/sources/crossref.js";


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
      maxQueries: 3
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


console.log(
  "\nCROSSREF:"
);


for (const expansion of expansions) {
  console.log(
    `\n→ ${expansion.query}`
  );

  try {
    const results =
      await searchCrossref(
        expansion,
        {
          rows: 5
        }
      );


    for (
      let i = 0;
      i < results.length;
      i++
    ) {
      const item =
        results[i];

      const authors =
        item.authors
          .map(
            author =>
              author.name
          )
          .join(", ");


      console.log(
        `${i + 1}.`,
        item.title
      );

      console.log(
        "   autores:",
        authors || "—"
      );

      console.log(
        "   año:",
        item.year ?? "—"
      );

      console.log(
        "   tipo:",
        item.type || "—"
      );

      console.log(
        "   revista:",
        item.journal || "—"
      );

      console.log(
        "   DOI:",
        item.doi || "—"
      );
    }
  } catch (error) {
    console.error(
      "   ERROR:",
      error.message
    );
  }
}

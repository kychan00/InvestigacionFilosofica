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

const map = JSON.parse(
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
    map
  );

const expansions =
  expandQuery(
    parsed,
    map,
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
  "\nOPENALEX:"
);

for (const expansion of expansions) {
  console.log(
    `\n→ ${expansion.query}`
  );

  try {
    const results =
      await searchOpenAlex(
        expansion,
        {
          perPage: 5
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
          .map(a => a.name)
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
        "   DOI:",
        item.doi || "—"
      );

      console.log(
        "   citas:",
        item.citedBy ?? "—"
      );

      console.log(
        "   OA:",
        item.openAccess?.isOpen
          ? "sí"
          : "no"
      );
    }
  } catch (error) {
    console.error(
      "   ERROR:",
      error.message
    );
  }
}

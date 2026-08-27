import {
  searchInternetArchive
} from "../../src/sources/internet-archive.js";


const queries = [
  "libertad en Kant",
  "Critique of Pure Reason Kant",
  "Being and Time Heidegger",
  "Republic Plato"
];


function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


for (
  let i = 0;
  i < queries.length;
  i++
) {
  const query =
    queries[i];


  console.log(
    "\n" +
    "=".repeat(72)
  );

  console.log(
    `CONSULTA: ${query}`
  );

  console.log(
    "=".repeat(72)
  );


  try {
    const results =
      await searchInternetArchive(
        {
          query,
          weight: 1,
          type: "manual-smoke"
        },
        {
          rows: 6,
          page: 1,
          retries: 1
        }
      );


    console.log(
      `Resultados: ${results.length}\n`
    );


    results.forEach(
      (item, index) => {
        const authors =
          (item.authors || [])
            .map(
              author =>
                author.name
            )
            .join(", ");


        const subjects =
          (item.topics || [])
            .slice(0, 5)
            .map(
              topic =>
                topic.name
            )
            .join(" · ");


        console.log(
          `${index + 1}. ${item.title}`
        );

        console.log(
          `   Autor: ${authors || "—"}`
        );

        console.log(
          `   Año: ${item.year || "—"}`
        );

        console.log(
          `   Idioma: ${item.language || "—"}`
        );

        console.log(
          `   ID: ${item.sourceRecords?.[0]?.sourceId || "—"}`
        );

        console.log(
          `   Descargas: ${item.sourceRecords?.[0]?.downloads ?? "—"}`
        );

        console.log(
          `   Score IA: ${item.sourceRecords?.[0]?.retrievalScore ?? "—"}`
        );

        console.log(
          `   Temas: ${subjects || "—"}`
        );

        console.log(
          `   URL: ${item.urls?.canonical || "—"}`
        );

        console.log("");
      }
    );

  } catch (error) {

    console.error(
      `ERROR: ${error.message}`
    );
  }


  if (
    i <
    queries.length - 1
  ) {
    await sleep(
      800
    );
  }
}

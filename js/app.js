import {
  UDEG_LOGIN_URL
} from "../src/data/institutional-sources.js";

import {
  buildInstitutionalLinks
} from "../src/core/institutional-links.js";

import {
  effectiveLanguage
} from "../src/core/language.js";

import {
  searchPhilosophy,
  searchMorePhilosophy
} from "../src/core/search-engine.js";

import {
  explainResult
} from "../src/core/explain.js";


const form =
  document.querySelector(
    "#search-form"
  );

const input =
  document.querySelector(
    "#search-input"
  );

const button =
  form.querySelector(
    "button"
  );

const status =
  document.querySelector(
    "#status"
  );

const resultsEl =
  document.querySelector(
    "#results"
  );

const interpretationEl =
  document.querySelector(
    "#interpretation"
  );

const statsEl =
  document.querySelector(
    "#stats"
  );

const filtersEl =
  document.querySelector(
    "#filters"
  );

const recordModal =
  document.querySelector(
    "#record-modal"
  );

const recordModalContent =
  document.querySelector(
    "#record-modal-content"
  );


let philosophyMap = null;
let currentController = null;
let currentParsed = null;
let currentResults = [];
let currentResponse = null;

let visibleLimit = 20;
let currentFilteredResults = [];


async function loadMap() {
  const response =
    await fetch(
      "./src/data/philosophy-map.json"
    );

  if (!response.ok) {
    throw new Error(
      "No pude cargar philosophy-map.json"
    );
  }

  return response.json();
}


function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


function renderInterpretation(
  response
) {
  const parsed =
    response.parsed;

  const items = [];


  for (
    const philosopher of
    parsed.philosophers || []
  ) {
    items.push(
      `Filósofo: ${philosopher.name}`
    );
  }


  for (
    const concept of
    parsed.concepts || []
  ) {
    items.push(
      `Concepto: ${
        concept.name_es ||
        concept.name_en ||
        concept.id
      }`
    );
  }


  for (
    const work of
    parsed.works || []
  ) {
    items.push(
      `Obra: ${work.canonicalTitle}`
    );
  }


  for (
    const area of
    parsed.areas || []
  ) {
    if (
      area.confidence < 0.40
    ) {
      continue;
    }

    items.push(
      `${
        area.name_es ||
        area.name_en ||
        area.id
      } ${
        Math.round(
          area.confidence *
          100
        )
      }%`
    );
  }


  if (!items.length) {
    interpretationEl
      .classList
      .add("hidden");

    return;
  }


  interpretationEl.innerHTML = `
    <h2>
      Interpretación de la consulta
    </h2>

    <div class="chips">
      ${items
        .map(
          item =>
            `<span class="chip">${
              escapeHtml(item)
            }</span>`
        )
        .join("")}
    </div>
  `;


  interpretationEl
    .classList
    .remove("hidden");
}


function renderStats(
  response
) {
  const stats =
    response.stats;


  statsEl.innerHTML = `
    <h2>
      Resumen
    </h2>

    <div class="stat-grid">

      <div class="stat">
        <strong>
          ${stats.unique}
        </strong>
        resultados
      </div>

      <div class="stat">
        <strong>
          ${stats.merged}
        </strong>
        apariciones fusionadas
      </div>

      <div class="stat">
        <strong>
          ${stats.multiProvider}
        </strong>
        multi-proveedor
      </div>

      <div class="stat">
        <strong>
          ${
            Object.keys(
              stats.providers
            ).length
          }
        </strong>
        fuentes
      </div>

    </div>
  `;


  statsEl
    .classList
    .remove("hidden");
}


function resultUrl(item) {
  return (
    item.urls?.openAccess ||
    item.urls?.doi ||
    item.urls?.canonical ||
    null
  );
}


function renderExplanation(
  item
) {
  const explanation =
    explainResult(
      item,
      currentParsed,
      philosophyMap
    );


  const labels = {
    query:
      "Coincidencia con la consulta",

    philosophy:
      "Relevancia filosófica",

    discipline:
      "Confianza disciplinaria",

    consensus:
      "Consenso",

    bibliography:
      "Calidad bibliográfica",

    impact:
      "Impacto"
  };


  const dimensions =
    Object.entries(
      explanation.dimensions
    )
      .map(
        ([key, value]) => `
          <div class="dimension-row">

            <span>
              ${escapeHtml(labels[key])}
            </span>

            <div class="dimension-meter">
              <span
                style="width: ${Math.max(
                  0,
                  Math.min(
                    100,
                    Number(value) || 0
                  )
                )}%"
              ></span>
            </div>

            <strong>
              ${value}
            </strong>

          </div>
        `
      )
      .join("");


  const reasons =
    explanation.reasons
      .map(
        reason => `
          <li>
            ${escapeHtml(reason)}
          </li>
        `
      )
      .join("");


  const matchedQueries =
    explanation.matchedQueries
      .map(
        match => `
          <li>
            <strong>
              ${
                Number(
                  match.weight ?? 0
                ).toFixed(2)
              }
            </strong>

            ${escapeHtml(match.query)}

            ${
              match.type
                ? `
                  <span class="query-type">
                    ${escapeHtml(match.type)}
                  </span>
                `
                : ""
            }
          </li>
        `
      )
      .join("");


  return `
    <details class="explanation">

      <summary>
        ¿Por qué aparece este resultado?
      </summary>

      <div class="explanation-body">

        <div class="explanation-score">
          <strong>
            ${explanation.score}/100
          </strong>

          <span>
            ${escapeHtml(explanation.level)}
          </span>
        </div>


        <div class="dimension-list">
          ${dimensions}
        </div>


        ${
          reasons
            ? `
              <div class="reason-block">

                <h3>
                  Evidencias principales
                </h3>

                <ul>
                  ${reasons}
                </ul>

              </div>
            `
            : ""
        }


        ${
          matchedQueries
            ? `
              <div class="reason-block">

                <h3>
                  Consultas que lo encontraron
                </h3>

                <ul class="matched-query-list">
                  ${matchedQueries}
                </ul>

              </div>
            `
            : ""
        }

      </div>

    </details>
  `;
}

function recordId(item) {
  return (
    item.doi ||
    item.id ||
    item.title
  );
}


function recordTypeLabel(
  item
) {
  const type =
    String(
      item.type || ""
    )
      .toLowerCase();


  const labels = {
    "archive-text":
      "Libro / texto digitalizado",

    "journal-article":
      "Artículo académico",

    "article":
      "Artículo académico",

    "book":
      "Libro",

    "book-chapter":
      "Capítulo de libro",

    "proceedings-article":
      "Ponencia / actas",

    "dissertation":
      "Tesis",

    "posted-content":
      "Documento académico"
  };


  return (
    labels[type] ||
    item.type ||
    "Documento"
  );
}


function recordMetadataCards(
  item
) {
  const cards = [];


  const add = (
    label,
    value
  ) => {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "—"
    ) {
      return;
    }


    cards.push(`
      <div class="cinematic-meta-card">
        <span>
          ${escapeHtml(label)}
        </span>

        <strong>
          ${escapeHtml(
            String(value)
          )}
        </strong>
      </div>
    `);
  };


  const authors =
    (item.authors || [])
      .map(
        author =>
          author.name
      )
      .filter(Boolean)
      .join(", ");


  add(
    "Autores",
    authors
  );


  if (item.journal) {
    add(
      "Revista / fuente",
      item.journal
    );
  }


  if (item.publisher) {
    add(
      "Editorial",
      item.publisher
    );
  }


  if (item.doi) {
    add(
      "DOI",
      item.doi
    );
  }


  if (
    item.isbn?.length
  ) {
    add(
      "ISBN",
      item.isbn.join(", ")
    );
  }


  /*
   * Metadatos específicos de
   * Internet Archive.
   */
  const archiveSource =
    (item.sourceRecords || [])
      .find(
        source =>
          source.provider ===
          "Internet Archive"
      );


  if (archiveSource) {
    add(
      "Identificador IA",
      archiveSource.sourceId
    );


    if (
      archiveSource.downloads !==
      null &&
      archiveSource.downloads !==
      undefined
    ) {
      add(
        "Descargas",
        Number(
          archiveSource.downloads
        ).toLocaleString("es-MX")
      );
    }


    if (
      archiveSource.collections?.length
    ) {
      add(
        "Colección",
        archiveSource.collections
          .slice(0, 3)
          .join(" · ")
      );
    }
  }


  if (
    item.providers?.length
  ) {
    add(
      "Proveedores",
      item.providers.join(" · ")
    );
  }


  return cards.join("");
}


function renderRecordDetails(
  item
) {
  const institutionalLinks =
    buildInstitutionalLinks(
      item
    );


  const authors =
    (item.authors || [])
      .map(
        author =>
          author.name
      )
      .filter(Boolean)
      .join(", ");


  const firstAuthor =
    item.authors?.[0]?.name ||
    "Filosofía";


  const authorInitial =
    firstAuthor
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "Φ";


  const language =
    effectiveLanguage(
      item
    ) ||
    item.language ||
    null;


  const providers =
    (item.providers || [])
      .join(" · ");


  const score =
    Math.max(
      0,
      Math.min(
        100,
        Number(
          item.relevanceScore
        ) || 0
      )
    );


  const level =
    item.relevanceLevel ||
    "—";


  const levelClass =
    String(level)
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      );


  const isbn =
    item.isbn?.length
      ? item.isbn.join(", ")
      : "—";


  const topics =
    (item.topics || [])
      .map(
        topic => `
          <span class="cinematic-topic">
            ${escapeHtml(
              topic.name ||
              topic.display_name ||
              String(topic)
            )}
          </span>
        `
      )
      .join("");


  const sourceRecords =
    (item.sourceRecords || [])
      .map(
        source => `
          <li>
            <span class="provenance-source">
              ${escapeHtml(
                source.provider ||
                "Fuente"
              )}
            </span>

            ${
              source.query
                ? `
                  <span>
                    ${escapeHtml(
                      source.query
                    )}
                  </span>
                `
                : ""
            }

            ${
              source.rank
                ? `
                  <span class="provenance-rank">
                    posición ${source.rank}
                  </span>
                `
                : ""
            }
          </li>
        `
      )
      .join("");


  const accessLinks = [];


  if (
    item.urls?.openAccess
  ) {
    accessLinks.push(`
      <a
        class="cinematic-action primary"
        href="${escapeHtml(
          item.urls.openAccess
        )}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="action-icon">
          ↗
        </span>

        Acceso abierto
      </a>
    `);
  }


  if (
    item.doi
  ) {
    accessLinks.push(`
      <a
        class="cinematic-action"
        href="https://doi.org/${escapeHtml(
          item.doi
        )}"
        target="_blank"
        rel="noopener noreferrer"
      >
        DOI
      </a>
    `);
  }


  if (
    item.urls?.canonical &&
    !item.urls.canonical.includes(
      "doi.org"
    )
  ) {
    accessLinks.push(`
      <a
        class="cinematic-action"
        href="${escapeHtml(
          item.urls.canonical
        )}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Registro original
      </a>
    `);
  }


  const institutionalButtons =
    institutionalLinks
      .map(
        link => `
          <a
            class="cinematic-institution-link"
            href="${escapeHtml(
              link.url
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="institution-icon">
              ${
                link.id === "ebook-central"
                  ? "▤"
                  : link.id === "britannica-udeg"
                    ? "B"
                    : link.id === "aula"
                      ? "A"
                      : "⌂"
              }
            </span>

            <span>
              ${escapeHtml(
                link.name
              )}
            </span>

            <span class="institution-arrow">
              ↗
            </span>
          </a>
        `
      )
      .join("");


  return `
    <article class="record-cinematic">

      <header class="record-cinematic-hero">

        <div
          class="record-hero-symbol"
          aria-hidden="true"
        >
          Φ
        </div>


        <div class="record-hero-content">

          <div class="record-hero-kicker">

            <span
              class="record-level-pill level-${escapeHtml(
                levelClass
              )}"
            >
              ${escapeHtml(level)}
            </span>

            <span class="record-score-pill">
              ${score}/100
            </span>

            ${
              providers
                ? `
                  <span class="record-provider-pill">
                    ${escapeHtml(
                      providers
                    )}
                  </span>
                `
                : ""
            }

          </div>


          <h2
            id="record-modal-title"
            class="record-cinematic-title"
          >
            ${escapeHtml(
              item.title ||
              "Sin título"
            )}
          </h2>


          <p class="record-cinematic-byline">
            ${
              authors
                ? escapeHtml(
                    authors
                  )
                : "Autor no disponible"
            }

            ${
              item.year
                ? ` · ${item.year}`
                : ""
            }

            ${
              item.journal
                ? ` · ${escapeHtml(
                    item.journal
                  )}`
                : ""
            }
          </p>

        </div>

      </header>


      <div class="record-cinematic-layout">

        <aside class="record-cinematic-sidebar">

          <section class="cinematic-score-card">

            <span class="score-eyebrow">
              Relevancia
            </span>

            <div class="cinematic-score-number">
              ${score}
            </div>

            <div class="cinematic-score-track">
              <span
                style="width:${score}%"
              ></span>
            </div>

            <div class="score-level">
              ${escapeHtml(level)}
            </div>

          </section>


          <section class="cinematic-author-card">

            <div class="author-orbit">

              <span class="author-initial">
                ${escapeHtml(
                  authorInitial
                )}
              </span>

            </div>

            <span class="author-card-caption">
              Archivo filosófico
            </span>

            <strong>
              ${escapeHtml(
                firstAuthor
              )}
            </strong>

          </section>


          <section class="cinematic-quick-grid">

            <div>
              <span>
                Año
              </span>

              <strong>
                ${item.year ?? "—"}
              </strong>
            </div>


            <div>
              <span>
                Idioma
              </span>

              <strong>
                ${
                  language
                    ? escapeHtml(
                        languageLabel(
                          language
                        )
                      )
                    : "—"
                }
              </strong>
            </div>


            <div>
              <span>
                Tipo
              </span>

              <strong>
                ${escapeHtml(
                  recordTypeLabel(
                    item
                  )
                )}
              </strong>
            </div>


            <div>
              <span>
                Citas
              </span>

              <strong>
                ${item.citedBy ?? "—"}
              </strong>
            </div>

          </section>

        </aside>


        <main class="record-cinematic-main">

          <section class="cinematic-section">

            <div class="cinematic-section-heading">

              <span class="section-number">
                01
              </span>

              <div>
                <span class="section-eyebrow">
                  Registro
                </span>

                <h3>
                  Ficha bibliográfica
                </h3>
              </div>

            </div>


            <div class="cinematic-metadata-grid">
              ${recordMetadataCards(item)}
            </div>

          </section>


          ${
            item.abstract
              ? `
                <section class="cinematic-section">

                  <div class="cinematic-section-heading">

                    <span class="section-number">
                      02
                    </span>

                    <div>
                      <span class="section-eyebrow">
                        Lectura
                      </span>

                      <h3>
                        Resumen
                      </h3>
                    </div>

                  </div>

                  <div class="cinematic-abstract">
                    ${escapeHtml(
                      item.abstract
                    )}
                  </div>

                </section>
              `
              : ""
          }


          ${
            topics
              ? `
                <section class="cinematic-section">

                  <div class="cinematic-section-heading">

                    <span class="section-number">
                      03
                    </span>

                    <div>
                      <span class="section-eyebrow">
                        Clasificación
                      </span>

                      <h3>
                        Temas
                      </h3>
                    </div>

                  </div>


                  <div class="cinematic-topics">
                    ${topics}
                  </div>

                </section>
              `
              : ""
          }


          ${
            accessLinks.length
              ? `
                <section class="cinematic-section">

                  <div class="cinematic-section-heading">

                    <span class="section-number">
                      04
                    </span>

                    <div>
                      <span class="section-eyebrow">
                        Documento
                      </span>

                      <h3>
                        Acceso
                      </h3>
                    </div>

                  </div>


                  <div class="cinematic-actions">
                    ${accessLinks.join("")}
                  </div>

                </section>
              `
              : ""
          }


          ${
            institutionalButtons
              ? `
                <section class="cinematic-section institutional-cinematic">

                  <div class="cinematic-section-heading">

                    <span class="section-number">
                      05
                    </span>

                    <div>
                      <span class="section-eyebrow">
                        Colecciones licenciadas
                      </span>

                      <h3>
                        Biblioteca UdeG
                      </h3>
                    </div>

                  </div>


                  <p class="cinematic-note">
                    La búsqueda se abre en otra pestaña.
                    Si tu sesión institucional está activa,
                    el navegador reutilizará el acceso.
                  </p>


                  <div class="cinematic-institution-grid">
                    ${institutionalButtons}
                  </div>

                </section>
              `
              : ""
          }


          ${
            sourceRecords
              ? `
                <section class="cinematic-section">

                  <div class="cinematic-section-heading">

                    <span class="section-number">
                      06
                    </span>

                    <div>
                      <span class="section-eyebrow">
                        Trazabilidad
                      </span>

                      <h3>
                        Procedencia bibliográfica
                      </h3>
                    </div>

                  </div>


                  <ul class="cinematic-provenance">
                    ${sourceRecords}
                  </ul>

                </section>
              `
              : ""
          }


          <section class="cinematic-section explanation-cinematic">

            <div class="cinematic-section-heading">

              <span class="section-number">
                07
              </span>

              <div>
                <span class="section-eyebrow">
                  Motor de relevancia
                </span>

                <h3>
                  Por qué aparece
                </h3>
              </div>

            </div>

            ${renderExplanation(item)}

          </section>

        </main>

      </div>

    </article>
  `;
}


function openRecord(
  item
) {
  recordModalContent.innerHTML =
    renderRecordDetails(item);

  recordModal
    .classList
    .remove("hidden");

  document.body
    .classList
    .add("modal-open");
}


function closeRecord() {
  recordModal
    .classList
    .add("hidden");

  recordModalContent.innerHTML =
    "";

  document.body
    .classList
    .remove("modal-open");
}

function renderResult(
  item,
  index
) {
  const institutionalLinks =
    buildInstitutionalLinks(
      item
    );


  const authors =
    (item.authors || [])
      .map(
        author =>
          author.name
      )
      .join(", ");


  const firstAuthor =
    item.authors?.[0]?.name ||
    "";


  const authorInitial =
    firstAuthor
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "Φ";


  const url =
    resultUrl(item);


  const doi =
    item.doi
      ? `https://doi.org/${item.doi}`
      : null;


  const language =
    effectiveLanguage(
      item
    );


  const abstract =
    String(
      item.abstract || ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  const abstractPreview =
    abstract.length > 230
      ? `${abstract.slice(
          0,
          227
        )}…`
      : abstract;


  const score =
    Math.max(
      0,
      Math.min(
        100,
        Number(
          item.relevanceScore
        ) || 0
      )
    );


  return `
    <article
      class="result-card"
      data-rank="${index + 1}"
    >

      <div
        class="result-visual"
        aria-hidden="true"
      >
        <span class="result-rank">
          ${index + 1}
        </span>

        <span class="result-initial">
          ${escapeHtml(
            authorInitial
          )}
        </span>

        <span class="result-visual-caption">
          Archivo filosófico
        </span>
      </div>


      <div class="result-content">

        <div class="result-title-row">

          <span class="relevance-pill">
            ${escapeHtml(
              item.relevanceLevel
            )}
          </span>

          <h2>
            ${escapeHtml(
              item.title
            )}
          </h2>

        </div>


        <p class="meta">
          ${
            authors
              ? escapeHtml(
                  authors
                )
              : "Autor no disponible"
          }

          ${
            item.year
              ? ` · ${item.year}`
              : ""
          }

          ${
            item.journal
              ? ` · ${escapeHtml(
                  item.journal
                )}`
              : ""
          }
        </p>


        ${
          abstractPreview
            ? `
              <p class="result-abstract">
                ${escapeHtml(
                  abstractPreview
                )}
              </p>
            `
            : ""
        }


        <div class="provider-row">

          ${
            (item.providers || [])
              .map(
                provider => `
                  <span class="provider">
                    ${escapeHtml(
                      provider
                    )}
                  </span>
                `
              )
              .join("")
          }

          ${
            language
              ? `
                <span class="provider">
                  ${escapeHtml(
                    languageLabel(
                      language
                    )
                  )}
                </span>
              `
              : ""
          }

          ${
            item.openAccess?.isOpen
              ? `
                <span class="provider">
                  Acceso abierto
                </span>
              `
              : ""
          }

        </div>


        <div class="result-links">

          <button
            type="button"
            class="record-open"
            data-record-id="${escapeHtml(
              recordId(item)
            )}"
          >
            Ver ficha
          </button>


          ${
            institutionalLinks
              .map(
                link => `
                  <a
                    class="institutional-card-link"
                    href="${escapeHtml(
                      link.url
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ${escapeHtml(
                      link.name
                    )} ↗
                  </a>
                `
              )
              .join("")
          }


          ${
            url
              ? `
                <a
                  class="result-secondary-link"
                  href="${escapeHtml(
                    url
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir
                </a>
              `
              : ""
          }


          ${
            doi
              ? `
                <a
                  class="result-secondary-link"
                  href="${escapeHtml(
                    doi
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  DOI
                </a>
              `
              : ""
          }

        </div>


        <div class="explain">
          Q ${item.ranking.query}
          ·
          P ${item.ranking.philosophy}
          ·
          D ${item.ranking.discipline}
          ·
          S ${item.ranking.consensus}
          ·
          B ${item.ranking.bibliography}
          ·
          I ${item.ranking.impact}
        </div>


        ${renderExplanation(item)}

      </div>


      <aside class="score-panel">

        <div class="score">
          ${score}
        </div>

        <span>
          Relevancia
        </span>

        <div class="score-meter">
          <i
            style="width:${score}%"
          ></i>
        </div>

      </aside>

    </article>
  `;
}


function uniqueSorted(
  values
) {
  return [
    ...new Set(
      values.filter(Boolean)
    )
  ].sort(
    (a, b) =>
      String(a).localeCompare(
        String(b),
        "es"
      )
  );
}


function downloadTextFile(
  filename,
  content,
  mimeType
) {
  const blob =
    new Blob(
      [content],
      {
        type: mimeType
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    url;

  link.download =
    filename;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url
  );
}


function exportFilename(
  extension
) {
  const query =
    currentResponse?.query ||
    "resultados";

  const safe =
    normalizeFilename(
      query
    );

  return `${safe}.${extension}`;
}


function normalizeFilename(
  value
) {
  return String(value || "resultados")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-zA-Z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )
    .toLowerCase()
    || "resultados";
}


function exportJson() {
  const payload = {
    query:
      currentResponse?.query ||
      null,

    exportedAt:
      new Date()
        .toISOString(),

    count:
      currentFilteredResults.length,

    results:
      currentFilteredResults
  };


  downloadTextFile(
    exportFilename(
      "json"
    ),

    JSON.stringify(
      payload,
      null,
      2
    ),

    "application/json;charset=utf-8"
  );
}


function csvEscape(value) {
  if (
    value == null
  ) {
    return "";
  }

  const text =
    String(value);

  if (
    /[",\n]/.test(text)
  ) {
    return `"${text.replaceAll(
      '"',
      '""'
    )}"`;
  }

  return text;
}


function exportCsv() {
  const headers = [
    "title",
    "authors",
    "year",
    "type",
    "language",
    "doi",
    "isbn",
    "journal",
    "publisher",
    "citedBy",
    "openAccess",
    "providers",
    "relevanceScore",
    "relevanceLevel"
  ];


  const rows =
    currentFilteredResults
      .map(item => [
        item.title,

        (item.authors || [])
          .map(
            author =>
              author.name
          )
          .join("; "),

        item.year,

        item.type,

        item.language,

        item.doi,

        (item.isbn || [])
          .join("; "),

        item.journal,

        item.publisher,

        item.citedBy,

        item.openAccess?.isOpen
          ? "yes"
          : "no",

        (item.providers || [])
          .join("; "),

        item.relevanceScore,

        item.relevanceLevel
      ]);


  const csv = [
    headers,
    ...rows
  ]
    .map(
      row =>
        row
          .map(csvEscape)
          .join(",")
    )
    .join("\n");


  downloadTextFile(
    exportFilename(
      "csv"
    ),

    "\uFEFF" + csv,

    "text/csv;charset=utf-8"
  );
}


function bibtexKey(
  item,
  index
) {
  const author =
    item.authors?.[0]?.name
      ?.split(" ")
      .at(-1)
      || "anon";

  const year =
    item.year ||
    "nd";

  return normalizeFilename(
    `${author}-${year}-${index + 1}`
  )
    .replaceAll(
      "-",
      ""
    );
}


function bibtexEscape(
  value
) {
  return String(
    value || ""
  )
    .replaceAll(
      "{",
      "\\{"
    )
    .replaceAll(
      "}",
      "\\}"
    );
}


function exportBibtex() {
  const entries =
    currentFilteredResults
      .map(
        (item, index) => {

          const type =
            item.type === "book"
              ? "book"
              : (
                  item.type === "book-chapter"
                  ||
                  item.type === "book-chapter"
                  ||
                  item.type === "proceedings-article"
                    ? "incollection"
                    : "article"
                );


          const fields = [];


          fields.push(
            `  title = {${bibtexEscape(item.title)}}`
          );


          if (
            item.authors?.length
          ) {
            fields.push(
              `  author = {${bibtexEscape(
                item.authors
                  .map(
                    author =>
                      author.name
                  )
                  .join(" and ")
              )}}`
            );
          }


          if (item.year) {
            fields.push(
              `  year = {${item.year}}`
            );
          }


          if (item.journal) {
            fields.push(
              `  journal = {${bibtexEscape(item.journal)}}`
            );
          }


          if (item.publisher) {
            fields.push(
              `  publisher = {${bibtexEscape(item.publisher)}}`
            );
          }


          if (item.doi) {
            fields.push(
              `  doi = {${bibtexEscape(item.doi)}}`
            );
          }


          if (
            item.isbn?.length
          ) {
            fields.push(
              `  isbn = {${bibtexEscape(
                item.isbn.join(", ")
              )}}`
            );
          }


          if (
            item.urls?.canonical
          ) {
            fields.push(
              `  url = {${bibtexEscape(
                item.urls.canonical
              )}}`
            );
          }


          return `@${type}{${bibtexKey(
            item,
            index
          )},
${fields.join(",\n")}
}`;
        }
      )
      .join("\n\n");


  downloadTextFile(
    exportFilename(
      "bib"
    ),

    entries,

    "application/x-bibtex;charset=utf-8"
  );
}


function exportResults(
  format
) {
  if (
    !currentFilteredResults.length
  ) {
    return;
  }


  if (
    format === "json"
  ) {
    exportJson();
  }


  if (
    format === "csv"
  ) {
    exportCsv();
  }


  if (
    format === "bibtex"
  ) {
    exportBibtex();
  }
}

function languageLabel(
  code
) {
  const labels = {
    es: "Español",
    en: "English",
    it: "Italiano",
    nl: "Nederlands",
    fr: "Français",
    de: "Deutsch",
    pt: "Português",
    ca: "Català",
    la: "Latín"
  };

  return labels[code] ||
    String(code).toUpperCase();
}


function renderFilters(
  results
) {
  const detectedLanguages =

    uniqueSorted(
      results.map(
        item =>
          effectiveLanguage(
            item
          )
      )
    );


  const languages =

    uniqueSorted([

      "es",

      "en",

      ...detectedLanguages

    ])

  const providers =
    uniqueSorted(
      results.flatMap(
        item =>
          item.providers || []
      )
    );

  const types =
    uniqueSorted(
      results.map(
        item =>
          item.type
      )
    );


  filtersEl.innerHTML = `
    <h2>
      Filtros
    </h2>

    <div class="filter-grid">

      <label>
        Relevancia

        <select id="filter-level">
          <option value="">
            Todas
          </option>
          <option value="P1">
            P1
          </option>
          <option value="P2">
            P2
          </option>
          <option value="P3">
            P3
          </option>
          <option value="P4">
            P4
          </option>
        </select>
      </label>


      <label>
        Año desde

        <input
          id="filter-year-from"
          type="number"
          inputmode="numeric"
          placeholder="1900"
        >
      </label>


      <label>
        Año hasta

        <input
          id="filter-year-to"
          type="number"
          inputmode="numeric"
          placeholder="2026"
        >
      </label>


      <label>
        Idioma

        <select id="filter-language">
          <option value="">
            Todos
          </option>

          ${languages
            .map(
              value => `
                <option value="${escapeHtml(value)}">
                  ${escapeHtml(
                    languageLabel(value)
                  )}
                </option>
              `
            )
            .join("")}
        </select>
      </label>


      <label>
        Fuente

        <select id="filter-provider">
          <option value="">
            Todas
          </option>

          ${providers
            .map(
              value => `
                <option value="${escapeHtml(value)}">
                  ${escapeHtml(value)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>


      <label>
        Tipo

        <select id="filter-type">
          <option value="">
            Todos
          </option>

          ${types
            .map(
              value => `
                <option value="${escapeHtml(value)}">
                  ${escapeHtml(value)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label>
        Ordenar por

        <select id="filter-sort">
          <option value="relevance">
            Relevancia
          </option>

          <option value="year-desc">
            Año: más reciente
          </option>

          <option value="year-asc">
            Año: más antiguo
          </option>

          <option value="citations">
            Citas
          </option>
        </select>
      </label>


      <label class="filter-check">
        <input
          id="filter-open-access"
          type="checkbox"
        >

        Sólo acceso abierto
      </label>


      <button
        id="filter-reset"
        type="button"
        class="filter-reset"
      >
        Limpiar filtros
      </button>

      <div class="export-actions">

        <button
          type="button"
          class="export-button"
          data-export="json"
        >
          Exportar JSON
        </button>

        <button
          type="button"
          class="export-button"
          data-export="csv"
        >
          Exportar CSV
        </button>

        <button
          type="button"
          class="export-button"
          data-export="bibtex"
        >
          Exportar BibTeX
        </button>

      </div>

    </div>

    <div
      id="filter-count"
      class="filter-count"
    ></div>
  `;


  filtersEl
    .classList
    .remove("hidden");


  filtersEl
    .querySelectorAll(
      "select, input"
    )
    .forEach(element => {
      element.addEventListener(
        "input",
        applyFilters
      );

      element.addEventListener(
        "change",
        applyFilters
      );
    });


  document
    .querySelector(
      "#filter-reset"
    )
    .addEventListener(
      "click",
      resetFilters
    );


  filtersEl
    .querySelectorAll(
      "[data-export]"
    )
    .forEach(
      button =>
        button.addEventListener(
          "click",
          () =>
            exportResults(
              button.dataset.export
            )
        )
    );


  applyFilters();
}


function getFilterValue(id) {
  return (
    document
      .querySelector(id)
      ?.value ||
    ""
  );
}


function applyFilters() {
  if (!currentResults.length) {
    return;
  }


  const level =
    getFilterValue(
      "#filter-level"
    );

  const language =
    getFilterValue(
      "#filter-language"
    );

  const provider =
    getFilterValue(
      "#filter-provider"
    );

  const type =
    getFilterValue(
      "#filter-type"
    );

  const sort =
    getFilterValue(
      "#filter-sort"
    ) || "relevance";

  const from =
    Number(
      getFilterValue(
        "#filter-year-from"
      )
    );

  const to =
    Number(
      getFilterValue(
        "#filter-year-to"
      )
    );

  const onlyOA =
    Boolean(
      document
        .querySelector(
          "#filter-open-access"
        )
        ?.checked
    );


  let filtered =
    currentResults.filter(
      item => {

        if (
          level &&
          item.relevanceLevel !== level
        ) {
          return false;
        }


        if (
          language &&
          effectiveLanguage(
            item
          ) !== language
        ) {
          return false;
        }


        if (
          provider &&
          !(
            item.providers || []
          ).includes(provider)
        ) {
          return false;
        }


        if (
          type &&
          item.type !== type
        ) {
          return false;
        }


        if (
          Number.isFinite(from) &&
          from > 0 &&
          (
            !item.year ||
            item.year < from
          )
        ) {
          return false;
        }


        if (
          Number.isFinite(to) &&
          to > 0 &&
          (
            !item.year ||
            item.year > to
          )
        ) {
          return false;
        }


        if (
          onlyOA &&
          !item.openAccess?.isOpen
        ) {
          return false;
        }


        return true;
      }
    );


  filtered =
    [...filtered];


  if (
    sort === "year-desc"
  ) {
    filtered.sort(
      (a, b) =>
        (b.year || 0) -
        (a.year || 0)
    );
  }


  if (
    sort === "year-asc"
  ) {
    filtered.sort(
      (a, b) =>
        (a.year || 9999) -
        (b.year || 9999)
    );
  }


  if (
    sort === "citations"
  ) {
    filtered.sort(
      (a, b) =>
        (b.citedBy || 0) -
        (a.citedBy || 0)
    );
  }


  if (
    sort === "relevance"
  ) {
    filtered.sort(
      (a, b) =>
        b.relevanceScore -
        a.relevanceScore
    );
  }


  resetVisibleLimit();

  currentFilteredResults =
    filtered;


  renderFilteredResults();


  const countEl =
    document.querySelector(
      "#filter-count"
    );


  if (countEl) {
    countEl.textContent =
      `${filtered.length} de ${currentResults.length} resultados`;
  }
}


function fetchMoreButton(
  position
) {
  return `
    <div class="fetch-more-wrap ${position}">
      <button
        type="button"
        class="fetch-more"
      >
        Cargar más resultados
      </button>

      <span>
        Buscar la siguiente página
        en OpenAlex y Crossref
      </span>
    </div>
  `;
}

function bindResultActions() {
  document
    .querySelectorAll(
      ".record-open"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const id =
              button.dataset.recordId;

            const item =
              currentFilteredResults
                .find(
                  result =>
                    String(
                      recordId(result)
                    ) === id
                );

            if (item) {
              openRecord(item);
            }
          }
        );
      }
    );
}

function renderFilteredResults() {
  const visible =
    currentFilteredResults
      .slice(
        0,
        visibleLimit
      );


  const errorHtml =
    currentResponse?.errors?.length
      ? renderErrors(
          currentResponse.errors
        )
      : "";


  resultsEl.innerHTML =
    errorHtml +
    fetchMoreButton("top") +
    visible
      .map(
        renderResult
      )
      .join("");


  if (
    currentFilteredResults.length >
    visibleLimit
  ) {
    resultsEl.insertAdjacentHTML(
      "beforeend",
      `
        <div class="load-more-wrap">

          <button
            id="load-more"
            type="button"
            class="load-more"
          >
            Mostrar más
          </button>

          <span>
            Mostrando ${visible.length}
            de ${currentFilteredResults.length}
          </span>

        </div>
      `
    );


    document
      .querySelector(
        "#load-more"
      )
      ?.addEventListener(
        "click",
        () => {
          visibleLimit += 20;
          renderFilteredResults();
        }
      );
  } else if (
    currentFilteredResults.length
  ) {
    resultsEl.insertAdjacentHTML(
      "beforeend",
      `
        <div class="load-more-wrap">
          <span>
            Mostrando todos los
            ${currentFilteredResults.length}
            resultados cargados
          </span>
        </div>
      `
    );
  }


  resultsEl.insertAdjacentHTML(
    "beforeend",
    fetchMoreButton("bottom")
  );


  document
    .querySelectorAll(
      ".fetch-more"
    )
    .forEach(
      button =>
        button.addEventListener(
          "click",
          loadMoreResults
        )
    );


  bindResultActions();
}


function resetVisibleLimit() {
  visibleLimit = 20;
}

function resetFilters() {
  const ids = [
    "#filter-level",
    "#filter-year-from",
    "#filter-year-to",
    "#filter-language",
    "#filter-provider",
    "#filter-type",
    "#filter-sort"
  ];


  for (const id of ids) {
    const element =
      document.querySelector(id);

    if (element) {
      element.value = "";
    }
  }


  const oa =
    document.querySelector(
      "#filter-open-access"
    );

  if (oa) {
    oa.checked = false;
  }


  applyFilters();
}

function renderResults(
  response
) {
  if (
    !response.results.length
  ) {
    resultsEl.innerHTML = `
      <div class="result-card">
        No se encontraron resultados.
      </div>
    `;

    return;
  }


  resultsEl.innerHTML =
    response.results
      .slice(0, 30)
      .map(
        renderResult
      )
      .join("");
}


function renderErrors(
  errors
) {
  if (!errors.length) {
    return "";
  }


  const openAlexLimited =
    errors.filter(
      error =>
        error.provider ===
          "OpenAlex" &&
        /429|temporalmente limitado/i
          .test(
            error.message ||
            ""
          )
    );


  const otherErrors =
    errors.filter(
      error =>
        !openAlexLimited.includes(
          error
        )
    );


  const notices = [];


  if (
    openAlexLimited.length
  ) {
    notices.push(`
      <div
        class="source-notice source-notice-openalex"
        role="status"
      >

        <div class="source-notice-icon">
          OA
        </div>


        <div class="source-notice-copy">

          <div class="source-notice-heading">

            <strong>
              OpenAlex está temporalmente en pausa
            </strong>

            <span class="source-status-pill">
              Límite gratuito temporal
            </span>

          </div>


          <p>
            La búsqueda continúa con Crossref.
            Los accesos institucionales siguen
            disponibles en las fichas.
          </p>

        </div>

      </div>
    `);
  }


  if (
    otherErrors.length
  ) {
    const items =
      otherErrors
        .map(
          error => `
            <li>
              <strong>
                ${escapeHtml(
                  error.provider
                )}
              </strong>

              ${
                error.query
                  ? `
                    <span>
                      · ${escapeHtml(
                        error.query
                      )}
                    </span>
                  `
                  : ""
              }

              <code>
                ${escapeHtml(
                  error.message
                )}
              </code>
            </li>
          `
        )
        .join("");


    notices.push(`
      <details class="source-error-details">

        <summary>
          ${
            otherErrors.length === 1
              ? "Una fuente no respondió"
              : `${otherErrors.length} fuentes no respondieron`
          }
        </summary>

        <p>
          Los resultados disponibles se
          muestran normalmente.
        </p>

        <ul>
          ${items}
        </ul>

      </details>
    `);
  }


  return `
    <div class="source-notices">
      ${notices.join("")}
    </div>
  `;
}


async function loadMoreResults() {
  if (
    !currentResponse ||
    !philosophyMap
  ) {
    return;
  }


  const buttons =
    document.querySelectorAll(
      ".fetch-more"
    );


  buttons.forEach(
    button => {
      button.disabled = true;
      button.textContent =
        "Buscando más…";
    }
  );


  status.textContent =
    "Buscando más literatura…";


  try {
    const depth =
      Number(
        document.querySelector(
          "#search-depth"
        )?.value || 12
      );

    const response =
      await searchMorePhilosophy(
        currentResponse,
        philosophyMap,
        {
          signal:
            currentController?.signal,

          openAlex: {
            perPage:
              depth
          },

          crossref: {
            rows:
              depth
          },

          onProgress(progress) {
            status.textContent =
              `Ampliando ${progress.completed}/${progress.total}: ` +
              `${progress.expansion.query}`;
          }
        }
      );


    currentResponse =
      response;

    currentResults =
      response.results;

    /*
     * Al cargar nuevas páginas mostramos
     * de inmediato más registros.
     */
    visibleLimit += 20;


    renderStats(
      response
    );


    /*
     * Conservamos los controles.
     * applyFilters utilizará ahora el
     * conjunto ampliado.
     */
    applyFilters();


    status.textContent =
      `${response.stats.unique} resultados únicos · lote ${response.pagination.batch}`;

  } catch (error) {
    if (
      error.name ===
      "AbortError"
    ) {
      return;
    }


    console.error(error);

    status.textContent =
      `No se pudieron cargar más resultados: ${error.message}`;

  } finally {
    document
      .querySelectorAll(
        ".fetch-more"
      )
      .forEach(
        button => {
          button.disabled = false;
          button.textContent =
            "Cargar más resultados";
        }
      );
  }
}

async function runSearch(
  query
) {
  if (!philosophyMap) {
    return;
  }


  if (currentController) {
    currentController.abort();
  }


  currentController =
    new AbortController();


  button.disabled =
    true;

  resultsEl.innerHTML =
    "";

  interpretationEl
    .classList
    .add("hidden");

  statsEl
    .classList
    .add("hidden");

  filtersEl
    .classList
    .add("hidden");


  status.textContent =
    "Interpretando consulta…";


  try {
    const depth =
      Number(
        document.querySelector(
          "#search-depth"
        )?.value || 12
      );

    const response =
      await searchPhilosophy(
        query,
        philosophyMap,
        {
          signal:
            currentController.signal,

          maxQueries:
            5,

          openAlex: {
            perPage:
              depth
          },

          crossref: {
            rows:
              depth
          },

          onProgress(progress) {
            status.textContent =
              `Buscando ${progress.completed}/${progress.total}: ` +
              `${progress.expansion.query}`;
          }
        }
      );


    currentParsed =
      response.parsed;

    currentResponse =
      response;

    currentResults =
      response.results;

    resetVisibleLimit();

    if (response.errors.length) {
      console.warn(
        "Errores de fuentes:",
        response.errors
      );
    }

    renderInterpretation(
      response
    );

    renderStats(
      response
    );

    renderFilters(
      response.results
    );


    status.textContent =
      `${response.stats.unique} resultados únicos`;
  } catch (error) {

    if (
      error.name ===
      "AbortError"
    ) {
      return;
    }


    console.error(error);


    status.textContent =
      "La búsqueda no pudo completarse.";


    resultsEl.innerHTML = `
      <div class="error">
        ${escapeHtml(
          error.message
        )}
      </div>
    `;
  } finally {

    button.disabled =
      false;
  }
}


form.addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const query =
      input.value.trim();

    if (!query) {
      return;
    }

    runSearch(query);
  }
);


try {
  philosophyMap =
    await loadMap();

  status.textContent =
    "";
} catch (error) {
  console.error(error);

  status.textContent =
    "No se pudo iniciar el motor.";
}


recordModal
  ?.addEventListener(
    "click",
    event => {
      if (
        event.target
          .closest(
            "[data-close-record]"
          )
      ) {
        closeRecord();
      }
    }
  );


document.addEventListener(
  "keydown",
  event => {
    if (
      event.key ===
      "Escape" &&
      !recordModal
        .classList
        .contains("hidden")
    ) {
      closeRecord();
    }
  }
);

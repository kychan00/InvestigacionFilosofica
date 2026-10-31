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
} from "../src/core/search-engine.js?v=20261030-crossref-work-hygiene-v2";

import {
  explainResult
} from "../src/core/explain.js";

import {
  parseQuery
} from "../src/core/parser.js";

import {
  checkPublicSemanticHealth,
  searchPublicSemantic
} from "../src/core/semantic-api.js";

import {
  augmentWithAuthorResolution,
  buildExclusiveAuthorResponse,
  enrichResultsWithRemoteAuthors,
  resolveRemoteAuthor,
  resolveRemoteAuthors,
  resolveRemoteAuthorCandidate
} from "../src/core/remote-author-resolution.js?v=20261029-author-reliability-v1";

import {
  summarizeAuthorCorpus
} from "../src/core/author-page.js?v=20261029-author-reliability-v1";

import {
  resolveFederatedAuthor
} from "../src/core/crossref-author-fallback.js?v=20261029-universal-author-v1";

import {
  openAuthorDestination,
  shouldHandleAuthorLinkClick
} from "../src/core/author-navigation.js?v=20261029-mobile-author-links-v1";

import {
  combineSemanticWithFederated
} from "../src/core/semantic-federation.js";

import {
  isQwen3BrowserQ8OptIn,
  rerankTopKByQwen3BrowserQ8,
  selectQwen3BrowserQ8Candidates
} from "../src/ai/qwen3-browser-q8-contract.js";


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

const searchModeButtons =
  document.querySelectorAll(
    "[data-search-mode]"
  );

const searchModeNote =
  document.querySelector(
    "#search-mode-note"
  );

const searchEngineIndicator =
  document.querySelector(
    "#search-engine-indicator"
  );

const semanticAvailabilityText =
  document.querySelector(
    "#semantic-availability-text"
  );

const activeEngineText =
  document.querySelector(
    "#active-engine-text"
  );

const qwen3Experiment =
  document.querySelector(
    "#qwen3-experiment"
  );

const qwen3Start =
  document.querySelector(
    "#qwen3-start"
  );

const qwen3Cancel =
  document.querySelector(
    "#qwen3-cancel"
  );

const qwen3Progress =
  document.querySelector(
    "#qwen3-progress"
  );

const resultsEl =
  document.querySelector(
    "#results"
  );

const researchWorkspace =
  document.querySelector(
    "#research-workspace"
  );

const interpretationEl =
  document.querySelector(
    "#interpretation"
  );

const authorIdentityEl =
  document.querySelector(
    "#author-identity"
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


const udegModal =
  document.querySelector(
    "#udeg-modal"
  );

const udegModalContent =
  document.querySelector(
    "#udeg-modal-content"
  );


let philosophyMap = null;
let currentController = null;
let currentParsed = null;
let currentResults = [];
let currentResponse = null;

let visibleLimit = 20;
let currentFilteredResults = [];
let authorSourceSearch = null;

const qwen3OptIn =
  isQwen3BrowserQ8OptIn(
    window.location.search
  );

let qwen3Controller = null;
let qwen3ScorerPromise = null;
let currentQwen3Order = null;
let currentSearchQuery = "";
let selectedSearchMode =
  "federated";

let semanticAvailability =
  "checking";
let semanticDocumentCount =
  null;
let semanticAvailabilityCheckedAt =
  0;
let activeEngine = {
  mode:
    "federated",
  phase:
    "selected",
  fallback:
    false
};


function resolveAuthorForQuery(
  query,
  signal
) {
  const parsed = parseQuery(
    query,
    philosophyMap
  );

  return resolveRemoteAuthors(
    query,
    {
      signal,
      canonicalNames:
        (parsed.philosophers || [])
          .map(item => item.name)
    }
  );
}


function renderSearchEngineIndicator() {
  searchEngineIndicator.dataset
    .semanticStatus =
      semanticAvailability;

  if (
    semanticAvailability ===
    "available"
  ) {
    semanticAvailabilityText
      .textContent =
        `Semántica disponible · ${Number(
          semanticDocumentCount
        ).toLocaleString("es-MX")} docs`;
  } else if (
    semanticAvailability ===
    "unavailable"
  ) {
    semanticAvailabilityText
      .textContent =
        "Semántica no disponible";
  } else {
    semanticAvailabilityText
      .textContent =
        "Comprobando búsqueda semántica…";
  }

  const engineLabel =
    activeEngine.mode ===
    "semantic"
      ? "semántico por servicio"
      : "tradicional";

  const phaseLabel = {
    selected:
      "Motor seleccionado",
    working:
      "Motor activo",
    completed:
      "Motor usado"
  }[activeEngine.phase] ||
    "Motor seleccionado";

  activeEngineText.textContent =
    `${phaseLabel}: ${engineLabel}` +
    (
      activeEngine.fallback
        ? " · respaldo automático"
        : ""
    );
}


function setActiveEngine(
  mode,
  phase,
  {
    fallback = false,
    backend = null
  } = {}
) {
  activeEngine = {
    mode:
      mode === "semantic"
        ? "semantic"
        : "federated",
    phase,
    fallback,
    backend
  };

  renderSearchEngineIndicator();
}


async function refreshSemanticAvailability(
  {
    force = false
  } = {}
) {
  const now =
    Date.now();

  if (
    !force &&
    now -
      semanticAvailabilityCheckedAt <
      30000
  ) {
    return;
  }

  semanticAvailability =
    "checking";
  renderSearchEngineIndicator();

  const controller =
    new AbortController();

  const timeout =
    window.setTimeout(
      () => {
        controller.abort();
      },
      3500
    );

  try {
    const health =
      await checkPublicSemanticHealth({
        signal:
          controller.signal
      });

    semanticAvailability =
      "available";
    semanticDocumentCount =
      health.documents;
  } catch {
    semanticAvailability =
      "unavailable";
    semanticDocumentCount =
      null;
  } finally {
    window.clearTimeout(
      timeout
    );

    semanticAvailabilityCheckedAt =
      Date.now();

    renderSearchEngineIndicator();
  }
}


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
    response.parsed || {};

  const items = [];


  if (
    response.authorResolution?.status ===
    "resolved"
  ) {
    items.push(
      `Autor identificado: ${response.authorResolution.author.displayName}`
    );
  }

  if (
    response.authorResolution?.status ===
    "multiple"
  ) {
    for (
      const identity of
      response.authorResolution.identities || []
    ) {
      if (identity.status === "resolved") {
        items.push(
          `Autor identificado: ${identity.author.displayName}`
        );
      }
    }
  }


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


  if (
    response.searchMode ===
    "semantic"
  ) {
    statsEl.innerHTML = `
      <h2>
        Resumen semántico
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
            ${response.semantic.candidateCount || "—"}
          </strong>
          candidatos comparados
        </div>

        <div class="stat">
          <strong>
            451.823
          </strong>
          documentos indexados
        </div>

        <div class="stat">
          <strong>
            No
          </strong>
          reranker aplicado
        </div>

      </div>
    `;


    statsEl
      .classList
      .remove("hidden");

    return;
  }


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
    item.urls?.landing ||
    item.url ||
    null
  );
}


function renderSemanticExplanation(
  item
) {
  const score =
    Number.isFinite(
      item.semanticScore
    )
      ? item.semanticScore
        .toFixed(4)
      : "—";

  return `
    <details class="explanation">

      <summary>
        ¿Por qué aparece este resultado?
      </summary>

      <div class="explanation-body">

        <div class="explanation-score">
          <strong>
            ${item.relevanceScore}/100
          </strong>

          <span>
            Similitud semántica
          </span>
        </div>

        <div class="reason-block">
          <h3>
            Recuperación sobre corpus propio
          </h3>

          <ul>
            <li>
              Qwen3-Embedding comparó el sentido de la consulta con el contenido normalizado del documento.
            </li>

            <li>
              El índice FAISS devolvió este documento entre los vecinos semánticos más próximos.
            </li>

            <li>
              Score coseno normalizado: ${escapeHtml(score)}. No es una probabilidad ni un juicio humano de relevancia.
            </li>

            <li>
              No se aplicó reranker ni modelo generativo.
            </li>
          </ul>
        </div>

      </div>

    </details>
  `;
}


function renderExplanation(
  item
) {
  if (
    item.retrievalMode ===
    "semantic"
  ) {
    return renderSemanticExplanation(
      item
    );
  }

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
    institutionalLinks.length
      ? `
          <button
            type="button"
            class="cinematic-institution-link udeg-open-detail"
            data-record-id="${escapeHtml(
              recordId(item)
            )}"
          >
            <span class="institution-icon">
              ⌂
            </span>

            <span>
              Abrir Biblioteca Virtual UdeG
            </span>

            <span class="institution-arrow">
              ↗
            </span>
          </button>
        `
      : "";


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
              ${
                item.retrievalMode ===
                  "semantic"
                  ? "Similitud"
                  : "Relevancia"
              }
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
                  ${
                    item.retrievalMode ===
                      "semantic"
                      ? "Recuperación semántica"
                      : "Motor de relevancia"
                  }
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


  recordModalContent
    .querySelector(
      ".udeg-open-detail"
    )
    ?.addEventListener(
      "click",
      () => {
        closeRecord();

        openUdegPopup(
          item
        );
      }
    );
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

function institutionalSourceIcon(
  id
) {
  if (
    id === "ebook-central"
  ) {
    return "▤";
  }

  if (
    id === "britannica-udeg"
  ) {
    return "B";
  }

  if (
    id === "aula"
  ) {
    return "A";
  }

  return "⌂";
}


function institutionalSourceDescription(
  id
) {
  const descriptions = {
    "udeg-summon":
      "Buscador general de la Biblioteca Virtual UdeG.",

    "ebook-central":
      "Libros electrónicos académicos disponibles mediante ProQuest.",

    "britannica-udeg":
      "Enciclopedia académica y artículos de referencia en inglés.",

    "aula":
      "Obras de consulta y contenidos de referencia en español."
  };


  return (
    descriptions[id] ||
    "Recurso disponible mediante la Biblioteca Virtual UdeG."
  );
}


function renderUdegPopup(
  item
) {
  const links =
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


  const resources =
    links
      .map(
        link => `
          <a
            class="udeg-resource-card"
            href="${escapeHtml(
              link.url
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span
              class="udeg-resource-icon"
              aria-hidden="true"
            >
              ${escapeHtml(
                institutionalSourceIcon(
                  link.id
                )
              )}
            </span>

            <span class="udeg-resource-copy">
              <strong>
                ${escapeHtml(
                  link.name
                )}
              </strong>

              <span>
                ${escapeHtml(
                  institutionalSourceDescription(
                    link.id
                  )
                )}
              </span>
            </span>

            <span
              class="udeg-resource-arrow"
              aria-hidden="true"
            >
              ↗
            </span>
          </a>
        `
      )
      .join("");


  return `
    <article class="udeg-library">

      <header class="udeg-library-header">

        <div
          class="udeg-library-mark"
          aria-hidden="true"
        >
          U
        </div>

        <div>
          <span class="udeg-library-eyebrow">
            Universidad de Guadalajara
          </span>

          <h2 id="udeg-modal-title">
            Biblioteca Virtual UdeG
          </h2>

          <p>
            Buscar este documento en las
            colecciones y recursos licenciados
            de la Universidad de Guadalajara.
          </p>
        </div>

      </header>


      <section class="udeg-record-preview">

        <span>
          Documento seleccionado
        </span>

        <strong>
          ${escapeHtml(
            item.title ||
            "Sin título"
          )}
        </strong>

        ${
          authors ||
          item.year
            ? `
              <p>
                ${
                  authors
                    ? escapeHtml(
                        authors
                      )
                    : ""
                }

                ${
                  item.year
                    ? `${
                        authors
                          ? " · "
                          : ""
                      }${item.year}`
                    : ""
                }
              </p>
            `
            : ""
        }

      </section>


      <section class="udeg-resource-section">

        <div class="udeg-resource-heading">
          <span>
            Recursos disponibles
          </span>

          <strong>
            ${links.length}
          </strong>
        </div>

        <div class="udeg-resource-grid">
          ${resources}
        </div>

      </section>


      <footer class="udeg-library-footer">

        <div>
          <strong>
            ¿No ha iniciado sesión?
          </strong>

          <span>
            El acceso institucional se gestiona
            directamente en Biblioteca Virtual.
            Investigación Filosófica no recibe
            ni almacena sus credenciales.
          </span>
        </div>

        <a
          class="udeg-login-link"
          href="${escapeHtml(
            UDEG_LOGIN_URL
          )}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ingresar a Biblioteca Virtual UdeG
          <span aria-hidden="true">
            ↗
          </span>
        </a>

      </footer>

    </article>
  `;
}


function openUdegPopup(
  item
) {
  if (
    !udegModal ||
    !udegModalContent
  ) {
    return;
  }


  udegModalContent.innerHTML =
    renderUdegPopup(
      item
    );


  udegModal
    .classList
    .remove(
      "hidden"
    );


  document.body
    .classList
    .add(
      "modal-open"
    );
}


function closeUdegPopup() {
  if (
    !udegModal ||
    !udegModalContent
  ) {
    return;
  }


  udegModal
    .classList
    .add(
      "hidden"
    );


  udegModalContent.innerHTML =
    "";


  document.body
    .classList
    .remove(
      "modal-open"
    );
}


function renderResult(
  item,
  index
) {
  const institutionalLinks =
    buildInstitutionalLinks(
      item
    );


  const resultAuthors =
    (item.authors || [])
      .filter(author =>
        Boolean(author?.name)
      );


  const authors =
    resultAuthors
      .map(author => `
        <a
          class="author-work-link"
          href="${escapeHtml(authorWorksUrl(
            author.name,
            author
          ))}"
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir en una pestaña nueva las obras de ${escapeHtml(
            author.name
          )}"
        >
          ${escapeHtml(author.name)}
        </a>
      `)
      .join(
        '<span class="author-separator" aria-hidden="true">, </span>'
      );


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
              item.retrievalMode ===
                "semantic"
                ? "Semántica"
                : [
                    "author-index",
                    "author-crossref",
                    "author-internet-archive"
                  ].includes(
                    item.retrievalMode
                  )
                  ? "Autor"
                  : item.relevanceLevel
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
              ? authors
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

          ${
            item.presentationCollapsed
              ? `
                <span class="provider">
                  ${item.presentationMemberCount}
                  registros equivalentes
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
            institutionalLinks.length
              ? `
                <button
                  type="button"
                  class="institutional-card-link udeg-open"
                  data-record-id="${escapeHtml(
                    recordId(item)
                  )}"
                >
                  Biblioteca Virtual UdeG
                  <span aria-hidden="true">
                    ↗
                  </span>
                </button>
              `
              : ""
          }


          ${
            url
              ? `
                <a
                  class="result-secondary-link result-open-link"
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
                  class="result-secondary-link result-doi-link"
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


        ${
          item.retrievalMode ===
            "semantic"
            ? `
              <div class="explain">
                Score semántico ${
                  Number.isFinite(
                    item.semanticScore
                  )
                    ? item.semanticScore
                      .toFixed(4)
                    : "—"
                }
                · sin reranker
                ${
                  item.presentationCollapsed
                    ? ` · identidad exacta · ${item.presentationMemberCount} registros preservados`
                    : ""
                }
              </div>
            `
            : item.semanticCompanion
              ? `
                <div class="explain">
                  Fuente académica complementaria
                  · recuperación federada
                  · sin reranker
                </div>
              `
            : [
                "author-index",
                "author-crossref",
                "author-internet-archive"
              ].includes(
                item.retrievalMode
              )
              ? `
                <div class="explain">
                  ${
                    item.retrievalMode ===
                      "author-index"
                      ? "Autoría directa confirmada en el corpus"
                      : `Autoría directa coincidente en ${escapeHtml(
                          item.providers?.[0] ||
                          "un catálogo federado"
                        )}`
                  }
                  · identidad normalizada
                  ${
                    item.authorIdentity?.orcid
                      ? " · ORCID disponible"
                      : ""
                  }
                </div>
              `
              : `
              <div class="explain">
                A ${item.ranking.author || 0}
                ·
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
            `
        }


        ${renderExplanation(item)}

      </div>


      <aside class="score-panel">

        <div class="score">
          ${score}
        </div>

        <span>
          ${
            item.retrievalMode ===
              "semantic"
              ? "Similitud"
              : item.semanticCompanion
                ? "Fuente"
              : [
                  "author-index",
                  "author-crossref",
                  "author-internet-archive"
                ].includes(
                  item.retrievalMode
                )
                ? "Autoría"
                : "Relevancia"
          }
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


function setQwen3Controls({
  running = false,
  available = false
} = {}) {
  if (!qwen3OptIn) {
    return;
  }


  qwen3Start.disabled =
    running ||
    !available;

  qwen3Cancel
    .classList
    .toggle(
      "hidden",
      !running
    );
}


function resetQwen3Experiment() {
  qwen3Controller?.abort();
  qwen3Controller = null;
  currentQwen3Order = null;


  if (!qwen3OptIn) {
    return;
  }


  qwen3Progress.textContent =
    navigator.gpu
      ? "Modo opt-in: el orden normal permanece activo."
      : "WebGPU no está disponible; el orden normal permanece activo.";

  setQwen3Controls({
    available:
      Boolean(
        navigator.gpu &&
        currentResponse?.searchMode !==
          "semantic" &&
        currentResults.length
      )
  });
}


async function loadQwen3Scorer() {
  if (!qwen3ScorerPromise) {
    qwen3ScorerPromise =
      import(
        "../vendor/qwen3/qwen3-browser-q8.bundle.mjs"
      )
        .then(
          module =>
            module.createQwen3BrowserQ8Scorer({
              onProgress(event) {
                if (
                  event.phase ===
                  "download"
                ) {
                  qwen3Progress.textContent =
                    `Descargando ${event.file}: ${event.percent.toFixed(1)}%`;
                }
              }
            })
        )
        .catch(
          error => {
            qwen3ScorerPromise =
              null;
            throw error;
          }
        );
  }


  return qwen3ScorerPromise;
}


async function runQwen3Rerank() {
  if (
    !qwen3OptIn ||
    !currentResponse ||
    !currentResults.length ||
    qwen3Controller
  ) {
    return;
  }


  const responseAtStart =
    currentResponse;

  const productionResults =
    [...responseAtStart.results];

  const candidates =
    selectQwen3BrowserQ8Candidates(
      currentSearchQuery,
      productionResults
    );


  qwen3Controller =
    new AbortController();

  const controller =
    qwen3Controller;

  setQwen3Controls({
    running:
      true,
    available:
      true
  });

  qwen3Progress.textContent =
    "Preparando Qwen3 q8 en WebGPU…";


  try {
    const scorer =
      await loadQwen3Scorer();


    if (
      controller.signal.aborted
    ) {
      throw new DOMException(
        "Qwen3 cancelado",
        "AbortError"
      );
    }


    const rawScores = [];


    for (
      let index = 0;
      index < candidates.length;
      index += 1
    ) {
      qwen3Progress.textContent =
        `Evaluando ${index + 1}/${candidates.length} · ` +
        "el orden normal sigue visible";

      rawScores.push(
        await scorer.score(
          candidates[index],
          {
            signal:
              controller.signal
          }
        )
      );
    }


    if (
      currentResponse !==
      responseAtStart
    ) {
      throw new DOMException(
        "La búsqueda cambió",
        "AbortError"
      );
    }


    const reranked =
      rerankTopKByQwen3BrowserQ8(
        productionResults,
        rawScores
      );

    currentResults =
      reranked;

    currentQwen3Order =
      new Map(
        reranked.map(
          (item, index) => [
            item,
            index
          ]
        )
      );

    renderFilters(
      currentResults
    );

    qwen3Progress.textContent =
      "Top 20 reordenado con Qwen3 q8/WebGPU. Puedes volver a “Relevancia” para ver el orden normal.";

    status.textContent =
      `${responseAtStart.stats.unique} resultados únicos · orden Qwen3 experimental`;
  } catch (error) {
    if (
      error.name ===
      "AbortError"
    ) {
      qwen3Progress.textContent =
        "Qwen3 cancelado; se conservó exactamente el orden normal.";
    } else {
      console.error(error);

      qwen3Progress.textContent =
        `Qwen3 no se aplicó: ${error.message}. Se conservó exactamente el orden normal.`;
    }
  } finally {
    if (
      qwen3Controller ===
      controller
    ) {
      qwen3Controller =
        null;
    }


    setQwen3Controls({
      available:
        Boolean(
          navigator.gpu &&
          currentResponse?.searchMode !==
            "semantic" &&
          currentResults.length &&
          !currentQwen3Order
        )
    });
  }
}


function publicationTypeLabel(
  value
) {
  const labels = {
    article:
      "Artículo",
    "journal-article":
      "Artículo de revista",
    book:
      "Libro",
    "book-chapter":
      "Capítulo de libro",
    dissertation:
      "Tesis",
    "proceedings-article":
      "Ponencia o acta",
    text:
      "Texto de archivo"
  };

  return labels[value] || value;
}


function appendFilterOptions(
  selector,
  values,
  labelForValue
) {
  const select =
    document.querySelector(
      selector
    );

  if (!select) {
    return;
  }

  const existing =
    new Set(
      [...select.options]
        .map(
          option =>
            option.value
        )
    );

  for (
    const value of
    uniqueSorted(values)
  ) {
    if (
      !value ||
      existing.has(value)
    ) {
      continue;
    }

    const option =
      document.createElement(
        "option"
      );

    option.value =
      value;
    option.textContent =
      labelForValue(value);

    select.append(option);
    existing.add(value);
  }
}


function activeSearchFilterCount() {
  return [
    getFilterValue(
      "#filter-year-from"
    ),
    getFilterValue(
      "#filter-year-to"
    ),
    getFilterValue(
      "#filter-language"
    ),
    getFilterValue(
      "#filter-type"
    ),
    (
      getFilterValue(
        "#filter-sort"
      ) || "relevance"
    ) === "relevance"
      ? ""
      : getFilterValue(
          "#filter-sort"
        )
  ].filter(Boolean).length;
}


function updateFilterSummary(
  resultCount = null,
  totalCount = null
) {
  const countEl =
    document.querySelector(
      "#filter-count"
    );

  if (!countEl) {
    return;
  }

  const activeCount =
    activeSearchFilterCount();

  if (
    Number.isFinite(
      resultCount
    ) &&
    Number.isFinite(
      totalCount
    )
  ) {
    countEl.textContent =
      `${resultCount} de ${totalCount} resultados` +
      (
        activeCount
          ? ` · ${activeCount} ${activeCount === 1 ? "ajuste activo" : "ajustes activos"}`
          : ""
      );

    return;
  }

  countEl.textContent =
    activeCount
      ? `${activeCount} ${activeCount === 1 ? "ajuste listo" : "ajustes listos"} para la próxima búsqueda`
      : "Sin restricciones adicionales";
}


function buildSemanticSearchFilters() {
  const filters = {};

  const yearFrom =
    Number(
      getFilterValue(
        "#filter-year-from"
      )
    );

  const yearTo =
    Number(
      getFilterValue(
        "#filter-year-to"
      )
    );

  const language =
    getFilterValue(
      "#filter-language"
    );

  const publicationType =
    getFilterValue(
      "#filter-type"
    );

  if (
    Number.isFinite(yearFrom) &&
    yearFrom > 0
  ) {
    filters.year_from =
      yearFrom;
  }

  if (
    Number.isFinite(yearTo) &&
    yearTo > 0
  ) {
    filters.year_to =
      yearTo;
  }

  if (language) {
    filters.languages = [
      language
    ];
  }

  if (publicationType) {
    filters.publication_type =
      publicationType;
  }

  return filters;
}


function validateSearchFilterRange() {
  const yearFrom =
    Number(
      getFilterValue(
        "#filter-year-from"
      )
    );

  const yearTo =
    Number(
      getFilterValue(
        "#filter-year-to"
      )
    );

  if (
    yearFrom > 0 &&
    yearTo > 0 &&
    yearFrom > yearTo
  ) {
    status.textContent =
      "El año inicial no puede ser posterior al año final.";

    document
      .querySelector(
        "#filter-year-from"
      )
      ?.focus();

    return false;
  }

  return true;
}


function syncFiltersToSearchMode(
  mode
) {
  const semantic =
    mode === "semantic";

  const relevanceOption =
    document.querySelector(
      '#filter-sort option[value="relevance"]'
    );

  const citationsOption =
    document.querySelector(
      '#filter-sort option[value="citations"]'
    );

  const sortSelect =
    document.querySelector(
      "#filter-sort"
    );

  if (relevanceOption) {
    relevanceOption.textContent =
      semantic
        ? "Similitud semántica"
        : "Relevancia";
  }

  if (citationsOption) {
    citationsOption.hidden =
      semantic;
    citationsOption.disabled =
      semantic;
  }

  if (
    semantic &&
    sortSelect?.value ===
      "citations"
  ) {
    sortSelect.value =
      "relevance";
  }

  updateFilterSummary();

  if (currentResults.length) {
    applyFilters();
  }
}


function bindSearchFilters() {
  if (
    !filtersEl ||
    filtersEl.dataset.bound ===
      "true"
  ) {
    return;
  }

  filtersEl.dataset.bound =
    "true";

  filtersEl
    .querySelectorAll(
      "select, input"
    )
    .forEach(element => {
      element.addEventListener(
        "input",
        () => {
          updateFilterSummary();

          if (
            currentResults.length
          ) {
            applyFilters();
          }
        }
      );
    });

  document
    .querySelector(
      "#filter-reset"
    )
    ?.addEventListener(
      "click",
      resetFilters
    );

  filtersEl
    .querySelectorAll(
      "[data-export]"
    )
    .forEach(
      exportButton =>
        exportButton
          .addEventListener(
            "click",
            () =>
              exportResults(
                exportButton.dataset
                  .export
              )
          )
    );

  updateFilterSummary();
}


function renderFilters(
  results
) {
  appendFilterOptions(
    "#filter-language",
    results.map(
      item =>
        effectiveLanguage(
          item
        )
    ),
    languageLabel
  );

  appendFilterOptions(
    "#filter-type",
    results.map(
      item =>
        item.type
    ),
    publicationTypeLabel
  );

  syncFiltersToSearchMode(
    currentResponse?.searchMode
  );

  document
    .querySelector(
      "#filter-exports"
    )
    ?.classList
    .remove("hidden");

  bindSearchFilters();
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


function filterAndSortResults(
  results
) {
  const language =
    getFilterValue(
      "#filter-language"
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

  let filtered =
    results.filter(
      item => {

        if (
          language &&
          effectiveLanguage(
            item
          ) !== language
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


  if (
    sort === "qwen3" &&
    currentQwen3Order
  ) {
    filtered.sort(
      (a, b) =>
        currentQwen3Order.get(a) -
        currentQwen3Order.get(b)
    );
  }


  return filtered;
}


function applyFilters() {
  if (!currentResults.length) {
    updateFilterSummary();
    return;
  }

  resetVisibleLimit();

  currentFilteredResults =
    filterAndSortResults(
      currentResults
    );

  renderFilteredResults();

  updateFilterSummary(
    currentFilteredResults.length,
    currentResults.length
  );
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


  document
    .querySelectorAll(
      ".udeg-open"
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
              openUdegPopup(
                item
              );
            }
          }
        );
      }
    );


}


function showExclusiveAuthorWorks(
  resolution
) {
  document.body.classList.add(
    "author-view"
  );
  document.title =
    `${resolution.author.displayName} — Investigación Filosófica`;

  currentParsed = parseQuery(
    resolution.author.displayName,
    philosophyMap
  );

  currentResponse =
    {
      ...buildExclusiveAuthorResponse(
        currentResponse,
        resolution
      ),
      parsed:
        currentParsed
    };
  currentResults =
    currentResponse.results;
  currentFilteredResults =
    currentResponse.results;
  currentSearchQuery =
    resolution.author.displayName;
  input.value =
    resolution.author.displayName;

  resetVisibleLimit();
  resetQwen3Experiment();
  renderInterpretation(
    currentResponse
  );
  renderStats(
    currentResponse
  );
  renderFilters(
    currentResults
  );

  if (!currentResults.length) {
    renderFilteredResults();
  }

  status.textContent =
    `${currentResults.length} obras de autoría directa de ${resolution.author.displayName}`;

  researchWorkspace
    ?.classList
    .remove("hidden");
}


function rememberAuthorSourceSearch() {
  if (
    authorSourceSearch ||
    currentResponse?.authorOnly ||
    !currentResponse
  ) {
    return;
  }

  authorSourceSearch = {
    response:
      currentResponse,
    parsed:
      currentParsed,
    results:
      currentResults,
    query:
      currentSearchQuery,
    inputValue:
      input.value,
    activeEngine: {
      ...activeEngine
    }
  };
}


function restoreAuthorSourceSearch() {
  if (!authorSourceSearch) {
    return;
  }

  currentController?.abort();
  document.body.classList.remove(
    "author-view"
  );
  document.title =
    "Investigación Filosófica";

  const source =
    authorSourceSearch;
  authorSourceSearch = null;

  currentResponse =
    source.response;
  currentParsed =
    source.parsed;
  currentResults =
    source.results;
  currentSearchQuery =
    source.query;
  input.value =
    source.inputValue;
  activeEngine =
    source.activeEngine;

  resetVisibleLimit();
  resetQwen3Experiment();
  renderSearchEngineIndicator();
  renderInterpretation(
    currentResponse
  );
  renderStats(
    currentResponse
  );
  renderFilters(
    currentResults
  );

  status.textContent =
    `${currentResponse.stats.unique} resultados restaurados para ${source.query}`;
}


function openAlexAuthorId(
  value
) {
  return String(value || "")
    .match(
      /(?:openalex\.org\/A|^A?)(\d+)$/i
    )?.[1] || null;
}


function authorWorksUrl(
  authorName,
  identity = {}
) {
  const url = new URL(
    window.location.href
  );
  const exactAuthorId =
    openAlexAuthorId(
      identity.id
    );
  const identityId = String(
    identity.id || ""
  );
  const exactOrcid =
    identity.orcid ||
    (
      /(?:orcid\.org\/)?\d{4}-\d{4}-\d{4}-[\dX]{4}$/i
        .test(identityId)
        ? identityId
        : ""
    );

  url.searchParams.set(
    "view",
    "author"
  );
  url.searchParams.set(
    "author",
    String(authorName || "").trim()
  );

  if (exactAuthorId) {
    url.searchParams.set(
      "authorId",
      exactAuthorId
    );
  } else {
    url.searchParams.delete(
      "authorId"
    );
  }

  if (exactOrcid) {
    url.searchParams.set(
      "authorOrcid",
      exactOrcid
    );
  } else {
    url.searchParams.delete(
      "authorOrcid"
    );
  }

  url.hash = "results";

  return url.toString();
}


function authorWorksRequestFromLocation(
  search
) {
  const params = new URLSearchParams(
    search
  );
  const name = String(
    params.get("author") || ""
  ).trim();

  if (
    params.get("view") !== "author" ||
    !name
  ) {
    return null;
  }

  return {
    name,
    id:
      params.get("authorId") || "",
    orcid:
      params.get("authorOrcid") || ""
  };
}


function currentResolvedAuthor(
  authorId,
  authorName
) {
  const resolution =
    currentResponse
      ?.authorResolution;
  const identities =
    resolution?.status === "multiple"
      ? resolution.identities || []
      : [resolution];
  const normalizedName =
    String(authorName || "")
      .toLocaleLowerCase("und")
      .trim();

  return identities.find(identity =>
    identity?.status === "resolved" &&
    (
      authorId
        ? String(identity.author?.id) ===
          String(authorId)
        : String(
            identity.author?.displayName ||
            ""
          )
            .toLocaleLowerCase("und")
            .trim() === normalizedName
    )
  ) || null;
}


function showAuthorChoice(
  resolution,
  authorName
) {
  currentResponse = {
    ...(currentResponse || {}),
    authorOnlyRequested: true,
    requestedAuthorName:
      authorName,
    authorResolution:
      resolution
  };

  renderFilteredResults();

  status.textContent =
    `Selecciona la identidad correcta para ${authorName}.`;
}


async function openExclusiveAuthorByName(
  authorName,
  trigger = null,
  identity = {}
) {
  const name = String(
    authorName || ""
  ).trim();

  if (!name) {
    return;
  }

  rememberAuthorSourceSearch();

  currentController?.abort();
  const authorController =
    new AbortController();
  currentController =
    authorController;

  button.disabled = true;
  searchModeButtons.forEach(item => {
    item.disabled = true;
  });

  trigger?.setAttribute(
    "aria-busy",
    "true"
  );
  trigger?.setAttribute(
    "disabled",
    ""
  );
  status.textContent =
    `Buscando obras de ${name}…`;

  try {
    const exactId =
      openAlexAuthorId(
        identity.id
      );
    const existing =
      currentResolvedAuthor(
        exactId,
        name
      );
    let resolution =
      existing ||
      (
        exactId
          ? await resolveRemoteAuthorCandidate(
              {
                id: exactId,
                n: name,
                o:
                  identity.orcid || null,
                cw: 0
              },
              {
                signal:
                  authorController.signal,
                includeProfile: true
              }
            )
          : await resolveRemoteAuthor(
              name,
              {
                signal:
                  authorController.signal,
                includeProfile: true
              }
            )
      );

    if (
      !exactId &&
      resolution.status !== "resolved" &&
      (
        resolution.status !== "ambiguous" ||
        identity.orcid
      )
    ) {
      resolution =
        await resolveFederatedAuthor(
          name,
          {
            orcid:
              identity.orcid || null,
            signal:
              authorController.signal
          }
        );
    }

    if (
      resolution.status ===
      "resolved"
    ) {
      showExclusiveAuthorWorks(
        resolution
      );
      return;
    }

    if (
      resolution.status ===
      "ambiguous"
    ) {
      showAuthorChoice(
        resolution,
        name
      );
      return;
    }

    status.textContent =
      `No se pudo identificar con precisión a ${name}.`;
  } catch (error) {
    if (
      error.name !== "AbortError"
    ) {
      status.textContent =
        `No fue posible cargar las obras de ${name}.`;
    }
  } finally {
    if (
      currentController ===
      authorController
    ) {
      button.disabled = false;
      searchModeButtons.forEach(item => {
        item.disabled = false;
      });
    }

    trigger?.removeAttribute(
      "aria-busy"
    );
    trigger?.removeAttribute(
      "disabled"
    );
  }
}


function renderAuthorResolution(
  resolution
) {
  if (
    !resolution ||
    ![
      "resolved",
      "ambiguous",
      "multiple"
    ].includes(resolution.status)
  ) {
    return "";
  }


  if (
    resolution.status ===
    "multiple"
  ) {
    const identities =
      resolution.identities || [];

    return `
      <section
        class="author-resolution is-multiple"
        aria-label="Autores de la consulta"
      >
        <div class="author-resolution-heading">
          <span class="author-resolution-label">
            Relación entre autores
          </span>

          <strong>
            ${identities.length} identidades buscadas
          </strong>

          <p>
            Primero aparecen los artículos que relacionan a más autores de la consulta.
          </p>
        </div>

        <div class="author-profile-grid">
          ${identities.map((identity, index) => {
            if (identity.status === "resolved") {
              const author = identity.author;
              const wikidataUrl =
                author.wikidataId
                  ? `https://www.wikidata.org/wiki/${author.wikidataId}`
                  : null;
              const orcidUrl = author.orcid
                ? (
                    author.orcid.startsWith("http")
                      ? author.orcid
                      : `https://orcid.org/${author.orcid}`
                  )
                : null;

              return `
                <article class="author-profile-card">
                  <span class="author-profile-query">
                    ${escapeHtml(identity.input)}
                  </span>

                  <strong>
                    <a
                      class="author-work-link author-profile-link"
                      href="${escapeHtml(authorWorksUrl(
                        author.displayName,
                        author
                      ))}"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir en una pestaña nueva las obras de ${escapeHtml(author.displayName)}"
                    >
                      ${escapeHtml(author.displayName)}
                    </a>
                  </strong>

                  ${
                    author.biography
                      ? `<p>${escapeHtml(author.biography)}</p>`
                      : ""
                  }

                  <div class="author-evidence">
                    ${
                      author.wikipediaUrl
                        ? `
                          <a
                            href="${escapeHtml(author.wikipediaUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Biografía en Wikipedia
                          </a>
                        `
                        : ""
                    }
                    ${
                      wikidataUrl
                        ? `
                          <a
                            href="${escapeHtml(wikidataUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Wikidata
                          </a>
                        `
                        : ""
                    }
                    ${
                      orcidUrl
                        ? `
                          <a
                            href="${escapeHtml(orcidUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            ORCID
                          </a>
                        `
                        : ""
                    }
                  </div>
                </article>
              `;
            }

            if (identity.status === "ambiguous") {
              return `
                <article class="author-profile-card is-ambiguous">
                  <strong>
                    ${escapeHtml(identity.input)}
                  </strong>
                  <p>
                    Selecciona la identidad correcta.
                  </p>
                  <div class="author-candidates">
                    ${(identity.candidates || []).map(candidate => `
                      <button
                        type="button"
                        class="author-candidate"
                        data-author-id="${escapeHtml(candidate.id)}"
                        data-author-index="${index}"
                      >
                        <span>${escapeHtml(candidate.n)}</span>
                        <small>${candidate.cw || 0} obras en el corpus</small>
                      </button>
                    `).join("")}
                  </div>
                </article>
              `;
            }

            return `
              <article class="author-profile-card is-unresolved">
                <strong>${escapeHtml(identity.input)}</strong>
                <p>
                  No se eligió una identidad automáticamente; la búsqueda conserva el nombre escrito.
                </p>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }


  if (
    resolution.status ===
    "ambiguous"
  ) {
    const candidates =
      resolution.candidates || [];

    return `
      <section
        class="author-resolution is-ambiguous"
        aria-label="Autores posibles"
      >
        <div>
          <strong>
            Encontré varias personas con ese nombre
          </strong>

          <p>
            No elegí una identidad automáticamente.
            Selecciona el autor correcto para ver sus obras.
          </p>
        </div>

        <div class="author-candidates">
          ${candidates.map(candidate => `
            <button
              type="button"
              class="author-candidate"
              data-author-id="${escapeHtml(candidate.id)}"
            >
              <span>
                ${escapeHtml(candidate.n)}
              </span>

              <small>
                ${candidate.cw || 0} obras en el corpus
                ${
                  candidate.o
                    ? ` · ORCID ${escapeHtml(candidate.o.replace(/^https?:\/\/orcid\.org\//, ""))}`
                    : ""
                }
              </small>
            </button>
          `).join("")}
        </div>
      </section>
    `;
  }


  const author = resolution.author;
  const wikidataUrl =
    author.wikidataId
      ? `https://www.wikidata.org/wiki/${author.wikidataId}`
      : null;
  const orcidUrl = author.orcid
    ? (
        author.orcid.startsWith("http")
          ? author.orcid
          : `https://orcid.org/${author.orcid}`
      )
    : null;

  return `
    <section
      class="author-resolution is-resolved"
      aria-label="Identidad del autor"
    >
      <div>
        ${
          currentResponse?.authorOnly &&
          authorSourceSearch
            ? `
              <button
                type="button"
                class="author-back-to-search"
              >
                <span aria-hidden="true">←</span>
                Volver a ${escapeHtml(
                  authorSourceSearch.query ||
                  "la búsqueda anterior"
                )}
              </button>
            `
            : ""
        }

        <span class="author-resolution-label">
          Autor identificado
        </span>

        <strong>
          <a
            class="author-work-link author-profile-link"
            href="${escapeHtml(authorWorksUrl(
              author.displayName,
              author
            ))}"
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir en una pestaña nueva las obras de ${escapeHtml(author.displayName)}"
          >
            ${escapeHtml(author.displayName)}
          </a>
        </strong>

        <small>
          ${
            currentResponse?.authorOnly
              ? "Mostrando únicamente obras de autoría directa"
              : "Obras de autoría directa primero"
          }
        </small>

        ${
          author.biography
            ? `<p>${escapeHtml(author.biography)}</p>`
            : ""
        }
      </div>

      <div class="author-evidence">
        ${
          author.wikipediaUrl
            ? `
              <a
                href="${escapeHtml(author.wikipediaUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Biografía en Wikipedia
              </a>
            `
            : ""
        }

        ${
          wikidataUrl
            ? `
              <a
                href="${escapeHtml(wikidataUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Wikidata
              </a>
            `
            : ""
        }

        ${
          orcidUrl
            ? `
              <a
                href="${escapeHtml(orcidUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                ORCID
              </a>
            `
            : ""
        }

        <span>
          Corpus OpenAlex Philosophy en Hugging Face
        </span>
      </div>
    </section>
  `;
}


function bindAuthorResolutionActions() {
  document
    .querySelector(
      ".author-back-to-search"
    )
    ?.addEventListener(
      "click",
      restoreAuthorSourceSearch
    );


  document
    .querySelectorAll(
      ".author-candidate"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          const multiResolution =
            currentResponse
              ?.authorResolution
              ?.status === "multiple";
          const authorIndex = Number(
            button.dataset.authorIndex
          );
          const candidateSource =
            multiResolution &&
            Number.isInteger(authorIndex)
              ? currentResponse
                  .authorResolution
                  .identities?.[authorIndex]
                  ?.candidates
              : currentResponse
                  ?.authorResolution
                  ?.candidates;
          const candidate =
            candidateSource
              ?.find(item =>
                String(item.id) ===
                button.dataset.authorId
              );

          if (!candidate) {
            return;
          }

          document
            .querySelectorAll(
              ".author-candidate"
            )
            .forEach(item => {
              item.disabled = true;
            });

          status.textContent =
            `Cargando obras de ${candidate.n}…`;

          try {
            const resolution =
              await resolveRemoteAuthorCandidate(
                candidate,
                {
                  signal:
                    currentController?.signal
                }
              );

            if (multiResolution) {
              const identities = [
                ...currentResponse
                  .authorResolution
                  .identities
              ];

              identities[authorIndex] = {
                input:
                  identities[authorIndex]
                    .input,
                canonicalName:
                  identities[authorIndex]
                    .canonicalName,
                ...resolution
              };

              const groupedResolution = {
                ...currentResponse
                  .authorResolution,
                identities,
                authors: identities
                  .filter(item =>
                    item.status === "resolved"
                  )
                  .map(item => item.author)
              };

              currentResponse =
                augmentWithAuthorResolution(
                  currentResponse,
                  groupedResolution
                );
            } else if (
              currentResponse
                ?.authorOnlyRequested
            ) {
              showExclusiveAuthorWorks(
                resolution
              );

              return;
            } else {
              currentResponse =
                augmentWithAuthorResolution(
                  currentResponse,
                  resolution
                );
            }

            currentResults =
              currentResponse.results;

            resetVisibleLimit();
            renderInterpretation(
              currentResponse
            );
            renderStats(
              currentResponse
            );
            renderFilters(
              currentResults
            );

            status.textContent =
              multiResolution
                ? `Identidad confirmada: ${resolution.author.displayName}`
                : `${resolution.works.length} obras de ${resolution.author.displayName}`;
          } catch (error) {
            if (
              error.name !== "AbortError"
            ) {
              status.textContent =
                "No fue posible cargar ese autor.";
            }
          }
        }
      );
    });
}


function renderAuthorIdentity(
  resolution
) {
  if (!authorIdentityEl) {
    return;
  }

  const markup =
    renderAuthorResolution(
      resolution
    );

  authorIdentityEl.innerHTML =
    markup;
  authorIdentityEl.classList.toggle(
    "hidden",
    !markup
  );

  if (markup) {
    bindAuthorResolutionActions();
  }
}


function clearAuthorIdentity() {
  if (!authorIdentityEl) {
    return;
  }

  authorIdentityEl.innerHTML = "";
  authorIdentityEl.classList.add(
    "hidden"
  );
}


document.addEventListener(
  "click",
  event => {
    const link = event.target
      ?.closest?.(
        "a.author-work-link"
      );

    if (
      !link ||
      !shouldHandleAuthorLinkClick(event)
    ) {
      return;
    }

    event.preventDefault();
    openAuthorDestination(link.href);
  }
);


function authorHomeUrl() {
  const url = new URL(
    window.location.href
  );

  for (const parameter of [
    "view",
    "author",
    "authorId",
    "authorOrcid"
  ]) {
    url.searchParams.delete(
      parameter
    );
  }

  url.hash = "";

  return url.toString();
}


function authorMonogram(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "Φ";
  }

  return [
    parts[0],
    parts.at(-1)
  ]
    .filter(Boolean)
    .map(part =>
      part.charAt(0).toUpperCase()
    )
    .join("")
    .slice(0, 2);
}


function renderAuthorPage(
  response,
  visible
) {
  const resolution =
    response.authorResolution;
  const author =
    resolution.author;
  const works =
    response.results || [];
  const summary =
    summarizeAuthorCorpus(
      author,
      works
    );
  const federatedCatalog =
    author.catalog === "federated";
  const catalogSources =
    author.catalogSources || [];
  const catalogNoticeSubject =
    catalogSources.length === 1
      ? `${catalogSources[0]} devolvió`
      : catalogSources.length > 1
        ? `${catalogSources.join(" e ")} devolvieron`
        : "Los catálogos federados devolvieron";
  const yearSpan =
    summary.yearFrom && summary.yearTo
      ? (
          summary.yearFrom === summary.yearTo
            ? String(summary.yearFrom)
            : `${summary.yearFrom}–${summary.yearTo}`
        )
      : "Sin fecha suficiente";
  const languages =
    summary.languages
      .map(item => `
        <span>
          ${escapeHtml(
            languageLabel(item.value)
          )}
          <strong>${item.count}</strong>
        </span>
      `)
      .join("");
  const types =
    summary.types
      .map(item => `
        <span>
          ${escapeHtml(
            recordTypeLabel({
              type: item.value
            })
          )}
          <strong>${item.count}</strong>
        </span>
      `)
      .join("");
  const focuses =
    summary.focuses
      .map(item => `
        <span class="author-focus-term">
          ${escapeHtml(item.term)}
          <small>${item.count}</small>
        </span>
      `)
      .join("");
  const maxDecade = Math.max(
    1,
    ...summary.decades.map(item =>
      item.count
    )
  );
  const decades =
    summary.decades
      .map(item => `
        <div class="author-decade-row">
          <span>${escapeHtml(item.label)}</span>
          <div aria-hidden="true">
            <i style="width: ${Math.max(
              8,
              Math.round(
                item.count /
                maxDecade *
                100
              )
            )}%"></i>
          </div>
          <strong>${item.count}</strong>
        </div>
      `)
      .join("");
  const wikidataUrl =
    author.wikidataId
      ? `https://www.wikidata.org/wiki/${author.wikidataId}`
      : null;
  const orcidUrl = author.orcid
    ? (
        author.orcid.startsWith("http")
          ? author.orcid
          : `https://orcid.org/${author.orcid}`
      )
    : null;
  const corpusNotice =
    federatedCatalog
      ? `${catalogNoticeSubject} ${summary.loadedWorks} obras con coincidencia exacta de autor; esta vista no afirma exhaustividad bibliográfica.`
      : summary.corpusWorks > summary.loadedWorks
        ? `El índice registra ${summary.corpusWorks.toLocaleString("es-MX")} obras; esta vista presenta hasta ${summary.loadedWorks}.`
        : `La vista contiene las ${summary.loadedWorks} obras publicables disponibles en el índice.`;

  return `
    <article class="author-page">
      <header class="author-page-hero">
        <div class="author-page-identity">
          <a
            class="author-page-back"
            href="${escapeHtml(authorHomeUrl())}"
          >
            <span aria-hidden="true">←</span>
            Nueva búsqueda
          </a>

          <span class="author-page-eyebrow">
            ${
              federatedCatalog
                ? "Archivo de autor · catálogo federado"
                : "Archivo de autor · corpus propio"
            }
          </span>

          <h1>${escapeHtml(author.displayName)}</h1>

          <p class="author-page-biography">
            ${escapeHtml(
              author.biography ||
              (
                federatedCatalog
                  ? "Identidad bibliográfica recuperada por coincidencia exacta de nombre y ORCID cuando está disponible."
                  : "Identidad bibliográfica confirmada en el corpus OpenAlex Philosophy."
              )
            )}
          </p>

          <div class="author-page-evidence">
            ${
              author.wikipediaUrl
                ? `<a href="${escapeHtml(author.wikipediaUrl)}" target="_blank" rel="noopener noreferrer">Wikipedia</a>`
                : ""
            }
            ${
              wikidataUrl
                ? `<a href="${escapeHtml(wikidataUrl)}" target="_blank" rel="noopener noreferrer">Wikidata</a>`
                : ""
            }
            ${
              orcidUrl
                ? `<a href="${escapeHtml(orcidUrl)}" target="_blank" rel="noopener noreferrer">ORCID</a>`
                : ""
            }
          </div>
        </div>

        <div class="author-page-seal" aria-hidden="true">
          <span>${escapeHtml(authorMonogram(author.displayName))}</span>
          <small>Autor identificado</small>
        </div>
      </header>

      <section class="author-page-metrics" aria-label="Resumen del corpus del autor">
        <div>
          <span>${
            federatedCatalog
              ? "Obras recuperadas"
              : "Obras en el corpus"
          }</span>
          <strong>${summary.corpusWorks.toLocaleString("es-MX")}</strong>
          <small>${summary.loadedWorks} disponibles en esta vista</small>
        </div>
        <div>
          <span>Periodo visible</span>
          <strong>${escapeHtml(yearSpan)}</strong>
          <small>Según años bibliográficos disponibles</small>
        </div>
        <div>
          <span>Idiomas</span>
          <strong>${summary.languages.length}</strong>
          <small>En las obras mostradas</small>
        </div>
        <div>
          <span>Tipos documentales</span>
          <strong>${summary.types.length}</strong>
          <small>Clasificación de la fuente</small>
        </div>
      </section>

      <section class="author-page-analysis">
        <div class="author-analysis-card author-focus-card">
          <span class="author-section-kicker">Mapa léxico</span>
          <h2>Enfoques visibles en los títulos</h2>
          <div class="author-focus-cloud">
            ${
              focuses ||
              "<p>No hay títulos suficientes para extraer recurrencias.</p>"
            }
          </div>
          <p class="author-method-note">
            Indicadores automáticos por frecuencia de palabras en títulos; no son etiquetas humanas ni una interpretación exhaustiva de la obra.
          </p>
        </div>

        <div class="author-analysis-card">
          <span class="author-section-kicker">Cronología</span>
          <h2>Distribución por década</h2>
          <div class="author-decade-chart">
            ${
              decades ||
              "<p>No hay años suficientes para construir la cronología.</p>"
            }
          </div>
        </div>
      </section>

      <section class="author-page-taxonomy" aria-label="Idiomas y tipos documentales">
        <div>
          <span class="author-section-kicker">Idiomas</span>
          <div>${languages || "<span>Sin datos</span>"}</div>
        </div>
        <div>
          <span class="author-section-kicker">Tipos de obra</span>
          <div>${types || "<span>Sin datos</span>"}</div>
        </div>
      </section>

      <section class="author-page-works">
        <div class="author-page-works-heading">
          <div>
            <span class="author-section-kicker">Bibliografía</span>
            <h2>${
              federatedCatalog
                ? "Obras recuperadas"
                : "Obras en el corpus"
            }</h2>
          </div>
          <p>${escapeHtml(corpusNotice)}</p>
        </div>

        <div class="author-work-grid">
          ${visible.map(renderResult).join("")}
        </div>

        ${
          works.length > visibleLimit
            ? `
              <div class="load-more-wrap">
                <button id="load-more" type="button" class="load-more">
                  Mostrar más obras
                </button>
                <span>Mostrando ${visible.length} de ${works.length}</span>
              </div>
            `
            : `
              <div class="load-more-wrap">
                <span>Mostrando todas las ${works.length} obras cargadas</span>
              </div>
            `
        }
      </section>
    </article>
  `;
}

function renderFilteredResults() {
  const semanticResults =
    currentResponse?.searchMode ===
    "semantic";
  const authorOnlyResults =
    currentResponse?.authorOnly ===
    true;

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


  if (authorOnlyResults) {
    clearAuthorIdentity();

    resultsEl.innerHTML =
      errorHtml +
      renderAuthorPage(
        currentResponse,
        visible
      );

    document
      .querySelector("#load-more")
      ?.addEventListener(
        "click",
        () => {
          visibleLimit += 20;
          renderFilteredResults();
        }
      );

    bindAuthorResolutionActions();
    bindResultActions();
    return;
  }


  renderAuthorIdentity(
    currentResponse?.authorResolution
  );


  resultsEl.innerHTML =
    errorHtml +
    (
      semanticResults ||
      authorOnlyResults
        ? ""
        : fetchMoreButton("top")
    ) +
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


  if (
    !semanticResults &&
    !authorOnlyResults
  ) {
    resultsEl.insertAdjacentHTML(
      "beforeend",
      fetchMoreButton("bottom")
    );
  }


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
  bindAuthorResolutionActions();
}


function resetVisibleLimit() {
  visibleLimit = 20;
}

function resetFilters() {
  const ids = [
    "#filter-year-from",
    "#filter-year-to",
    "#filter-language",
    "#filter-type"
  ];


  for (const id of ids) {
    const element =
      document.querySelector(id);

    if (element) {
      element.value = "";
    }
  }


  const sort =
    document.querySelector(
      "#filter-sort"
    );

  if (sort) {
    sort.value =
      "relevance";
  }


  updateFilterSummary();

  if (currentResults.length) {
    applyFilters();
  }
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


  qwen3Controller?.abort();


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

    let response =
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


    response =
      augmentWithAuthorResolution(
        response,
        currentResponse.authorResolution
      );


    currentResponse =
      response;

    currentResults =
      response.results;

    resetQwen3Experiment();

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


function renderSearchLoadingCards() {
  return `
    <div class="search-loading-grid" aria-hidden="true">
      ${Array.from(
        {
          length: 3
        },
        () => `
          <div class="search-loading-card">
            <span></span>
            <span></span>
            <span></span>
          </div>
        `
      ).join("")}
    </div>
  `;
}


function renderSearchLoading() {
  return `
    <div class="search-live-progress">
      <span class="search-live-spinner" aria-hidden="true"></span>

      <div>
        <strong>
          Buscando literatura filosófica…
        </strong>

        <span>
          Los primeros resultados aparecerán conforme respondan las fuentes.
        </span>
      </div>
    </div>

    ${renderSearchLoadingCards()}
  `;
}


function renderSemanticSearchLoading(
  elapsedSeconds = 0
) {
  const message =
    elapsedSeconds < 4
      ? "Preparando la consulta y conectando con el corpus propio."
      : (
          elapsedSeconds < 10
            ? "Comparando el significado y consultando fuentes académicas complementarias."
            : "La búsqueda continúa activa; el corpus, Crossref, Internet Archive y UdeG responden a ritmos distintos."
        );

  return `
    <div class="search-live-progress semantic-progress">
      <span class="search-live-spinner" aria-hidden="true"></span>

      <div>
        <strong>
          Buscando por significado · ${elapsedSeconds} s
        </strong>

        <span>
          ${message}
        </span>
      </div>
    </div>

    ${renderSearchLoadingCards()}
  `;
}


function renderProgressiveSearch(
  response,
  progress
) {
  currentResponse =
    response;

  currentParsed =
    response.parsed;

  currentResults =
    response.results;

  currentFilteredResults =
    filterAndSortResults(
      response.results
    );


  renderInterpretation(
    response
  );

  renderStats(
    response
  );

  renderAuthorIdentity(
    response.authorResolution
  );


  const currentExpansion =
    Math.min(
      progress.completedExpansions +
        1,
      progress.totalExpansions
    );

  const visible =
    currentFilteredResults.slice(
      0,
      20
    );

  const resultMarkup =
    visible.length
      ? visible
          .map(
            renderResult
          )
          .join("")
      : (
          response.results.length
            ? `
                <div class="search-filter-empty">
                  Los resultados recibidos todavía no coinciden con los parámetros seleccionados.
                </div>
              `
            : renderSearchLoadingCards()
        );


  resultsEl.innerHTML = `
    <div class="search-live-progress has-results">
      <span class="search-live-spinner" aria-hidden="true"></span>

      <div>
        <strong>
          ${response.stats.unique}
          ${
            response.stats.unique === 1
              ? "resultado encontrado"
              : "resultados encontrados"
          }
        </strong>

        <span>
          ${escapeHtml(progress.provider)} ·
          búsqueda ${currentExpansion}/${progress.totalExpansions} ·
          fuente ${progress.providersCompleted}/${progress.providersTotal}
        </span>
      </div>
    </div>

    ${resultMarkup}
  `;


  bindResultActions();
  bindAuthorResolutionActions();

  updateFilterSummary(
    currentFilteredResults.length,
    currentResults.length
  );

  status.textContent =
    `${response.stats.unique} resultados · ` +
    `${progress.provider} · ` +
    `búsqueda ${currentExpansion}/${progress.totalExpansions}`;
}

async function runFederatedSearch(
  query,
  {
    fallbackReason = null
  } = {}
) {
  if (!philosophyMap) {
    return;
  }

  document.body.classList.remove(
    "author-view"
  );
  document.title =
    "Investigación Filosófica";


  if (currentController) {
    currentController.abort();
  }


  currentController =
    new AbortController();

  const searchController =
    currentController;

  currentResults = [];
  currentResponse = null;
  authorSourceSearch = null;
  currentSearchQuery =
    query;
  resetQwen3Experiment();
  clearAuthorIdentity();


  button.disabled =
    true;

  searchModeButtons
    .forEach(
      item => {
        item.disabled =
          true;
      }
    );

  resultsEl.innerHTML =
    renderSearchLoading();

  resultsEl.setAttribute(
    "aria-busy",
    "true"
  );

  interpretationEl
    .classList
    .add("hidden");

  statsEl
    .classList
    .add("hidden");

  setActiveEngine(
    "federated",
    "working",
    {
      fallback:
        Boolean(
          fallbackReason
        )
    }
  );


  status.textContent =
    fallbackReason
      ? "La búsqueda semántica no respondió; activando el respaldo tradicional…"
      : "Interpretando consulta…";


  try {
    status.textContent =
      "Interpretando consulta e identidad…";

    let authorResolution = {
      status: "pending",
      candidates: [],
      works: []
    };

    const authorResolutionPromise =
      resolveAuthorForQuery(
        query,
        searchController.signal
      );

    authorResolutionPromise.then(
      value => {
        authorResolution = value;

        if (
          currentController ===
            searchController &&
          !searchController.signal
            .aborted
        ) {
          renderAuthorIdentity(
            value
          );
        }
      },
      () => {}
    );

    const depth =
      Number(
        document.querySelector(
          "#search-depth"
        )?.value || 12
      );

    let response =
      await searchPhilosophy(
        query,
        philosophyMap,
        {
          signal:
            searchController.signal,

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
          },

          onPartialResults(response) {
            if (
              currentController !==
                searchController ||
              searchController.signal
                .aborted
            ) {
              return;
            }


            const augmented =
              augmentWithAuthorResolution(
                response,
                authorResolution
              );

            renderProgressiveSearch(
              augmented,
              augmented.progress
            );
          }
        }
      );


    authorResolution =
      await authorResolutionPromise;


    response =
      augmentWithAuthorResolution(
        response,
        authorResolution
      );


    response.searchMode =
      "federated";

    if (fallbackReason) {
      response.errors = [
        {
          provider:
            "Búsqueda semántica",
          message:
            `${fallbackReason} Se utilizó automáticamente la búsqueda tradicional.`
        },
        ...response.errors
      ];
    }


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

    resetQwen3Experiment();


    status.textContent =
      `${response.stats.unique} resultados únicos` +
      (
        fallbackReason
          ? " · respaldo tradicional"
          : ""
      );

    setActiveEngine(
      "federated",
      "completed",
      {
        fallback:
          Boolean(
            fallbackReason
          )
      }
    );
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
    if (
      currentController ===
      searchController
    ) {
      button.disabled =
        false;

      searchModeButtons
        .forEach(
          item => {
            item.disabled =
              false;
          }
        );

      resultsEl.removeAttribute(
        "aria-busy"
      );
    }
  }
}


function semanticFallbackReason(
  error
) {
  if (
    error?.status ===
    429
  ) {
    return "El servidor semántico está ocupado o alcanzó su límite temporal.";
  }

  if (
    error?.status ===
    503
  ) {
    return "El índice semántico todavía no está listo.";
  }

  return "El servidor semántico está apagado, dormido o sin conexión.";
}


async function searchSemanticCompanions(
  query,
  limit,
  signal
) {
  try {
    return await searchPhilosophy(
      query,
      philosophyMap,
      {
        signal,
        maxQueries: 3,
        openAlex: {
          enabled: false
        },
        openAlexPhilosophy: {
          enabled: true,
          rows: Math.min(limit, 10)
        },
        cucshFilosofia: {
          enabled: true,
          rows: Math.min(limit, 8)
        },
        crossref: {
          enabled: true,
          rows: Math.min(limit, 8)
        },
        internetArchive: {
          enabled: true,
          rows: Math.min(limit, 8)
        }
      }
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    return {
      query,
      parsed: parseQuery(
        query,
        philosophyMap
      ),
      expansions: [],
      results: [],
      errors: [
        {
          provider:
            "Fuentes complementarias",
          message:
            error?.message ||
            "No fue posible ampliar la búsqueda."
        }
      ]
    };
  }
}


async function runSemanticSearch(
  query
) {
  document.body.classList.remove(
    "author-view"
  );
  document.title =
    "Investigación Filosófica";

  if (currentController) {
    currentController.abort();
  }


  currentController =
    new AbortController();

  const searchController =
    currentController;

  currentResults = [];
  currentResponse = null;
  authorSourceSearch = null;
  currentSearchQuery =
    query;
  resetQwen3Experiment();
  clearAuthorIdentity();


  button.disabled =
    true;

  searchModeButtons
    .forEach(
      item => {
        item.disabled =
          true;
      }
    );

  interpretationEl
    .classList
    .add("hidden");

  statsEl
    .classList
    .add("hidden");

  resultsEl.setAttribute(
    "aria-busy",
    "true"
  );

  setActiveEngine(
    "semantic",
    "working"
  );


  const startedAt =
    Date.now();

  const updateProgress =
    () => {
      if (
        currentController !==
          searchController ||
        searchController.signal
          .aborted
      ) {
        return;
      }

      const elapsedSeconds =
        Math.floor(
          (
            Date.now() -
            startedAt
          ) / 1000
        );

      resultsEl.innerHTML =
        renderSemanticSearchLoading(
          elapsedSeconds
        );

      status.textContent =
        `Búsqueda semántica activa · ${elapsedSeconds} s transcurridos`;
    };


  updateProgress();

  const progressTimer =
    window.setInterval(
      updateProgress,
      1000
    );


  try {
    const limit =
      Number(
        document.querySelector(
          "#search-depth"
        )?.value || 12
      );

    const semanticFilters =
      buildSemanticSearchFilters();

    const authorResolutionPromise =
      resolveAuthorForQuery(
        query,
        searchController.signal
      );

    authorResolutionPromise.then(
      value => {
        if (
          currentController ===
            searchController &&
          !searchController.signal
            .aborted
        ) {
          renderAuthorIdentity(
            value
          );
        }
      },
      () => {}
    );

    const [
      rawSemanticResponse,
      authorResolution,
      federatedResponse
    ] = await Promise.all([
      searchPublicSemantic(
        query,
        {
          limit,
          filters:
            semanticFilters,
          signal:
            searchController.signal
        }
      ),
      authorResolutionPromise,
      searchSemanticCompanions(
        query,
        limit,
        searchController.signal
      )
    ]);


    const semanticResponse =
      await enrichResultsWithRemoteAuthors(
        rawSemanticResponse,
        {
          signal:
            searchController.signal
        }
      );


    const combinedResponse =
      combineSemanticWithFederated(
        semanticResponse,
        federatedResponse,
        {
          externalLimit: limit
        }
      );


    const response =
      augmentWithAuthorResolution(
        combinedResponse,
        authorResolution
      );


    if (
      currentController !==
        searchController ||
      searchController.signal
        .aborted
    ) {
      return;
    }


    currentParsed =
      response.parsed;

    currentResponse =
      response;

    currentResults =
      response.results;

    resetVisibleLimit();

    renderInterpretation(
      response
    );

    renderStats(
      response
    );

    renderFilters(
      response.results
    );

    resetQwen3Experiment();

    status.textContent =
      `${response.stats.unique} resultados híbridos · corpus propio + fuentes académicas`;

    semanticAvailability =
      "available";
    semanticAvailabilityCheckedAt =
      Date.now();

    setActiveEngine(
      "semantic",
      "completed"
    );
  } catch (error) {
    if (
      error.name ===
      "AbortError"
    ) {
      return;
    }


    console.warn(
      "Búsqueda semántica no disponible; se activa el respaldo tradicional.",
      error
    );

    if (
      error?.status !==
      429
    ) {
      semanticAvailability =
        "unavailable";
      semanticDocumentCount =
        null;
    }

    semanticAvailabilityCheckedAt =
      Date.now();

    renderSearchEngineIndicator();

    window.clearInterval(
      progressTimer
    );

    await runFederatedSearch(
      query,
      {
        fallbackReason:
          semanticFallbackReason(
            error
          )
      }
    );
  } finally {
    window.clearInterval(
      progressTimer
    );

    if (
      currentController ===
      searchController
    ) {
      button.disabled =
        false;

      searchModeButtons
        .forEach(
          item => {
            item.disabled =
              false;
          }
        );

      resultsEl.removeAttribute(
        "aria-busy"
      );
    }
  }
}


function selectSearchMode(
  mode
) {
  selectedSearchMode =
    mode === "semantic"
      ? "semantic"
      : "federated";

  searchModeButtons
    .forEach(
      item => {
        const active =
          item.dataset.searchMode ===
          selectedSearchMode;

        item.classList.toggle(
          "is-active",
          active
        );

        item.setAttribute(
          "aria-pressed",
          String(active)
        );
      }
    );

  setActiveEngine(
    selectedSearchMode,
    "selected"
  );

  syncFiltersToSearchMode(
    selectedSearchMode
  );

  if (
    selectedSearchMode ===
    "semantic"
  ) {
    searchModeNote.textContent =
      "Busca por significado en 451.823 documentos y amplía con Crossref, Internet Archive y Biblioteca UdeG; no usa la API de OpenAlex ni el reranker.";

    input.placeholder =
      "Ej. ¿Qué relación hay entre lógica y ontología en Quine?";

    void refreshSemanticAvailability();

    return;
  }

  searchModeNote.textContent =
    "Consulta fuentes académicas en vivo.";

  input.placeholder =
    "Ej. libertad en Kant";
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

    if (
      !validateSearchFilterRange()
    ) {
      return;
    }

    researchWorkspace
      ?.classList
      .remove(
        "hidden"
      );

    if (
      selectedSearchMode ===
      "semantic"
    ) {
      runSemanticSearch(
        query
      );

      return;
    }

    runFederatedSearch(
      query
    );
  }
);


searchModeButtons
  .forEach(
    item => {
      item.addEventListener(
        "click",
        () => {
          selectSearchMode(
            item.dataset.searchMode
          );
        }
      );
    }
  );


window.addEventListener(
  "focus",
  () => {
    void refreshSemanticAvailability();
  }
);


document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState ===
      "visible"
    ) {
      void refreshSemanticAvailability();
    }
  }
);


bindSearchFilters();
syncFiltersToSearchMode(
  selectedSearchMode
);


renderSearchEngineIndicator();
void refreshSemanticAvailability({
  force:
    true
});


if (qwen3OptIn) {
  qwen3Experiment
    .classList
    .remove("hidden");

  qwen3Start
    .addEventListener(
      "click",
      runQwen3Rerank
    );

  qwen3Cancel
    .addEventListener(
      "click",
      () => {
        qwen3Progress.textContent =
          "Cancelación solicitada; terminará después de la operación actual.";

        qwen3Controller
          ?.abort();
      }
    );

  resetQwen3Experiment();
}


try {
  philosophyMap =
    await loadMap();

  const authorRequest =
    authorWorksRequestFromLocation(
      window.location.search
    );

  if (authorRequest) {
    researchWorkspace
      ?.classList
      .remove("hidden");

    await openExclusiveAuthorByName(
      authorRequest.name,
      null,
      authorRequest
    );
  } else {
    status.textContent =
      "";
  }
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


udegModal
  ?.addEventListener(
    "click",
    event => {
      if (
        event.target
          .closest(
            "[data-close-udeg]"
          )
      ) {
        closeUdegPopup();
      }
    }
  );


document.addEventListener(
  "keydown",
  event => {
    if (
      event.key !==
      "Escape"
    ) {
      return;
    }


    if (
      udegModal &&
      !udegModal
        .classList
        .contains(
          "hidden"
        )
    ) {
      closeUdegPopup();
      return;
    }


    if (
      recordModal &&
      !recordModal
        .classList
        .contains(
          "hidden"
        )
    ) {
      closeRecord();
    }
  }
);

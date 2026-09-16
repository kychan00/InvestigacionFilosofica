import { searchPhilosophy } from "../../src/core/search-engine.js";

const button = document.querySelector("#start");
const progress = document.querySelector("#progress");
const status = document.querySelector("#status");
const logElement = document.querySelector("#log");

function log(message) {
  const time = new Date().toLocaleTimeString();
  logElement.textContent += `[${time}] ${message}\n`;
  logElement.scrollTop = logElement.scrollHeight;
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function normalizeDoi(value) {
  return String(value || "").trim().toLowerCase()
    .replace(/^https?:\/\/doi\.org\//, "")
    .replace(/^doi:\s*/, "");
}

function normalizeIdText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function stableRecordId(item) {
  const doi = normalizeDoi(item.doi);
  if (doi) return `doi:${doi}`;
  const possibleOpenAlex = [item.id, item.urls?.canonical, ...(item.sourceRecords || []).map(source => source.sourceId)];
  for (const candidate of possibleOpenAlex) {
    const value = String(candidate || "").trim();
    const match = value.match(/(?:openalex\.org\/)?(W\d+)/i);
    if (match) return `openalex:${match[1].toUpperCase()}`;
  }
  for (const source of item.sourceRecords || []) {
    if (source.provider && source.sourceId) {
      return `source:${normalizeIdText(source.provider)}:${encodeURIComponent(String(source.sourceId))}`;
    }
  }
  if (item.id) return `id:${encodeURIComponent(String(item.id))}`;
  if (item.urls?.canonical) return `url:${item.urls.canonical}`;
  const author = item.authors?.[0]?.name || "";
  return ["synthetic", normalizeIdText(item.title), item.year || "na", normalizeIdText(author)].join(":");
}

function serializeResult(query, condition, orderPosition, maxQueries, item, rank) {
  return {
    query_id: query.id,
    query: query.query,
    query_language: query.language,
    family: query.family,
    condition,
    order_position: orderPosition,
    max_queries: maxQueries,
    rank,
    record_id: stableRecordId(item),
    title: item.title || "",
    authors: (item.authors || []).map(author => author.name).filter(Boolean),
    year: item.year ?? null,
    type: item.type || null,
    language: item.language || null,
    doi: item.doi || null,
    journal: item.journal || null,
    publisher: item.publisher || null,
    abstract: item.abstract || null,
    citedBy: item.citedBy ?? null,
    providers: item.providers || [],
    matchedQueries: (item.matchedQueries || []).map(match => ({
      query: match.query || "",
      type: match.type || null,
      weight: match.weight ?? null,
      reason: match.reason || null,
    })),
    score: item.relevanceScore ?? null,
    relevanceLevel: item.relevanceLevel || null,
    ranking: item.ranking || null,
    urls: item.urls || null,
  };
}

function executionSequence(queries) {
  const sequence = [];
  queries.forEach((query, queryIndex) => {
    const order = queryIndex % 2 === 0 ? ["A", "B"] : ["B", "A"];
    for (const condition of order) {
      sequence.push({
        query,
        condition,
        orderPosition: sequence.length,
        maxQueries: condition === "A" ? 1 : 5,
      });
    }
  });
  return sequence;
}

async function run() {
  button.disabled = true;
  logElement.textContent = "";
  try {
    status.textContent = "Cargando validación congelada…";
    const [queriesResponse, mapResponse] = await Promise.all([
      fetch("/benchmark/validation-multilingual-ab-v1.queries.json", { cache: "no-store" }),
      fetch("/src/data/philosophy-map.json", { cache: "no-store" }),
    ]);
    if (!queriesResponse.ok) throw new Error("No pude cargar las consultas de validación");
    if (!mapResponse.ok) throw new Error("No pude cargar philosophy-map.json");

    const validation = await queriesResponse.json();
    const philosophyMap = await mapResponse.json();
    const sequence = executionSequence(validation.queries);
    const session = await postJson("/__benchmark/start", {});
    const completed = new Set(session.completedPairKeys || []);

    progress.max = sequence.length;
    progress.value = completed.size;
    log(`run=${session.runName}`);
    log(`runtime=${session.runtimeCommit}`);
    log(`queries=${validation.queries.length}`);
    log(`paired_conditions=${sequence.length}`);
    if (completed.size) log(`resume=${completed.size} conditions`);

    for (const step of sequence) {
      const { query, condition, orderPosition, maxQueries } = step;
      const key = `${query.id}:${condition}`;
      if (completed.has(key)) continue;

      status.textContent = `${orderPosition + 1}/${sequence.length}\n${query.id} · condición ${condition}\n${query.query}`;
      log(`START ${key} · maxQueries=${maxQueries} · ${query.query}`);

      const response = await searchPhilosophy(query.query, philosophyMap, {
        maxQueries,
        openAlexPhilosophy: { enabled: true, rows: 12 },
        cucshFilosofia: { enabled: true, rows: 8 },
        openAlex: { enabled: false, perPage: 12 },
        crossref: { enabled: true, rows: 12 },
        internetArchive: { enabled: true, rows: 6 },
        delayBetweenExpansions: 600,
        onProgress(state) {
          status.textContent = `${orderPosition + 1}/${sequence.length}\n${query.id} · condición ${condition}\n${query.query}\nexpansión ${state.completed}/${state.total}`;
        },
      });

      if (response.errors?.length) {
        console.error(response.errors);
        throw new Error(`${key}: falló una fuente. El run queda pausado para no congelar datos incompletos.`);
      }

      const poolDepth = validation.evaluation?.poolDepth || 20;
      const rows = response.results
        .slice(0, poolDepth)
        .map((item, resultIndex) => serializeResult(query, condition, orderPosition, maxQueries, item, resultIndex + 1));

      const ids = new Set();
      for (const row of rows) {
        if (ids.has(row.record_id)) throw new Error(`${key}: record_id duplicado: ${row.record_id}`);
        ids.add(row.record_id);
      }

      await postJson("/__benchmark/query", {
        queryId: query.id,
        condition,
        orderPosition,
        rows,
        sourceErrors: response.errors || [],
      });

      completed.add(key);
      progress.value = completed.size;
      log(`PASS ${key} · rows=${rows.length}`);
      await sleep(350);
    }

    status.textContent = "Finalizando run A/B…";
    const final = await postJson("/__benchmark/finalize", {});
    progress.value = sequence.length;
    status.textContent = `VALIDACIÓN A/B CONGELADA\n${final.run}`;
    log(`FINAL rows=${final.rows}`);
    log(`RUN ${final.run}`);
    log(`META ${final.metadata}`);
  } catch (error) {
    console.error(error);
    status.textContent = `ERROR\n${error.message}`;
    log(`ERROR ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

button.addEventListener("click", run);

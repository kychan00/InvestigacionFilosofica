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

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
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

  const possibleOpenAlex = [
    item.id,
    item.urls?.canonical,
    ...(item.sourceRecords || []).map(source => source.sourceId),
  ];
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

function baselineScore(item) {
  const base = Number(item.ranking?.baseScore ?? item.relevanceScore ?? 0);
  const v2 = Number(item.ranking?.v2Adjustment ?? 0);
  return clamp(base + v2);
}

function conjunctionScore(item) {
  return clamp(Number(item.rankingSortScore ?? item.relevanceScore ?? 0));
}

function rankCondition(results, condition) {
  const scoreFn = condition === "A" ? baselineScore : conjunctionScore;
  return results
    .map(item => ({ item, recordId: stableRecordId(item), sortScore: scoreFn(item) }))
    .sort((a, b) => b.sortScore - a.sortScore || a.recordId.localeCompare(b.recordId));
}

function serializeResult(query, condition, item, rank, sortScore) {
  return {
    query_id: query.id,
    query: query.query,
    query_language: query.language,
    family: query.family,
    condition,
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
    score: sortScore,
    production_score: item.relevanceScore ?? null,
    production_sort_score: item.rankingSortScore ?? null,
    relevanceLevel: item.relevanceLevel || null,
    ranking: item.ranking || null,
    urls: item.urls || null,
  };
}

async function run() {
  button.disabled = true;
  logElement.textContent = "";

  try {
    status.textContent = "Cargando validación prerregistrada…";
    const [queriesResponse, mapResponse] = await Promise.all([
      fetch("/benchmark/validation-interdisciplinary-conjunction-v1.queries.json", { cache: "no-store" }),
      fetch("/src/data/philosophy-map.json", { cache: "no-store" }),
    ]);
    if (!queriesResponse.ok) throw new Error("No pude cargar las consultas de validación");
    if (!mapResponse.ok) throw new Error("No pude cargar philosophy-map.json");

    const validation = await queriesResponse.json();
    const philosophyMap = await mapResponse.json();
    const session = await postJson("/__benchmark/start", {});
    const completed = new Set(session.completedQueryIds || []);
    const poolDepth = session.poolDepth;

    progress.max = validation.queries.length;
    progress.value = completed.size;
    log(`run=${session.runName}`);
    log(`runtime=${session.runtimeCommit}`);
    log(`queries=${validation.queries.length}`);
    log(`same_pool=true`);
    if (completed.size) log(`resume=${completed.size} queries`);

    for (let index = 0; index < validation.queries.length; index++) {
      const query = validation.queries[index];
      if (completed.has(query.id)) continue;

      status.textContent = `${index + 1}/${validation.queries.length}\n${query.id}\n${query.query}`;
      log(`START ${query.id} · ${query.query}`);

      const response = await searchPhilosophy(query.query, philosophyMap, {
        maxQueries: 5,
        openAlexPhilosophy: { enabled: true, rows: 12 },
        cucshFilosofia: { enabled: true, rows: 8 },
        openAlex: { enabled: false, perPage: 12 },
        crossref: { enabled: true, rows: 12 },
        internetArchive: { enabled: true, rows: 6 },
        delayBetweenExpansions: 600,
        onProgress(state) {
          status.textContent = `${index + 1}/${validation.queries.length}\n${query.id}\n${query.query}\nexpansión ${state.completed}/${state.total}`;
        },
      });

      if (response.errors?.length) {
        console.error(response.errors);
        throw new Error(`${query.id}: falló una fuente. El run queda pausado para no congelar datos incompletos.`);
      }

      const candidatePoolIds = response.results.map(stableRecordId);
      if (new Set(candidatePoolIds).size !== candidatePoolIds.length) {
        throw new Error(`${query.id}: stable record id collision in shared candidate pool`);
      }

      const conditions = {};
      for (const condition of ["A", "B"]) {
        const ranked = rankCondition(response.results, condition);
        conditions[condition] = ranked.slice(0, poolDepth).map((entry, rowIndex) =>
          serializeResult(query, condition, entry.item, rowIndex + 1, entry.sortScore)
        );
      }

      await postJson("/__benchmark/query", {
        queryId: query.id,
        rowsA: conditions.A,
        rowsB: conditions.B,
        retrievedCandidates: response.results.length,
        candidatePoolIds,
        sourceErrors: response.errors || [],
        expansions: response.expansions || [],
      });

      completed.add(query.id);
      progress.value = completed.size;
      const aTop = new Set(conditions.A.slice(0, 10).map(row => row.record_id));
      const bTop = new Set(conditions.B.slice(0, 10).map(row => row.record_id));
      const changed = [...aTop].filter(id => !bTop.has(id)).length + [...bTop].filter(id => !aTop.has(id)).length;
      log(`PASS ${query.id} · candidates=${response.results.length} · changedTop10Pairs=${changed}`);
      await sleep(350);
    }

    status.textContent = "Finalizando validación…";
    const final = await postJson("/__benchmark/finalize", {});
    progress.value = validation.queries.length;
    status.textContent = `VALIDACIÓN CONGELADA\n${final.run}`;
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

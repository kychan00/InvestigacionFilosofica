import { searchPhilosophy } from '../../../src/core/search-engine.js';

const button = document.querySelector('#start');
const progress = document.querySelector('#progress');
const status = document.querySelector('#status');
const logElement = document.querySelector('#log');

function log(message) {
  const time = new Date().toLocaleTimeString();
  logElement.textContent += `[${time}] ${message}\n`;
  logElement.scrollTop = logElement.scrollHeight;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function normalizeDoi(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/^https?:\/\/doi\.org\//u, '')
    .replace(/^doi:\s*/u, '');
}

function normalizeIdText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 180);
}

function stableRecordId(item) {
  const doi = normalizeDoi(item.doi);
  if (doi) return `doi:${doi}`;

  const possibleOpenAlex = [
    item.id,
    item.urls?.canonical,
    ...(item.sourceRecords || []).map((source) => source.sourceId),
  ];
  for (const candidate of possibleOpenAlex) {
    const value = String(candidate || '').trim();
    const match = value.match(/(?:openalex\.org\/)?(W\d+)/iu);
    if (match) return `openalex:${match[1].toUpperCase()}`;
  }

  for (const source of item.sourceRecords || []) {
    if (source.provider && source.sourceId) {
      return `source:${normalizeIdText(source.provider)}:${encodeURIComponent(String(source.sourceId))}`;
    }
  }

  if (item.id) return `id:${encodeURIComponent(String(item.id))}`;
  if (item.urls?.canonical) return `url:${item.urls.canonical}`;
  const author = item.authors?.[0]?.name || '';
  return ['synthetic', normalizeIdText(item.title), item.year || 'na', normalizeIdText(author)].join(':');
}

function serializeResult(query, item, rank) {
  return {
    query_id: query.id,
    query: query.query,
    query_language: query.language,
    family: query.family,
    intent: query.intent,
    rank,
    record_id: stableRecordId(item),
    title: item.title || '',
    authors: (item.authors || []).map((author) => author.name).filter(Boolean),
    year: item.year ?? null,
    type: item.type || null,
    language: item.language || null,
    doi: item.doi || null,
    journal: item.journal || null,
    publisher: item.publisher || null,
    abstract: item.abstract || null,
    citedBy: item.citedBy ?? null,
    providers: item.providers || [],
    matchedQueries: (item.matchedQueries || []).map((match) => ({
      query: match.query || '',
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

async function run() {
  button.disabled = true;
  logElement.textContent = '';

  try {
    status.textContent = 'Cargando preregistro y mapa…';
    const [preregResponse, mapResponse] = await Promise.all([
      fetch('/benchmark/qwen3/validation/qwen3-reranker-v1-holdout.preregistered.json', { cache: 'no-store' }),
      fetch('/src/data/philosophy-map.json', { cache: 'no-store' }),
    ]);
    if (!preregResponse.ok) throw new Error('No pude cargar el preregistro del holdout');
    if (!mapResponse.ok) throw new Error('No pude cargar philosophy-map.json');

    const prereg = await preregResponse.json();
    const philosophyMap = await mapResponse.json();
    const session = await postJson('/__qwen3_holdout/start', {});
    const completed = new Set(session.completedQueryIds || []);

    progress.max = prereg.queries.length;
    progress.value = completed.size;
    log(`run=${session.runName}`);
    log(`runtime=${session.runtimeCommit}`);
    log(`prereg_sha256=${session.preregSha256}`);
    log(`queries=${prereg.queries.length}`);
    if (completed.size) log(`resume=${completed.size} queries`);

    for (let index = 0; index < prereg.queries.length; index += 1) {
      const query = prereg.queries[index];
      if (completed.has(query.id)) continue;

      status.textContent = `${index + 1}/${prereg.queries.length}\n${query.id}\n${query.query}`;
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
          status.textContent = `${index + 1}/${prereg.queries.length}\n${query.id}\n${query.query}\nexpansión ${state.completed}/${state.total}`;
        },
      });

      if (response.errors?.length) {
        console.error(response.errors);
        throw new Error(`${query.id}: falló una fuente. El run queda pausado.`);
      }

      const poolDepth = prereg.query_design.retrieval_pool_depth;
      const rows = response.results
        .slice(0, poolDepth)
        .map((item, resultIndex) => serializeResult(query, item, resultIndex + 1));

      const ids = new Set();
      for (const row of rows) {
        if (ids.has(row.record_id)) throw new Error(`${query.id}: record_id duplicado: ${row.record_id}`);
        ids.add(row.record_id);
      }

      await postJson('/__qwen3_holdout/query', {
        queryId: query.id,
        rows,
        sourceErrors: response.errors || [],
      });

      completed.add(query.id);
      progress.value = completed.size;
      log(`PASS ${query.id} · rows=${rows.length}`);
      await sleep(350);
    }

    status.textContent = 'Finalizando retrieval holdout…';
    const final = await postJson('/__qwen3_holdout/finalize', {});
    progress.value = prereg.queries.length;
    status.textContent = `RETRIEVAL HOLDOUT CONGELADO\n${final.run}`;
    log(`FINAL rows=${final.rows}`);
    log(`sha256=${final.runSha256}`);
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

button.addEventListener('click', run);

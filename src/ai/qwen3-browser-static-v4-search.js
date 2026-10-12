const DEFAULT_BASE_URL =
  "https://huggingface.co/datasets/CristianPelayo/openalex-philosophy/resolve/main/semantic-retrieval/v3.3/browser-static-v4/20261010-v4";


function joinUrl(base, path) {
  return `${base.replace(/\/$/, "")}/${path}`;
}


function normalize(values) {
  const vector = values instanceof Float32Array ? values : Float32Array.from(values);
  let squared = 0;
  for (const value of vector) squared += value * value;
  const norm = Math.sqrt(squared) || 1;
  const output = new Float32Array(vector.length);
  for (let index = 0; index < vector.length; index += 1) {
    output[index] = vector[index] / norm;
  }
  return output;
}


export function stableTopK(scores, ids, limit) {
  return Array.from(ids, (id, offset) => ({ id: Number(id), score: scores[offset] }))
    .sort((left, right) => right.score - left.score || left.id - right.id)
    .slice(0, limit);
}


function dotFloat(left, right, offset = 0) {
  let score = 0;
  for (let index = 0; index < left.length; index += 1) {
    score += left[index] * right[offset + index];
  }
  return score;
}


function matchesFilters(document, filters = {}) {
  if (filters.year_from != null && document.year < filters.year_from) return false;
  if (filters.year_to != null && document.year > filters.year_to) return false;
  if (filters.languages?.length && !filters.languages.includes(document.language)) return false;
  for (const key of ["source", "publication_type"]) {
    const accepted = filters[`${key}s`] || (filters[key] ? [filters[key]] : null);
    if (accepted?.length && !accepted.includes(document[key])) return false;
  }
  for (const key of ["author", "journal", "topic"]) {
    if (!filters[key]) continue;
    const needle = String(filters[key]).toLocaleLowerCase();
    const values = key === "author" ? document.authors : key === "topic" ? document.topics : [document.journal];
    if (!(values || []).some(value => String(value || "").toLocaleLowerCase().includes(needle))) {
      return false;
    }
  }
  return true;
}


async function fetchOk(fetchImpl, url) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Static artifact fetch failed (${response.status}): ${url}`);
  return response;
}


async function gunzipText(response) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("This browser does not support DecompressionStream('gzip')");
  }
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}


export class BrowserStaticV4Search {
  constructor({ baseUrl = DEFAULT_BASE_URL, fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
    this.manifest = null;
    this.centroids = null;
    this.clusterCache = new Map();
    this.metadataCache = new Map();
  }

  async initialize() {
    if (this.manifest) return this.manifest;
    const manifestResponse = await fetchOk(this.fetchImpl, joinUrl(this.baseUrl, "manifest.json"));
    const manifest = await manifestResponse.json();
    if (manifest.schema_version !== "qwen3-browser-semantic-static-artifacts-v4") {
      throw new Error(`Unsupported static manifest: ${manifest.schema_version}`);
    }
    if (manifest.dimension !== 1024 || manifest.routing?.cluster_count !== 256) {
      throw new Error("Static manifest dimensions do not match the v4 contract");
    }
    const centroidResponse = await fetchOk(
      this.fetchImpl,
      joinUrl(this.baseUrl, manifest.centroids.path)
    );
    const centroidBuffer = await centroidResponse.arrayBuffer();
    if (centroidBuffer.byteLength !== manifest.centroids.bytes) {
      throw new Error("Centroid payload size mismatch");
    }
    this.centroids = new Float32Array(centroidBuffer);
    this.manifest = manifest;
    return manifest;
  }

  selectedClusters(query) {
    const scores = new Float32Array(this.manifest.routing.cluster_count);
    const dimension = this.manifest.dimension;
    for (let cluster = 0; cluster < scores.length; cluster += 1) {
      scores[cluster] = dotFloat(query, this.centroids, cluster * dimension);
    }
    return stableTopK(scores, Uint32Array.from(scores.keys()), this.manifest.routing.nprobe)
      .map(item => item.id);
  }

  async loadCluster(cluster) {
    if (this.clusterCache.has(cluster)) return await this.clusterCache.get(cluster);
    const record = this.manifest.clusters[cluster];
    const pending = Promise.all([
      fetchOk(this.fetchImpl, joinUrl(this.baseUrl, record.ids.path)).then(response => response.arrayBuffer()),
      fetchOk(this.fetchImpl, joinUrl(this.baseUrl, record.vectors.path)).then(response => response.arrayBuffer())
    ]).then(([idsBuffer, vectorsBuffer]) => {
      if (idsBuffer.byteLength !== record.ids.bytes || vectorsBuffer.byteLength !== record.vectors.bytes) {
        throw new Error(`Static cluster ${cluster} payload size mismatch`);
      }
      const ids = new Uint32Array(idsBuffer);
      const vectors = new Int8Array(vectorsBuffer);
      if (ids.length !== record.count || vectors.length !== record.count * this.manifest.dimension) {
        throw new Error(`Static cluster ${cluster} shape mismatch`);
      }
      return { ids, vectors };
    });
    this.clusterCache.set(cluster, pending);
    return await pending;
  }

  async loadMetadataPage(page) {
    if (this.metadataCache.has(page)) return await this.metadataCache.get(page);
    const record = this.manifest.metadata.pages[page];
    const pending = fetchOk(this.fetchImpl, joinUrl(this.baseUrl, record.path))
      .then(gunzipText)
      .then(text => new Map(
        text.trim().split("\n").filter(Boolean).map(line => {
          const document = JSON.parse(line);
          return [document.vector_id, document];
        })
      ));
    this.metadataCache.set(page, pending);
    return await pending;
  }

  async search(queryEmbedding, { limit = 15, filters = {}, onProgress = () => {} } = {}) {
    await this.initialize();
    const query = normalize(queryEmbedding);
    if (query.length !== this.manifest.dimension) {
      throw new Error(`Expected ${this.manifest.dimension} query dimensions, received ${query.length}`);
    }
    const clusters = this.selectedClusters(query);
    onProgress({ stage: "routing", selected_clusters: clusters.length });
    const loaded = [];
    for (let offset = 0; offset < clusters.length; offset += 1) {
      const cluster = clusters[offset];
      loaded.push(await this.loadCluster(cluster));
      onProgress({ stage: "shards", loaded: offset + 1, total: clusters.length });
    }
    const candidateCount = loaded.reduce((total, item) => total + item.ids.length, 0);
    const ids = new Uint32Array(candidateCount);
    const scores = new Float32Array(candidateCount);
    const dimension = this.manifest.dimension;
    let candidateOffset = 0;
    for (const cluster of loaded) {
      for (let row = 0; row < cluster.ids.length; row += 1) {
        ids[candidateOffset] = cluster.ids[row];
        scores[candidateOffset] = dotFloat(query, cluster.vectors, row * dimension) / 127;
        candidateOffset += 1;
      }
    }
    const ranked = stableTopK(scores, ids, Math.max(50, limit));
    const pages = [...new Set(ranked.map(item => Math.floor(item.id / this.manifest.metadata.page_size)))];
    onProgress({ stage: "metadata", pages: pages.length });
    const pageMaps = await Promise.all(pages.map(page => this.loadMetadataPage(page)));
    const documents = new Map();
    for (const page of pageMaps) for (const [id, document] of page) documents.set(id, document);
    return {
      schema_version: "qwen3-browser-semantic-static-search-result-v4",
      artifact_version: this.manifest.artifact_version,
      selected_clusters: clusters,
      candidate_count: candidateCount,
      results: ranked
        .map(item => ({ ...documents.get(item.id), semantic_score: item.score }))
        .filter(document => document.id && matchesFilters(document, filters))
        .slice(0, limit)
    };
  }
}


export { DEFAULT_BASE_URL, matchesFilters, normalize };

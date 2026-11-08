import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const readJson = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const contract = readJson("benchmark/research-atlas/v12/preflight-contract.json");
const manifest = readJson("benchmark/semantic-retrieval/browser-static-v4/artifact-manifest.json");
const publication = readJson("benchmark/semantic-retrieval/browser-static-v4/publication.json");
const ra11 = readJson("benchmark/research-atlas/v11/work-first-policy.json");

test("RA12-A: V4 source lineage remains immutable and independently pinned", () => {
  assert.equal(contract.phase, "RA12-A");
  assert.equal(contract.state, "documentation-only");
  assert.equal(contract.source.revision, publication.revision);
  assert.equal(contract.source.repository, publication.repository);
  assert.equal(contract.source.prefix, publication.path);
  assert.equal(contract.source.manifestSha256, publication.manifest_sha256);
  assert.equal(contract.source.sourceFaissSha256, manifest.source.faiss_sha256);
  assert.equal(contract.source.sourceMetadataSqliteSha256, manifest.source.metadata_sqlite_sha256);
  assert.equal(contract.source.referenceModelRevision, manifest.embedding.reference_revision);
  assert.equal(manifest.schema_version, "qwen3-browser-semantic-static-artifacts-v4");
});

test("RA12-A: every frozen V4 cluster ID and vector byte count is consistent", () => {
  const shape = contract.shape;
  assert.equal(shape.documentCount, manifest.document_count);
  assert.equal(shape.dimension, manifest.dimension);
  assert.equal(shape.dtype, manifest.quantization.dtype);
  assert.equal(shape.quantizationScale, manifest.quantization.scale);
  assert.equal(shape.normalization, manifest.quantization.normalization);
  assert.equal(shape.clusterCount, manifest.clusters.length);
  assert.equal(shape.clusterCount, manifest.routing.cluster_count);
  let documents = 0;
  let idBytes = 0;
  let vectorBytes = 0;
  let maxVectorBytes = 0;
  for (const [index, cluster] of manifest.clusters.entries()) {
    assert.equal(cluster.cluster, index);
    assert.equal(cluster.ids.bytes, cluster.count * 4);
    assert.equal(cluster.vectors.bytes, cluster.count * shape.dimension);
    assert.equal(cluster.payload_bytes, cluster.ids.bytes + cluster.vectors.bytes);
    documents += cluster.count;
    idBytes += cluster.ids.bytes;
    vectorBytes += cluster.vectors.bytes;
    maxVectorBytes = Math.max(maxVectorBytes, cluster.vectors.bytes);
  }
  assert.equal(documents, shape.documentCount);
  assert.equal(idBytes, shape.clusterIdsByteCount);
  assert.equal(vectorBytes, shape.vectorBytes);
  assert.equal(maxVectorBytes, shape.maxClusterVectorBytes);
  assert.equal(vectorBytes + idBytes, manifest.totals.vector_payload_bytes);
});

test("RA12-A: all metadata pages partition the vector_id domain contiguously", () => {
  const { pages, page_size: pageSize } = manifest.metadata;
  assert.equal(pageSize, contract.shape.metadataPageSize);
  assert.equal(pages.length, contract.shape.metadataPageCount);
  assert.equal(contract.shape.vectorIdMin, 0);
  assert.equal(contract.shape.vectorIdMax, contract.shape.documentCount - 1);
  let cursor = 0;
  let gzipBytes = 0;
  for (const page of pages) {
    assert.equal(page.first_vector_id, cursor);
    assert.equal(page.last_vector_id, cursor + page.count - 1);
    assert.ok(page.count > 0 && page.count <= pageSize);
    cursor += page.count;
    gzipBytes += page.bytes;
  }
  assert.equal(cursor, contract.shape.documentCount);
  assert.equal(gzipBytes, contract.shape.compressedMetadataBytes);
  assert.equal(gzipBytes, manifest.totals.metadata_payload_bytes);
});

test("RA12-A: source builder actually exposes the identity and positional fields needed", () => {
  const builder = readFileSync(new URL("scripts/retrieval/build_browser_static_v4_artifacts.py", root), "utf8");
  assert.match(builder, /SELECT vector_id, id, title, abstract/);
  assert.match(builder, /openalex_id, crossref_id/);
  assert.match(builder, /ORDER BY vector_id/);
  assert.match(builder, /positions = np\.flatnonzero\(assignments == cluster\)/);
  assert.match(builder, /positions\.astype\("<u4", copy=False\)/);
  assert.match(builder, /quantize\(vectors\[selected\]\)/);
});

test("RA12-A: no runtime activation and no false authority / retrieval claims", () => {
  assert.equal(contract.identity.primaryJoinKey, "openalex_id");
  assert.equal(contract.identity.lookupPublished, false);
  assert.equal(contract.extraction.productionEnabled, false);
  assert.equal(contract.atlas.runtimeEnabled, false);
  assert.equal(contract.atlas.modelDownloadAllowed, false);
  assert.equal(contract.atlas.additionalSearchOnTabToggle, false);
  assert.equal(contract.atlas.titleAbstractFallback, ra11.topology.method);
  assert.equal(contract.atlas.topK, ra11.topology.topK);
  assert.equal(contract.atlas.maximumEdges, ra11.topology.maximumEdges);
  assert.equal(contract.atlas.humanAuthorAuditRequired, false);
  assert.equal(contract.extraction.rejectWholeFile200, true);
  for (const result of Object.values(contract.gates)) assert.equal(result, false);
});

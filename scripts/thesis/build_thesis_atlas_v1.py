#!/usr/bin/env python3
"""Build the experimental 2D atlas for the immutable UdeG Humanities thesis V1.

Scientific boundary:
- topology input is ONLY normalized thesis title;
- program, degree, unit, people, abstract and keywords never affect position,
  nearest-neighbor similarity or clustering;
- metadata may be carried only for overlays and detail panels;
- no PDF, extracted full text, raw SourceRecord or vector payload is published.

The atlas is explicitly experimental until the frozen topology/projection
benchmarks are completed. It must never be interpreted as academic quality,
importance, originality or an admission decision.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.cluster import HDBSCAN
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.manifold import TSNE, trustworthiness
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import normalize

from build_thesis_demo_index_v1 import build_index, verified_release

SCHEMA = "thesis-atlas-index-v1"
MANIFEST_SCHEMA = "thesis-atlas-manifest-v1"
BUILD_REVISION = "2026-11-03.t5aa-v1"
STOP_WORDS_REVISION = "atlas-stopwords-v1"
TOKEN = re.compile(r"[\W_]+", re.UNICODE)

# Deliberately small and frozen. High document-frequency terms are also
# controlled by max_df; this list mainly removes functional words that would
# otherwise dominate proposed labels.
STOP_WORDS = frozenset(
    """
    a al algo algunas algunos ante antes como con contra cual cuando de del
    desde donde durante e el ella ellas ellos en entre era es esa ese eso esta
    estas este estos fue ha hacia hasta la las lo los mas más mediante mi muy
    no o para pero por porque que qué se sin sobre su sus un una unas unos y ya
    the of and in to for on from by with as an a is are be this that these those
    study analysis research case approach towards through between into
    estudio analisis análisis investigacion investigación caso propuesta
    aproximacion aproximación universidad guadalajara jalisco mexico méxico
    """.split()
)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        + "\n",
        encoding="utf-8",
    )


def normalize_title(value: str) -> str:
    value = unicodedata.normalize("NFKC", str(value or "")).casefold()
    value = " ".join(value.split())
    value = TOKEN.sub(" ", value)
    return " ".join(value.split())


def require_config(config: dict[str, Any], release: dict[str, Any]) -> None:
    if config.get("schemaVersion") != "thesis-atlas-experiment-contract-v1":
        raise ValueError("Unsupported atlas experiment contract")
    if config.get("revision") != BUILD_REVISION:
        raise ValueError("Unexpected atlas build revision")
    if config.get("sourceRelease") != release.get("releaseTag"):
        raise ValueError("Atlas source release mismatch")
    contract = config.get("topologyInputContract") or {}
    if contract.get("version") != "normalized-title-v1":
        raise ValueError("Topology input contract must be normalized-title-v1")
    if contract.get("fields") != ["title"]:
        raise ValueError("Topology input may use title only")
    representation = config.get("representation") or {}
    if representation.get("stopWordsRevision") != STOP_WORDS_REVISION:
        raise ValueError("Atlas stop-word revision mismatch")


def vectorizer_from(config: dict[str, Any]) -> TfidfVectorizer:
    rep = config["representation"]
    return TfidfVectorizer(
        lowercase=False,  # normalize_title already controls normalization.
        strip_accents=None,
        stop_words=sorted(STOP_WORDS),
        ngram_range=tuple(rep["ngramRange"]),
        min_df=int(rep["minDf"]),
        max_df=float(rep["maxDf"]),
        max_features=int(rep["maxFeatures"]),
        sublinear_tf=bool(rep["sublinearTf"]),
        norm="l2",
        dtype=np.float64,
    )


def normalized_coordinates(values: np.ndarray) -> np.ndarray:
    if values.shape[1] != 2:
        raise ValueError("Projection must have two dimensions")
    minimum = values.min(axis=0)
    maximum = values.max(axis=0)
    center = (minimum + maximum) / 2.0
    scale = float(max(maximum[0] - minimum[0], maximum[1] - minimum[1]) / 2.0)
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError("Degenerate 2D atlas projection")
    return (values - center) / scale


def neighbor_preservation(
    high_neighbors: list[list[int]], coords: np.ndarray, k: int
) -> float:
    low = NearestNeighbors(n_neighbors=k + 1, metric="euclidean")
    low.fit(coords)
    indexes = low.kneighbors(return_distance=False)
    scores = []
    for row, original in zip(indexes, high_neighbors):
        low_set = {int(i) for i in row if int(i) not in original[:0]}
        # kneighbors on training data can omit self depending on sklearn path;
        # trim after explicitly removing the work index in caller below.
        scores.append((low_set, set(original)))
    # Caller-specific self identity is not available in the sets above.
    # Recompute with deterministic row indices for clarity.
    preserved = 0
    total = len(high_neighbors) * k
    for idx, row in enumerate(indexes):
        low_set = [int(i) for i in row if int(i) != idx][:k]
        preserved += len(set(low_set) & set(high_neighbors[idx]))
    return preserved / total if total else 0.0


def stable_cluster_ids(labels: np.ndarray, work_ids: list[str]) -> tuple[dict[int, str], dict[str, list[int]]]:
    groups: dict[int, list[int]] = defaultdict(list)
    for idx, label in enumerate(labels.tolist()):
        if int(label) >= 0:
            groups[int(label)].append(idx)
    order = sorted(groups, key=lambda label: min(work_ids[i] for i in groups[label]))
    mapping = {
        label: f"cluster:thesis-atlas-v1:{position:03d}"
        for position, label in enumerate(order, start=1)
    }
    members = {mapping[label]: groups[label] for label in order}
    return mapping, members


def proposed_cluster_terms(
    members: dict[str, list[int]],
    matrix: Any,
    feature_names: np.ndarray,
    limit: int,
) -> dict[str, list[str]]:
    output: dict[str, list[str]] = {}
    for cluster_id, rows in members.items():
        mean = np.asarray(matrix[rows].mean(axis=0)).reshape(-1)
        order = np.argsort(mean)[::-1]
        terms: list[str] = []
        for index in order:
            if mean[index] <= 0:
                break
            term = str(feature_names[index]).strip()
            if not term or term in STOP_WORDS:
                continue
            if term not in terms:
                terms.append(term)
            if len(terms) >= limit:
                break
        output[cluster_id] = terms
    return output


def same_program_neighbor_rate(records: list[dict[str, Any]], neighbors: list[list[int]]) -> float:
    comparable = 0
    same = 0
    for idx, row in enumerate(neighbors):
        program = records[idx].get("programRef")
        if not program:
            continue
        for neighbor_idx in row:
            other = records[neighbor_idx].get("programRef")
            if not other:
                continue
            comparable += 1
            same += int(program == other)
    return same / comparable if comparable else 0.0


def build_atlas(
    corpus: dict[str, Any],
    release_contract: dict[str, Any],
    registry: dict[str, Any],
    atlas_config: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    require_config(atlas_config, release_contract)
    bibliography = build_index(
        corpus,
        release_contract,
        registry=registry,
        enforce_full_release=True,
    )
    records = bibliography["records"]
    expected = int(atlas_config["expectedNodes"])
    if len(records) != expected:
        raise ValueError(f"Atlas expects {expected} INCLUDE works, got {len(records)}")

    titles = [normalize_title(record["title"]) for record in records]
    if any(not title for title in titles):
        raise ValueError("An included thesis has an empty normalized title")

    vectorizer = vectorizer_from(atlas_config)
    matrix = vectorizer.fit_transform(titles)
    if matrix.shape[0] != expected or matrix.shape[1] < 3:
        raise ValueError("Insufficient title topology feature matrix")

    requested_svd = int(atlas_config["representation"]["svdDimensions"])
    dimensions = min(requested_svd, matrix.shape[0] - 1, matrix.shape[1] - 1)
    if dimensions < 2:
        raise ValueError("Insufficient dimensions for atlas representation")
    svd = TruncatedSVD(
        n_components=dimensions,
        algorithm="randomized",
        n_iter=10,
        random_state=int(atlas_config["projection"]["randomState"]),
    )
    dense = normalize(svd.fit_transform(matrix), norm="l2")

    k = int(atlas_config["neighborhood"]["k"])
    knn = NearestNeighbors(n_neighbors=k + 1, metric="cosine")
    knn.fit(dense)
    distances, indexes = knn.kneighbors(dense)
    neighbor_indexes: list[list[int]] = []
    neighbor_similarities: list[list[float]] = []
    for row_index, (row_distances, row_indexes) in enumerate(zip(distances, indexes)):
        pairs = [
            (int(i), float(1.0 - distance))
            for distance, i in zip(row_distances, row_indexes)
            if int(i) != row_index
        ][:k]
        if len(pairs) != k:
            raise ValueError("Incomplete topology neighborhood")
        neighbor_indexes.append([item[0] for item in pairs])
        neighbor_similarities.append([max(-1.0, min(1.0, item[1])) for item in pairs])

    projection = atlas_config["projection"]
    tsne = TSNE(
        n_components=2,
        perplexity=float(projection["perplexity"]),
        learning_rate=projection["learningRate"],
        max_iter=int(projection["maxIter"]),
        init=projection["init"],
        metric=projection["metric"],
        method="barnes_hut",
        angle=0.5,
        random_state=int(projection["randomState"]),
        verbose=0,
    )
    coords_raw = tsne.fit_transform(dense)
    coords = normalized_coordinates(coords_raw)

    clustering = atlas_config["clustering"]
    clusterer = HDBSCAN(
        min_cluster_size=int(clustering["minClusterSize"]),
        min_samples=int(clustering["minSamples"]),
        metric="euclidean",
        cluster_selection_method=clustering["clusterSelectionMethod"],
        allow_single_cluster=False,
    )
    raw_labels = clusterer.fit_predict(dense)
    work_ids = [record["id"] for record in records]
    cluster_mapping, cluster_members = stable_cluster_ids(raw_labels, work_ids)
    label_terms = proposed_cluster_terms(
        cluster_members,
        matrix,
        vectorizer.get_feature_names_out(),
        int(clustering["labelTerms"]),
    )

    clusters = []
    for cluster_id, member_indexes in cluster_members.items():
        member_coords = coords[member_indexes]
        clusters.append({
            "id": cluster_id,
            "level": "topic",
            "memberCount": len(member_indexes),
            "proposedLabels": [{
                "label": " · ".join(label_terms.get(cluster_id) or ["región sin etiqueta"]),
                "status": "proposed",
                "method": "mean-tfidf-title-terms-v1",
                "evidenceTerms": label_terms.get(cluster_id) or [],
            }],
            "publishedLabelRef": None,
            "keywordEvidence": label_terms.get(cluster_id) or [],
            "centroid": {
                "x": round(float(member_coords[:, 0].mean()), 7),
                "y": round(float(member_coords[:, 1].mean()), 7),
            },
            "buildRevision": BUILD_REVISION,
        })
    clusters.sort(key=lambda item: item["id"])

    nodes = []
    for idx, record in enumerate(records):
        raw_label = int(raw_labels[idx])
        cluster_ref = cluster_mapping.get(raw_label)
        neighbors = [
            {
                "thesisRef": records[neighbor_idx]["id"],
                "similarity": round(float(similarity), 7),
            }
            for neighbor_idx, similarity in zip(
                neighbor_indexes[idx], neighbor_similarities[idx]
            )
        ]
        nodes.append({
            "id": record["id"],
            "title": record["title"],
            "authors": record["authors"],
            "year": record["year"],
            "program": record["program"],
            "programRef": record["programRef"],
            "degree": record["degree"],
            "unit": record["unit"],
            "keywords": record["keywords"][:8],
            "abstractExcerpt": record["abstractExcerpt"][:280],
            "sourceUrl": record["sourceUrl"],
            "handle": record["handle"],
            "topology": {
                "purpose": "topology",
                "inputContractVersion": atlas_config["topologyInputContract"]["version"],
                "inputHash": sha256_bytes(titles[idx].encode("utf-8")),
                "dimensions": dimensions,
                "normalization": "l2",
                "buildRevision": BUILD_REVISION,
            },
            "neighborhood": {
                "neighborRefs": [entry["thesisRef"] for entry in neighbors],
                "similarityValues": [entry["similarity"] for entry in neighbors],
                "metric": atlas_config["neighborhood"]["metric"],
                "k": k,
                "indexVersion": "sklearn-nearest-neighbors-v1",
                "embeddingVersion": atlas_config["representation"]["method"],
                "buildRevision": BUILD_REVISION,
            },
            "atlas": {
                "clusterRefs": [cluster_ref] if cluster_ref else [],
                "x": round(float(coords[idx, 0]), 7),
                "y": round(float(coords[idx, 1]), 7),
                "projectionAlgorithm": projection["algorithm"],
                "projectionVersion": "sklearn-tsne-v1",
                "clusteringAlgorithm": clustering["algorithm"],
                "clusteringVersion": "sklearn-hdbscan-v1",
                "buildRevision": BUILD_REVISION,
            },
        })

    if len({node["id"] for node in nodes}) != expected:
        raise ValueError("Atlas node identities are not unique")
    if any(not math.isfinite(node["atlas"]["x"]) or not math.isfinite(node["atlas"]["y"]) for node in nodes):
        raise ValueError("Atlas contains non-finite coordinates")

    two_d_neighbors = NearestNeighbors(n_neighbors=k + 1, metric="euclidean").fit(coords)
    two_d_indexes = two_d_neighbors.kneighbors(return_distance=False)
    preservation_hits = 0
    for idx, row in enumerate(two_d_indexes):
        low = [int(item) for item in row if int(item) != idx][:k]
        preservation_hits += len(set(low) & set(neighbor_indexes[idx]))
    preservation = preservation_hits / (expected * k)

    evaluation = {
        "trustworthinessK8": round(float(trustworthiness(dense, coords, n_neighbors=k)), 7),
        "neighborPreservationK8": round(float(preservation), 7),
        "sameProgramNeighborRate": round(
            float(same_program_neighbor_rate(records, neighbor_indexes)), 7
        ),
        "clusters": len(clusters),
        "outliers": int(np.sum(raw_labels < 0)),
        "svdExplainedVarianceRatio": round(float(svd.explained_variance_ratio_.sum()), 7),
        "benchmarkStatus": "not-yet-human-benchmarked",
    }

    output = {
        "schemaVersion": SCHEMA,
        "revision": atlas_config["revision"],
        "methodStatus": atlas_config["methodStatus"],
        "referenceOnly": True,
        "sourceRelease": release_contract["releaseTag"],
        "sourceGzipSha256": release_contract["effectiveCorpusGzipSha256"],
        "programAuthorityRevision": release_contract["programAuthorityRevision"],
        "topologyInputContract": atlas_config["topologyInputContract"],
        "representation": {
            **atlas_config["representation"],
            "actualSvdDimensions": dimensions,
            "featureCount": int(matrix.shape[1]),
        },
        "neighborhood": atlas_config["neighborhood"],
        "projection": atlas_config["projection"],
        "clustering": atlas_config["clustering"],
        "evaluation": evaluation,
        "nodes": nodes,
        "clusters": clusters,
    }
    return output, evaluation


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus-gzip", required=True, type=Path)
    parser.add_argument(
        "--release-contract",
        type=Path,
        default=Path(__file__).resolve().parent
        / "config/effective-corpus-release-t2bz-v1.json",
    )
    parser.add_argument(
        "--registry",
        type=Path,
        default=Path(__file__).resolve().parent / "config/program-authority-v1.json",
    )
    parser.add_argument(
        "--atlas-contract",
        type=Path,
        default=Path(__file__).resolve().parent / "config/thesis-atlas-v1.json",
    )
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()

    release = json.loads(args.release_contract.read_text(encoding="utf-8"))
    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    config = json.loads(args.atlas_contract.read_text(encoding="utf-8"))
    corpus = verified_release(args.corpus_gzip, release)
    atlas, evaluation = build_atlas(corpus, release, registry, config)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    index_path = args.output_dir / "index.json"
    write_json(index_path, atlas)
    if index_path.stat().st_size > 4_000_000:
        raise ValueError("Atlas public index unexpectedly exceeds 4 MB")

    manifest = {
        "schemaVersion": MANIFEST_SCHEMA,
        "revision": config["revision"],
        "phase": config["phase"],
        "methodStatus": config["methodStatus"],
        "sourceRelease": release["releaseTag"],
        "sourceGzipSha256": release["effectiveCorpusGzipSha256"],
        "atlasContractSha256": sha256_file(args.atlas_contract),
        "atlasIndexSha256": sha256_file(index_path),
        "nodes": len(atlas["nodes"]),
        "clusters": len(atlas["clusters"]),
        "outliers": evaluation["outliers"],
        "topologyInputContract": config["topologyInputContract"],
        "evaluation": evaluation,
        "referenceOnly": True,
        "pdfCopies": 0,
        "publicIndexPath": config["publicIndexPath"],
        "buildRevision": BUILD_REVISION,
    }
    manifest_path = args.output_dir / "manifest.json"
    write_json(manifest_path, manifest)

    print(json.dumps({
        "schemaVersion": SCHEMA,
        "revision": config["revision"],
        "nodes": len(atlas["nodes"]),
        "clusters": len(atlas["clusters"]),
        "outliers": evaluation["outliers"],
        "trustworthinessK8": evaluation["trustworthinessK8"],
        "neighborPreservationK8": evaluation["neighborPreservationK8"],
        "sameProgramNeighborRate": evaluation["sameProgramNeighborRate"],
        "indexBytes": index_path.stat().st_size,
        "indexSha256": manifest["atlasIndexSha256"],
        "pdfCopies": 0,
        "topologyFields": config["topologyInputContract"]["fields"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

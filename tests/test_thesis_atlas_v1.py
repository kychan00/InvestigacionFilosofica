"""T5AA atlas V1 scientific boundary and reconstruction tests."""
from __future__ import annotations

import copy
import importlib.util
import json
import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(SCRIPT_DIR))

spec = importlib.util.spec_from_file_location(
    "thesis_atlas_v1", SCRIPT_DIR / "build_thesis_atlas_v1.py"
)
atlas = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(atlas)


def fixture(count: int = 36):
    programs = [
        {
            "id": "program:filosofia",
            "canonicalName": "Licenciatura en Filosofía",
            "level": "licenciatura",
        },
        {
            "id": "program:historia",
            "canonicalName": "Maestría en Historia",
            "level": "maestria",
        },
    ]
    themes = [
        "fenomenologia cuerpo experiencia mundo vida",
        "lenguaje significado filosofia analitica argumento",
        "historia memoria archivo cultura identidad",
        "arte estetica imagen experiencia sensible",
        "territorio ciudad espacio comunidad patrimonio",
        "etica responsabilidad libertad sujeto politica",
    ]
    works = []
    for index in range(count):
        theme = themes[index % len(themes)]
        program = programs[index % len(programs)]["id"]
        works.append({
            "id": f"thesis:work:{index:08d}",
            "title": f"{theme} problema {index}",
            "date": {"value": f"{2000 + index % 24}-01-01", "quality": "valid"},
            "language": "es",
            "abstract": f"Resumen institucional {index} con información que no debe mover el mapa.",
            "keywords": [f"keyword-{index}", "metadata-only"],
            "programRef": program,
            "programRaw": "Programa original",
            "academicUnitRaw": "CUCSH",
            "persistentIdentifiers": [{
                "scheme": "handle",
                "rawValue": f"20.500.12104/{80000 + index}",
                "normalizedValue": f"20.500.12104/{80000 + index}",
            }],
            "contributions": [{
                "role": "thesis-author",
                "rawName": f"Persona {index}",
                "normalizedName": f"persona {index}",
            }],
            "admissionStatus": "include",
            "admissionExplanationCodes": ["fixture"],
        })
    release = {
        "releaseTag": "thesis-effective-corpus-v1",
        "effectiveCorpusSchemaVersion": "thesis-effective-corpus-v1",
        "programAuthorityRevision": "2026-11-03.v47",
        "metadataConfidenceRevision": "2026-11-02.v5",
        "workAdmissionDecisionRevision": "2026-11-03.t2bx-v1",
        "effectiveCorpusGzipSha256": "a" * 64,
        "worksTotal": count,
        "admissionCounts": {"include": count},
    }
    corpus = {
        "effectiveCorpusSchemaVersion": release["effectiveCorpusSchemaVersion"],
        "programAuthorityRevision": release["programAuthorityRevision"],
        "programMetadataEvidenceRevision": release["metadataConfidenceRevision"],
        "effectiveAdmissionRevision": release["workAdmissionDecisionRevision"],
        "works": works,
        "sourceRecords": [],
    }
    registry = {
        "registryRevision": release["programAuthorityRevision"],
        "programs": programs,
    }
    config = {
        "schemaVersion": "thesis-atlas-experiment-contract-v1",
        "revision": "2026-11-03.t5aa-v1",
        "phase": "T5AA",
        "sourceRelease": release["releaseTag"],
        "expectedNodes": count,
        "topologyInputContract": {
            "version": "normalized-title-v1",
            "fields": ["title"],
            "forbiddenFields": [
                "program", "programRef", "degree", "unit", "authors",
                "directors", "abstract", "abstractExcerpt", "keywords",
            ],
        },
        "representation": {
            "method": "tfidf-word-ngram",
            "ngramRange": [1, 2],
            "minDf": 1,
            "maxDf": 1.0,
            "maxFeatures": 2000,
            "sublinearTf": True,
            "stripAccents": None,
            "stopWordsRevision": "atlas-stopwords-v1",
            "svdDimensions": 12,
            "normalization": "l2",
        },
        "neighborhood": {"metric": "cosine", "k": 8},
        "projection": {
            "algorithm": "tsne",
            "dimensions": 2,
            "metric": "cosine",
            "perplexity": 6,
            "learningRate": "auto",
            "maxIter": 500,
            "init": "pca",
            "randomState": 1701,
        },
        "clustering": {
            "algorithm": "hdbscan",
            "metric": "euclidean-on-l2-normalized-svd",
            "minClusterSize": 4,
            "minSamples": 2,
            "clusterSelectionMethod": "eom",
            "labelTerms": 3,
            "labelStatus": "proposed",
        },
        "methodStatus": "experimental-not-benchmark-approved",
    }
    return corpus, release, registry, config


class ThesisAtlasV1Test(unittest.TestCase):
    def test_title_normalization_is_stable(self):
        self.assertEqual(
            atlas.normalize_title("  Fenomenología: CUERPO / Mundo-de-la-vida  "),
            "fenomenología cuerpo mundo de la vida",
        )

    def test_config_rejects_non_title_topology(self):
        _, release, _, config = fixture()
        config["topologyInputContract"]["fields"] = ["title", "abstract"]
        with self.assertRaisesRegex(ValueError, "title only"):
            atlas.require_config(config, release)

    def test_builds_reference_only_nodes_with_contract_fields(self):
        corpus, release, registry, config = fixture()
        result, evaluation = atlas.build_atlas(corpus, release, registry, config)
        self.assertEqual(len(result["nodes"]), config["expectedNodes"])
        self.assertEqual(result["topologyInputContract"]["fields"], ["title"])
        self.assertEqual(result["methodStatus"], "experimental-not-benchmark-approved")
        self.assertTrue(result["referenceOnly"])
        self.assertTrue(0 <= evaluation["neighborPreservationK8"] <= 1)
        self.assertTrue(0 <= evaluation["trustworthinessK8"] <= 1)
        for node in result["nodes"]:
            self.assertTrue(math.isfinite(node["atlas"]["x"]))
            self.assertTrue(math.isfinite(node["atlas"]["y"]))
            self.assertLessEqual(abs(node["atlas"]["x"]), 1.000001)
            self.assertLessEqual(abs(node["atlas"]["y"]), 1.000001)
            self.assertEqual(len(node["neighborhood"]["neighborRefs"]), 8)
            self.assertNotIn(node["id"], node["neighborhood"]["neighborRefs"])
            serialized = json.dumps(node)
            self.assertNotIn("pdfBytes", serialized)
            self.assertNotIn("fullText", serialized)
            self.assertNotIn("rawFields", serialized)

    def test_non_topology_metadata_cannot_move_the_map(self):
        corpus, release, registry, config = fixture()
        first, _ = atlas.build_atlas(corpus, release, registry, config)

        changed = copy.deepcopy(corpus)
        for index, work in enumerate(changed["works"]):
            work["abstract"] = "COMPLETELY DIFFERENT ABSTRACT " * 20
            work["keywords"] = ["alien", "metadata", str(index)]
            work["programRef"] = (
                "program:historia"
                if work["programRef"] == "program:filosofia"
                else "program:filosofia"
            )
            work["academicUnitRaw"] = "Unidad cambiada"
            work["contributions"][0]["rawName"] = f"Otro autor {index}"

        second, _ = atlas.build_atlas(changed, release, registry, config)
        first_topology = {
            n["id"]: (n["atlas"], n["neighborhood"], n["topology"]["inputHash"])
            for n in first["nodes"]
        }
        second_topology = {
            n["id"]: (n["atlas"], n["neighborhood"], n["topology"]["inputHash"])
            for n in second["nodes"]
        }
        self.assertEqual(first_topology, second_topology)

    def test_changing_title_changes_input_hash(self):
        corpus, release, registry, config = fixture()
        first, _ = atlas.build_atlas(corpus, release, registry, config)
        target = corpus["works"][0]["id"]
        before = next(n for n in first["nodes"] if n["id"] == target)

        changed = copy.deepcopy(corpus)
        changed["works"][0]["title"] = "ontologia ser devenir hegel dialectica absoluta"
        second, _ = atlas.build_atlas(changed, release, registry, config)
        after = next(n for n in second["nodes"] if n["id"] == target)
        self.assertNotEqual(before["topology"]["inputHash"], after["topology"]["inputHash"])

    def test_cluster_labels_are_explicitly_proposals(self):
        corpus, release, registry, config = fixture()
        result, _ = atlas.build_atlas(corpus, release, registry, config)
        for cluster in result["clusters"]:
            self.assertIsNone(cluster["publishedLabelRef"])
            for label in cluster["proposedLabels"]:
                self.assertEqual(label["status"], "proposed")
                self.assertTrue(label["evidenceTerms"])


if __name__ == "__main__":
    unittest.main()

"""RA12-C5-A exact DOI authority tests."""
from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "research-atlas"))

from resolve_ra12c5a_openalex_doi_authority import (
    AuthorityError,
    canonical_work_id,
    classify_authority,
    collect_doi_candidates,
    coverage_after_enrichment,
    normalize_response,
    request_url,
)


def build_alias_root(root: Path, rows: dict[str, tuple[int, int, int]]) -> Path:
    aliases = root / "aliases"
    aliases.mkdir(parents=True)
    grouped = {i: [] for i in range(256)}
    for work_id, (vector_id, cluster, ordinal) in rows.items():
        alias = "openalex:" + work_id
        prefix = hashlib.sha256(alias.encode("utf-8")).digest()[0]
        grouped[prefix].append([alias, work_id, vector_id, cluster, ordinal])
    for prefix in range(256):
        path = aliases / f"part-{prefix:03d}.jsonl.gz"
        with path.open("wb") as raw:
            with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as z:
                for row in sorted(grouped[prefix], key=lambda value: value[0]):
                    z.write((json.dumps(row, separators=(",", ":")) + "\n").encode("utf-8"))
    return root


class AuthorityTests(unittest.TestCase):
    def test_work_id_and_request_batch_contract(self):
        self.assertEqual(canonical_work_id("https://openalex.org/W123"), "W123")
        self.assertEqual(canonical_work_id("W456"), "W456")
        self.assertIsNone(canonical_work_id("A123"))
        url = request_url(["10.1000/a", "10.2000/b"])
        self.assertIn("per_page=100", url)
        self.assertIn("select=id%2Cdoi%2Ctitle%2Cpublication_year%2Ctype", url)
        with self.assertRaises(AuthorityError):
            request_url(["10.1000/" + str(i) for i in range(101)])

    def test_response_requires_exact_requested_doi(self):
        payload = {
            "results": [
                {"id": "https://openalex.org/W1", "doi": "https://doi.org/10.1000/A", "title": "A"},
                {"id": "https://openalex.org/W2", "doi": "https://doi.org/10.9999/unrequested", "title": "X"},
                {"id": "not-a-work", "doi": "https://doi.org/10.2000/B", "title": "B"},
            ]
        }
        mapping, ignored, anomalies = normalize_response(payload, {"10.1000/a", "10.2000/b"})
        self.assertEqual(mapping["10.1000/a"][0]["workId"], "W1")
        self.assertNotIn("10.2000/b", mapping)
        self.assertEqual(len(ignored), 1)
        self.assertEqual(ignored[0]["reason"], "unrequested-doi-overreturn")
        self.assertEqual(len(anomalies), 1)
        self.assertEqual(anomalies[0]["reason"], "invalid-openalex-work-id")

    def test_collects_crossref_doi_once_with_provenance(self):
        capture = {
            "runs": [{
                "id": "q1",
                "results": [{
                    "rank": 2,
                    "id": "crossref:10.1000/A",
                    "doi": "10.1000/A",
                    "title": "A",
                    "providers": ["Crossref"],
                    "semanticAliases": ["crossref:10.1000/a", "doi:10.1000/a"],
                }]
            }]
        }
        dois, evidence = collect_doi_candidates(capture)
        self.assertEqual(dois, ["10.1000/a"])
        self.assertEqual(evidence["10.1000/a"]["appearances"], 1)
        self.assertEqual(evidence["10.1000/a"]["providers"], ["Crossref"])
        self.assertEqual(evidence["10.1000/a"]["queryIds"], ["q1"])

    def test_classifies_existing_outside_unmatched_and_ambiguous(self):
        with tempfile.TemporaryDirectory() as raw:
            alias_root = build_alias_root(Path(raw), {"W1": (10, 3, 4)})
            dois = ["10.1/existing", "10.1/outside", "10.1/missing", "10.1/ambiguous"]
            evidence = {
                doi: {
                    "doi": doi, "queryIds": ["q"], "providers": ["Crossref"],
                    "resultIds": [], "titles": [], "ranks": [1], "appearances": 1,
                }
                for doi in dois
            }
            mapping = {
                "10.1/existing": [{"doi": "10.1/existing", "workId": "W1", "title": "E", "publicationYear": 2020, "type": "article"}],
                "10.1/outside": [{"doi": "10.1/outside", "workId": "W2", "title": "O", "publicationYear": 2021, "type": "article"}],
                "10.1/ambiguous": [
                    {"doi": "10.1/ambiguous", "workId": "W3", "title": "A", "publicationYear": 2020, "type": "article"},
                    {"doi": "10.1/ambiguous", "workId": "W4", "title": "A", "publicationYear": 2020, "type": "article"},
                ],
            }
            records = classify_authority(dois, evidence, mapping, alias_root)
            states = {item["doi"]: item["state"] for item in records}
            self.assertEqual(states["10.1/existing"], "v4-existing-by-doi")
            self.assertEqual(states["10.1/outside"], "openalex-outside-v4")
            self.assertEqual(states["10.1/missing"], "openalex-unmatched")
            self.assertEqual(states["10.1/ambiguous"], "openalex-ambiguous")
            existing = next(item for item in records if item["doi"] == "10.1/existing")
            self.assertEqual(existing["v4Location"], {
                "workId": "W1", "vectorId": 10, "cluster": 3, "ordinal": 4
            })

    def test_coverage_gain_counts_only_exact_doi_to_v4(self):
        with tempfile.TemporaryDirectory() as raw:
            alias_root = build_alias_root(Path(raw), {
                "W1": (1, 0, 0),
                "W2": (2, 0, 1),
            })
            capture = {
                "runs": [{
                    "id": "q",
                    "results": [
                        {
                            "rank": 1, "id": "https://openalex.org/W1",
                            "semanticAliases": ["openalex:W1"],
                            "overlayIdentity": "provider:x:1", "overlayTextBytes": 10,
                        },
                        {
                            "rank": 2, "id": "crossref:10.1000/b", "doi": "10.1000/b",
                            "semanticAliases": ["doi:10.1000/b"],
                            "overlayIdentity": "doi:10.1000/b", "overlayTextBytes": 10,
                        },
                        {
                            "rank": 3, "id": "crossref:10.1000/c", "doi": "10.1000/c",
                            "semanticAliases": ["doi:10.1000/c"],
                            "overlayIdentity": "doi:10.1000/c", "overlayTextBytes": 10,
                        },
                    ]
                }]
            }
            records = [
                {
                    "doi": "10.1000/b", "state": "v4-existing-by-doi",
                    "openalexWorkId": "W2",
                    "v4Location": {"workId": "W2", "vectorId": 2, "cluster": 0, "ordinal": 1},
                },
                {
                    "doi": "10.1000/c", "state": "openalex-outside-v4",
                    "openalexWorkId": "W3", "v4Location": None,
                },
            ]
            result = coverage_after_enrichment(capture, records, alias_root, [5])
            cutoff = result["cutoffs"]["5"]
            self.assertEqual(cutoff["observedResults"], 3)
            self.assertEqual(cutoff["baseDirect"], 1)
            self.assertEqual(cutoff["baseAliasEnriched"], 1)
            self.assertEqual(cutoff["overlayAfterEnrichment"], 1)
            self.assertAlmostEqual(cutoff["baseV4CoverageBeforeDoiAuthority"], 1 / 3)
            self.assertAlmostEqual(cutoff["baseV4CoverageAfterDoiAuthority"], 2 / 3)
            self.assertEqual(result["uniqueRecoveredDoiAliases"], 1)


if __name__ == "__main__":
    unittest.main()

"""Regression tests for the Philosophy thesis completeness and curated-view phase."""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THESIS = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS))

HARVEST = THESIS / "harvest_cucsh_philosophy_v1.py"
PROJECTION = THESIS / "build_philosophy_enriched_projection_v1.py"
CURATED = THESIS / "build_philosophy_curated_index_v1.py"
CONFIG = THESIS / "config" / "philosophy-official-supplement-v1.json"
CURATED_CONFIG = THESIS / "config" / "philosophy-curated-content-v1.json"
REGISTRY = THESIS / "config" / "program-authority-v1.json"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


harvest = load_module("philosophy_harvest", HARVEST)
projection = load_module("philosophy_projection", PROJECTION)
curated = load_module("philosophy_curated", CURATED)


class PhilosophyCompletenessV1Test(unittest.TestCase):
    def test_riudg_collection_parser_uses_program_column_and_handle(self):
        html = """
        <table>
          <tr>
            <th>Title</th><th>Author(s)</th><th>Other</th><th>Editor</th>
            <th>ISSN</th><th>Degree</th><th>Department</th><th>Type</th>
          </tr>
          <tr>
            <td><a href="/handle/20.500.12104/34249">Tesis filosófica</a></td>
            <td>Ana Pérez</td><td>-</td><td>-</td><td>-</td>
            <td>LICENCIATURA EN FILOSOFÍA</td><td>CUCSH</td>
            <td>Tesis de Licenciatura</td>
          </tr>
          <tr>
            <td><a href="/handle/20.500.12104/99999">Tesis jurídica</a></td>
            <td>Luis Pérez</td><td>-</td><td>-</td><td>-</td>
            <td>LICENCIATURA EN DERECHO</td><td>CUCSH</td>
            <td>Tesis de Licenciatura</td>
          </tr>
        </table>
        """
        rows = harvest.parse_riudg_collection(
            html,
            source_url="https://riudg.udg.mx/handle/20.500.12104/20979",
            level="licenciatura",
        )
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["handle"], "20.500.12104/34249")
        self.assertEqual(
            rows[0]["recordUrl"],
            "https://riudg.udg.mx/handle/20.500.12104/34249",
        )

        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        aliases = harvest.program_alias_index(registry)
        selected = [
            row
            for row in rows
            if aliases.get(harvest.normalize(row["program"]))
            in harvest.TARGET_PROGRAM_REFS
        ]
        self.assertEqual([row["title"] for row in selected], ["Tesis filosófica"])

    def test_reference_only_rejects_full_text_links(self):
        for url in (
            "https://example.edu/thesis.pdf",
            "https://example.edu/bitstream/123/456",
            "https://example.edu/download?id=7",
        ):
            self.assertFalse(harvest.safe_url(url))
            self.assertFalse(curated.safe_url(url))
        self.assertTrue(harvest.safe_url("https://example.edu/record/7"))
        self.assertTrue(curated.safe_url("https://example.edu/record/7"))

    def test_seed_ledger_resolves_include_and_no_fake_doctorate(self):
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        seeds = harvest.load_seeds(CONFIG, registry)
        self.assertGreaterEqual(len(seeds), 4)
        for source in seeds:
            candidate = harvest.canonical.canonical_candidate(
                source,
                registry,
                reference_year=2026,
            )
            self.assertEqual(candidate["admission"]["status"], "include")
            self.assertIn(
                candidate["program"]["programRef"],
                harvest.TARGET_PROGRAM_REFS,
            )
            self.assertNotIn(".pdf", source["recordUrl"].casefold())

        config = json.loads(CONFIG.read_text(encoding="utf-8"))
        self.assertFalse(config["doctoralPolicy"]["exactDoctorateProgramPresent"])
        self.assertEqual(
            config["doctoralPolicy"]["observedContainerProgramRef"],
            "program:udg:doc-humanidades",
        )

    def test_exact_bibliographic_key_matches_without_fuzzy_logic(self):
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        source = harvest.source_record(
            provider="cucsh-official",
            provider_record_id="fixture-covered",
            record_url="https://www.cucsh.udg.mx/node/fixture-covered",
            title="Tesis ya cubierta",
            authors=["Ana Pérez"],
            directors=[],
            year="2020",
            program="Licenciatura en Filosofía",
            institution="Universidad de Guadalajara",
            academic_unit="CUCSH",
            thesis_type="Tesis de licenciatura",
            evidence_kind="fixture",
        )
        candidate = harvest.canonical.canonical_candidate(
            source,
            registry,
            reference_year=2026,
        )
        work = {
            "title": candidate["title"],
            "date": candidate["date"],
            "programRef": candidate["program"]["programRef"],
            "contributions": candidate["contributions"],
        }
        self.assertEqual(
            projection.work_key(work),
            projection.candidate_key(candidate),
        )

    def test_projection_accepts_modern_riudg_provider(self):
        self.assertIn("riudg", projection.ALLOWED_PROVIDERS)
        self.assertNotIn("philpapers", projection.ALLOWED_PROVIDERS)
        self.assertNotIn("academia", projection.ALLOWED_PROVIDERS)

    def test_persistent_handle_identity_does_not_require_thesis_year(self):
        handles = projection.persistent_handles(
            [
                {
                    "scheme": "handle",
                    "normalizedValue": "20.500.12104/34249",
                },
                {
                    "scheme": "doi",
                    "normalizedValue": "10.0000/example",
                },
            ]
        )
        self.assertEqual(handles, {"20.500.12104/34249"})

    def test_curated_view_preserves_real_program_and_manual_decisions(self):
        config = json.loads(CURATED_CONFIG.read_text(encoding="utf-8"))
        index = curated.build_index(config)
        self.assertFalse(index["canonicalAdmissionMutation"])
        self.assertTrue(index["referenceOnly"])
        self.assertEqual(index["metrics"]["byStatus"]["include"], 8)
        self.assertEqual(index["metrics"]["byStatus"]["review"], 2)

        by_id = {row["id"]: row for row in index["records"]}
        tics = by_id["philosophy-curated:aleph:000393407"]
        self.assertEqual(
            tics["actualProgram"],
            "Maestría en Tecnologías para el Aprendizaje",
        )
        self.assertEqual(tics["inclusionBasis"], "philosophical-content")

        victor = by_id["philosophy-curated:aleph:000168319"]
        self.assertEqual(victor["status"], "include")
        self.assertEqual(
            victor["inclusionBasis"],
            "curated-manual-classification",
        )
        self.assertIn("programa no especificado", victor["actualProgram"])

        for record in index["records"]:
            self.assertTrue(curated.safe_url(record["recordUrl"]))
            for url in record.get("evidenceUrls") or []:
                self.assertTrue(curated.safe_url(url))

    def test_secondary_discoveries_stay_review_until_institutional_reconciliation(self):
        config = json.loads(CURATED_CONFIG.read_text(encoding="utf-8"))
        by_id = {row["id"]: row for row in config["records"]}
        self.assertEqual(
            by_id["philosophy-curated:philarchive:GALFDL-5"]["status"],
            "review",
        )
        self.assertEqual(
            by_id["philosophy-curated:academia:adriel-hernandez-platon"]["status"],
            "review",
        )

    def test_all_seed_providers_are_explicitly_supported(self):
        content = (THESIS / "build_canonical_corpus_v1.py").read_text(
            encoding="utf-8"
        )
        for provider in (
            "cucsh-library",
            "cucsh-official",
            "udg-official-profile",
        ):
            self.assertIn(provider, content)


if __name__ == "__main__":
    unittest.main()

"""Regression tests for the official Philosophy thesis completeness phase."""
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
CONFIG = THESIS / "config" / "philosophy-official-supplement-v1.json"
REGISTRY = THESIS / "config" / "program-authority-v1.json"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


harvest = load_module("philosophy_harvest", HARVEST)
projection = load_module("philosophy_projection", PROJECTION)


class PhilosophyCompletenessV1Test(unittest.TestCase):
    def test_library_parser_uses_exact_program_authority(self):
        html = """
        <table>
          <tr><th>Titulo</th><th>Autor</th><th>Coautor</th><th>Director y asesor de tesis</th><th>Año</th><th>Licenciatura</th></tr>
          <tr><td><a href="/?q=node/1">Tesis filosófica</a></td><td>Ana Pérez</td><td></td><td>Dr. Uno</td><td>2018</td><td>Licenciatura en Filosofía</td></tr>
          <tr><td><a href="/?q=node/2">Kant en Derecho</a></td><td>Luis Pérez</td><td></td><td>Dr. Dos</td><td>2019</td><td>Licenciatura en Derecho</td></tr>
        </table>
        """
        rows = harvest.parse_library_table(
            html,
            source_url="https://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-licenciatura",
            level="licenciatura",
        )
        self.assertEqual(len(rows), 2)
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        aliases = harvest.program_alias_index(registry)
        selected = [
            row for row in rows
            if aliases.get(harvest.normalize(row["program"])) in harvest.TARGET_PROGRAM_REFS
        ]
        self.assertEqual([row["title"] for row in selected], ["Tesis filosófica"])

    def test_reference_only_rejects_full_text_links(self):
        for url in (
            "https://example.edu/thesis.pdf",
            "https://example.edu/bitstream/123/456",
            "https://example.edu/download?id=7",
        ):
            self.assertFalse(harvest.safe_url(url))
        self.assertTrue(harvest.safe_url("https://example.edu/record/7"))

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
            self.assertIn(candidate["program"]["programRef"], harvest.TARGET_PROGRAM_REFS)
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
        candidate = harvest.canonical.canonical_candidate(source, registry, reference_year=2026)
        work = {
            "title": candidate["title"],
            "date": candidate["date"],
            "programRef": candidate["program"]["programRef"],
            "contributions": candidate["contributions"],
        }
        self.assertEqual(projection.work_key(work), projection.candidate_key(candidate))

    def test_all_seed_providers_are_explicitly_supported(self):
        content = (THESIS / "build_canonical_corpus_v1.py").read_text(encoding="utf-8")
        for provider in ("cucsh-library", "cucsh-official", "udg-official-profile"):
            self.assertIn(provider, content)


if __name__ == "__main__":
    unittest.main()

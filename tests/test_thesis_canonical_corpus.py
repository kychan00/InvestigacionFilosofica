from __future__ import annotations

import importlib.util
import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "thesis" / "build_canonical_corpus_v1.py"

spec = importlib.util.spec_from_file_location("thesis_corpus", MODULE_PATH)
thesis = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(thesis)


class ThesisCanonicalCorpusTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = thesis.load_program_registry(
            ROOT / "scripts" / "thesis" / "config" / "program-authority-v1.json"
        )

    def test_riudg_dim_preserves_program_and_roles(self):
        xml = (
            ROOT / "scripts" / "thesis" / "fixtures" / "riudg-history-dim.xml"
        ).read_text(encoding="utf-8")

        record = thesis.parse_riudg_dim(xml)
        candidate = thesis.canonical_candidate(
            record,
            self.registry,
            reference_year=2026,
        )

        self.assertEqual(record["provider"], "riudg")
        self.assertEqual(candidate["program"]["programRef"], "program:udg:lic-historia")
        self.assertEqual(candidate["institution"]["institutionRef"], "institution:udg")
        self.assertEqual(candidate["admission"]["status"], "include")

        roles = [item["role"] for item in candidate["contributions"]]
        self.assertIn("thesis-author", roles)
        self.assertIn("thesis-director", roles)

        authors = {
            item["normalizedName"]
            for item in candidate["contributions"]
            if item["role"] == "thesis-author"
        }
        directors = {
            item["normalizedName"]
            for item in candidate["contributions"]
            if item["role"] == "thesis-director"
        }
        self.assertTrue(authors)
        self.assertTrue(directors)
        self.assertTrue(authors.isdisjoint(directors))

    def test_udgvirtual_html_extracts_director_without_author_pollution(self):
        html = (
            ROOT / "scripts" / "thesis" / "fixtures" / "udgvirtual-philosophy.html"
        ).read_text(encoding="utf-8")

        record = thesis.parse_udgvirtual_html(
            html,
            handle="fixture-philosophy",
        )
        candidate = thesis.canonical_candidate(
            record,
            self.registry,
            reference_year=2026,
        )

        self.assertEqual(candidate["program"]["programRef"], "program:udg:mae-estudios-filosoficos")
        self.assertEqual(candidate["admission"]["status"], "include")

        by_role = {}
        for item in candidate["contributions"]:
            by_role.setdefault(item["role"], []).append(item["rawName"])

        self.assertEqual(by_role["thesis-author"], ["Gómez Ruiz, Elena"])
        self.assertEqual(by_role["thesis-director"], ["Martínez Soto, Pablo"])

    def test_unknown_udg_program_is_quarantined_not_guessed(self):
        record = thesis.source_record(
            provider="riudg",
            provider_record_id="oai:test:unknown-program",
            source_url=None,
            raw_fields={
                "dc.title": ["Una tesis de tema filosófico"],
                "dc.degree.name": ["Programa Experimental Desconocido"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.subject": ["Filosofía"],
            },
            raw_payload="fixture",
        )

        candidate = thesis.canonical_candidate(record, self.registry, reference_year=2026)
        self.assertEqual(candidate["program"]["status"], "unknown")
        self.assertEqual(candidate["admission"]["status"], "quarantine")
        self.assertEqual(
            candidate["admission"]["explanationCode"],
            "unknown-program",
        )

    def test_external_institution_is_excluded(self):
        record = thesis.source_record(
            provider="udgvirtual",
            provider_record_id="external-1",
            source_url=None,
            raw_fields={
                "DC.title": ["Historia cultural y memoria"],
                "DC.creator": ["Ejemplo, Persona"],
                "DC.description": [
                    "Documento de titulación para obtener el grado de Licenciatura en Historia"
                ],
                "DC.publisher": ["Universidad Nacional Autónoma de México"],
            },
            raw_payload="fixture",
        )

        candidate = thesis.canonical_candidate(record, self.registry, reference_year=2026)
        self.assertEqual(candidate["institution"]["status"], "external")
        self.assertEqual(candidate["admission"]["status"], "exclude")
        self.assertEqual(
            candidate["admission"]["explanationCode"],
            "external-institution",
        )

    def test_suspicious_dates_are_preserved_not_corrected(self):
        info = thesis.date_info("2107-01-04", reference_year=2026)
        self.assertEqual(info["raw"], "2107-01-04")
        self.assertEqual(info["value"], "2107-01-04")
        self.assertEqual(info["quality"], "suspicious")

    def test_exact_handle_can_merge_two_sources(self):
        raw_fields_a = {
            "dc.title": ["La experiencia y el lenguaje"],
            "dc.degree.name": ["Licenciatura en Filosofía"],
            "dc.degree.grantor": ["Universidad de Guadalajara"],
            "dc.identifier.uri": ["https://hdl.handle.net/20.500.12104/999999"],
        }
        raw_fields_b = {
            "DC.title": ["La experiencia y el lenguaje"],
            "DC.description": [
                "Documento de titulación para obtener el grado de Licenciatura en Filosofía"
            ],
            "DC.publisher": ["Universidad de Guadalajara"],
            "DC.identifier": ["https://hdl.handle.net/20.500.12104/999999"],
        }

        a = thesis.source_record(
            provider="riudg",
            provider_record_id="a",
            source_url=None,
            raw_fields=raw_fields_a,
            raw_payload="a",
        )
        b = thesis.source_record(
            provider="udgvirtual",
            provider_record_id="b",
            source_url=None,
            raw_fields=raw_fields_b,
            raw_payload="b",
        )

        corpus = thesis.build_corpus(
            [a, b],
            self.registry,
            reference_year=2026,
        )

        self.assertEqual(corpus["metrics"]["sourceRecords"], 2)
        self.assertEqual(corpus["metrics"]["works"], 1)
        self.assertEqual(
            corpus["identityDecisions"][0]["explanationCode"],
            "shared-persistent-identifier",
        )

    def test_exact_handle_does_not_override_institution_veto(self):
        shared = "https://hdl.handle.net/20.500.12104/777777"

        udg = thesis.source_record(
            provider="riudg",
            provider_record_id="udg",
            source_url=None,
            raw_fields={
                "dc.title": ["Trabajo con identificador compartido"],
                "dc.degree.name": ["Licenciatura en Filosofía"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.identifier.uri": [shared],
            },
            raw_payload="udg",
        )
        external = thesis.source_record(
            provider="udgvirtual",
            provider_record_id="external",
            source_url=None,
            raw_fields={
                "DC.title": ["Trabajo con identificador compartido"],
                "DC.description": [
                    "Documento de titulación para obtener el grado de Licenciatura en Filosofía"
                ],
                "DC.publisher": ["Universidad Autónoma de Barcelona"],
                "DC.identifier": [shared],
            },
            raw_payload="external",
        )

        corpus = thesis.build_corpus(
            [udg, external],
            self.registry,
            reference_year=2026,
        )

        self.assertEqual(corpus["metrics"]["works"], 2)
        self.assertEqual(
            corpus["metrics"]["identityDecisions"].get("rejected"),
            2,
        )
        self.assertEqual(
            {item["explanationCode"] for item in corpus["identityDecisions"]},
            {"institution-contradiction-veto"},
        )

    def test_same_title_without_identifier_does_not_merge(self):
        common = {
            "dc.title": ["Título compartido"],
            "dc.degree.name": ["Licenciatura en Historia"],
            "dc.degree.grantor": ["Universidad de Guadalajara"],
        }
        a = thesis.source_record(
            provider="riudg",
            provider_record_id="first",
            source_url=None,
            raw_fields=common,
            raw_payload="first",
        )
        b = thesis.source_record(
            provider="riudg",
            provider_record_id="second",
            source_url=None,
            raw_fields=common,
            raw_payload="second",
        )

        corpus = thesis.build_corpus(
            [a, b],
            self.registry,
            reference_year=2026,
        )
        self.assertEqual(corpus["metrics"]["works"], 2)

    def test_work_ids_are_reused_from_previous_registry(self):
        record = thesis.source_record(
            provider="riudg",
            provider_record_id="stable",
            source_url=None,
            raw_fields={
                "dc.title": ["Estabilidad"],
                "dc.degree.name": ["Licenciatura en Filosofía"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
            },
            raw_payload="stable",
        )
        first = thesis.build_corpus(
            [record],
            self.registry,
            reference_year=2026,
        )
        second = thesis.build_corpus(
            [record],
            self.registry,
            previous_work_registry=first["workIdRegistry"],
            reference_year=2026,
        )
        self.assertEqual(first["works"][0]["id"], second["works"][0]["id"])

    def test_fixture_build_validates(self):
        xml = (
            ROOT / "scripts" / "thesis" / "fixtures" / "riudg-history-dim.xml"
        ).read_text(encoding="utf-8")
        html = (
            ROOT / "scripts" / "thesis" / "fixtures" / "udgvirtual-philosophy.html"
        ).read_text(encoding="utf-8")

        corpus = thesis.build_corpus(
            [
                thesis.parse_riudg_dim(xml),
                thesis.parse_udgvirtual_html(html, handle="fixture-philosophy"),
            ],
            self.registry,
            reference_year=2026,
        )

        self.assertTrue(thesis.validate_corpus(corpus))
        self.assertEqual(corpus["metrics"]["worksByAdmission"], {"include": 2})


if __name__ == "__main__":
    unittest.main()

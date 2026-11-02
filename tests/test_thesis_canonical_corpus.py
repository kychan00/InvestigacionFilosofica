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

    def test_day_first_dates_are_normalized_without_losing_raw_value(self):
        info = thesis.date_info("01/04/2018", reference_year=2026)
        self.assertEqual(info["raw"], "01/04/2018")
        self.assertEqual(info["value"], "2018-04-01")
        self.assertEqual(info["precision"], "day")
        self.assertEqual(info["quality"], "valid")

    def test_riudg_epoch_sentinel_dates_are_suspicious(self):
        iso = thesis.date_info("1969-12-31", reference_year=2026)
        dmy = thesis.date_info("31/12/1969", reference_year=2026)

        self.assertEqual(iso["raw"], "1969-12-31")
        self.assertEqual(iso["value"], "1969-12-31")
        self.assertEqual(iso["precision"], "day")
        self.assertEqual(iso["quality"], "suspicious")

        self.assertEqual(dmy["raw"], "31/12/1969")
        self.assertEqual(dmy["value"], "1969-12-31")
        self.assertEqual(dmy["precision"], "day")
        self.assertEqual(dmy["quality"], "suspicious")

    def test_zero_month_and_day_reduce_date_precision(self):
        year_only = thesis.date_info("1991-00-00", reference_year=2026)
        self.assertEqual(year_only["raw"], "1991-00-00")
        self.assertEqual(year_only["value"], "1991")
        self.assertEqual(year_only["precision"], "year")
        self.assertEqual(year_only["quality"], "valid")

        month_only = thesis.date_info("1995-10-00", reference_year=2026)
        self.assertEqual(month_only["raw"], "1995-10-00")
        self.assertEqual(month_only["value"], "1995-10")
        self.assertEqual(month_only["precision"], "month")
        self.assertEqual(month_only["quality"], "valid")

    def test_large_numeric_date_is_suspicious_and_not_reinterpreted(self):
        info = thesis.date_info("37812", reference_year=2026)
        self.assertEqual(info["raw"], "37812")
        self.assertIsNone(info["value"])
        self.assertEqual(info["quality"], "suspicious")

    def test_explicit_non_thesis_record_is_rejected_as_source(self):
        record = thesis.source_record(
            provider="udgvirtual",
            provider_record_id="book-chapter",
            source_url=None,
            raw_fields={
                "DC.title": ["Capítulo alojado en colección"],
                "DC.creator": ["Autora, Ana"],
                "DC.type": ["Book chapter"],
            },
            raw_payload="book-chapter",
        )
        candidate = thesis.canonical_candidate(
            record,
            self.registry,
            reference_year=2026,
        )
        self.assertEqual(candidate["sourceType"]["status"], "non-thesis")
        self.assertEqual(candidate["admission"]["status"], "reject-source")
        self.assertEqual(
            candidate["admission"]["explanationCode"],
            "not-a-thesis",
        )

    def test_unlabelled_institutional_contributor_can_exclude_external_thesis(self):
        record = thesis.source_record(
            provider="udgvirtual",
            provider_record_id="external-contributor",
            source_url=None,
            raw_fields={
                "DC.title": ["Tesis externa"],
                "DC.creator": ["Autor, Ejemplo"],
                "DC.contributor": ["Universidad de las Américas Puebla"],
                "DC.type": ["Thesis"],
            },
            raw_payload="external-contributor",
        )
        candidate = thesis.canonical_candidate(
            record,
            self.registry,
            reference_year=2026,
        )
        self.assertEqual(candidate["institution"]["status"], "external")
        self.assertEqual(
            candidate["institution"]["canonicalName"],
            "Universidad de las Américas Puebla",
        )
        self.assertEqual(candidate["admission"]["status"], "exclude")

    def test_udg_grantor_typo_is_confirmed_by_exact_alias(self):
        record = thesis.source_record(
            provider="riudg",
            provider_record_id="udg-grantor-typo",
            source_url=None,
            raw_fields={
                "dc.title": ["Tesis CUCS con typo institucional"],
                "dc.degree.name": ["LICENCIATURA EN MEDICINA"],
                "dc.degree.grantor": ["Universidad en Guadalajara"],
                "dc.degree.department": ["CUCS"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload="udg-grantor-typo",
        )

        candidate = thesis.canonical_candidate(
            record,
            self.registry,
            reference_year=2026,
        )

        self.assertEqual(candidate["institution"]["status"], "confirmed")
        self.assertEqual(
            candidate["institution"]["institutionRef"],
            "institution:udg",
        )
        self.assertEqual(
            candidate["institution"]["raw"],
            "Universidad en Guadalajara",
        )
        self.assertEqual(candidate["admission"]["status"], "quarantine")
        self.assertEqual(
            candidate["admission"]["explanationCode"],
            "unknown-program",
        )

    def test_exact_external_college_grantor_is_excluded(self):
        record = thesis.source_record(
            provider="riudg",
            provider_record_id="external-college",
            source_url=None,
            raw_fields={
                "dc.title": ["Tesis externa antropológica"],
                "dc.degree.name": ["Doctorado en Antropología Social"],
                "dc.degree.grantor": ["El Colegio de Michoacán A.C."],
                "dc.publisher": ["El Colegio de Michoacán A.C."],
                "dc.type": ["Tesis de Doctorado"],
            },
            raw_payload="external-college",
        )

        candidate = thesis.canonical_candidate(
            record,
            self.registry,
            reference_year=2026,
        )

        self.assertEqual(candidate["institution"]["status"], "external")
        self.assertEqual(
            candidate["institution"]["raw"],
            "El Colegio de Michoacán A.C.",
        )
        self.assertEqual(candidate["admission"]["status"], "exclude")
        self.assertEqual(
            candidate["admission"]["explanationCode"],
            "external-institution",
        )

    def test_institution_aliases_cannot_overlap_external_aliases(self):
        registry = json.loads(
            (
                ROOT
                / "scripts"
                / "thesis"
                / "config"
                / "program-authority-v1.json"
            ).read_text(encoding="utf-8")
        )
        registry["institution"]["externalAliases"].append(
            "Universidad de Guadalajara"
        )

        temp = ROOT / "tests" / ".institution-alias-collision.json"
        try:
            temp.write_text(
                json.dumps(registry, ensure_ascii=False),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                ValueError,
                "Institution alias collision",
            ):
                thesis.load_program_registry(temp)
        finally:
            temp.unlink(missing_ok=True)

    def test_program_authority_v2_resolves_full_inventory_additions(self):
        cases = {
            "MAESTRIA EN LINGUISTICA APLICADA": (
                "program:udg:mae-linguistica-aplicada",
                "include",
            ),
            "DOCTORADO EN GEOGRAFIA Y ORDENACION TERRITORIAL": (
                "program:udg:doc-geografia-ordenacion-territorial",
                "include",
            ),
            "DOCTORADO EN HUMANIDADES": (
                "program:udg:doc-humanidades",
                "include",
            ),
            "DOCTORADO EN ESTUDIOS LITERARIOS Y LINGÜISTICOS": (
                "program:udg:doc-estudios-literarios-linguisticos",
                "include",
            ),
            "Maestría en Bioetica": (
                "program:udg:mae-bioetica",
                "include",
            ),
            "MAESTRIA EN CIENCIAS ANTROPOLOGICAS": (
                "program:udg:mae-ciencias-antropologicas",
                "include",
            ),
        }

        for raw, (program_ref, state) in cases.items():
            with self.subTest(raw=raw):
                resolved = thesis.resolve_program(raw, self.registry)
                self.assertEqual(resolved["programRef"], program_ref)
                self.assertEqual(resolved["admissionState"], state)

    def test_review_program_is_not_excluded_or_included(self):
        record = thesis.source_record(
            provider="riudg",
            provider_record_id="history-art-review",
            source_url=None,
            raw_fields={
                "dc.title": ["Historia del arte y patrimonio"],
                "dc.contributor.author": ["Ejemplo, Persona"],
                "dc.degree.name": ["LICENCIATURA EN HISTORIA DEL ARTE"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUTONALA"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload="history-art-review",
        )

        candidate = thesis.canonical_candidate(
            record,
            self.registry,
            reference_year=2026,
        )
        self.assertEqual(
            candidate["program"]["programRef"],
            "program:udg:lic-historia-arte",
        )
        self.assertEqual(candidate["program"]["admissionState"], "review")
        self.assertEqual(candidate["admission"]["status"], "review")
        self.assertEqual(
            candidate["admission"]["explanationCode"],
            "program-review",
        )

        corpus = thesis.build_corpus(
            [record],
            self.registry,
            reference_year=2026,
        )
        self.assertEqual(corpus["metrics"]["worksByAdmission"], {"review": 1})
        self.assertEqual(corpus["works"][0]["admissionStatus"], "review")

    def test_unresolved_doctoral_orientation_remains_review(self):
        raw = (
            "DOCTORADO EN ESTUDIOS LITERARIOS Y LINGÜÍSTICOS "
            "CON ORIENTACIÓN EN LINGÜÍSTICA APLICADA"
        )
        resolved = thesis.resolve_program(raw, self.registry)

        self.assertEqual(
            resolved["programRef"],
            "program:udg:doc-estudios-literarios-linguisticos-orient-linguistica",
        )
        self.assertEqual(resolved["admissionState"], "review")

    def test_registry_revision_is_pinned_in_corpus(self):
        record = thesis.source_record(
            provider="riudg",
            provider_record_id="registry-revision",
            source_url=None,
            raw_fields={
                "dc.title": ["Revisión"],
                "dc.degree.name": ["Licenciatura en Historia"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
            },
            raw_payload="registry-revision",
        )
        corpus = thesis.build_corpus(
            [record],
            self.registry,
            reference_year=2026,
        )
        self.assertEqual(
            corpus["programAuthorityRevision"],
            self.registry["registryRevision"],
        )
        self.assertEqual(
            corpus["institutionAuthorityRevision"],
            self.registry["institutionRevision"],
        )

    def test_historical_language_literature_family_v3(self):
        cases = {
            "Maestría en Enseñanza de la Lengua y la Literatura": (
                "program:udg:mae-ensenanza-lengua-literatura-historica",
                "include",
            ),
            "Maestría en la Enseñanza de la Lengua y Literatura": (
                "program:udg:mae-ensenanza-lengua-literatura-historica",
                "include",
            ),
            "Maestría en Lengua y Literatura Mexicana": (
                "program:udg:mae-lengua-literatura-mexicana-historica",
                "include",
            ),
            "Maestría en la Enseñanza del Inglés como Lengua Extranjera": (
                "program:udg:mae-ensenanza-ingles",
                "include",
            ),
            "Licenciatura en la Docencia del Inglés": (
                "program:udg:lic-docencia-ingles-corta-historica",
                "review",
            ),
            "Licenciatura en Letras": (
                "program:udg:lic-letras-historica",
                "include",
            ),
            "Maestría en Filosofía": (
                "program:udg:mae-filosofia-historica",
                "include",
            ),
        }

        for raw, (program_ref, state) in cases.items():
            with self.subTest(raw=raw):
                resolved = thesis.resolve_program(raw, self.registry)
                self.assertEqual(resolved["programRef"], program_ref)
                self.assertEqual(resolved["admissionState"], state)

    def test_short_historical_english_degree_remains_review(self):
        record = thesis.source_record(
            provider="riudg",
            provider_record_id="short-english-degree",
            source_url=None,
            raw_fields={
                "dc.title": ["Una tesis histórica"],
                "dc.degree.name": ["LICENCIATURA EN LA DOCENCIA DEL INGLÉS"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUCSH"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload="short-english-degree",
        )

        candidate = thesis.canonical_candidate(
            record,
            self.registry,
            reference_year=2026,
        )

        self.assertEqual(
            candidate["program"]["programRef"],
            "program:udg:lic-docencia-ingles-corta-historica",
        )
        self.assertEqual(candidate["admission"]["status"], "review")
        self.assertEqual(
            candidate["admission"]["explanationCode"],
            "program-review",
        )

    def test_historical_program_can_be_include_without_confirmed_successor(self):
        for program_id in (
            "program:udg:lic-letras-historica",
            "program:udg:mae-filosofia-historica",
        ):
            with self.subTest(program_id=program_id):
                program = next(
                    item
                    for item in self.registry["programs"]
                    if item["id"] == program_id
                )
                self.assertEqual(program["admissionState"], "include")
                self.assertEqual(program["lifecycleState"], "historical")
                self.assertTrue(program.get("possibleSuccessorRef"))
                self.assertIn(
                    "confirm",
                    program["decisionNote"].casefold(),
                )

    def test_language_literature_v3_projection_states(self):
        rows = [
            (
                "Maestría en Enseñanza de la Lengua y la Literatura",
                "include",
            ),
            (
                "Maestría en la Enseñanza del Inglés como Lengua Extranjera",
                "include",
            ),
            (
                "Licenciatura en la Docencia del Inglés",
                "review",
            ),
        ]
        records = []
        for index, (program, _) in enumerate(rows):
            records.append(
                thesis.source_record(
                    provider="riudg",
                    provider_record_id=f"family-{index}",
                    source_url=None,
                    raw_fields={
                        "dc.title": [f"Trabajo {index}"],
                        "dc.degree.name": [program],
                        "dc.degree.grantor": ["Universidad de Guadalajara"],
                        "dc.degree.department": ["CUCSH"],
                        "dc.type": ["Tesis"],
                    },
                    raw_payload=f"family-{index}",
                )
            )

        corpus = thesis.build_corpus(
            records,
            self.registry,
            reference_year=2026,
        )

        self.assertEqual(
            corpus["metrics"]["worksByAdmission"],
            {"include": 2, "review": 1},
        )
        self.assertEqual(
            corpus["programAuthorityRevision"],
            self.registry["registryRevision"],
        )

    def test_cultural_management_family_v4(self):
        cases = {
            "Maestría en Gestión de la Cultura": (
                "program:udg:mae-gestion-cultura",
                "include",
            ),
            "MAESTRIA EN GESTION Y DESARROLLO CULTURAL": (
                "program:udg:mae-gestion-desarrollo-cultural",
                "review",
            ),
            "Doctorado en Gestión de la Cultura": (
                "program:udg:doc-gestion-cultura",
                "include",
            ),
        }

        for raw, (program_ref, admission_state) in cases.items():
            with self.subTest(raw=raw):
                resolved = thesis.resolve_program(raw, self.registry)
                self.assertEqual(resolved["programRef"], program_ref)
                self.assertEqual(
                    resolved["admissionState"],
                    admission_state,
                )

    def test_cultural_management_full_inventory_baseline(self):
        program = next(
            item
            for item in self.registry["programs"]
            if item["id"] == "program:udg:doc-gestion-cultura"
        )

        self.assertEqual(program["observedCount"], 3)
        self.assertEqual(
            program["observedThesisYears"],
            {"min": 2023, "max": 2025},
        )
        self.assertIn("SUV", program["academicUnits"])
        self.assertEqual(program["admissionState"], "include")

    def test_cultural_management_programs_are_not_aliases(self):
        research = thesis.resolve_program(
            "Maestría en Gestión de la Cultura",
            self.registry,
        )
        professional = thesis.resolve_program(
            "Maestría en Gestión y Desarrollo Cultural",
            self.registry,
        )

        self.assertNotEqual(
            research["programRef"],
            professional["programRef"],
        )
        self.assertEqual(research["admissionState"], "include")
        self.assertEqual(professional["admissionState"], "review")

    def test_cultural_management_review_gate_is_explicit(self):
        records = [
            thesis.source_record(
                provider="riudg",
                provider_record_id="culture-research",
                source_url=None,
                raw_fields={
                    "dc.title": ["Investigación cultural"],
                    "dc.degree.name": ["Maestría en Gestión de la Cultura"],
                    "dc.degree.grantor": ["Universidad de Guadalajara"],
                    "dc.degree.department": ["SUV"],
                    "dc.type": ["Tesis de Maestría"],
                },
                raw_payload="culture-research",
            ),
            thesis.source_record(
                provider="riudg",
                provider_record_id="culture-professional",
                source_url=None,
                raw_fields={
                    "dc.title": ["Proyecto cultural"],
                    "dc.degree.name": [
                        "Maestría en Gestión y Desarrollo Cultural"
                    ],
                    "dc.degree.grantor": ["Universidad de Guadalajara"],
                    "dc.degree.department": ["CUAAD"],
                    "dc.type": ["Tesis de Maestría"],
                },
                raw_payload="culture-professional",
            ),
        ]

        corpus = thesis.build_corpus(
            records,
            self.registry,
            reference_year=2026,
        )

        self.assertEqual(
            corpus["metrics"]["worksByAdmission"],
            {"include": 1, "review": 1},
        )
        self.assertEqual(
            corpus["programAuthorityRevision"],
            self.registry["registryRevision"],
        )

        by_program = {
            work["programRef"]: work["admissionStatus"]
            for work in corpus["works"]
        }
        self.assertEqual(
            by_program["program:udg:mae-gestion-cultura"],
            "include",
        )
        self.assertEqual(
            by_program["program:udg:mae-gestion-desarrollo-cultural"],
            "review",
        )

    def test_arts_heritage_family_v5(self):
        cases = {
            "DOCTORADO INTERINSTITUCIONAL EN ARTE Y CULTURA": (
                "program:udg:doc-arte-cultura-interinstitucional",
                "include",
            ),
            "MAESTRIA EN ETNOMUSICOLOGIA": (
                "program:udg:mae-etnomusicologia",
                "include",
            ),
            "MAESTRIA EN CIENCIAS DE LA ARQUITECTURA": (
                "program:udg:mae-ciencias-arquitectura",
                "review",
            ),
            "Maestría En Historia De La Arquitectura Mexicana": (
                "program:udg:mae-historia-arquitectura-mexicana-historica",
                "review",
            ),
            "Maestría En Conservación Del Patrimonio Edificado": (
                "program:udg:mae-conservacion-patrimonio-edificado-historica",
                "review",
            ),
            "MAESTRIA EN EDUCACION Y EXPRESION PARA LAS ARTES": (
                "program:udg:mae-educacion-expresion-artes",
                "review",
            ),
            "Maestría En Didáctica De Las Artes Con Orientación En Artes Visuales": (
                "program:udg:mae-didactica-artes-visuales-historica",
                "review",
            ),
            "Maestría En Didáctica De Las Artes Orientación En Artes Escénicas": (
                "program:udg:mae-didactica-artes-escenicas-historica",
                "review",
            ),
            "Maestría en Estudios Cinematográficos": (
                "program:udg:mae-estudios-cinematograficos",
                "review",
            ),
        }

        for raw, (program_ref, admission_state) in cases.items():
            with self.subTest(raw=raw):
                resolved = thesis.resolve_program(raw, self.registry)
                self.assertEqual(resolved["programRef"], program_ref)
                self.assertEqual(
                    resolved["admissionState"],
                    admission_state,
                )

    def test_architecture_historical_orientations_share_mca_authority(self):
        aliases = [
            "Maestría En Arquitectura; Orientacion En Historia De La Arquitectura Mexicana",
            "Maestría En Arquitectura; Conservacion Del Patrimonio Edificado",
            "Maestría En Arquitectura; Orientacion Teoria Y Critica De La Arquitectura",
            "Maestría En Arquitectura; Orientacion Arte Y Comunicacion",
            "Maestría En Arquitectura; Orientacion Urbanismo Y Desarrollo",
            "Maestría En Ciencias De La Arquitectura Con Orientación En Conservación Del Patrimonio Edificado",
            "Maestría En Ciencias De La Arquitectura Orientación En Historia De La Arquitectura Mexicana",
        ]

        for raw in aliases:
            with self.subTest(raw=raw):
                resolved = thesis.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    "program:udg:mae-ciencias-arquitectura",
                )
                self.assertEqual(resolved["admissionState"], "review")

    def test_generic_didactica_de_las_artes_remains_unknown(self):
        resolved = thesis.resolve_program(
            "Maestría En Didáctica De Las Artes",
            self.registry,
        )

        self.assertEqual(resolved["status"], "unknown")
        self.assertIsNone(resolved["programRef"])

    def test_arts_heritage_v5_gate_preserves_include_review_boundary(self):
        rows = [
            (
                "Doctorado Interinstitucional en Arte y Cultura",
                "include",
            ),
            (
                "Maestría en Etnomusicología",
                "include",
            ),
            (
                "Maestría en Ciencias de la Arquitectura",
                "review",
            ),
            (
                "Maestría en Educación y Expresión para las Artes",
                "review",
            ),
        ]
        records = []
        for index, (program, _) in enumerate(rows):
            records.append(
                thesis.source_record(
                    provider="riudg",
                    provider_record_id=f"arts-family-{index}",
                    source_url=None,
                    raw_fields={
                        "dc.title": [f"Trabajo artes {index}"],
                        "dc.degree.name": [program],
                        "dc.degree.grantor": ["Universidad de Guadalajara"],
                        "dc.degree.department": ["CUAAD"],
                        "dc.type": ["Tesis"],
                    },
                    raw_payload=f"arts-family-{index}",
                )
            )

        corpus = thesis.build_corpus(
            records,
            self.registry,
            reference_year=2026,
        )

        self.assertEqual(
            corpus["metrics"]["worksByAdmission"],
            {"include": 2, "review": 2},
        )
        self.assertEqual(
            corpus["programAuthorityRevision"],
            self.registry["registryRevision"],
        )

    def test_historical_art_theory_authority_v6(self):
        for raw in (
            "Maestría En Teoria Del Arte",
            "Maestría en Teoría del Arte",
            "Maestría en Artes opción Terminal en Teoría del Arte",
        ):
            with self.subTest(raw=raw):
                resolved = thesis.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    "program:udg:mae-artes-teoria-arte-historica",
                )
                self.assertEqual(
                    resolved["admissionState"],
                    "include",
                )

        record = thesis.source_record(
            provider="riudg",
            provider_record_id="art-theory-2004",
            source_url=None,
            raw_fields={
                "dc.title": ["El simbolismo en el arte"],
                "dc.degree.name": ["Maestría En Teoria Del Arte"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUAAD"],
                "dc.date.issued": ["2004-06-00"],
                "dc.type": ["Tesis de Maestría"],
            },
            raw_payload="art-theory-2004",
        )

        corpus = thesis.build_corpus(
            [record],
            self.registry,
            reference_year=2026,
        )
        work = corpus["works"][0]

        self.assertEqual(work["admissionStatus"], "include")
        self.assertEqual(
            work["programRef"],
            "program:udg:mae-artes-teoria-arte-historica",
        )
        self.assertEqual(work["institutionRef"], "institution:udg")
        self.assertEqual(work["date"]["value"], "2004-06")

    def test_communication_boundary_authority_v7(self):
        for raw in (
            "Maestría en Comunicación",
            "MAESTRIA EN COMUNICACION",
        ):
            with self.subTest(raw=raw):
                resolved = thesis.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    "program:udg:mae-comunicacion",
                )
                self.assertEqual(
                    resolved["admissionState"],
                    "review",
                )

        record = thesis.source_record(
            provider="riudg",
            provider_record_id="communication-boundary",
            source_url=None,
            raw_fields={
                "dc.title": ["Comunicación, cultura y producción simbólica"],
                "dc.degree.name": ["Maestría en Comunicación"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUCSH"],
                "dc.date.issued": ["2018-06-00"],
                "dc.type": ["Tesis de Maestría"],
            },
            raw_payload="communication-boundary",
        )

        corpus = thesis.build_corpus(
            [record],
            self.registry,
            reference_year=2026,
        )
        work = corpus["works"][0]

        self.assertEqual(work["admissionStatus"], "review")
        self.assertEqual(
            work["programRef"],
            "program:udg:mae-comunicacion",
        )
        self.assertEqual(work["institutionRef"], "institution:udg")
        self.assertEqual(work["date"]["value"], "2018-06")
        self.assertEqual(
            corpus["programAuthorityRevision"],
            self.registry["registryRevision"],
        )

    def test_doctorado_educacion_boundary_authority_v8(self):
        for raw in (
            "Doctorado en Educación",
            "DOCTORADO EN EDUCACION",
        ):
            with self.subTest(raw=raw):
                resolved = thesis.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    "program:udg:doc-educacion",
                )
                self.assertEqual(
                    resolved["admissionState"],
                    "review",
                )

        record = thesis.source_record(
            provider="riudg",
            provider_record_id="doctorado-educacion-boundary",
            source_url=None,
            raw_fields={
                "dc.title": ["Educación, cultura y procesos sociales"],
                "dc.degree.name": ["Doctorado en Educación"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUCSH"],
                "dc.date.issued": ["2020-06-00"],
                "dc.type": ["Tesis de Doctorado"],
            },
            raw_payload="doctorado-educacion-boundary",
        )

        corpus = thesis.build_corpus(
            [record],
            self.registry,
            reference_year=2026,
        )
        work = corpus["works"][0]

        self.assertEqual(work["admissionStatus"], "review")
        self.assertEqual(
            work["programRef"],
            "program:udg:doc-educacion",
        )
        self.assertEqual(work["institutionRef"], "institution:udg")
        self.assertEqual(work["date"]["value"], "2020-06")
        self.assertEqual(
            corpus["programAuthorityRevision"],
            self.registry["registryRevision"],
        )

    def test_maestria_investigacion_educativa_boundary_authority_v9(self):
        for raw in (
            "Maestría en Investigación Educativa",
            "MAESTRIA EN INVESTIGACION EDUCATIVA",
        ):
            with self.subTest(raw=raw):
                resolved = thesis.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    "program:udg:mae-investigacion-educativa",
                )
                self.assertEqual(
                    resolved["admissionState"],
                    "review",
                )

        record = thesis.source_record(
            provider="riudg",
            provider_record_id="maestria-investigacion-educativa-boundary",
            source_url=None,
            raw_fields={
                "dc.title": ["Historia, alteridad y procesos educativos"],
                "dc.degree.name": ["Maestría en Investigación Educativa"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUCSH"],
                "dc.date.issued": ["2021-06-00"],
                "dc.type": ["Tesis de Maestría"],
            },
            raw_payload="maestria-investigacion-educativa-boundary",
        )

        corpus = thesis.build_corpus(
            [record],
            self.registry,
            reference_year=2026,
        )
        work = corpus["works"][0]

        self.assertEqual(work["admissionStatus"], "review")
        self.assertEqual(
            work["programRef"],
            "program:udg:mae-investigacion-educativa",
        )
        self.assertEqual(work["institutionRef"], "institution:udg")
        self.assertEqual(work["date"]["value"], "2021-06")
        self.assertEqual(
            corpus["programAuthorityRevision"],
            self.registry["registryRevision"],
        )

    def test_doctorado_cognicion_aprendizaje_boundary_authority_v10(self):
        for raw in (
            "Doctorado en Cognición y Aprendizaje",
            "DOCTORADO EN COGNICION Y APRENDIZAJE",
        ):
            with self.subTest(raw=raw):
                resolved = thesis.resolve_program(raw, self.registry)
                self.assertEqual(
                    resolved["programRef"],
                    "program:udg:doc-cognicion-aprendizaje",
                )
                self.assertEqual(
                    resolved["admissionState"],
                    "review",
                )

        record = thesis.source_record(
            provider="riudg",
            provider_record_id="doctorado-cognicion-aprendizaje-boundary",
            source_url=None,
            raw_fields={
                "dc.title": ["Cognición, cultura y aprendizaje"],
                "dc.degree.name": ["Doctorado en Cognición y Aprendizaje"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.degree.department": ["CUCSH"],
                "dc.date.issued": ["2022-06-00"],
                "dc.type": ["Tesis de Doctorado"],
            },
            raw_payload="doctorado-cognicion-aprendizaje-boundary",
        )

        corpus = thesis.build_corpus(
            [record],
            self.registry,
            reference_year=2026,
        )
        work = corpus["works"][0]

        self.assertEqual(work["admissionStatus"], "review")
        self.assertEqual(
            work["programRef"],
            "program:udg:doc-cognicion-aprendizaje",
        )
        self.assertEqual(work["institutionRef"], "institution:udg")
        self.assertEqual(work["date"]["value"], "2022-06")
        self.assertEqual(
            corpus["programAuthorityRevision"],
            self.registry["registryRevision"],
        )

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

    def test_author_supervisor_name_collision_is_flagged_not_fatal(self):
        record = thesis.source_record(
            provider="riudg",
            provider_record_id="role-collision",
            source_url=None,
            raw_fields={
                "dc.title": ["Tesis con conflicto de rol en fuente"],
                "dc.contributor.author": ["Ceja Mejia Oscar Eduardo"],
                "dc.contributor.director": ["Ceja Mejia Oscar Eduardo"],
                "dc.degree.name": ["Licenciatura en Historia"],
                "dc.degree.grantor": ["Universidad de Guadalajara"],
                "dc.type": ["Tesis de Licenciatura"],
            },
            raw_payload="role-collision",
        )

        corpus = thesis.build_corpus(
            [record],
            self.registry,
            reference_year=2026,
        )

        work = corpus["works"][0]
        self.assertEqual(
            work["metadataQualityFlags"],
            ["author-supervisor-name-collision"],
        )
        self.assertEqual(len(work["contributionConflicts"]), 1)

        conflict = work["contributionConflicts"][0]
        self.assertEqual(
            conflict["normalizedName"],
            "ceja mejia oscar eduardo",
        )
        self.assertEqual(
            conflict["roles"],
            ["thesis-author", "thesis-director"],
        )
        self.assertEqual(
            conflict["resolutionDirective"],
            "do-not-auto-resolve",
        )

        matching = [
            item
            for item in work["contributions"]
            if item["normalizedName"] == "ceja mejia oscar eduardo"
        ]
        self.assertEqual(
            {item["role"] for item in matching},
            {"thesis-author", "thesis-director"},
        )
        self.assertEqual(
            {item["resolutionState"] for item in matching},
            {"blocked-role-conflict"},
        )
        self.assertEqual(
            corpus["metrics"]["metadataQualityFlags"],
            {"author-supervisor-name-collision": 1},
        )

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

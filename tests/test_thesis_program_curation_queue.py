from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
THESIS_DIR = ROOT / "scripts" / "thesis"
sys.path.insert(0, str(THESIS_DIR))

MODULE_PATH = THESIS_DIR / "build_program_curation_queue_v1.py"
spec = importlib.util.spec_from_file_location("program_queue", MODULE_PATH)
queue = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(queue)

canonical = queue.canonical


class ThesisProgramCurationQueueTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = canonical.load_program_registry(
            THESIS_DIR / "config" / "program-authority-v1.json"
        )

    def test_phrase_matching_does_not_match_inside_other_words(self):
        self.assertTrue(queue.phrase_present("historia del arte", "arte"))
        self.assertFalse(
            queue.phrase_present(
                "licenciatura en medico cirujano y partero",
                "arte",
            )
        )
        self.assertFalse(
            queue.phrase_present(
                "maestria interinstitucional en agricultura protegida",
                "cultura",
            )
        )

    def test_review_authority_is_first_class_queue_state(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "licenciatura en historia del arte",
                    "count": 2,
                    "variants": {
                        "LICENCIATURA EN HISTORIA DEL ARTE": 2,
                    },
                    "providers": {"riudg": 2},
                    "admissionStatuses": {"quarantine": 2},
                    "programRefs": {},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "LICENCIATURA EN HISTORIA DEL ARTE",
                    "academicUnitRaw": "CUTONALA",
                    "date": {
                        "value": "2019",
                        "quality": "valid",
                    },
                    "thesisTypeRaw": "Tesis de Licenciatura",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": "LICENCIATURA EN HISTORIA DEL ARTE",
                    "academicUnitRaw": "CUTONALA",
                    "date": {
                        "value": "2017",
                        "quality": "valid",
                    },
                    "thesisTypeRaw": "Tesis de Licenciatura",
                    "admissionStatus": "quarantine",
                },
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 1)
        item = payload["items"][0]
        self.assertEqual(item["queueState"], "review")
        self.assertEqual(
            item["authority"]["id"],
            "program:udg:lic-historia-arte",
        )
        self.assertEqual(item["priority"]["band"], "A")
        self.assertIn("scope-decision", item["evidenceNeeds"])
        self.assertEqual(item["observedYears"]["min"], 2017)
        self.assertEqual(item["observedYears"]["max"], 2019)

    def test_resolved_include_is_not_in_default_queue(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "licenciatura en historia",
                    "count": 5,
                    "variants": {"Licenciatura en Historia": 5},
                    "providers": {"riudg": 5},
                    "admissionStatuses": {"include": 5},
                    "programRefs": {"program:udg:lic-historia": 5},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Licenciatura en Historia",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2024", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Licenciatura",
                    "admissionStatus": "include",
                }
            ]
        }

        default = queue.build_queue(observed, corpus, self.registry)
        self.assertEqual(default["metrics"]["queueItems"], 0)
        self.assertEqual(
            default["metrics"]["allProgramStates"],
            {"resolved": 1},
        )

        all_rows = queue.build_queue(
            observed,
            corpus,
            self.registry,
            include_resolved=True,
        )
        self.assertEqual(all_rows["metrics"]["queueItems"], 1)
        self.assertEqual(all_rows["items"][0]["queueState"], "resolved")

    def test_unresolved_humanities_candidate_is_prioritized_not_admitted(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": (
                        "maestria en hermeneutica y literatura comparada"
                    ),
                    "count": 2,
                    "variants": {
                        "MAESTRIA EN HERMENEUTICA Y LITERATURA COMPARADA": 2,
                    },
                    "providers": {"riudg": 2},
                    "admissionStatuses": {"quarantine": 2},
                    "programRefs": {},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": (
                        "MAESTRIA EN HERMENEUTICA Y LITERATURA COMPARADA"
                    ),
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2003", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": (
                        "MAESTRIA EN HERMENEUTICA Y LITERATURA COMPARADA"
                    ),
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2006", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "quarantine",
                },
            ]
        }

        payload = queue.build_queue(observed, corpus, self.registry)
        item = payload["items"][0]

        self.assertEqual(item["queueState"], "unresolved")
        self.assertIsNone(item["authority"])
        self.assertIn(
            "humanities-name-signal",
            item["priority"]["reasons"],
        )
        self.assertIn(
            "priority-unit-observed",
            item["priority"]["reasons"],
        )
        self.assertEqual(
            item["decisionConstraint"],
            "priority-does-not-change-admission",
        )
        self.assertIn(
            "historical-dictamen-or-archive",
            item["evidenceNeeds"],
        )

    def test_humanities_candidate_lane_precedes_unit_triage(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en gestion publica aplicada",
                    "count": 296,
                    "variants": {"MAESTRIA EN GESTION PUBLICA APLICADA": 296},
                    "providers": {"riudg": 296},
                    "admissionStatuses": {"quarantine": 296},
                    "programRefs": {},
                },
                {
                    "normalizedKey": (
                        "maestria en hermeneutica y literatura comparada"
                    ),
                    "count": 2,
                    "variants": {
                        "MAESTRIA EN HERMENEUTICA Y LITERATURA COMPARADA": 2,
                    },
                    "providers": {"riudg": 2},
                    "admissionStatuses": {"quarantine": 2},
                    "programRefs": {},
                },
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "MAESTRIA EN GESTION PUBLICA APLICADA",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2024", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": (
                        "MAESTRIA EN HERMENEUTICA Y LITERATURA COMPARADA"
                    ),
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2006", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
            ]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(
            payload["items"][0]["curationLane"],
            "humanities-candidate",
        )
        self.assertEqual(
            payload["items"][0]["normalizedKey"],
            "maestria en hermeneutica y literatura comparada",
        )
        self.assertEqual(
            payload["items"][1]["curationLane"],
            "unit-triage",
        )
        self.assertEqual(
            payload["metrics"]["curationLanes"],
            {
                "humanities-candidate": 1,
                "unit-triage": 1,
            },
        )

    def test_cultural_management_v34_omits_both_resolved_programs(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en gestion de la cultura",
                    "count": 15,
                    "variants": {"Maestría en Gestión de la Cultura": 15},
                    "providers": {"riudg": 11, "udgvirtual": 4},
                    "admissionStatuses": {"quarantine": 15},
                    "programRefs": {},
                },
                {
                    "normalizedKey": "maestria en gestion y desarrollo cultural",
                    "count": 40,
                    "variants": {
                        "MAESTRIA EN GESTION Y DESARROLLO CULTURAL": 40,
                    },
                    "providers": {"riudg": 40},
                    "admissionStatuses": {"quarantine": 40},
                    "programRefs": {},
                },
            ]
        }

        corpus = {
            "works": [
                {
                    "programRaw": "Maestría en Gestión de la Cultura",
                    "academicUnitRaw": "SUV",
                    "date": {"value": "2025", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": "Maestría en Gestión y Desarrollo Cultural",
                    "academicUnitRaw": "CUAAD",
                    "date": {"value": "2021", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "quarantine",
                },
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(
            payload["metrics"]["allProgramStates"],
            {"resolved": 2},
        )
        self.assertEqual(payload["items"], [])

    def test_arts_heritage_v5_queue_keeps_ambiguous_generic_didactica(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "doctorado interinstitucional en arte y cultura",
                    "count": 6,
                    "variants": {
                        "DOCTORADO INTERINSTITUCIONAL EN ARTE Y CULTURA": 6,
                    },
                    "providers": {"riudg": 6},
                    "admissionStatuses": {"quarantine": 6},
                    "programRefs": {},
                },
                {
                    "normalizedKey": "maestria en etnomusicologia",
                    "count": 9,
                    "variants": {"MAESTRIA EN ETNOMUSICOLOGIA": 9},
                    "providers": {"riudg": 9},
                    "admissionStatuses": {"quarantine": 9},
                    "programRefs": {},
                },
                {
                    "normalizedKey": "maestria en ciencias de la arquitectura",
                    "count": 34,
                    "variants": {
                        "MAESTRIA EN CIENCIAS DE LA ARQUITECTURA": 34,
                    },
                    "providers": {"riudg": 34},
                    "admissionStatuses": {"quarantine": 34},
                    "programRefs": {},
                },
                {
                    "normalizedKey": "maestria en didactica de las artes",
                    "count": 39,
                    "variants": {
                        "Maestría En Didáctica De Las Artes": 39,
                    },
                    "providers": {"riudg": 39},
                    "admissionStatuses": {"quarantine": 39},
                    "programRefs": {},
                },
            ]
        }

        corpus = {
            "works": [
                {
                    "programRaw": "DOCTORADO INTERINSTITUCIONAL EN ARTE Y CULTURA",
                    "academicUnitRaw": "CUAAD",
                    "date": {"value": "2019", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Doctorado",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": "MAESTRIA EN ETNOMUSICOLOGIA",
                    "academicUnitRaw": "CUAAD",
                    "date": {"value": "2023", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": "MAESTRIA EN CIENCIAS DE LA ARQUITECTURA",
                    "academicUnitRaw": "CUAAD",
                    "date": {"value": "2021", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": "Maestría En Didáctica De Las Artes",
                    "academicUnitRaw": "CUAAD",
                    "date": {"value": "2014", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "quarantine",
                },
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 2)

        by_key = {
            item["normalizedKey"]: item
            for item in payload["items"]
        }

        architecture = by_key["maestria en ciencias de la arquitectura"]
        self.assertEqual(architecture["queueState"], "review")
        self.assertEqual(architecture["curationLane"], "scope-review")
        self.assertEqual(
            architecture["authority"]["id"],
            "program:udg:mae-ciencias-arquitectura",
        )

        generic_didactica = by_key["maestria en didactica de las artes"]
        self.assertEqual(generic_didactica["queueState"], "unresolved")
        self.assertEqual(
            generic_didactica["curationLane"],
            "unit-triage",
        )
        self.assertIsNone(generic_didactica["authority"])

        self.assertNotIn(
            "doctorado interinstitucional en arte y cultura",
            by_key,
        )
        self.assertNotIn(
            "maestria en etnomusicologia",
            by_key,
        )

    def test_art_theory_v6_is_resolved_and_omitted_from_default_queue(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en teoria del arte",
                    "count": 1,
                    "variants": {
                        "Maestría En Teoria Del Arte": 1,
                    },
                    "providers": {"riudg": 1},
                    "admissionStatuses": {"quarantine": 1},
                    "programRefs": {},
                },
                {
                    "normalizedKey": "licenciatura en cultura fisica y deportes",
                    "count": 11,
                    "variants": {
                        "Licenciatura en Cultura Física y Deportes": 11,
                    },
                    "providers": {"riudg": 11},
                    "admissionStatuses": {"quarantine": 11},
                    "programRefs": {},
                },
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Maestría En Teoria Del Arte",
                    "academicUnitRaw": "CUAAD",
                    "date": {"value": "2004-06", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "include",
                },
                {
                    "programRaw": "Licenciatura en Cultura Física y Deportes",
                    "academicUnitRaw": "CUCS",
                    "date": {"value": "2020", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Licenciatura",
                    "admissionStatus": "quarantine",
                },
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 1)
        self.assertEqual(
            payload["metrics"]["allProgramStates"],
            {"resolved": 1, "unresolved": 1},
        )
        self.assertEqual(
            payload["items"][0]["normalizedKey"],
            "licenciatura en cultura fisica y deportes",
        )
        self.assertEqual(
            payload["items"][0]["curationLane"],
            "humanities-candidate",
        )

    def test_communication_v29_exclude_is_resolved_and_omitted(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en comunicacion",
                    "count": 67,
                    "variants": {
                        "Maestría en Comunicación": 52,
                        "MAESTRIA EN COMUNICACION": 15,
                    },
                    "providers": {"riudg": 67},
                    "admissionStatuses": {"review": 67},
                    "programRefs": {"program:udg:mae-comunicacion": 67},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Maestría en Comunicación",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2018", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "exclude",
                }
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(
            payload["metrics"]["allProgramStates"],
            {"resolved": 1},
        )

    def test_doctorado_educacion_v31_is_resolved_and_omitted(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "doctorado en educacion",
                    "count": 73,
                    "variants": {
                        "Doctorado en Educación": 73,
                    },
                    "providers": {"riudg": 73},
                    "admissionStatuses": {"review": 73},
                    "programRefs": {"program:udg:doc-educacion": 73},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Doctorado en Educación",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2020", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Doctorado",
                    "admissionStatus": "exclude",
                }
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(
            payload["metrics"]["allProgramStates"],
            {"resolved": 1},
        )

    def test_maestria_investigacion_educativa_v36_is_resolved_and_omitted(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en investigacion educativa",
                    "count": 34,
                    "variants": {
                        "Maestría en Investigación Educativa": 34,
                    },
                    "providers": {"riudg": 34},
                    "admissionStatuses": {"quarantine": 34},
                    "programRefs": {},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Maestría en Investigación Educativa",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2021", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "review",
                }
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(payload["items"], [])
        self.assertEqual(payload["humanitiesActionItems"], [])
        resolved = queue.canonical.resolve_program(
            "Maestría en Investigación Educativa",
            self.registry,
        )
        self.assertEqual(
            resolved["programRef"],
            "program:udg:mae-investigacion-educativa",
        )
        self.assertEqual(resolved["admissionState"], "exclude")

    def test_doctorado_cognicion_aprendizaje_v10_moves_to_scope_review(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "doctorado en cognicion y aprendizaje",
                    "count": 4,
                    "variants": {
                        "Doctorado en Cognición y Aprendizaje": 4,
                    },
                    "providers": {"riudg": 4},
                    "admissionStatuses": {"quarantine": 4},
                    "programRefs": {},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Doctorado en Cognición y Aprendizaje",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2022", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Doctorado",
                    "admissionStatus": "review",
                }
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 1)
        item = payload["items"][0]
        self.assertEqual(item["queueState"], "review")
        self.assertEqual(item["curationLane"], "scope-review")
        self.assertEqual(
            item["authority"]["id"],
            "program:udg:doc-cognicion-aprendizaje",
        )
        self.assertEqual(
            item["authority"]["admissionState"],
            "review",
        )

    def test_maestria_estudios_genero_v11_moves_to_scope_review(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en estudios de genero",
                    "count": 1,
                    "variants": {
                        "Maestría en Estudios de Género": 1,
                    },
                    "providers": {"riudg": 1},
                    "admissionStatuses": {"quarantine": 1},
                    "programRefs": {},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Maestría en Estudios de Género",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2026", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "review",
                }
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 1)
        item = payload["items"][0]
        self.assertEqual(item["queueState"], "review")
        self.assertEqual(item["curationLane"], "scope-review")
        self.assertEqual(
            item["authority"]["id"],
            "program:udg:mae-estudios-genero",
        )
        self.assertEqual(
            item["authority"]["admissionState"],
            "review",
        )

    def test_confirmed_exclude_program_is_resolved_and_omitted_from_queue(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "doctorado en ciencias sociales",
                    "count": 217,
                    "variants": {
                        "Doctorado en Ciencias Sociales": 217,
                    },
                    "providers": {"riudg": 217},
                    "admissionStatuses": {"quarantine": 217},
                    "programRefs": {},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Doctorado en Ciencias Sociales",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2020", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Doctorado",
                    "admissionStatus": "exclude",
                }
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(
            payload["metrics"]["allProgramStates"],
            {"resolved": 1},
        )
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"resolved": 217},
        )
        self.assertEqual(
            payload["metrics"]["gateIneligibleGroupsOmitted"],
            0,
        )

    def test_maestria_ciencias_sociales_exclude_is_resolved_and_omitted_from_queue(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "maestria en ciencias sociales",
                    "count": 60,
                    "variants": {
                        "Maestría en Ciencias Sociales": 60,
                    },
                    "providers": {"riudg": 60},
                    "admissionStatuses": {"quarantine": 60},
                    "programRefs": {},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Maestría en Ciencias Sociales",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2022", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Maestría",
                    "admissionStatus": "exclude",
                }
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(
            payload["metrics"]["allProgramStates"],
            {"resolved": 1},
        )
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"resolved": 60},
        )
        self.assertEqual(
            payload["metrics"]["gateIneligibleGroupsOmitted"],
            0,
        )

    def test_gestion_desarrollo_social_exclude_is_resolved_and_omitted_from_queue(self):
        observed = {
            "programs": [{
                "normalizedKey": "maestria en gestion y desarrollo social",
                "count": 106,
                "variants": {"Maestría en Gestión y Desarrollo Social": 106},
                "providers": {"riudg": 106},
                "admissionStatuses": {"quarantine": 106},
                "programRefs": {},
            }]
        }
        corpus = {
            "works": [{
                "programRaw": "Maestría en Gestión y Desarrollo Social",
                "academicUnitRaw": "CUCSH",
                "date": {"value": "2024", "quality": "valid"},
                "thesisTypeRaw": "Tesis de Maestría",
                "admissionStatus": "exclude",
            }]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(payload["metrics"]["allProgramStates"], {"resolved": 1})
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"resolved": 106},
        )
        self.assertEqual(payload["metrics"]["gateIneligibleGroupsOmitted"], 0)

    def test_maestria_ciencia_politica_exclude_is_resolved_and_omitted_from_queue(self):
        observed = {
            "programs": [{
                "normalizedKey": "maestria en ciencia politica",
                "count": 51,
                "variants": {"Maestría en Ciencia Política": 51},
                "providers": {"riudg": 51},
                "admissionStatuses": {"quarantine": 51},
                "programRefs": {},
            }]
        }
        corpus = {
            "works": [{
                "programRaw": "Maestría en Ciencia Política",
                "academicUnitRaw": "CUCSH",
                "date": {"value": "2023", "quality": "valid"},
                "thesisTypeRaw": "Tesis de Maestría",
                "admissionStatus": "exclude",
            }]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(payload["metrics"]["allProgramStates"], {"resolved": 1})
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"resolved": 51},
        )
        self.assertEqual(payload["metrics"]["gateIneligibleGroupsOmitted"], 0)

    def test_relaciones_internacionales_exclude_is_resolved_and_omitted_from_queue(self):
        observed = {
            "programs": [{
                "normalizedKey": "licenciatura en relaciones internacionales",
                "count": 48,
                "variants": {"Licenciatura en Relaciones Internacionales": 48},
                "providers": {"riudg": 48},
                "admissionStatuses": {"quarantine": 48},
                "programRefs": {},
            }]
        }
        corpus = {
            "works": [{
                "programRaw": "Licenciatura en Relaciones Internacionales",
                "academicUnitRaw": "CUCSH",
                "date": {"value": "2021", "quality": "valid"},
                "thesisTypeRaw": "Tesis de Licenciatura",
                "admissionStatus": "exclude",
            }]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(payload["metrics"]["allProgramStates"], {"resolved": 1})
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"resolved": 48},
        )
        self.assertEqual(payload["metrics"]["gateIneligibleGroupsOmitted"], 0)

    def test_global_politics_transpacific_exclude_is_resolved_and_omitted_from_queue(self):
        observed = {
            "programs": [{
                "normalizedKey": "maestria en global politics and transpacific studies",
                "count": 7,
                "variants": {"Maestría en Global Politics and Transpacific Studies": 7},
                "providers": {"riudg": 7},
                "admissionStatuses": {"quarantine": 7},
                "programRefs": {},
            }]
        }
        corpus = {
            "works": [{
                "programRaw": "Maestría en Global Politics and Transpacific Studies",
                "academicUnitRaw": "CUCSH",
                "date": {"value": "2021", "quality": "valid"},
                "thesisTypeRaw": "Tesis de Maestría",
                "admissionStatus": "exclude",
            }]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(payload["metrics"]["allProgramStates"], {"resolved": 1})
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"resolved": 7},
        )
        self.assertEqual(payload["metrics"]["gateIneligibleGroupsOmitted"], 0)

    def test_ciudad_territorio_sustentabilidad_moves_to_work_level_review(self):
        observed = {
            "programs": [{
                "normalizedKey": "doctorado en ciudad territorio y sustentabilidad",
                "count": 152,
                "variants": {"Doctorado en Ciudad, Territorio y Sustentabilidad": 152},
                "providers": {"riudg": 152},
                "admissionStatuses": {"quarantine": 152},
                "programRefs": {},
            }]
        }
        corpus = {
            "works": [{
                "programRaw": "Doctorado en Ciudad, Territorio y Sustentabilidad",
                "academicUnitRaw": "CUAAD",
                "date": {"value": "2021", "quality": "valid"},
                "thesisTypeRaw": "Tesis de Doctorado",
                "admissionStatus": "review",
            }]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(payload["metrics"]["queueItems"], 1)
        self.assertEqual(payload["metrics"]["allProgramStates"], {"review": 1})
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"review": 152},
        )
        self.assertEqual(payload["metrics"]["humanitiesActionQueueItems"], 0)
        self.assertEqual(payload["metrics"]["humanitiesActionWorks"], 0)
        self.assertEqual(payload["metrics"]["workReviewQueueItems"], 1)
        self.assertEqual(payload["metrics"]["workReviewWorks"], 152)
        self.assertEqual(payload["humanitiesActionItems"], [])
        self.assertEqual(len(payload["workReviewItems"]), 1)

        item = payload["items"][0]
        self.assertEqual(item["queueState"], "review")
        self.assertEqual(item["curationLane"], "work-level-review")
        self.assertEqual(
            item["authority"]["id"],
            "program:udg:doc-ciudad-territorio-sustentabilidad",
        )
        self.assertEqual(item["authority"]["admissionState"], "review")
        self.assertEqual(
            item["evidenceNeeds"],
            [
                "work-level-primary-source-adjudication",
                "explicit-human-validation",
            ],
        )
        self.assertEqual(
            item["workReview"]["programLevelConclusion"],
            "program-level-scope-review-exhausted",
        )

    def test_maestria_derecho_exclude_is_resolved_and_omitted_from_queue(self):
        observed = {
            "programs": [{
                "normalizedKey": "maestria en derecho",
                "count": 296,
                "variants": {"Maestría en Derecho": 296},
                "providers": {"riudg": 296},
                "admissionStatuses": {"quarantine": 296},
                "programRefs": {},
            }]
        }
        corpus = {
            "works": [{
                "programRaw": "Maestría en Derecho",
                "academicUnitRaw": "CUCSH",
                "date": {"value": "2025", "quality": "valid"},
                "thesisTypeRaw": "Tesis de Maestría",
                "admissionStatus": "exclude",
            }]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(payload["metrics"]["allProgramStates"], {"resolved": 1})
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"resolved": 296},
        )
        self.assertEqual(payload["metrics"]["gateIneligibleGroupsOmitted"], 0)

    def test_licenciatura_derecho_exclude_is_resolved_and_omitted_from_queue(self):
        observed = {
            "programs": [{
                "normalizedKey": "licenciatura en derecho",
                "count": 150,
                "variants": {"Licenciatura en Derecho": 150},
                "providers": {"riudg": 150},
                "admissionStatuses": {"quarantine": 150},
                "programRefs": {},
            }]
        }
        corpus = {
            "works": [{
                "programRaw": "Licenciatura en Derecho",
                "academicUnitRaw": "CULAGOS",
                "date": {"value": "2018", "quality": "valid"},
                "thesisTypeRaw": "Tesis de Licenciatura",
                "admissionStatus": "exclude",
            }]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(payload["metrics"]["allProgramStates"], {"resolved": 1})
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"resolved": 150},
        )

    def test_doctorado_derechos_humanos_moves_to_scope_review(self):
        observed = {
            "programs": [{
                "normalizedKey": "doctorado en derechos humanos",
                "count": 24,
                "variants": {"Doctorado en Derechos Humanos": 24},
                "providers": {"riudg": 24},
                "admissionStatuses": {"quarantine": 24},
                "programRefs": {},
            }]
        }
        corpus = {
            "works": [{
                "programRaw": "Doctorado en Derechos Humanos",
                "academicUnitRaw": "CUTONALA",
                "date": {"value": "2024", "quality": "valid"},
                "thesisTypeRaw": "Tesis de Doctorado",
                "admissionStatus": "review",
            }]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(payload["metrics"]["queueItems"], 1)
        self.assertEqual(payload["metrics"]["allProgramStates"], {"review": 1})
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"review": 24},
        )
        item = payload["items"][0]
        self.assertEqual(item["queueState"], "review")
        self.assertEqual(item["curationLane"], "scope-review")
        self.assertEqual(
            item["authority"]["id"],
            "program:udg:doc-derechos-humanos",
        )
        self.assertEqual(item["authority"]["admissionState"], "review")

    def test_doctorado_derecho_exclude_is_resolved_and_omitted_from_queue(self):
        observed = {
            "programs": [{
                "normalizedKey": "doctorado en derecho",
                "count": 21,
                "variants": {"Doctorado en Derecho": 21},
                "providers": {"riudg": 21},
                "admissionStatuses": {"quarantine": 21},
                "programRefs": {},
            }]
        }
        corpus = {
            "works": [{
                "programRaw": "Doctorado en Derecho",
                "academicUnitRaw": "CUCSH",
                "date": {"value": "2021", "quality": "valid"},
                "thesisTypeRaw": "Tesis de Doctorado",
                "admissionStatus": "exclude",
            }]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(payload["metrics"]["allProgramStates"], {"resolved": 1})
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"resolved": 21},
        )

    def test_tecnologias_aprendizaje_v38_is_resolved_exclude(self):
        observed = {
            "programs": [{
                "normalizedKey": "maestria en tecnologias para el aprendizaje",
                "count": 266,
                "variants": {"Maestría en Tecnologías para el Aprendizaje": 266},
                "providers": {"riudg": 266},
                "admissionStatuses": {"review": 266},
                "programRefs": {
                    "program:udg:mae-tecnologias-aprendizaje": 266
                },
            }]
        }
        corpus = {
            "works": [{
                "programRaw": "Maestría en Tecnologías para el Aprendizaje",
                "academicUnitRaw": "CUCEA",
                "date": {"value": "2025", "quality": "valid"},
                "thesisTypeRaw": "Tesis de Maestría",
                "admissionStatus": "exclude",
                "programRef": "program:udg:mae-tecnologias-aprendizaje",
            }]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(payload["metrics"]["allProgramStates"], {"resolved": 1})
        self.assertEqual(
            payload["metrics"]["worksByProgramState"],
            {"resolved": 266},
        )
        self.assertEqual(payload["humanitiesActionItems"], [])
        self.assertIsNone(payload["nextHumanitiesAction"])

    def test_gate_ineligible_program_group_is_omitted_from_queue(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "doctorado en antropologia social",
                    "count": 1,
                    "variants": {
                        "Doctorado en Antropología Social": 1,
                    },
                    "providers": {"riudg": 1},
                    "admissionStatuses": {"exclude": 1},
                    "programRefs": {},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Doctorado en Antropología Social",
                    "academicUnitRaw": None,
                    "date": {"value": "2007", "quality": "valid"},
                    "thesisTypeRaw": "Tesis de Doctorado",
                    "admissionStatus": "exclude",
                }
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 0)
        self.assertEqual(
            payload["metrics"]["gateIneligibleGroupsOmitted"],
            1,
        )
        self.assertEqual(
            payload["metrics"]["gateIneligibleWorksOmitted"],
            1,
        )
        self.assertEqual(
            payload["metrics"]["allProgramStates"],
            {"unresolved": 1},
        )

    def test_mixed_external_and_gate_eligible_group_stays_in_queue(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "programa mixto",
                    "count": 2,
                    "variants": {"Programa mixto": 2},
                    "providers": {"riudg": 2},
                    "admissionStatuses": {
                        "exclude": 1,
                        "quarantine": 1,
                    },
                    "programRefs": {},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Programa mixto",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2020", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "exclude",
                },
                {
                    "programRaw": "Programa mixto",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2021", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
            ]
        }

        payload = queue.build_queue(
            observed,
            corpus,
            self.registry,
        )

        self.assertEqual(payload["metrics"]["queueItems"], 1)
        self.assertEqual(
            payload["metrics"]["gateIneligibleGroupsOmitted"],
            0,
        )
        self.assertEqual(payload["items"][0]["queueState"], "unresolved")

    def test_invalid_or_suspicious_dates_do_not_define_historical_span(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "programa desconocido",
                    "count": 3,
                    "variants": {"Programa desconocido": 3},
                    "providers": {"riudg": 3},
                    "admissionStatuses": {"quarantine": 3},
                    "programRefs": {},
                }
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Programa desconocido",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "1969", "quality": "suspicious"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": "Programa desconocido",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": None, "quality": "invalid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": "Programa desconocido",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2020", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
            ]
        }

        payload = queue.build_queue(observed, corpus, self.registry)
        years = payload["items"][0]["observedYears"]

        self.assertEqual(years["min"], 2020)
        self.assertEqual(years["max"], 2020)
        self.assertEqual(years["validObservations"], 1)

    def test_review_items_sort_before_unresolved_even_with_lower_frequency(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "licenciatura en historia del arte",
                    "count": 2,
                    "variants": {"Licenciatura en Historia del Arte": 2},
                    "providers": {"riudg": 2},
                    "admissionStatuses": {"quarantine": 2},
                    "programRefs": {},
                },
                {
                    "normalizedKey": "doctorado en ciencias sociales",
                    "count": 217,
                    "variants": {"Doctorado en Ciencias Sociales": 217},
                    "providers": {"riudg": 217},
                    "admissionStatuses": {"quarantine": 217},
                    "programRefs": {},
                },
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Licenciatura en Historia del Arte",
                    "academicUnitRaw": "CUTONALA",
                    "date": {"value": "2019", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": "Doctorado en Ciencias Sociales",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2024", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
            ]
        }

        payload = queue.build_queue(observed, corpus, self.registry)

        self.assertEqual(
            payload["items"][0]["normalizedKey"],
            "licenciatura en historia del arte",
        )
        self.assertEqual(payload["items"][0]["queueState"], "review")


    def test_high_frequency_nonhumanities_is_not_a_humanities_action(self):
        observed = {
            "programs": [
                {
                    "normalizedKey": "licenciatura en quimica farmacobiologica",
                    "count": 1085,
                    "variants": {
                        "Licenciatura en Química Farmacobiológica": 1085,
                    },
                    "providers": {"riudg": 1085},
                    "admissionStatuses": {"quarantine": 1085},
                    "programRefs": {},
                },
                {
                    "normalizedKey": "doctorado en historia de las ideas",
                    "count": 2,
                    "variants": {"Doctorado en Historia de las Ideas": 2},
                    "providers": {"riudg": 2},
                    "admissionStatuses": {"quarantine": 2},
                    "programRefs": {},
                },
                {
                    "normalizedKey": "licenciatura en ingenieria en nanotecnologia",
                    "count": 19,
                    "variants": {
                        "Licenciatura en Ingeniería en Nanotecnología": 19,
                    },
                    "providers": {"riudg": 19},
                    "admissionStatuses": {"quarantine": 19},
                    "programRefs": {},
                },
                {
                    "normalizedKey": "licenciatura en cultura fisica y deportes",
                    "count": 11,
                    "variants": {
                        "Licenciatura en Cultura Física y Deportes": 11,
                    },
                    "providers": {"riudg": 11},
                    "admissionStatuses": {"quarantine": 11},
                    "programRefs": {},
                },
            ]
        }
        corpus = {
            "works": [
                {
                    "programRaw": "Licenciatura en Química Farmacobiológica",
                    "academicUnitRaw": "CUCEI",
                    "date": {"value": "2024", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": "Doctorado en Historia de las Ideas",
                    "academicUnitRaw": "CUCSH",
                    "date": {"value": "2024", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": "Licenciatura en Ingeniería en Nanotecnología",
                    "academicUnitRaw": "CUTONALA",
                    "date": {"value": "2024", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
                {
                    "programRaw": "Licenciatura en Cultura Física y Deportes",
                    "academicUnitRaw": "CUCS",
                    "date": {"value": "2024", "quality": "valid"},
                    "thesisTypeRaw": "Tesis",
                    "admissionStatus": "quarantine",
                },
            ]
        }

        payload = queue.build_queue(observed, corpus, self.registry)
        by_key = {
            item["normalizedKey"]: item
            for item in payload["items"]
        }

        self.assertEqual(
            by_key["licenciatura en quimica farmacobiologica"][
                "curationLane"
            ],
            "high-impact-triage",
        )
        self.assertEqual(
            by_key["doctorado en historia de las ideas"]["curationLane"],
            "humanities-candidate",
        )
        self.assertEqual(
            by_key["licenciatura en ingenieria en nanotecnologia"][
                "curationLane"
            ],
            "unit-triage",
        )
        self.assertEqual(
            by_key["licenciatura en cultura fisica y deportes"][
                "curationLane"
            ],
            "humanities-candidate",
        )
        self.assertEqual(
            [
                item["normalizedKey"]
                for item in payload["humanitiesActionItems"]
            ],
            ["doctorado en historia de las ideas"],
        )
        self.assertEqual(
            payload["nextHumanitiesAction"]["normalizedKey"],
            "doctorado en historia de las ideas",
        )
        self.assertEqual(
            payload["metrics"]["deferredHighImpactItems"],
            1,
        )
        self.assertEqual(
            payload["metrics"]["deferredHighImpactWorks"],
            1085,
        )


if __name__ == "__main__":
    unittest.main()

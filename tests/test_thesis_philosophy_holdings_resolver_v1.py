"""Tests for bounded Philosophy holdings resolver."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/thesis/resolve_philosophy_holdings_v1.py"
spec=importlib.util.spec_from_file_location("resolver",SCRIPT)
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)


class HoldingsResolverTest(unittest.TestCase):
    def test_title_core_strips_responsibility(self):
        self.assertEqual(
            mod.title_core("Ética y lenguaje / Ana Pérez"),
            mod.title_core("Ética y lenguaje"),
        )

    def test_author_tokens_ignore_order_and_role(self):
        self.assertEqual(
            mod.author_tokens("Sánchez Salas, Raúl, sustentante"),
            mod.author_tokens("Raúl Sánchez Salas"),
        )

    def test_exact_bibliographic_match(self):
        source={
            "title":"El performance como una herramienta para la reflexión filosófica",
            "authors":["Raúl Sánchez Salas"],
        }
        fields={
            "título":"El performance como una herramienta para la reflexión filosófica / tesis",
            "autor":"Sánchez Salas, Raúl, sustentante",
        }
        exact,flags=mod.exact_bibliographic_match(source,fields)
        self.assertTrue(exact)
        self.assertEqual(flags,[])

    def test_typo_does_not_auto_match(self):
        source={
            "title":"Feminidad y experiencia",
            "authors":["Guillermo Castillo Ramírez"],
        }
        fields={
            "título":"Femenidad y experiencia / Guillermo Castillo Ramírez",
            "autor":"Castillo Ramírez, Guillermo",
        }
        exact,flags=mod.exact_bibliographic_match(source,fields)
        self.assertFalse(exact)
        self.assertIn("title-not-exact",flags)

    def test_apply_physical_location(self):
        row={
            "id":"x",
            "identity":{},
            "catalogEvidence":[],
            "digitalLocation":None,
            "whereaboutsStatus":"cataloged-location-unresolved",
        }
        decision={
            "status":"resolved",
            "systemNumber":"000000001",
            "method":"WTI-N",
            "holdings":[{
                "sublibrary":"B.C. CU del Norte",
                "collection":"Col. Area de Tesis",
                "classification":"100 ABC",
                "barcode":"X-1",
            }],
        }
        out=mod.apply_resolution(row,decision)
        self.assertEqual(out["whereaboutsStatus"],"physical-confirmed")
        self.assertEqual(out["identity"]["alephSystemNumber"],"000000001")


if __name__=="__main__":
    unittest.main()

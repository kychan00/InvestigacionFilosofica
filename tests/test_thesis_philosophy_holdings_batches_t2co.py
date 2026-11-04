"""T2CO safety, deterministic pagination, and no fuzzy auto-merge."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/thesis/resolve_philosophy_holdings_batches_t2co.py"
spec = importlib.util.spec_from_file_location("t2co", SCRIPT)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)


def row(index, year=1973, title="José Gaos y la filosofía de la filosofía"):
    return {
        "id": str(index), "title": title, "authors": ["Jorge Lara Ramos"],
        "year": year, "whereaboutsStatus": "cataloged-location-unresolved",
        "reviewFlags": [],
    }


class T2COTest(unittest.TestCase):
    def setUp(self):
        self.seeds = {"schemaVersion": "philosophy-aleph-identity-seeds-v1", "records": []}
        self.master = {
            "schemaVersion": "thesis-philosophy-whereabouts-index-v1",
            "revision": "test", "records": [row(i, 1970 + 10 * (i % 3)) for i in range(7)],
        }

    def test_nonoverlapping_offset_batches(self):
        all_rows = mod.eligible_records(self.master, self.seeds)
        self.assertEqual(len(all_rows), 7)
        decisions = []
        def fake_resolver(row, **kwargs):
            return {"status": "unresolved", "attempts": []}
        for offset, limit in [(0, 3), (3, 3), (6, 3)]:
            result = mod.build_batch(
                self.master, self.seeds, offset=offset, limit=limit,
                opener=object(), action="fake", resolver=fake_resolver, sleep_seconds=0,
            )
            decisions.extend(result["decisions"])
        self.assertEqual([x["id"] for x in decisions], [x["id"] for x in all_rows])
        self.assertEqual(len({x["id"] for x in decisions}), 7)

    def test_no_single_word_fallback(self):
        queries = mod.strategies(row(1))
        self.assertTrue(any(code == "WAU" for code, _, _ in queries))
        self.assertEqual(len(queries), 3)
        self.assertTrue(all(len(request.split()) >= 2 for code, request, _ in queries if code == "WTI"))

    def test_thesis_evidence_required(self):
        self.assertFalse(mod.has_thesis_evidence({"título": "Filosofía"}))
        self.assertTrue(mod.has_thesis_evidence({"base lógica": "Tesis"}))
        self.assertTrue(mod.has_thesis_evidence({"nota de tesis": "Licenciatura"}))

    def test_exact_match_resolves_holdings(self):
        def query(*args, **kwargs):
            return ["000479362"]
        def fetch(*args, **kwargs):
            return ({"fields": {
                "título": "José Gaos y la filosofía de la filosofía / autor",
                "autor": "Lara Ramos, Jorge",
                "nota de tesis": "Licenciatura",
                "número de sistema": "000479362",
            }}, [{"sublibrary": "B.C. CUCSH", "classification": "196.1 LAT 1973"}])
        result = mod.resolve_one(row(1), opener=None, action="", query=query, fetch=fetch)
        self.assertEqual(result["status"], "resolved")
        self.assertEqual(result["systemNumber"], "000479362")
        self.assertTrue(result["holdings"])

    def test_typo_remains_unresolved(self):
        source = row(1, title="Feminidad y experiencia")
        source["authors"] = ["Guillermo Castillo Ramírez"]
        def query(*args, **kwargs):
            return ["000123456"]
        def fetch(*args, **kwargs):
            return ({"fields": {
                "título": "Femenidad y experiencia",
                "autor": "Castillo Ramírez, Guillermo",
                "nota de tesis": "Licenciatura",
            }}, [])
        result = mod.resolve_one(source, opener=None, action="", query=query, fetch=fetch)
        self.assertEqual(result["status"], "unresolved")

    def test_multiple_exact_identites_are_ambiguous(self):
        def query(*args, **kwargs):
            return ["000479362", "000479363"]
        def fetch(*args, **kwargs):
            return ({"fields": {
                "título": "José Gaos y la filosofía de la filosofía",
                "autor": "Lara Ramos, Jorge",
                "nota de tesis": "Tesis",
            }}, [])
        result = mod.resolve_one(row(1), opener=None, action="", query=query, fetch=fetch)
        self.assertEqual(result["status"], "ambiguous")

    def test_candidate_overflow_cannot_resolve(self):
        def query(*args, **kwargs):
            return [f"{i:09d}" for i in range(10)]
        result = mod.resolve_one(row(1), opener=None, action="", query=query)
        self.assertEqual(result["status"], "unresolved")
        self.assertEqual(result["reason"], "candidate-overflow")

    def test_invalid_limits_rejected(self):
        with self.assertRaises(ValueError):
            mod.build_batch(self.master, self.seeds, offset=-1, limit=2)
        with self.assertRaises(ValueError):
            mod.build_batch(self.master, self.seeds, offset=0, limit=41)


if __name__ == "__main__":
    unittest.main()

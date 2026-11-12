import unittest
from scripts.cucsh.reconstruct_sincronia_issue17 import (
    score_legacy_label, reconcile_issue17,
)


def local(name, id_code):
    return {
        "id": "legacy:" + id_code, "sourceId": "legacy:" + id_code,
        "legacyOriginal": True, "journal": "Sincronía",
        "issueNumber": 17, "year": 2000,
        "title": name, "titleVariants": [name], "authors": [],
        "urls": {"canonical": "http://sincronia.cucsh.udg.mx/" + id_code + ".htm",
                 "relations": []},
    }


def dialnet(title, name, code):
    return {
        "id": "dialnet:" + code, "sourceId": "dialnet:" + code,
        "legacyOriginal": True, "journal": "Sincronía",
        "issueNumber": 17, "year": 2000, "title": title,
        "authors": [{"name": name, "sourceName": name}],
        "urls": {"canonical": "https://dialnet.unirioja.es/servlet/articulo?codigo=" + code},
    }


class Issue17ReconstructionTests(unittest.TestCase):
    def test_reversed_names_and_misspelled_given_name(self):
        a = score_legacy_label(
            "Mozejko, Danuta Teresa y Ricardo Lionel Costa",
            [{"name": "Donuta Teresa Mozejko"}, {"name": "Ricardo Lionel Costa"}],
        )
        self.assertGreaterEqual(a, 0.8)
        self.assertEqual(
            score_legacy_label("Sánchez Robles, Guadalupe", [
                {"name": "María Guadalupe Sánchez Robles"}]), 0.875,
        )

    def test_reject_title_that_is_not_author(self):
        self.assertEqual(
            score_legacy_label("Una perspectiva sociocultural de la canción",
                               [{"name": "Juan Carlos Pérez"}]), 0,
        )

    def test_one_to_one_repair_changes_only_legacy_metadata(self):
        a = local("Campos Rodríguez, Patricia", "1")
        b = local("Palomera Ugarte, Luz", "2")
        other = {"id": "other", "journal": "Protrepsis", "title": "Intacto"}
        snapshot = {"records": [a, b, other]}
        sources = [
            dialnet("Una mujer empresaria de principios de siglo",
                    "Patricia Campos Rodríguez", "7425237"),
            dialnet("El discurso de Octavio Paz ante el Ejército Zapatista",
                    "Luz Palomera Ugarte", "7425235"),
        ]
        updated, report = reconcile_issue17(snapshot, sources, expected=2, audit_run=88)
        self.assertEqual(report["reconciled"], 2)
        self.assertEqual(updated["records"][0]["title"], sources[0]["title"])
        self.assertEqual(updated["records"][0]["authors"][0]["name"], "Patricia Campos Rodríguez")
        self.assertEqual(updated["records"][0]["titleVariants"], [sources[0]["title"]])
        self.assertEqual(updated["records"][0]["urls"], a["urls"])
        self.assertEqual(updated["records"][2], other)
        self.assertEqual(
            updated["records"][0]["legacyIndexMislabelEvidence"]["auditRunId"], 88
        )

    def test_incomplete_issue_aborts_without_partial_repair(self):
        a = local("Campos Rodríguez, Patricia", "1")
        with self.assertRaisesRegex(ValueError, "coverage mismatch"):
            reconcile_issue17({"records": [a]}, [], expected=1)

    def test_ambiguous_non_unique_author_fails(self):
        a = local("Campos Rodríguez, Patricia", "1")
        b = local("Campos Rodríguez, Patricia", "2")
        d1 = dialnet("Una obra", "Patricia Campos Rodríguez", "100")
        d2 = dialnet("Otra obra", "Patricia Campos Rodríguez", "200")
        with self.assertRaisesRegex(ValueError, "Uncertain|one-to-one"):
            reconcile_issue17({"records": [a, b]}, [d1, d2], expected=2)

    def test_prior_verified_title_provenance_is_never_replaced(self):
        a = local("Campos Rodríguez, Patricia", "1")
        a["legacyTitleEncodingEvidence"] = {"kind": "verified-title"}
        with self.assertRaisesRegex(ValueError, "not raw unreconstructed"):
            reconcile_issue17(
                {"records": [a]},
                [dialnet("Una mujer empresaria", "Patricia Campos Rodríguez", "1")],
                expected=1,
            )

    def test_existing_conflicting_author_blocks_repair(self):
        a = local("Campos Rodríguez, Patricia", "1")
        a["authors"] = [{"name": "Otra Persona"}]
        with self.assertRaisesRegex(ValueError, "Existing authors conflict"):
            reconcile_issue17(
                {"records": [a]},
                [dialnet("Una mujer empresaria", "Patricia Campos Rodríguez", "1")],
                expected=1,
            )


if __name__ == "__main__":
    unittest.main()

import unittest

from scripts.cucsh.reconcile_sincronia_catalogs import (
    ISSN, match_strength, crossref_records, openalex_records,
    choose_candidate, reconcile_snapshot, relevant_candidate,
)


def old(title="La filosofía social contemporánea", issue=47, year=2008, authors=None):
    return {
        "id": "original:1", "sourceId": "legacy:1", "journal": "Sincronía",
        "issueNumber": issue, "year": year, "title": title,
        "titleVariants": [title], "authors": authors or [],
        "urls": {"canonical": "http://sincronia.cucsh.udg.mx/old.htm"},
        "legacyOriginal": True,
    }


def catalog(title="La filosofía social contemporánea", source="Dialnet",
            author="José María Areta", issue=47, year=2008, source_id="dialnet:1"):
    return {
        "title": title, "source": source,
        "sourceUrl": "https://dialnet.unirioja.es/servlet/articulo?codigo=1",
        "sourceId": source_id, "authors": [author] if author else [],
        "issue": issue if source == "Dialnet" else None, "year": year,
    }


class CatalogReconciliationTests(unittest.TestCase):
    def test_exact_clean_and_damaged_titles(self):
        self.assertEqual(
            match_strength("La filosofía social", "La FILOSOFIA social", "Dialnet"), 1.0
        )
        self.assertEqual(
            match_strength("La filosofía social", "La ciencia social", "Dialnet"), 0
        )
        damaged = "S\ufffdtira menipea y teor\ufffda carnavalesca en la obra de Juan Rulfo"
        fixed = "Sátira menipea y teoría carnavalesca en la obra de Juan Rulfo"
        self.assertGreater(match_strength(damaged, fixed, "Dialnet"), 0.94)
        self.assertEqual(match_strength("La fi\ufffd", "La filosofía", "Dialnet"), 0)

    def test_crossref_issn_identity(self):
        base = {
            "title": ["La filosofía social contemporánea"],
            "author": [{"given": "José María", "family": "Areta"}],
            "published": {"date-parts": [[2008, 5, 4]]},
            "DOI": "10.1234/sample",
        }
        self.assertEqual(crossref_records([{**base, "ISSN": ["1234-5678"]}]), [])
        source = crossref_records([{**base, "ISSN": [ISSN]}])
        self.assertEqual(source[0]["authors"], ["José María Areta"])
        self.assertEqual(source[0]["year"], 2008)

    def test_openalex_issn_identity(self):
        sample = {
            "id": "https://openalex.org/W1", "title": "La filosofía social contemporánea",
            "publication_year": 2008,
            "authorships": [{"author": {"display_name": "José María Areta"}}],
            "primary_location": {"source": {"issn": ["1234-5678"]}},
        }
        self.assertEqual(openalex_records([sample]), [])
        sample["primary_location"]["source"]["issn"] = [ISSN]
        self.assertEqual(openalex_records([sample])[0]["authors"], ["José María Areta"])

    def test_issue_year_must_match(self):
        row = old()
        self.assertEqual(relevant_candidate(row, catalog(issue=48)), 0)
        self.assertEqual(relevant_candidate(row, catalog(source="Crossref", year=2007)), 0)

    def test_author_enrichment_and_identity_preservation(self):
        record = old()
        other = {"id": "pro:1", "journal": "Protrepsis", "title": "Original"}
        after, report, changes = reconcile_snapshot(
            {"records": [record, other]}, [catalog()], run_id=77
        )
        self.assertEqual(len(changes), 1)
        self.assertEqual(after["records"][0]["authors"][0]["name"], "José María Areta")
        self.assertEqual(
            after["records"][0]["legacyAuthorEvidence"]["auditRunId"], 77
        )
        for field in ("id", "sourceId", "urls", "year", "issueNumber", "title"):
            self.assertEqual(record.get(field), after["records"][0].get(field))
        self.assertEqual(after["records"][1], other)

    def test_damaged_title_repairs_with_catalogue_evidence(self):
        record = old("S\ufffdtira menipea y teor\ufffda carnavalesca en la obra de Juan Rulfo")
        title = "Sátira menipea y teoría carnavalesca en la obra de Juan Rulfo"
        after, _, changes = reconcile_snapshot(
            {"records": [record]}, [catalog(title=title)], run_id=33
        )
        self.assertEqual(len(changes), 1)
        self.assertEqual(after["records"][0]["title"], title)
        self.assertEqual(after["records"][0]["titleVariants"], [title])
        self.assertEqual(
            after["records"][0]["legacyTitleEncodingEvidence"]["previousTitle"],
            record["title"],
        )

    def test_conflicts_block_all_edits(self):
        record = old()
        sources = [
            catalog(),
            catalog(source="Crossref", year=2008, issue=None,
                    author="Otra Persona", source_id="doi:2"),
        ]
        winner, status, _ = choose_candidate(record, sources)
        self.assertIsNone(winner)
        self.assertEqual(status, "conflicting_catalogue_authors")
        after, _, changed = reconcile_snapshot({"records": [record]}, sources)
        self.assertEqual(changed, [])
        self.assertEqual(after["records"][0], record)

    def test_duplicate_dialnet_title_is_ambiguous(self):
        winner, status, _ = choose_candidate(
            old(), [catalog(), catalog(source_id="dialnet:2")]
        )
        self.assertIsNone(winner)
        self.assertEqual(status, "ambiguous_dialnet_article")

    def test_existing_author_not_overwritten(self):
        record = old(authors=[{"name": "Autora Original"}])
        after, _, changed = reconcile_snapshot({"records": [record]}, [catalog()])
        self.assertEqual(changed, [])
        self.assertEqual(after["records"][0], record)

    def test_other_journals_are_unchanged(self):
        record = {**old(), "journal": "Protrepsis"}
        after, _, changed = reconcile_snapshot({"records": [record]}, [catalog()])
        self.assertEqual(changed, [])
        self.assertEqual(after["records"], [record])


if __name__ == "__main__":
    unittest.main()

import unittest

from scripts.cucsh.audit_sincronia_pending_authors import audit_pending_authors


class PendingAuthorsAuditTests(unittest.TestCase):
    def test_reports_missing_authors_without_mutation_or_guessing(self):
        rows = [
            {"id": "a", "journal": "Sincronía", "issueNumber": 2,
             "title": "Article A", "authors": [],
             "urls": {"canonical": "https://old.example/a"},
             "legacyAccessStatus": {"status": "original-page-unavailable"},
             "legacyAuthorEvidence": {"sourceUrl": "https://library.example/a"}},
            {"id": "b", "journal": "Sincronía", "issueNumber": 1,
             "title": "Article B", "authors": None,
             "urls": {"canonical": "https://old.example/b"}},
            {"id": "c", "journal": "Sincronía", "issueNumber": 3,
             "title": "Article C", "authors": [{"name": "Researcher"}]},
            {"id": "d", "journal": "Protrepsis", "issueNumber": 4,
             "title": "Article D", "authors": []},
        ]
        import copy
        baseline = copy.deepcopy(rows)
        report = audit_pending_authors(rows)
        self.assertEqual(rows, baseline)
        self.assertEqual(report["totalSincroniaRecords"], 3)
        self.assertEqual(report["pendingAuthorRecords"], 2)
        self.assertEqual(report["titlesWithUnicodeReplacementCharacter"], 0)
        self.assertEqual([item["id"] for item in report["records"]], ["a", "b"])
        self.assertEqual(
            report["records"][0]["sourceAvailability"],
            "original-page-unavailable",
        )
        self.assertEqual(
            report["records"][0]["reviewPriority"],
            "inspect_bibliographic_evidence",
        )
        self.assertEqual(
            report["records"][1]["sourceAvailability"],
            "not_verified",
        )
        self.assertFalse(any("author" in item for item in report["records"]))

    def test_encoding_alert_is_informational(self):
        report = audit_pending_authors([
            {"id": "x", "journal": "Sincronía", "title": "P\ufffdrez", "authors": []}
        ])
        self.assertEqual(report["titlesWithUnicodeReplacementCharacter"], 1)
        self.assertEqual(report["pendingAuthorRecords"], 1)


    def test_identity_queue_is_only_a_review_flag(self):
        import copy

        candidates = [
            ("punctuation", 1, ",", "schmid.html",
             "malformed_or_punctuation_only_title"),
            ("person", 7, "Yolanda Bedregal", "bedregal.htm",
             "person_name_entry_needs_article_identity"),
            ("intro", 7, "Introducción", "leonard.htm",
             "generic_index_heading_needs_source"),
            ("biography", 8, "Dante Medina", "bio.html",
             "possible_biography_not_article"),
            ("label", 12, "Bañuelos,Raul", "banuelos.htm",
             "possible_author_name_transcribed_as_title"),
            ("multiple", 46, "González, Ana; Juárez, Pedro", "work.htm",
             "possible_author_name_transcribed_as_title"),
            ("editors", 46, "Editorial Board/Consejo Editorial", "creditos.html",
             "possible_editorial_navigation_not_article"),
            ("contrib", 46, "Further information for contributors.", "info.htm",
             "possible_editorial_navigation_not_article"),
            ("recent", 50, "Korstanje, Maximiliano E.", "korstanje.htm",
             "possible_author_name_transcribed_as_title"),
        ]
        records = [
            {"id": key, "journal": "Sincronía", "issueNumber": issue,
             "title": title, "authors": [],
             "urls": {"canonical": "https://legacy.example/" + url}}
            for key, issue, title, url, _ in candidates
        ]
        records += [
            {"id": "real-article", "journal": "Sincronía",
             "issueNumber": 4, "title": "American Frontiers, Gregory H. Nobles",
             "authors": [], "urls": {"canonical": "https://legacy.example/essay.htm"}},
            {"id": "protrepsis", "journal": "Protrepsis",
             "issueNumber": 46, "title": "Editorial Board/Consejo Editorial",
             "authors": []},
        ]
        before = copy.deepcopy(records)
        result = audit_pending_authors(records)
        self.assertEqual(records, before)
        self.assertEqual(result["suspectedWorkIdentityCount"], len(candidates))
        flags = {
            row["id"]: row["reviewReason"]
            for row in result["suspectedWorkIdentityRecords"]
        }
        for key, _, _, _, kind in candidates:
            self.assertEqual(flags[key], kind)
        self.assertNotIn("real-article", flags)
        self.assertNotIn("protrepsis", flags)
        self.assertEqual(result["pendingAuthorRecords"], len(candidates) + 1)
        self.assertEqual(
            sum(result["suspectedWorkIdentityByType"].values()),
            len(candidates),
        )


    def test_reyes4_issue_conflict_preserves_original_index(self):
        import copy
        indexed = {
            "id": "cucsh:sincronia-legacy:53c3bea7bff8e9572369",
            "journal": "Sincronía",
            "title": "Reyes, Giovanni E.",
            "issueNumber": 12,
            "year": 1999,
            "authors": [],
            "urls": {"canonical": (
                "http://fuentes.csh.udg.mx/CUCSH/Sincronia/reyes4.htm"
            )},
            "legacyAccessStatus": {"status": "original-page-unavailable"},
        }
        frozen = copy.deepcopy(indexed)
        report = audit_pending_authors([indexed])
        self.assertEqual(indexed, frozen)
        self.assertEqual(report["bibliographicConflictCount"], 1)
        case = report["bibliographicConflicts"][0]
        self.assertEqual(case["indexedIssue"], 12)
        self.assertEqual(case["indexedYear"], 1999)
        self.assertEqual(case["externalCitedIssue"], 21)
        self.assertEqual(case["externalCitedYear"], 2001)
        self.assertEqual(case["status"], "unresolved_issue_and_year_conflict")
        self.assertEqual(
            report["records"][0]["sourceAvailability"],
            "original-page-unavailable",
        )

    def test_unrelated_records_never_inherit_an_issue_conflict(self):
        rows = [{
            "id": "other",
            "journal": "Sincronía",
            "title": "Reyes, Giovanni E.",
            "issueNumber": 12,
            "year": 1999,
            "authors": [],
            "urls": {"canonical": "https://example.edu/reyes4.htm"},
        }]
        self.assertEqual(
            audit_pending_authors(rows)["bibliographicConflictCount"], 0
        )


    def test_editorial_navigation_is_reported_without_deleting_or_attributing(self):
        import copy
        two = [
            {
                "id": "cucsh:sincronia-legacy:91f36da6674c93b19145",
                "journal": "Sincronía", "issueNumber": 46, "year": 2008,
                "title": "Editorial Board/Consejo Editorial", "authors": [],
                "urls": {"canonical": "http://sincronia.cucsh.udg.mx/creditos.html"},
                "legacyAccessStatus": {"status": "original-page-unavailable"},
            },
            {
                "id": "cucsh:sincronia-legacy:a2763a903fcca568e32a",
                "journal": "Sincronía", "issueNumber": 46, "year": 2008,
                "title": "Further information for contributors.", "authors": [],
                "urls": {"canonical": "http://sincronia.cucsh.udg.mx/info.htm"},
                "legacyAccessStatus": {"status": "original-page-archived-only"},
            },
        ]
        ordinary = {
            "id": "unrelated", "journal": "Sincronía", "issueNumber": 46,
            "year": 2008, "title": "Original research paper",
            "authors": [{"name": "Researcher"}],
            "urls": {"canonical": "http://sincronia.cucsh.udg.mx/paper.htm"},
        }
        rows = two + [ordinary]
        before = copy.deepcopy(rows)
        result = audit_pending_authors(rows)
        self.assertEqual(rows, before)
        self.assertEqual(result["totalSincroniaRecords"], 3)
        self.assertEqual(result["pendingAuthorRecords"], 2)
        self.assertEqual(result["highConfidenceEditorialNavigationCount"], 2)
        self.assertEqual(result["articleCandidatesExcludingEditorialNavigation"], 1)
        self.assertEqual(result["authorlessArticleCandidatesExcludingEditorialNavigation"], 0)
        self.assertEqual(
            {item["classification"] for item in result["highConfidenceEditorialNavigationRecords"]},
            {"editorial_board_navigation", "contributor_instructions_navigation"},
        )
        self.assertEqual([row["id"] for row in rows], [row["id"] for row in before])

    def test_editorial_classification_requires_exact_issue_label_and_url(self):
        originals = [
            {
                "id": "cucsh:sincronia-legacy:91f36da6674c93b19145",
                "journal": "Sincronía", "issueNumber": 47, "year": 2008,
                "title": "Editorial Board/Consejo Editorial",
                "authors": [], "urls": {"canonical": "https://example.edu/creditos.html"},
            },
            {
                "id": "not-original", "journal": "Sincronía",
                "issueNumber": 46, "year": 2008,
                "title": "Further information for contributors.",
                "authors": [], "urls": {"canonical": "https://example.edu/info.htm"},
            },
        ]
        report = audit_pending_authors(originals)
        self.assertEqual(report["highConfidenceEditorialNavigationCount"], 0)
        self.assertEqual(report["articleCandidatesExcludingEditorialNavigation"], 2)

    def test_issue_50_two_possible_works_not_assigned(self):
        import copy
        records = [
            {
                "id": "cucsh:sincronia-legacy:8eded0eac6e2a217ade1",
                "journal": "Sincronía", "issueNumber": 50, "year": 2009,
                "title": "Korstanje, Maximiliano E.", "authors": [],
                "urls": {"canonical": (
                    "http://sincronia.cucsh.udg.mx/korstanjespring09.htm"
                )},
                "legacyAccessStatus": {"status": "original-page-archived-only"},
            },
            {
                "id": "another-same-issue", "journal": "Sincronía",
                "issueNumber": 50, "year": 2009,
                "title": "La delincuencia hoy: el doble valor de la represión",
                "authors": [{"name": "Maximiliano Emanuel Korstanje"}],
            },
        ]
        before = copy.deepcopy(records)
        report = audit_pending_authors(records)
        self.assertEqual(records, before)
        self.assertEqual(len(report["unresolvedIssue50UrlMappings"]), 1)
        mapping = report["unresolvedIssue50UrlMappings"][0]
        self.assertEqual(mapping["status"], "unresolved_original_url_to_article_mapping")
        self.assertEqual(len(mapping["possibleWorks"]), 2)
        self.assertEqual(len(report["issue50WorkSnapshot"]), 2)
        self.assertEqual(report["pendingAuthorRecords"], 1)
        self.assertEqual(report["records"][0]["title"], before[0]["title"])

    def test_issue_50_mapping_omitted_when_id_or_url_differs(self):
        item = {
            "id": "not-indexed-original", "journal": "Sincronía",
            "issueNumber": 50, "year": 2009,
            "title": "Korstanje, Maximiliano E.", "authors": [],
            "urls": {"canonical": (
                "http://sincronia.cucsh.udg.mx/korstanjespring09.htm"
            )},
        }
        self.assertEqual(
            audit_pending_authors([item])["unresolvedIssue50UrlMappings"], []
        )


if __name__ == "__main__":
    unittest.main()

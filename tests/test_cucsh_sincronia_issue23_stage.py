import unittest

from scripts.cucsh.reconcile_sincronia_issue23 import (
    APPROVED, ISSUE_URL, stage_issue23, verify_source,
)


def original(identifier, entry):
    title = entry["title"]
    if entry["repairTitle"]:
        title = "Una lectura m\ufffdgica de Los r\ufffdos profundos ,de Jos\ufffd M\ufffd Arguedas"
    return {
        "id": identifier, "sourceId": "legacy:" + identifier.rsplit(":",1)[-1],
        "journal": "Sincronía", "issueNumber": 23, "year": 2002,
        "legacyOriginal": True, "title": title, "titleVariants": [title],
        "authors": [], "urls": {"canonical": entry["localUrl"]},
    }


def external(entry):
    code = entry["sourceId"].split(":")[1]
    title = entry["title"]
    if not entry["repairTitle"]:
        title = "Risa, burla y escarnio"
    return {
        "id": entry["sourceId"], "sourceId": entry["sourceId"],
        "journal": "Sincronía", "issueNumber": 23, "year": 2002,
        "title": title,
        "authors": [{"name": author} for author in entry["authors"]],
        "urls": {"canonical": "https://dialnet.unirioja.es/servlet/articulo?codigo=" + code},
    }


def fixture():
    before = [original(identifier, entry) for identifier, entry in APPROVED.items()]
    catalogue = [external(entry) for entry in APPROVED.values()]
    for number in range(7):
        before.append({
            "id": f"legacy:other:{number}", "journal": "Sincronía",
            "issueNumber": 23, "title": f"Another legitimate article {number}",
            "authors": [{"name": "Verified Author"}],
        })
        catalogue.append({
            "sourceId": f"dialnet:{number + 100}",
            "journal": "Sincronía", "issueNumber": 23, "title": f"Another {number}",
        })
    before.append({"id": "pro:1", "journal": "Protrepsis", "title": "Unchanged"})
    return {"records": before}, catalogue


class Issue23ReconciliationTests(unittest.TestCase):
    def test_exactly_two_source_verified_improvements(self):
        before, catalogue = fixture()
        after, report = stage_issue23(before, catalogue, run_id=987)
        self.assertEqual(report["updatedRecords"], 2)
        self.assertEqual(len(after["records"]), len(before["records"]))
        self.assertEqual(after["records"][-1], before["records"][-1])
        for identifier, entry in APPROVED.items():
            old = next(row for row in before["records"] if row["id"] == identifier)
            new = next(row for row in after["records"] if row["id"] == identifier)
            self.assertEqual(new["title"], entry["title"])
            self.assertEqual([x["name"] for x in new["authors"]], entry["authors"])
            self.assertEqual(new["urls"], old["urls"])
            self.assertEqual(new["legacyAuthorEvidence"]["auditRunId"], 987)
            if entry["repairTitle"]:
                self.assertEqual(
                    new["legacyTitleEncodingEvidence"]["previousTitle"],
                    old["title"],
                )
            else:
                self.assertNotIn("legacyTitleEncodingEvidence", new)

    def test_reject_wrong_source_article_number(self):
        before, catalogue = fixture()
        catalogue[0] = {**catalogue[0], "sourceId": "dialnet:another"}
        with self.assertRaisesRegex(ValueError, "Missing one of"):
            stage_issue23(before, catalogue)

    def test_wrong_source_author_rejected(self):
        entry = next(iter(APPROVED.values()))
        candidate = external(entry)
        candidate["authors"] = [{"name": "Incorrect Attribution"}]
        with self.assertRaisesRegex(ValueError, "source authors"):
            verify_source(entry, candidate)

    def test_do_not_replace_long_title_with_short_html_fragment(self):
        entry = next(v for v in APPROVED.values() if not v["repairTitle"])
        answer = verify_source(entry, external(entry))
        self.assertEqual(answer, "Risa, burla y escarnio")

    def test_prior_author_provenance_blocks_rewrite(self):
        before, catalogue = fixture()
        before["records"][0]["legacyAuthorEvidence"] = {"kind": "prior"}
        with self.assertRaisesRegex(ValueError, "Record altered"):
            stage_issue23(before, catalogue)

    def test_reject_incomplete_issue_or_missing_article(self):
        before, catalogue = fixture()
        with self.assertRaisesRegex(ValueError, "Coverage differs"):
            stage_issue23(before, catalogue[:-1])
        with self.assertRaisesRegex(ValueError, "Coverage differs"):
            stage_issue23({"records": before["records"][:-2]}, catalogue)

    def test_reject_mismatched_damaged_original(self):
        before, catalogue = fixture()
        affected = next(row for row in before["records"] if "\ufffd" in row.get("title",""))
        affected["title"] = "A completely unrelated text \ufffd not a valid match"
        with self.assertRaisesRegex(ValueError, "Unexpected damaged-title"):
            stage_issue23(before, catalogue)

    def test_bibliographic_issue_url_is_stable(self):
        self.assertEqual(ISSUE_URL, "https://dialnet.unirioja.es/ejemplar/253500")


if __name__ == "__main__":
    unittest.main()

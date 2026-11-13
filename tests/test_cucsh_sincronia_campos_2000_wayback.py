import unittest
from scripts.cucsh.probe_sincronia_campos_2000_wayback import inspect_target, report, TARGETS

class CamposHistoricalUrlsTests(unittest.TestCase):
    def test_origins_are_distinct_and_preserved(self):
        urls=[url for _,url in TARGETS]
        self.assertEqual(len(urls),len(set(urls)))
        self.assertTrue(urls[0].endswith("/summer00.htm"))
        self.assertTrue(urls[1].endswith("/campos.htm"))
        self.assertTrue(urls[2].endswith("/campos2.htm"))

    def test_later_snapshot_cannot_prove_2000_identity(self):
        def fake(row):
            return {**row, "archiveIndexStatus":"cdx-captures", "snapshots":[
                {"timestamp":"20020607092529","archivedOriginal":row["originalUrl"],
                 "archivedPageTitle":"Uma Situação de Palavras",
                 "snapshotFetchStatus":"html-response"}]}
        r=inspect_target(TARGETS[1],inspector=fake)
        self.assertFalse(r["snapshots"][0]["sameCalendarYearAsIssue"])
        self.assertFalse(r["snapshots"][0]["year2000ArticleIdentityVerified"])

    def test_even_an_early_snapshot_needs_human_source_verification(self):
        def fake(row):
            return {**row, "archiveIndexStatus":"cdx-captures", "snapshots":[
                {"timestamp":"20000930033830","archivedOriginal":row["originalUrl"]}]}
        r=report(inspector=fake)
        self.assertEqual(r["sourceUrlsChecked"],6)
        self.assertTrue(r["sources"][1]["snapshots"][0]["sameCalendarYearAsIssue"])
        self.assertFalse(r["sources"][1]["snapshots"][0]["year2000ArticleIdentityVerified"])
        self.assertFalse(r["signed2000ArticleVerified"])
        self.assertEqual(r["authorAssignments"],0)
        self.assertFalse(r["corpusModified"])

if __name__=="__main__":
    unittest.main()

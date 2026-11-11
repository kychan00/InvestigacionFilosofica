import unittest
from scripts.cucsh.probe_sincronia_author_sources import (
    inspect_author_page, select_sample, ISSUE_SAMPLE_QUOTAS,
)


class SourceAuthorProbeTest(unittest.TestCase):
    def test_rejects_heuristic_as_explicit_author(self):
        row={"id":"a","journal":"Sincronía","issueNumber":3,
             "title":"La historia del pensamiento",
             "urls":{"canonical":"http://sincronia.cucsh.udg.mx/a.htm"}}
        html=(
            "<html><body><h1>La historia del pensamiento</h1>"
            "<p>María de la Fuente</p><p>Resumen</p></body></html>"
        ).encode("utf-8")
        data=inspect_author_page(row,html)
        self.assertEqual(data["explicitAuthorFields"],[])
        self.assertEqual(data["status"],"heuristic_review_only")

    def test_explicit_metadata_is_differentiated(self):
        row={"id":"a","issueNumber":6,"title":"Pensamiento crítico",
             "urls":{"canonical":"http://sincronia.cucsh.udg.mx/a.htm"}}
        html=(
            "<html><head><meta name='citation_author'"
            " content='Laura Ramírez'/></head><body></body></html>"
        ).encode("utf-8")
        data=inspect_author_page(row,html)
        self.assertEqual(data["status"],"explicit_metadata_available")
        self.assertEqual(data["explicitAuthorFields"][0]["value"],"Laura Ramírez")

    def test_quota_limits_nonempty_sample(self):
        rows=[]
        for n,quota in ISSUE_SAMPLE_QUOTAS.items():
            rows.extend({
                "id":f"{n}-{j}","journal":"Sincronía","issueNumber":n,
                "authors":[],"urls":{"canonical":f"http://example.org/{n}-{j}.htm"}
            } for j in range(quota+3))
        self.assertEqual(len(select_sample(rows)),sum(ISSUE_SAMPLE_QUOTAS.values()))


if __name__ == "__main__":
    unittest.main()

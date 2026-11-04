"""T2CB retrieval-only primary source capture tests."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "scripts" / "thesis" / "fetch_riudg_primary_source_v1.py"
spec = importlib.util.spec_from_file_location("fetcher", MODULE)
fetcher = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(fetcher)


class RiudgPrimarySourceFetchT2CBTest(unittest.TestCase):
    def test_handle_normalization(self):
        self.assertEqual(
            fetcher.normalize_handle_path(
                "https://hdl.handle.net/20.500.12104/84204"
            ),
            "20.500.12104/84204",
        )

    def test_viewer_pdf_param(self):
        url = (
            "https://www.riudg.udg.mx/visor/pdfjs/viewer.jsp?"
            "in=j&pdf=20.500.12104%2F84204%2F1%2FDCUAAD10072FT.pdf"
        )
        self.assertEqual(
            fetcher.viewer_pdf_param(url),
            "20.500.12104/84204/1/DCUAAD10072FT.pdf",
        )

    def test_candidates_include_dspace_variants(self):
        item = {
            "handle": "https://hdl.handle.net/20.500.12104/84204",
            "primarySourceUrl": (
                "https://www.riudg.udg.mx/visor/pdfjs/viewer.jsp?"
                "in=j&pdf=20.500.12104%2F84204%2F1%2FDCUAAD10072FT.pdf"
            ),
        }
        candidates = fetcher.common_candidates(item)
        self.assertIn(
            "https://www.riudg.udg.mx/bitstream/"
            "20.500.12104/84204/1/DCUAAD10072FT.pdf",
            candidates,
        )
        self.assertIn(
            "https://www.riudg.udg.mx/jspui/bitstream/"
            "20.500.12104/84204/1/DCUAAD10072FT.pdf",
            candidates,
        )

    def test_pdf_magic_is_mandatory(self):
        self.assertTrue(
            fetcher.is_pdf(
                b"%PDF-1.7\nfixture",
                {"content-type": "application/pdf"},
            )
        )
        self.assertFalse(
            fetcher.is_pdf(
                b"<html>viewer</html>",
                {"content-type": "text/html"},
            )
        )


if __name__ == "__main__":
    unittest.main()

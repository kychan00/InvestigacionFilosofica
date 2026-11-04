"""Tests for CUCSH thesis catalog reference-only recon."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "thesis" / "probe_cucsh_thesis_catalog_v1.py"
spec = importlib.util.spec_from_file_location("cucsh_catalog", SCRIPT)
catalog = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(catalog)


class CucshCatalogReconV1Test(unittest.TestCase):
    def test_parser_keeps_reference_pages_and_rejects_full_text(self):
        html = """
        <html><head><title>Catálogo de Tesis | Biblioteca CUCSH</title></head><body>
          <form action="/vista-tesis-licenciatura" method="get">
            <select name="field_programa_value" id="edit-programa">
              <option value="">Todos</option>
              <option value="FILOSOFIA">Licenciatura en Filosofía</option>
            </select>
          </form>
          <table>
            <tr><th>Título</th><th>Autor</th><th>Programa</th></tr>
            <tr><td>Ética y lenguaje</td><td>Ana Pérez</td><td>Filosofía</td></tr>
          </table>
          <a href="/?q=node%2F8243">Tesis de Filosofía</a>
          <a href="/files/tesis.pdf">PDF</a>
          <a href="https://evil.example/tesis">Externo</a>
        </body></html>
        """
        parsed = catalog.parse_catalog(
            html,
            base_url="https://www.biblioteca.cucsh.udg.mx/catalogo-de-tesis",
        )
        self.assertEqual(parsed["pageTitle"], "Catálogo de Tesis | Biblioteca CUCSH")
        self.assertEqual(len(parsed["safeLinks"]), 1)
        self.assertEqual(len(parsed["philosophySignalLinks"]), 1)
        self.assertEqual(len(parsed["philosophySelectOptions"]), 1)
        self.assertEqual(len(parsed["philosophyTableRows"]), 1)
        self.assertEqual(parsed["tableRowCount"], 2)
        self.assertEqual(parsed["rejectedAnchorLinks"], 2)
        self.assertTrue(all(".pdf" not in row["url"] for row in parsed["safeLinks"]))

    def test_safe_url_is_host_bounded_and_fragment_free(self):
        base = "https://www.biblioteca.cucsh.udg.mx/catalogo-de-tesis"
        self.assertEqual(
            catalog.safe_catalog_url("/?q=node%2F8243#top", base_url=base),
            "https://www.biblioteca.cucsh.udg.mx/?q=node%2F8243",
        )
        self.assertIsNone(catalog.safe_catalog_url("https://evil.example/x", base_url=base))
        self.assertIsNone(catalog.safe_catalog_url("/bitstream/123", base_url=base))
        self.assertIsNone(catalog.safe_catalog_url("/download?id=1", base_url=base))


if __name__ == "__main__":
    unittest.main()

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
          <form action="/vista-tesis-maestria" method="get">
            <select name="field_maestria_value" id="edit-maestria">
              <option value="">Todos</option>
              <option value="Maestría en Estudios Filosóficos">Maestría en Estudios Filosóficos</option>
              <option value="Maestría En Filosofía">Maestría En Filosofía</option>
            </select>
          </form>
          <table>
            <tr><th>Título</th><th>Autor</th><th>Coautor</th><th>Director</th><th>Año</th><th>Maestria</th></tr>
            <tr><td>Ética y lenguaje</td><td>Ana Pérez</td><td></td><td>Director A</td><td>2020</td><td>Maestría en Estudios Filosóficos</td></tr>
          </table>
          <a href="/?q=content/etica-y-lenguaje">Ética y lenguaje</a>
          <a href="/files/tesis.pdf">PDF</a>
          <a href="https://evil.example/tesis">Externo</a>
        </body></html>
        """
        parsed = catalog.parse_full_page(
            html,
            base_url="https://www.biblioteca.cucsh.udg.mx/vista-tesis-maestria",
        )
        self.assertEqual(parsed["pageTitle"], "Catálogo de Tesis | Biblioteca CUCSH")
        self.assertEqual(len(parsed["philosophySelectOptions"]), 2)
        self.assertEqual(parsed["rejectedAnchorLinks"], 2)
        rows = catalog.table_records(
            parsed,
            expected_program="Maestría en Estudios Filosóficos",
            page_url="https://www.biblioteca.cucsh.udg.mx/?q=vista-tesis-maestria",
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["recordUrl"], "https://www.biblioteca.cucsh.udg.mx/?q=content/etica-y-lenguaje")

    def test_accent_insensitive_philosophy_target_detection(self):
        views = [{
            "degree": "maestria",
            "finalUrl": "http://www.biblioteca.cucsh.udg.mx/vista-tesis-maestria",
            "selects": [{
                "name": "field_maestria_value",
                "id": "edit-field-maestria-value",
                "options": [
                    {"value": "All", "text": "- Any -"},
                    {"value": "Maestría en Estudios Filosóficos", "text": "Maestría en Estudios Filosóficos"},
                    {"value": "Maestría En Filosofía", "text": "Maestría En Filosofía"},
                ],
            }],
        }]
        targets = catalog.philosophy_targets(views)
        self.assertEqual(len(targets), 2)
        self.assertEqual(
            {row["program"] for row in targets},
            {"Maestría en Estudios Filosóficos", "Maestría En Filosofía"},
        )

    def test_filtered_url_preserves_program_value(self):
        target = {
            "degree": "licenciatura",
            "viewFinalUrl": "http://www.biblioteca.cucsh.udg.mx/vista-tesis-licenciatura",
            "selectName": "field_licenciatura_value",
            "selectId": "x",
            "program": "Licenciatura en Filosofía",
            "value": "Licenciatura en Filosofía",
        }
        url = catalog.filtered_page_url(target, 3)
        self.assertIn("field_licenciatura_value=Licenciatura+en+Filosof%C3%ADa", url)
        self.assertIn("page=3", url)

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

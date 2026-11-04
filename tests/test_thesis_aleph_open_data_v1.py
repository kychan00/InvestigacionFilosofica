"""Tests for ALEPH open-data XLSX recon."""
from __future__ import annotations
import importlib.util, io, tempfile, unittest, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/thesis/probe_aleph_open_data_v1.py"
spec=importlib.util.spec_from_file_location("aleph_open", SCRIPT)
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)


def fixture_xlsx() -> bytes:
    out=io.BytesIO()
    with zipfile.ZipFile(out,"w") as z:
        z.writestr("xl/workbook.xml", """<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Titulos" sheetId="1" r:id="rId1"/></sheets></workbook>""")
        z.writestr("xl/_rels/workbook.xml.rels", """<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>""")
        z.writestr("xl/sharedStrings.xml", """<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Titulo</t></si><si><t>Programa</t></si><si><t>Ética y lenguaje</t></si><si><t>Licenciatura en Filosofía</t></si><si><t>Otra obra</t></si><si><t>Historia</t></si></sst>""")
        z.writestr("xl/worksheets/sheet1.xml", """<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row><row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3" t="s"><v>5</v></c></row></sheetData></worksheet>""")
    return out.getvalue()


class TestAlephOpenData(unittest.TestCase):
    def test_fixture(self):
        report=mod.build_report(fixture_xlsx())
        self.assertEqual(report["metrics"]["sheets"],1)
        self.assertEqual(report["metrics"]["rows"],3)
        self.assertEqual(report["metrics"]["philosophyRows"],1)
        self.assertEqual(report["sheets"][0]["headers"],["Titulo","Programa"])
        self.assertFalse(report["rawWorkbookPersisted"])

    def test_accent_normalization(self):
        self.assertIn("filosofia",mod.normalize("Filosofía"))
        self.assertTrue(mod.classify_row(["Maestría en Estudios Filosóficos"])["philosophy"])
        self.assertTrue(mod.classify_row(["Doctorado en Humanidades"])["doctorate"])


if __name__=="__main__":
    unittest.main()

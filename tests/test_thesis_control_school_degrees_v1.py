"""Focused tests for Control Escolar degree-statistics recon."""
from __future__ import annotations
import importlib.util, io, unittest, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/thesis/probe_control_school_degrees_v1.py"
spec=importlib.util.spec_from_file_location("control_degrees",SCRIPT)
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)


def fixture() -> bytes:
    out=io.BytesIO()
    with zipfile.ZipFile(out,"w") as z:
        z.writestr("xl/workbook.xml", """<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Datos" sheetId="1" r:id="rId1"/></sheets></workbook>""")
        z.writestr("xl/_rels/workbook.xml.rels", """<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>""")
        z.writestr("xl/sharedStrings.xml", """<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Centro</t></si><si><t>Programa</t></si><si><t>CUCSH</t></si><si><t>Maestría en Estudios Filosóficos</t></si><si><t>Doctora en Humanidades</t></si></sst>""")
        z.writestr("xl/worksheets/sheet1.xml", """<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row><row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3" t="s"><v>4</v></c></row></sheetData></worksheet>""")
    return out.getvalue()


class TestControlDegrees(unittest.TestCase):
    def test_fixture(self):
        report=mod.inspect_workbook("2025",fixture())
        self.assertEqual(report["metrics"]["philosophyMastersRows"],1)
        self.assertEqual(report["metrics"]["humanitiesDoctorateRows"],1)
        self.assertGreaterEqual(report["metrics"]["cucshRows"],2)

    def test_normalization(self):
        self.assertIn("philosophy",mod.signals(["Licenciatura en Filosofía"]))
        self.assertIn("philosophy-masters",mod.signals(["Maestría en Estudios Filosóficos"]))
        self.assertIn("humanities-doctorate",mod.signals(["Doctor en Humanidades"]))
        self.assertIn("humanities-doctorate",mod.signals(["Doctora en Humanidades"]))


if __name__=="__main__":
    unittest.main()

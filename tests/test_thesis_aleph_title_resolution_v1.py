"""Tests for deterministic Aleph title resolution probe."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/thesis/probe_aleph_title_resolution_v1.py"
spec=importlib.util.spec_from_file_location("title_resolution",SCRIPT)
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)


class TitleResolutionTest(unittest.TestCase):
    def test_search_contract(self):
        action="http://148.202.248.73:80/F/SESSION"
        url=mod.search_url(
            action,
            find_code="WTI",
            request="Ética y lenguaje",
            local_base="UDG01",
            adjacent="Y",
        )
        import urllib.parse
        params=urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        self.assertEqual(params["func"],["find-b"])
        self.assertEqual(params["find_code"],["WTI"])
        self.assertEqual(params["request"],["Ética y lenguaje"])
        self.assertEqual(params["local_base"],["UDG01"])
        self.assertEqual(params["adjacent"],["Y"])
        self.assertEqual(params["filter_request_4"],["TESIS"])

    def test_system_number_extraction(self):
        page={
            "relevantRows":[["Número de sistema","000551988"]],
            "snippets":["registro 000551988"],
            "relevantLinks":[
                {"url":"http://148.202.248.73/F/S?func=item-global&doc_number=000551988"}
            ],
        }
        self.assertEqual(mod.system_numbers_from_page(page),["000551988"])

    def test_record_fields(self):
        page={"relevantRows":[
            ["Autor","Sánchez Salas, Raúl, sustentante"],
            ["Título","El performance como una herramienta para la reflexión filosófica / tesis"],
            ["Biblioteca","B.C. CU del Norte"],
        ]}
        fields=mod.record_fields(page)
        self.assertEqual(fields["autor"],"Sánchez Salas, Raúl, sustentante")
        self.assertEqual(fields["biblioteca"],"B.C. CU del Norte")


if __name__=="__main__":
    unittest.main()

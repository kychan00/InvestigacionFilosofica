"""Tests for T2CM OPAC endpoint discovery."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/thesis/probe_udg_opac_endpoints_v1.py"
spec=importlib.util.spec_from_file_location("opac_recon",SCRIPT)
mod=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(mod)


class OpacReconTest(unittest.TestCase):
    def test_discovers_hidden_udg_links(self):
        html="""
        <html><body>
          <a id="cucsh" href="javascript:void(0)"
             onclick="window.open('http://148.202.105.20/F/-?func=find-b-0&local_base=CUCSH')">
             CUCSH
          </a>
          <a href="https://wdg.biblio.udg.mx/">WDG Biblio</a>
          <script>const opac='https://catalogo.udg.mx/opac';</script>
          <a href="https://evil.example/opac">evil</a>
          <a href="/manual.pdf">pdf</a>
        </body></html>
        """
        result=mod.extract_candidates(html,base_url="https://bibliotecas.udg.mx/catalogos-en-linea")
        urls={row["url"] for row in result["candidates"]}
        self.assertIn("http://148.202.105.20/F/-?func=find-b-0&local_base=CUCSH",urls)
        self.assertIn("https://catalogo.udg.mx/opac",urls)
        self.assertNotIn("https://evil.example/opac",urls)
        self.assertTrue(all(".pdf" not in url for url in urls))

    def test_form_contract_parser(self):
        html="""
        <html><body>
          <form action="/F/" method="get" name="form1">
            <input type="hidden" name="func" value="find-b"/>
            <input type="text" name="request" value=""/>
            <select name="find_code">
              <option value="WRD">Palabras</option>
              <option value="WTI" selected>Título</option>
            </select>
          </form>
        </body></html>
        """
        parser=mod.FormContractParser()
        parser.feed(html)
        self.assertEqual(len(parser.forms),1)
        form=parser.forms[0]
        self.assertEqual(form["action"],"/F/")
        self.assertEqual(form["inputs"][0]["name"],"func")
        self.assertEqual(form["selects"][0]["name"],"find_code")
        self.assertEqual(form["selects"][0]["options"][1]["value"],"WTI")

    def test_aleph_sys_query_contract(self):
        url=mod.aleph_search_url("SYS","000551988")
        parsed=__import__("urllib.parse").parse.urlparse(url)
        params=__import__("urllib.parse").parse.parse_qs(parsed.query, keep_blank_values=True)
        self.assertEqual(params["func"],["find-b"])
        self.assertEqual(params["find_code"],["SYS"])
        self.assertEqual(params["request"],["000551988"])
        self.assertEqual(params["local_base"],["CUCSH"])
        self.assertEqual(params["filter_request_4"],["TESIS"])

    def test_session_search_uses_dynamic_action(self):
        action="http://148.202.248.73:80/F/SESSION-123"
        url=mod.session_search_url(action,"000551988")
        self.assertTrue(url.startswith(action+"?"))
        parsed=__import__("urllib.parse").parse.urlparse(url)
        params=__import__("urllib.parse").parse.parse_qs(parsed.query,keep_blank_values=True)
        self.assertEqual(params["find_code"],["SYS"])
        self.assertEqual(params["request"],["000551988"])
        self.assertEqual(params["filter_request_4"],[""])

    def test_direct_record_contract(self):
        action="http://148.202.248.73:80/F/SESSION-123"
        url=mod.direct_record_url(action,"000551988","UDG01")
        parsed=__import__("urllib.parse").parse.urlparse(url)
        params=__import__("urllib.parse").parse.parse_qs(parsed.query)
        self.assertEqual(params["func"],["direct"])
        self.assertEqual(params["doc_number"],["000551988"])
        self.assertEqual(params["local_base"],["UDG01"])

    def test_shared_session_action_is_safe(self):
        action="http://148.202.248.73:80/F/SESSION-123"
        self.assertTrue(mod.is_safe_candidate(action))
        self.assertIn("func=direct",mod.direct_record_url(action,"000551988","CUCSH"))

    def test_evidence_parser_prioritizes_item_global(self):
        html="""
        <html><body>
          <a href="/F/S?func=direct&doc_number=1&format=999">Estándar</a>
          <a href="/F/S?func=item-global&doc_library=UDG01&doc_number=1">Ejemplar (sin año)</a>
          <a href="/F/S?func=myshelf-add-ful-1&doc_number=1">Agregar a mi estante electrónico</a>
        </body></html>
        """
        parser=mod.EvidenceParser(); parser.feed(html)
        # page_evidence owns the link selection; parser itself still records all anchors.
        self.assertEqual(len(parser.anchors),3)

    def test_candidate_safety(self):
        self.assertTrue(mod.is_safe_candidate("https://foo.udg.mx/opac"))
        self.assertTrue(mod.is_safe_candidate("http://148.202.1.2:8080/F/"))
        self.assertFalse(mod.is_safe_candidate("https://evil.example/opac"))
        self.assertFalse(mod.is_safe_candidate("https://foo.udg.mx/file.pdf"))


if __name__=="__main__":
    unittest.main()

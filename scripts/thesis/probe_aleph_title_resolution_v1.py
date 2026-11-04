#!/usr/bin/env python3
"""Probe deterministic Aleph title resolution before bulk holdings reconciliation."""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import urllib.parse
import urllib.request
import http.cookiejar
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
T2CM_PATH = ROOT / "scripts" / "thesis" / "probe_udg_opac_endpoints_v1.py"

spec = importlib.util.spec_from_file_location("t2cm_opac", T2CM_PATH)
opac = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(opac)

SCHEMA = "thesis-aleph-title-resolution-probe-v1"
REVISION = "2026-11-04.t2cn-v1"

KNOWN = (
    {
        "name": "Raúl Sánchez Salas",
        "title": "El performance como una herramienta para la reflexión filosófica",
        "systemNumber": "000551988",
    },
    {
        "name": "José Antonio Ramírez Velasco",
        "title": "Referencias epistemológicas en torno al problema del concepto de verdad necesaria",
        "systemNumber": "000479311",
    },
    {
        "name": "Víctor Manuel Espinosa Aguilar",
        "title": "El impacto de la migración laboral a Estados Unidos en San Diego Alejandría, Jalisco",
        "systemNumber": "000168319",
    },
)

DISCOVERY = (
    {
        "name": "Guillermo Vargas Curiel",
        "title": "ANÁLISIS DESCRIPTIVO SOBRE MODIFICACIÓN CURRICULAR A LA LICENCIATURA EN FILOSOFÍA DE LA UNIVERSIDAD DE GUADALAJARA EN 1996 DESDE LA PERSPECTIVA DEL PENSAMIENTO COMPLEJO",
    },
)


def search_url(
    session_action: str,
    *,
    find_code: str,
    request: str,
    local_base: str = "UDG01",
    adjacent: str = "N",
) -> str:
    params = [
        ("func", "find-b"),
        ("request", request),
        ("find_code", find_code),
        ("adjacent", adjacent),
        ("local_base", local_base),
        ("filter_code_1", "WLN"),
        ("filter_request_1", ""),
        ("filter_code_2", "WYR"),
        ("filter_request_2", ""),
        ("filter_code_3", "WYR"),
        ("filter_request_3", ""),
        ("filter_code_4", "WFM"),
        ("filter_request_4", "TESIS"),
    ]
    sep = "&" if "?" in session_action else "?"
    return session_action + sep + urllib.parse.urlencode(params)


def open_session() -> tuple[urllib.request.OpenerDirector, str, dict[str, Any]]:
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    html, final, ctype, status = opac.fetch_with_opener(opener, opac.CUCSH_OPAC, timeout=40)
    parser = opac.FormContractParser()
    parser.feed(html)
    actions = [
        urllib.parse.urljoin(final, form.get("action") or "")
        for form in parser.forms
        if form.get("action")
    ]
    actions = [value for value in actions if opac.is_safe_candidate(value)]
    if not actions:
        raise ValueError("Aleph session did not expose a safe form action")
    return opener, actions[0], {
        "finalUrl": final,
        "httpStatus": status,
        "contentType": ctype,
        "formCount": len(parser.forms),
        "sessionAction": actions[0],
    }


def system_numbers_from_page(page: dict[str, Any]) -> list[str]:
    found: list[str] = []

    def add(value: str | None) -> None:
        if not value:
            return
        for match in re.findall(r"(?<!\d)(\d{9})(?!\d)", value):
            if match not in found:
                found.append(match)

    for row in page.get("relevantRows") or []:
        for cell in row:
            add(str(cell))
    for snippet in page.get("snippets") or []:
        add(snippet)
    for link in page.get("relevantLinks") or []:
        parsed = urllib.parse.urlparse(link.get("url") or "")
        query = urllib.parse.parse_qs(parsed.query)
        for key in ("doc_number", "doc_num"):
            for value in query.get(key) or []:
                add(value)
    return found


def record_fields(page: dict[str, Any]) -> dict[str, str]:
    fields: dict[str, str] = {}
    for row in page.get("relevantRows") or []:
        if len(row) < 2:
            continue
        key = opac.one_line(row[0]).casefold()
        value = opac.one_line(row[1])
        if key in {
            "número de sistema",
            "numero de sistema",
            "autor",
            "título",
            "titulo",
            "nota de tesis",
            "biblioteca",
            "base lógica",
            "base logica",
        }:
            fields[key] = value
    return fields


def follow_search(
    opener: urllib.request.OpenerDirector,
    search: dict[str, Any],
    *,
    max_pages: int = 8,
) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    seen = {search.get("finalUrl")}
    queue = [row.get("url") for row in search.get("relevantLinks") or [] if row.get("url")]
    while queue and len(pages) < max_pages:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            page = opac.page_evidence(url, opener=opener)
        except Exception as exc:
            pages.append({"requestedUrl": url, "error": str(exc)})
            continue
        page["recordFields"] = record_fields(page)
        page["systemNumbers"] = system_numbers_from_page(page)
        pages.append(page)
        for row in page.get("relevantLinks") or []:
            candidate = row.get("url")
            if candidate and candidate not in seen and candidate not in queue:
                queue.append(candidate)
    return pages


def run_query(
    opener: urllib.request.OpenerDirector,
    action: str,
    *,
    title: str,
    adjacent: str,
) -> dict[str, Any]:
    url = search_url(
        action,
        find_code="WTI",
        request=title,
        local_base="UDG01",
        adjacent=adjacent,
    )
    page = opac.page_evidence(url, opener=opener)
    page["recordFields"] = record_fields(page)
    page["systemNumbers"] = system_numbers_from_page(page)
    followed = follow_search(opener, page)

    numbers: list[str] = []
    for current in [page, *followed]:
        for number in current.get("systemNumbers") or []:
            if number not in numbers:
                numbers.append(number)

    holdings = []
    for current in followed:
        if current.get("error"):
            continue
        for holding in opac.extract_holdings(current):
            if holding not in holdings:
                holdings.append(holding)

    return {
        "adjacent": adjacent,
        "searchUrl": url,
        "search": page,
        "followedPages": followed,
        "systemNumbers": numbers,
        "holdings": holdings,
    }


def resolve_case(case: dict[str, str]) -> dict[str, Any]:
    opener, action, session = open_session()
    attempts = [
        run_query(opener, action, title=case["title"], adjacent="N"),
        run_query(opener, action, title=case["title"], adjacent="Y"),
    ]
    return {
        **case,
        "session": session,
        "attempts": attempts,
    }


def build_report() -> dict[str, Any]:
    known = [resolve_case(case) for case in KNOWN]
    discovery = [resolve_case(case) for case in DISCOVERY]
    return {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "rawHtmlPersisted": False,
        "known": known,
        "discovery": discovery,
        "metrics": {
            "knownCases": len(known),
            "knownResolved": sum(
                any(case["systemNumber"] in attempt["systemNumbers"] for attempt in case["attempts"])
                for case in known
            ),
            "discoveryCases": len(discovery),
            "discoveryWithSystemNumber": sum(
                any(attempt["systemNumbers"] for attempt in case["attempts"])
                for case in discovery
            ),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = build_report()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report["metrics"], ensure_ascii=False, indent=2, sort_keys=True))
    for case in report["known"] + report["discovery"]:
        print(json.dumps({
            "name": case["name"],
            "expected": case.get("systemNumber"),
            "attempts": [
                {
                    "adjacent": attempt["adjacent"],
                    "pageTitle": attempt["search"].get("pageTitle"),
                    "systems": attempt["systemNumbers"],
                    "holdings": len(attempt["holdings"]),
                }
                for attempt in case["attempts"]
            ],
        }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Discover the live UdeG OPAC endpoints from official SiUBi/WDG pages.

T2CM phase 1 is discovery-only. It does not query thesis holdings yet.
"""
from __future__ import annotations

import argparse
import html as html_lib
import json
import re
import urllib.parse
import urllib.request
import http.cookiejar
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

SCHEMA = "thesis-opac-endpoint-recon-v1"
REVISION = "2026-11-04.t2cm-v8"
SAMPLE_SYSTEM_NUMBERS = (
    ("Raúl Sánchez Salas", "000551988"),
    ("José Antonio Ramírez Velasco", "000479311"),
    ("Víctor Manuel Espinosa Aguilar", "000168319"),
)
CUCSH_OPAC = "http://148.202.248.73/F/?func=find-b-0&local_base=CUCSH"

SEEDS = (
    "https://bibliotecas.udg.mx/catalogos-en-linea",
    "https://wdg.biblio.udg.mx/",
)

FORBIDDEN = (".pdf", "/bitstream", "/download")
KEYWORDS = (
    "opac",
    "aleph",
    "catalog",
    "cucsh",
    "biblioteca",
    "colectivo",
    "148.202.",
)

URL_RE = re.compile(r"""https?://[^\s"'<>\\)]+""", re.I)


def one_line(value: str | None) -> str:
    return " ".join(str(value or "").split())


def is_safe_candidate(url: str) -> bool:
    lower = urllib.parse.unquote(url).casefold()
    if any(token in lower for token in FORBIDDEN):
        return False
    try:
        parsed = urllib.parse.urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    if parsed.username or parsed.password:
        return False
    if parsed.port not in (None, 80, 443, 8080):
        return False
    host = (parsed.hostname or "").casefold()
    if host.endswith(".udg.mx") or host in {"udg.mx", "www.udg.mx"}:
        return True
    if host.startswith("148.202."):
        return True
    return False


class EvidenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.current_anchor: dict[str, str] | None = None
        self.anchors: list[dict[str, str]] = []
        self.in_row = False
        self.in_cell = False
        self.current_row: list[str] = []
        self.current_cell: list[str] = []
        self.rows: list[list[str]] = []
        self.text_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {str(k).casefold(): (v or "") for k, v in attrs}
        name = tag.casefold()
        if name == "a":
            self.current_anchor = {"href": values.get("href", ""), "text": ""}
        elif name == "tr":
            self.in_row = True
            self.current_row = []
        elif name in {"td", "th"} and self.in_row:
            self.in_cell = True
            self.current_cell = []

    def handle_endtag(self, tag: str) -> None:
        name = tag.casefold()
        if name == "a" and self.current_anchor is not None:
            self.current_anchor["text"] = one_line(self.current_anchor["text"])
            self.anchors.append(self.current_anchor)
            self.current_anchor = None
        elif name in {"td", "th"} and self.in_cell:
            self.current_row.append(one_line(" ".join(self.current_cell)))
            self.current_cell = []
            self.in_cell = False
        elif name == "tr" and self.in_row:
            if any(self.current_row):
                self.rows.append(self.current_row)
            self.current_row = []
            self.in_row = False

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.text_parts.append(data.strip())
            if self.current_anchor is not None:
                self.current_anchor["text"] += " " + data.strip()
            if self.in_cell:
                self.current_cell.append(data.strip())


class FormContractParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.forms: list[dict[str, Any]] = []
        self.current_form: dict[str, Any] | None = None
        self.current_select: dict[str, Any] | None = None
        self.current_option: dict[str, str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {str(k).casefold(): (v or "") for k, v in attrs}
        name = tag.casefold()
        if name == "form":
            self.current_form = {
                "action": values.get("action", ""),
                "method": values.get("method", "get").casefold(),
                "name": values.get("name", ""),
                "id": values.get("id", ""),
                "inputs": [],
                "selects": [],
            }
        elif name == "input" and self.current_form is not None:
            self.current_form["inputs"].append({
                "name": values.get("name", ""),
                "type": values.get("type", "text").casefold(),
                "value": values.get("value", ""),
            })
        elif name == "select" and self.current_form is not None:
            self.current_select = {
                "name": values.get("name", ""),
                "id": values.get("id", ""),
                "options": [],
            }
        elif name == "option" and self.current_select is not None:
            self.current_option = {
                "value": values.get("value", ""),
                "text": "",
                "selected": "selected" in values,
            }

    def handle_endtag(self, tag: str) -> None:
        name = tag.casefold()
        if name == "option" and self.current_option is not None and self.current_select is not None:
            self.current_option["text"] = one_line(self.current_option["text"])
            self.current_select["options"].append(self.current_option)
            self.current_option = None
        elif name == "select" and self.current_select is not None and self.current_form is not None:
            self.current_form["selects"].append(self.current_select)
            self.current_select = None
        elif name == "form" and self.current_form is not None:
            self.forms.append(self.current_form)
            self.current_form = None
            self.current_select = None
            self.current_option = None

    def handle_data(self, data: str) -> None:
        if self.current_option is not None and data.strip():
            self.current_option["text"] += " " + data.strip()


class DiscoveryParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.current_anchor: dict[str, Any] | None = None
        self.anchors: list[dict[str, Any]] = []
        self.attr_values: list[dict[str, str]] = []
        self.script_parts: list[str] = []
        self.in_script = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {str(k).casefold(): (v or "") for k, v in attrs}
        if tag.casefold() == "a":
            self.current_anchor = {
                "text": "",
                "href": values.get("href", ""),
                "onclick": values.get("onclick", ""),
                "class": values.get("class", ""),
                "id": values.get("id", ""),
            }
        if tag.casefold() == "script":
            self.in_script = True
        for key, value in values.items():
            if value:
                self.attr_values.append({
                    "tag": tag.casefold(),
                    "attribute": key,
                    "value": value,
                })

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() == "a" and self.current_anchor is not None:
            self.current_anchor["text"] = one_line(self.current_anchor["text"])
            self.anchors.append(self.current_anchor)
            self.current_anchor = None
        if tag.casefold() == "script":
            self.in_script = False

    def handle_data(self, data: str) -> None:
        if self.current_anchor is not None and data.strip():
            self.current_anchor["text"] += " " + data.strip()
        if self.in_script and data.strip():
            self.script_parts.append(data)


def request_object(url: str) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={
            "User-Agent": "InvestigacionFilosofica-T2CM/1.0 (+OPAC endpoint discovery)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )


def fetch_with_opener(
    opener: urllib.request.OpenerDirector,
    url: str,
    timeout: int = 60,
) -> tuple[str, str, str, int]:
    with opener.open(request_object(url), timeout=timeout) as response:
        raw = response.read()
        final = response.geturl()
        ctype = response.headers.get("Content-Type", "")
        status = int(getattr(response, "status", 200))
    if "text/html" not in ctype.casefold() and "application/xhtml+xml" not in ctype.casefold():
        raise ValueError(f"Unexpected content type for {url}: {ctype}")
    return raw.decode("utf-8", errors="replace"), final, ctype, status


def fetch(url: str, timeout: int = 60) -> tuple[str, str, str, int]:
    opener = urllib.request.build_opener()
    return fetch_with_opener(opener, url, timeout=timeout)


def extract_candidates(html: str, *, base_url: str) -> dict[str, Any]:
    parser = DiscoveryParser()
    parser.feed(html)

    candidates: dict[str, dict[str, Any]] = {}

    def add(raw: str | None, *, source: str, context: str = "") -> None:
        if not raw:
            return
        raw = html_lib.unescape(raw).strip()
        found = URL_RE.findall(raw)
        if not found and raw.startswith(("/", "./", "../")):
            found = [urllib.parse.urljoin(base_url, raw)]
        for item in found:
            url = item.rstrip(".,;")
            if not is_safe_candidate(url):
                continue
            key = url
            entry = candidates.setdefault(key, {
                "url": url,
                "sources": [],
                "contexts": [],
            })
            if source not in entry["sources"]:
                entry["sources"].append(source)
            clean_context = one_line(context)[:500]
            if clean_context and clean_context not in entry["contexts"]:
                entry["contexts"].append(clean_context)

    for anchor in parser.anchors:
        context = " | ".join(filter(None, [
            anchor.get("text"),
            anchor.get("id"),
            anchor.get("class"),
        ]))
        add(anchor.get("href"), source="anchor-href", context=context)
        add(anchor.get("onclick"), source="anchor-onclick", context=context)

    for row in parser.attr_values:
        add(
            row["value"],
            source=f"attribute:{row['tag']}:{row['attribute']}",
            context=row["value"],
        )

    script_text = "\n".join(parser.script_parts)
    add(script_text, source="inline-script", context="inline script")

    full_text = one_line(re.sub(r"<[^>]+>", " ", html))
    keyword_hits = {
        word: full_text.casefold().count(word.casefold())
        for word in KEYWORDS
    }

    filtered = []
    for entry in candidates.values():
        haystack = one_line(" ".join([
            entry["url"],
            *entry["sources"],
            *entry["contexts"],
        ])).casefold()
        entry["keywordMatches"] = [
            word for word in KEYWORDS if word.casefold() in haystack
        ]
        if entry["keywordMatches"]:
            filtered.append(entry)

    filtered.sort(key=lambda row: (
        0 if "cucsh" in row["keywordMatches"] else 1,
        0 if "opac" in row["keywordMatches"] else 1,
        0 if "aleph" in row["keywordMatches"] else 1,
        row["url"],
    ))
    return {
        "anchors": parser.anchors[:250],
        "keywordHits": keyword_hits,
        "candidates": filtered,
    }


def probe_candidate(url: str) -> dict[str, Any]:
    try:
        html, final, ctype, status = fetch(url, timeout=25)
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        title = one_line(re.sub(r"<[^>]+>", " ", title_match.group(1))) if title_match else ""
        text = one_line(re.sub(r"<[^>]+>", " ", html))
        return {
            "url": url,
            "ok": True,
            "finalUrl": final,
            "httpStatus": status,
            "contentType": ctype,
            "pageTitle": title,
            "signals": [word for word in KEYWORDS if word.casefold() in text.casefold()],
            "htmlBytes": len(html.encode("utf-8")),
        }
    except Exception as exc:
        return {
            "url": url,
            "ok": False,
            "error": str(exc),
        }


def aleph_search_url(find_code: str, request: str, *, local_base: str = "CUCSH") -> str:
    params = [
        ("func", "find-b"),
        ("request", request),
        ("find_code", find_code),
        ("adjacent", "N"),
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
    return "http://148.202.248.73/F/?" + urllib.parse.urlencode(params)


def page_evidence(
    url: str,
    *,
    opener: urllib.request.OpenerDirector | None = None,
) -> dict[str, Any]:
    if opener is None:
        html, final, ctype, status = fetch(url, timeout=40)
    else:
        html, final, ctype, status = fetch_with_opener(opener, url, timeout=40)
    parser = EvidenceParser()
    parser.feed(html)
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title = one_line(re.sub(r"<[^>]+>", " ", title_match.group(1))) if title_match else ""
    relevant_terms = (
        "número de sistema", "numero de sistema", "biblioteca", "ubicación", "ubicacion",
        "signatura", "colección", "coleccion", "ejemplar", "disponib", "items", "ítems",
        "autor", "título", "titulo", "resultado", "registro", "documento",
    )
    text = one_line(" ".join(parser.text_parts))
    snippets = []
    lower = text.casefold()
    for term in relevant_terms:
        start = lower.find(term.casefold())
        if start >= 0:
            snippet = text[max(0, start - 100): start + 350]
            snippet = one_line(snippet)
            if snippet and snippet not in snippets:
                snippets.append(snippet)
    links = []
    for anchor in parser.anchors:
        href = urllib.parse.urljoin(final, anchor.get("href") or "")
        if not is_safe_candidate(href):
            continue
        parsed_href = urllib.parse.urlparse(href)
        query = urllib.parse.parse_qs(parsed_href.query)
        func = (query.get("func") or [""])[0]
        anchor_text = (anchor.get("text") or "").casefold()
        if (
            func in {"item-global", "direct", "full-set-set"}
            or "ejemplar" in anchor_text
            or "biblioteca" in anchor_text
        ):
            row = {"text": anchor.get("text") or "", "url": href, "func": func}
            if row not in links:
                links.append(row)
    links.sort(key=lambda row: (
        0 if row.get("func") == "item-global" else 1,
        0 if "ejemplar" in row.get("text","").casefold() else 1,
        row.get("text",""),
        row["url"],
    ))
    rows = [
        row for row in parser.rows
        if any(term.casefold() in one_line(" | ".join(row)).casefold() for term in relevant_terms)
    ]
    return {
        "requestedUrl": url,
        "finalUrl": final,
        "httpStatus": status,
        "contentType": ctype,
        "pageTitle": title,
        "htmlBytes": len(html.encode("utf-8")),
        "snippets": snippets[:20],
        "relevantLinks": links[:30],
        "relevantRows": rows[:50],
    }


def session_search_url(
    form_action: str,
    system_number: str,
) -> str:
    params = [
        ("func", "find-b"),
        ("request", system_number),
        ("find_code", "SYS"),
        ("adjacent", "N"),
        ("local_base", "CUCSH"),
        ("filter_code_1", "WLN"),
        ("filter_request_1", ""),
        ("filter_code_2", "WYR"),
        ("filter_request_2", ""),
        ("filter_code_3", "WYR"),
        ("filter_request_3", ""),
        ("filter_code_4", "WFM"),
        # Exact SYS identity is already unique. Do not require the historical
        # format classifier to be populated correctly.
        ("filter_request_4", ""),
    ]
    separator = "&" if "?" in form_action else "?"
    return form_action + separator + urllib.parse.urlencode(params)


def direct_record_url(action: str, system_number: str, local_base: str) -> str:
    params = urllib.parse.urlencode({
        "func": "direct",
        "doc_number": system_number,
        "local_base": local_base,
    })
    separator = "&" if "?" in action else "?"
    return action + separator + params


def follow_relevant_pages(
    start: dict[str, Any],
    opener: urllib.request.OpenerDirector,
    *,
    max_pages: int = 5,
) -> list[dict[str, Any]]:
    followed = []
    seen = {start["finalUrl"]}
    queue = [row["url"] for row in start.get("relevantLinks") or []]
    while queue and len(followed) < max_pages:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            evidence = page_evidence(url, opener=opener)
        except Exception as exc:
            followed.append({"requestedUrl": url, "error": str(exc)})
            continue
        followed.append(evidence)
        for row in evidence.get("relevantLinks") or []:
            candidate = row["url"]
            if candidate not in seen and candidate not in queue:
                queue.append(candidate)
    return followed


def sample_system_lookup(
    name: str,
    system_number: str,
    *,
    session_action: str,
) -> dict[str, Any]:
    if not is_safe_candidate(session_action):
        raise ValueError("Aleph session form action left the UdeG allowlist")
    opener = urllib.request.build_opener()

    direct_attempts = []
    for local_base in ("CUCSH", "UDG01"):
        url = direct_record_url(session_action, system_number, local_base)
        try:
            evidence = page_evidence(url, opener=opener)
            followed = follow_relevant_pages(evidence, opener)
            direct_attempts.append({
                "localBase": local_base,
                "url": url,
                "record": evidence,
                "followedPages": followed,
            })
        except Exception as exc:
            direct_attempts.append({
                "localBase": local_base,
                "url": url,
                "error": str(exc),
                "followedPages": [],
            })

    return {
        "name": name,
        "systemNumber": system_number,
        "sessionAction": session_action,
        "directAttempts": direct_attempts,
    }


def inspect_cucsh_opac_contract() -> dict[str, Any]:
    html, final, ctype, status = fetch(CUCSH_OPAC, timeout=40)
    parser = FormContractParser()
    parser.feed(html)
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title = one_line(re.sub(r"<[^>]+>", " ", title_match.group(1))) if title_match else ""
    forms = []
    for form in parser.forms:
        action = urllib.parse.urljoin(final, form.get("action") or "")
        safe_action = action if is_safe_candidate(action) else None
        forms.append({
            **form,
            "resolvedAction": safe_action,
        })
    names = sorted({
        row.get("name")
        for form in forms
        for row in (form.get("inputs") or []) + (form.get("selects") or [])
        if row.get("name")
    })
    values = sorted({
        str(row.get("value") or "")
        for form in forms
        for row in (form.get("inputs") or [])
        if row.get("value")
    })
    return {
        "endpoint": CUCSH_OPAC,
        "finalUrl": final,
        "httpStatus": status,
        "contentType": ctype,
        "pageTitle": title,
        "htmlBytes": len(html.encode("utf-8")),
        "forms": forms,
        "fieldNames": names,
        "inputValues": values,
    }


def build_report() -> dict[str, Any]:
    pages = []
    candidate_map: dict[str, dict[str, Any]] = {}
    for seed in SEEDS:
        html, final, ctype, status = fetch(seed)
        extracted = extract_candidates(html, base_url=final)
        pages.append({
            "seed": seed,
            "finalUrl": final,
            "httpStatus": status,
            "contentType": ctype,
            "htmlBytes": len(html.encode("utf-8")),
            "keywordHits": extracted["keywordHits"],
            "candidateCount": len(extracted["candidates"]),
            "candidates": extracted["candidates"],
        })
        for candidate in extracted["candidates"]:
            entry = candidate_map.setdefault(candidate["url"], candidate)
            for source in candidate["sources"]:
                if source not in entry["sources"]:
                    entry["sources"].append(source)
            for context in candidate["contexts"]:
                if context not in entry["contexts"]:
                    entry["contexts"].append(context)

    # Preserve all discovered candidates as evidence, but probe only the OPAC
    # endpoints needed for the holdings contract. Avoid timing out on unrelated
    # Drupal assets and historical UdeG links.
    priority_urls = [
        CUCSH_OPAC,
        "http://148.202.248.73/F/",
        "http://148.202.248.73/F/?func=find-b-0&local_base=UDG01",
    ]
    probe_urls = [url for url in priority_urls if url in candidate_map or url == CUCSH_OPAC]
    probes = [probe_candidate(url) for url in probe_urls]
    contract = inspect_cucsh_opac_contract()
    session_actions = [
        form.get("resolvedAction")
        for form in contract.get("forms") or []
        if form.get("resolvedAction")
    ]
    if not session_actions:
        raise ValueError("CUCSH Aleph contract did not expose a session action")
    session_action = session_actions[0]

    return {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "rawHtmlPersisted": False,
        "seedPages": pages,
        "candidates": list(candidate_map.values()),
        "candidateProbes": probes,
        "cucshOpacContract": contract,
        "sampleSystemLookups": [
            sample_system_lookup(
                name,
                system_number,
                session_action=session_action,
            )
            for name, system_number in SAMPLE_SYSTEM_NUMBERS
        ],
        "metrics": {
            "seedPages": len(pages),
            "candidates": len(candidate_map),
            "probeSuccess": sum(row.get("ok") is True for row in probes),
            "probeFailure": sum(row.get("ok") is False for row in probes),
            "probeTargets": len(probes),
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
    print(json.dumps({
        "metrics": report["metrics"],
        "candidates": report["candidates"],
        "probeSummary": report["candidateProbes"],
    }, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

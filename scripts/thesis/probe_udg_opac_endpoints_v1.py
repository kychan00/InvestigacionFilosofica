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
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

SCHEMA = "thesis-opac-endpoint-recon-v1"
REVISION = "2026-11-04.t2cm-v1"

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


def fetch(url: str, timeout: int = 60) -> tuple[str, str, str, int]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "InvestigacionFilosofica-T2CM/1.0 (+OPAC endpoint discovery)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
        final = response.geturl()
        ctype = response.headers.get("Content-Type", "")
        status = int(getattr(response, "status", 200))
    if "text/html" not in ctype.casefold() and "application/xhtml+xml" not in ctype.casefold():
        raise ValueError(f"Unexpected content type for {url}: {ctype}")
    return raw.decode("utf-8", errors="replace"), final, ctype, status


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

    # Only probe candidates already discovered on official pages.
    probes = [probe_candidate(url) for url in sorted(candidate_map)]
    return {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "rawHtmlPersisted": False,
        "seedPages": pages,
        "candidates": list(candidate_map.values()),
        "candidateProbes": probes,
        "metrics": {
            "seedPages": len(pages),
            "candidates": len(candidate_map),
            "probeSuccess": sum(row.get("ok") is True for row in probes),
            "probeFailure": sum(row.get("ok") is False for row in probes),
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

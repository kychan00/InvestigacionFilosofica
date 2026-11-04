#!/usr/bin/env python3
"""Probe the CUCSH thesis catalog as reference-only institutional metadata."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.parse
import urllib.request
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

SCHEMA = "thesis-cucsh-catalog-recon-v1"
REVISION = "2026-11-04.t2cj-v1"
START_URLS = (
    "https://www.biblioteca.cucsh.udg.mx/catalogo-de-tesis",
    "http://www.biblioteca.cucsh.udg.mx/catalogo-de-tesis",
)
ALLOWED_HOSTS = {
    "biblioteca.cucsh.udg.mx",
    "www.biblioteca.cucsh.udg.mx",
}
FORBIDDEN = (".pdf", "/bitstream", "/download")
SIGNAL_TERMS = (
    "tesis",
    "filosof",
    "licenci",
    "maestr",
    "doctor",
    "posgrado",
)


def normalize(value: str | None) -> str:
    return " ".join(str(value or "").casefold().split())


def safe_catalog_url(raw: str | None, *, base_url: str) -> str | None:
    if not raw:
        return None
    decoded = urllib.parse.unquote(raw).casefold()
    if any(token in decoded for token in FORBIDDEN):
        return None
    try:
        absolute = urllib.parse.urljoin(base_url, raw)
        parsed = urllib.parse.urlparse(absolute)
    except ValueError:
        return None
    host = (parsed.hostname or "").casefold()
    if (
        parsed.scheme not in {"http", "https"}
        or host not in ALLOWED_HOSTS
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 80, 443)
    ):
        return None
    return urllib.parse.urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, "")
    )


class AnchorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.in_title = False
        self.current: dict[str, Any] | None = None
        self.anchors: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        name = tag.casefold()
        if name == "title":
            self.in_title = True
        elif name == "a":
            values = {str(k).casefold(): (v or "") for k, v in attrs}
            self.current = {"href": values.get("href", ""), "text": ""}

    def handle_endtag(self, tag: str) -> None:
        name = tag.casefold()
        if name == "title":
            self.in_title = False
        elif name == "a" and self.current is not None:
            self.current["text"] = " ".join(self.current["text"].split())
            self.anchors.append(self.current)
            self.current = None

    def handle_data(self, data: str) -> None:
        if self.in_title and data.strip():
            self.title_parts.append(data.strip())
        if self.current is not None and data.strip():
            self.current["text"] += " " + data.strip()


def parse_catalog(html: str, *, base_url: str) -> dict[str, Any]:
    parser = AnchorParser()
    parser.feed(html)

    safe_links: list[dict[str, str]] = []
    rejected = 0
    seen: set[tuple[str, str]] = set()
    for anchor in parser.anchors:
        safe = safe_catalog_url(anchor.get("href"), base_url=base_url)
        if not safe:
            if anchor.get("href"):
                rejected += 1
            continue
        row = {"text": anchor.get("text") or "", "url": safe}
        key = (row["text"], row["url"])
        if key in seen:
            continue
        seen.add(key)
        safe_links.append(row)

    signals = [
        row for row in safe_links
        if any(term in normalize(row["text"] + " " + row["url"]) for term in SIGNAL_TERMS)
    ]
    philosophy = [
        row for row in safe_links
        if "filosof" in normalize(row["text"] + " " + row["url"])
    ]
    return {
        "pageTitle": " ".join(parser.title_parts).strip(),
        "safeLinks": safe_links,
        "signalLinks": signals,
        "philosophySignalLinks": philosophy,
        "rejectedAnchorLinks": rejected,
    }


def fetch_once(url: str, *, timeout: int = 60) -> tuple[str, str, int, str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "InvestigacionFilosofica-T2CJ/1.0 (+reference-only metadata probe)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        final_url = response.geturl()
        status = getattr(response, "status", 200)
        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type.casefold() and "application/xhtml+xml" not in content_type.casefold():
            raise ValueError(f"Unexpected CUCSH catalog content type: {content_type}")
        raw = response.read()
    return raw.decode("utf-8", errors="replace"), final_url, int(status), content_type


def fetch_catalog(urls: tuple[str, ...] = START_URLS) -> dict[str, Any]:
    failures: list[dict[str, str]] = []
    for url in urls:
        try:
            html, final_url, status, content_type = fetch_once(url)
            parsed_final = urllib.parse.urlparse(final_url)
            if (parsed_final.hostname or "").casefold() not in ALLOWED_HOSTS:
                raise ValueError(f"Redirect left CUCSH allowlist: {final_url}")
            parsed = parse_catalog(html, base_url=final_url)
            if not parsed["safeLinks"]:
                raise ValueError("CUCSH catalog returned no safe navigable links")
            return {
                "schemaVersion": SCHEMA,
                "revision": REVISION,
                "referenceOnly": True,
                "rawHtmlPersisted": False,
                "requestedUrl": url,
                "finalUrl": final_url,
                "httpStatus": status,
                "contentType": content_type,
                "htmlSha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
                "htmlBytes": len(html.encode("utf-8")),
                "metrics": {
                    "safeLinks": len(parsed["safeLinks"]),
                    "signalLinks": len(parsed["signalLinks"]),
                    "philosophySignalLinks": len(parsed["philosophySignalLinks"]),
                    "rejectedAnchorLinks": parsed["rejectedAnchorLinks"],
                    "safeLinkHosts": dict(Counter(
                        urllib.parse.urlparse(row["url"]).hostname
                        for row in parsed["safeLinks"]
                    )),
                },
                **parsed,
                "failuresBeforeSuccess": failures,
            }
        except Exception as exc:
            failures.append({"url": url, "error": str(exc)})
    raise RuntimeError("CUCSH thesis catalog probe failed: " + json.dumps(failures, ensure_ascii=False))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = fetch_catalog()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "schemaVersion": report["schemaVersion"],
        "finalUrl": report["finalUrl"],
        "pageTitle": report["pageTitle"],
        "metrics": report["metrics"],
        "rawHtmlPersisted": report["rawHtmlPersisted"],
    }, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

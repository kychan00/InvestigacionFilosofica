#!/usr/bin/env python3
"""Probe and enumerate Philosophy references from the CUCSH thesis catalog."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

SCHEMA = "thesis-cucsh-catalog-recon-v1"
REVISION = "2026-11-04.t2cj-v3"
START_URLS = (
    "https://www.biblioteca.cucsh.udg.mx/catalogo-de-tesis",
    "http://www.biblioteca.cucsh.udg.mx/catalogo-de-tesis",
)
DEGREE_PATHS = (
    ("licenciatura", "/vista-tesis-licenciatura"),
    ("maestria", "/vista-tesis-maestria"),
    ("doctorado", "/vista-tesis-doctorado"),
)
ALLOWED_HOSTS = {
    "biblioteca.cucsh.udg.mx",
    "www.biblioteca.cucsh.udg.mx",
}
FORBIDDEN = (".pdf", "/bitstream", "/download")
SIGNAL_TERMS = ("tesis", "filosof", "licenci", "maestr", "doctor", "posgrado")
MAX_FILTER_PAGES = 120


def normalize(value: str | None) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return " ".join(text.casefold().split())


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
        or parsed.username or parsed.password
        or parsed.port not in (None, 80, 443)
    ):
        return None
    return urllib.parse.urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, "")
    )


class StructureParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.in_title = False
        self.current_anchor: dict[str, str] | None = None
        self.anchors: list[dict[str, str]] = []
        self.current_select: dict[str, Any] | None = None
        self.current_option: dict[str, str] | None = None
        self.selects: list[dict[str, Any]] = []
        self.forms: list[dict[str, str]] = []
        self.in_table = False
        self.current_row: list[str] | None = None
        self.current_cell: list[str] | None = None
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        name = tag.casefold()
        values = {str(k).casefold(): (v or "") for k, v in attrs}
        if name == "title":
            self.in_title = True
        elif name == "a":
            self.current_anchor = {"href": values.get("href", ""), "text": ""}
        elif name == "form":
            self.forms.append({
                "action": values.get("action", ""),
                "method": values.get("method", "get").casefold(),
                "id": values.get("id", ""),
                "class": values.get("class", ""),
            })
        elif name == "select":
            self.current_select = {
                "name": values.get("name", ""),
                "id": values.get("id", ""),
                "options": [],
            }
        elif name == "option" and self.current_select is not None:
            self.current_option = {"value": values.get("value", ""), "text": ""}
        elif name == "table":
            self.in_table = True
        elif name == "tr" and self.in_table:
            self.current_row = []
        elif name in {"td", "th"} and self.current_row is not None:
            self.current_cell = []

    def handle_endtag(self, tag: str) -> None:
        name = tag.casefold()
        if name == "title":
            self.in_title = False
        elif name == "a" and self.current_anchor is not None:
            self.current_anchor["text"] = " ".join(self.current_anchor["text"].split())
            self.anchors.append(self.current_anchor)
            self.current_anchor = None
        elif name == "option" and self.current_option is not None and self.current_select is not None:
            self.current_option["text"] = " ".join(self.current_option["text"].split())
            self.current_select["options"].append(self.current_option)
            self.current_option = None
        elif name == "select" and self.current_select is not None:
            self.selects.append(self.current_select)
            self.current_select = None
            self.current_option = None
        elif name in {"td", "th"} and self.current_cell is not None and self.current_row is not None:
            self.current_row.append(" ".join(" ".join(self.current_cell).split()))
            self.current_cell = None
        elif name == "tr" and self.current_row is not None:
            if any(self.current_row):
                self.rows.append(self.current_row)
            self.current_row = None
            self.current_cell = None
        elif name == "table":
            self.in_table = False

    def handle_data(self, data: str) -> None:
        if self.in_title and data.strip():
            self.title_parts.append(data.strip())
        if self.current_anchor is not None and data.strip():
            self.current_anchor["text"] += " " + data.strip()
        if self.current_option is not None and data.strip():
            self.current_option["text"] += " " + data.strip()
        if self.current_cell is not None and data.strip():
            self.current_cell.append(data.strip())


def parse_catalog(html: str, *, base_url: str) -> dict[str, Any]:
    parser = StructureParser()
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
    philosophy_links = [
        row for row in safe_links
        if "filosof" in normalize(row["text"] + " " + row["url"])
    ]
    philosophy_options = []
    for select in parser.selects:
        for option in select["options"]:
            if "filosof" in normalize(option["text"] + " " + option["value"]):
                philosophy_options.append({
                    "selectName": select["name"],
                    "selectId": select["id"],
                    **option,
                })
    philosophy_rows = [
        row for row in parser.rows
        if "filosof" in normalize(" ".join(row))
    ][:25]
    return {
        "pageTitle": " ".join(parser.title_parts).strip(),
        "safeLinks": safe_links,
        "signalLinks": signals,
        "philosophySignalLinks": philosophy_links,
        "rejectedAnchorLinks": rejected,
        "forms": parser.forms[:20],
        "selects": parser.selects[:20],
        "tableRowCount": len(parser.rows),
        "sampleTableRows": parser.rows[:12],
        "philosophySelectOptions": philosophy_options,
        "philosophyTableRows": philosophy_rows,
    }


def fetch_once(url: str, *, timeout: int = 35) -> tuple[str, str, int, str]:
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


def alternate_scheme(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    scheme = "http" if parsed.scheme == "https" else "https"
    return urllib.parse.urlunparse(
        (scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, "")
    )


def fetch_with_fallback(urls: tuple[str, ...]) -> tuple[str, str, int, str, str, list[dict[str, str]]]:
    failures: list[dict[str, str]] = []
    for url in urls:
        try:
            html, final_url, status, content_type = fetch_once(url)
            parsed_final = urllib.parse.urlparse(final_url)
            if (parsed_final.hostname or "").casefold() not in ALLOWED_HOSTS:
                raise ValueError(f"Redirect left CUCSH allowlist: {final_url}")
            return html, final_url, status, content_type, url, failures
        except Exception as exc:
            failures.append({"url": url, "error": str(exc)})
    raise RuntimeError("CUCSH request failed: " + json.dumps(failures, ensure_ascii=False))


def page_report(urls: tuple[str, ...]) -> dict[str, Any]:
    html, final_url, status, content_type, requested_url, failures = fetch_with_fallback(urls)
    parsed = parse_catalog(html, base_url=final_url)
    return {
        "requestedUrl": requested_url,
        "finalUrl": final_url,
        "httpStatus": status,
        "contentType": content_type,
        "htmlSha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
        "htmlBytes": len(html.encode("utf-8")),
        **parsed,
        "failuresBeforeSuccess": failures,
    }


def philosophy_targets(degree_views: list[dict[str, Any]]) -> list[dict[str, str]]:
    targets: list[dict[str, str]] = []
    for view in degree_views:
        for select in view["selects"]:
            for option in select["options"]:
                if option.get("value") in {"", "All"}:
                    continue
                if "filosof" not in normalize(option.get("text") + " " + option.get("value")):
                    continue
                targets.append({
                    "degree": view["degree"],
                    "viewFinalUrl": view["finalUrl"],
                    "selectName": select["name"],
                    "selectId": select["id"],
                    "program": option["text"],
                    "value": option["value"],
                })
    return targets


def table_records(parsed: dict[str, Any], *, expected_program: str, page_url: str) -> list[dict[str, Any]]:
    title_urls: dict[str, str] = {}
    for link in parsed["safeLinks"]:
        text_key = normalize(link.get("text"))
        if not text_key:
            continue
        if "content/" in urllib.parse.unquote(link["url"]).casefold():
            title_urls.setdefault(text_key, link["url"])

    records: list[dict[str, Any]] = []
    for cells in parsed.get("sampleTableRows", []):
        pass
    rows = parsed.get("_allRows") or []
    for cells in rows:
        if len(cells) < 6:
            continue
        if normalize(cells[0]) in {"titulo", "title"}:
            continue
        program = cells[5].strip()
        if normalize(program) != normalize(expected_program):
            raise ValueError(
                f"CUCSH filtered page returned another program: expected={expected_program!r} got={program!r}"
            )
        title = cells[0].strip()
        record_url = title_urls.get(normalize(title))
        records.append({
            "title": title,
            "author": cells[1].strip(),
            "coauthor": cells[2].strip(),
            "director": cells[3].strip(),
            "year": cells[4].strip(),
            "program": program,
            "recordUrl": record_url,
            "catalogPageUrl": page_url,
        })
    return records


def parse_full_page(html: str, *, base_url: str) -> dict[str, Any]:
    parsed = parse_catalog(html, base_url=base_url)
    parser = StructureParser()
    parser.feed(html)
    parsed["_allRows"] = parser.rows
    return parsed


def filtered_page_url(target: dict[str, str], page: int, *, combine: str = "") -> str:
    parsed = urllib.parse.urlparse(target["viewFinalUrl"])
    q_slug = parsed.path.strip("/")
    query = urllib.parse.urlencode({
        "q": q_slug,
        "combine": combine,
        target["selectName"]: target["value"],
        "order": "title",
        "sort": "asc",
        "page": str(page),
    })
    return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, "/", "", query, ""))


def crawl_philosophy_target(
    target: dict[str, str],
    *,
    max_pages: int = MAX_FILTER_PAGES,
    delay: float = 0.05,
) -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    page_evidence: list[dict[str, Any]] = []
    signatures: set[str] = set()

    for page in range(max_pages):
        url = filtered_page_url(target, page)
        html, final_url, status, content_type, requested, failures = fetch_with_fallback(
            (url, alternate_scheme(url))
        )
        parsed = parse_full_page(html, base_url=final_url)
        current = table_records(
            parsed,
            expected_program=target["program"],
            page_url=final_url,
        )
        signature = hashlib.sha256(
            json.dumps(current, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()
        if not current:
            page_evidence.append({
                "page": page,
                "url": final_url,
                "rows": 0,
                "htmlSha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
                "stop": "empty",
                "failuresBeforeSuccess": failures,
            })
            break
        if signature in signatures:
            page_evidence.append({
                "page": page,
                "url": final_url,
                "rows": len(current),
                "htmlSha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
                "stop": "repeated-page",
                "failuresBeforeSuccess": failures,
            })
            break
        signatures.add(signature)
        records.extend(current)
        page_evidence.append({
            "page": page,
            "url": final_url,
            "rows": len(current),
            "httpStatus": status,
            "contentType": content_type,
            "htmlSha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
            "stop": None,
            "failuresBeforeSuccess": failures,
        })
        if delay:
            time.sleep(delay)
    else:
        raise ValueError(f"CUCSH Philosophy pagination exceeded max pages: {target['program']}")

    unique: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for row in records:
        key = (
            normalize(row["title"]),
            normalize(row["author"]),
            row["year"],
            normalize(row["program"]),
        )
        if key in unique:
            if unique[key].get("recordUrl") != row.get("recordUrl"):
                raise ValueError(f"Conflicting CUCSH duplicate: {row['title']}")
            continue
        unique[key] = row
    output = sorted(
        unique.values(),
        key=lambda row: (normalize(row["title"]), normalize(row["author"]), row["year"]),
    )
    return {
        "degree": target["degree"],
        "program": target["program"],
        "filterName": target["selectName"],
        "filterValue": target["value"],
        "records": output,
        "count": len(output),
        "pagesFetched": sum(1 for row in page_evidence if row["rows"] > 0),
        "pageEvidence": page_evidence,
        "recordsWithDetailUrl": sum(bool(row.get("recordUrl")) for row in output),
    }


def fetch_catalog(urls: tuple[str, ...] = START_URLS) -> dict[str, Any]:
    landing = page_report(urls)
    if not landing["safeLinks"]:
        raise ValueError("CUCSH catalog returned no safe navigable links")

    base = landing["finalUrl"]
    parsed_base = urllib.parse.urlparse(base)
    scheme_host = f"{parsed_base.scheme}://{parsed_base.netloc}"
    degree_views = []
    for degree, path in DEGREE_PATHS:
        target = urllib.parse.urljoin(scheme_host + "/", path.lstrip("/"))
        report = page_report((target, alternate_scheme(target)))
        degree_views.append({"degree": degree, **report})

    targets = philosophy_targets(degree_views)
    inventories = [crawl_philosophy_target(target) for target in targets]
    philosophy_signals = []
    for view in degree_views:
        for option in view["philosophySelectOptions"]:
            philosophy_signals.append({
                "degree": view["degree"],
                "kind": "select-option",
                **option,
            })
        for row in view["philosophyTableRows"]:
            philosophy_signals.append({
                "degree": view["degree"],
                "kind": "table-row",
                "cells": row,
            })
        for link in view["philosophySignalLinks"]:
            philosophy_signals.append({
                "degree": view["degree"],
                "kind": "link",
                **link,
            })

    inventory_records = [row for group in inventories for row in group["records"]]
    return {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "rawHtmlPersisted": False,
        "landing": landing,
        "degreeViews": degree_views,
        "philosophySignals": philosophy_signals,
        "philosophyTargets": targets,
        "philosophyInventories": inventories,
        "metrics": {
            "landingSafeLinks": len(landing["safeLinks"]),
            "degreeViews": len(degree_views),
            "degreeViewTableRows": {
                view["degree"]: view["tableRowCount"] for view in degree_views
            },
            "degreeViewSelects": {
                view["degree"]: len(view["selects"]) for view in degree_views
            },
            "philosophySignals": len(philosophy_signals),
            "philosophyTargets": len(targets),
            "philosophyInventoryRecords": len(inventory_records),
            "philosophyInventoryByProgram": {
                group["program"]: group["count"] for group in inventories
            },
            "philosophyDetailUrls": sum(bool(row.get("recordUrl")) for row in inventory_records),
            "rejectedAnchorLinks": landing["rejectedAnchorLinks"] + sum(
                view["rejectedAnchorLinks"] for view in degree_views
            ),
            "safeLinkHosts": dict(Counter(
                urllib.parse.urlparse(row["url"]).hostname
                for page in [landing, *degree_views]
                for row in page["safeLinks"]
            )),
        },
    }


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
        "revision": report["revision"],
        "metrics": report["metrics"],
        "philosophyTargets": report["philosophyTargets"],
        "rawHtmlPersisted": report["rawHtmlPersisted"],
    }, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

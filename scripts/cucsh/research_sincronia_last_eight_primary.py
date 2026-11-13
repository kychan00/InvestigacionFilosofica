#!/usr/bin/env python3
"""Last-eight Sincronía provenance research: original and historical host variants.

Evidence discovery only. Preserve indexed works and author fields unchanged.
The source host may have changed: never infer exact work identity from a
different host's filename. A visible interviewee is not a byline.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

from scripts.cucsh.probe_sincronia_wayback_eight import (
    parse_available, parse_cdx, cdx_url, available_url, get_json, inspect_entry,
    USER_AGENT,
)

TARGET_IDS = [
    "cucsh:sincronia-legacy:1578698f39fd24636e00", # schmid.html malformed index
    "cucsh:sincronia-legacy:2126d56c91012923e100", # American Frontiers
    "cucsh:sincronia-legacy:350cd62320155bec831b", # Amigos o Enemigos
    "cucsh:sincronia-legacy:63fcb1b95f79aa94948b", # El deber de la critica
    "cucsh:sincronia-legacy:4800ef829bfca4e699cb", # Atreverse
    "cucsh:sincronia-legacy:582537d89e07194c5970", # Hypertextualizado
    "cucsh:sincronia-legacy:d578e8ef399dde877feb", # Jorge Lucio de Campos
    "cucsh:sincronia-legacy:a9b2551729fe0893d5e3", # Dante Medina biography
]


class ReadableArticle(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.text = []
        self.html_title = []
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.hidden += 1
        if tag == "title":
            self.in_title = True
        if tag in ("h1", "h2", "h3", "p", "div", "br", "li", "tr"):
            self.text.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript") and self.hidden:
            self.hidden -= 1
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if not self.hidden:
            self.text.append(data)
            if self.in_title:
                self.html_title.append(data)

    def result(self):
        text = re.sub(r"[ \t\r\f\v]+", " ", "".join(self.text))
        lines = [x.strip() for x in text.splitlines() if x.strip()]
        content = "\n".join(lines)
        return {
            "archivedHtmlTitle": " ".join(self.html_title).strip()[:250],
            "unverifiedArticleText": content[:17000],
            "contentTruncated": len(content) > 17000,
        }


def detailed_snapshot(snapshot_url, opener=urllib.request.urlopen):
    req = urllib.request.Request(snapshot_url, headers={
        "User-Agent": USER_AGENT, "Accept": "text/html"
    })
    with opener(req, timeout=9) as response:
        content_type = str(response.headers.get("Content-Type", "")).lower()
        raw = response.read(260000)
    if "html" not in content_type:
        return {"fetchStatus": "non-html"}
    declared = re.search(r"charset\s*=\s*['\"]?([A-Za-z0-9_-]+)", content_type)
    encoding = declared.group(1) if declared else "utf-8"
    try:
        html = raw.decode(encoding, errors="replace")
    except LookupError:
        html = raw.decode("utf-8", errors="replace")
    parser = ReadableArticle()
    parser.feed(html)
    return {"fetchStatus": "html", **parser.result()}


def variants(original):
    path = urllib.parse.urlsplit(original).path
    rel = path.partition("/CUCSH/Sincronia/")[2] or path.rsplit("/", 1)[-1]
    candidates = [
        original,
        "http://fuentes.csh.udg.mx/CUCSH/Sincronia/" + rel,
        "http://sincronia.cucsh.udg.mx/" + rel,
    ]
    seen = set()
    out = []
    for candidate in candidates:
        norm = candidate.lower().replace(":80/", "/")
        if norm not in seen:
            out.append(candidate)
            seen.add(norm)
    return out


def fetch_index(original, *, getter=get_json):
    errors = []
    snapshots = []
    try:
        snapshots = parse_cdx(getter(cdx_url(original), timeout=8), original)
    except (ValueError, KeyError, TimeoutError, urllib.error.URLError, OSError) as exc:
        errors.append("cdx:" + type(exc).__name__)
    if not snapshots:
        try:
            snapshots = parse_available(getter(available_url(original), timeout=8), original)
        except (ValueError, KeyError, TimeoutError, urllib.error.URLError, OSError) as exc:
            errors.append("available:" + type(exc).__name__)
    return snapshots[:3], errors


def inspect(record, *, index_fetch=fetch_index, capture_fetch=detailed_snapshot):
    original = record["originalUrl"]
    entries = []
    for candidate in variants(original):
        snapshots, errors = index_fetch(candidate)
        entry = {
            "indexedUrl": original,
            "candidateUrl": candidate,
            "urlIdentity": (
                "exact-frozen-original" if candidate == original
                else "different-historical-host-unverified-title-and-author"
            ),
            "indexErrors": errors,
            "snapshotCount": len(snapshots),
            "captures": [],
        }
        for snap in snapshots[:2]:
            result = {
                "timestamp": snap["timestamp"],
                "snapshotUrl": snap["snapshotUrl"],
                "archivedOriginal": snap["archivedOriginal"],
            }
            try:
                result.update(capture_fetch(snap["snapshotUrl"]))
            except (UnicodeError, ValueError, TimeoutError, urllib.error.URLError, OSError) as exc:
                result["fetchStatus"] = "error"
                result["errorType"] = type(exc).__name__
            entry["captures"].append(result)
            if result.get("fetchStatus") == "html":
                break
        entries.append(entry)
    return {
        "id": record["id"],
        "indexedTitle": record["title"],
        "issueNumber": record["issueNumber"],
        "year": record["year"],
        "originalUrl": original,
        "originalSourceStatus": record["sourceAvailability"],
        "authorAttribution": None,
        "originalRecordModified": False,
        "requiresManualBibliographicVerification": True,
        "candidateSourceCaptures": entries,
    }


def make_report(pending, *, probe=inspect):
    rows = pending["records"]
    lookup = {r["id"]: r for r in rows}
    if (
        pending.get("totalSincroniaRecords") != 1454
        or pending.get("pendingAuthorRecords") != 16
        or pending.get("highConfidenceEditorialNavigationCount") != 2
        or len(rows) != len(lookup)
        or len(TARGET_IDS) != 8
        or len(set(TARGET_IDS)) != 8
        or not set(TARGET_IDS).issubset(lookup)
    ):
        raise ValueError("Stale historical bibliography: re-audit exact missing sources")
    with ThreadPoolExecutor(max_workers=4) as pool:
        found = list(pool.map(probe, (lookup[rid] for rid in TARGET_IDS)))
    assert len(found) == 8
    return {
        "scope": "Last-eight unsigned early Sincronía works: original-source deep archival inspection",
        "inputPendingAuthors": 16,
        "inputSincroniaCount": 1454,
        "selected": 8,
        "authorsAutomaticallyAssigned": 0,
        "sourceCorpusModified": False,
        "sourceIdentityWarning": (
            "Historical host variants are discovery leads only. The same path "
            "may identify different articles on different hosts or at different times."
        ),
        "records": found,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    report = make_report(json.loads(args.input.read_text(encoding="utf-8")))
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    for r in report["records"]:
        caps = [
            c for e in r["candidateSourceCaptures"] for c in e["captures"]
            if c.get("fetchStatus") == "html"
        ]
        print("ARCHIVE_PROBE", r["id"], "readable_snapshots", len(caps))
    print("SINCRONIA_EIGHT_DEEP_READ_ONLY_PASS")


if __name__ == "__main__":
    main()

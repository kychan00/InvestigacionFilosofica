#!/usr/bin/env python3
"""Final Sincronía work-identity review, read-only and fail-closed.

Inspect issue-8 Dante source-group index pages and issue-15 Campos archive
paths. A directory, author's biography or same filename on a different host
is contextual evidence, NEVER an automatic author byline.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlencode, urljoin
import urllib.error
import urllib.request

from scripts.cucsh.probe_sincronia_wayback_eight import (
    USER_AGENT, get_json, cdx_url, available_url, parse_cdx, parse_available,
)
from scripts.cucsh.research_sincronia_last_eight_primary import ReadableArticle

ROOT = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/"
DANTE = ROOT + "dante/"
TARGET_IDS = {
    "cucsh:sincronia-legacy:4800ef829bfca4e699cb",
    "cucsh:sincronia-legacy:582537d89e07194c5970",
    "cucsh:sincronia-legacy:a9b2551729fe0893d5e3",
    "cucsh:sincronia-legacy:d578e8ef399dde877feb",
}
CANDIDATES = [
    DANTE + "index.html", DANTE + "index.htm", DANTE + "default.htm",
    DANTE + "dante.html", DANTE + "dindex.html", DANTE + "dindex.htm",
    ROOT + "dindex.html", ROOT + "dindex.htm",
    "http://sincronia.cucsh.udg.mx/dindex.html",
    DANTE, DANTE + "ana.html", DANTE + "hyper.html",
    DANTE + "bio.html", ROOT + "indice8.htm", ROOT + "indice8.html",
    ROOT + "index.html", "http://sincronia.cucsh.udg.mx/campos.htm",
    ROOT + "campos.htm", ROOT + "campos.html", ROOT + "campo.htm",
]
PATTERN = re.compile(r"dante|medina|ana\.html|hyper|bio\.html|campos|index|indice|poes", re.I)


class AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.href = None
        self.labels = []
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href", "")
            self.labels = []
    def handle_data(self, data):
        if self.href is not None:
            self.labels.append(data)
    def handle_endtag(self, tag):
        if tag == "a" and self.href is not None:
            self.links.append({
                "href": str(self.href)[:300],
                "label": " ".join("".join(self.labels).split())[:300],
            })
            self.href = None
            self.labels = []


def index_captures(url, *, getter=get_json):
    errors = []
    captures = []
    try:
        captures = parse_cdx(getter(cdx_url(url), timeout=7), url)
    except (ValueError, KeyError, TimeoutError, urllib.error.URLError, OSError) as exc:
        errors.append(type(exc).__name__)
    if not captures:
        try:
            captures = parse_available(getter(available_url(url), timeout=7), url)
        except (ValueError, KeyError, TimeoutError, urllib.error.URLError, OSError) as exc:
            errors.append(type(exc).__name__)
    return captures[:4], errors


def fetch_archived_document(snapshot_url, *, opener=urllib.request.urlopen):
    req = urllib.request.Request(snapshot_url, headers={
        "User-Agent": USER_AGENT, "Accept": "text/html"
    })
    with opener(req, timeout=9) as response:
        content_type = str(response.headers.get("Content-Type", "")).lower()
        raw = response.read(200000)
    if "html" not in content_type:
        return {"captureStatus": "non-html"}
    content = raw.decode("utf-8", errors="replace")
    anchor = AnchorParser()
    anchor.feed(content)
    visible = ReadableArticle()
    visible.feed(content)
    text = visible.result()
    matched = [
        {**link, "absoluteRef": urljoin(snapshot_url, link["href"])}
        for link in anchor.links
        if PATTERN.search(link["label"] + " " + link["href"])
    ]
    return {
        "captureStatus": "html",
        "htmlTitle": text["archivedHtmlTitle"],
        "visibleText": text["unverifiedArticleText"][:8500],
        "relevantLinks": matched[:80],
        "allLinkCount": len(anchor.links),
        "matchedLinkCount": len(matched),
    }


def inspect_candidate(url, *, indexer=index_captures, fetcher=fetch_archived_document):
    snapshots, errors = indexer(url)
    outcome = {"candidateUrl": url, "indexErrors": errors, "captures": []}
    for snap in snapshots[:3]:
        capture = {"timestamp": snap["timestamp"], "snapshotUrl": snap["snapshotUrl"]}
        try:
            capture.update(fetcher(snap["snapshotUrl"]))
        except (ValueError, UnicodeError, TimeoutError, urllib.error.URLError, OSError) as exc:
            capture["captureStatus"] = "fetch-error"
            capture["errorType"] = type(exc).__name__
        outcome["captures"].append(capture)
        if capture.get("captureStatus") == "html":
            break
    return outcome


def make_report(pending, *, inspect=inspect_candidate):
    rows = pending["records"]
    lookup = {row["id"]: row for row in rows}
    if (
        pending.get("totalSincroniaRecords") != 1454
        or pending.get("pendingAuthorRecords") != 6
        or pending.get("highConfidenceEditorialNavigationCount") != 2
        or len(rows) != 6
        or len(rows) != len(lookup)
        or len(TARGET_IDS) != 4
        or not TARGET_IDS.issubset(lookup)
    ):
        raise ValueError("Pending Sincronía author queue drifted; do not infer source identity")
    with ThreadPoolExecutor(max_workers=4) as pool:
        inspected = list(pool.map(inspect, CANDIDATES))
    return {
        "scope": "Issue-8 Dante collection and issue-15 Jorge Lúcio de Campos identity",
        "inputSincroniaWorks": 1454,
        "inputMissingAuthors": 6,
        "targetUncreditedNonEditorial": 4,
        "editorialNavigationNotAcademicArticles": 2,
        "candidateUrlsInspected": len(inspected),
        "authorAssignments": 0,
        "corpusModified": False,
        "caution": (
            "A same-directory link to a biographical subject does not establish "
            "literary authorship; matching filename on another host may name a "
            "different work, and interviews require role verification."
        ),
        "sourceReviews": inspected,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = make_report(json.loads(args.input.read_text(encoding="utf-8")))
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_FINAL_FOUR_CONTEXTS_READ_ONLY",
          report["candidateUrlsInspected"], report["authorAssignments"])


if __name__ == "__main__":
    main()

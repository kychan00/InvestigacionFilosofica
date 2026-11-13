#!/usr/bin/env python3
"""Evidence-only Wayback index probe for eight unresolved historical Sincronía URLs.

Never assign authors or mutate original bibliography. External archive APIs can
be blocked, incomplete, or return snapshots of different content. Mark such
results as leads requiring visual and bibliographic verification.
"""
from __future__ import annotations

import argparse
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

TARGET_IDS = [
    "cucsh:sincronia-legacy:436f156845f87b644223",  # Vevia / Peirce
    "cucsh:sincronia-legacy:53ca1099d5f51b81cc33",  # Costantini
    "cucsh:sincronia-legacy:af98cc00a0388baabb3d",  # Gilbert
    "cucsh:sincronia-legacy:5a5c77cbf7b126732d8e",  # Figioni
    "cucsh:sincronia-legacy:2126d56c91012923e100",  # American Frontiers
    "cucsh:sincronia-legacy:350cd62320155bec831b",  # Amigos / Enemigos
    "cucsh:sincronia-legacy:63fcb1b95f79aa94948b",  # Crítica
    "cucsh:sincronia-legacy:d033194e9ccdac732454",  # Chenalhó
]
USER_AGENT = "InvestigacionFilosofica-HistoricalMetadataAudit/1.0 (+academic bibliographic verification)"
YEAR_RE = re.compile(r"^\d{14}$")


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.parts = []
        self.page_title = ""
        self.inside_title = False
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.skip += 1
        if tag == "title":
            self.inside_title = True
    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript") and self.skip:
            self.skip -= 1
        if tag == "title":
            self.inside_title = False
        if tag in ("p", "h1", "h2", "h3", "div", "br"):
            self.parts.append("\n")
    def handle_data(self, text):
        if not self.skip:
            self.parts.append(text)
            if self.inside_title:
                self.page_title += text
    def summary(self):
        content = html.unescape(" ".join(self.parts))
        content = re.sub(r"[ \t\r\f\v]+", " ", content)
        content = re.sub(r"\n\s*", "\n", content)
        lines = [line.strip() for line in content.splitlines()]
        significant = [line for line in lines if len(line) > 3][:20]
        return {
            "archivedPageTitle": self.page_title.strip()[:220],
            "unverifiedOpeningExcerpt": " | ".join(significant)[:750],
        }


def get_json(url, opener=urllib.request.urlopen, timeout=9):
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT, "Accept": "application/json"
    })
    with opener(req, timeout=timeout) as response:
        raw = response.read(100000)
    return json.loads(raw.decode("utf-8"))


def cdx_url(original):
    params = urllib.parse.urlencode({
        "url": original, "output": "json", "fl": "timestamp,original,statuscode,mimetype",
        "filter": "statuscode:200", "limit": "4"
    })
    return "https://web.archive.org/cdx/search/cdx?" + params


def available_url(original):
    return "https://archive.org/wayback/available?" + urllib.parse.urlencode({
        "url": original, "timestamp": "20000101",
    })


def parse_cdx(rows, original):
    if not isinstance(rows, list) or not rows:
        return []
    header = rows[0]
    required = {"timestamp", "original", "statuscode", "mimetype"}
    if not isinstance(header, list) or not required.issubset(header):
        return []
    snapshots = []
    for values in rows[1:]:
        if not isinstance(values, list) or len(values) != len(header):
            continue
        data = dict(zip(header, values))
        ts = str(data["timestamp"])
        if not YEAR_RE.fullmatch(ts) or str(data["statuscode"]) != "200":
            continue
        if not str(data["mimetype"]).lower().startswith("text/html"):
            continue
        archived_original = str(data["original"])
        if urllib.parse.urlsplit(archived_original).path.lower() != urllib.parse.urlsplit(original).path.lower():
            continue
        link = "https://web.archive.org/web/" + ts + "/" + archived_original
        snapshots.append({"timestamp": ts, "archivedOriginal": archived_original, "snapshotUrl": link})
    return snapshots[:4]


def parse_available(payload, original):
    if not isinstance(payload, dict):
        return []
    nearest = (payload.get("archived_snapshots") or {}).get("closest") or {}
    ts = str(nearest.get("timestamp", ""))
    link = str(nearest.get("url", ""))
    if not YEAR_RE.fullmatch(ts) or not nearest.get("available") or not link.startswith("https://web.archive.org/web/"):
        return []
    if urllib.parse.urlsplit(original).path.lower().rsplit("/", 1)[-1] not in link.lower():
        return []
    return [{"timestamp": ts, "archivedOriginal": original, "snapshotUrl": link}]


def fetch_snapshot_excerpt(snapshot_url, opener=urllib.request.urlopen):
    req = urllib.request.Request(snapshot_url, headers={
        "User-Agent": USER_AGENT, "Accept": "text/html"
    })
    with opener(req, timeout=9) as response:
        content_type = str(response.headers.get("Content-Type", "")).lower()
        raw = response.read(160000)
    if "html" not in content_type:
        return {"snapshotFetchStatus": "non-html-response"}
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", errors="replace"))
    summary = parser.summary()
    return {"snapshotFetchStatus": "html-response", **summary}


def inspect_entry(record, *, json_fetch=get_json, snapshot_fetch=fetch_snapshot_excerpt):
    original = record["originalUrl"]
    result = {
        "id": record["id"],
        "issueNumber": record["issueNumber"],
        "year": record["year"],
        "indexedTitle": record["title"],
        "originalUrl": original,
        "indexedAvailability": record["sourceAvailability"],
        "archiveIndexStatus": "not_checked",
        "snapshots": [],
        "authorAttribution": None,
        "reviewInstruction": (
            "Do not assign an author until a signed original article or an "
            "independent bibliographic citation connects title, author, "
            "Sincronía and, ideally, the exact historic URL."
        ),
    }
    try:
        result["snapshots"] = parse_cdx(json_fetch(cdx_url(original)), original)
        result["archiveIndexStatus"] = "cdx-captures" if result["snapshots"] else "cdx-no-captures"
    except (ValueError, KeyError, TimeoutError, urllib.error.URLError, OSError) as exc:
        result["archiveIndexStatus"] = "cdx-error"
        result["cdxErrorType"] = type(exc).__name__
    if not result["snapshots"]:
        try:
            result["snapshots"] = parse_available(json_fetch(available_url(original)), original)
            result["fallbackIndexStatus"] = "available-capture" if result["snapshots"] else "available-no-capture"
        except (ValueError, KeyError, TimeoutError, urllib.error.URLError, OSError) as exc:
            result["fallbackIndexStatus"] = "available-error"
            result["fallbackErrorType"] = type(exc).__name__
    if result["snapshots"]:
        first = result["snapshots"][0]
        try:
            first.update(snapshot_fetch(first["snapshotUrl"]))
        except (ValueError, UnicodeError, TimeoutError, urllib.error.URLError, OSError) as exc:
            first["snapshotFetchStatus"] = "fetch-error"
            first["snapshotErrorType"] = type(exc).__name__
    return result


def make_report(pending, *, inspect=inspect_entry):
    records = pending["records"]
    lookup = {row["id"]: row for row in records}
    if (
        pending.get("totalSincroniaRecords") != 1454
        or pending.get("pendingAuthorRecords") != 51
        or pending.get("highConfidenceEditorialNavigationCount") != 2
        or len(lookup) != len(records)
        or not set(TARGET_IDS).issubset(lookup)
        or len(TARGET_IDS) != len(set(TARGET_IDS))
    ):
        raise ValueError("Frozen pending-author audit changed; reselect and review targets")
    inspected = [inspect(lookup[rid]) for rid in TARGET_IDS]
    return {
        "scope": "Historical Sincronía issue 1–4 targeted Wayback inspection",
        "inputCorpusRecords": 1454,
        "inputMissingAuthors": 51,
        "selectionCount": len(inspected),
        "sourceService": "Wayback CDX, with Wayback availability fallback",
        "metadataMutation": False,
        "manualVerificationRequired": True,
        "records": inspected,
        "withSnapshotLeads": sum(bool(r["snapshots"]) for r in inspected),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    pending = json.loads(args.input.read_text(encoding="utf-8"))
    report = make_report(pending)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_ARCHIVE_EIGHT_PROBED", report["selectionCount"],
          "snapshot leads:", report["withSnapshotLeads"])


if __name__ == "__main__":
    main()

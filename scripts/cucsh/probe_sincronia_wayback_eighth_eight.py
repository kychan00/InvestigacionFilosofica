#!/usr/bin/env python3
"""Eighth eight-work archival evidence search, read-only and fail-closed.

Investigate original signed Sincronía articles from issues 1 through 50.
This file does not claim or assign authors automatically. It reuses the
tested bounded Wayback inspector from the first eight-work batch.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

from scripts.cucsh.probe_sincronia_wayback_eight import inspect_entry, fetch_snapshot_excerpt, parse_cdx, cdx_url, get_json
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

TARGET_IDS = [
    "cucsh:sincronia-legacy:1578698f39fd24636e00",  # schmid.html
    "cucsh:sincronia-legacy:4800ef829bfca4e699cb",  # dante/ana.html
    "cucsh:sincronia-legacy:582537d89e07194c5970",  # dante/hyper.html
    "cucsh:sincronia-legacy:a9b2551729fe0893d5e3",  # dante/bio.html
    "cucsh:sincronia-legacy:4784c1d977cea2ee58c4",  # anuies.htm
    "cucsh:sincronia-legacy:935efad9845e05a0557f",  # mercado.htm
    "cucsh:sincronia-legacy:8eded0eac6e2a217ade1",  # korstanjespring09.htm
    "cucsh:sincronia-legacy:d033194e9ccdac732454",  # castaned.htm
]


def inspect_with_alternates(record):
    """When first archived body is unreachable, try up to two later captures."""
    outcome = inspect_entry(record)
    snapshots = outcome["snapshots"]
    if snapshots and snapshots[0].get("snapshotFetchStatus") != "html-response":
        for candidate in snapshots[1:3]:
            try:
                candidate.update(fetch_snapshot_excerpt(candidate["snapshotUrl"]))
            except (ValueError, UnicodeError, TimeoutError, urllib.error.URLError, OSError) as exc:
                candidate["snapshotFetchStatus"] = "fetch-error"
                candidate["snapshotErrorType"] = type(exc).__name__
            if candidate.get("snapshotFetchStatus") == "html-response":
                break
    return outcome


def inspect_with_alternates_and_hosts(record):
    """Capture exact source and store distinct-host leads separately, never as bylines."""
    result = inspect_with_alternates(record)
    if result["snapshots"]:
        return result
    original = result["originalUrl"]
    path = urlsplit(original).path
    filename = path.rsplit("/", 1)[-1]
    # Retain subdirectories such as dante/ana.html when changing historic hosts.
    relative = path.partition("/CUCSH/Sincronia/")[2] or filename
    options = [
        "http://sincronia.cucsh.udg.mx/" + relative,
        "http://fuentes.csh.udg.mx/CUCSH/Sincronia/" + relative,
    ]
    result["otherHostCandidates"] = []
    for candidate in dict.fromkeys(options):
        if candidate.lower() == original.lower():
            continue
        try:
            hits = parse_cdx(get_json(cdx_url(candidate), timeout=7), candidate)
            if hits:
                result["otherHostCandidates"].append({
                    "candidateUrl": candidate,
                    "urlMatchLevel": "different-historical-host-unverified-work-identity",
                    "snapshots": hits[:2],
                })
        except (ValueError, KeyError, TimeoutError, urllib.error.URLError, OSError):
            continue
    return result


def make_report(pending, *, inspect=inspect_with_alternates_and_hosts):
    rows = pending["records"]
    lookup = {r["id"]: r for r in rows}
    if (
        pending.get("totalSincroniaRecords") != 1454
        or pending.get("pendingAuthorRecords") != 20
        or pending.get("highConfidenceEditorialNavigationCount") != 2
        or len(lookup) != len(rows)
        or len(TARGET_IDS) != 8
        or len(set(TARGET_IDS)) != 8
        or not set(TARGET_IDS).issubset(lookup)
    ):
        raise ValueError("Pending worklist differs from approved 20-record baseline")
    with ThreadPoolExecutor(max_workers=4) as executor:
        examined = list(executor.map(inspect, (lookup[rid] for rid in TARGET_IDS)))
    return {
        "scope": "Eighth eight-work archival investigation issues 1–50",
        "inputCorpusRecords": 1454,
        "inputMissingAuthors": 20,
        "selected": len(examined),
        "sourceService": "Wayback CDX plus availability fallback",
        "originalCorpusModified": False,
        "authorAttributionAllowed": False,
        "manualVerificationRequired": True,
        "withSnapshotLeads": sum(bool(r["snapshots"]) for r in examined),
        "records": examined,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    pending = json.loads(args.input.read_text(encoding="utf-8"))
    result = make_report(pending)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_EIGHTH_EIGHT_ARCHIVE_PROBED",
          result["selected"], result["withSnapshotLeads"])


if __name__ == "__main__":
    main()

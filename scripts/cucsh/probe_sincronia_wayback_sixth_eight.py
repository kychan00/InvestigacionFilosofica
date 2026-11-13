#!/usr/bin/env python3
"""Sixth eight-work archival evidence search, read-only and fail-closed.

Investigate original signed Sincronía articles from issues 7 through 12.
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
    "cucsh:sincronia-legacy:d6ca696837c05e1b1c31",  # quiroga.htm
    "cucsh:sincronia-legacy:ebe49cf611da58c8799b",  # selum.htm
    "cucsh:sincronia-legacy:b8a6aaed44652dfc1a74",  # leonard.htm
    "cucsh:sincronia-legacy:049b6fce1737edb3c1c1",  # banuelos.htm
    "cucsh:sincronia-legacy:2e5cafc18653b60bce9f",  # clemente2.htm
    "cucsh:sincronia-legacy:498c90b4e581430b8d98",  # rhodes.htm
    "cucsh:sincronia-legacy:53c3bea7bff8e9572369",  # reyes4.htm
    "cucsh:sincronia-legacy:a3e241ad29f293bd2136",  # velasco2.htm
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
    filename = urlsplit(original).path.rsplit("/", 1)[-1]
    options = [
        "http://sincronia.cucsh.udg.mx/" + filename,
        "http://fuentes.csh.udg.mx/CUCSH/Sincronia/" + filename,
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
        or pending.get("pendingAuthorRecords") != 32
        or pending.get("highConfidenceEditorialNavigationCount") != 2
        or len(lookup) != len(rows)
        or len(TARGET_IDS) != 8
        or len(set(TARGET_IDS)) != 8
        or not set(TARGET_IDS).issubset(lookup)
    ):
        raise ValueError("Pending worklist differs from approved 32-record baseline")
    with ThreadPoolExecutor(max_workers=4) as executor:
        examined = list(executor.map(inspect, (lookup[rid] for rid in TARGET_IDS)))
    return {
        "scope": "Sixth eight-work archival investigation issues 7–12",
        "inputCorpusRecords": 1454,
        "inputMissingAuthors": 32,
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
    print("SINCRONIA_SIXTH_EIGHT_ARCHIVE_PROBED",
          result["selected"], result["withSnapshotLeads"])


if __name__ == "__main__":
    main()

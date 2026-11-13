#!/usr/bin/env python3
"""Seventh eight-work archival evidence search, read-only and fail-closed.

Investigate original signed Sincronía articles from issues 12 through 18.
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
    "cucsh:sincronia-legacy:049b6fce1737edb3c1c1",  # banuelos.htm
    "cucsh:sincronia-legacy:4b6e73e38eca426a1a58",  # wright.htm
    "cucsh:sincronia-legacy:9fef2fa92aae18191958",  # velasco3.htm
    "cucsh:sincronia-legacy:4d7e725e50959e070a37",  # Nica2.htm
    "cucsh:sincronia-legacy:d578e8ef399dde877feb",  # campos.htm
    "cucsh:sincronia-legacy:abb7dc4edba2eae4321b",  # olgamar.htm
    "cucsh:sincronia-legacy:b79324bd7275d6009db8",  # foucchin.htm
    "cucsh:sincronia-legacy:e904a85e0a828a3eb2e9",  # fressia.htm
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
        or pending.get("pendingAuthorRecords") != 27
        or pending.get("highConfidenceEditorialNavigationCount") != 2
        or len(lookup) != len(rows)
        or len(TARGET_IDS) != 8
        or len(set(TARGET_IDS)) != 8
        or not set(TARGET_IDS).issubset(lookup)
    ):
        raise ValueError("Pending worklist differs from approved 27-record baseline")
    with ThreadPoolExecutor(max_workers=4) as executor:
        examined = list(executor.map(inspect, (lookup[rid] for rid in TARGET_IDS)))
    return {
        "scope": "Seventh eight-work archival investigation issues 12–18",
        "inputCorpusRecords": 1454,
        "inputMissingAuthors": 27,
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
    print("SINCRONIA_SEVENTH_EIGHT_ARCHIVE_PROBED",
          result["selected"], result["withSnapshotLeads"])


if __name__ == "__main__":
    main()

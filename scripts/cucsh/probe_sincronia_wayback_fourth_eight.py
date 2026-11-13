#!/usr/bin/env python3
"""Fourth eight-work archival evidence search, read-only and fail-closed.

Investigate original signed Sincronía articles from issues 4 through 18.
This file does not claim or assign authors automatically. It reuses the
tested bounded Wayback inspector from the first eight-work batch.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

from scripts.cucsh.probe_sincronia_wayback_eight import inspect_entry, fetch_snapshot_excerpt
import urllib.error

TARGET_IDS = [
    "cucsh:sincronia-legacy:c620fd33bd50bf1b7558",  # formanchuk2.htm
    "cucsh:sincronia-legacy:a88181602b07562a8656",  # vevia2.htm
    "cucsh:sincronia-legacy:3d421b540a9edf11dca7",  # torres2.htm
    "cucsh:sincronia-legacy:96c37f0291421c626853",  # pires2.htm
    "cucsh:sincronia-legacy:893f1bd536cc57a90093",  # sigala.htm
    "cucsh:sincronia-legacy:d033194e9ccdac732454",  # castaned.htm
    "cucsh:sincronia-legacy:e904a85e0a828a3eb2e9",  # fressia.htm
    "cucsh:sincronia-legacy:4d7e725e50959e070a37",  # Nica2.htm
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


def make_report(pending, *, inspect=inspect_with_alternates):
    rows = pending["records"]
    lookup = {r["id"]: r for r in rows}
    if (
        pending.get("totalSincroniaRecords") != 1454
        or pending.get("pendingAuthorRecords") != 38
        or pending.get("highConfidenceEditorialNavigationCount") != 2
        or len(lookup) != len(rows)
        or len(TARGET_IDS) != 8
        or len(set(TARGET_IDS)) != 8
        or not set(TARGET_IDS).issubset(lookup)
    ):
        raise ValueError("Pending worklist differs from approved 38-record baseline")
    examined = [inspect(lookup[rid]) for rid in TARGET_IDS]
    return {
        "scope": "Fourth eight-work archival investigation issues 4–18",
        "inputCorpusRecords": 1454,
        "inputMissingAuthors": 38,
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
    print("SINCRONIA_FOURTH_EIGHT_ARCHIVE_PROBED",
          result["selected"], result["withSnapshotLeads"])


if __name__ == "__main__":
    main()

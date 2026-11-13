#!/usr/bin/env python3
"""Third eight-work archival evidence search, read-only and fail-closed.

Investigate original signed Sincronía articles from issues 11 through 18.
This file does not claim or assign authors automatically. It reuses the
tested bounded Wayback inspector from the first eight-work batch.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

from scripts.cucsh.probe_sincronia_wayback_eight import inspect_entry

TARGET_IDS = [
    "cucsh:sincronia-legacy:4084f13c0e0361cd3907",  # suarez2.htm — Ramón Iván Suárez Caamal
    "cucsh:sincronia-legacy:45e6f64e9c503606fd0d",  # arrivi.htm — Jorge Medina
    "cucsh:sincronia-legacy:78815d4ff675c1655f09",  # ecgrow.htm — Giovanni E. Reyes
    "cucsh:sincronia-legacy:a3d34239ce50b4e18aa4",  # cabeza.htm — Sahnya Shulterbrandt
    "cucsh:sincronia-legacy:b6f5b07d79cc222d68e1",  # uspr.htm — Forum Intercultura
    "cucsh:sincronia-legacy:c620fd33bd50bf1b7558",  # formanchuk2.htm — Alejandro Formanchuk
    "cucsh:sincronia-legacy:e904a85e0a828a3eb2e9",  # fressia.htm — Floriano Martins
    "cucsh:sincronia-legacy:893f1bd536cc57a90093",  # sigala.htm — Joyce
]


def make_report(pending, *, inspect=inspect_entry):
    rows = pending["records"]
    lookup = {r["id"]: r for r in rows}
    if (
        pending.get("totalSincroniaRecords") != 1454
        or pending.get("pendingAuthorRecords") != 43
        or pending.get("highConfidenceEditorialNavigationCount") != 2
        or len(lookup) != len(rows)
        or len(TARGET_IDS) != 8
        or len(set(TARGET_IDS)) != 8
        or not set(TARGET_IDS).issubset(lookup)
    ):
        raise ValueError("Pending worklist differs from approved 43-record baseline")
    examined = [inspect(lookup[rid]) for rid in TARGET_IDS]
    return {
        "scope": "Third eight-work archival investigation issues 11–18",
        "inputCorpusRecords": 1454,
        "inputMissingAuthors": 43,
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
    print("SINCRONIA_THIRD_EIGHT_ARCHIVE_PROBED",
          result["selected"], result["withSnapshotLeads"])


if __name__ == "__main__":
    main()

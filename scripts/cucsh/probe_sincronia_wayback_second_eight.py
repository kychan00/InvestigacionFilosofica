#!/usr/bin/env python3
"""Second eight-work archival evidence search, read-only and fail-closed.

Investigate original signed Sincronía articles from issues 5 through 13.
This file does not claim or assign authors automatically. It reuses the
tested bounded Wayback inspector from the first eight-work batch.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

from scripts.cucsh.probe_sincronia_wayback_eight import inspect_entry

TARGET_IDS = [
    "cucsh:sincronia-legacy:4869f07f890d2997ddb1",  # Revueltas, Durán
    "cucsh:sincronia-legacy:47f368eb8611d2cb666e",  # W.B. Yeats
    "cucsh:sincronia-legacy:e69ddb50657568d3613a",  # Old stones Oaxaca
    "cucsh:sincronia-legacy:092c265452a009c0ddf5",  # Borges occult
    "cucsh:sincronia-legacy:893f1bd536cc57a90093",  # Joyce Ulysses
    "cucsh:sincronia-legacy:a88181602b07562a8656",  # Fernando Vevia number 12
    "cucsh:sincronia-legacy:3d421b540a9edf11dca7",  # Andres F. Torres no.13
    "cucsh:sincronia-legacy:96c37f0291421c626853",  # João Pires number13
]


def make_report(pending, *, inspect=inspect_entry):
    rows = pending["records"]
    lookup = {r["id"]: r for r in rows}
    if (
        pending.get("totalSincroniaRecords") != 1454
        or pending.get("pendingAuthorRecords") != 47
        or pending.get("highConfidenceEditorialNavigationCount") != 2
        or len(lookup) != len(rows)
        or len(TARGET_IDS) != 8
        or len(set(TARGET_IDS)) != 8
        or not set(TARGET_IDS).issubset(lookup)
    ):
        raise ValueError("Pending worklist differs from approved 47-record baseline")
    examined = [inspect(lookup[rid]) for rid in TARGET_IDS]
    return {
        "scope": "Second eight-work archival investigation issues 5–13",
        "inputCorpusRecords": 1454,
        "inputMissingAuthors": 47,
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
    print("SINCRONIA_SECOND_EIGHT_ARCHIVE_PROBED",
          result["selected"], result["withSnapshotLeads"])


if __name__ == "__main__":
    main()

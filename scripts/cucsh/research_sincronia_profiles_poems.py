#!/usr/bin/env python3
"""Inspect six Bolivian author profiles and two Dante Medina archive pages.

Last unsigned scholarly work count is smaller than the headline count: many
issue-7 index entries are biography/interview subject pages. This evidence-
only probe must not set authors based on profile subject or directory name.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path

from scripts.cucsh.research_sincronia_last_eight_primary import inspect

TARGET_IDS = [
    "cucsh:sincronia-legacy:4b66525607125c9d8c80",  # Yolanda Bedregal
    "cucsh:sincronia-legacy:503927fb46aa32462439",  # Elsa Dorado de Revilla
    "cucsh:sincronia-legacy:8fc5dab0bf280ad85a8d",  # Velia Calvimontes
    "cucsh:sincronia-legacy:b25bfab1ecca1cdd248e",  # Mery Flores
    "cucsh:sincronia-legacy:d6ca696837c05e1b1c31",  # Rosario Quiroga
    "cucsh:sincronia-legacy:ebe49cf611da58c8799b",  # Roxana Sélum
    "cucsh:sincronia-legacy:4800ef829bfca4e699cb",  # Atreverse
    "cucsh:sincronia-legacy:582537d89e07194c5970",  # Hypertextualizado
]


def make_report(pending, *, probe=inspect):
    rows = pending["records"]
    lookup = {r["id"]: r for r in rows}
    if (
        pending.get("totalSincroniaRecords") != 1454
        or pending.get("pendingAuthorRecords") != 12
        or pending.get("highConfidenceEditorialNavigationCount") != 2
        or len(rows) != len(lookup)
        or len(TARGET_IDS) != 8
        or len(set(TARGET_IDS)) != 8
        or not set(TARGET_IDS).issubset(lookup)
    ):
        raise ValueError("Source queue changed; inspect fresh missing-author audit")
    with ThreadPoolExecutor(max_workers=4) as pool:
        reports = list(pool.map(probe, (lookup[rid] for rid in TARGET_IDS)))
    return {
        "scope": "Six original Bolivian literary profiles and two Dante archive texts",
        "inputSincroniaCount": 1454,
        "inputMissingAuthors": 12,
        "selectionCount": 8,
        "metadataMutation": False,
        "automaticAuthorAssignment": False,
        "classificationWarning": (
            "Subject names in biographical profiles are not work bylines. "
            "Issue 7's signed Kathy Leonard introduction to six Bolivian "
            "interviews does not, by itself, prove each profile's author. "
            "Likewise, a Dante directory path is not a printed signature."
        ),
        "records": reports,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    audit = json.loads(args.input.read_text(encoding="utf-8"))
    report = make_report(audit)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_PROFILES_POEMS_EIGHT_SOURCE_REVIEW",
          report["selectionCount"], "metadata_unchanged")


if __name__ == "__main__":
    main()

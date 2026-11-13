#!/usr/bin/env python3
"""Build a reproducible Sincronía release CANDIDATE, never publish it.

Historical 1-51: prior GitHub Actions run 42961992150 + verified issue 49.
Historical 52-60: fresh targeted Dialnet exemplars.
Modern 61-90: OJS issue archive reconciled against OAI-PMH article IDs.
Other CUCSH journals remain byte-for-byte-equivalent records from the
committed baseline; this preview is not a production release.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from scripts.cucsh.harvest import SOURCES, harvest_source, serialize_dataset
from scripts.cucsh.sincronia_dialnet import (
    build_record,
    harvest_dialnet_records,
    verified_issue_payload,
)
from scripts.cucsh.sincronia_legacy import merge_historical_records


def compose_candidate(baseline, historical_evidence, mid_records, modern_records):
    previous = baseline.get("records")
    historical = historical_evidence.get("records")
    if not isinstance(previous, list) or not isinstance(historical, list):
        raise ValueError("Invalid baseline or historical evidence format")

    original_numbers = {
        row.get("issueNumber") for row in historical
        if isinstance(row.get("issueNumber"), int)
    }
    expected_original = set(range(1, 52)) - {49}
    if original_numbers != expected_original:
        raise ValueError(
            f"Previous historical evidence does not cover 1-51 except 49: "
            f"missing={sorted(expected_original - original_numbers)} "
            f"unexpected={sorted(original_numbers - expected_original)}"
        )

    issue49 = verified_issue_payload(49)
    if issue49 is None or len(issue49[1]) != 21:
        raise ValueError("Verified Dialnet issue 49 evidence is incomplete")
    issue49_rows = [build_record(article, issue49[0]) for article in issue49[1]]

    historical_merged = merge_historical_records(
        historical, issue49_rows, mid_records,
    )
    historical_numbers = {
        row.get("issueNumber") for row in historical_merged
        if isinstance(row.get("issueNumber"), int)
    }
    if historical_numbers != set(range(1, 61)):
        raise ValueError(
            f"Historical coverage incomplete: "
            f"{sorted(set(range(1, 61)) - historical_numbers)}"
        )

    modern_numbers = {
        row.get("issueNumber") for row in modern_records
        if isinstance(row.get("issueNumber"), int)
    }
    if modern_numbers != set(range(61, 91)):
        raise ValueError(
            f"OJS 61-90 coverage incomplete: "
            f"{sorted(set(range(61, 91)) - modern_numbers)}"
        )

    preserved_other_journals = [
        row for row in previous if row.get("journal") != "Sincronía"
    ]
    merged = [
        *preserved_other_journals,
        *historical_merged,
        *modern_records,
    ]
    merged.sort(
        key=lambda row: (
            row.get("journal") or "",
            row.get("year") or 0,
            row.get("doi") or "",
            row.get("sourceId") or "",
        )
    )
    candidate = {
        "schemaVersion": baseline.get("schemaVersion", 1),
        "provider": baseline.get("provider", "CUCSH Filosofía"),
        "records": merged,
    }
    counts = Counter(
        row.get("issueNumber")
        for row in merged
        if row.get("journal") == "Sincronía"
        and isinstance(row.get("issueNumber"), int)
    )
    report = {
        "status": "candidate_only_not_published",
        "historicalEvidenceRun": 42961992150,
        "historicalIssue49": "Dialnet 251060",
        "modernSource": "Sincronía OJS/OAI-PMH",
        "modernOjsReconciled": True,
        "previousOtherJournals": len(preserved_other_journals),
        "historicalUniqueRecords": len(historical_merged),
        "modernUniqueRecords": len(modern_records),
        "sincroniaUniqueRecords": len(historical_merged) + len(modern_records),
        "allRecords": len(merged),
        "issues": sorted(counts),
        "recordsByIssue": {
            str(number): count for number, count in sorted(counts.items())
        },
    }
    return candidate, report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--historical-evidence", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    baseline = json.loads(args.before.read_text(encoding="utf-8"))
    historical_evidence = json.loads(
        args.historical_evidence.read_text(encoding="utf-8")
    )

    mid_records, mid_issues = harvest_dialnet_records(
        max_issue=60, target_issues=set(range(52, 61)),
    )
    if set(mid_issues) != set(range(52, 61)):
        raise RuntimeError(f"Middle historical issues missing: {mid_issues}")

    source = next(source for source in SOURCES if source["id"] == "sincronia")
    modern_source = dict(source, legacyArchives=[])
    modern_records, deleted, excluded = harvest_source(modern_source)
    candidate, report = compose_candidate(
        baseline, historical_evidence, mid_records, modern_records,
    )
    report["ojsDeleted"] = deleted
    report["ojsExcluded"] = excluded
    args.candidate.write_text(
        serialize_dataset(candidate), encoding="utf-8",
    )
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_CANDIDATE_REPORT", json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Stage six individually checked original-journal Sincronía author bylines.

Sources: title-adjacent bylines independently inspected in the original
article pages (GitHub Actions 43030567727). Areta and Park also appear in
independent bibliographic records. This is a fixed, auditable backfill,
NOT a rule accepting heuristic person strings or institutional affiliations.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from scripts.cucsh.harvest import serialize_dataset

SOURCE_EVIDENCE_RUN = 43030567727
VERIFIED_AUTHORS = {
    "cucsh:sincronia-legacy:d87fca538fca959b356c": (3, "Theoretical Approaches to Ethnic Identity", "Helen Galkina"),
    "cucsh:sincronia-legacy:9eb03bcd8db8d0803e66": (3, "Critiques of Nationalism and Contemporary Chicano Literature", "Marcial Gonzalez"),
    "cucsh:sincronia-legacy:aa16ce21a65b199eb95a": (6, "Imaginary and Antirationalism in Social Sciences", "Gilbert Larochelle"),
    "cucsh:sincronia-legacy:bcc38b21c378dad5aee1": (6, "Modern Death Dances: The Irreverent Politics of Postmodernism", "Antonio L Rappa"),
    "cucsh:sincronia-legacy:31be1ee11d7c27a5d41c": (47, "Claves de Ajuar funerario", "José María Areta"),
    "cucsh:sincronia-legacy:78588882c93ad39b23dd": (50, "La p", "Kyeong-Eun Park"),
}


def apply_verified_authors(dataset):
    rows = dataset.get("records")
    if not isinstance(rows, list):
        raise ValueError("Invalid CUCSH snapshot: missing records list")
    by_id = {row.get("id"): row for row in rows}
    if len(by_id) != len(rows):
        raise ValueError("Duplicate identifiers in CUCSH snapshot")
    missing = sorted(set(VERIFIED_AUTHORS) - set(by_id))
    if missing:
        raise ValueError("Verified historical IDs missing: " + str(missing))

    changed = []
    out = dict(dataset)
    out["records"] = []
    for row in rows:
        identifier = row.get("id")
        if identifier not in VERIFIED_AUTHORS:
            out["records"].append(row)
            continue

        issue, expected_title, author = VERIFIED_AUTHORS[identifier]
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != issue
            or not row.get("legacyOriginal")
            or expected_title.casefold() not in (row.get("title") or "").casefold()
        ):
            raise ValueError("Verified author metadata not aligned with original: " + identifier)

        expected = [{"name": author, "sourceName": author}]
        current_authors = row.get("authors") or []
        if current_authors:
            if current_authors != expected:
                raise ValueError("Refusing to replace conflicting authors: " + identifier)
            out["records"].append(row)
            continue

        updated = dict(row)
        updated["authors"] = expected
        updated["legacyAuthorEvidence"] = {
            "kind": "original-article-title-adjacent-byline",
            "auditRunId": SOURCE_EVIDENCE_RUN,
            "sourceUrl": (row.get("urls") or {}).get("canonical"),
            "verifiedAuthor": author,
        }
        out["records"].append(updated)
        changed.append({
            "id": identifier, "issue": issue,
            "title": row["title"], "author": author,
            "sourceUrl": updated["legacyAuthorEvidence"]["sourceUrl"],
        })

    report = {
        "status": "ready" if len(changed) in (0, len(VERIFIED_AUTHORS)) else "partial",
        "oldRecords": len(rows),
        "newRecords": len(out["records"]),
        "changedAuthors": changed,
        "previouslyVerifiedAlreadyPresent": len(VERIFIED_AUTHORS) - len(changed),
        "evidenceRun": SOURCE_EVIDENCE_RUN,
    }
    if report["status"] == "partial":
        raise ValueError("Unexpected partial author enrichment; review manually")
    return out, report


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--before", type=Path, required=True)
    p.add_argument("--after", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    args = p.parse_args()
    original = json.loads(args.before.read_text(encoding="utf-8"))
    updated, report = apply_verified_authors(original)
    args.after.write_text(serialize_dataset(updated), encoding="utf-8")
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_AUTHORS_ENRICHED", json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()

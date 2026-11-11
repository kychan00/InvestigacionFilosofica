#!/usr/bin/env python3
"""Apply only 41 archived-index-verified Sincronía title encoding repairs.

Evidence: source index audit 43032349081; a source URL and >=0.86
original-title similarity are both required. All other records stay
untouched. Article IDs, issue numbers, authors, abstracts, and URLs
never change in this step.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from scripts.cucsh.harvest import serialize_dataset
from scripts.cucsh.propose_sincronia_title_repairs import canonical_path

EVIDENCE_RUN = 43032349081
EXPECTED_VERIFIED_TITLES = 41


def apply_verified_title_proposals(snapshot, evidence, expected_count=EXPECTED_VERIFIED_TITLES):
    rows = snapshot.get("records")
    proposals = evidence.get("proposals")
    if not isinstance(rows, list) or not isinstance(proposals, list):
        raise ValueError("Invalid snapshot or source evidence")
    approved = [p for p in proposals if p.get("status") == "strong_index_match"]
    if len(approved) != expected_count:
        raise ValueError(
            f"Approved title count changed: {len(approved)} vs {expected_count}"
        )
    by_id = {p.get("id"): p for p in approved}
    if len(by_id) != len(approved):
        raise ValueError("Duplicate approved record identifiers")

    staged = []
    seen = set()
    modified = []
    for row in rows:
        p = by_id.get(row.get("id"))
        if not p:
            staged.append(row)
            continue
        identifier = row["id"]
        seen.add(identifier)
        src_url = (row.get("urls") or {}).get("canonical")
        if (
            row.get("journal") != "Sincronía"
            or not row.get("legacyOriginal")
            or row.get("issueNumber") != p.get("issue")
            or not src_url
            or src_url != p.get("sourceUrl")
            or not canonical_path(p.get("sourceIndexLinkUrl"))
            or canonical_path(src_url) != canonical_path(p["sourceIndexLinkUrl"])
            or not isinstance(p.get("similarity"), (int, float))
            or p["similarity"] < 0.86
            or "\ufffd" in p.get("proposedTitle", "")
        ):
            raise ValueError(f"Source validation failed for {identifier}")

        old_title = p.get("titleBefore")
        new_title = p.get("proposedTitle")
        if not old_title or not new_title or old_title == new_title:
            raise ValueError(f"Not a genuine encoding repair: {identifier}")

        if row.get("title") == new_title:
            if row.get("legacyTitleEncodingEvidence", {}).get("auditRunId") != EVIDENCE_RUN:
                raise ValueError(f"Untraced prior title edit: {identifier}")
            staged.append(row)
            continue
        if row.get("title") != old_title:
            raise ValueError(f"Title differs from audited evidence: {identifier}")

        updated = dict(row)
        updated["title"] = new_title
        variants = updated.get("titleVariants")
        if isinstance(variants, list):
            updated["titleVariants"] = [
                new_title if value == old_title else value for value in variants
            ]
        updated["legacyTitleEncodingEvidence"] = {
            "kind": "original-issue-index-article-url-and-title",
            "auditRunId": EVIDENCE_RUN,
            "sourceIndexUrl": p["sourceIndexLinkUrl"],
            "previousTitle": old_title,
            "similarity": p["similarity"],
        }
        staged.append(updated)
        modified.append({
            "id": identifier, "issue": p["issue"],
            "titleBefore": old_title, "titleAfter": new_title,
        })

    if seen != set(by_id):
        raise ValueError(f"Missing evidence identifiers: {sorted(set(by_id) - seen)}")
    if len(modified) not in (0, expected_count):
        raise ValueError(
            "Partial application forbidden; preserve snapshot until reviewed"
        )

    updated_snapshot = dict(snapshot, records=staged)
    return updated_snapshot, {
        "evidenceRunId": EVIDENCE_RUN,
        "verifiedTitles": len(approved),
        "changed": len(modified),
        "beforeCount": len(rows),
        "afterCount": len(staged),
        "changes": modified,
        "stillUnverified": len(proposals) - len(approved),
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--before", type=Path, required=True)
    p.add_argument("--evidence", type=Path, required=True)
    p.add_argument("--after", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    args = p.parse_args()
    snapshot = json.loads(args.before.read_text(encoding="utf-8"))
    evidence = json.loads(args.evidence.read_text(encoding="utf-8"))
    updated, report = apply_verified_title_proposals(snapshot, evidence)
    args.after.write_text(serialize_dataset(updated), encoding="utf-8")
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_TITLE_REPAIR", json.dumps({
        k: report[k] for k in
        ("evidenceRunId", "verifiedTitles", "changed",
         "beforeCount", "afterCount", "stillUnverified")
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

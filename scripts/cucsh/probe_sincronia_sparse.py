#!/usr/bin/env python3
"""Compare sparse Sincronía issues with Dialnet; never mutate the corpus."""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

from scripts.cucsh.audit_sincronia_historical import normalized_title
from scripts.cucsh.sincronia_dialnet import harvest_dialnet_records, KNOWN_ISSUE_URLS

SPARSE_ISSUES = (29, 31, 33, 34, 44, 55)
DIALNET_ARTICLE_ID = re.compile(r"(?:[?&]codigo=|dialnet:)(\d+)")


def dialnet_code(row):
    source = str(row.get("sourceId") or "")
    url = str((row.get("urls") or {}).get("canonical") or "")
    match = DIALNET_ARTICLE_ID.search(source) or DIALNET_ARTICLE_ID.search(url)
    return match.group(1) if match else None


def compare_catalogue(snapshot, catalogue, requested=SPARSE_ISSUES):
    old = defaultdict(list)
    new = defaultdict(list)
    for row in snapshot:
        if row.get("journal") == "Sincronía" and row.get("issueNumber") in requested:
            old[row["issueNumber"]].append(row)
    for row in catalogue:
        if row.get("issueNumber") in requested:
            new[row["issueNumber"]].append(row)

    result = []
    for issue in requested:
        current, external = old[issue], new[issue]
        current_codes = {code for r in current if (code := dialnet_code(r))}
        current_titles = {normalized_title(r.get("title")) for r in current}
        missing = []
        for r in external:
            title = normalized_title(r.get("title"))
            code = dialnet_code(r)
            if (code and code in current_codes) or title in current_titles:
                continue
            nearest = max(
                (
                    {
                        "title": c.get("title"),
                        "similarity": round(SequenceMatcher(
                            None, title, normalized_title(c.get("title"))
                        ).ratio(), 3),
                    }
                    for c in current
                ),
                key=lambda x: x["similarity"],
                default=None,
            )
            missing.append({
                "dialnetCode": code,
                "title": r.get("title"),
                "url": (r.get("urls") or {}).get("canonical"),
                "authors": [a.get("name") for a in (r.get("authors") or [])],
                "nearestLocalTitle": nearest,
            })

        result.append({
            "issue": issue,
            "catalogueUrl": KNOWN_ISSUE_URLS.get(issue),
            "snapshotArticles": len(current),
            "catalogueArticles": len(external),
            "notMatchedByIdOrExactNormalizedTitle": len(missing),
            "potentialMissing": missing,
            "finding": (
                "source_unavailable" if not external else
                "possible_gaps" if missing else "matched_catalogue"
            ),
        })
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    source = json.loads(args.input.read_text(encoding="utf-8"))["records"]
    external, covered = harvest_dialnet_records(
        max_issue=60, target_issues=set(SPARSE_ISSUES),
    )
    comparison = compare_catalogue(source, external)
    report = {
        "audit": "Sincronía sparse historical issues vs Dialnet",
        "issuesRequested": list(SPARSE_ISSUES),
        "issuesWithSourceResponse": list(covered),
        "findings": comparison,
        "policy": (
            "Potential differences do not automatically authorize insertion. "
            "Verify each title, issue, duplicate, and source provenance."
        ),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for x in comparison:
        print(
            "SPARSE_ISSUE",
            f"number={x['issue']}",
            f"snapshot={x['snapshotArticles']}",
            f"dialnet={x['catalogueArticles']}",
            f"possible_missing={x['notMatchedByIdOrExactNormalizedTitle']}",
            f"finding={x['finding']}",
        )
        for item in x["potentialMissing"][:15]:
            print("POTENTIAL_MISSING", x["issue"], json.dumps(item, ensure_ascii=False))
    if set(covered) != set(SPARSE_ISSUES):
        raise SystemExit(
            "Missing source responses: " + str(sorted(set(SPARSE_ISSUES) - set(covered)))
        )


if __name__ == "__main__":
    main()

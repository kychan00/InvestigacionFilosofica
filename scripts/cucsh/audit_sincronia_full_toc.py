#!/usr/bin/env python3
"""Article-level Dialnet TOC audit for all mapped historical Sincronía issues.

Read-only by design. Compare all 43 mapped exemplars (17 and 19–60) against
the candidate snapshot. A title-only or fuzzy match is a human-review lead,
not certified duplicate elimination. Unavailable exemplars remain unknown.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

from scripts.cucsh.audit_sincronia_historical import normalized_title
from scripts.cucsh.probe_sincronia_sparse import dialnet_code
from scripts.cucsh.sincronia_dialnet import KNOWN_ISSUE_URLS, harvest_dialnet_records


def compare_full_issues(snapshot, catalogue, issues):
    local_groups, external_groups = defaultdict(list), defaultdict(list)
    local_codes = defaultdict(set)
    for record in snapshot:
        if record.get("journal") != "Sincronía":
            continue
        issue = record.get("issueNumber")
        if issue not in issues:
            continue
        local_groups[issue].append(record)
        if (code := dialnet_code(record)):
            local_codes[issue].add(code)
    for record in catalogue:
        if record.get("issueNumber") in issues:
            external_groups[record["issueNumber"]].append(record)

    detail = []
    for issue in issues:
        local, external = local_groups[issue], external_groups[issue]
        counter = Counter()
        findings = []
        for candidate in external:
            code = dialnet_code(candidate)
            title_key = normalized_title(candidate.get("title"))
            if code and code in local_codes[issue]:
                counter["exact_id"] += 1
                continue
            exact_titles = [
                record for record in local
                if title_key and normalized_title(record.get("title")) == title_key
            ]
            if exact_titles:
                counter["title_only"] += 1
                findings.append({
                    "type": "title_only_needs_duplicate_verification",
                    "dialnetCode": code, "title": candidate.get("title"),
                    "url": (candidate.get("urls") or {}).get("canonical"),
                    "localIds": [r.get("id") for r in exact_titles],
                    "localTitles": [r.get("title") for r in exact_titles],
                    "authors": [a.get("name") for a in candidate.get("authors") or []],
                })
                continue
            scores = [{
                "id": item.get("id"), "title": item.get("title"),
                "score": round(SequenceMatcher(
                    None,
                    title_key,
                    normalized_title(item.get("title")),
                ).ratio(), 4),
            } for item in local]
            closest = max(scores, key=lambda x: x["score"], default=None)
            if closest and closest["score"] >= .94:
                counter["possible_title_variant"] += 1
                kind = "possible_title_variant"
            else:
                counter["possible_missing"] += 1
                kind = "possible_missing_article"
            findings.append({
                "type": kind,
                "dialnetCode": code, "title": candidate.get("title"),
                "url": (candidate.get("urls") or {}).get("canonical"),
                "authors": [a.get("name") for a in candidate.get("authors") or []],
                "closestLocal": closest,
            })
        detail.append({
            "issue": issue,
            "dialnetIssueUrl": KNOWN_ISSUE_URLS[issue],
            "localArticles": len(local),
            "dialnetArticles": len(external) if external else None,
            "exactIdMatches": counter["exact_id"],
            "titleOnlyReview": counter["title_only"],
            "possibleTitleVariants": counter["possible_title_variant"],
            "possibleMissingArticles": counter["possible_missing"],
            "sourceAvailable": bool(external),
            "status": (
                "source_unavailable" if not external
                else "requires_review" if findings
                else "all_dialnet_articles_matched_by_id"
            ),
            "findings": findings,
        })
    return detail


def create_report(snapshot, external, issues):
    detail = compare_full_issues(snapshot, external, issues)
    available = [entry for entry in detail if entry["sourceAvailable"]]
    missing = [entry for entry in detail if not entry["sourceAvailable"]]
    totals = {
        "issuesRequested": len(issues),
        "issuesWithSource": len(available),
        "issuesUnavailable": len(missing),
        "sourceArticleRows": sum(entry["dialnetArticles"] or 0 for entry in detail),
        "idMatched": sum(entry["exactIdMatches"] for entry in detail),
        "titleOnlyNeedsReview": sum(entry["titleOnlyReview"] for entry in detail),
        "possibleVariants": sum(entry["possibleTitleVariants"] for entry in detail),
        "possibleMissing": sum(entry["possibleMissingArticles"] for entry in detail),
    }
    return {
        "scope": "Sincronía · all mapped historical Dialnet issue TOCs",
        "status": (
            "partial_source_unavailable" if missing
            else "requires_article_review"
            if totals["possibleMissing"] or totals["possibleVariants"] or totals["titleOnlyNeedsReview"]
            else "matched_source"
        ),
        "issues": detail,
        "totals": totals,
        "missingIssueNumbers": [entry["issue"] for entry in missing],
        "policy": (
            "No automated article insertion or deletion. "
            "Matching a title alone does not prove the same article identity. "
            "All potential omissions need source verification before backfill. "
            "Unavailable sources must not be described as complete."
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    snapshot = json.loads(args.input.read_text(encoding="utf-8"))["records"]
    issues = sorted(KNOWN_ISSUE_URLS)
    print("SINCRONIA_FULL_TOC_ISSUES", issues, flush=True)
    external, covered = harvest_dialnet_records(
        max_issue=60, target_issues=set(issues),
    )
    report = create_report(snapshot, external, issues)
    report["sourceRespondedIssues"] = covered
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_FULL_TOC_SUMMARY", json.dumps({
        "status": report["status"], **report["totals"],
    }, ensure_ascii=False), flush=True)
    for row in report["issues"]:
        print(
            "SINCRONIA_FULL_TOC_ISSUE", f"number={row['issue']}",
            f"local={row['localArticles']}",
            f"source={row['dialnetArticles']}",
            f"confirmed_id={row['exactIdMatches']}",
            f"title_only={row['titleOnlyReview']}",
            f"variants={row['possibleTitleVariants']}",
            f"possible_missing={row['possibleMissingArticles']}",
            f"status={row['status']}", flush=True,
        )
        for entry in row["findings"]:
            if entry["type"] == "possible_missing_article":
                print("SINCRONIA_POSSIBLE_MISSING", json.dumps({
                    "issue": row["issue"], **entry
                }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()

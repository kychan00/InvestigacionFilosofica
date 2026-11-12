#!/usr/bin/env python3
"""Read-only article identity audit of Sincronía issues 46, 47, 48 and 50.

Issue 46 contains navigation links incorrectly indexed among author-name
article labels. The audit must not delete, backfill, or change any article.
Compare Dialnet TOCs with the historical snapshot and provide a source-linked
one-to-one review plan. Unavailable exemplars never imply completeness.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

from scripts.cucsh.audit_sincronia_historical import normalized_title
from scripts.cucsh.probe_sincronia_sparse import dialnet_code
from scripts.cucsh.reconstruct_sincronia_issue17 import score_legacy_label
from scripts.cucsh.sincronia_dialnet import KNOWN_ISSUE_URLS, harvest_dialnet_records

ISSUES = (46, 47, 48, 50)
# Recognised issue-46 navigation destinations; they must be reviewed and not
# silently counted as scholarly articles or deleted in this read-only action.
KNOWN_NAVIGATION = {
    ("46", "creditos.html"): "editorial board / journal credits",
    ("46", "info.htm"): "instructions for contributors",
}


def source_identity(row):
    return (row.get("urls") or {}).get("canonical") or ""


def navigation_hint(row):
    issue = str(row.get("issueNumber") or "")
    stem = urlparse(source_identity(row)).path.rsplit("/", 1)[-1].casefold()
    return KNOWN_NAVIGATION.get((issue, stem))


def build_candidates(local, catalogue):
    local_title = normalized_title(local.get("title"))
    direct_id = dialnet_code(local)
    options = []
    for source in catalogue:
        title = normalized_title(source.get("title"))
        if direct_id and direct_id == dialnet_code(source):
            options.append({"source": source, "kind": "exact_dialnet_article_id",
                            "confidence": 1.0})
            continue
        if len(title) >= 12 and local_title == title:
            options.append({"source": source, "kind": "exact_normalized_title",
                            "confidence": 1.0})
            continue
        if local.get("authors"):
            continue
        author_name_score = score_legacy_label(
            local.get("title"), source.get("authors") or []
        )
        if author_name_score >= .8:
            options.append({"source": source,
                            "kind": "index_author_label_to_article",
                            "confidence": author_name_score})
    return sorted(options, key=lambda x: (
        x["kind"] == "exact_dialnet_article_id",
        x["kind"] == "exact_normalized_title",
        x["confidence"],
    ), reverse=True)


def source_summary(row):
    return {
        "sourceId": row.get("sourceId"),
        "title": row.get("title"),
        "authors": [
            author.get("name") if isinstance(author, dict) else str(author)
            for author in (row.get("authors") or [])
        ],
        "url": source_identity(row),
    }


def audit_issue(snapshot, catalogue, issue, source_available):
    local = [
        row for row in snapshot
        if row.get("journal") == "Sincronía" and row.get("issueNumber") == issue
    ]
    external = [
        row for row in catalogue
        if row.get("journal") == "Sincronía" and row.get("issueNumber") == issue
    ] if source_available else []
    if not source_available or not external:
        return {
            "issue": issue,
            "issueUrl": KNOWN_ISSUE_URLS[issue],
            "status": "source_unavailable",
            "localCount": len(local),
            "dialnetCount": None,
            "articleMatches": [],
            "localUnresolved": [],
            "sourceUnmatched": [],
            "navigationReview": [
                {"localId": row["id"], "label": row.get("title"),
                 "url": source_identity(row), "reason": hint}
                for row in local if (hint := navigation_hint(row))
            ],
            "counts": {},
        }
    rows, matched = [], defaultdict(list)
    navigation = []
    for row in local:
        hint = navigation_hint(row)
        if hint:
            navigation.append({
                "localId": row.get("id"), "label": row.get("title"),
                "url": source_identity(row), "reason": hint,
            })
            continue
        options = build_candidates(row, external)
        label = row.get("title")
        info = {
            "localId": row.get("id"),
            "localTitle": label,
            "localUrl": source_identity(row),
            "localAuthors": source_summary(row)["authors"],
        }
        if not options:
            rows.append({**info, "status": "no_unique_source_match",
                         "candidate": None})
            continue
        best = options[0]
        competing = options[1:]
        if competing and (
            competing[0]["confidence"] == best["confidence"]
            or best["confidence"] - competing[0]["confidence"] < .17
        ):
            rows.append({
                **info, "status": "ambiguous_source_match",
                "candidates": [
                    {**source_summary(o["source"]), "confidence": o["confidence"],
                     "method": o["kind"]} for o in options[:5]
                ],
            })
            continue
        choice = best["source"]
        code = choice.get("sourceId")
        state = (
            "title_and_author_identity_confirmed"
            if best["kind"] == "exact_dialnet_article_id"
            else "original_title_matched"
            if best["kind"] == "exact_normalized_title"
            else "author_label_needs_title_reconstruction"
        )
        entry = {
            **info, "status": state, "source": source_summary(choice),
            "method": best["kind"], "confidence": best["confidence"],
        }
        rows.append(entry)
        matched[code].append(len(rows) - 1)

    # A source article may not be assigned to two local records, even if
    # both labels happen to be identical or share a common author's name.
    for code, indices in matched.items():
        if len(indices) > 1:
            for index in indices:
                rows[index]["status"] = "conflicting_local_assignments"
                rows[index]["conflictingLocalIds"] = [
                    rows[i]["localId"] for i in indices
                ]
    certified = {
        row["source"]["sourceId"] for row in rows
        if row["status"] in {
            "title_and_author_identity_confirmed",
            "original_title_matched",
            "author_label_needs_title_reconstruction",
        }
    }
    missing = [
        source_summary(row)
        for row in external
        if row.get("sourceId") not in certified
    ]
    status_count = Counter(row["status"] for row in rows)
    return {
        "issue": issue,
        "issueUrl": KNOWN_ISSUE_URLS[issue],
        "status": (
            "needs_review" if missing or navigation or any(
                row["status"] not in {
                    "title_and_author_identity_confirmed",
                    "original_title_matched",
                } for row in rows
            ) else "all_sources_matched"
        ),
        "localCount": len(local),
        "dialnetCount": len(external),
        "matchedCount": len(certified),
        "articleMatches": [
            row for row in rows if row.get("status") in {
                "title_and_author_identity_confirmed",
                "original_title_matched",
                "author_label_needs_title_reconstruction",
            }
        ],
        "localUnresolved": [
            row for row in rows if row.get("status") in {
                "no_unique_source_match", "ambiguous_source_match",
                "conflicting_local_assignments",
            }
        ],
        "sourceUnmatched": missing,
        "navigationReview": navigation,
        "counts": dict(sorted(status_count.items())),
    }


def build_report(snapshot, catalogue, covered):
    covered_set = set(covered)
    results = [
        audit_issue(snapshot, catalogue, issue, issue in covered_set)
        for issue in ISSUES
    ]
    return {
        "name": "Sincronía historical issue 46/47/48/50 article identity review",
        "issuesRequested": list(ISSUES),
        "issuesRetrieved": sorted(covered_set & set(ISSUES)),
        "issuesUnavailable": [i for i in ISSUES if i not in covered_set],
        "status": "partial_source_unavailable"
                  if set(ISSUES) - covered_set else "review_ready",
        "issues": results,
        "totals": {
            "localRecords": sum(x["localCount"] for x in results),
            "sourceRecords": sum(x["dialnetCount"] or 0 for x in results),
            "navigationCandidates": sum(len(x["navigationReview"]) for x in results),
            "authorLabelCandidates": sum(x["counts"].get(
                "author_label_needs_title_reconstruction", 0
            ) for x in results),
            "unmatchedSource": sum(len(x["sourceUnmatched"]) for x in results),
            "unmatchedLocal": sum(len(x["localUnresolved"]) for x in results),
        },
        "policy": (
            "Read-only. Article identity is one-to-one and source-linked. "
            "Navigation candidates are marked for review, never automatically "
            "deleted. A nonresponse never counts as complete."
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.input.read_text(encoding="utf-8"))
    rows = source["records"]
    if not isinstance(rows, list) or len({r.get("id") for r in rows}) != len(rows):
        raise ValueError("Historical source snapshot lacks unique records")
    print("SINCRONIA_TARGETED_IDENTITY_ISSUES", list(ISSUES), flush=True)
    try:
        catalogue, covered = harvest_dialnet_records(
            max_issue=60, target_issues=set(ISSUES)
        )
    except Exception as exc:
        print("SINCRONIA_DIALNET_UNAVAILABLE", repr(exc), flush=True)
        catalogue, covered = [], []
    report = build_report(rows, catalogue, covered)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_TARGETED_IDENTITY_SUMMARY",
          json.dumps({"status": report["status"],
                      **report["totals"],
                      "available": report["issuesRetrieved"],
                      "unavailable": report["issuesUnavailable"]},
                     ensure_ascii=False), flush=True)
    for item in report["issues"]:
        print("SINCRONIA_TARGETED_ISSUE",
              json.dumps({
                  "issue": item["issue"], "status": item["status"],
                  "local": item["localCount"],
                  "source": item["dialnetCount"],
                  "navigation": len(item["navigationReview"]),
                  "suggestedAuthorLabelRepairs": item["counts"].get(
                      "author_label_needs_title_reconstruction", 0),
                  "unmatchedSource": len(item["sourceUnmatched"]),
                  "unmatchedLocal": len(item["localUnresolved"]),
              }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()

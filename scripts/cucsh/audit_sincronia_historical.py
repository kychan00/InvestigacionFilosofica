#!/usr/bin/env python3
"""Evidence-aware, offline audit of Sincronía historical metadata (issues 1–60).

A numbered issue with one record is NOT proof of article-level completeness.
This audit distinguishes objective data-integrity errors from metadata gaps
and low-volume issues requiring independent source-by-source review.
"""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path


def normalized_title(value):
    text = unicodedata.normalize("NFKD", str(value or "").casefold())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", text))


def historical_audit(records):
    historical = [
        r for r in records
        if r.get("journal") == "Sincronía"
        and isinstance(r.get("issueNumber"), int)
        and 1 <= r["issueNumber"] <= 60
    ]
    groups = defaultdict(list)
    for row in historical:
        groups[row["issueNumber"]].append(row)

    errors, review = [], []
    seen_ids, seen_urls = {}, {}
    provenance = Counter()
    issue_stats = []
    encoding_alerts = []

    for row in historical:
        issue = row["issueNumber"]
        row_id = row.get("id")
        title = row.get("title")
        url = (row.get("urls") or {}).get("canonical")
        provenance[row.get("legacyMetadataSource") or "original"] += 1
        # UTF-8 replacement glyphs indicate source bytes were previously
        # decoded incorrectly. Do not guess the intended text or change
        # publication titles without comparison to the original document.
        affected = [
            field for field in ("title", "abstract")
            if "\ufffd" in str(row.get(field) or "")
        ]
        if affected:
            encoding_alerts.append({
                "id": row_id, "issue": issue,
                "fields": affected,
                "titlePreview": str(title or "")[:130],
                "sourceUrl": url,
            })
        if not row_id or not title or not isinstance(row.get("year"), int):
            errors.append({"issue": issue, "id": row_id, "type": "required_metadata"})
        if row_id in seen_ids:
            errors.append({"issue": issue, "id": row_id, "type": "duplicate_id"})
        else:
            seen_ids[row_id] = issue
        if not url or not url.startswith(("https://", "http://")):
            errors.append({"issue": issue, "id": row_id, "type": "missing_canonical_url"})
        elif url in seen_urls:
            errors.append({"issue": issue, "id": row_id, "type": "duplicate_canonical_url"})
        else:
            seen_urls[url] = issue

    for issue in range(1, 61):
        rows = groups[issue]
        counts = Counter(
            r.get("legacyMetadataSource") or "original" for r in rows
        )
        no_authors = [r for r in rows if not r.get("authors")]
        no_abstract = [r for r in rows if not r.get("abstract")]
        by_title = defaultdict(list)
        for row in rows:
            key = normalized_title(row.get("title"))
            if key:
                by_title[key].append(row.get("id"))
        dupe_titles = [
            {"normalizedTitle": title, "ids": ids}
            for title, ids in by_title.items()
            if len(ids) > 1
        ]
        if not rows:
            errors.append({"issue": issue, "type": "missing_issue"})
        if dupe_titles:
            review.append({
                "issue": issue,
                "type": "duplicate_titles",
                "examples": dupe_titles[:8],
            })
        if 0 < len(rows) <= 4:
            review.append({
                "issue": issue, "type": "very_low_article_count",
                "count": len(rows),
                "note": "Not proof of missing articles; verify source TOC.",
            })
        if rows and len(no_authors) / len(rows) >= 0.6:
            review.append({
                "issue": issue, "type": "low_author_metadata",
                "withoutAuthors": len(no_authors), "total": len(rows),
            })
        issue_stats.append({
            "issue": issue,
            "articles": len(rows),
            "withAuthors": len(rows) - len(no_authors),
            "withAbstract": len(rows) - len(no_abstract),
            "sources": dict(sorted(counts.items())),
            "duplicateTitleGroups": len(dupe_titles),
        })

    cross_issue_titles = defaultdict(set)
    for row in historical:
        title = normalized_title(row.get("title"))
        if title:
            cross_issue_titles[title].add(row["issueNumber"])
    repeated_titles = [
        {"normalizedTitle": title, "issues": sorted(issues)}
        for title, issues in cross_issue_titles.items()
        if len(issues) > 1
    ]
    # Cross-issue repetitions can be legitimate reprints or references,
    # so preserve them and require human review instead of deleting.
    report = {
        "scope": "Sincronía historical issues 1–60",
        "status": "pass" if not errors else "fail",
        "issueCount": sum(bool(groups[n]) for n in range(1, 61)),
        "articleCount": len(historical),
        "sourceTotals": dict(sorted(provenance.items())),
        "issues": issue_stats,
        "integrityErrors": errors,
        "reviewQueue": review,
        "encodingAlerts": encoding_alerts,
        "encodingAlertCount": len(encoding_alerts),
        "encodingAlertIssues": dict(sorted(Counter(
            str(entry["issue"]) for entry in encoding_alerts
        ).items(), key=lambda entry: int(entry[0]))),
        "repeatedTitlesAcrossIssues": repeated_titles[:40],
        "caveat": (
            "All 60 numbered issues represented does not certify exhaustive "
            "tables of contents. Low-count issues and source gaps require "
            "independent catalogue comparison."
        ),
    }
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    report = historical_audit(data["records"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        "HISTORICAL_AUDIT",
        f"status={report['status']} issues={report['issueCount']}/60",
        f"articles={report['articleCount']} errors={len(report['integrityErrors'])}",
        f"reviewItems={len(report['reviewQueue'])}",
    )
    print("LOW_COUNT_ISSUES", [
        (r["issue"], r["count"])
        for r in report["reviewQueue"]
        if r["type"] == "very_low_article_count"
    ])
    print("SOURCE_TOTALS", report["sourceTotals"])
    print("ENCODING_ALERTS", report["encodingAlertCount"])
    print("ENCODING_ALERT_ISSUES", report["encodingAlertIssues"])
    for entry in report["encodingAlerts"][:25]:
        print("ENCODING_REVIEW", json.dumps(entry, ensure_ascii=False))
    if report["integrityErrors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

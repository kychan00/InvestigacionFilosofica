#!/usr/bin/env python3
"""Targeted provenance review for early Sincronía 3, 6 and 8.

Finds original issue table-of-contents candidates and author metadata gaps.
Never modifies a record or treats an unavailable archive as a complete issue.
"""
from __future__ import annotations

import argparse
import json
import re
import urllib.parse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from scripts.cucsh.audit_sincronia_historical import normalized_title
from scripts.cucsh.sincronia_legacy import (
    EARLY_ISSUE_FILENAMES,
    HISTORICAL_ISSUE_URLS,
    fetch_direct_early_issue,
)

TARGET_ISSUES = (3, 6, 8)


def normalized_link(value):
    parsed = urllib.parse.urlparse(value or "")
    if not parsed.netloc:
        return ""
    path = re.sub(r"/+", "/", urllib.parse.unquote(parsed.path)).casefold()
    return (parsed.netloc.casefold(), path.rstrip("/"))


def inspect_issue(issue_number, records, page):
    existing = [
        row for row in records if row.get("journal") == "Sincronía"
        and row.get("issueNumber") == issue_number
    ]
    old_urls = {
        normalized_link((row.get("urls") or {}).get("canonical"))
        for row in existing
    }
    old_titles = {normalized_title(row.get("title")) for row in existing}
    no_author = [
        {"id": r.get("id"), "title": r.get("title"),
         "canonical": (r.get("urls") or {}).get("canonical")}
        for r in existing if not r.get("authors")
    ]
    item = {
        "issue": issue_number,
        "originalIndexUrl": HISTORICAL_ISSUE_URLS[issue_number],
        "localArticles": len(existing),
        "missingAuthorCount": len(no_author),
        "missingAuthorRecords": no_author,
        "localSources": dict(Counter(
            row.get("legacyMetadataSource") or "original" for row in existing
        )),
        "indexFetched": page is not None,
        "indexArticleCandidates": None,
        "candidateLinksNotMatched": [],
    }
    if page is None:
        item["finding"] = "source_unavailable_review_required"
        return item

    links = page.get("links") or []
    candidate_links = []
    for link in links:
        url = link.get("url") or ""
        title = (link.get("text") or "").strip()
        if (
            normalized_link(url) in old_urls
            or (normalized_title(title) and normalized_title(title) in old_titles)
        ):
            continue
        candidate_links.append({"url": url, "indexText": title})
    item.update({
        "indexFetched": True,
        "sourceIndexTitle": page.get("title"),
        "sourceYear": page.get("year"),
        "retrievedViaWayback": bool(page.get("usedWayback")),
        "indexArticleCandidates": len(links),
        "candidateLinksNotMatched": candidate_links,
        "finding": "review_unmatched_index_links" if candidate_links else
                   "index_links_accounted_for",
    })
    # An unmatched link is a lead, not a verified scholarly article.
    return item


def summarize_author_gaps(records):
    historical = [
        row for row in records
        if row.get("journal") == "Sincronía"
        and isinstance(row.get("issueNumber"), int)
        and 1 <= row["issueNumber"] <= 60
    ]
    missing = [row for row in historical if not row.get("authors")]
    source_stats = {}
    for source in sorted({
        row.get("legacyMetadataSource") or "original" for row in historical
    }):
        group = [
            row for row in historical
            if (row.get("legacyMetadataSource") or "original") == source
        ]
        source_stats[source] = {
            "total": len(group),
            "withoutAuthors": sum(not row.get("authors") for row in group),
        }
    missing_by_issue = Counter(row["issueNumber"] for row in missing)
    return {
        "historicalTotal": len(historical),
        "missingAuthorTotal": len(missing),
        "missingByIssue": {
            str(n): missing_by_issue[n] for n in sorted(missing_by_issue)
        },
        "byMetadataSource": source_stats,
        "sourceEvidencePolicy": (
            "No author is inferred from a title or guessed. Resolve only "
            "against trustworthy original or bibliographic metadata."
        ),
    }


def fetch_index_target(n):
    filename, year = EARLY_ISSUE_FILENAMES[n]
    # Exact source URL first; no unbounded host/filename trial loop.
    return fetch_direct_early_issue(n, filename, year, bases=[])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    records = json.loads(args.input.read_text(encoding="utf-8"))["records"]
    pages, errors = {}, {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(fetch_index_target, n): n for n in TARGET_ISSUES}
        for future in as_completed(futures):
            n = futures[future]
            try:
                pages[n] = future.result()
            except Exception as exc:
                errors[str(n)] = repr(exc)
                pages[n] = None

    issues = [inspect_issue(n, records, pages.get(n)) for n in TARGET_ISSUES]
    report = {
        "scope": "Sincronía early 3, 6, 8 and authorship gap inventory",
        "status": "review_pending" if any(
            x["finding"] != "index_links_accounted_for" for x in issues
        ) else "source_index_accounted_for",
        "issues": issues,
        "sourceErrors": errors,
        "authorship": summarize_author_gaps(records),
        "policy": (
            "Indexes may contain navigation and linked works; do not count "
            "unmatched links as missing articles until checked individually. "
            "A source timeout is uncertainty, not proof of completeness."
        ),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("EARLY_AUDIT_STATUS", report["status"])
    for x in issues:
        print(
            "EARLY_ISSUE",
            f"number={x['issue']}",
            f"local={x['localArticles']}",
            f"index_fetched={x['indexFetched']}",
            f"index_candidates={x['indexArticleCandidates']}",
            f"unmatched={len(x['candidateLinksNotMatched'])}",
            f"without_authors={x['missingAuthorCount']}",
            f"finding={x['finding']}",
        )
        for candidate in x["candidateLinksNotMatched"][:15]:
            print("UNMATCHED_INDEX_LINK", x["issue"], json.dumps(
                candidate, ensure_ascii=False
            ))
    print("HISTORICAL_AUTHOR_GAPS", json.dumps(
        report["authorship"], ensure_ascii=False
    ))
    if errors:
        print("SOURCE_ERRORS", json.dumps(errors, ensure_ascii=False))


if __name__ == "__main__":
    main()

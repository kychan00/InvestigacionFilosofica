#!/usr/bin/env python3
"""Find source-verifiable repairs for damaged Sincronía historical titles.

Reads original issue indexes and compares their article anchor text to
the committed record's stable article URL. Never overwrites data. Only a
strong same-URL and high-similarity match produces a repair proposal.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import unquote, urlparse

from scripts.cucsh.sincronia_legacy import (
    EARLY_ISSUE_FILENAMES, HISTORICAL_ISSUE_URLS, fetch_direct_early_issue
)


def canonical_path(url):
    parsed = urlparse(url or "")
    return re.sub(r"/+", "/", unquote(parsed.path)).casefold().rstrip("/")


def title_compare_key(value):
    return re.sub(r"\s+", " ", str(value or "")).strip().casefold()


def propose_title_repair(row, links):
    url = (row.get("urls") or {}).get("canonical")
    damaged = str(row.get("title") or "")
    if "\ufffd" not in damaged or not canonical_path(url):
        return None

    # Strong path match and unique target on the same historical issue.
    matching = [
        entry for entry in links
        if canonical_path(entry.get("url")) == canonical_path(url)
    ]
    if len(matching) != 1:
        return {
            "status": "unverified_link", "id": row.get("id"),
            "issue": row.get("issueNumber"),
            "titleBefore": damaged,
            "sourceUrl": url,
            "matchingLinks": len(matching),
        }
    entry = matching[0]
    proposed = (entry.get("text") or "").strip()
    similarity = SequenceMatcher(
        None, title_compare_key(damaged), title_compare_key(proposed)
    ).ratio()
    if not proposed or "\ufffd" in proposed:
        status = "damaged_index_title"
    elif proposed == damaged:
        status = "no_change"
    elif similarity >= 0.86:
        status = "strong_index_match"
    else:
        status = "requires_title_review"

    return {
        "status": status,
        "id": row.get("id"),
        "issue": row.get("issueNumber"),
        "titleBefore": damaged,
        "proposedTitle": proposed,
        "similarity": round(similarity, 4),
        "sourceUrl": url,
        "sourceIndexLinkUrl": entry.get("url"),
    }


def issue_index(n):
    filename, year = EARLY_ISSUE_FILENAMES[n]
    return fetch_direct_early_issue(n, filename, year, bases=[])


def generate_proposals(rows, pages):
    corrupt = [
        r for r in rows
        if r.get("journal") == "Sincronía"
        and isinstance(r.get("issueNumber"), int)
        and 1 <= r["issueNumber"] <= 51
        and "\ufffd" in str(r.get("title") or "")
    ]
    proposals = []
    for row in corrupt:
        issue = row["issueNumber"]
        page = pages.get(issue)
        if page is None:
            proposals.append({
                "status": "archive_unavailable",
                "id": row.get("id"), "issue": issue,
                "titleBefore": row.get("title"),
                "sourceUrl": (row.get("urls") or {}).get("canonical"),
            })
        else:
            proposals.append(propose_title_repair(row, page.get("links") or []))
    return proposals


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()
    rows = json.loads(args.input.read_text(encoding="utf-8"))["records"]
    target_issues = sorted({
        r.get("issueNumber") for r in rows
        if r.get("journal") == "Sincronía"
        and "\ufffd" in str(r.get("title") or "")
        and isinstance(r.get("issueNumber"), int)
        and r["issueNumber"] in HISTORICAL_ISSUE_URLS
    })
    pages, network_errors = {}, {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(issue_index, n): n for n in target_issues}
        for future in as_completed(futures):
            n = futures[future]
            try:
                pages[n] = future.result()
            except Exception as exc:
                network_errors[str(n)] = repr(exc)
                pages[n] = None

    proposals = generate_proposals(rows, pages)
    by_status = defaultdict(int)
    for p in proposals:
        by_status[p["status"]] += 1
    report = {
        "scope": "Sincronía historical damaged title source-index proposals",
        "requestedIssues": target_issues,
        "retrievedIssues": sorted(n for n, v in pages.items() if v),
        "networkErrors": network_errors,
        "recordsReviewed": len(proposals),
        "byStatus": dict(sorted(by_status.items())),
        "proposals": proposals,
        "policy": (
            "A proposal is not an update. Never repair by guessing a lost "
            "character. Only same-article-URL, high-similarity, source-legible "
            "titles are eligible for a separate controlled commit."
        ),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("TITLE_REPAIR_SUMMARY", json.dumps({
        "issues": len(target_issues),
        "retrieved": len(report["retrievedIssues"]),
        "reviewed": len(proposals),
        "status": report["byStatus"],
    }, ensure_ascii=False))
    for p in proposals:
        if p["status"] in ("strong_index_match", "requires_title_review"):
            print("TITLE_REPAIR_CANDIDATE", json.dumps(p, ensure_ascii=False))


if __name__ == "__main__":
    main()

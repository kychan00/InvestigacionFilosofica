#!/usr/bin/env python3
"""Read a controlled sample of old Sincronía article pages for author evidence.

This intentionally does not mutate records: old scanned HTML can have
false-positive person-like strings. Only explicit author metadata can be
considered high confidence; all other names are review candidates.
"""
from __future__ import annotations

import argparse
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from scripts.cucsh.sincronia_legacy import (
    clean_text, extract_authors, is_html_url, parse_html, request_legacy_bytes
)

ISSUE_SAMPLE_QUOTAS = {3: 2, 6: 2, 8: 2, 46: 1, 47: 1, 48: 1, 50: 1}
META_AUTHOR_KEYS = ("citation_author", "dc.creator", "author")


def select_sample(records):
    sample = []
    for issue, limit in ISSUE_SAMPLE_QUOTAS.items():
        candidates = [
            row for row in records
            if row.get("journal") == "Sincronía"
            and row.get("issueNumber") == issue
            and not row.get("authors")
            and is_html_url((row.get("urls") or {}).get("canonical") or "")
        ]
        candidates.sort(key=lambda r: (
            (r.get("urls") or {}).get("canonical") or "", r.get("id") or ""
        ))
        sample.extend(candidates[:limit])
    return sample


def inspect_author_page(row, html_bytes):
    parser = parse_html(html_bytes)
    title = row.get("title")
    explicit_authors = [
        {"field": key, "value": clean_text(parser.meta[key])}
        for key in META_AUTHOR_KEYS if clean_text(parser.meta.get(key))
    ]
    heuristic_names = [
        value.get("name") for value in extract_authors(parser, title)
    ]
    normalized_title = re.sub(r"\s+", " ", (title or "").casefold()).strip()
    context = []
    for index, line in enumerate(parser.lines):
        if normalized_title and normalized_title in line.casefold():
            context = parser.lines[max(0, index - 1): index + 7]
            break
    return {
        "issue": row.get("issueNumber"),
        "recordId": row.get("id"),
        "articleUrl": (row.get("urls") or {}).get("canonical"),
        "title": title,
        "explicitAuthorFields": explicit_authors,
        "heuristicNames": heuristic_names,
        "titleFoundInDocument": bool(context),
        # Short text segments only: preserve enough to review attribution.
        "nearTitleLineSample": [line[:120] for line in context[:6]],
        "headMetaKeys": sorted(parser.meta)[:40],
        "documentTitle": (parser.title or "")[:130],
        "status": "explicit_metadata_available" if explicit_authors else
                  "heuristic_review_only" if heuristic_names else
                  "no_author_evidence",
    }


def inspect_remote(row):
    url = (row.get("urls") or {}).get("canonical")
    try:
        page, archived = request_legacy_bytes(
            url, prefer_wayback=True, allow_live_fallback=True
        )
        result = inspect_author_page(row, page)
        result["retrievedFromArchive"] = archived
        result["pageBytes"] = len(page)
        return result
    except Exception as exc:
        return {
            "issue": row.get("issueNumber"),
            "recordId": row.get("id"),
            "articleUrl": url,
            "title": row.get("title"),
            "status": "source_unavailable",
            "error": repr(exc)[:700],
        }


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--input",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    rows=json.loads(args.input.read_text(encoding="utf-8"))["records"]
    sample=select_sample(rows)
    responses=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures={pool.submit(inspect_remote,row): row for row in sample}
        for future in as_completed(futures):
            responses.append(future.result())
    responses.sort(key=lambda x:(x["issue"],x.get("articleUrl") or ""))
    counts={}
    for r in responses:
        counts[r["status"]]=counts.get(r["status"],0)+1
    report={
        "scope":"Sincronía source author metadata sample, issues 3,6,8,46-50",
        "sampleSize":len(sample),
        "statusCounts":counts,
        "records":responses,
        "policy":"No automatic author update from heuristic names; require source verification.",
    }
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("AUTHOR_SAMPLE_SUMMARY",json.dumps({
        "sample":len(sample),"statusCounts":counts
    },ensure_ascii=False))
    for result in responses:
        print("AUTHOR_EVIDENCE",json.dumps({
            "issue":result["issue"],"id":result.get("recordId"),
            "title":result.get("title"),"status":result["status"],
            "fields":result.get("explicitAuthorFields"),
            "heuristicNames":result.get("heuristicNames"),
            "nearTitleLines":result.get("nearTitleLineSample"),
            "error":result.get("error")
        },ensure_ascii=False))


if __name__ == "__main__":
    main()

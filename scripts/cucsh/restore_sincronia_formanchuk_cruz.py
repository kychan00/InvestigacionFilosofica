#!/usr/bin/env python3
"""Restore an early Sincronía work identity using a dated complete republication.

The republication explicitly credits Sincronía (Verano 2000), carries the
exact work heading and author byline. It does not certify that the original
Sincronía article URL remains reachable or establish the exact initial path.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ARTICLE_ID = "cucsh:sincronia-legacy:12cf65c2ec1f08182eb5"
INDEX_TITLE = "Formanchuk, Alejandro B."
RESTORED_TITLE = "Bajo la misma cruz"
VERIFIED_AUTHOR = "Alejandro B. Formanchuk"
SOURCE_URL = "https://armonicosdeconciencia.blogspot.com/2011/09/una-aldea-global-que-fractura-lo-que.html?m=0"


def repair_work_identity(dataset):
    rows = dataset["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected corpus baseline or repeated source IDs")
    if sum(not r.get("authors") for r in sin) != 100:
        raise ValueError("Expected 100 outstanding original Sincronía bylines")

    changed = []
    for row in rows:
        if row.get("id") != ARTICLE_ID:
            continue
        canonical = (row.get("urls") or {}).get("canonical") or ""
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 15
            or row.get("year") != 2000
            or row.get("title") != INDEX_TITLE
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not canonical.lower().endswith("/formanchuk.htm")
        ):
            raise ValueError("Formanchuk historical identity baseline mismatch")
        row["title"] = RESTORED_TITLE
        row["titleVariants"] = [RESTORED_TITLE]
        row["authors"] = [
            {"name": VERIFIED_AUTHOR, "sourceName": VERIFIED_AUTHOR}
        ]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "dated-complete-republication-matching-original-issue-and-byline",
            "previousTitle": INDEX_TITLE,
            "verifiedTitle": RESTORED_TITLE,
            "verifiedAuthors": [VERIFIED_AUTHOR],
            "sourceUrl": SOURCE_URL,
            "sourceArticleUrl": canonical,
            "matchedIssueNumber": 15,
            "matchedYear": 2000,
            "sourceNature": "secondary-2011-republication-crediting-sincronia-verano-2000",
            "originalAvailabilityPreserved": True,
            "note": (
                "2011 republication explicitly labels Sincronía Verano 2000 "
                "and shows Bajo la misma cruz / POR ALEJANDRO B. FORMANCHUK. "
                "It does not establish live full-text access at the original "
                "formanchuk.htm URL or substitute for the original page."
            ),
        }
        row["legacyAuthorEvidence"] = {
            "kind": "dated-republication-original-issue-byline",
            "sourceUrl": SOURCE_URL,
            "verifiedAuthors": [VERIFIED_AUTHOR],
            "verifiedTitle": RESTORED_TITLE,
            "matchedIssueNumber": 15,
            "originalAvailabilityPreserved": True,
        }
        changed.append(ARTICLE_ID)

    if changed != [ARTICLE_ID] or ids != [r.get("id") for r in rows]:
        raise ValueError("Expected exactly the original Formanchuk record")
    if sum(not r.get("authors") for r in sin) != 99:
        raise ValueError("Expected exactly 99 unresolved original bylines")
    return dataset, changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    result, changed = repair_work_identity(data)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_FORMANCHUK_CRUZ", json.dumps({
        "changed": changed, "corpusRecords": len(result["records"]),
        "unresolvedAuthors": 99
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

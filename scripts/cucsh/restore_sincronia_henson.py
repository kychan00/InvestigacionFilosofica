#!/usr/bin/env python3
"""Restore James Henson's Sincronía issue-11 byline from exact-URL evidence.

The author's UT Austin-hosted CV (p. 2) identifies title, Sincronía summer
1999 and exact canonical /henson.htm URL. An independent USC-hosted law
journal article (footnote 171) cites the same author, work and URL.
Do not change the dead original URL or historical access status.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:e2d1bee634ba13fb0c3b"
TITLE = "The Color of Money: Race, Ideology, and Foreign Enterprise in Post-Revolutionary Mexico"
AUTHOR = "James Henson"
ORIGINAL_URL = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/henson.htm"
CV_SOURCE = "https://minio.la.utexas.edu/colaweb-prod/person_files/0/842/Hensonspr22.pdf"
LAW_SOURCE = "https://gould.usc.edu/wp-content/uploads/legacy/why/students/orgs/ilj/assets/docs/15-2%20Banks.pdf"


def restore_henson(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen CUCSH/Sincronía corpus")
    if sum(not r.get("authors") for r in sin) != 77:
        raise ValueError("Expected 77 unresolved Sincronía bylines")

    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 11
            or row.get("year") != 1999
            or row.get("title") != TITLE
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != ORIGINAL_URL
            or (row.get("legacyAccessStatus") or {}).get("status")
                != "original-page-unavailable"
        ):
            raise ValueError("Frozen Sincronía issue-11 Henson identity mismatch")

        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyAuthorEvidence"] = {
            "kind": "author-institutional-cv-exact-original-url-plus-independent-law-citation",
            "sourceUrl": CV_SOURCE,
            "sourceInstitution": "The University of Texas at Austin",
            "sourcePage": 2,
            "supportingSourceUrl": LAW_SOURCE,
            "supportingFootnote": 171,
            "verifiedAuthor": AUTHOR,
            "verifiedTitle": TITLE,
            "sourceArticleUrl": ORIGINAL_URL,
            "urlMatchLevel": "two-external-exact-original-url-citations",
            "matchedIssueNumber": 11,
            "matchedYear": 1999,
            "originalAvailabilityPreserved": True,
            "note": (
                "James Henson's university-hosted CV, p. 2, cites his article "
                "in Sincronía (Summer 1999) and the exact /henson.htm original "
                "URL. A USC-hosted law-journal article independently cites "
                "James Henson, the same title, journal, season, year and URL "
                "in footnote 171. These citations establish bibliographic "
                "attribution, not current full-text availability; the "
                "original URL stays marked unavailable."
            ),
        }
        changed.append(ID)

    if changed != [ID] or ids != [r.get("id") for r in rows]:
        raise ValueError("Exactly one original stable ID must change")
    if sum(not r.get("authors") for r in sin) != 76:
        raise ValueError("Expected 76 Sincronía records without authors")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    result, changed = restore_henson(data)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_HENSON_VERIFIED", json.dumps({
        "changed": changed, "records": len(result["records"]),
        "remainingAuthorless": 76,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

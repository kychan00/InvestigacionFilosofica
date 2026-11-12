#!/usr/bin/env python3
"""Attribute the 1997 Sincronía issue-2 work from an institutional bibliography.

UNH's 1997 faculty publication index independently identifies Jaume
Marti-Olivella as author of this exact title. This establishes authorship,
not that the archived journal URL is available, or that the conference
version and journal record are demonstrably the same manifestation.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:ee167409d83129e9eaee"
TITLE = "When the Latino Family Goes Hollywood"
AUTHOR = "Jaume Martí-Olivella"
ORIGINAL_URL = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/olivella.htm"
SOURCE = "https://scholars.unh.edu/faculty_pubs/index.53.html"


def restore_olivella(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen corpus baseline")
    if sum(not r.get("authors") for r in sin) != 79:
        raise ValueError("Expected 79 unresolved Sincronía author records")
    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        if (row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 2
            or row.get("year") != 1997
            or row.get("title") != TITLE
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != ORIGINAL_URL
            or (row.get("legacyAccessStatus") or {}).get("status")
                != "original-page-unavailable"):
            raise ValueError("Frozen issue-2 Martí-Olivella identity mismatch")
        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyAuthorEvidence"] = {
            "kind": "institutional-faculty-bibliography-exact-title-and-year",
            "sourceUrl": SOURCE,
            "sourceInstitution": "University of New Hampshire",
            "sourceYear": 1997,
            "verifiedAuthor": AUTHOR,
            "verifiedTitle": TITLE,
            "sourceArticleUrl": ORIGINAL_URL,
            "matchedIssueNumber": 2,
            "matchedYear": 1997,
            "urlMatchLevel": "journal-original-url-from-legacy-index-only",
            "originalAvailabilityPreserved": True,
            "note": (
                "UNH 1997 faculty publications index attributes this exact "
                "work title to Jaume Marti-Olivella. The historical Sincronía "
                "index independently includes the same title in issue 2 "
                "(1997) under /olivella.htm. The external institutional "
                "record does not establish original URL-level proof, "
                "publication-version equivalence, or live access."
            ),
        }
        changed.append(ID)
    if changed != [ID] or ids != [r.get("id") for r in rows]:
        raise ValueError("Exactly one stable original ID must change")
    if sum(not r.get("authors") for r in sin) != 78:
        raise ValueError("Expected 78 remaining unresolved author records")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_olivella(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_OLIVELLA_VERIFIED", json.dumps({
        "changed": changed, "records": len(updated["records"]),
        "remainingAuthorless": 78,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Restore one historical Sincronía author from independently corroborated evidence.

SAGE Encyclopedia of Disability (2006) cites Ransom, John S., title,
Sincronía, and the EXACT historical /CUCSH/Sincronia/ransom.htm URL
(retrieved 2005-05-21). A copy of the author's signed original manuscript
starts with the same title and "by John S. Ransom, Dickinson College".
No source proves that the historical original URL is currently available.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:609131a63943ffe9c013"
TITLE = "Transgression, Limit, and Oppositional Modes"
AUTHOR = "John S. Ransom"
ORIGINAL_URL = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/ransom.htm"
ENCYCLOPEDIA_SOURCE = (
    "https://ush.rs/wp-content/uploads/2022/07/"
    "Encyclopedia-of-Disability-Volume-IV-S-X-.pdf"
)
SIGNED_TEXT_SOURCE = (
    "https://www.academia.edu/4049016/"
    "nietzsche_and_foucault_on_limit_and_transgression"
)


def restore_ransom(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sincronia = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sincronia) != 1454:
        raise ValueError("Unexpected frozen corpus size")
    if len(ids) != len(set(ids)) or ID not in ids:
        raise ValueError("Frozen record IDs missing or duplicated")
    if sum(not r.get("authors") for r in sincronia) != 76:
        raise ValueError("Expected exactly 76 unresolved Sincronía authors")

    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 6
            or row.get("year") != 1998
            or row.get("title") != TITLE
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != ORIGINAL_URL
            or (row.get("legacyAccessStatus") or {}).get("status")
                != "original-page-archived-only"
        ):
            raise ValueError("Frozen Ransom issue-six identity mismatch")

        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyAuthorEvidence"] = {
            "kind": "sage-encyclopedia-exact-url-and-signed-manuscript",
            "sourceUrl": ENCYCLOPEDIA_SOURCE,
            "sourceWork": "Encyclopedia of Disability, Volume IV",
            "sourcePublisher": "SAGE Publications",
            "sourcePublicationYear": 2006,
            "originalUrlAccessedBySource": "2005-05-21",
            "supportingSourceUrl": SIGNED_TEXT_SOURCE,
            "verifiedAuthor": AUTHOR,
            "verifiedTitle": TITLE,
            "sourceArticleUrl": ORIGINAL_URL,
            "urlMatchLevel": "independent-exact-original-url-citation",
            "matchedIssueNumber": 6,
            "matchedYear": 1998,
            "originalAvailabilityPreserved": True,
            "note": (
                "The SAGE Encyclopedia of Disability (2006) cites John S. "
                "Ransom, this exact title, Sincronía and the exact historical "
                "/CUCSH/Sincronia/ransom.htm URL (retrieved 21 May 2005). "
                "An independently hosted copy bears the heading 'by John "
                "S. Ransom, Dickinson College'. The issue number and year "
                "are those of the preserved Sincronía index, not supplied "
                "by the encyclopedia. Do not infer that the original is "
                "currently live; retain its archived-only status."
            ),
        }
        changed.append(ID)

    if changed != [ID] or ids != [r.get("id") for r in rows]:
        raise ValueError("Expected exactly one unchanged source identity")
    if sum(not r.get("authors") for r in sincronia) != 75:
        raise ValueError("Expected 75 remaining unresolved authors")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_ransom(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_RANSOM_VERIFIED", json.dumps({
        "changed": changed, "records": len(updated["records"]),
        "remainingAuthorless": 75,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

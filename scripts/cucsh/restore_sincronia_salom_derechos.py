#!/usr/bin/env python3
"""Restore Genaro D. Salom's 2000 Sincronía work from triangulated evidence.

Bibliographic evidence explicitly identifies "Derechos Humanos" by Genaro
Salom as a Sincronía HTML publication from 2000. An independent later
republication preserves the full text and signature "Lic. Genaro D. Salom".
The legacy derechos.htm URL comes from the historical issue index and is
preserved, but external sources are not misrepresented as URL-level proof.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:a62bbf11f17db65d6d35"
OLD = "Salom, Genaro D."
TITLE = "Derechos Humanos"
AUTHOR = "Genaro D. Salom"
BIBLIOGRAPHY_SOURCE = "https://es.scribd.com/document/544160505/Derecho-Constitucional-y-Derechos-Humanos"
FULL_TEXT_SOURCE = "https://jujuyddhh.blogspot.com/2010/"
LEGACY_SUFFIX = "/derechos.htm"


def restore_salom_derechos(data):
    rows = data["records"]
    ids = [row.get("id") for row in rows]
    sin = [row for row in rows if row.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(set(ids)) != len(ids):
        raise ValueError("Unexpected frozen CUCSH/Sincronía corpus")
    if sum(not row.get("authors") for row in sin) != 82:
        raise ValueError("Expected 82 unresolved Sincronía bylines")

    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        original_url = (row.get("urls") or {}).get("canonical") or ""
        previous_variants = row.get("titleVariants") or []
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 16
            or row.get("year") != 2000
            or row.get("title") != OLD
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not isinstance(previous_variants, list)
            or not original_url.lower().endswith(LEGACY_SUFFIX)
        ):
            raise ValueError("Frozen Salom derechos.htm identity mismatch")

        row["title"] = TITLE
        row["titleVariants"] = list(dict.fromkeys([
            TITLE, *previous_variants, OLD,
        ]))
        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "bibliography-journal-year-title-plus-independent-full-text-byline",
            "previousTitle": OLD,
            "previousTitleVariants": previous_variants,
            "verifiedTitle": TITLE,
            "verifiedAuthors": [AUTHOR],
            "bibliographySourceUrl": BIBLIOGRAPHY_SOURCE,
            "fullTextRepublicationUrl": FULL_TEXT_SOURCE,
            "sourceArticleUrl": original_url,
            "matchedIssueNumber": 16,
            "matchedYear": 2000,
            "urlMatchLevel": "historical-index-only-not-external-exact-url-proof",
            "originalAvailabilityPreserved": True,
            "note": (
                "A legal/human-rights course bibliography explicitly lists "
                "'Salom, Genaro: Derechos Humanos. Doc/html: Sincronía 2000'. "
                "An independent 2010 republication preserves the article text "
                "and signature 'Derechos Humanos Lic. Genaro D. Salom'. "
                "The /derechos.htm association is retained from the original "
                "Sincronía index; no external source is claimed to reproduce "
                "that exact URL."
            ),
        }
        row["legacyAuthorEvidence"] = {
            "kind": "bibliography-journal-year-title-plus-independent-full-text-byline",
            "bibliographySourceUrl": BIBLIOGRAPHY_SOURCE,
            "fullTextRepublicationUrl": FULL_TEXT_SOURCE,
            "verifiedAuthors": [AUTHOR],
            "verifiedTitle": TITLE,
            "sourceArticleUrl": original_url,
            "matchedIssueNumber": 16,
            "matchedYear": 2000,
            "urlMatchLevel": "historical-index-only-not-external-exact-url-proof",
            "originalAvailabilityPreserved": True,
        }
        changed.append(ID)

    if changed != [ID] or ids != [row.get("id") for row in rows]:
        raise ValueError("Expected exactly one stable Salom source record")
    if sum(not row.get("authors") for row in sin) != 81:
        raise ValueError("Expected 81 remaining authorless Sincronía records")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_salom_derechos(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_SALOM_DERECHOS", json.dumps({
        "changed": changed,
        "records": len(updated["records"]),
        "remainingAuthorless": 81,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Restore one Sincronía issue-1 byline from exact-URL UdeG citation.

Juan Pablo Fautsch (Argos, 2023, p. 152) cites Vogt (1996), the
same article, journal, and exact historical /vogt.htm URL.
Never change the original URL, title, or access-status evidence.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:569c01b5d33035d0783f"
TITLE = "Problemas de Periodización de la Historia Literaria de Jalisco"
AUTHOR = "Wolfgang Vogt"
URL = "http://sincronia.cucsh.udg.mx/vogt.htm"
SOURCE = "https://revistaargos.cucsh.udg.mx/index.php/argos/article/download/80/111/359"


def restore_vogt(data):
    rows = data["records"]
    ids = [row.get("id") for row in rows]
    sin = [row for row in rows if row.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen corpus size or identifiers")
    if sum(not row.get("authors") for row in sin) != 81:
        raise ValueError("Expected exactly 81 unresolved Sincronía authors")

    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 1
            or row.get("year") != 1996
            or row.get("title") != TITLE
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != URL
            or (row.get("legacyAccessStatus") or {}).get("status")
                != "original-page-archived-only"
        ):
            raise ValueError("Frozen Vogt issue-1 identity mismatch")
        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyAuthorEvidence"] = {
            "kind": "udeg-journal-citation-exact-original-article-url",
            "sourceUrl": SOURCE,
            "sourcePage": 152,
            "citingWork": "Propuesta para un ordenamiento generacional de los escritores jaliscienses",
            "verifiedAuthor": AUTHOR,
            "verifiedTitle": TITLE,
            "sourceArticleUrl": URL,
            "matchedIssueNumber": 1,
            "matchedYear": 1996,
            "originalAvailabilityPreserved": True,
            "note": (
                "Argos (UdeG, 2023), p. 152, cites Vogt, W. (1996), "
                "Problemas de periodización de la historia literaria en Jalisco, "
                "Sincronía, and the exact /vogt.htm original URL. "
                "Its 'en Jalisco' citation variant does not override the "
                "historically indexed 'de Jalisco' title. The original "
                "page remains archived-only, not live."
            ),
        }
        changed.append(ID)
    if changed != [ID] or ids != [row.get("id") for row in rows]:
        raise ValueError("Expected exactly one unchanged stable ID")
    if sum(not row.get("authors") for row in sin) != 80:
        raise ValueError("Expected 80 remaining unresolved Sincronía authors")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    output, changed = restore_vogt(data)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_VOGT_VERIFIED", json.dumps({
        "changed": changed, "records": len(output["records"]),
        "remainingAuthorless": 80,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

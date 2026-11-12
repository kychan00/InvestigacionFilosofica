#!/usr/bin/env python3
"""Restore Carmen Vidaurre's issue-13 Velázquez article from author reproduction."""
from __future__ import annotations
import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:a560672620601b8a849e"
OLD = "Vidaurri Arena, Carmen Vitalia"
TITLE = "Diego Velázquez: La Venus del espejo"
HEADING = "VELÁZQUEZ: LA VENUS DEL ESPEJO"
AUTHOR = "Carmen V. Vidaurre Arenas"
SOURCE = "https://www.academia.edu/8658332/Diego_Vel%C3%A1zquez_La_Venus_del_espejo"
SUPPORT = "https://www.researchgate.net/publication/266740368_Diego_Velazquez_La_Venus_del_espejo"


def restore_velazquez_work(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected corpus baseline")
    if sum(not r.get("authors") for r in sin) != 84:
        raise ValueError("Expected 84 unresolved Sincronía bylines")

    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        original = (row.get("urls") or {}).get("canonical") or ""
        variants = row.get("titleVariants") or []
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 13
            or row.get("year") != 2000
            or row.get("title") != OLD
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not isinstance(variants, list)
            or not original.lower().endswith("/vidauri2.htm")
        ):
            raise ValueError("Frozen Vidaurre Velázquez identity mismatch")

        row["title"] = TITLE
        row["titleVariants"] = list(dict.fromkeys([
            TITLE, HEADING, *variants, OLD,
        ]))
        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "author-reproduced-original-winter-issue-and-heading",
            "previousTitle": OLD,
            "previousTitleVariants": variants,
            "verifiedTitle": TITLE,
            "originalHeading": HEADING,
            "verifiedAuthors": [AUTHOR],
            "sourceUrl": SOURCE,
            "supportingSourceUrl": SUPPORT,
            "sourceArticleUrl": original,
            "matchedIssueNumber": 13,
            "matchedYear": 2000,
            "originalAvailabilityPreserved": True,
            "note": (
                "Author-hosted Academia reproduction identifies Sincronía nº 13 "
                "(winter 1999-2000), Carmen V. Vidaurre Arenas and the original "
                "heading VELÁZQUEZ: LA VENUS DEL ESPEJO. ResearchGate independently "
                "reproduces the same issue metadata and text. Historical vidauri2.htm "
                "is preserved as the indexed URL without claiming live access."
            ),
        }
        row["legacyAuthorEvidence"] = {
            "kind": "author-reproduced-original-winter-issue-and-heading",
            "sourceUrl": SOURCE,
            "supportingSourceUrl": SUPPORT,
            "verifiedAuthors": [AUTHOR],
            "verifiedTitle": TITLE,
            "originalHeading": HEADING,
            "sourceArticleUrl": original,
            "matchedIssueNumber": 13,
            "matchedYear": 2000,
            "originalAvailabilityPreserved": True,
        }
        changed.append(ID)

    if changed != [ID] or ids != [r.get("id") for r in rows]:
        raise ValueError("Expected exactly one stable source record")
    if sum(not r.get("authors") for r in sin) != 83:
        raise ValueError("Expected 83 remaining authorless Sincronía records")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    out, changed = restore_velazquez_work(data)
    args.output.write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_VIDAURRE_VELAZQUEZ", json.dumps({
        "changed": changed, "records": len(out["records"]),
        "remainingAuthorless": 83,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

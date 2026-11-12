#!/usr/bin/env python3
"""Recover three 1996 Sincronía author names from academic citations.

Only fill empty bylines and attach source information. Indexed article
titles, their punctuation, identifiers and broken original URLs are preserved.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

EVIDENCE = [
    {
        "id": "cucsh:sincronia-legacy:5d1bd1d4bd91b46626f4",
        "issue": 1,
        "year": 1996,
        "title": "Análisis del argumento del sueño en la primera meditación de Descartes",
        "author": "Enrique Uribe Avín",
        "originalSuffix": "/uribe.html",
        "sourceUrl": "https://aadiebaires.com.ar/pdf/Actas%20de%20III%20Jornadas%20de%20Filosofia%20Moderna%202012%20%28Rousseau%29.pdf",
        "evidenceNote": "Actas III Jornadas Nacionales de Filosofía Moderna (Universidad Nacional de Mar del Plata, 2012), p. 38 note 17, cites exact article title, Enrique Uribe Avín, Sincronía and 1996."
    },
    {
        "id": "cucsh:sincronia-legacy:98bd5ce47ce72dbbd6ba",
        "issue": 1,
        "year": 1996,
        "title": "Glosario de términos de ironía narrativa,",
        "author": "Lauro Zavala",
        "originalSuffix": "/zavalo.html",
        "sourceUrl": "https://revistes.uab.cat/brumal/article/view/v13-n2-carneiro",
        "evidenceNote": "Peer-reviewed journal Brumal (2025) bibliography cites Lauro Zavala, Glosario de términos de ironía narrativa, exact historical zavalo.html URL. Original index title has trailing comma, retained unchanged."
    },
    {
        "id": "cucsh:sincronia-legacy:eb8b3da7ba4f5d0f8447",
        "issue": 1,
        "year": 1996,
        "title": "Antropovisión de la economía global",
        "author": "Miguel Agustín Romero Morett",
        "originalSuffix": "/morett.html",
        "sourceUrl": "https://vos-archive.english.ucsb.edu/browse.asp%3Fid%3D2709.html",
        "evidenceNote": "University of California Santa Barbara Voice of the Shuttle Cultural Studies index lists Miguel Agustín Romero Morett (U. Guadalajara), the exact work title, year 1996 and Sincronía."
    }
]


def apply_first_issue_authors(data):
    rows = data["records"]
    ids = [row.get("id") for row in rows]
    sin = [row for row in rows if row.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen journal corpus baseline")
    if sum(not row.get("authors") for row in sin) != 99:
        raise ValueError("Expected exactly 99 unattributed Sincronía records")
    lookup = {item["id"]: item for item in EVIDENCE}
    if len(EVIDENCE) != 3 or len(lookup) != 3:
        raise ValueError("Expected three unique independent work citations")

    changed = []
    for row in rows:
        item = lookup.get(row.get("id"))
        if item is None:
            continue
        canonical = (row.get("urls") or {}).get("canonical") or ""
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != item["issue"]
            or row.get("year") != item["year"]
            or row.get("title") != item["title"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or not canonical.lower().endswith(item["originalSuffix"].lower())
        ):
            raise ValueError("One original issue-one work changed: " + item["id"])
        row["authors"] = [
            {"name": item["author"], "sourceName": item["author"]}
        ]
        row["legacyAuthorEvidence"] = {
            "kind": "independent-bibliography-original-issue-attribution",
            "sourceUrl": item["sourceUrl"],
            "verifiedAuthors": [item["author"]],
            "indexedTitlePreserved": item["title"],
            "matchedIssueNumber": item["issue"],
            "matchedYear": item["year"],
            "originalArticleUrlPreserved": canonical,
            "sourceNote": item["evidenceNote"],
            "accessCaveat": (
                "Academic source is bibliographic evidence only. Original "
                "article availability is documented separately and is "
                "not changed or implicitly upgraded."
            ),
        }
        changed.append(item["id"])

    if set(changed) != set(lookup) or ids != [r.get("id") for r in rows]:
        raise ValueError("Unmatched bibliography or unstable original IDs")
    if sum(not row.get("authors") for row in sin) != 96:
        raise ValueError("Expected 96 remaining authorless Sincronía items")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = apply_first_issue_authors(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_FIRST_ISSUE_THREE_AUTHORS", json.dumps({
        "changed": changed, "records": len(updated["records"]),
        "remainingAuthorless": 96
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Restore exactly two issue-50 Sincronía article titles from Dialnet.

Both rows already have verified author lists; they stay byte-for-byte
unchanged. Historical old title variants remain searchable and the original
link's archived/unavailable status is never altered.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

VERIFIED = [
  {
    "id": "cucsh:sincronia-legacy:32aab3dfc0369f0cead1",
    "issue": 50,
    "year": 2009,
    "oldTitle": "García Núñez,Roberto y Bustos Silva,Guillermina",
    "newTitle": "Las modalidades y opciones de titulación y el comportamiento recepcional de los egresados de la Licenciatura en Sociología de la Universidad de Guadalajara",
    "authors": [
      "Roberto García Núñez",
      "Guillermina Bustos Silva"
    ],
    "urlSuffix": "/garciaspring09.htm",
    "source": "https://dialnet.unirioja.es/servlet/articulo?codigo=3296677"
  },
  {
    "id": "cucsh:sincronia-legacy:c3beb6f2b0b892bc9313",
    "issue": 50,
    "year": 2009,
    "oldTitle": "Velázquez Martínez, María Patricia y Hernández López",
    "newTitle": "Exploración de la Didáctica de la Interpretación desde un Ambiente Virtual de Aprendizaje",
    "authors": [
      "María Patricia Velázquez Martínez",
      "Elizabeth Margarita Hernández López"
    ],
    "urlSuffix": "/velazquezspring09.htm",
    "source": "https://dialnet.unirioja.es/servlet/articulo?codigo=3296685"
  }
]


def repair_issue50_titles(dataset):
    rows = dataset["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen corpus size or duplicate IDs")
    if sum(not r.get("authors") for r in sin) != 91:
        raise ValueError("Expected 91 authorless Sincronía records")
    lookup = {r["id"]: r for r in VERIFIED}
    if len(lookup) != 2 or len(VERIFIED) != 2:
        raise ValueError("Two exact independent source matches required")
    changed = []
    for row in rows:
        item = lookup.get(row.get("id"))
        if item is None:
            continue
        original = (row.get("urls") or {}).get("canonical") or ""
        actual_authors = [a.get("name") for a in row.get("authors") or []]
        variants = row.get("titleVariants") or []
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 50
            or row.get("year") != 2009
            or row.get("title") != item["oldTitle"]
            or actual_authors != item["authors"]
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not original.lower().endswith(item["urlSuffix"].lower())
            or not isinstance(variants, list)
        ):
            raise ValueError("Frozen issue-50 article identity mismatch: "+item["id"])
        row["title"] = item["newTitle"]
        row["titleVariants"] = [item["newTitle"]] + [
            variant for variant in variants
            if variant != item["newTitle"]
        ]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "dialnet-verified-issue-50-title-authors-match",
            "sourceUrl": item["source"],
            "previousTitle": item["oldTitle"],
            "originalTitleVariants": variants,
            "verifiedTitle": item["newTitle"],
            "authorsPreserved": item["authors"],
            "originalArticleUrlPreserved": original,
            "matchedIssueNumber": 50,
            "matchedYear": 2009,
            "matchingMethod": "unique-issue-and-complete-existing-coauthors",
            "originalAvailabilityPreserved": True,
            "note": (
                "Dialnet issue 50 contains precisely this title and the two "
                "existing article bylines. The original title was an author "
                "index label, retained in titleVariants; no original link "
                "access status or existing author evidence is changed."
            ),
        }
        changed.append(item["id"])
    if set(changed) != set(lookup) or ids != [r.get("id") for r in rows]:
        raise ValueError("Expected both original source IDs unchanged")
    if sum(not r.get("authors") for r in sin) != 91:
        raise ValueError("Authorless count changed unexpectedly")
    return dataset, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    original = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = repair_issue50_titles(original)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_ISSUE50_TWO_TITLE_REPAIRS", json.dumps({
        "changed": changed, "totalRecords": len(updated["records"]),
        "pendingAuthors": 91,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

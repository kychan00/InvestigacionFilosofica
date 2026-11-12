#!/usr/bin/env python3
"""Repair two Sincronía article titles verified by academic bibliographies.

The external bibliography preserves exact title and legacy URL. Original URL
status remains unchanged, even when that page has been taken down.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

VERIFIED = [
  {
    "id": "cucsh:sincronia-legacy:940caceb0d1f820da9a5",
    "issue": 16,
    "year": 2000,
    "prior": "Soler Diaz, Maria Antonieta",
    "title": "Prospectiva de la educación en México",
    "authors": [
      "María Antonieta Soler Díaz"
    ],
    "urlSuffix": "/poled.htm",
    "sourceUrl": "https://posgrado.colef.mx/wp-content/uploads/2011/04/TESIS-Morales-Nev%C3%A1rez-Ana-Mar%C3%ADa.pdf",
    "note": "El Colegio de la Frontera Norte master's thesis, reference bibliography p.167, cites article title, 'Soler, María', fall 2000, and poled.htm. Extended given names derived from original historical Sincronía index label, not from that bibliography."
  },
  {
    "id": "cucsh:sincronia-legacy:b6e314746adecc6757dd",
    "issue": 18,
    "year": 2001,
    "prior": "Mejía , Guadalupe,",
    "title": "Texto y música en Jalisco",
    "authors": [
      "Guadalupe Mejía"
    ],
    "urlSuffix": "/mejia.htm",
    "sourceUrl": "https://www.academia.edu/9657868/The_Frontier_of_Progress_and_Repression_1950s_American_Suburbia_in_Todd_Hayness_Far_From_Heaven",
    "note": "Academic article Del barroco al negrismo references Guadalupe Mejía's 2001 Sincronía work with exact title and original mejia.htm URL; original historical issue is 18."
  }
]


def restore_two_bibliographic_titles(dataset):
    records = dataset["records"]
    ids = [r.get("id") for r in records]
    sin = [r for r in records if r.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(sin) != 1454 or len(set(ids)) != len(ids):
        raise ValueError("Unexpected corpus identity or size")
    if sum(not r.get("authors") for r in sin) != 106:
        raise ValueError("Expected 106 unresolved Sincronía bylines")
    expected = {v["id"]: v for v in VERIFIED}
    if len(VERIFIED) != 2 or len(expected) != 2:
        raise ValueError("Expected two unique frozen bibliographic identities")

    changed = []
    for row in records:
        item = expected.get(row.get("id"))
        if not item:
            continue
        original_url = (row.get("urls") or {}).get("canonical") or ""
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != item["issue"]
            or row.get("year") != item["year"]
            or row.get("title") != item["prior"]
            or row.get("authors")
            or row.get("legacyIndexMislabelEvidence")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or not original_url.lower().endswith(item["urlSuffix"].lower())
        ):
            raise ValueError("Frozen historical record mismatch: " + item["id"])

        row["title"] = item["title"]
        row["titleVariants"] = [item["title"]]
        row["authors"] = [
            {"name": author, "sourceName": author}
            for author in item["authors"]
        ]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "original-index-author-name-replaced-by-cited-work-title",
            "sourceUrl": item["sourceUrl"],
            "sourceArticleUrl": original_url,
            "previousTitle": item["prior"],
            "verifiedTitle": item["title"],
            "verifiedAuthors": item["authors"],
            "matchedIssueNumber": item["issue"],
            "matchedYear": item["year"],
            "evidenceNote": item["note"],
            "originalAvailabilityPreserved": True,
        }
        row["legacyAuthorEvidence"] = {
            "kind": "independent-exact-title-original-url-citation",
            "sourceUrl": item["sourceUrl"],
            "verifiedTitle": item["title"],
            "verifiedAuthors": item["authors"],
            "matchedIssueNumber": item["issue"],
            "originalAvailabilityPreserved": True,
            "evidenceNote": item["note"],
        }
        changed.append(item["id"])

    if set(changed) != set(expected) or ids != [r.get("id") for r in records]:
        raise ValueError("Two historical records were not uniquely patched")
    if sum(not r.get("authors") for r in sin) != 104:
        raise ValueError("Expected exactly 104 remaining unattributed articles")
    return dataset, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    result, changed = restore_two_bibliographic_titles(data)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_TWO_BIBLIOGRAPHIC_TITLES", json.dumps({
        "changed": changed, "records": len(result["records"]),
        "unattributed": 104,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

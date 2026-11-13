#!/usr/bin/env python3
"""Restore two verified 2000 Sincronía titles with explicit original-URL evidence.

Only two frozen journal records may change. Preserve all original links,
availability, identifiers and historical title variants. Never conflate
bibliographic evidence URLs with working links to the original article.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

VERIFIED = [
  {
    "id": "cucsh:sincronia-legacy:c7cbf58138a51053d669",
    "oldTitle": "Bong Seo,Yoon",
    "title": "Dos frutos de la era cibernética: la generación net y los hackers",
    "authors": [
      "Seo Yoon Bong"
    ],
    "issue": 15,
    "year": 2000,
    "originalSuffix": "/joon.htm",
    "sourceUrl": "https://www.scielo.br/j/rbedu/a/gSfFcSpCssjML8Wj9xq5dgj/?format=html",
    "supportingSourceUrl": "https://latinjournal.org/index.php/roh/article/view/121",
    "citationAuthorName": "SEO, Yoon Bong",
    "sourceNote": "The 2003 Revista Brasileira de Educação bibliography cites SEO, Yoon Bong (2000), full title, UdeG and original joon.htm. A 2007 Revista Ocupación Humana article independently cites the same title and original URL. Normalized author matches the already catalogued Seo Yoon Bong author of Rulfofoto.htm."
  },
  {
    "id": "cucsh:sincronia-legacy:014936a40189f16c9b90",
    "oldTitle": "Velasco, Arnulfo Eduardo",
    "title": "El sueño del héroe en el cine estadounidense contemporáneo",
    "authors": [
      "Arnulfo Eduardo Velasco"
    ],
    "issue": 15,
    "year": 2000,
    "originalSuffix": "/cineus.htm",
    "sourceUrl": "https://repositorio.ub.edu.ar/bitstream/handle/123456789/542/389_Walpen.pdf?isAllowed=y&sequence=2",
    "supportingSourceUrl": "https://www.academia.edu/144073190/La_construcci%C3%B3n_del_personaje_en_el_relato_cinematogr%C3%A1fico_h%C3%A9roes_y_villanos",
    "citationAuthorName": "VELASCO, ARNULFO EDUARDO",
    "sourceNote": "María Walpen (Universidad de Belgrano, 2010), p. 6 note 6 and p. 37 bibliography, cites exact original cineus.htm URL and singular-title wording. Another secondary work paraphrases as 'El sueño de los héroes'; the conflicting alternative is recorded as an unverified citation variant, not a basis for altering the chosen exact-URL bibliography."
  }
]


def recover_two_cited_2000_titles(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(set(ids)) != len(ids):
        raise ValueError("Unexpected CUCSH Sincronía corpus baseline")
    if sum(not r.get("authors") for r in sin) != 91:
        raise ValueError("Expected 91 authorless Sincronía records")
    expected = {item["id"]: item for item in VERIFIED}
    if len(expected) != len(VERIFIED) or len(expected) != 2:
        raise ValueError("Exactly two unique bibliography matches required")

    changed = []
    for row in rows:
        item = expected.get(row.get("id"))
        if item is None:
            continue
        original = (row.get("urls") or {}).get("canonical") or ""
        previous_variants = row.get("titleVariants") or []
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != item["issue"]
            or row.get("year") != item["year"]
            or row.get("title") != item["oldTitle"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not original.lower().endswith(item["originalSuffix"].lower())
            or not isinstance(previous_variants, list)
        ):
            raise ValueError("Original article identity drift: " + item["id"])

        row["title"] = item["title"]
        row["titleVariants"] = [item["title"]] + [
            value for value in previous_variants
            if value != item["title"]
        ]
        if item["oldTitle"] not in row["titleVariants"]:
            row["titleVariants"].append(item["oldTitle"])
        row["authors"] = [
            {"name": name, "sourceName": name}
            for name in item["authors"]
        ]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "exact-original-url-independent-bibliography-2000",
            "previousTitle": item["oldTitle"],
            "originalTitleVariants": previous_variants,
            "verifiedTitle": item["title"],
            "verifiedAuthors": item["authors"],
            "sourceUrl": item["sourceUrl"],
            "supportingSourceUrl": item["supportingSourceUrl"],
            "sourceArticleUrl": original,
            "citationAuthorName": item["citationAuthorName"],
            "matchedIssueNumber": item["issue"],
            "matchedYear": item["year"],
            "originalAvailabilityPreserved": True,
            "bibliographicNote": item["sourceNote"],
        }
        row["legacyAuthorEvidence"] = {
            "kind": "exact-original-url-independent-author-citation-2000",
            "sourceUrl": item["sourceUrl"],
            "supportingSourceUrl": item["supportingSourceUrl"],
            "verifiedAuthors": item["authors"],
            "citationAuthorName": item["citationAuthorName"],
            "verifiedTitle": item["title"],
            "matchedIssueNumber": item["issue"],
            "matchedYear": item["year"],
            "sourceArticleUrl": original,
            "originalAvailabilityPreserved": True,
        }
        changed.append(item["id"])

    if set(changed) != set(expected) or ids != [r.get("id") for r in rows]:
        raise ValueError("Unexpected missing work or altered record sequence")
    if sum(not r.get("authors") for r in sin) != 89:
        raise ValueError("Expected 89 remaining Sincronía records without author")
    return data, changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = recover_two_cited_2000_titles(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_TWO_2000_EXACT_URL_WORKS", json.dumps({
        "changed": changed,
        "totalCUCSH": len(updated["records"]),
        "remainingUnattributed": 89,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Restore two Carmen V. Vidaurre Arenas historical Sincronía work identities.

The source reproductions expose original issue metadata and headings. Historical
index labels and heading forms remain title variants. Original URLs and access
states are preserved exactly.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

VERIFIED = [
  {
    "id": "cucsh:sincronia-legacy:f0219709b1318d38b4e9",
    "issue": 12,
    "year": 1999,
    "oldTitle": "Vidaurri Arenas, Carmen Vitaliana",
    "title": "Análisis cinematográfico: Se7en",
    "exactHeading": "SE7EN",
    "authors": [
      "Carmen V. Vidaurre Arenas"
    ],
    "suffix": "/vidaurri.htm",
    "sourceUrl": "https://www.academia.edu/8657927/An%C3%A1lisis_cinematogr%C3%A1fico_Se7en",
    "supportingUrl": "https://uvadoc.uva.es/bitstream/handle/10324/52061/TFM_F_2021_002.pdf",
    "sourceNote": "Academia reproduction identifies Carmen V. Vidaurre Arenas, Sincronía nº 12, 1999; reproduced first page carries the exact heading SE7EN and Fall/Otoño 1999 issue metadata. Universidad de Valladolid bibliography independently cites Vidaurre Arenas (1999), Análisis Cinematográfico - Se7en, Sincronía fall."
  },
  {
    "id": "cucsh:sincronia-legacy:56729985caa12c05d30e",
    "issue": 14,
    "year": 2000,
    "oldTitle": "Vidaurri Arenas, Carmen",
    "title": "Augusto Roa Bastos: El trueno entre las hojas",
    "exactHeading": "AUGUSTO ROA BASTOS",
    "authors": [
      "Carmen V. Vidaurre Arenas"
    ],
    "suffix": "/vidauri3.htm",
    "sourceUrl": "https://www.academia.edu/8657906/Augusto_Roa_Bastos_El_trueno_entre_las_hojas",
    "supportingUrl": "https://www.researchgate.net/publication/266740539_Sincronia_Primavera_Spring_2000_Ano_5_Numero_14_Marzo-Junio_2000_CUCSH-Universidad_de_Guadalajara",
    "exactUrlCitation": "https://www.academia.edu/99143679/Comentario_El_prisionero",
    "sourceNote": "Academia metadata identifies exact Sincronía nº 14 article and author; ResearchGate reproduction shows issue 14 Spring 2000 and original heading AUGUSTO ROA BASTOS with El trueno entre las hojas immediately below the byline. A later academic commentary cites the same work and exact original vidauri3.htm URL."
  }
]


def restore_two_vidaurre_works(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected corpus size or duplicate IDs")
    if sum(not r.get("authors") for r in sin) != 86:
        raise ValueError("Expected 86 unresolved Sincronía bylines")
    expected = {item["id"]: item for item in VERIFIED}
    if len(expected) != 2 or len(VERIFIED) != 2:
        raise ValueError("Expected exactly two frozen Vidaurre works")

    changed = []
    for row in rows:
        item = expected.get(row.get("id"))
        if item is None:
            continue
        original_url = (row.get("urls") or {}).get("canonical") or ""
        old_variants = row.get("titleVariants") or []
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != item["issue"]
            or row.get("year") != item["year"]
            or row.get("title") != item["oldTitle"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not isinstance(old_variants, list)
            or not original_url.lower().endswith(item["suffix"].lower())
        ):
            raise ValueError("Frozen Vidaurre historical identity mismatch: " + item["id"])

        row["title"] = item["title"]
        row["titleVariants"] = list(dict.fromkeys([
            item["title"], item["exactHeading"], *old_variants, item["oldTitle"],
        ]))
        row["authors"] = [
            {"name": author, "sourceName": author}
            for author in item["authors"]
        ]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "author-reproduced-original-issue-and-heading",
            "previousTitle": item["oldTitle"],
            "previousTitleVariants": old_variants,
            "verifiedTitle": item["title"],
            "originalHeading": item["exactHeading"],
            "verifiedAuthors": item["authors"],
            "sourceUrl": item["sourceUrl"],
            "supportingSourceUrl": item["supportingUrl"],
            "exactOriginalUrlCitation": item.get("exactUrlCitation"),
            "sourceArticleUrl": original_url,
            "matchedIssueNumber": item["issue"],
            "matchedYear": item["year"],
            "originalAvailabilityPreserved": True,
            "note": item["sourceNote"],
        }
        row["legacyAuthorEvidence"] = {
            "kind": "author-reproduced-original-issue-and-heading",
            "sourceUrl": item["sourceUrl"],
            "supportingSourceUrl": item["supportingUrl"],
            "exactOriginalUrlCitation": item.get("exactUrlCitation"),
            "verifiedAuthors": item["authors"],
            "verifiedTitle": item["title"],
            "originalHeading": item["exactHeading"],
            "sourceArticleUrl": original_url,
            "matchedIssueNumber": item["issue"],
            "matchedYear": item["year"],
            "originalAvailabilityPreserved": True,
        }
        changed.append(item["id"])

    if set(changed) != set(expected) or ids != [r.get("id") for r in rows]:
        raise ValueError("Expected exactly two stable historical source IDs")
    if sum(not r.get("authors") for r in sin) != 84:
        raise ValueError("Expected 84 remaining authorless Sincronía records")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    out, changed = restore_two_vidaurre_works(data)
    args.output.write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_TWO_VIDAURRE_WORKS", json.dumps({
        "changed": changed,
        "records": len(out["records"]),
        "remainingAuthorless": 84,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

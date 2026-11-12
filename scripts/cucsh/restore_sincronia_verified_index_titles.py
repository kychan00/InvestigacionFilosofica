#!/usr/bin/env python3
"""Restore exactly five source-verified early Sincronía work identities.

An archived or dead original URL is never promoted into a live link.
All source identifiers, years, availability annotations and record order
are preserved; any unexpected baseline is an immediate error.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

VERIFIED = [
    {
        "id": "cucsh:sincronia-legacy:49b5784a8ae06fa454b2",
        "issue": 14,
        "year": 2000,
        "prior": "Gilbert, Stephen W.",
        "title": "Metáforas conceptuales y la teoría de «mezclaje»",
        "authors": [
            "Stephen W. Gilbert"
        ],
        "sourceUrl": "https://www.academia.edu/30627352/Los_espacios_mentales_en_pr%C3%A1ctica",
        "sourceNote": "Scholarly reference cites Stephen W. Gilbert, 2000, exact legacy path metaforas.htm and article title.",
        "urlSuffix": "/metaforas.htm"
    },
    {
        "id": "cucsh:sincronia-legacy:4f37b04c2e8bb672fe93",
        "issue": 14,
        "year": 2000,
        "prior": "Rodríguez Alonso, Jesús A.,",
        "title": "Relación Individuo-Sociedad en Foucault y Habermas",
        "authors": [
            "Jesús Alberto Rodríguez Alonso"
        ],
        "sourceUrl": "https://www.researchgate.net/publication/275892003_Relacion_Individuo-Sociedad_en_Foucault_y_Habermas",
        "sourceNote": "Author-uploaded text identifies article title, full author and exact original Sincronía article URL.",
        "urlSuffix": "/habermasfoucault.htm"
    },
    {
        "id": "cucsh:sincronia-legacy:7b1169fc953bb5bbcde5",
        "issue": 14,
        "year": 2000,
        "prior": "Bong Seo, Yoon",
        "title": "Juan Rulfo, escritor y fotógrafo: dos artes en conjunción",
        "authors": [
            "Seo Yoon Bong"
        ],
        "sourceUrl": "https://tesiunamdocumentos.dgb.unam.mx/ptb2010/mayo/0657883/0657883_A12.pdf",
        "sourceNote": "UNAM thesis bibliography page 190 gives BONG, Seo Yoon, 2000, exact article title and legacy Rulfofoto.htm URL.",
        "urlSuffix": "/Rulfofoto.htm"
    },
    {
        "id": "cucsh:sincronia-legacy:c177a81b39d937c10913",
        "issue": 18,
        "year": 2001,
        "prior": "Schmidhuber, Guillermo",
        "title": "Sor Juana Inés de la Cruz, dramaturga",
        "authors": [
            "Guillermo Schmidhuber"
        ],
        "sourceUrl": "https://alternativas.me/wp-content/uploads/Alternativas-en-Psicologia-42-Numero-especial.pdf",
        "sourceNote": "Published scholarly reference lists Schmidhuber 2001 title and original Sincronía schmid3.htm URL.",
        "urlSuffix": "/schmid3.htm"
    },
    {
        "id": "cucsh:sincronia-legacy:8681f9c51943f77086d0",
        "issue": 14,
        "year": 2000,
        "prior": "Alvarado Borgoño, Miguel",
        "title": "La estrategia narrativa de una utopía abierta. La obra 'Facundo' de Faustino Sarmiento",
        "authors": [
            "Miguel Alvarado Borgoño"
        ],
        "sourceUrl": "https://revistas.udec.cl/index.php/rtr/article/download/22007/19529",
        "sourceNote": "Published academic bibliography lists Miguel Alvarado Borgoño, Sincronía Primavera 2000, work title and borgono.htm URL.",
        "urlSuffix": "/borgono.htm"
    }
]


def apply_verified_index_titles(dataset):
    rows = dataset["records"]
    ids = [row.get("id") for row in rows]
    if len(rows) != 1845 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen corpus size or duplicate IDs")
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(sin) != 1454 or sum(not r.get("authors") for r in sin) != 115:
        raise ValueError("Unexpected Sincronía pending-author baseline")
    lookup = {item["id"]: item for item in VERIFIED}
    if len(lookup) != 5 or len(VERIFIED) != 5:
        raise ValueError("Expected five unique source-proven identities")
    changed = []
    for row in rows:
        item = lookup.get(row.get("id"))
        if item is None:
            continue
        original = (row.get("urls") or {}).get("canonical") or ""
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != item["issue"]
            or row.get("year") != item["year"]
            or row.get("title") != item["prior"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not original.lower().endswith(item["urlSuffix"].lower())
        ):
            raise ValueError("Frozen Sincronía index identity mismatch: " + item["id"])
        row["title"] = item["title"]
        row["titleVariants"] = [item["title"]]
        row["authors"] = [
            {"name": name, "sourceName": name} for name in item["authors"]
        ]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "original-issue-index-used-author-name-instead-of-title",
            "sourceUrl": item["sourceUrl"],
            "sourceArticleUrl": original,
            "previousTitle": item["prior"],
            "verifiedTitle": item["title"],
            "verifiedAuthors": item["authors"],
            "matchedIssueNumber": item["issue"],
            "bibliographicNote": item["sourceNote"],
            "originalAvailabilityPreserved": True,
        }
        row["legacyAuthorEvidence"] = {
            "kind": "independent-exact-original-url-title-author-citation",
            "sourceUrl": item["sourceUrl"],
            "verifiedAuthors": item["authors"],
            "verifiedTitle": item["title"],
            "matchedIssueNumber": item["issue"],
            "originalAvailabilityPreserved": True,
        }
        changed.append(item["id"])
    if set(changed) != set(lookup) or ids != [r.get("id") for r in rows]:
        raise ValueError("Expected exactly the five frozen original IDs")
    if sum(not r.get("authors") for r in sin) != 110:
        raise ValueError("Expected exactly 110 unresolved Sincronía bylines")
    return dataset, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    result, changed = apply_verified_index_titles(data)
    args.output.write_text(json.dumps(
        result, ensure_ascii=False, indent=2
    ) + "\n", encoding="utf-8")
    print("SINCRONIA_VERIFIED_EARLY_WORK_IDENTITIES", json.dumps({
        "changed": changed, "total": len(result["records"]),
        "pendingAuthors": 110
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

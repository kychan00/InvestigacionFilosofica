#!/usr/bin/env python3
"""Restore four independently sourced Sincronía 2000–2001 article identities.

No network access, inferred titles, record deletion or link-status upgrades.
Fails closed unless exactly four frozen legacy records match their baselines.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

VERIFIED = [
    {
        "id": "cucsh:sincronia-legacy:1efffea46e9b286d444c",
        "issue": 13,
        "year": 2000,
        "prior": "Reyes, Giovanni",
        "title": "The International Monetary Fund: Main Characteristics, Conditionality and Macroeconomic Adjustment",
        "authors": [
            "Giovanni E. Reyes"
        ],
        "sourceUrl": "https://cdi.mecon.gob.ar/bases/docelec/dp2556.pdf",
        "urlSuffix": "/Imf.htm",
        "evidence": "Archival PDF reproduces the original Sincronía article URL, exact English heading and the author byline."
    },
    {
        "id": "cucsh:sincronia-legacy:cb9d04769f12b6216000",
        "issue": 14,
        "year": 2000,
        "prior": "Macías Rodríguez , Claudia",
        "title": "Presencia de la fiesta en El Llano en llamas de Juan Rulfo",
        "authors": [
            "Claudia Macías Rodríguez"
        ],
        "sourceUrl": "https://revistas.ucm.es/index.php/ALHI/article/view/62734",
        "urlSuffix": "/fiesta.htm",
        "evidence": "Published scholarly bibliography identifies exact article title, author, Sincronía, year 2000 and the original fiesta.htm URL."
    },
    {
        "id": "cucsh:sincronia-legacy:b3b56216992bd5336973",
        "issue": 15,
        "year": 2000,
        "prior": "Vidaurre Arenas, Carmen V.",
        "title": "Una historieta mexicana",
        "authors": [
            "Carmen V. Vidaurre Arenas"
        ],
        "sourceUrl": "https://publications.iai.spk-berlin.de/servlets/MCRFileNodeServlet/Document_derivate_00002942/Carrillo%20Zeiter_Mueller_Comic.pdf",
        "urlSuffix": "/historieta.htm",
        "evidence": "Ibero-Amerikanisches Institut academic publication cites original article with exact title, author, 2000 and historieta.htm."
    },
    {
        "id": "cucsh:sincronia-legacy:c69e9245b6317699440e",
        "issue": 18,
        "year": 2001,
        "prior": "Reyes, Giovanni E.",
        "title": "Theory of globalization: fundamental Basis",
        "authors": [
            "Giovanni E. Reyes"
        ],
        "sourceUrl": "https://repository.urosario.edu.co/items/c3ec783f-517d-456b-b90b-50303f4e1bf2/full",
        "urlSuffix": "/globaliz.htm",
        "evidence": "Universidad del Rosario institutional repository records original issue 18, year 2001, original globaliz.htm URL, publication title and fuller author name."
    }
]


def apply_verified_early_titles(dataset):
    rows = dataset["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(set(ids)) != len(ids):
        raise ValueError("Unexpected CUCSH/Sincronía corpus baseline")
    if sum(not r.get("authors") for r in sin) != 110:
        raise ValueError("Expected exactly 110 missing Sincronía author records")
    expected = {item["id"]: item for item in VERIFIED}
    if len(expected) != 4 or len(VERIFIED) != 4:
        raise ValueError("Expected four unique frozen source-backed identities")
    changed = []
    for row in rows:
        item = expected.get(row.get("id"))
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
            raise ValueError("Frozen source identity mismatch: " + item["id"])
        row["title"] = item["title"]
        row["titleVariants"] = [item["title"]]
        row["authors"] = [
            {"name": author, "sourceName": author}
            for author in item["authors"]
        ]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "original-index-author-name-instead-of-article-title",
            "sourceUrl": item["sourceUrl"],
            "sourceArticleUrl": original,
            "previousTitle": item["prior"],
            "verifiedTitle": item["title"],
            "verifiedAuthors": item["authors"],
            "matchedIssueNumber": item["issue"],
            "matchedYear": item["year"],
            "note": item["evidence"],
            "originalAvailabilityPreserved": True,
        }
        row["legacyAuthorEvidence"] = {
            "kind": "independent-title-author-url-bibliography",
            "sourceUrl": item["sourceUrl"],
            "verifiedTitle": item["title"],
            "verifiedAuthors": item["authors"],
            "matchedIssueNumber": item["issue"],
            "originalAvailabilityPreserved": True,
        }
        changed.append(item["id"])
    if set(changed) != set(expected) or ids != [r.get("id") for r in rows]:
        raise ValueError("Missing or altered original record IDs")
    if sum(not r.get("authors") for r in sin) != 106:
        raise ValueError("Expected exactly 106 records without identified authors")
    return dataset, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    corpus = json.loads(args.input.read_text(encoding="utf-8"))
    output, changed = apply_verified_early_titles(corpus)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_EARLY_TITLES_BATCH_TWO", json.dumps({
        "changed": changed, "total": len(output["records"]),
        "pendingAuthors": 106
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

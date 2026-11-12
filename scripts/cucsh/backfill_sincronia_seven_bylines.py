#!/usr/bin/env python3
"""Seven source-verified Sincronía bylines. Exact, offline, no title guesses."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

# Each source identifies the exact work or the corresponding editorial issue.
# Original URLs and source-availability metadata are intentionally unchanged.
VERIFIED = [
    {
        "id": "cucsh:sincronia-legacy:90e6110f6d59f7492570",
        "issue": 1,
        "title": "A Semiotics of Film and Literary Fiction: Classic, Modern, and Postmodern",
        "authors": [
            "Lauro Zavala"
        ],
        "evidence": "https://www.odp.org/Arts/Literature/World_Literature/Latin_American/"
    },
    {
        "id": "cucsh:sincronia-legacy:42f588461e4fdccc802b",
        "issue": 47,
        "title": "Catalina de Erauso: Escritura y vida de supervivencia",
        "authors": [
            "María Soraya García Sánchez"
        ],
        "evidence": "https://sorayagarciasanchez.wordpress.com/my-cv/"
    },
    {
        "id": "cucsh:sincronia-legacy:7fdfd9409dbe03393c1a",
        "issue": 48,
        "title": "Aging and Social Welfare: The Case of Trust and Risk",
        "authors": [
            "Jason L. Powell"
        ],
        "evidence": "https://dialnet.unirioja.es/ejemplar/251053"
    },
    {
        "id": "cucsh:sincronia-legacy:a3e5a0ef6bb0c5c38b36",
        "issue": 48,
        "title": "Espacio y region: Dos conceptos multidisciplinarios",
        "authors": [
            "María del Carmen Macías Huerta"
        ],
        "evidence": "https://dialnet.unirioja.es/ejemplar/251053"
    },
    {
        "id": "cucsh:sincronia-legacy:f5a82dd5a4d91f5e57a3",
        "issue": 48,
        "title": "AMBITION: The appetite for money in our modern world",
        "authors": [
            "Maximiliano Emanuel Korstanje"
        ],
        "evidence": "https://dialnet.unirioja.es/ejemplar/251053"
    },
    {
        "id": "cucsh:sincronia-legacy:3166afb316226d84079b",
        "issue": 50,
        "title": "Index of Dissimilarity: A Measure of Relative Aging of Human Populations",
        "authors": [
            "Ashraf Khan Kayani",
            "Zill-i Huma",
            "Ahmad Raza"
        ],
        "evidence": "https://dialnet.unirioja.es/ejemplar/251077"
    },
    {
        "id": "cucsh:sincronia-legacy:ea983826dbf9d6f3f700",
        "issue": 50,
        "title": "Taking Aim at Gerontology: From Biomedical Science to Social Science -- A Sociological Journey",
        "authors": [
            "Jason L. Powell"
        ],
        "evidence": "https://dialnet.unirioja.es/ejemplar/251077"
    }
]


def apply_verified_bylines(dataset):
    records = dataset["records"]
    before_ids = [row.get("id") for row in records]
    if len(records) != 1845:
        raise ValueError("Unexpected CUCSH snapshot size")
    if sum(row.get("journal") == "Sincronía" for row in records) != 1454:
        raise ValueError("Unexpected Sincronía snapshot size")
    if sum(row.get("journal") == "Sincronía" and not row.get("authors") for row in records) != 130:
        raise ValueError("Unexpected pending author baseline")
    lookup = {entry["id"]: entry for entry in VERIFIED}
    if len(lookup) != len(VERIFIED) or len(lookup) != 7:
        raise ValueError("Curated mappings must be unique")
    changed = []
    for row in records:
        entry = lookup.get(row.get("id"))
        if not entry:
            continue
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != entry["issue"]
            or row.get("title") != entry["title"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
        ):
            raise ValueError("Curated evidence does not match frozen record: " + entry["id"])
        row["authors"] = [
            {"name": name, "sourceName": name}
            for name in entry["authors"]
        ]
        row["legacyAuthorEvidence"] = {
            "kind": "independent-exact-work-or-issue-bibliography",
            "sourceUrl": entry["evidence"],
            "verifiedAuthors": entry["authors"],
            "matchedIssueNumber": entry["issue"],
            "matchedTitle": entry["title"],
            "note": "Source corroborates authorship; not a claim that original article URL is online.",
        }
        changed.append(entry["id"])
    if set(changed) != set(lookup) or before_ids != [row.get("id") for row in records]:
        raise ValueError("Curated record identities changed or disappeared")
    if sum(row.get("journal") == "Sincronía" and not row.get("authors") for row in records) != 123:
        raise ValueError("Unexpected pending author postcondition")
    return dataset, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    patched, changed = apply_verified_bylines(data)
    args.output.write_text(
        json.dumps(patched, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_SEVEN_VERIFIED_BYLINES", json.dumps({
        "changed": changed, "total": len(patched["records"]),
        "pendingAuthors": 123,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

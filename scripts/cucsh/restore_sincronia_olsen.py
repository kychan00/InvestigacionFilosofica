#!/usr/bin/env python3
"""Restore Patrice Elizabeth Olsen's 1997 Sincronía byline conservatively.

The El Colegio de México thesis cites the exact work title and an alternate
historical host (/patrice.htm). A reproduction of the original article
retains the original fuentes.csh.udg.mx URL, author, year and title context.
Neither evidence source proves that the original page is currently live.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:4bc93dce74d19f58d0a3"
TITLE = "Issues of National Identity: Obregon, Calles and Nationalist Architecture 1920-1930"
AUTHOR = "Patrice Elizabeth Olsen"
ORIGINAL_URL = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/patrice.htm"
COLMEX_SOURCE = "https://repositorio.colmex.mx/downloads/6969z106c?locale=es"
REPRODUCTION_SOURCE = "https://www.academia.edu/8807997/La_Arquitectura_Nacionalista"
COLMEX_CITED_URL = "http://sincronia.cucsh.udg.mx/patrice.htm"


def restore_olsen(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected CUCSH/Sincronía frozen corpus")
    if sum(not r.get("authors") for r in sin) != 78:
        raise ValueError("Expected exactly 78 Sincronía records without authors")

    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 2
            or row.get("year") != 1997
            or row.get("title") != TITLE
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != ORIGINAL_URL
            or (row.get("legacyAccessStatus") or {}).get("status")
                != "original-page-unavailable"
        ):
            raise ValueError("Frozen issue-2 Olsen work identity mismatch")

        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyAuthorEvidence"] = {
            "kind": "independent-institutional-bibliography-plus-historical-reproduction",
            "sourceUrl": COLMEX_SOURCE,
            "sourceInstitution": "El Colegio de México",
            "reproducedTextUrl": REPRODUCTION_SOURCE,
            "verifiedAuthor": AUTHOR,
            "verifiedTitle": TITLE,
            "sourceArticleUrl": ORIGINAL_URL,
            "institutionalCitationUrlVariant": COLMEX_CITED_URL,
            "urlMatchLevel": "original-exact-url-in-reproduction-alternate-host-in-thesis",
            "matchedIssueNumber": 2,
            "matchedYear": 1997,
            "originalAvailabilityPreserved": True,
            "note": (
                "El Colegio de México's 2008 thesis (bibliography, p. 142) "
                "attributes the exact work to Patrice Elizabeth Olsen and "
                "cites Sincronía /patrice.htm via the sincronia.cucsh.udg.mx "
                "host. An archived/reproduced article page independently "
                "preserves Patrice Elizabeth Olsen's heading and the "
                "catalogued fuentes.csh.udg.mx/CUCSH/Sincronia/patrice.htm "
                "path. The two hostnames are documented separately; no "
                "claim of current original-site availability is made."
            ),
        }
        changed.append(ID)

    if changed != [ID] or ids != [r.get("id") for r in rows]:
        raise ValueError("Expected exactly one unchanged source ID")
    if sum(not r.get("authors") for r in sin) != 77:
        raise ValueError("Expected 77 unresolved Sincronía author records")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_olsen(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_OLSEN_VERIFIED", json.dumps({
        "changed": changed,
        "records": len(updated["records"]),
        "remainingAuthorless": 77,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

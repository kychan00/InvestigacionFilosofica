#!/usr/bin/env python3
"""Restore Hugo Oscar Fernández's Sincronía issue-10 authorship.

The Universidad de Sonora (De masculinidades y mujeres en México, 2012,
printed p. 67) cites full author, title, 1999, and the EXACT legacy URL.
UNAM's 2019 Geography doctoral thesis independently cites the same work,
year, journal, and original URL. These are bibliographic attributions, not
evidence that the historical original URL still works.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:df98685293eb9589c34e"
TITLE = "Acerca de Foucault y las practicas sociales"
AUTHOR = "Hugo Oscar Fernández"
ORIGINAL_URL = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/fernandez.htm"
UNISON_SOURCE = "https://sociologia.unison.mx/docs/publicaciones/cuadernodetrabajo/cuaderno10.pdf"
UNAM_SOURCE = "https://tesiunamdocumentos.dgb.unam.mx/ptd2019/junio/0790201/0790201.pdf"


def restore_fernandez(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sincronia = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sincronia) != 1454:
        raise ValueError("Unexpected frozen CUCSH/Sincronía corpus size")
    if len(ids) != len(set(ids)) or ID not in ids:
        raise ValueError("Frozen stable record identifiers missing or duplicated")
    if sum(not r.get("authors") for r in sincronia) != 75:
        raise ValueError("Expected exactly 75 unresolved Sincronía authors")

    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 10
            or row.get("year") != 1999
            or row.get("title") != TITLE
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != ORIGINAL_URL
            or (row.get("legacyAccessStatus") or {}).get("status")
                != "original-page-archived-only"
        ):
            raise ValueError("Frozen issue-ten Fernández work identity mismatch")
        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyAuthorEvidence"] = {
            "kind": "two-university-bibliographies-exact-historical-url",
            "sourceUrl": UNISON_SOURCE,
            "sourceInstitution": "Universidad de Sonora",
            "sourceWork": "De masculinidades y mujeres en México: Algunos des/encuentros",
            "sourcePublicationYear": 2012,
            "sourcePrintedPage": 67,
            "originalUrlLastAccessedBySource": "2012-10-22",
            "supportingSourceUrl": UNAM_SOURCE,
            "supportingInstitution": "Universidad Nacional Autónoma de México",
            "supportingWork": (
                "La Noche de Muertos en Janitzio como un espacio de confluencia "
                "entre las prácticas discursivas de la cultura local y el turismo oscuro"
            ),
            "supportingPublicationYear": 2019,
            "verifiedAuthor": AUTHOR,
            "verifiedTitle": TITLE,
            "titleVariantsInEvidence": [
                "Acerca de Foucault y las prácticas sociales",
            ],
            "sourceArticleUrl": ORIGINAL_URL,
            "urlMatchLevel": "two-independent-exact-original-url-bibliographies",
            "matchedIssueNumber": 10,
            "matchedYear": 1999,
            "originalAvailabilityPreserved": True,
            "note": (
                "Universidad de Sonora, Cuadernos de Trabajo 10, printed p. 67, "
                "cites Fernández, Hugo Oscar (1999), Acerca de Foucault y las "
                "prácticas sociales, with the exact historical /fernandez.htm "
                "URL (consulted on 22 October 2012). A UNAM doctoral thesis "
                "(2019) independently cites Fernández, H. (1999), the same "
                "work and exact original URL. The catalogued unaccented title "
                "is preserved rather than overwritten. Original archived-only "
                "access status is unchanged; prior citation access in 2012 "
                "does not establish current availability."
            ),
        }
        changed.append(ID)

    if changed != [ID] or ids != [r.get("id") for r in rows]:
        raise ValueError("Expected exactly one unchanged stable source ID")
    if sum(not r.get("authors") for r in sincronia) != 74:
        raise ValueError("Expected exactly 74 remaining unresolved authors")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_fernandez(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_FERNANDEZ_VERIFIED", json.dumps({
        "changed": changed, "records": len(updated["records"]),
        "remainingAuthorless": 74,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

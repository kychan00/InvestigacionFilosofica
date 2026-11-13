#!/usr/bin/env python3
"""Restore two Sincronía authors only when exact source identities match.

Academic evidence identifies both full bylines and bibliographic titles.
Neither a past reference nor a preserved full text upgrades the availability
of the old journal URL. The 1,845-record corpus and original index are frozen.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


SOURCES = {
    "cucsh:sincronia-legacy:fd0ec30fa6630979aea1": {
        "title": "La rebelion en el placer del texto literario",
        "author": "Guadalupe Sánchez Robles",
        "issue": 2,
        "year": 1997,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/TEXTO.htm",
        "status": "original-page-unavailable",
        "evidence": {
            "kind": "academic-bibliography-exact-original-url-and-author",
            "sourceUrl": (
                "https://tidsskrift.dk/aktualitet/article/download/"
                "111516/160514/228321"
            ),
            "sourceTitle": "Tilnærmelser til Isabel Allendes litterær univers",
            "sourceAuthor": "Claudio Cifuentes-Aldunate",
            "sourcePublisher": "Tidsskrift.dk academic journal platform",
            "sourcePdfPage": 9,
            "sourceSection": "Litteraturliste",
            "sourceCitationAuthor": "Sánchez Robles, Guadalupe",
            "sourceCitationTitleVariant": (
                "La rebelión en el placer del texto literario"
            ),
            "sourceCitedOriginalUrl": (
                "http://fuentes.csh.udg.mx/CUCSH/Sincronia/TEXTO.htm"
            ),
            "sourceLastConsulted": "2012-10-16",
            "urlMatchLevel": "independent-exact-original-url-citation",
            "publicationVersionCaveat": (
                "An academic bibliography names Guadalupe Sánchez Robles, "
                "the same article title with accented 'rebelión', "
                "and the exact frozen /CUCSH/Sincronia/TEXTO.htm URL "
                "(consulted 16 October 2012). It does not establish "
                "current original page availability. The indexed "
                "unaccented title and issue 2 (1997) remain unchanged."
            ),
        },
    },
    "cucsh:sincronia-legacy:f095b499eee85b7b339e": {
        "title": "Hijos de desaparecidos, hilos de memoria para el futuro",
        "author": "Ludmila da Silva Catela",
        "issue": 10,
        "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/hijos.htm",
        "status": "original-page-unavailable",
        "evidence": {
            "kind": "preserved-byline-plus-independent-journal-exact-filename",
            "sourceUrl": (
                "https://www.comisionporlamemoria.org/archivos/"
                "jovenesymemoria/bibliografia_web/memorias/daSilva.pdf"
            ),
            "sourceInstitution": "Comisión Provincial por la Memoria",
            "sourceTextPdfPage": 1,
            "sourceByline": "Ludmila da Silva Catela",
            "sourceAffiliation": "PPGS-IFCS-UFRJ",
            "supportingSourceUrl": (
                "https://revistasacademicas.unsam.edu.ar/index.php/"
                "etnocontemp/article/view/995"
            ),
            "supportingInstitution": "Universidad Nacional de San Martín",
            "supportingJournal": "Etnografías Contemporáneas",
            "supportingPublicationYear": 2021,
            "supportingCitationYear": 1999,
            "supportingCitedOriginalUrlVariant": (
                "http://sincronia.cucsh.udg.mx/hijos.htm"
            ),
            "additionalSourceUrl": (
                "https://www.comisionporlamemoria.org/archivos/"
                "jovenesymemoria/bibliografia_web/memorias.html"
            ),
            "additionalSourceCitedOriginalUrl": (
                "http://fuentes.csh.udg.mx/CUCSH/Sincronia/hijos.htm"
            ),
            "urlMatchLevel": (
                "institutional-original-url-exact-plus-journal-"
                "alternative-host-and-preserved-byline"
            ),
            "publicationVersionCaveat": (
                "Comisión Provincial por la Memoria preserves a full-text "
                "copy signed Ludmila da Silva Catela and its indexed reading "
                "list cites the exact frozen /CUCSH/Sincronia/hijos.htm URL. "
                "An independent UNSAM journal reference cites the same "
                "work and author in 1999 using a different historical host, "
                "sincronia.cucsh.udg.mx. Preserve the original host, "
                "unavailable status, indexed title and issue 10 (1999); "
                "do not assume that either historical host remains live."
            ),
        },
    },
}


def restore_two(data):
    records = data["records"]
    ids = [r.get("id") for r in records]
    sin = [r for r in records if r.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH corpus size or record identifiers drifted")
    if sum(not r.get("authors") for r in sin) != 57:
        raise ValueError("Expected exactly 57 outstanding Sincronía bylines")

    changed = []
    for row in records:
        rid = row.get("id")
        if rid not in SOURCES:
            continue
        expected = SOURCES[rid]
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != expected["issue"]
            or row.get("year") != expected["year"]
            or row.get("title") != expected["title"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != expected["url"]
            or (row.get("legacyAccessStatus") or {}).get("status") != expected["status"]
        ):
            raise ValueError("Frozen Sincronía identity mismatch: " + str(rid))
        row["authors"] = [
            {"name": expected["author"], "sourceName": expected["author"]}
        ]
        row["legacyAuthorEvidence"] = {
            **expected["evidence"],
            "verifiedAuthor": expected["author"],
            "verifiedTitle": expected["title"],
            "sourceArticleUrl": expected["url"],
            "matchedIndexedIssue": expected["issue"],
            "matchedIndexedYear": expected["year"],
            "originalAvailabilityPreserved": True,
        }
        changed.append(rid)

    if len(changed) != 2 or set(changed) != set(SOURCES):
        raise ValueError("Expected exactly two independently documented works")
    if ids != [r.get("id") for r in records]:
        raise ValueError("Original stable ID sequence changed")
    if sum(not r.get("authors") for r in sin) != 55:
        raise ValueError("Expected exactly 55 outstanding missing bylines")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_two(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_CATELA_SANCHEZ_VERIFIED", json.dumps({
        "changed": changed,
        "records": len(updated["records"]),
        "remainingAuthorless": 55,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

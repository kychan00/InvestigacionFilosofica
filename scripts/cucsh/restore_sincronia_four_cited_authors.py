#!/usr/bin/env python3
"""Restore four early Sincronía bylines with source-specific provenance.

No title, issue, year, original URL, legacy accessibility status or stable
ID is changed. The cited 1996 and 1998/1999 discrepancies are explicitly
preserved; an alternate historical hostname is not an exact URL match.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SOURCES = {
    "cucsh:sincronia-legacy:2862de74b175a62ad727": {
        "title": "La amortajada: una lectura cubista",
        "author": "Dinora Cardoso",
        "issue": 5,
        "year": 1998,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/cardoso.html",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "peer-reviewed-article-cites-author-title-and-historical-filename",
            "sourceUrl": (
                "https://acontracorriente.chass.ncsu.edu/index.php/"
                "acontracorriente/article/download/294/504"
            ),
            "sourceWork": (
                "Decir con el cuerpo. La resignificación del sujeto femenino "
                "en La amortajada de María Luisa Bombal"
            ),
            "sourceAuthor": "Noelia Domínguez Romero",
            "sourceJournal": "A Contracorriente",
            "sourcePrintedPage": 77,
            "sourceFootnote": 18,
            "sourceCitationYear": 1996,
            "sourceCitationUrl": "http://sincronia.cucsh.udg.mx/cardoso.html",
            "supportingSourceUrl": (
                "https://www.academia.edu/105591391/TESIS_DE_MAESTRIA_BAME_2009"
            ),
            "urlMatchLevel": "same-filename-alternative-historic-host",
            "publicationVersionCaveat": (
                "The journal's frozen issue 5 is dated 1998. The 2012 scholarly "
                "citation says 1996 and uses the sincronia.cucsh.udg.mx host. "
                "Neither the historical year nor the fuentes.csh.udg.mx "
                "original URL is replaced; edition identity is not assumed."
            ),
        },
    },
    "cucsh:sincronia-legacy:f52b3a238b2a635b5d7d": {
        "title": "Por qué Borges sí escribe el implícito 'yo'",
        "author": "Ruth Levy Vázquez",
        "issue": 10,
        "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/levy.htm",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "author-bibliography-exact-filename-plus-independent-republication",
            "sourceUrl": "https://www.letrascomoespada.com/escritores/ruth_levy.php",
            "sourceAuthorDisplayName": "Ruth Levy Vázquez",
            "sourceCitedJournal": "Sincronía. Revista virtual del CUCSH, U de G",
            "sourceCitationUrl": "http://sincronia.cucsh.udg.mx/levy.htm",
            "supportingSourceUrl": (
                "https://clubdetraductoresliterariosdebaires.blogspot.com/"
                "2012/09/otra-vez-whitman.html"
            ),
            "supportingCitationYear": 1998,
            "supportingCitationAuthor": "Ruth Levy",
            "urlMatchLevel": "same-filename-alternative-historic-host",
            "publicationVersionCaveat": (
                "An independent 2012 republication attributes the text to "
                "Ruth Levy and dates its Sincronía publication to 1998, "
                "while the frozen issue 10 index says 1999. Preserve 1999, "
                "the original title and the fuentes.csh.udg.mx URL."
            ),
        },
    },
    "cucsh:sincronia-legacy:b8467200ead63981a0eb": {
        "title": (
            'Singularidades derivadas del paralelismo entre Tom King y '
            'Relipe Rivera: Personajes de Jack London en "Por un bistec" '
            'y "El mexicano"'
        ),
        "author": "Ruth Levy Vázquez",
        "issue": 10,
        "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/levy2.htm",
        "status": "original-page-unavailable",
        "evidence": {
            "kind": "author-bibliography-exact-filename-and-identifiable-title-variant",
            "sourceUrl": "https://www.letrascomoespada.com/escritores/ruth_levy.php",
            "sourceAuthorDisplayName": "Ruth Levy Vázquez",
            "sourceCitedJournal": "Sincronía. Revista virtual del CUCSH, U de G",
            "sourceCitationUrl": "http://sincronia.cucsh.udg.mx/levy2.htm",
            "sourceTitleVariant": (
                "Singularidades derivadas del paralelismo entre Tom King "
                "y Felipe Rivera; personajes de Jack London en Por un bistec, "
                "y en El mexicano"
            ),
            "legacyIndexTitleDiscrepancy": (
                "Legacy index says 'Relipe Rivera'; author bibliography says "
                "'Felipe Rivera'. Original index title preserved without "
                "claiming the historic page content was recovered."
            ),
            "urlMatchLevel": "same-filename-alternative-historic-host",
            "publicationVersionCaveat": (
                "The source bibliography confirms author, work, Sincronía and "
                "levy2.htm on a different historical hostname; no original "
                "page accessibility or URL equivalence is implied."
            ),
        },
    },
    "cucsh:sincronia-legacy:8390a8acd92c86af5d07": {
        "title": "Artur Lundkvist, un puente entre dos continentes",
        "author": "Víctor Montoya",
        "issue": 10,
        "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/montoya1.html",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "author-bylined-republication-exact-distinctive-title",
            "sourceUrl": (
                "https://auroraboreal.net/actualidad/la-columna-de-victor-"
                "montoya/692-artur-lundkvist-un-puente-entre-dos-continentes"
            ),
            "sourceSection": "La columna de Víctor Montoya",
            "sourceRepublishedDate": "2011-02-11",
            "supportingSourceUrl": "https://rebelion.org/autor/victor-montoya/?pag=4",
            "supportingSourceDate": "2009-07-09",
            "urlMatchLevel": "matching-distinctive-title-no-exact-original-url-proof",
            "publicationVersionCaveat": (
                "A signed 2011 version and a 2009 author archive attribute the "
                "unique title to Víctor Montoya. Sincronía's historical index "
                "dates the entry to issue 10 (1999), but the cited versions "
                "do not prove its exact original contents or URL. Preserve "
                "all frozen original metadata and archived-only status."
            ),
        },
    },
}


def restore_four(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen corpus size or stable record identifiers")
    if sum(not r.get("authors") for r in sin) != 70:
        raise ValueError("Expected exactly 70 outstanding Sincronía authorless records")
    changed = []
    for row in rows:
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
            raise ValueError("Frozen Sincronía identity mismatch for " + rid)
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
    if set(changed) != set(SOURCES) or len(changed) != 4:
        raise ValueError("Expected exactly four unique fully matched source IDs")
    if ids != [r.get("id") for r in rows]:
        raise ValueError("Source stable ID ordering unexpectedly changed")
    if sum(not r.get("authors") for r in sin) != 66:
        raise ValueError("Expected 66 pending authorless Sincronía records")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    data = json.loads(a.input.read_text(encoding="utf-8"))
    updated, changed = restore_four(data)
    a.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_FOUR_EVIDENCED_BYLINES", json.dumps({
        "changed": changed,
        "records": len(updated["records"]),
        "remainingAuthorless": 66,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Recover four directly signed Sincronía historical HTML works (issues 5,9,11).

All four bylines were observed in archived original URL captures. Preserve
source ID, title, chronological issue, historical URL and access status.
Older source copyright dates and slight title variants are noted, not changed.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


SOURCES = {
    "cucsh:sincronia-legacy:4869f07f890d2997ddb1": {
        "title": "Cronotopía y marginalidad discursiva en la novela _Los muros de agua_ de José Revueltas",
        "author": "Javier Durán",
        "printedByline": "Javier Durán",
        "issue": 5, "year": 1998,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/duran.html",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/19980422194142/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/duran.html",
        "timestamp": "19980422194142",
        "archivePageTitle": "duran",
        "archiveArticleTitle": "Cronotopía y marginalidad discursiva en la novela Los muros de agua de José Revueltas",
        "evidence": {
            "sourcePrintedAffiliation": "Universidad Estatal de Michigan",
            "sourcePrintedCopyrightYear": 1996,
            "sourcePreviousPublicationClaim": (
                "The historic article itself says it was previously "
                "published in Las Jornadas de Estudios Culturales Metropolitanas."
            ),
            "titleVariation": (
                "Indexed markdown underscores around Los muros de agua "
                "are presentation markup, not part of the archive heading."
            ),
            "publicationVersionCaveat": (
                "Original article bears Javier Durán's 1996 copyright. "
                "Frozen Sincronía index puts the reproduced work in "
                "issue 5 (1998). Do not replace journal year with "
                "original copyright year or conflate editions."
            ),
        },
    },
    "cucsh:sincronia-legacy:47f368eb8611d2cb666e": {
        "title": "Consideraciones acerca de William Butler Yeats",
        "author": "Alex Friederich",
        "printedByline": "Alex Friederich",
        "issue": 9, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/freiderich.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/19991109222710/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/freiderich.htm",
        "timestamp": "19991109222710",
        "archivePageTitle": "Ma Ing Yeats",
        "archiveArticleTitle": "Consideraciones acerca de William Butler Yeats",
        "evidence": {
            "legacyFilenameSpellingCaution": (
                "Frozen filename is /freiderich.htm, while signed "
                "article byline spells surname Friederich. Do not "
                "derive a corrected URL from the author's name."
            ),
            "publicationVersionCaveat": (
                "Original source page's HTML document title 'Ma Ing Yeats' "
                "differs from its visible article heading, which exactly "
                "matches the Sincronía index. Preserve that distinction."
            ),
        },
    },
    "cucsh:sincronia-legacy:e69ddb50657568d3613a": {
        "title": "Listening to the old stones of Oaxaca",
        "author": "Peter Costantini",
        "printedByline": "Peter Costantini",
        "issue": 9, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/listenin.html",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/19991014034009/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/listenin.html",
        "timestamp": "19991014034009",
        "archivePageTitle": "Listening to the old stones of Oaxaca",
        "archiveArticleTitle": "Listening to the old stones of Oaxaca",
        "evidence": {
            "authorOtherSignedSincroniaWork": (
                "The same Peter Costantini is signed in issue 1 (1996) "
                "at /costantini.html, independently recovered from "
                "a Wayback snapshot. No filename-to-author inference needed."
            ),
            "publicationVersionCaveat": (
                "The signed original /listenin.html capture matches "
                "the unique original title. Preserve journal issue 9 "
                "year 1999 and archived-only original status."
            ),
        },
    },
    "cucsh:sincronia-legacy:092c265452a009c0ddf5": {
        "title": "Los elementos ocultistas en la obra de Jorge Luis Borges",
        "author": "Arnulfo Eduardo Velasco",
        "printedByline": "Arnulfo Eduardo Velasco",
        "issue": 11, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/velasco.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20000526104647/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/velasco.htm",
        "timestamp": "20000526104647",
        "archivePageTitle": "Sincronía Verano 1999",
        "archiveArticleTitle": "ELEMENTOS OCULTISTAS EN LA OBRA DE JORGE LUIS BORGES",
        "evidence": {
            "sourcePrintedAffiliation": "Universidad de Guadalajara",
            "titleVariation": (
                "Original archived heading omits index's leading 'Los' "
                "and uses uppercase styling. Preserve frozen index title."
            ),
            "publicationVersionCaveat": (
                "Original URL capture identifies Velasco in Sincronía "
                "Verano 1999. Similar name-only entries in later issues "
                "must not inherit this byline without their own evidence."
            ),
        },
    },
}


def restore_four(data):
    records = data["records"]
    ids = [r.get("id") for r in records]
    sin = [r for r in records if r.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen corpus size or original stable IDs changed")
    if sum(not r.get("authors") for r in sin) != 47:
        raise ValueError("Expected 47 authorless Sincronía records")

    changed = []
    for row in records:
        rid = row.get("id")
        if rid not in SOURCES:
            continue
        s = SOURCES[rid]
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != s["issue"]
            or row.get("year") != s["year"]
            or row.get("title") != s["title"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != s["url"]
            or (row.get("legacyAccessStatus") or {}).get("status") != s["status"]
        ):
            raise ValueError("Source identity mismatch in signed Wayback article: " + str(rid))
        row["authors"] = [{"name": s["author"], "sourceName": s["author"]}]
        row["legacyAuthorEvidence"] = {
            "kind": "direct-original-sincronia-html-signed-wayback-capture",
            "sourceUrl": s["snapshot"],
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceCaptureTimestamp": s["timestamp"],
            "sourcePageTitle": s["archivePageTitle"],
            "sourceArticleTitle": s["archiveArticleTitle"],
            "sourcePrintedByline": s["printedByline"],
            "sourceArticleUrl": s["url"],
            "urlMatchLevel": "exact-original-url-http-default-port-normalization",
            "matchedIndexedIssue": s["issue"],
            "matchedIndexedYear": s["year"],
            "verifiedAuthor": s["author"],
            "verifiedTitle": s["title"],
            "originalAvailabilityPreserved": True,
            "note": (
                "Original signed historical Sincronía page captured by "
                "Internet Archive. The frozen indexed original URL remains "
                "marked archived-only, since capture does not prove live "
                "access to the historic original."
            ),
            **s["evidence"],
        }
        changed.append(rid)
    if set(changed) != set(SOURCES) or len(changed) != 4:
        raise ValueError("Expected exactly four independent original HTML signatures")
    if ids != [r.get("id") for r in records]:
        raise ValueError("Original stable index ID ordering changed")
    if sum(not r.get("authors") for r in sin) != 43:
        raise ValueError("Expected exactly 43 outstanding missing bylines")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_four(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_SECOND_FOUR_SIGNED_RESTORED", json.dumps({
        "changed": changed, "records": len(updated["records"]),
        "remainingAuthorless": 43,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

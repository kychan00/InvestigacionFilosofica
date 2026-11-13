#!/usr/bin/env python3
"""Restore four issue-1/2 bylines from preserved, signed original Sincronía HTML.

The exact historical URLs (allowing HTTP default :80 port) were inspected
in archived pages, including live original bibliographic signatures. This is
evidence of old publication attribution, NOT evidence that old pages are live.
Gilbert's indexed title differs materially from the page title; preserve the
index and annotate the discrepancy, preserving translator as translator only.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

SOURCES = {
    "cucsh:sincronia-legacy:436f156845f87b644223": {
        "title": "La traducción del inglés al español de los Collected Papers de Charles Sanders Peirce,",
        "author": "Fernando Carlos Vevia Romero",
        "printedByline": "Fernando C. Vevia Romero",
        "issue": 1,
        "year": 1996,
        "url": "http://sincronia.cucsh.udg.mx/vevia.html",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20070101101312/http://sincronia.cucsh.udg.mx:80/vevia.html",
        "timestamp": "20070101101312",
        "archivePageTitle": "Sincronia Winter96 Vevia",
        "archiveArticleTitle": "La traducción del inglés al español de los Collected Papers de Charles Sanders Peirce",
        "evidence": {
            "sourcePrintedAffiliation": "Departamento de Filosofía, Universidad de Guadalajara",
            "fullNameCorroborationUrl": "https://www.unav.es/gep/Peirce-esp.html",
            "titleVariation": "Legacy title has trailing comma; signed article heading does not.",
        },
    },
    "cucsh:sincronia-legacy:53ca1099d5f51b81cc33": {
        "title": "Nicaragua´s Thermidorian Reaction",
        "author": "Peter Costantini",
        "printedByline": "Peter Costantini, Seattle",
        "issue": 1,
        "year": 1996,
        "url": "http://sincronia.cucsh.udg.mx/costantini.html",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20070101103945/http://sincronia.cucsh.udg.mx:80/costantini.html",
        "timestamp": "20070101103945",
        "archivePageTitle": "Sincronia Winter96 Costantini",
        "archiveArticleTitle": "Nicaragua's Thermidorian Reaction",
        "evidence": {
            "sourcePrintedAffiliation": "Correspondent, Interpress Service",
            "titleVariation": "Legacy index uses acute apostrophe; primary article uses ASCII apostrophe.",
        },
    },
    "cucsh:sincronia-legacy:af98cc00a0388baabb3d": {
        "title": "Publicación electrónica en Latinoamerica,",
        "author": "Stephen W. Gilbert",
        "printedByline": "Stephen W. Gilbert",
        "issue": 1,
        "year": 1996,
        "url": "http://sincronia.cucsh.udg.mx/gilbert.html",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20061010001837/http://sincronia.cucsh.udg.mx/gilbert.html",
        "timestamp": "20061010001837",
        "archivePageTitle": "Sincronia Winter96 Gilbert1",
        "archiveArticleTitle": "Publicaciones Electrónicas en México",
        "evidence": {
            "sourcePrintedAffiliation": "Departamento de Letras, Universidad de Guadalajara",
            "creditedTranslatorNotCoauthor": "Dolores Pérez Padilla",
            "indexedVsArchivedTitleDiscrepancy": (
                "The index says 'Publicación electrónica en Latinoamerica,' "
                "but this exact original /gilbert.html contains a signed "
                "work titled 'Publicaciones Electrónicas en México'. "
                "Do not silently replace the indexed work or assert that "
                "the two distinct titles identify identical editions."
            ),
            "historicalFounderCorroborationUrl": (
                "https://paakat.cugdl.udg.mx/index.php/paakat/article/view/264/html"
            ),
            "bibliographicIdentityCaution": (
                "Author is attributed to the actual preserved source at the "
                "exact historical URL; work-title mismatch remains unresolved."
            ),
        },
    },
    "cucsh:sincronia-legacy:5a5c77cbf7b126732d8e": {
        "title": "Debate sobre desaparecidos en la Argentina de Menem",
        "author": "Alicia Fignoni",
        "printedByline": "Alicia Fignoni *",
        "issue": 2,
        "year": 1997,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/figioni.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/19980211204646/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/figioni.htm",
        "timestamp": "19980211204646",
        "archivePageTitle": "figioni.html",
        "archiveArticleTitle": "Debate sobre desaparecidos en la Argentina de Menem",
        "evidence": {
            "sourceSubheading": "Por la memoria y contra la impunidad.",
            "legacyFilenameSpellingCaution": (
                "The frozen URL says figioni.htm, but the signed author "
                "in its original 1998 archive capture is Alicia Fignoni. "
                "Never derive or correct the historical URL from the name."
            ),
            "sourcePrintedBylineAsterisk": (
                "The signed header adds a footnote asterisk after Fignoni; "
                "it is not part of her name."
            ),
        },
    },
}


def restore_four(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH corpus size or unique identifier mismatch")
    if sum(not r.get("authors") for r in sin) != 51:
        raise ValueError("Expected exactly 51 unresolved Sincronía authors")

    changed = []
    for row in rows:
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
            raise ValueError("Historical record not matching signed archived URL: " + str(rid))
        row["authors"] = [
            {"name": s["author"], "sourceName": s["author"]}
        ]
        row["legacyAuthorEvidence"] = {
            "kind": "signed-original-sincronia-html-wayback-matching-original-url",
            "sourceUrl": s["snapshot"],
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceCaptureTimestamp": s["timestamp"],
            "sourcePageTitle": s["archivePageTitle"],
            "sourceArticleTitle": s["archiveArticleTitle"],
            "sourcePrintedByline": s["printedByline"],
            "sourceArticleUrl": s["url"],
            "urlMatchLevel": "exact-historical-url-with-optional-http-default-port",
            "matchedIndexedIssue": s["issue"],
            "matchedIndexedYear": s["year"],
            "verifiedAuthor": s["author"],
            "verifiedTitle": s["title"],
            "originalAvailabilityPreserved": True,
            "note": (
                "The archived original URL displays the byline in the "
                "article's own heading. Historical accessibility recorded "
                "by this corpus is intentionally NOT updated: a Wayback "
                "snapshot does not establish live original site access."
            ),
            **s["evidence"],
        }
        changed.append(rid)

    if set(changed) != set(SOURCES) or len(changed) != 4:
        raise ValueError("Exactly four signed and verified articles must match")
    if ids != [r.get("id") for r in rows]:
        raise ValueError("The stable ID order changed unexpectedly")
    if sum(not r.get("authors") for r in sin) != 47:
        raise ValueError("Expected exactly 47 outstanding authorless Sincronía records")
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
    print("SINCRONIA_ARCHIVED_PRIMARY_BYLINES", json.dumps({
        "changed": changed, "records": len(updated["records"]),
        "remainingAuthorless": 47,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

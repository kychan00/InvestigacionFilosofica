#!/usr/bin/env python3
"""Restore four signatures from archived original Sincronía HTML pages.

No change is allowed beyond authors and legacyAuthorEvidence on exactly four
frozen work IDs. The book author, compiler, reviewer and interviewee roles
must never be conflated; original issue-year, URL and archived availability
remain unmodified.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SOURCES = {
    "cucsh:sincronia-legacy:4784c1d977cea2ee58c4": {
        "title": "Nuevas Tecnologias, Nuevas Profesiones",
        "authors": ["Bernardo Méndez Lugo"],
        "printedByline": "Bernardo Méndez Lugo",
        "issue": 9, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/anuies.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/19991010131106/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/anuies.htm",
        "timestamp": "19991010131106",
        "sourcePageTitle": "NUEVAS TECNOLOGIAS, NUEVAS PROFESIONES",
        "sourceArticleTitle": "NUEVAS TECNOLOGIAS, NUEVAS PROFESIONES",
        "evidence": {
            "sourceWorkType": "signed-commentary-on-a-published-book",
            "titleIdentityCaveat": (
                "The original /anuies.htm page is signed Bernardo Méndez "
                "Lugo and opens by describing a BOOK of that title, jointly "
                "published by ANUIES. The byline belongs to the Sincronía "
                "commentary/review, not necessarily to the reviewed book. "
                "Keep the original unaccented indexed title and 1999 issue."
            ),
        },
    },
    "cucsh:sincronia-legacy:935efad9845e05a0557f": {
        "title": "Mercado laboral y sociedad civil",
        "authors": ["Álvaro Ortega Santos"],
        "printedByline": "Álvaro Ortega Santos",
        "issue": 10, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/mercado.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/19991103010830/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/mercado.htm",
        "timestamp": "19991103010830",
        "sourcePageTitle": "Mercado Laboral Y Sociedad Civil",
        "sourceArticleTitle": "MERCADO LABORAL Y SOCIEDAD CIVIL",
        "evidence": {
            "sourceOpeningSection": "Resumen",
            "titleIdentityCaveat": (
                "The original /mercado.htm article has the matching unique "
                "heading and explicitly prints Álvaro Ortega Santos above "
                "the Resumen. The frozen record uses sentence-case title "
                "and the original page is still marked unavailable."
            ),
        },
    },
    "cucsh:sincronia-legacy:8eded0eac6e2a217ade1": {
        "title": "Korstanje, Maximiliano E.",
        "authors": ["Maximiliano E. Korstanje"],
        "printedByline": "Reseñado por Maximiliano E. Korstanje",
        "issue": 50, "year": 2009,
        "url": "http://sincronia.cucsh.udg.mx/korstanjespring09.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20090617223756/http://sincronia.cucsh.udg.mx:80/korstanjespring09.htm",
        "timestamp": "20090617223756",
        "sourcePageTitle": (
            "Las Fobias libro publicado ya hace varios años, 1984 por Jorge Sauré "
            "es un interesante aporte al estudio de las fobias"
        ),
        "sourceArticleTitle": "Las fobias (reseña de libro)",
        "evidence": {
            "sourceIssueHeading": "Sincronía Spring 2009",
            "sourceWorkType": "signed-book-review",
            "sourcePrintedAffiliation": "Universidad de Palermo, Argentina, Departamento de Ciencias Económicas",
            "reviewedBookTitle": "Las fobias",
            "reviewedBookCompilerNotReviewer": "Jorge Saurí",
            "reviewedBookCitationYear": 1986,
            "reviewedBookCitationPublisher": "Buenos Aires, Ediciones Nueva Visión",
            "titleIdentityCaveat": (
                "The original archive credits 'Reseñado por Maximiliano E. "
                "Korstanje', a REVIEW of the book 'Las fobias'. Jorge Saurí "
                "is the BOOK COMPILER, not author of this Sincronía review. "
                "The HTML title mentions 1984 while the book citation on "
                "the page says (1986); retain both as unverified original "
                "source details, not the journal year. Historical index "
                "uses the reviewer's name as its work label."
            ),
        },
    },
    "cucsh:sincronia-legacy:d033194e9ccdac732454": {
        "title": "After Chenalho: No More Business as Usual",
        "authors": ["Jorge G. Castañeda"],
        "printedByline": "by Jorge G. Castañeda",
        "issue": 4, "year": 1997,
        "url": "http://sincronia.cucsh.udg.mx/castaned.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20060712162834/http://sincronia.cucsh.udg.mx:80/castaned.htm",
        "timestamp": "20060712162834",
        "sourcePageTitle": 'Casta=F1eda, "After Chenalho: No More = Business as Usual"',
        "sourceArticleTitle": "After Chenalho: No More Business as Usual",
        "evidence": {
            "sourceWorkType": "signed-political-commentary",
            "sourceHistoricalEvent": "Chenalhó massacre in Chiapas, December 1997",
            "titleIdentityCaveat": (
                "The original /castaned.htm capture explicitly prints "
                "'by Jorge G. Castañeda' under the same distinctive title. "
                "It discusses the December 1997 massacre, while the "
                "frozen index identifies Sincronía issue 4 (1997); "
                "do not infer a separate publication date or change "
                "the original year. HTML metadata contains quoted-printable "
                "'Casta=F1eda', not a reliable normalized title."
            ),
        },
    },
}


def restore_four(data):
    records = data["records"]
    ids = [row.get("id") for row in records]
    sin = [row for row in records if row.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH/Sincronía counts or IDs changed")
    if sum(not row.get("authors") for row in sin) != 20:
        raise ValueError("Expected exactly 20 authorless Sincronía records")

    changed = []
    for row in records:
        rid = row.get("id")
        if rid not in SOURCES:
            continue
        src = SOURCES[rid]
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != src["issue"]
            or row.get("year") != src["year"]
            or row.get("title") != src["title"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != src["url"]
            or (row.get("legacyAccessStatus") or {}).get("status") != src["status"]
        ):
            raise ValueError("Frozen historical article identity mismatch: " + str(rid))
        row["authors"] = [
            {"name": author, "sourceName": author} for author in src["authors"]
        ]
        row["legacyAuthorEvidence"] = {
            "kind": "original-sincronia-html-signed-byline-in-wayback-exact-url",
            "sourceUrl": src["snapshot"],
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceCaptureTimestamp": src["timestamp"],
            "sourcePageTitle": src["sourcePageTitle"],
            "sourceArticleTitle": src["sourceArticleTitle"],
            "sourcePrintedByline": src["printedByline"],
            "sourceArticleUrl": src["url"],
            "urlMatchLevel": "exact-historic-original-url-with-http-default-port",
            "matchedIndexedIssue": src["issue"],
            "matchedIndexedYear": src["year"],
            "verifiedAuthors": src["authors"],
            "verifiedTitle": src["title"],
            "originalAvailabilityPreserved": True,
            "note": (
                "The source is an original signed historical Sincronía HTML "
                "page preserved by Wayback; it does not prove live original "
                "host availability or imply the reviewer authored the "
                "book reviewed. Frozen source fields are unmodified."
            ),
            **src["evidence"],
        }
        changed.append(rid)

    if set(changed) != set(SOURCES) or len(changed) != 4:
        raise ValueError("Exactly four source-signed originals required")
    if ids != [row.get("id") for row in records]:
        raise ValueError("Original stable record ID ordering changed")
    if sum(not row.get("authors") for row in sin) != 16:
        raise ValueError("Expected 16 remaining authorless Sincronía records")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_four(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_FOUR_SIGNED_ISSUES4_9_10_50", json.dumps({
        "changed": changed, "records": len(updated["records"]),
        "remainingAuthorless": 16,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

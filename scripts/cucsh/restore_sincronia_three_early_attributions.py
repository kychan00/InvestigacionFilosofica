#!/usr/bin/env python3
"""Restore three Sincronía bylines from primary and institutional sources.

These independently identified work titles have primary authorship evidence,
but different original-publication dates or formats. Preserved Sincronía
index dates and URLs are immutable. Do not infer that the journal version
is identical to the earlier original, proceedings, or hosted copy.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ORIGINALS = {
    "cucsh:sincronia-legacy:2ad2651b1385f83fe201": {
        "title": "Notes on NAFTA: The Masters of Mankind",
        "author": "Noam Chomsky",
        "issue": 4,
        "year": 1997,
        "url": "http://sincronia.cucsh.udg.mx/chomnaft.html",
        "status": "original-page-unavailable",
        "evidence": {
            "kind": "original-publication-plus-independent-republication",
            "sourceUrl": "https://thenation.s3.amazonaws.com/pdf/chomskynafta1993.pdf",
            "sourcePublisher": "The Nation",
            "sourcePublicationDate": "1993-03-29",
            "supportingSourceUrl": (
                "https://www.iatp.org/sites/default/files/"
                "Notes_on_NAFTA_The_Masters_of_Mankind.htm"
            ),
            "sourceAttribution": "NOAM CHOMSKY",
            "sourceArticleUrl": "http://sincronia.cucsh.udg.mx/chomnaft.html",
            "urlMatchLevel": "same-distinctive-work-title-no-external-exact-url-proof",
            "publicationVersionCaveat": (
                "Original published in The Nation in 1993. Sincronía's "
                "historical index attributes the item to issue 4 in 1997. "
                "Do not infer exact reprint version or live original URL."
            ),
        },
    },
    "cucsh:sincronia-legacy:47f5cd235eeaf767503a": {
        "title": (
            "La Apreciación del Cine: Docencia, Periodismo Critico "
            "y Algunas Encrucijadas"
        ),
        "author": "Alfredo Naime Padua",
        "issue": 1,
        "year": 1996,
        "url": "http://sincronia.cucsh.udg.mx/naime.htm",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "institutional-conference-archive-two-independent-documents",
            "sourceUrl": (
                "https://bibliotecadigitalconeicc.iteso.mx/bitstream/"
                "handle/123456789/7451/CD22.pdf?sequence=1"
            ),
            "sourceInstitution": "CONEICC / ITESO academic archive",
            "sourceYear": 1997,
            "sourceEvent": "IX Encuentro CONEICC, Querétaro, 20 March 1997",
            "sourceCatalogEntry": "9528 C",
            "supportingSourceUrl": (
                "https://bibliotecadigitalconeicc.iteso.mx/bitstream/"
                "handle/123456789/7241/AI234.pdf?sequence=1"
            ),
            "sourceArticleUrl": "http://sincronia.cucsh.udg.mx/naime.htm",
            "urlMatchLevel": "same-distinctive-title-no-external-exact-url-proof",
            "publicationVersionCaveat": (
                "Two 1997 CONEICC archival items attribute the matching "
                "conference title to Alfredo Naime Padua. The preserved "
                "Sincronía index dates its item to issue 1 (1996). "
                "This establishes authorship of the same-titled work, not "
                "identity of 1996 journal and 1997 conference versions."
            ),
        },
    },
    "cucsh:sincronia-legacy:790efb932e2d1e805ff2": {
        "title": "The Life of a Maquiladora Worker",
        "author": "David Bacon",
        "issue": 4,
        "year": 1997,
        "url": "http://sincronia.cucsh.udg.mx/maquilad.html",
        "status": "original-page-unavailable",
        "evidence": {
            "kind": "interviewers-original-site-same-unique-title",
            "sourceUrl": "https://dbacon.igc.org/Portrait/01MaLife.htm",
            "sourceAttribution": "Interview by David Bacon",
            "sourceOriginalDate": "1996-08-09",
            "workRole": "interviewer-and-narrative-reporter",
            "sourceArticleUrl": "http://sincronia.cucsh.udg.mx/maquilad.html",
            "urlMatchLevel": "same-distinctive-title-no-external-exact-url-proof",
            "publicationVersionCaveat": (
                "David Bacon's original site bears the exact same work "
                "title and explicit 'Interview by David Bacon' attribution "
                "dated 9 Aug 1996. Sincronía's preserved issue 4 dates "
                "its entry to 1997. An external record does not prove "
                "full text equivalence or current access to the original."
            ),
        },
    },
}


def restore_three(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen corpus count or stable IDs")
    if sum(not r.get("authors") for r in sin) != 73:
        raise ValueError("Expected exactly 73 unresolved Sincronía authors")

    changed = []
    for row in rows:
        rid = row.get("id")
        if rid not in ORIGINALS:
            continue
        f = ORIGINALS[rid]
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != f["issue"]
            or row.get("year") != f["year"]
            or row.get("title") != f["title"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != f["url"]
            or (row.get("legacyAccessStatus") or {}).get("status") != f["status"]
        ):
            raise ValueError("Frozen Sincronía identity mismatch: " + rid)

        row["authors"] = [{"name": f["author"], "sourceName": f["author"]}]
        row["legacyAuthorEvidence"] = {
            **f["evidence"],
            "verifiedAuthor": f["author"],
            "verifiedTitle": f["title"],
            "matchedIndexedIssue": f["issue"],
            "matchedIndexedYear": f["year"],
            "originalAvailabilityPreserved": True,
        }
        changed.append(rid)

    if set(changed) != set(ORIGINALS) or len(changed) != 3:
        raise ValueError("Required exactly three distinct frozen works")
    if ids != [r.get("id") for r in rows]:
        raise ValueError("Original stable ID ordering changed")
    if sum(not r.get("authors") for r in sin) != 70:
        raise ValueError("Expected exactly 70 remaining unresolved authors")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_three(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_THREE_EVIDENCED_BYLINES", json.dumps({
        "changed": changed, "records": len(updated["records"]),
        "remainingAuthorless": 70,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

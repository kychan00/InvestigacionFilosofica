#!/usr/bin/env python3
"""Restore three signed original Sincronía issue-4 pages, no metadata loss.

All source URLs were verified at exact historical hosts in the Wayback
archival deep investigation. Keep the issue-4 year, original titles, IDs,
access status and article ordering unchanged. Do not attribute the reviewed
book to the book's reviewer.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

SOURCES = {
    "cucsh:sincronia-legacy:2126d56c91012923e100": {
        "title": "American Frontiers, Gregory H. Nobles",
        "author": "Daniel Mandell",
        "printedByline": "by Daniel Mandell",
        "issue": 4, "year": 1997,
        "url": "http://sincronia.cucsh.udg.mx/mandell.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20060712163355/http://sincronia.cucsh.udg.mx:80/mandell.htm",
        "timestamp": "20060712163355",
        "sourcePageTitle": "Date sent: Fri, 09 Jan 1998 13:28:41 -0600",
        "sourceArticleTitle": "American Frontiers",
        "evidence": {
            "sourceWorkType": "signed-book-review",
            "reviewedBookTitle": "American Frontiers: Cultural Encounters and Continental Conquest",
            "reviewedBookAuthorNotReviewer": "Gregory H. Nobles",
            "reviewedBookYear": 1997,
            "sourceOriginalEmailDate": "1998-01-09",
            "sourceEditionCaveat": (
                "The exact /mandell.htm original archive is signed 'by "
                "Daniel Mandell' and explicitly identifies Gregory H. Nobles "
                "as author of the BOOK being reviewed. The archived page "
                "contains an email-style 'Date sent' line of 9 January 1998, "
                "while the frozen Sincronía index associates the item with "
                "issue 4 (1997). Retain both facts without harmonizing "
                "them or treating Nobles as author of this review."
            ),
        },
    },
    "cucsh:sincronia-legacy:350cd62320155bec831b": {
        "title": "¿Amigos o Enemigos?",
        "author": "Sergio Aguayo Quezada",
        "printedByline": "Sergio Aguayo Quezada",
        "issue": 4, "year": 1997,
        "url": "http://sincronia.cucsh.udg.mx/sergio.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20060712163129/http://sincronia.cucsh.udg.mx:80/sergio.htm",
        "timestamp": "20060712163129",
        "sourcePageTitle": "Sergio Aguayo Quezada/¿Amigos o enemigos",
        "sourceArticleTitle": "¿Amigos o Enemigos?",
        "evidence": {
            "sourceWorkType": "signed-political-commentary",
            "sourceSubject": "Mexican and United States political/cultural relations",
            "sourceTimeContext": "150 years after the 1847 Mexico-US War, discussed in article",
            "sourceEditionCaveat": (
                "The original /sergio.htm page displays the exact indexed "
                "title '¿Amigos o Enemigos?' and the explicit byline "
                "'Sergio Aguayo Quezada'. The text discusses a Reforma "
                "Enfoque survey and historical 1847 events, but its "
                "timestamp is a later Wayback capture and does not "
                "establish a distinct publication date. Preserve "
                "issue 4 (1997) and the unavailable original URL."
            ),
        },
    },
    "cucsh:sincronia-legacy:63fcb1b95f79aa94948b": {
        "title": "El deber de la critica",
        "author": "Adolfo Aguilar Zinser",
        "printedByline": "Adolfo Aguilar Zinser",
        "issue": 4, "year": 1997,
        "url": "http://sincronia.cucsh.udg.mx/zinser.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20060712163224/http://sincronia.cucsh.udg.mx:80/zinser.htm",
        "timestamp": "20060712163224",
        "sourcePageTitle": "",
        "sourceArticleTitle": "El deber de la crítica",
        "evidence": {
            "sourceWorkType": "signed-political-essay",
            "sourceDedication": "A José Agustín Ortiz Pinchetti",
            "sourceEditionCaveat": (
                "The original /zinser.htm source page explicitly prints "
                "'Adolfo Aguilar Zinser' followed by the essay heading "
                "'El deber de la crítica' and dedication to José Agustín "
                "Ortiz Pinchetti. The frozen index drops the accent in "
                "'critica'; preserve historical title, year, URL, "
                "original unavailable status and issue number unchanged."
            ),
        },
    },
}


def restore_three(data):
    records = data["records"]
    ids = [r.get("id") for r in records]
    journal = [r for r in records if r.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(journal) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH/Sincronía corpus size or stable IDs changed")
    if sum(not r.get("authors") for r in journal) != 16:
        raise ValueError("Expected precisely 16 authorless Sincronía records")

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
            raise ValueError("Frozen original issue-4 work identity mismatch: " + str(rid))
        row["authors"] = [{"name": src["author"], "sourceName": src["author"]}]
        row["legacyAuthorEvidence"] = {
            "kind": "signed-exact-original-sincronia-url-wayback-html",
            "sourceUrl": src["snapshot"],
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceCaptureTimestamp": src["timestamp"],
            "sourcePageTitle": src["sourcePageTitle"],
            "sourceArticleTitle": src["sourceArticleTitle"],
            "sourcePrintedByline": src["printedByline"],
            "sourceArticleUrl": src["url"],
            "urlMatchLevel": "exact-historical-url-allow-http-default-port",
            "verifiedAuthor": src["author"],
            "verifiedTitle": src["title"],
            "matchedIndexedIssue": src["issue"],
            "matchedIndexedYear": src["year"],
            "originalAvailabilityPreserved": True,
            "note": (
                "The captured page at the exact frozen original historic "
                "URL carries an explicit source byline. Access to a "
                "Wayback capture does not imply that the old host is live."
            ),
            **src["evidence"],
        }
        changed.append(rid)
    if set(changed) != set(SOURCES) or len(changed) != 3:
        raise ValueError("Expected exactly three original signed issue-4 articles")
    if ids != [r.get("id") for r in records]:
        raise ValueError("Original source order changed")
    if sum(not r.get("authors") for r in journal) != 13:
        raise ValueError("Expected precisely 13 remaining authorless Sincronía entries")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_three(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_THREE_ISSUE4_PRIMARY", json.dumps({
        "changed": changed, "totalCorpus": len(updated["records"]),
        "remainingAuthorless": 13,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

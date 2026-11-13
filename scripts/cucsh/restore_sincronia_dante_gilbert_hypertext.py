#!/usr/bin/env python3
"""Recover two Sincronía issue-eight credits from a signed, linked source index.

The original 1998 section index explicitly identifies Dante Medina as the
poet of 'Maneras de describir a Ana' with the 'Atreverse' link, and prints
'Hypertextualizado por Stephen W. Gilbert' directly beside that link.
Neither the linked poem nor the hypertext page has its own printed signature;
the explicit section attribution, exact original link and paired archived
content are documented separately. Preserve index labels, years, URLs, IDs
and original-page-unavailable status; do NOT attribute the biography.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

INDEX_CAPTURE = (
    "https://web.archive.org/web/19980211193619/"
    "http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/dante/dindex.html"
)
INDEX_ORIGINAL = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/dindex.html"
EARLIER_INDEX_CAPTURE = (
    "https://web.archive.org/web/19970629182728/"
    "http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/dindex.html"
)
PREFIX = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/"

SOURCES = {
    "cucsh:sincronia-legacy:4800ef829bfca4e699cb": {
        "title": "Atreverse",
        "author": "Dante Medina",
        "filename": "ana.html",
        "snapshot": (
            "https://web.archive.org/web/19980211210102/"
            "http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/dante/ana.html"
        ),
        "timestamp": "19980211210102",
        "sectionHeading": "Maneras de Describir a Ana",
        "indexPrintedCredit": "Dante Medina",
        "indexLinkLabel": "Atreverse",
        "sourceArticleOpening": "A ana le gustan los aeropuertos",
        "evidence": {
            "sourceWorkKind": "literary-hypertext-poem",
            "sourceCollectionAuthor": "Dante Medina",
            "sourceCollectionTitle": "Maneras de describir a ana",
            "sourceCollectionIntroContext": (
                "The original 1998 Sincronía hypertext index describes the "
                "origin of the poems as notes toward Dante Medina's novel "
                "La Dama de la Gardenia and their later independent collection."
            ),
            "sourceSourceRoleWarning": (
                "'Atreverse' is the actual link label in the collection "
                "index; 'A ana le gustan los aeropuertos' is the opening "
                "of the linked poetic hypertext, not a proven alternate "
                "bibliographic title. The bio.html page is a separate "
                "author biography, not a scholarly article."
            ),
        },
    },
    "cucsh:sincronia-legacy:582537d89e07194c5970": {
        "title": "Hypertextualizado",
        "author": "Stephen W. Gilbert",
        "filename": "hyper.html",
        "snapshot": (
            "https://web.archive.org/web/19980211210024/"
            "http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/dante/hyper.html"
        ),
        "timestamp": "19980211210024",
        "sectionHeading": "Hypertextualizado",
        "indexPrintedCredit": "Hypertextualizado por Stephen W. Gilbert",
        "indexLinkLabel": "Hypertextualizado",
        "sourceArticleOpening": "What can it possibly mean???",
        "evidence": {
            "sourceWorkKind": "editorial-hypertext-experiment",
            "sourceSectionAuthor": "Stephen W. Gilbert",
            "sourceSourceRoleWarning": (
                "The original source index prints 'Hypertextualizado por "
                "Stephen W. Gilbert' immediately adjacent to the original "
                "hyper.html link. The linked page starts in English with "
                "'What can it possibly mean???'. Its source page does "
                "not independently display a byline, and should NOT "
                "be attributed to Dante Medina merely because the "
                "URL is inside the dante/ folder."
            ),
        },
    },
}


def restore_two(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sincronia = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sincronia) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH/Sincronía corpus counts or stable IDs drifted")
    if sum(not r.get("authors") for r in sincronia) != 6:
        raise ValueError("Expected six authorless Sincronía records")

    changed = []
    for row in rows:
        rid = row.get("id")
        if rid not in SOURCES:
            continue
        src = SOURCES[rid]
        exact_url = PREFIX + src["filename"]
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 8
            or row.get("year") != 1998
            or row.get("title") != src["title"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != exact_url
            or (row.get("legacyAccessStatus") or {}).get("status")
            != "original-page-unavailable"
        ):
            raise ValueError("Original historical hypertext work identity mismatch: " + str(rid))
        row["authors"] = [{"name": src["author"], "sourceName": src["author"]}]
        row["legacyAuthorEvidence"] = {
            "kind": "explicit-signed-1998-original-section-index-and-exact-linked-work",
            "sourceUrl": INDEX_CAPTURE,
            "sourceSectionIndexOriginalUrl": INDEX_ORIGINAL,
            "sourceEarlierIndexCapture": EARLIER_INDEX_CAPTURE,
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceIndexCaptureTimestamp": "19980211193619",
            "sourceIndexPrintedCredit": src["indexPrintedCredit"],
            "sourceSectionHeading": src["sectionHeading"],
            "sourceIndexLinkLabel": src["indexLinkLabel"],
            "sourceIndexExactLinkedOriginalUrl": exact_url,
            "sourceArticleUrl": exact_url,
            "sourceWorkCaptureUrl": src["snapshot"],
            "sourceWorkCaptureTimestamp": src["timestamp"],
            "sourceArticleOpening": src["sourceArticleOpening"],
            "sourcePrintedAuthorOnWorkPage": False,
            "sourceAuthorCreditOnExactLinkedSectionIndex": True,
            "verifiedAuthor": src["author"],
            "verifiedTitle": src["title"],
            "matchedIndexedIssue": 8,
            "matchedIndexedYear": 1998,
            "urlMatchLevel": "exact-historical-original-hypertext-index-link",
            "originalAvailabilityPreserved": True,
            "publicationVersionCaveat": (
                "An earlier snapshot of the section index exists in June "
                "1997; the frozen journal source catalogs this item under "
                "Sincronía issue 8 (1998). Retain that year and article "
                "label. The original linked page lacks its own explicit "
                "byline, but the distinct author is named next to its "
                "exact URL in the preserved original section index. "
                "Wayback access is not equivalent to live original access."
            ),
            **src["evidence"],
        }
        changed.append(rid)
    if len(changed) != 2 or set(changed) != set(SOURCES):
        raise ValueError("Expected exactly two signed 1998 hypertext index items")
    if ids != [r.get("id") for r in rows]:
        raise ValueError("Original record order changed")
    if sum(not r.get("authors") for r in sincronia) != 4:
        raise ValueError("Expected precisely four unattributed legacy records")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_two(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_DANTE_GILBERT_HYPERTEXT_RESTORED", json.dumps({
        "changed": changed,
        "records": len(updated["records"]),
        "remainingUnattributed": 4,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

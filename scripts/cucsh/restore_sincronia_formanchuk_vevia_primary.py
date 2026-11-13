#!/usr/bin/env python3
"""Restore two primary signed Sincronía works whose indexes contain author names.

All source dates, original URLs, journal issue labels, original record IDs,
original availability and page ordering remain frozen. Substantive article
titles are recorded only in legacyAuthorEvidence, never overwritten.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

SOURCES = {
    "cucsh:sincronia-legacy:c620fd33bd50bf1b7558": {
        "title": "Formanchuk, Alejandro E.",
        "author": "Alejandro E. Formanchuk",
        "printedByline": "ALEJANDRO E. FORMANCHUK",
        "issue": 16, "year": 2000,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/formanchuk2.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20010611171110/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/formanchuk2.htm",
        "timestamp": "20010611171110",
        "sourcePageTitle": (
            "Como una aspiradora, el pago de los intereses de la deuda "
            "absorbe gran parte del presupuesto nacional"
        ),
        "sourceArticleTitle": "El nudo gordiano",
        "evidence": {
            "sourceIssueHeading": "Sincronía Otoño 2000",
            "sourcePrintedContact": "mariscal@elsitio.net",
            "titleIdentityCaveat": (
                "The historical index uses 'Formanchuk, Alejandro E.' "
                "where the original /formanchuk2.htm page displays "
                "'El nudo gordiano' followed by the explicit signature "
                "'ALEJANDRO E. FORMANCHUK'. The distinct HTML page title "
                "is a sentence about foreign-debt interest payments, not "
                "the work's displayed article title. Preserve index "
                "metadata and archived-only original status unchanged."
            ),
        },
    },
    "cucsh:sincronia-legacy:a88181602b07562a8656": {
        "title": "Vevia Romero,Fernando Carlos",
        "author": "Fernando Carlos Vevia Romero",
        "printedByline": "Fernando Carlos Vevia Romero",
        "issue": 12, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/vevia2.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20000124192116/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/vevia2.htm",
        "timestamp": "20000124192116",
        "sourcePageTitle": "Sincronia Fall99",
        "sourceArticleTitle": "La dimensión filosófica del dolor",
        "evidence": {
            "sourceIssueHeading": "Sincronía Fall/Otoño 1999",
            "sourcePrintedAffiliation": "Universidad de Guadalajara",
            "authorOtherOriginalSignedArticle": (
                "http://sincronia.cucsh.udg.mx/vevia.html"
            ),
            "titleIdentityCaveat": (
                "The historical index uses 'Vevia Romero,Fernando Carlos' "
                "as an item label, while the signed original /vevia2.htm "
                "page is titled 'La dimensión filosófica del dolor'. "
                "The same researcher's issue 1 work on Peirce is a "
                "distinct article at a distinct original URL. Keep both "
                "work identities separate and preserve issue 12 (1999)."
            ),
        },
    },
}


def restore_two(data):
    records = data["records"]
    ids = [r.get("id") for r in records]
    sin = [r for r in records if r.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH source corpus size or stable IDs changed")
    if sum(not r.get("authors") for r in sin) != 38:
        raise ValueError("Expected exactly 38 missing Sincronía bylines")

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
            raise ValueError("Historical source signature mismatch for " + str(rid))
        row["authors"] = [{"name": s["author"], "sourceName": s["author"]}]
        row["legacyAuthorEvidence"] = {
            "kind": "signed-original-sincronia-wayback-page-exact-url",
            "sourceUrl": s["snapshot"],
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceCaptureTimestamp": s["timestamp"],
            "sourcePageTitle": s["sourcePageTitle"],
            "sourceArticleTitle": s["sourceArticleTitle"],
            "sourcePrintedByline": s["printedByline"],
            "sourceArticleUrl": s["url"],
            "urlMatchLevel": "exact-historical-url-with-optional-http-default-port",
            "matchedIndexedIssue": s["issue"],
            "matchedIndexedYear": s["year"],
            "verifiedAuthor": s["author"],
            "verifiedTitle": s["title"],
            "originalAvailabilityPreserved": True,
            "note": (
                "The source is a captured original page with explicit "
                "author byline and article heading. This does not "
                "establish that the historic original URL is online."
            ),
            **s["evidence"],
        }
        changed.append(rid)

    if len(changed) != 2 or set(changed) != set(SOURCES):
        raise ValueError("Exactly two source-verified works must match")
    if ids != [r.get("id") for r in records]:
        raise ValueError("Stable original index ordering changed")
    if sum(not r.get("authors") for r in sin) != 36:
        raise ValueError("Expected exactly 36 outstanding missing authors")
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
    print("SINCRONIA_FORMANCHUK_VEVIA_BYLINES", json.dumps({
        "changed": changed, "totalCorpus": len(updated["records"]),
        "remainingAuthorless": 36,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

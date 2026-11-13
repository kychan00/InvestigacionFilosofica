#!/usr/bin/env python3
"""Restore five signatures from original Sincronía Wayback captures.

All five work indexes are frozen. In particular reyes4.htm is documented
as a 1999 historical original whose distinct 2001 bibliographic URL/edition
MUST NOT be conflated or silently renumbered.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

SOURCES = {
    "cucsh:sincronia-legacy:b8a6aaed44652dfc1a74": {
        "title": "Introducción",
        "author": "Kathy Leonard",
        "printedByline": "Introducción de Kathy Leonard",
        "issue": 7, "year": 1998,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/leonard.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/19991014003147/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/leonard.htm",
        "timestamp": "19991014003147",
        "sourcePageTitle": "introLeonard",
        "sourceArticleTitle": "Introducción",
        "evidence": {
            "sourceContextTitle": "Revelación en la literatura: entrevistas a autoras bolivianas",
            "sourcePrintedOpening": (
                "Estas seis entrevistas a autoras bolivianas forman parte "
                "de una obra más amplia que será publicada en dos volúmenes."
            ),
            "sourceWorkType": "signed-introduction-to-interview-collection",
            "titleIdentityCaveat": (
                "The exact /leonard.htm page expressly says 'Introducción "
                "de Kathy Leonard'. Other issue-7 pages about Yolanda Bedregal "
                "and other interviewed Bolivian authors are biographical "
                "profiles and must NOT inherit Kathy Leonard's signature "
                "without page-specific evidence."
            ),
        },
    },
    "cucsh:sincronia-legacy:2e5cafc18653b60bce9f": {
        "title": "Clemente, William A.",
        "author": "William A. Clemente",
        "printedByline": "by Dr. William A. Clemente",
        "issue": 12, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/clemente2.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20000531070915/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/clemente2.htm",
        "timestamp": "20000531070915",
        "sourcePageTitle": "Priest and Teacher, Pastoral Conflict in Earl Lovelace's The Schoolmaster",
        "sourceArticleTitle": "Priest and Teacher, Pastoral Conflict in Earl Lovelace's The Schoolmaster",
        "evidence": {
            "sourceIssueHeading": "Sincronía Fall 1999",
            "sourcePrintedAffiliation": "Peru State College",
            "titleIdentityCaveat": (
                "The historical Sincronía index lists only the author's "
                "name; the original /clemente2.htm page displays an explicit "
                "byline and an article title about Earl Lovelace's novel "
                "The Schoolmaster. Preserve the original index label."
            ),
        },
    },
    "cucsh:sincronia-legacy:498c90b4e581430b8d98": {
        "title": "Rhodes, Robin,",
        "author": "Robin Rhodes",
        "printedByline": "Robin Rhodes",
        "issue": 12, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/rhodes.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20000930034118/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/rhodes.htm",
        "timestamp": "20000930034118",
        "sourcePageTitle": "Sincronia Fall 1999 Rhodes",
        "sourceArticleTitle": "Mexican Indigenous Rights Movement: Life and Rights of the Nahua of the Pueblan Sierra",
        "evidence": {
            "sourceIssueHeading": "Sincronía Fall 1999",
            "sourcePrintedContext": "British Council-CONACYT exchange scheme, Puebla, Mexico, 1999",
            "titleIdentityCaveat": (
                "The frozen name-only index says 'Rhodes, Robin,' including "
                "an extra comma. The exact /rhodes.htm page instead identifies "
                "a signed study of the Nahua of the Sierra of Puebla. "
                "Keep original year, label, URL and unavailable status."
            ),
        },
    },
    "cucsh:sincronia-legacy:53c3bea7bff8e9572369": {
        "title": "Reyes, Giovanni E.",
        "author": "Giovanni Efraín Reyes Ortiz",
        "printedByline": "Giovanni E. Reyes",
        "issue": 12, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/reyes4.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20000930034103/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/reyes4.htm",
        "timestamp": "20000930034103",
        "sourcePageTitle": "Reyes Sincronia Summer 1999",
        "sourceArticleTitle": "Main Characteristics of Latin American Economies 1960-1995: A Historical Synthesis",
        "evidence": {
            "sourceIssueHeading": "Sincronía Summer 1999",
            "sourcePrintedAffiliation": (
                "University of Pittsburgh, Graduate School of Public and International Affairs"
            ),
            "expandedAuthorNameSource": (
                "https://research-hub.urosario.edu.co/display/giovanni-efrain-reyes-ortiz"
            ),
            "conflictingLaterBibliographicUrl": "http://sincronia.cucsh.udg.mx/reyes4.htm",
            "conflictingLaterBibliographyUrl": (
                "https://redcol.minciencias.gov.co/Record/"
                "EDOCUR2_d1b56980606f7282399f02fe43ee1f1c/Details"
            ),
            "conflictingLaterPublicationTitle": (
                "Four main theories of development: modernization, "
                "dependency, world-systems, and globalization"
            ),
            "conflictingLaterPublicationIssue": 21,
            "conflictingLaterPublicationYear": 2001,
            "titleIdentityCaveat": (
                "The 2000 Wayback snapshot at the exact frozen /CUCSH/Sincronia/"
                "reyes4.htm URL shows a 1999 signed article titled 'Main "
                "Characteristics of Latin American Economies 1960-1995: "
                "A Historical Synthesis'. A Universidad del Rosario catalogue "
                "cites a distinct article 'Four main theories of development' "
                "in issue 21 (2001) under a similar /reyes4.htm path on the "
                "OTHER sincronia.cucsh.udg.mx hostname. Treat as a material "
                "identity/edition and URL reuse conflict. Preserve issue 12 "
                "(1999), original title, source URL and unavailable status; "
                "never overwrite the earlier record with the 2001 work."
            ),
        },
    },
    "cucsh:sincronia-legacy:a3e241ad29f293bd2136": {
        "title": "Velasco,Arnulfo Eduardo,",
        "author": "Arnulfo Eduardo Velasco",
        "printedByline": "Arnulfo Eduardo Velasco",
        "issue": 12, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/velasco2.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20000124171224/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/velasco2.htm",
        "timestamp": "20000124171224",
        "sourcePageTitle": "Sincronía Fall99 Velasco",
        "sourceArticleTitle": (
            "Algunas notas para la lectura de los primeros versos "
            "del Primero sueño de Sor Juana Inés de la Cruz"
        ),
        "evidence": {
            "sourceIssueHeading": "Sincronía Otoño/Fall 1999",
            "sourcePrintedTitleVariation": (
                "Archive heading is uppercase and presents an apparent "
                "'SUEÑ0' zero/digit typography in 'Primero sueño'."
            ),
            "titleIdentityCaveat": (
                "Frozen index lists only 'Velasco,Arnulfo Eduardo,' as "
                "the work title; the original /velasco2.htm page signs "
                "an article on Sor Juana's Primero sueño. This is distinct "
                "from Velasco's separately signed Borges work /velasco.htm."
            ),
        },
    },
}


def restore_five(data):
    rows = data["records"]
    ids = [row.get("id") for row in rows]
    sin = [row for row in rows if row.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH/Sincronía corpus or unique IDs drifted")
    if sum(not row.get("authors") for row in sin) != 32:
        raise ValueError("Expected precisely 32 outstanding authorless Sincronía records")
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
            raise ValueError("Frozen signed original URL identity mismatch: " + str(rid))
        row["authors"] = [{"name": s["author"], "sourceName": s["author"]}]
        row["legacyAuthorEvidence"] = {
            "kind": "signed-original-sincronia-wayback-url-capture",
            "sourceUrl": s["snapshot"],
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceCaptureTimestamp": s["timestamp"],
            "sourcePageTitle": s["sourcePageTitle"],
            "sourceArticleTitle": s["sourceArticleTitle"],
            "sourcePrintedByline": s["printedByline"],
            "sourceArticleUrl": s["url"],
            "urlMatchLevel": "exact-historic-original-url-with-optional-http-port80",
            "matchedIndexedIssue": s["issue"],
            "matchedIndexedYear": s["year"],
            "verifiedAuthor": s["author"],
            "verifiedTitle": s["title"],
            "originalAvailabilityPreserved": True,
            "note": (
                "Original historic Sincronía source page displays the "
                "listed signature. A Wayback snapshot does not imply "
                "the old original URL is currently accessible. "
                "Keep legacy catalogue title, issue, year and URL frozen."
            ),
            **s["evidence"],
        }
        changed.append(rid)
    if set(changed) != set(SOURCES) or len(changed) != 5:
        raise ValueError("Expected exactly five distinct signed source articles")
    if ids != [row.get("id") for row in rows]:
        raise ValueError("Original stable record ordering changed")
    if sum(not row.get("authors") for row in sin) != 27:
        raise ValueError("Expected 27 outstanding Sincronía authorless records")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_five(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_FIVE_SIGNED_ISSUE7_12", json.dumps({
        "changed": changed, "records": len(updated["records"]),
        "pendingAuthorless": 27,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

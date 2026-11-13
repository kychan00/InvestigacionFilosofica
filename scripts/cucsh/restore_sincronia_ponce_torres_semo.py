#!/usr/bin/env python3
"""Recover three verified Sincronía author attributions in one safe batch.

Each cited source identifies the author and same-titled original work.
None establishes that a historical original URL is live or that the journal
reproduction is textually identical to a related publication. All original
index titles, URLs, issue-year data, IDs and archival statuses are retained.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


SOURCES = {
    "cucsh:sincronia-legacy:d05c71dc56ce9de30325": {
        "title": "Los animales en Pedro Páramo,",
        "author": "Francisco Javier Ponce",
        "issue": 1,
        "year": 1996,
        "url": "http://sincronia.cucsh.udg.mx/javier.html",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "independent-literature-bibliography-exact-title-and-byline",
            "sourceUrl": (
                "https://radiodecimafm.blogspot.com/2010/02/"
                "juan-rulfo-semblanza-obras-fotografias.html"
            ),
            "sourceBibliographicTitle": "Los animales en Pedro Páramo",
            "sourceByline": "Francisco Javier Ponce",
            "sourceAffiliation": "Departamento de Letras, Universidad de Guadalajara",
            "sourceAnnotatedLink": "https://sololiteratura.com/rul/rullosanimales.htm",
            "sourcePreservation": (
                "An independently copied 2010 Rulfo reading list explicitly "
                "names the author and affiliation, linking to another "
                "historical distribution site rather than the Sincronía URL."
            ),
            "urlMatchLevel": "same-distinctive-title-bylined-secondary-index-no-exact-url-proof",
            "publicationVersionCaveat": (
                "This 2010 bibliography attributes the article's exact title "
                "to Francisco Javier Ponce, Departamento de Letras, UdeG. "
                "The frozen Sincronía issue 1 index (1996) retains a final "
                "comma in its title and the archived-only /javier.html URL. "
                "The other distribution URL is not equated with this one."
            ),
        },
    },
    "cucsh:sincronia-legacy:93b476f9a80dd8f7f950": {
        "title": (
            "Internet: lucha 'posmoderna' de los desposeidos de la modernidad "
            "(The Internet: Postmodern Stuggle by the Dispossessed of Modernity)"
        ),
        "author": "María Elena Martínez Torres",
        "issue": 4,
        "year": 1997,
        "url": "http://sincronia.cucsh.udg.mx/torres.htm",
        "status": "original-page-unavailable",
        "evidence": {
            "kind": "learned-society-program-plus-university-press-bibliography",
            "sourceUrl": (
                "https://forum.lasaweb.org/cmsb/uploads/lasaforum-vol28-issue1.pdf"
            ),
            "sourceInstitution": "Latin American Studies Association",
            "sourceInstitutionalCitationAuthor": "Martínez Torres, María Elena",
            "sourceProgramTitle": (
                "Internet: lucha 'posmoderna' de los desposeídos de la modernidad"
            ),
            "sourceEvent": "LASA annual meeting, Guadalajara, 17–19 April 1997",
            "supportingSourceUrl": (
                "https://manifold.umn.edu/read/hacked-transmissions/"
                "section/01c43045-a756-42cf-95cd-fd4bc79f9f8a"
            ),
            "supportingInstitution": "University of Minnesota Press",
            "supportingWork": "Hacked Transmissions, bibliography",
            "supportingPublicationYear": 1997,
            "supportingCitedTitle": (
                "Internet: Lucha 'posmoderna' de los desposeidos "
                "de la modernidad"
            ),
            "urlMatchLevel": "scholarly-matching-title-author-no-exact-original-url-proof",
            "publicationVersionCaveat": (
                "The LASA 1997 conference program and a University of Minnesota "
                "Press bibliography independently cite this unusually titled "
                "work by María Elena Martínez Torres, originally a LASA paper. "
                "The historic Sincronía issue 4 entry (1997) adds an English "
                "parenthetical translation with index spelling 'Stuggle'. "
                "Preserve journal title and unavailable /torres.htm URL and "
                "do not claim conference/journal versions are identical."
            ),
        },
    },
    "cucsh:sincronia-legacy:9f8bcc3ac5b0e0ceec5d": {
        "title": "Reinventando a la izquierda mexicana",
        "author": "Enrique Semo",
        "issue": 4,
        "year": 1997,
        "url": "http://sincronia.cucsh.udg.mx/izqsemo.html",
        "status": "original-page-unavailable",
        "evidence": {
            "kind": "independent-politics-academic-reprint-exact-author-title-year",
            "sourceUrl": "https://ietd.mx/adolfo-sanchez-rebolledo-1942-2016/",
            "sourceWork": "La izquierda que viví",
            "sourceAuthorCitation": "Enrique Semo",
            "sourceTitleCitation": "Reinventando a la izquierda mexicana",
            "sourceOriginalVenue": "Proceso",
            "sourceOriginalIssue": 1075,
            "sourceOriginalDate": "1997-06-08",
            "urlMatchLevel": "same-exact-distinctive-work-title-no-original-url-proof",
            "publicationVersionCaveat": (
                "An academic remembrance of Adolfo Sánchez Rebolledo "
                "cites Enrique Semo's exact-titled article in Proceso 1075 "
                "of 8 June 1997. Sincronía's issue 4 (1997) index contains "
                "the same title and a suggestive /izqsemo.html filename. "
                "Authorship of the original is evidenced, but the external "
                "citation does not prove that journal/Proceso texts are "
                "identical or that the original Sincronía page is accessible."
            ),
        },
    },
}


def restore_three(data):
    records = data["records"]
    ids = [r.get("id") for r in records]
    sin = [r for r in records if r.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH/Sincronía corpus size or ID count changed")
    if sum(not r.get("authors") for r in sin) != 55:
        raise ValueError("Expected exactly 55 unresolved Sincronía authors")

    changed = []
    for row in records:
        rid = row.get("id")
        if rid not in SOURCES:
            continue
        source = SOURCES[rid]
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != source["issue"]
            or row.get("year") != source["year"]
            or row.get("title") != source["title"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != source["url"]
            or (row.get("legacyAccessStatus") or {}).get("status") != source["status"]
        ):
            raise ValueError("Frozen historical record identity mismatch: " + str(rid))
        row["authors"] = [
            {"name": source["author"], "sourceName": source["author"]}
        ]
        row["legacyAuthorEvidence"] = {
            **source["evidence"],
            "verifiedAuthor": source["author"],
            "verifiedTitle": source["title"],
            "sourceArticleUrl": source["url"],
            "matchedIndexedIssue": source["issue"],
            "matchedIndexedYear": source["year"],
            "originalAvailabilityPreserved": True,
        }
        changed.append(rid)
    if len(changed) != 3 or set(changed) != set(SOURCES):
        raise ValueError("Expected exactly three previously unattributed works")
    if ids != [r.get("id") for r in records]:
        raise ValueError("Frozen original ID order changed")
    if sum(not r.get("authors") for r in sin) != 52:
        raise ValueError("Expected exactly 52 remaining unresolved authors")
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
    print("SINCRONIA_PONCE_TORRES_SEMO_VERIFIED", json.dumps({
        "changed": changed,
        "records": len(updated["records"]),
        "remainingAuthorless": 52,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

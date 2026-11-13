#!/usr/bin/env python3
"""Restore three issue-five Sincronía bylines using independent bibliographies.

For each record, only authors and legacyAuthorEvidence may change.
Differences in original titles, editions, years and website availability
are annotated, not 'corrected' without article-level historical evidence.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SOURCES = {
    "cucsh:sincronia-legacy:059b7d0f41b2d5e6b432": {
        "title": 'Entre la realidad y el sueño: la parodia como arma de subversión en "Tosca" de Isabel Allende"',
        "author": "Jacoba Koene",
        "issue": 5,
        "year": 1998,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/koene.html",
        "status": "original-page-unavailable",
        "evidence": {
            "kind": "independent-academic-journal-article-exact-subject-and-title-variant",
            "sourceUrl": (
                "https://www.enotes.com/topics/eva-luna/criticism/criticism/"
                "claire-lindsay-essay-date-december-2001"
            ),
            "sourceWork": (
                "Claire Lindsay, Re-Reading the Romance: Genre and Gender "
                "in Isabel Allende's 'Niña perversa'"
            ),
            "sourceJournal": "Romance Studies",
            "sourceJournalVolume": "19(2)",
            "sourceJournalYear": 2001,
            "sourceJournalPages": "135–147",
            "sourceCitationTitleVariant": (
                'Entre la realidad y el sueño: la parodia como subversión '
                'en "Tosca" de Isabel Allende'
            ),
            "sourceCitationAuthor": "Jacoba Koene",
            "urlMatchLevel": "same-identifiable-work-title-variant-no-exact-original-url-proof",
            "publicationVersionCaveat": (
                "Claire Lindsay's peer-reviewed analysis attributes an "
                "identifiably matching study of Isabel Allende's 'Tosca' "
                "to Jacoba Koene, with a shorter title variant omitting "
                "'arma de'. The frozen Sincronía record is issue 5 (1998). "
                "Preserve its full indexed title and unavailable URL "
                "without assuming the external publication verifies "
                "the original file or its full contents."
            ),
        },
    },
    "cucsh:sincronia-legacy:9a7379b008ee994c6e3a": {
        "title": "The Rhetoric of Diversity Salemanship",
        "author": "Bruce C. Wearne",
        "issue": 5,
        "year": 1998,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/wearne.htm",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "researcher-publication-bibliography-exact-essay-with-index-typo",
            "sourceUrl": "https://allofliferedeemed.co.uk/bruce-c-wearne/",
            "sourceResearcher": "Bruce C. Wearne",
            "sourceListingYear": 1998,
            "sourceListedTitle": "The Rhetoric of Diversity Salesmanship",
            "sourceWorkDescription": (
                "Review essay of Bill Cope and Mary Kalantzis, Productive "
                "Diversity: A New Australian Model for Work and Management, "
                "Pluto Press (1997)"
            ),
            "indexedTitleDiscrepancy": (
                "Historical index spells 'Salemanship'; author's "
                "bibliography spells 'Salesmanship'."
            ),
            "urlMatchLevel": "researcher-bibliography-title-variant-no-exact-original-url-proof",
            "publicationVersionCaveat": (
                "An independent biographical publication inventory of Bruce "
                "C. Wearne lists the distinctive essay in its 1998 section. "
                "Sincronía issue 5 dates its item 1998 but misspells "
                "'Salesmanship' as 'Salemanship'. Preserve the indexed "
                "spelling, original /wearne.htm URL and archived-only "
                "availability; no live URL or edition equivalence is inferred."
            ),
        },
    },
    "cucsh:sincronia-legacy:1cacfedf2ef2aab2c502": {
        "title": "Latinos/Hispanics...What Next!",
        "author": "Martha E. Gimenez",
        "issue": 5,
        "year": 1998,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/gimenez.htm",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "yale-annotated-bibliography-plus-academic-press-bibliography",
            "sourceUrl": (
                "https://teachersinstitute.yale.edu/curriculum/"
                "units/2000/1/00.01.05/9"
            ),
            "sourceInstitution": "Yale-New Haven Teachers Institute",
            "sourceCitationAuthor": "Martha Gimenez",
            "sourceCitationTitleVariant": (
                "Latinos/Hispanics… What Next! "
                "Some reflections on the politics of identity in the U.S."
            ),
            "sourceCitedYear": 1998,
            "supportingSourceUrl": (
                "https://keywords.nyupress.org/childrens-literature/works_cited/"
            ),
            "supportingCitation": (
                "Gimenez, Martha. 'Latinos, Hispanics … What Next!' "
                "Heresies 7(27), 1993, 38–42"
            ),
            "additionalSourceUrl": (
                "https://atheneadigital.net/article/download/"
                "v21-3-espinoza/2899-pdf-es/14284"
            ),
            "additionalPublication": "Cultural Logic 1(2), 1998",
            "urlMatchLevel": "independent-bibliographies-same-unique-title-no-exact-original-url-proof",
            "publicationVersionCaveat": (
                "Yale confirms Martha Gimenez as author of the uniquely "
                "matching title and cites 1998. NYU Press's bibliography "
                "cites an earlier Heresies 1993 edition; a later academic "
                "bibliography cites Cultural Logic 1998. The Sincronía "
                "source remains issue 5 (1998), with its own historic URL "
                "and archived-only access unchanged. Do not imply the "
                "three publication manifestations are text-identical."
            ),
        },
    },
}


def restore_three(data):
    records = data["records"]
    identifiers = [row.get("id") for row in records]
    sincronia = [row for row in records if row.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(sincronia) != 1454:
        raise ValueError("Unexpected frozen CUCSH/Sincronía counts")
    if len(identifiers) != len(set(identifiers)):
        raise ValueError("Duplicate stable IDs")
    if sum(not row.get("authors") for row in sincronia) != 60:
        raise ValueError("Expected exactly 60 missing Sincronía bylines")

    changed = []
    for row in records:
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
            raise ValueError("Frozen historical identity mismatch: " + str(rid))

        row["authors"] = [{"name": expected["author"], "sourceName": expected["author"]}]
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

    if len(changed) != 3 or set(changed) != set(SOURCES):
        raise ValueError("Expected exactly three target articles")
    if identifiers != [row.get("id") for row in records]:
        raise ValueError("Source stable ID order changed")
    if sum(not row.get("authors") for row in sincronia) != 57:
        raise ValueError("Expected 57 outstanding missing Sincronía bylines")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_three(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_KOENE_WEARNE_GIMENEZ_PASS", json.dumps({
        "changed": changed,
        "records": len(updated["records"]),
        "remainingAuthorless": 57,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Restore one Sincronía 1996 byline when original index URL was corrupted.

The frozen record's only title is a comma and its original path is a
FrontPage export path that has no archived capture. A signed copy at the
historical CUCSH Sincronía host and two university bibliographies independently
identify the same work, author, venue and Winter 1996 date. Preserve the
broken original URL/title/status, never invent an exact-URL match.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

WORK_ID = "cucsh:sincronia-legacy:1578698f39fd24636e00"
ORIGINAL_TITLE = ","
ORIGINAL_URL = "http://fuentes.csh.udg.mx/FrontPage%20Webs/Content/schmid.html"
ORIGINAL_STATUS = "original-page-unavailable"
AUTHOR = "Guillermo Schmidhuber de la Mora"
RECOVERED_TITLE = (
    "La historiografía en el teatro español y mexicano: "
    "Antonio Buero Vallejo y Rodolfo Usigli"
)
PRIMARY_SNAPSHOT = (
    "https://web.archive.org/web/19980211203614/"
    "http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/schmid.html"
)
PRIMARY_HISTORIC_URL = (
    "http://fuentes.csh.udg.mx/CUCSH/Sincronia/schmid.html"
)
UNIVERSITY_OF_VERACRUZ_CITATION = (
    "https://www.uv.mx/mlm/files/2013/05/Proyecto-Def-Victor.pdf"
)
OHIO_STATE_CITATION = (
    "https://etd.ohiolink.edu/acprod/odb_etd/ws/send_file"
    "?accession=osu1041180170&disposition=inline"
)


def restore_one(data):
    rows = data["records"]
    ids = [row.get("id") for row in rows]
    sincronia = [row for row in rows if row.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sincronia) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH/Sincronía corpus or unique ID order changed")
    if sum(not row.get("authors") for row in sincronia) != 13:
        raise ValueError("Expected exactly 13 source-unattributed Sincronía entries")

    touched = []
    for row in rows:
        if row.get("id") != WORK_ID:
            continue
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 1
            or row.get("year") != 1996
            or row.get("title") != ORIGINAL_TITLE
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != ORIGINAL_URL
            or (row.get("legacyAccessStatus") or {}).get("status") != ORIGINAL_STATUS
        ):
            raise ValueError("Malformed archived index is not the frozen target")
        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyAuthorEvidence"] = {
            "kind": "signed-historic-copy-plus-two-independent-university-bibliographies",
            "verifiedAuthor": AUTHOR,
            "verifiedTitle": ORIGINAL_TITLE,
            "sourcePrintedByline": "Guillermo Schmidhuber de la Mora, PhD",
            "sourceArticleTitle": RECOVERED_TITLE,
            "sourceUrl": PRIMARY_SNAPSHOT,
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceCaptureTimestamp": "19980211203614",
            "sourceArticleUrl": ORIGINAL_URL,
            "sourceArchivedHistoricalUrl": PRIMARY_HISTORIC_URL,
            "urlMatchLevel": "same-file-stem-different-path-confirmed-by-university-bibliography",
            "sourceExactOriginalUrlWasNotCaptured": True,
            "sourceMissingOriginalUrlStatusPreserved": True,
            "sourceInstitution": "Universidad de Guadalajara, Departamento de Letras",
            "sourceIndependentCitationUrl": UNIVERSITY_OF_VERACRUZ_CITATION,
            "sourceIndependentCitationInstitution": "Universidad Veracruzana",
            "sourceIndependentCitationPage": 12,
            "sourceIndependentCitationWork": (
                "Víctor Manuel Iturbe Bravo, El humor: visión antihistórica "
                "en Corona de luz de Rodolfo Usigli (protocolo de tesis, bibliography)"
            ),
            "sourceIndependentCitationVenueDate": "Sincronía (Invierno 1996): 1–7",
            "sourceSupportingUniversityCitationUrl": OHIO_STATE_CITATION,
            "sourceSupportingInstitution": "Ohio State University",
            "sourceSupportingCitationYear": 1996,
            "sourceSupportingCitationUrlVariant": (
                "http://fuentes.csh.udg.mx/CUCSH/Sincronia/schmid.htm"
            ),
            "matchedIndexedIssue": 1,
            "matchedIndexedYear": 1996,
            "originalAvailabilityPreserved": True,
            "titleAndUrlIdentityCaveat": (
                "The frozen 1996 issue-1 record's indexed title is only ',' "
                "and its canonical URL points at the obsolete FrontPage export "
                "path /FrontPage%20Webs/Content/schmid.html, which was not "
                "captured. A signed original-looking page from the SAME "
                "historical CUCSH Sincronía site at /CUCSH/Sincronia/schmid.html "
                "contains the article 'La historiografía en el teatro español "
                "y mexicano: Antonio Buero Vallejo y Rodolfo Usigli'. An "
                "independent Universidad Veracruzana research bibliography "
                "attributes precisely that article to Guillermo Schmidhuber "
                "de la Mora in Sincronía (Winter 1996), pages 1–7; an "
                "Ohio State thesis independently cites the same author/title "
                "and an earlier alternate /schmid.htm URL. This triangulates "
                "a probable original-record identity without proving that "
                "the broken FrontPage URL served identical content. Neither "
                "the indexed comma nor the dead URL is silently replaced."
            ),
        }
        touched.append(row["id"])
    if touched != [WORK_ID]:
        raise ValueError("Exactly one original malformed record must be attributed")
    if ids != [r.get("id") for r in rows]:
        raise ValueError("Unexpected original ID ordering change")
    if sum(not r.get("authors") for r in sincronia) != 12:
        raise ValueError("Expected exactly 12 outstanding missing bylines")
    return data, touched


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_one(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_SCHMIDHUBER_1996_TRIANGULATED", json.dumps({
        "changed": changed, "totalCorpus": len(updated["records"]),
        "remainingAuthorless": 12,
        "originalBrokenURLPreserved": True,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

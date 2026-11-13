#!/usr/bin/env python3
"""Recover three Sincronía historical bylines with cautious source attribution.

Sources: academic 1998 citations of Álvaro Marín Marín (including exact
fuentes.csh.udg.mx/caos.htm historical URL); Universidad del Rosario's
profile of Giovanni Efraín Reyes Ortiz (same unique title in 2007); and
Mexico's Secretaría de Educación Pública bibliography citing Víctor Montoya.
These are authorship sources; they do not prove historical URL availability.
The index's issue number, year, title, stable ID and original access status
MUST remain unchanged, including any publication-date discrepancies.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path


SOURCES = {
    "cucsh:sincronia-legacy:4e5377679fab612f4f00": {
        "title": "El Analisis de la Educación Superior en México mediante la Teoría del Caos",
        "author": "Álvaro Marín Marín",
        "issue": 9,
        "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/caos.htm",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "independent-academic-bibliographies-exact-original-url",
            "sourceUrl": "https://www.eumed.net/cursecon/ecolat/mx/mebb-educa.htm",
            "sourceTitle": "Efectos de la Globalización en la Educación Superior en México",
            "sourceCitationAuthor": "Marín Marín, Álvaro",
            "sourceCitedOriginalUrl": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/caos.htm",
            "supportingSourceUrl": (
                "https://acacia.org.mx/wp-content/uploads/2016/10/"
                "7.2-La-Educaci%C2%A6n-Superior-ante-el-desaf%C2%A1o-de-una-"
                "formaci%C2%A6n-pertinente-y-de-calidad-en-la-era-digital-"
                "Volumen-2-Estrategias-de-educaci%C2%A6n-en-la-era-digital.pdf"
            ),
            "supportingSourcePrintedPage": 27,
            "supportingCitedYear": 1998,
            "supportingCitedUrlVariant": "http://sincronia.cucsh.udg.mx/caos.html",
            "urlMatchLevel": "independent-exact-original-url-in-reference",
            "publicationVersionCaveat": (
                "A published bibliography links Álvaro Marín Marín to this title "
                "and cites the exact /CUCSH/Sincronia/caos.htm historical URL. "
                "A 2019 academic bibliography cites 1998 and a different "
                "/caos.html hostname, while the frozen Sincronía issue 9 "
                "catalogue says 1999. Preserve original 1999 issue/year, "
                "title and URL without assuming the site still works."
            ),
        },
    },
    "cucsh:sincronia-legacy:c28aef699b2b52b25475": {
        "title": "Latin American Armies 1945-1998: Main Events and Conceptual Approaches",
        "author": "Giovanni Efraín Reyes Ortiz",
        "issue": 9,
        "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/reyes.htm",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "named-author-institutional-research-profile-exact-title",
            "sourceUrl": "https://research-hub.urosario.edu.co/display/giovanni-efrain-reyes-ortiz",
            "sourceInstitution": "Universidad del Rosario",
            "sourceResearcher": "Giovanni Efraín Reyes Ortiz",
            "sourceIndexedPublicationYear": 2007,
            "sourceIndexedTitle": (
                "Latin American Armies 1945-1998: Main Events and Conceptual Approaches"
            ),
            "urlMatchLevel": "institutional-same-exact-title-no-original-url-proof",
            "publicationVersionCaveat": (
                "Universidad del Rosario lists this exact distinctive title "
                "among Giovanni Efraín Reyes Ortiz's publications, with "
                "2007 metadata. The historical Sincronía issue 9 index "
                "dates its /reyes.htm work 1999. Do not infer whether "
                "the 2007 item is a reissue, or change the journal date; "
                "the institutional profile does not identify /reyes.htm."
            ),
        },
    },
    "cucsh:sincronia-legacy:bda984cbcf599f16b9f5": {
        "title": "Aproximaciones a la tradición oral latinoamericana",
        "author": "Víctor Montoya",
        "issue": 10,
        "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/montoya2.htm",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "federal-education-publication-exact-author-and-title",
            "sourceUrl": (
                "https://dgeiib.basica.sep.gob.mx/files/fondo-editorial/"
                "educacion-intercultural/cgeib_00038.pdf"
            ),
            "sourceInstitution": "Secretaría de Educación Pública, México",
            "sourceWork": (
                "Reflexiones y experiencias sobre educación superior "
                "intercultural en América Latina y el Caribe, tercer encuentro regional"
            ),
            "sourceEditionYear": 2013,
            "sourcePrintedPage": 1016,
            "sourceAlternativeCitedUrl": "http://www.stormpages.com/marting/toral.htm",
            "supportingSourceUrl": (
                "https://caballodeletras.blogspot.com/2008/11/"
                "biblioteca-de-caballo-de-letras.html"
            ),
            "urlMatchLevel": "government-bibliography-exact-title-no-original-url-proof",
            "publicationVersionCaveat": (
                "The Secretaría de Educación Pública lists Montoya, Víctor, "
                "'Aproximaciones a la tradición oral latinoamericana', "
                "and a separate stormpages.com URL. The frozen Sincronía "
                "issue 10 record is dated 1999 with /montoya2.htm; "
                "no cited source establishes equivalence or live access "
                "for that original journal URL."
            ),
        },
    },
}


def restore_three(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sincronia = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sincronia) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen corpus size or stable identifiers changed")
    if sum(not r.get("authors") for r in sincronia) != 66:
        raise ValueError("Expected exactly 66 unresolved Sincronía author records")
    changed = []
    for row in rows:
        rid = row.get("id")
        if rid not in SOURCES:
            continue
        item = SOURCES[rid]
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != item["issue"]
            or row.get("year") != item["year"]
            or row.get("title") != item["title"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != item["url"]
            or (row.get("legacyAccessStatus") or {}).get("status") != item["status"]
        ):
            raise ValueError("Frozen work identity mismatch for " + rid)
        row["authors"] = [{"name": item["author"], "sourceName": item["author"]}]
        row["legacyAuthorEvidence"] = {
            **item["evidence"],
            "verifiedAuthor": item["author"],
            "verifiedTitle": item["title"],
            "sourceArticleUrl": item["url"],
            "matchedIndexedIssue": item["issue"],
            "matchedIndexedYear": item["year"],
            "originalAvailabilityPreserved": True,
        }
        changed.append(rid)
    if set(changed) != set(SOURCES) or len(changed) != 3:
        raise ValueError("Expected exactly three distinct frozen work identities")
    if ids != [r.get("id") for r in rows]:
        raise ValueError("Stable ID ordering unexpectedly changed")
    if sum(not r.get("authors") for r in sincronia) != 63:
        raise ValueError("Expected exactly 63 remaining unresolved author records")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    out, changed = restore_three(data)
    args.output.write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_THREE_INSTITUTIONAL_VERIFIED", json.dumps({
        "changed": changed,
        "records": len(out["records"]),
        "remainingAuthorless": 63,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

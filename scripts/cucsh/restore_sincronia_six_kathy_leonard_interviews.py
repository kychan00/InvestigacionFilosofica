#!/usr/bin/env python3
"""Recover six issue-seven Sincronía interviewer credits via collection-level provenance.

The six original pages are unsigned interviews of Bolivian writers. The separately
signed issue-seven introduction by Kathy Leonard explicitly describes "estas
seis entrevistas"; university/publisher book metadata credits Kathy S. Leonard
as creator of the corresponding 2001 collections, and independent republications
credit her by name on two near-verbatim interviews. This is an INTERVIEWER
attribution, not a claim that the interview subject wrote the interview,
not an exact printed byline on each original page, and not a claim that the
later volumes are textually identical. Original index entries remain frozen.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

AUTHOR = "Kathy Leonard"
INTRO_SOURCE = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/leonard.htm"
PUBLISHER_SOURCE = "https://utpdistribution.com/9780820451831/una-revelacion-desde-la-escritura/"
NATIONAL_LIBRARY_SOURCE = "https://d-nb.info/959270817/04"
POETS_BOOK_SOURCE = (
    "https://books.google.com/books/about/Una_revelaci%C3%B3n_desde_la_escritura.html"
    "?hl=en&id=3mRdAAAAMAAJ&output=html_text"
)
MONT0YA_SOURCE = "https://victormontoyaescritor.blogspot.com/2015/03/?m=0"
ENTRIES = {
    "cucsh:sincronia-legacy:4b66525607125c9d8c80": {
        "title": "Yolanda Bedregal", "interviewee": "Yolanda Bedregal",
        "filename": "bedregal.htm", "capture": "19991010172250",
        "volume": "Entrevistas a poetas bolivianas",
        "republication": "https://arcagulharevistadecultura.blogspot.com/2020/12/conexao-hispanica-yolanda-bedregal.html",
        "additionalEvidence": "Independent 2020 republication explicitly heads the near-verbatim interview 'KATHY LEONARD | Conversando con Yolanda Bedregal'.",
    },
    "cucsh:sincronia-legacy:503927fb46aa32462439": {
        "title": "Elsa Dorado de Revilla", "interviewee": "Elsa Dorado de Revilla",
        "filename": "revilla.htm", "capture": "20000930033333",
        "volume": "Entrevistas a narradoras bolivianas",
        "republication": None,
        "additionalEvidence": "The German National Library digitized publisher contents list 'Elsa Dorado de Revilla' with a separate interview section (p.54) under the Kathy S. Leonard authored volume.",
    },
    "cucsh:sincronia-legacy:8fc5dab0bf280ad85a8d": {
        "title": "Velia Calvimontes Salinas", "interviewee": "Velia Calvimontes Salinas",
        "filename": "velia.htm", "capture": "20000930033358",
        "volume": "Entrevistas a narradoras bolivianas",
        "republication": None,
        "additionalEvidence": "The German National Library digitized publisher contents list 'Velia Calvimontes Salinas' and a separate interview section (p.22) under the Kathy S. Leonard authored volume.",
    },
    "cucsh:sincronia-legacy:b25bfab1ecca1cdd248e": {
        "title": "Mery Flores Saavedra", "interviewee": "Mery Flores Saavedra",
        "filename": "saavedra.htm", "capture": "19991008071407",
        "volume": "Entrevistas a poetas bolivianas",
        "republication": "https://arcagulharevistadecultura.blogspot.com/2020/12/conexao-hispanica-mery-flores-saavedra.html",
        "additionalEvidence": "Independent 2020 republication identifies 'KATHY LEONARD | Conversando con Mery Flores Saavedra' and prints alternating interview turns KL / MFS, matching the original's opening biography.",
    },
    "cucsh:sincronia-legacy:d6ca696837c05e1b1c31": {
        "title": "Rosario Quiroga de Urquieta", "interviewee": "Rosario Quiroga de Urquieta",
        "filename": "quiroga.htm", "capture": "19991008003429",
        "volume": "Entrevistas a poetas bolivianas",
        "republication": None,
        "additionalEvidence": "Víctor Montoya's 2015 critical review of Leonard's two books explicitly lists Rosario Quiroga de Urquieta as an interviewee in the poets volume; the original Sincronía page is an interview with her.",
    },
    "cucsh:sincronia-legacy:ebe49cf611da58c8799b": {
        "title": "Roxana Sélum", "interviewee": "Roxana Sélum",
        "filename": "selum.htm", "capture": "20000930033349",
        "volume": "Entrevistas a narradoras bolivianas",
        "republication": None,
        "additionalEvidence": "The German National Library digitized contents list Roxana Sélum and a separate interview section (p.180) in the Kathy S. Leonard authored narradoras volume.",
    },
}


def restore_six(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH corpus count and stable ID identities must match")
    if sum(not r.get("authors") for r in sin) != 12:
        raise ValueError("Expected exactly 12 pending Sincronía source attributions")
    changed = []
    for row in rows:
        rid = row.get("id")
        if rid not in ENTRIES:
            continue
        src = ENTRIES[rid]
        url = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/" + src["filename"]
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 7
            or row.get("year") != 1998
            or row.get("title") != src["title"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != url
            or (row.get("legacyAccessStatus") or {}).get("status") != "original-page-unavailable"
        ):
            raise ValueError("Frozen Sincronía interview identity mismatch: " + str(rid))
        capture = (
            "https://web.archive.org/web/" + src["capture"]
            + "/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/" + src["filename"]
        )
        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyAuthorEvidence"] = {
            "kind": "interviewer-attribution-signed-collection-independent-publisher-bibliographies",
            "verifiedAuthor": AUTHOR,
            "sourcePrintedAuthorOnThisPage": False,
            "creditedRole": "interviewer",
            "sourceIntervieweeNotCoauthor": src["interviewee"],
            "originalIndexedLabelIsIntervieweeNotByline": True,
            "verifiedTitle": src["title"],
            "sourceArticleTitle": "Entrevista a " + src["interviewee"],
            "sourceArticleUrl": url,
            "sourceUrl": capture,
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceCaptureTimestamp": src["capture"],
            "sourceAuthorCollectionIntroUrl": INTRO_SOURCE,
            "sourceAuthorCollectionIntroByline": "Introducción de Kathy Leonard",
            "sourceAuthorCollectionIntroContext": (
                "Estas seis entrevistas a autoras bolivianas forman parte "
                "de una obra más amplia que será publicada en dos volúmenes."
            ),
            "sourceLaterBookAuthor": "Kathy S. Leonard",
            "sourceLaterBookPublicationYear": 2001,
            "sourceLaterBookVolume": src["volume"],
            "sourceLaterBookPublisher": "Peter Lang",
            "sourcePublisherUrl": PUBLISHER_SOURCE,
            "sourceGermanNationalLibraryContentsUrl": NATIONAL_LIBRARY_SOURCE,
            "sourcePoetVolumeCatalogueUrl": POETS_BOOK_SOURCE,
            "sourceCriticalReviewOfBothVolumesUrl": MONT0YA_SOURCE,
            "sourceIndependentRepublicationUrl": src["republication"],
            "sourceInterviewSpecificCorroboration": src["additionalEvidence"],
            "urlMatchLevel": (
                "exact-original-interview-page-plus-separately-signed-series"
                "-and-independent-book-attribution"
            ),
            "matchedIndexedIssue": 7,
            "matchedIndexedYear": 1998,
            "originalAvailabilityPreserved": True,
            "publicationVersionCaveat": (
                "The original Sincronía interview page does not print Kathy "
                "Leonard as its byline. Attribution is to the interviewer, "
                "based on her separately signed introduction explicitly "
                "identifying this six-interview set, independently published "
                "2001 books credited to Kathy S. Leonard (not presumed "
                "text-identical to the 1998 web version), and name-specific "
                "independent contents/republications. Interview subjects "
                "must not be mislabelled as authors of the interview or "
                "coauthors. Preserve the 1998 issue, name-only indexed label, "
                "original URL and historical unavailable status."
            ),
        }
        changed.append(rid)
    if len(changed) != 6 or set(changed) != set(ENTRIES):
        raise ValueError("Exactly six documented interviews must match")
    if ids != [r.get("id") for r in rows]:
        raise ValueError("Original source ID order changed")
    if sum(not r.get("authors") for r in sin) != 6:
        raise ValueError("Expected six remaining missing Sincronía authors")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    d = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_six(d)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_LEONARD_SIX_INTERVIEWER_ATTRIBUTIONS", json.dumps({
        "changed": changed, "records": len(updated["records"]),
        "remainingMissingAuthors": 6,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

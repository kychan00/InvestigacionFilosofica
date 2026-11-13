#!/usr/bin/env python3
"""Recover seven signed historic Sincronía works (eight individual contributors).

Each original Wayback capture is the historically indexed URL, allowing
normalization of the HTTP default port :80 only. Keep all original
bibliographic fields frozen. Source article headings, byline variants,
interview roles and alternate HTML titles are strictly provenance, not
replacements for the original catalogue.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

SOURCES = {
    "cucsh:sincronia-legacy:049b6fce1737edb3c1c1": {
        "title": "Bañuelos,Raul",
        "authors": ["Raúl Bañuelos"],
        "printedByline": "Raúl Bañuelos",
        "issue": 12, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/banuelos.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20000124103649/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/banuelos.htm",
        "timestamp": "20000124103649",
        "sourcePageTitle": "Sincronia summer99 Banuelos",
        "sourceArticleTitle": "TRES DIVERSOS ABORDAJES DE LA POESÍA AMOROSA MEXICANA",
        "evidence": {
            "sourceIssueHeading": "Sincronía Verano 1999",
            "sourceAffiliation": "Departamento de Estudios Literarios, Universidad de Guadalajara",
            "titleIdentityCaveat": (
                "The original historical index labels the entry 'Bañuelos,Raul' "
                "without accent. The signed original /banuelos.htm page has a "
                "distinct article heading about Mexican love poetry and prints "
                "the author's name as Raúl Bañuelos. Keep the indexed label."
            ),
        },
    },
    "cucsh:sincronia-legacy:4b6e73e38eca426a1a58": {
        "title": "Wright, Shirley A",
        "authors": ["Shirley A. Wright"],
        "printedByline": "Shirley A. Wright",
        "issue": 13, "year": 2000,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/wright.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20010309225507/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/wright.htm",
        "timestamp": "20010309225507",
        "sourcePageTitle": "Who is Doing What: The Recoverableness of the Subject Referent in Clauses with Lexically Null Subjects in Spanish",
        "sourceArticleTitle": "Who is Doing What: The Recoverableness of the Subject Referent in Clauses with Lexically Null Subjects in Spanish",
        "evidence": {
            "sourceIssueHeading": "Sincronía Winter 2000",
            "sourceAffiliation": "University of Texas at Arlington",
            "titleIdentityCaveat": (
                "Original catalogue uses 'Wright, Shirley A', not the scholarly "
                "article title. The exact historic /wright.htm page explicitly "
                "signs the linguistics study by Shirley A. Wright; the indexed "
                "label and unavailable original URL are retained."
            ),
        },
    },
    "cucsh:sincronia-legacy:9fef2fa92aae18191958": {
        "title": "Velasco,Arnulfo Eduardo,",
        "authors": ["Arnulfo Eduardo Velasco"],
        "printedByline": "Arnulfo Eduardo Velasco",
        "issue": 13, "year": 2000,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/velasco3.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20000930033634/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/velasco3.htm",
        "timestamp": "20000930033634",
        "sourcePageTitle": "Sincronía Invierno 2000",
        "sourceArticleTitle": "REPRESENTACION DEL ACTO PSICOANALITICO EN LA OBRA DE MATILDE PONS",
        "evidence": {
            "sourceIssueHeading": "Sincronía Invierno 2000",
            "titleIdentityCaveat": (
                "Original catalogue lists Velasco's name with trailing comma "
                "instead of the article title. The original /velasco3.htm "
                "capture signs the essay on psychoanalysis and Matilde Pons. "
                "This is distinct from /velasco.htm and /velasco2.htm."
            ),
        },
    },
    "cucsh:sincronia-legacy:4d7e725e50959e070a37": {
        "title": "Costantini , Peter",
        "authors": ["Peter Costantini"],
        "printedByline": "Peter Costantini",
        "issue": 14, "year": 2000,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/Nica2.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20000930033811/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/Nica2.htm",
        "timestamp": "20000930033811",
        "sourcePageTitle": "Nicaragua: an American Tragedy",
        "sourceArticleTitle": "Nicaragua: an American tragedy",
        "evidence": {
            "sourceIssueHeading": "Sincronía Spring 2000",
            "sourceAuthorLocation": "Seattle",
            "sourceAuthorDate": "February 2000",
            "titleIdentityCaveat": (
                "The frozen entry is named 'Costantini , Peter'; the exact "
                "original /Nica2.htm article is signed by Peter Costantini "
                "with an original February 2000 date and the distinct heading "
                "'Nicaragua: an American tragedy'. Do not conflate with "
                "his 1996 /costantini.html work or his 1999 /listenin.html work."
            ),
        },
    },
    "cucsh:sincronia-legacy:abb7dc4edba2eae4321b": {
        "title": "Peña Doria, Olga Martha",
        "authors": ["Olga Martha Peña Doria"],
        "printedByline": "Olga Martha Peña Doria",
        "issue": 18, "year": 2001,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/olgamar.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20010309225020/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/olgamar.htm",
        "timestamp": "20010309225020",
        "sourcePageTitle": "Lic",
        "sourceArticleTitle": "ELLAS en el teatro de Guillermo Schmidhuber",
        "evidence": {
            "sourceIssueHeading": "Sincronía Spring/Primavera 2001",
            "sourceAffiliation": "Universidad de Guadalajara, Guadalajara, México",
            "titleIdentityCaveat": (
                "The archived original /olgamar.htm page signs an essay by "
                "Olga Martha Peña Doria on female characters in Guillermo "
                "Schmidhuber's plays. Its HTML title is 'Lic', not the visible "
                "article title; preserve the historical name-only index."
            ),
        },
    },
    "cucsh:sincronia-legacy:b79324bd7275d6009db8": {
        "title": "Powell, Jason & Ian Cook",
        "authors": ["Jason Powell", "Ian Cook"],
        "printedByline": "Jason Powell & Ian Cook",
        "issue": 18, "year": 2001,
        "url": "http://sincronia.cucsh.udg.mx/foucchin.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20010824210240/http://sincronia.cucsh.udg.mx:80/foucchin.htm",
        "timestamp": "20010824210240",
        "sourcePageTitle": "Managing Old Age: The Disciplinary Web of Power, Surveillance and Normalisation",
        "sourceArticleTitle": "Understanding Foucauldian Philosophy: The Chinese State and the Surveillance of Older People",
        "evidence": {
            "sourceIssueHeading": "Sincronía Spring/Primavera 2001",
            "sourceContributorType": "joint-individual-bylines",
            "titleIdentityCaveat": (
                "The original /foucchin.htm article explicitly credits TWO "
                "individual authors, Jason Powell and Ian Cook. Its substantive "
                "heading addresses Foucauldian philosophy, the Chinese state "
                "and older people; the page HTML title instead says 'Managing "
                "Old Age: The Disciplinary Web of Power, Surveillance and "
                "Normalisation'. Preserve both distinct titles in evidence, "
                "keep indexed name-label and create two author entries."
            ),
        },
    },
    "cucsh:sincronia-legacy:e904a85e0a828a3eb2e9": {
        "title": "Martins , Floriano",
        "authors": ["Floriano Martins"],
        "printedByline": "Floriano Martins",
        "issue": 18, "year": 2001,
        "url": "http://sincronia.cucsh.udg.mx/fressia.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20010523162438/http://sincronia.cucsh.udg.mx:80/fressia.htm",
        "timestamp": "20010523162438",
        "sourcePageTitle": "ESCRITURA CONQUISTADA",
        "sourceArticleTitle": "EN LAS FISURAS DE LA MÍMESIS",
        "evidence": {
            "sourceIssueHeading": "Sincronía Spring/Primavera 2001",
            "sourceInterviewSubtitle": "Diálogo com Alfredo Fressia",
            "sourceIntervieweeNotCoauthor": "Alfredo Fressia",
            "titleIdentityCaveat": (
                "The original /fressia.htm page shows 'EN LAS FISURAS DE LA "
                "MÍMESIS' as article heading, 'Diálogo com Alfredo Fressia' "
                "as an interview subtitle and Floriano Martins as the "
                "credited contributor. Alfredo Fressia is the interviewee, "
                "NOT a coauthor; the HTML page title 'ESCRITURA CONQUISTADA' "
                "is separate. Do not replace historical index label."
            ),
        },
    },
}


def restore_seven(data):
    records = data["records"]
    ids = [row.get("id") for row in records]
    sin = [row for row in records if row.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH corpus size or IDs changed")
    if sum(not row.get("authors") for row in sin) != 27:
        raise ValueError("Expected 27 outstanding Sincronía authorless records")

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
            raise ValueError("Frozen original signed work mismatch: " + str(rid))
        row["authors"] = [
            {"name": author, "sourceName": author} for author in src["authors"]
        ]
        row["legacyAuthorEvidence"] = {
            "kind": "signed-original-sincronia-html-in-wayback-exact-url",
            "sourceUrl": src["snapshot"],
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceCaptureTimestamp": src["timestamp"],
            "sourcePageTitle": src["sourcePageTitle"],
            "sourceArticleTitle": src["sourceArticleTitle"],
            "sourcePrintedByline": src["printedByline"],
            "sourceArticleUrl": src["url"],
            "urlMatchLevel": "exact-historical-original-url-with-http-default-port",
            "matchedIndexedIssue": src["issue"],
            "matchedIndexedYear": src["year"],
            "verifiedAuthors": src["authors"],
            "verifiedTitle": src["title"],
            "originalAvailabilityPreserved": True,
            "note": (
                "Signed historical article at the exact frozen original URL. "
                "A Wayback capture does not establish that old host is "
                "currently live; original title, year, issue, URL and "
                "access status remain unchanged."
            ),
            **src["evidence"],
        }
        changed.append(rid)

    if len(changed) != 7 or set(changed) != set(SOURCES):
        raise ValueError("Exactly seven signed historic works required")
    if ids != [r.get("id") for r in records]:
        raise ValueError("Frozen record ID ordering was changed")
    if sum(not row.get("authors") for row in sin) != 20:
        raise ValueError("Expected 20 missing Sincronía authors after restoration")
    if sum(len(src["authors"]) for src in SOURCES.values()) != 8:
        raise ValueError("Exactly eight credited contributors must be recorded")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_seven(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_SEVEN_SIGNED_EIGHT_CONTRIBUTORS", json.dumps({
        "changedIds": changed,
        "records": len(updated["records"]),
        "individualContributorCredits": 8,
        "remainingAuthorless": 20,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

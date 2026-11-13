#!/usr/bin/env python3
"""Recover four issue 11/13 Sincronía bylines from exact original HTML captures.

Do not silently replace person-name catalogue labels with recovered work titles,
nor overwrite spelling errors in indexed titles. Exact URL (modulo HTTP :80),
source issue, year, legacy access status and stable ID must all match before
authors + legacyAuthorEvidence can be written.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SOURCES = {
    "cucsh:sincronia-legacy:68d7cc2f1e229550ffab": {
        "title": "Theoretical Aspects of Non-Lineal Models and Applicationin Public Policy Analysis",
        "author": "Giovanni Efraín Reyes Ortiz",
        "printedByline": "Giovanni E. Reyes",
        "issue": 11, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/reyes3.htm",
        "status": "original-page-unavailable",
        "snapshot": "https://web.archive.org/web/20000930033939/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/reyes3.htm",
        "timestamp": "20000930033939",
        "sourcePageTitle": "Sincronia Reyes",
        "sourceArticleTitle": "Theoretical Aspects of Non-Lineal Models and Application Public Policy Analysis",
        "evidence": {
            "sourcePrintedAffiliation": (
                "University of Pittsburgh, Graduate School of Public and International Affairs"
            ),
            "expandedNameCorroborationUrl": (
                "https://research-hub.urosario.edu.co/display/giovanni-efrain-reyes-ortiz"
            ),
            "titleIdentityCaveat": (
                "The indexed source title says 'Applicationin', with two words "
                "run together. The signed original /reyes3.htm heading says "
                "'Application Public Policy Analysis', without 'in'. "
                "Neither form is silently normalized or substituted, "
                "and the original unavailable access status remains unchanged."
            ),
        },
    },
    "cucsh:sincronia-legacy:893f1bd536cc57a90093": {
        "title": "Cosmólisis y cosmogonía en el capítulo tres del Ulises de James Joyce",
        "author": "Ricardo Sigala",
        "printedByline": "RICARDO SIGALA",
        "issue": 11, "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/sigala.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20000520170324/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/sigala.htm",
        "timestamp": "20000520170324",
        "sourcePageTitle": "Sincronia Sigala",
        "sourceArticleTitle": "COSMÓLISIS Y COSMOGONÍA EN EL CAPÍTULO TRES DEL ULISES DE JAMES JOYCE",
        "evidence": {
            "sourcePrintedAffiliation": "Departamento de Estudios Literarios, Universidad de Guadalajara",
            "sourceSectionHeading": "Sobre Adán Dédalus / preludio prescindible",
            "titleIdentityCaveat": (
                "Original signed page uses uppercase styling for a heading "
                "that otherwise matches the indexed work. The original title, "
                "issue 11 year 1999 and archived-only status are preserved."
            ),
        },
    },
    "cucsh:sincronia-legacy:3d421b540a9edf11dca7": {
        "title": "Torres, Andres F.",
        "author": "Andrés F. Torres",
        "printedByline": "Andrés F. Torres",
        "issue": 13, "year": 2000,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/torres2.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20000930033707/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/torres2.htm",
        "timestamp": "20000930033707",
        "sourcePageTitle": "unsaved:///newpage3.htm",
        "sourceArticleTitle": "The United States and Plan Colombia",
        "evidence": {
            "sourceIssueHeading": "Sincronía Winter 2000",
            "sourceSubheading": "U.S. Should Re-evaluate Aid Proposed for Colombia",
            "titleIdentityCaveat": (
                "The source index lists only a person's name ('Torres, Andres F.'), "
                "not the signed original article's actual title. The original "
                "/torres2.htm page identifies 'The United States and Plan Colombia' "
                "and signs it Andrés F. Torres. The HTML <title> is an unsaved "
                "editor filename and is not the scholarly work title. "
                "Keep original indexed label and access status."
            ),
        },
    },
    "cucsh:sincronia-legacy:96c37f0291421c626853": {
        "title": "Pires Lucas,João Ignacio",
        "author": "João Ignácio Pires Lucas",
        "printedByline": "Prof. Msc. João Ignacio Pires Lucas",
        "issue": 13, "year": 2000,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/pires2.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20010309225829/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/pires2.htm",
        "timestamp": "20010309225829",
        "sourcePageTitle": "Universidade Federal do Rio Grande do Sul",
        "sourceArticleTitle": "Neomonopolismo e o vários liberalismos: e os estudos dos casos do Chile e Brasil",
        "evidence": {
            "sourceIssueHeading": "Sincronía Invierno 2000",
            "sourcePrintedAffiliation": (
                "Professor de Ciência Política da Universidade de Caxias do Sul; "
                "doutorando em Ciência Política pela UFRGS"
            ),
            "nameVariation": (
                "Original byline prints 'João Ignacio', while an earlier "
                "verified Sincronía article uses the canonical name "
                "'João Ignácio Pires Lucas'. Honor both as source-specific "
                "spellings without rewriting historical index title."
            ),
            "titleIdentityCaveat": (
                "Historical index lists the person-name label 'Pires Lucas,João Ignacio'. "
                "The exact original /pires2.htm page is a substantive Portuguese "
                "article on neomonopoly, liberalism, Chile and Brazil. "
                "Do not conflate it with the different 1999 Sincronía "
                "'Dependência e desenvolvimento na América Latina' work at /pires.htm."
            ),
        },
    },
}


def restore_four(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sincronia = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sincronia) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH/Sincronía corpus or ID identities drifted")
    if sum(not row.get("authors") for row in sincronia) != 36:
        raise ValueError("Expected exactly 36 source-unattributed Sincronía records")

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
            raise ValueError("Signed source identity mismatch: " + str(rid))
        row["authors"] = [{"name": item["author"], "sourceName": item["author"]}]
        row["legacyAuthorEvidence"] = {
            "kind": "original-sincronia-signed-html-wayback-exact-url",
            "sourceUrl": item["snapshot"],
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceCaptureTimestamp": item["timestamp"],
            "sourcePageTitle": item["sourcePageTitle"],
            "sourceArticleTitle": item["sourceArticleTitle"],
            "sourcePrintedByline": item["printedByline"],
            "sourceArticleUrl": item["url"],
            "urlMatchLevel": "original-historical-url-with-http-default-port-normalization",
            "matchedIndexedIssue": item["issue"],
            "matchedIndexedYear": item["year"],
            "verifiedAuthor": item["author"],
            "verifiedTitle": item["title"],
            "originalAvailabilityPreserved": True,
            "note": (
                "A captured historical Sincronía page at the exact indexed URL "
                "displays an explicit author signature. No original title, "
                "URL, year, ID or access status was changed. A Wayback "
                "capture does not imply live access to the original host."
            ),
            **item["evidence"],
        }
        changed.append(rid)
    if len(changed) != 4 or set(changed) != set(SOURCES):
        raise ValueError("Exactly four source-signed original works are required")
    if ids != [r.get("id") for r in rows]:
        raise ValueError("Original stable ID order changed")
    if sum(not r.get("authors") for r in sincronia) != 32:
        raise ValueError("Expected 32 outstanding authorless Sincronía records")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_four(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_REYES_SIGALA_TORRES_PIRES", json.dumps({
        "changed": changed, "totalRecords": len(updated["records"]),
        "remainingMissingAuthors": 32,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

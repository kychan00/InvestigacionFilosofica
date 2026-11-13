#!/usr/bin/env python3
"""Restore five signed Sincronía bylines from exact original-URL captures.

Legacy indexes for issues 14 and 16 often displayed a person's name or an
institutional contributor in place of the actual work title. Preserve the
catalogued title, record actual article title separately as evidence, and
never conflate the archived snapshot with a live original URL.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


SOURCES = {
    "cucsh:sincronia-legacy:4084f13c0e0361cd3907": {
        "title": "Ramón Iván Suárez Caamal",
        "author": "Ramón Iván Suárez Caamal",
        "printedByline": "Ramón Iván Suárez Caamal",
        "issue": 14, "year": 2000,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/suarez2.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20000930033830/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/suarez2.htm",
        "timestamp": "20000930033830",
        "sourcePageTitle": "La metáfora",
        "sourceArticleTitle": "La metáfora, arquitectura sensorial de la imaginación",
        "evidence": {
            "signedIssueHeader": "Sincronía Primavera 2000",
            "authorIndependentBibliographyUrl": "https://www.elem.mx/autor/datos/1034",
            "sourceRole": "Signed original article, not a name-only bibliography index",
            "titleIdentityCaveat": (
                "The frozen issue-14 index uses the author's full name as its "
                "work label. The exact original /suarez2.htm archive instead "
                "shows the bylined article 'La metáfora, arquitectura "
                "sensorial de la imaginación'. Keep the original index title "
                "without silently substituting the actual page heading."
            ),
        },
    },
    "cucsh:sincronia-legacy:45e6f64e9c503606fd0d": {
        "title": "Medina, Jorge",
        "author": "Jorge Medina",
        "printedByline": "Jorge Medina",
        "issue": 16, "year": 2000,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/arrivi.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20010304160937/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/arrivi.htm",
        "timestamp": "20010304160937",
        "sourcePageTitle": "Los bumos",
        "sourceArticleTitle": "Conversación con Francisco Arriví Alegría",
        "evidence": {
            "signedIssueHeader": "Sincronía Otoño 2000",
            "sourcePrintedAffiliation": "Departamento de Lenguas Modernas, Murray State University",
            "titleIdentityCaveat": (
                "The index uses the person label 'Medina, Jorge' but the "
                "signed archived article is a conversation with Francisco "
                "Arriví Alegría. The archived HTML <title> says 'Los bumos', "
                "which is neither the index label nor the visible article "
                "heading. Preserve all three distinctions."
            ),
        },
    },
    "cucsh:sincronia-legacy:78815d4ff675c1655f09": {
        "title": "Reyes, Giovanni E.",
        "author": "Giovanni Efraín Reyes Ortiz",
        "printedByline": "Giovanni E. Reyes",
        "issue": 16, "year": 2000,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/ecgrow.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20010304161316/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/ecgrow.htm",
        "timestamp": "20010304161316",
        "sourcePageTitle": "Notas para la Segunda Parte de la Metodología",
        "sourceArticleTitle": "Latin American Exports and Economic Growth: The Empirical Evidence",
        "evidence": {
            "signedIssueHeader": "Sincronía Fall 2000",
            "sourcePrintedAffiliation": (
                "University of Pittsburgh, Graduate School of Public and "
                "International Affairs"
            ),
            "fullNameInstitutionalCorroborationUrl": (
                "https://research-hub.urosario.edu.co/display/giovanni-efrain-reyes-ortiz"
            ),
            "sourcePrintedFootnoteMarker": "[1]",
            "titleIdentityCaveat": (
                "The historical index gives only 'Reyes, Giovanni E.'; "
                "the exact archived page signs 'Giovanni E. Reyes' and "
                "shows the substantive work title 'Latin American Exports "
                "and Economic Growth: The Empirical Evidence'. The "
                "institutional profile corroborates the expanded name. "
                "Do not treat HTML page title or index label as the paper title."
            ),
        },
    },
    "cucsh:sincronia-legacy:a3d34239ce50b4e18aa4": {
        "title": "Shulterbrandt, Sahnya,",
        "author": "Sahnya Shulterbrandt",
        "printedByline": "Sahnya Shulterbrandt",
        "issue": 16, "year": 2000,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/cabeza.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20010304160008/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/cabeza.htm",
        "timestamp": "20010304160008",
        "sourcePageTitle": (
            "Cabeza de Ratón, antes que Cola de León: El Nuevo Orden "
            "Mundial desde la óptica del Tercer Mundo"
        ),
        "sourceArticleTitle": (
            "Cabeza de Ratón, antes que Cola de León: El Nuevo Orden "
            "Mundial desde la óptica del Tercer Mundo"
        ),
        "evidence": {
            "signedIssueHeader": "Sincronía Otoño 2000",
            "titleIdentityCaveat": (
                "Historical index uses the author name as a work label, "
                "with extraneous terminal comma. The exact archived page "
                "identifies Sahnya Shulterbrandt as its byline and supplies "
                "the substantive title about the New World Order. "
                "Preserve the indexed label and access status."
            ),
        },
    },
    "cucsh:sincronia-legacy:b6f5b07d79cc222d68e1": {
        "title": "Forum Intercultura",
        "author": "Forum Intercultura",
        "printedByline": "Forum Intercultura",
        "issue": 16, "year": 2000,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/uspr.htm",
        "status": "original-page-archived-only",
        "snapshot": "https://web.archive.org/web/20010304161610/http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/uspr.htm",
        "timestamp": "20010304161610",
        "sourcePageTitle": "Article 311 US/PR",
        "sourceArticleTitle": (
            "The Other Side of the Coin: US Role in the Caribbean, "
            "Target Puerto Rico"
        ),
        "evidence": {
            "signedIssueHeader": "Sincronía Otoño 2000",
            "sourceContributorType": "collective/organizational byline",
            "sourcePrintedContact": "forum.int@codetel.net.do",
            "titleIdentityCaveat": (
                "The exact original /uspr.htm archive displays the "
                "organization 'Forum Intercultura' as a credited contributor "
                "and contact address below a substantive article title. "
                "The historical index uses the organization name alone. "
                "Record a collective byline, not an invented individual "
                "author, and do not overwrite the original index label."
            ),
        },
    },
}


def restore_five(data):
    records = data["records"]
    ids = [r.get("id") for r in records]
    sin = [r for r in records if r.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Frozen CUCSH corpus or stable IDs changed")
    if sum(not r.get("authors") for r in sin) != 43:
        raise ValueError("Expected exactly 43 missing Sincronía bylines")

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
            raise ValueError("Historic original signed URL identity mismatch: " + str(rid))
        row["authors"] = [{"name": s["author"], "sourceName": s["author"]}]
        row["legacyAuthorEvidence"] = {
            "kind": "exact-original-sincronia-url-signed-wayback-page",
            "sourceUrl": s["snapshot"],
            "sourceArchive": "Internet Archive Wayback Machine",
            "sourceCaptureTimestamp": s["timestamp"],
            "sourcePageTitle": s["sourcePageTitle"],
            "sourceArticleTitle": s["sourceArticleTitle"],
            "sourcePrintedByline": s["printedByline"],
            "sourceArticleUrl": s["url"],
            "urlMatchLevel": "exact-historic-url-with-optional-http-default-port",
            "matchedIndexedIssue": s["issue"],
            "matchedIndexedYear": s["year"],
            "verifiedAuthor": s["author"],
            "verifiedTitle": s["title"],
            "originalAvailabilityPreserved": True,
            "note": (
                "This historical Wayback original-URL capture supplies a "
                "visible byline and substantive article title. The frozen "
                "index title, URL, date, ID, and archived-only original "
                "availability are intentionally preserved. Archival access "
                "does not establish that the old original host is online."
            ),
            **s["evidence"],
        }
        changed.append(rid)

    if set(changed) != set(SOURCES) or len(changed) != 5:
        raise ValueError("Expected exactly five uniquely signed historic original URLs")
    if ids != [r.get("id") for r in records]:
        raise ValueError("Original stable record ID ordering changed")
    if sum(not r.get("authors") for r in sin) != 38:
        raise ValueError("Expected exactly 38 remaining Sincronía authorless records")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_five(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_FIVE_HISTORICAL_BYLINES", json.dumps({
        "changed": changed, "totalCorpus": len(updated["records"]),
        "remainingAuthorless": 38,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

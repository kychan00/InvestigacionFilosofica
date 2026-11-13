#!/usr/bin/env python3
"""Restore one Sincronía 1998 index byline from author and scholarly sources.

Harvard-hosted CV of Rosemary G. Feal confirms this exact work's
authorship and lists a 1996 anthology publication (pp. 71–76).
Caderno Seminal (UERJ, 2022) cites Feal's work in Sincronía and an
alternate historic host ending /feal.html, but dates it 1996.
These external 1996 citations do NOT prove the Sincronía index's 1998
issue-year wrong, nor establish equivalence between published versions.
Preserve the source's year, issue, original URL and archived-only status.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:f79fec0215a2a89cf4b6"
TITLE = 'Poetas afrohispánicas y la "politica de la identidad"'
AUTHOR = "Rosemary Geisdorfer Feal"
ORIGINAL_URL = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/feal.html"
AUTHOR_CV = "https://scholar.harvard.edu/files/rosemaryfeal/files/cv_rosemary_feal.pdf"
UERJ_SOURCE = "https://www.e-publicacoes.uerj.br/index.php/cadernoseminal/article/download/60175/41352"
UERJ_CITED_URL = "http://sincronia.cucsh.udg.mx/feal.html"


def restore_feal(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen CUCSH/Sincronía records or identifiers")
    if sum(not r.get("authors") for r in sin) != 74:
        raise ValueError("Expected 74 unresolved Sincronía bylines")

    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 5
            or row.get("year") != 1998
            or row.get("title") != TITLE
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != ORIGINAL_URL
            or (row.get("legacyAccessStatus") or {}).get("status")
                != "original-page-archived-only"
        ):
            raise ValueError("Frozen issue-5 Feal work identity mismatch")
        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyAuthorEvidence"] = {
            "kind": "author-harvard-cv-plus-independent-journal-citation",
            "sourceUrl": AUTHOR_CV,
            "sourceInstitution": "Harvard University academic CV repository",
            "sourceTitle": 'Poetas afrohispánicas y la "política de la identidad"',
            "sourceCitedPublicationYear": 1996,
            "sourceEdition": (
                "Literatura, historia e identidad: Los discursos de la cultura hoy "
                "(edited by Lilia Granillo Vásquez), pp. 71–76"
            ),
            "supportingSourceUrl": UERJ_SOURCE,
            "supportingSourceTitle": "Sob a pele da alma: Nicolás Guillén e a poesia para crianças de qualquer idade",
            "supportingSourceYear": 2022,
            "supportingCitationYear": 1996,
            "supportingCitedOriginalUrlVariant": UERJ_CITED_URL,
            "sourceArticleUrl": ORIGINAL_URL,
            "verifiedAuthor": AUTHOR,
            "verifiedTitle": TITLE,
            "matchedIndexedIssue": 5,
            "indexedYearPreserved": 1998,
            "chronologyConflict": "external-sources-cite-1996-legacy-index-1998",
            "urlMatchLevel": "matching-filename-different-historical-host",
            "originalAvailabilityPreserved": True,
            "note": (
                "Rosemary G. Feal's own Harvard-hosted CV confirms authorship "
                "of this same-titled work, listing a 1996 collected-volume "
                "publication. A 2022 UERJ research article cites Feal and "
                "the title in Sincronía with the /feal.html filename, "
                "but calls it 1996 and uses sincronia.cucsh.udg.mx, not the "
                "frozen fuentes.csh.udg.mx hostname. The Sincronía legacy "
                "index records issue 5 (1998). Preserve its 1998 year, "
                "index title, original URL and archived-only status; do not "
                "assert that two historical URLs are equivalent or that "
                "the 1996 and 1998 manifestations are identical."
            ),
        }
        changed.append(ID)

    if changed != [ID] or ids != [r.get("id") for r in rows]:
        raise ValueError("Exactly one stable Feal record must change")
    if sum(not r.get("authors") for r in sin) != 73:
        raise ValueError("Expected exactly 73 unresolved Sincronía bylines")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_feal(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_FEAL_VERIFIED", json.dumps({
        "changed": changed,
        "records": len(updated["records"]),
        "remainingAuthorless": 73,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

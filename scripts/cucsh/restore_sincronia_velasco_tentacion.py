#!/usr/bin/env python3
"""Restore Arnulfo Eduardo Velasco's Kazantzakis article conservatively.

A full-text reproduction establishes heading + author. A separate later
bibliographic page links Sincronía's tentacion.htm path to La última tentación
de Cristo. Neither source upgrades the historical original page's availability.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:e8f623d39efb7e943e95"
OLD = "Velasco , Arnulfo Eduardo"
TITLE = "Sobre “La última tentación” de Nikos Kazantzakis"
HEADING = "SOBRE LA ULTIMA TENTACION DE NIKOS KAZANTZAKIS"
AUTHOR = "Arnulfo Eduardo Velasco"
TEXT_SOURCE = "https://es.scribd.com/doc/308811977/Sobre-La-Ultima-Tentacion-de-Nikos-Kazantzakis"
URL_SOURCE = "https://cesarcallejas.wordpress.com/tag/cristianismo/"
URL_ASSOCIATION = "http://sincronia.cucsh.udg.mx/tentacion.htm"


def restore_tentacion(data):
    rows = data["records"]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    ids = [r.get("id") for r in rows]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen corpus baseline")
    if sum(not r.get("authors") for r in sin) != 83:
        raise ValueError("Expected exactly 83 unresolved Sincronía bylines")

    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        original_url = (row.get("urls") or {}).get("canonical") or ""
        old_variants = row.get("titleVariants") or []
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 16
            or row.get("year") != 2000
            or row.get("title") != OLD
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not isinstance(old_variants, list)
            or not original_url.lower().endswith("/tentacion.htm")
        ):
            raise ValueError("Frozen Velasco tentacion.htm identity mismatch")

        row["title"] = TITLE
        row["titleVariants"] = list(dict.fromkeys([
            TITLE, HEADING, *old_variants, OLD,
        ]))
        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "full-text-heading-plus-independent-legacy-path-association",
            "previousTitle": OLD,
            "previousTitleVariants": old_variants,
            "verifiedTitle": TITLE,
            "reproducedHeading": HEADING,
            "verifiedAuthors": [AUTHOR],
            "fullTextReproductionUrl": TEXT_SOURCE,
            "legacyPathAssociationSourceUrl": URL_SOURCE,
            "associatedLegacyUrl": URL_ASSOCIATION,
            "sourceArticleUrl": original_url,
            "matchedIssueNumber": 16,
            "matchedYear": 2000,
            "originalAvailabilityPreserved": True,
            "note": (
                "The reproduced text carries Arnulfo Eduardo Velasco's byline "
                "and the heading SOBRE LA ULTIMA TENTACION DE NIKOS KAZANTZAKIS. "
                "A separate bibliographic page points specifically to "
                "sincronia.cucsh.udg.mx/tentacion.htm for La última tentación de "
                "Cristo. This triangulates the work identity but does not imply "
                "that the historical original page is currently accessible."
            ),
        }
        row["legacyAuthorEvidence"] = {
            "kind": "full-text-heading-plus-independent-legacy-path-association",
            "fullTextReproductionUrl": TEXT_SOURCE,
            "legacyPathAssociationSourceUrl": URL_SOURCE,
            "associatedLegacyUrl": URL_ASSOCIATION,
            "verifiedAuthors": [AUTHOR],
            "verifiedTitle": TITLE,
            "sourceArticleUrl": original_url,
            "matchedIssueNumber": 16,
            "matchedYear": 2000,
            "originalAvailabilityPreserved": True,
        }
        changed.append(ID)

    if changed != [ID] or ids != [r.get("id") for r in rows]:
        raise ValueError("Expected exactly one stable historical work")
    if sum(not r.get("authors") for r in sin) != 82:
        raise ValueError("Expected exactly 82 remaining authorless records")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    out, changed = restore_tentacion(data)
    args.output.write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_VELASCO_TENTACION", json.dumps({
        "changed": changed,
        "records": len(out["records"]),
        "remainingAuthorless": 82,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

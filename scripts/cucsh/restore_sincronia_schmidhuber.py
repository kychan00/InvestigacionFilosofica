#!/usr/bin/env python3
"""Verify a Sincronía issue-1 author's byline with academic citations.

University of Veracruz cites the article in Sincronía, Winter 1996;
Ohio State doctoral dissertation cites the author's complete name, title,
year and the related historical /schmid.htm path. The frozen catalog
record uses /schmid.html: do not claim those URLs are identical.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:c723b894c383b8aa3860"
TITLE = "La historiografía en el teatro español y mexicano: Antonio Buero Vallejo y Rodolfo Usigli"
AUTHOR = "Guillermo Schmidhuber de la Mora"
ORIGINAL_URL = "http://sincronia.cucsh.udg.mx/schmid.html"
UV_SOURCE = "https://www.uv.mx/mlm/files/2013/05/Proyecto-Def-Victor.pdf"
OHIO_SOURCE = "https://etd.ohiolink.edu/acprod/odb_etd/ws/send_file/send?accession=osu1041180170&disposition=inline"
AUTHOR_REPRODUCTION = "https://aprenderly.com/doc/3374327/la-historiograf%C3%ADa-en-el-teatro-espa%C3%B1ol-y-mexicano"
CITED_VARIANT = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/schmid.htm"


def restore_schmidhuber(data):
    rows = data["records"]
    ids = [row.get("id") for row in rows]
    sin = [row for row in rows if row.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen CUCSH/Sincronía baseline")
    if sum(not row.get("authors") for row in sin) != 80:
        raise ValueError("Expected 80 previously unresolved bylines")

    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 1
            or row.get("year") != 1996
            or row.get("title") != TITLE
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != ORIGINAL_URL
            or (row.get("legacyAccessStatus") or {}).get("status")
                != "original-page-archived-only"
        ):
            raise ValueError("Frozen issue-1 Schmidhuber identity mismatch")

        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyAuthorEvidence"] = {
            "kind": "independent-university-bibliography-plus-author-text",
            "sourceUrl": UV_SOURCE,
            "supportingSourceUrl": OHIO_SOURCE,
            "authorTextSourceUrl": AUTHOR_REPRODUCTION,
            "verifiedAuthor": AUTHOR,
            "verifiedTitle": TITLE,
            "matchedIssueNumber": 1,
            "matchedYear": 1996,
            "sourceArticleUrl": ORIGINAL_URL,
            "citedHistoricalUrlVariant": CITED_VARIANT,
            "urlMatchLevel": "different-extension-unverified-equivalence",
            "originalAvailabilityPreserved": True,
            "note": (
                "Universidad Veracruzana cites Schmidhuber de la Mora, "
                "Sincronía Winter 1996, matching the full work title. "
                "Ohio State dissertation independently cites the same "
                "author/title/journal/year and /schmid.htm URL. "
                "A reproduction of the authored text independently bears "
                "the author's byline. Catalog's /schmid.html is retained "
                "without asserting it is equivalent to /schmid.htm, "
                "or claiming the original page is live."
            ),
        }
        changed.append(ID)

    if changed != [ID] or ids != [row.get("id") for row in rows]:
        raise ValueError("Expected exactly one unchanged work identifier")
    if sum(not row.get("authors") for row in sin) != 79:
        raise ValueError("Expected 79 remaining unresolved bylines")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    output, changed = restore_schmidhuber(data)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_SCHMIDHUBER_VERIFIED", json.dumps({
        "changed": changed, "records": len(output["records"]),
        "remainingAuthorless": 79,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Recover two Sincronía issue-18 works from institutional academic evidence.

Poveda is matched by institutional publication profile + CV + unique
journal/year/issue author index entry. Dean additionally has an exact
original-URL citation from a Universidad de Granada doctoral thesis.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

VERIFIED = [
  {
    "id": "cucsh:sincronia-legacy:100ad9b6aca92238c28b",
    "issue": 18,
    "year": 2001,
    "oldTitle": "Poveda, David",
    "newTitle": "Estructura e identidad en las narraciones escolares de un niño gitano",
    "authors": [
      "David Poveda Bicknell"
    ],
    "suffix": "/poveda.htm",
    "sourceUrl": "https://portalinvestigacion.consorciomadrono.es/authors/10296.html?page=9&pageType=conference&sortBy=dateAsc",
    "supportingUrl": "https://recursoshumanos.unizar.es/sites/recursoshumanos/files/curriculums/310718/2024-119_08.pdf",
    "matchKind": "institutional-author-profile-plus-cv-journal-year-title",
    "note": "Consorcio Madroño lists the exact title under Sincronía (Guadalajara), 2001, for David Patrick Poveda Bicknell. An institutional CV additionally gives Sincronía, Primavera, and the same title. Original /poveda.htm remains only the historical indexed URL."
  },
  {
    "id": "cucsh:sincronia-legacy:d9a2cdc5ea4378b3a96b",
    "issue": 18,
    "year": 2001,
    "oldTitle": "Dean , Jennifer",
    "newTitle": "El cambio de código, like a Rock",
    "authors": [
      "Jennifer Dean"
    ],
    "suffix": "/dean1.htm",
    "sourceUrl": "https://digibug.ugr.es/bitstream/handle/10481/924/16077507.pdf?isAllowed=y&sequence=1",
    "supportingUrl": "https://produccioncientifica.ugr.es/documentos/618f4fa19ff8c939aaca52a8",
    "matchKind": "university-doctoral-thesis-exact-original-url-citation",
    "note": "Universidad de Granada doctoral thesis cites Dean, J. (2001), exact article title, Sincronía Spring/Primavera and the original dean1.htm URL. The existing historical index label supplies the full first name Jennifer."
  }
]


def restore_issue18_poveda_dean(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected CUCSH/Sincronía baseline")
    if sum(not r.get("authors") for r in sin) != 88:
        raise ValueError("Expected 88 unresolved Sincronía bylines")
    lookup = {item["id"]: item for item in VERIFIED}
    if len(lookup) != 2 or len(VERIFIED) != 2:
        raise ValueError("Expected two unique source-pinned records")

    changed = []
    for row in rows:
        item = lookup.get(row.get("id"))
        if item is None:
            continue
        url = (row.get("urls") or {}).get("canonical") or ""
        previous_variants = row.get("titleVariants") or []
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != item["issue"]
            or row.get("year") != item["year"]
            or row.get("title") != item["oldTitle"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not isinstance(previous_variants, list)
            or not url.lower().endswith(item["suffix"].lower())
        ):
            raise ValueError("Frozen issue-18 identity mismatch: " + item["id"])

        row["title"] = item["newTitle"]
        row["titleVariants"] = list(dict.fromkeys([
            item["newTitle"], *previous_variants, item["oldTitle"],
        ]))
        row["authors"] = [
            {"name": name, "sourceName": name}
            for name in item["authors"]
        ]
        row["legacyIndexMislabelEvidence"] = {
            "kind": item["matchKind"],
            "previousTitle": item["oldTitle"],
            "previousTitleVariants": previous_variants,
            "verifiedTitle": item["newTitle"],
            "verifiedAuthors": item["authors"],
            "sourceUrl": item["sourceUrl"],
            "supportingSourceUrl": item["supportingUrl"],
            "sourceArticleUrl": url,
            "matchedIssueNumber": item["issue"],
            "matchedYear": item["year"],
            "originalAvailabilityPreserved": True,
            "note": item["note"],
        }
        row["legacyAuthorEvidence"] = {
            "kind": item["matchKind"],
            "sourceUrl": item["sourceUrl"],
            "supportingSourceUrl": item["supportingUrl"],
            "verifiedAuthors": item["authors"],
            "verifiedTitle": item["newTitle"],
            "sourceArticleUrl": url,
            "matchedIssueNumber": item["issue"],
            "matchedYear": item["year"],
            "originalAvailabilityPreserved": True,
        }
        changed.append(item["id"])

    if set(changed) != set(lookup) or ids != [r.get("id") for r in rows]:
        raise ValueError("Expected exactly two stable source IDs")
    if sum(not r.get("authors") for r in sin) != 86:
        raise ValueError("Expected 86 remaining records without authors")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    out, changed = restore_issue18_poveda_dean(data)
    args.output.write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_ISSUE18_POVEDA_DEAN", json.dumps({
        "changed": changed,
        "records": len(out["records"]),
        "remainingAuthorless": 86,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

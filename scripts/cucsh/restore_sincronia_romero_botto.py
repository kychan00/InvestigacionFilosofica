#!/usr/bin/env python3
"""Recover Sincronía issue-13 António Botto paper from exact URL citations.

Two independent Brazilian university sources cite the same original URL.
They differ on the full article heading; preserve both documented title
forms as search variants instead of hiding the bibliographic discrepancy.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

ID = "cucsh:sincronia-legacy:637cb309cca6fc5f3dbf"
OLD = "Romero, Raúl E."
TITLE = "António Botto: la voz diferente"
SHORT = "La voz diferente"
AUTHOR = "Raúl E. Romero"
CITATION_USP = "https://revistas.usp.br/viaatlantica/pt_BR/article/download/140073/147134/309500"
CITATION_UNESP = "https://repositorio.unesp.br/server/api/core/bitstreams/7eaa8fc1-4110-4cf3-86e0-f0e6eef7f5ee/content"


def restore_botto_title(data):
    rows = data["records"]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    ids = [r.get("id") for r in rows]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected size or duplicate work ID")
    if sum(not r.get("authors") for r in sin) != 89:
        raise ValueError("Expected exactly 89 unattributed Sincronía records")
    changed = []
    for row in rows:
        if row.get("id") != ID:
            continue
        original = (row.get("urls") or {}).get("canonical") or ""
        old_variants = row.get("titleVariants") or []
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 13
            or row.get("year") != 2000
            or row.get("title") != OLD
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not original.lower().endswith("/botto.htm")
            or not isinstance(old_variants, list)
        ):
            raise ValueError("Romero Botto article original identity mismatch")
        row["title"] = TITLE
        row["titleVariants"] = list(dict.fromkeys([
            TITLE, SHORT, *old_variants, OLD,
        ]))
        row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "two-university-citations-with-exact-original-article-url",
            "previousTitle": OLD,
            "previousTitleVariants": old_variants,
            "verifiedTitle": TITLE,
            "citedShortTitle": SHORT,
            "verifiedAuthors": [AUTHOR],
            "sourceUrl": CITATION_USP,
            "independentSourceUrl": CITATION_UNESP,
            "sourceArticleUrl": original,
            "matchedIssueNumber": 13,
            "matchedYear": 2000,
            "originalAvailabilityPreserved": True,
            "note": (
                "Via Atlântica (Universidade de São Paulo, 2018) cites "
                "'António Botto: la voz diferente'; Ricardo Marques Martins "
                "(UNESP thesis, 2013, p.106) cites 'La voz diferente'. Both "
                "refer to the original /botto.htm article in Sincronía, "
                "winter 1999-2000. Keep both titles searchable; avoid "
                "claiming an original heading not directly observed."
            ),
        }
        row["legacyAuthorEvidence"] = {
            "kind": "two-university-author-and-exact-original-url-citations",
            "sourceUrl": CITATION_USP,
            "independentSourceUrl": CITATION_UNESP,
            "verifiedAuthors": [AUTHOR],
            "verifiedTitle": TITLE,
            "sourceArticleUrl": original,
            "matchedIssueNumber": 13,
            "originalAvailabilityPreserved": True,
        }
        changed.append(ID)
    if changed != [ID] or ids != [r.get("id") for r in rows]:
        raise ValueError("Expected exactly one original journal record")
    if sum(not r.get("authors") for r in sin) != 88:
        raise ValueError("Expected 88 remaining Sincronía records without authors")
    return data, changed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_botto_title(data)
    args.output.write_text(json.dumps(
        updated, ensure_ascii=False, indent=2
    ) + "\n", encoding="utf-8")
    print("SINCRONIA_ROMERO_BOTTO_RESTORED", json.dumps({
        "changed": changed,
        "records": len(updated["records"]),
        "remainingUnattributed": 88,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

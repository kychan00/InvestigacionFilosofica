#!/usr/bin/env python3
"""Restore exactly one original Sincronía 2000 article from two dated captures.

Both the Summer 2000 index and an actual signed article page were captured in
2000 at the journal's older CUCSH host. The original preserved catalog URL on
the later host was reused for a different 2001 interview: never conflate them.
No canonical URLs, source-access classifications, records or IDs are changed.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

TARGET_ID = "cucsh:sincronia-legacy:d578e8ef399dde877feb"
INDEX_LABEL = "de Campos,Jorge Lucio"
VERIFIED_TITLE = "A educação e o fascínio tecnológico: Algumas considerações"
VERIFIED_AUTHOR = "Jorge Lucio de Campos"
ORIGINAL_CATALOG_URL = "http://sincronia.cucsh.udg.mx/campos.htm"
ORIGINAL_2000_ARTICLE_URL = (
    "http://fuentes.csh.udg.mx/CUCSH/Sincronia/campos.htm"
)
ISSUE_15_INDEX_URL = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/summer00.htm"
ARTICLE_CAPTURE = (
    "https://web.archive.org/web/20000930033955/"
    "http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/campos.htm"
)
INDEX_CAPTURE = (
    "https://web.archive.org/web/20000824085411/"
    "http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/summer00.htm"
)
OTHER_ARTICLE_CAPTURE = (
    "https://web.archive.org/web/20000930034002/"
    "http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/campos2.htm"
)
REUSED_2001_CAPTURE = (
    "https://web.archive.org/web/20020607092529/"
    "http://sincronia.cucsh.udg.mx:80/campos.htm"
)
VERIFIED_AUTHOR_RECORD = {
    "name": VERIFIED_AUTHOR,
    "sourceName": VERIFIED_AUTHOR,
}
EXPECTED_ACCESS_STATUS = "original-page-unavailable"


def restore_one(data, *, require_full_corpus=True):
    """Return the amended data and changed IDs, or fail closed on any drift."""
    if not isinstance(data, dict) or not isinstance(data.get("records"), list):
        raise ValueError("Expected CUCSH object with records list")
    rows = data["records"]
    ids = [row.get("id") for row in rows]
    if len(ids) != len(set(ids)) or ids.count(TARGET_ID) != 1:
        raise ValueError("Missing, duplicated or ambiguous Campos record ID")
    if require_full_corpus:
        sincronia = [row for row in rows if row.get("journal") == "Sincronía"]
        if len(rows) != 1845 or len(sincronia) != 1454:
            raise ValueError("Unexpected frozen CUCSH or Sincronía inventory")
        if sum(not row.get("authors") for row in sincronia) != 4:
            raise ValueError("Expected four historically unsigned source records")
    original_sequence = list(ids)
    changed = []
    for row in rows:
        if row.get("id") != TARGET_ID:
            continue
        original_variants = row.get("titleVariants") or []
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != 15
            or row.get("year") != 2000
            or row.get("title") != INDEX_LABEL
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != ORIGINAL_CATALOG_URL
            or (row.get("legacyAccessStatus") or {}).get("status")
            != EXPECTED_ACCESS_STATUS
            or not isinstance(original_variants, list)
            or any(not isinstance(x, str) for x in original_variants)
        ):
            raise ValueError("Original issue-15 Campos identity has drifted")
        row["title"] = VERIFIED_TITLE
        row["titleVariants"] = [VERIFIED_TITLE] + [
            x for x in original_variants if x != VERIFIED_TITLE
        ]
        if INDEX_LABEL not in row["titleVariants"]:
            row["titleVariants"].append(INDEX_LABEL)
        row["authors"] = [dict(VERIFIED_AUTHOR_RECORD)]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "archived-original-2000-index-plus-signed-article",
            "previousTitle": INDEX_LABEL,
            "verifiedTitle": VERIFIED_TITLE,
            "verifiedAuthors": [VERIFIED_AUTHOR],
            "originalTitleVariants": original_variants,
            "indexSourceUrl": INDEX_CAPTURE,
            "signedArticleSourceUrl": ARTICLE_CAPTURE,
            "separateDeleuzeArticleSourceUrl": OTHER_ARTICLE_CAPTURE,
            "sourceArticleUrl": ORIGINAL_2000_ARTICLE_URL,
            "originalCatalogUrlPreserved": ORIGINAL_CATALOG_URL,
            "indexIssueNumber": 15,
            "indexYear": 2000,
            "signedArticleCaptureDate": "2000-09-30",
            "indexCaptureDate": "2000-08-24",
            "printedByline": VERIFIED_AUTHOR,
            "actualVisibleArticleHeading": VERIFIED_TITLE,
            "archivedHtmlTitleDiscrepancy": (
                "The page HTML <title> refers to A SALA DE AULA ENQUANTO "
                "PAISAGEM VIRTUAL, but the visible signed article and "
                "issue-15 table of contents identify A EDUCAÇÃO E O "
                "FASCÍNIO TECNOLÓGICO: ALGUMAS CONSIDERAÇÕES."
            ),
            "different2001InterviewOnReusedUrl": REUSED_2001_CAPTURE,
            "historicalUrlIdentityNote": (
                "The original 2000 document survives at the older "
                "fuentes.csh.udg.mx CUCSH/Sincronia/campos.htm path. "
                "The legacy catalog canonical sincronia.cucsh.udg.mx/"
                "campos.htm was later reused for a 2001 interview. "
                "Do not use the 2001 article as evidence of the 2000 work, "
                "and do not claim the dead catalog URL is currently live."
            ),
            "originalAvailabilityPreserved": True,
        }
        row["legacyAuthorEvidence"] = {
            "kind": "signed-2000-archived-primary-article-and-original-index",
            "verifiedAuthor": VERIFIED_AUTHOR,
            "verifiedAuthors": [VERIFIED_AUTHOR],
            "verifiedTitle": VERIFIED_TITLE,
            "sourceUrl": ARTICLE_CAPTURE,
            "supportingSourceUrl": INDEX_CAPTURE,
            "separateArticleUrl": OTHER_ARTICLE_CAPTURE,
            "sourceArticleUrl": ORIGINAL_2000_ARTICLE_URL,
            "originalCatalogUrlPreserved": ORIGINAL_CATALOG_URL,
            "printedByline": VERIFIED_AUTHOR,
            "matchedIndexedIssue": 15,
            "matchedIndexedYear": 2000,
            "originalAvailabilityPreserved": True,
            "reused2001DifferentWorkCapture": REUSED_2001_CAPTURE,
        }
        changed.append(TARGET_ID)
    if changed != [TARGET_ID] or ids != original_sequence:
        raise ValueError("Restoration did not exclusively target the Campos record")
    if require_full_corpus:
        if sum(not row.get("authors") for row in sincronia) != 3:
            raise ValueError("Expected exactly three non-article unsigned records")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    source = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_one(source)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_CAMPOS_2000_SIGNED_PRIMARY_RESTORED", changed[0])
    print("SINCRONIA_MISSING_AUTHORS_NON_ARTICLES_ONLY", 3)


if __name__ == "__main__":
    main()

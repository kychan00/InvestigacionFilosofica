#!/usr/bin/env python3
"""Restore one bibliographically verified historical Sincronía title.

Evidence is a 2005 peer-reviewed Lemir article with an exact citation of the
original journal URL. No broken original URL is presented as a live full text.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

RECORD_ID = "cucsh:sincronia-legacy:227e912cb694dcd4f77c"
ISSUE = 16
YEAR = 2000
OLD_LABEL = "Vidaurre Arenas, Carmen V."
TRUE_TITLE = "La interacción de diversos tipos textuales en la obra de Alvar Núñez"
AUTHOR = "Carmen V. Vidaurre Arenas"
SOURCE = "https://parnaseo.uv.es/Lemir/Revista/Revista9/Serra/Serra.pdf"
OTHER_SOURCE = "https://parnaseo.uv.es/lemir/textos/maura2.pdf"


def restore_title(dataset):
    records = dataset["records"]
    ids = [row.get("id") for row in records]
    sincronia = [row for row in records if row.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(sincronia) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected CUCSH corpus baseline or duplicate ID")
    if sum(not row.get("authors") for row in sincronia) != 101:
        raise ValueError("Expected precisely 101 Sincronía records without author")

    matched = []
    for record in records:
        if record.get("id") != RECORD_ID:
            continue
        original_url = (record.get("urls") or {}).get("canonical") or ""
        if (
            record.get("journal") != "Sincronía"
            or record.get("issueNumber") != ISSUE
            or record.get("year") != YEAR
            or record.get("title") != OLD_LABEL
            or record.get("authors")
            or record.get("legacyAuthorEvidence")
            or record.get("legacyIndexMislabelEvidence")
            or not record.get("legacyOriginal")
            or not original_url.lower().endswith("/nunez.htm")
        ):
            raise ValueError("Historical Vidaurre work baseline changed")
        record["title"] = TRUE_TITLE
        record["titleVariants"] = [TRUE_TITLE]
        record["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
        record["legacyIndexMislabelEvidence"] = {
            "kind": "independent-exact-work-and-original-url-bibliography",
            "previousTitle": OLD_LABEL,
            "verifiedTitle": TRUE_TITLE,
            "verifiedAuthors": [AUTHOR],
            "sourceUrl": SOURCE,
            "supportingBibliographyUrl": OTHER_SOURCE,
            "sourceArticleUrl": original_url,
            "matchedIssueNumber": ISSUE,
            "matchedYear": YEAR,
            "originalAvailabilityPreserved": True,
            "note": (
                "Giorgio Serra, Lemir 9 (2005), p. 9 and note 5 on p. 3, "
                "cites this 2000 Sincronía work by title, byline and "
                "the original nunez.htm URL. The primary page availability "
                "was not altered."
            ),
        }
        record["legacyAuthorEvidence"] = {
            "kind": "independent-title-author-original-url-citation",
            "sourceUrl": SOURCE,
            "verifiedTitle": TRUE_TITLE,
            "verifiedAuthors": [AUTHOR],
            "matchedIssueNumber": ISSUE,
            "originalAvailabilityPreserved": True,
        }
        matched.append(RECORD_ID)

    if matched != [RECORD_ID] or ids != [row.get("id") for row in records]:
        raise ValueError("Exactly one previously indexed article must change")
    if sum(not row.get("authors") for row in sincronia) != 100:
        raise ValueError("Expected 100 remaining Sincronía records without author")
    return dataset, matched


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    output, changed = restore_title(data)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_VIDAURRE_VERIFIED", json.dumps({
        "changed": changed, "records": len(output["records"]),
        "pendingAuthors": 100,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

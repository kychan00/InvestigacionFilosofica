#!/usr/bin/env python3
"""Restore three evidence-verified titles from Sincronía historical author labels.

Only the exact frozen bibliographic identities are eligible. Original article
URLs, status/availability, provenance, issue, year and record IDs are immutable.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

VERIFIED = [
  {
    "id": "cucsh:sincronia-legacy:1e03d7c907df022999a8",
    "issue": 13,
    "year": 2000,
    "prior": "Costantini, Peter",
    "title": "Trade talks without tear gas",
    "authors": [
      "Peter Costantini"
    ],
    "suffix": "/costantini3.htm",
    "sourceUrl": "https://www.routledge.com/Synchronizing-Science-and-Technology-with-Human-Behaviour-1st-Edition/Brand/p/book/9781849775908",
    "secondaryCitationUrl": None,
    "evidence": "Bibliography of Ralf Brand's Routledge book (2005) explicitly cites Costantini, P. (2000), the article title, Sincronía Winter 2000 and original costantini3.htm URL. Book preview is indexed under its publisher's ISBN."
  },
  {
    "id": "cucsh:sincronia-legacy:e017c8338187ec6e4212",
    "issue": 18,
    "year": 2001,
    "prior": "Zamora , Rogelio Luna",
    "title": "El Mestizaje y el tequila",
    "authors": [
      "Rogelio Luna Zamora"
    ],
    "suffix": "/mestiz.htm",
    "sourceUrl": "https://riunet.upv.es/server/api/core/bitstreams/92508e23-da08-4d99-8b2e-1100bd95afab/content",
    "secondaryCitationUrl": "https://revistas.ucr.ac.cr/index.php/reconomicas/article/view/6213",
    "evidence": "UPV master's dissertation p.52 explicitly cites Rogelio Luna (2001), El Mestizaje y el tequila, Sincronía and original mestiz.htm. Scholarly journal reference separately cites Luna, R. (2001), Mestizaje y el Tequila with identical URL."
  },
  {
    "id": "cucsh:sincronia-legacy:fcf488048b022c02adc8",
    "issue": 18,
    "year": 2001,
    "prior": "Assies,Willem, y Gemma van der Haar, y André J. Hoekema",
    "title": "Los pueblos indígenas y la reforma del estado en América Latina",
    "authors": [
      "Willem Assies",
      "Gemma van der Haar",
      "André J. Hoekema"
    ],
    "suffix": "/assies.htm",
    "sourceUrl": "https://red.pucp.edu.pe/ridei/fixes/2011/08/158.pdf",
    "secondaryCitationUrl": "https://www.aacademica.org/v.congreso.chileno.de.antropologia/119.pdf",
    "evidence": "PUCP-preserved original text shows the exact title and three bylines on page one; academic bibliography independently cites Sincronía's original assies.htm URL (year of that edition not inferred)."
  }
]


def apply_three_verified_titles(dataset):
    records = dataset["records"]
    ids = [row.get("id") for row in records]
    journal = [row for row in records if row.get("journal") == "Sincronía"]
    if len(records) != 1845 or len(journal) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen corpus size or record identities")
    if sum(not row.get("authors") for row in journal) != 104:
        raise ValueError("Expected 104 unresolved Sincronía author records")

    expected = {entry["id"]: entry for entry in VERIFIED}
    if len(expected) != 3 or len(VERIFIED) != 3:
        raise ValueError("Expected exactly three unique verified source records")
    changed = []
    for row in records:
        item = expected.get(row.get("id"))
        if item is None:
            continue
        original = (row.get("urls") or {}).get("canonical") or ""
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != item["issue"]
            or row.get("year") != item["year"]
            or row.get("title") != item["prior"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not original.lower().endswith(item["suffix"].lower())
        ):
            raise ValueError("Mismatched historical article baseline: " + item["id"])

        row["title"] = item["title"]
        row["titleVariants"] = [item["title"]]
        row["authors"] = [
            {"name": author, "sourceName": author}
            for author in item["authors"]
        ]
        row["legacyIndexMislabelEvidence"] = {
            "kind": "independent-exact-work-citation-overrides-author-index-label",
            "previousTitle": item["prior"],
            "verifiedTitle": item["title"],
            "verifiedAuthors": item["authors"],
            "sourceUrl": item["sourceUrl"],
            "secondaryCitationUrl": item["secondaryCitationUrl"],
            "sourceArticleUrl": original,
            "matchedIssueNumber": item["issue"],
            "matchedYear": item["year"],
            "evidenceNote": item["evidence"],
            "originalAvailabilityPreserved": True,
        }
        row["legacyAuthorEvidence"] = {
            "kind": "independent-title-and-author-matched-to-historical-url",
            "sourceUrl": item["sourceUrl"],
            "secondaryCitationUrl": item["secondaryCitationUrl"],
            "verifiedTitle": item["title"],
            "verifiedAuthors": item["authors"],
            "matchedIssueNumber": item["issue"],
            "originalAvailabilityPreserved": True,
        }
        changed.append(item["id"])

    if set(changed) != set(expected) or ids != [row.get("id") for row in records]:
        raise ValueError("Unexpected identity/order changes in three-record batch")
    if sum(not row.get("authors") for row in journal) != 101:
        raise ValueError("Expected 101 remaining records without authors")
    return dataset, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    dataset = json.loads(args.input.read_text(encoding="utf-8"))
    result, changed = apply_three_verified_titles(dataset)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_THREE_VERIFIED_TITLES", json.dumps({
        "changed": changed, "records": len(result["records"]),
        "remainingWithoutAuthors": 101
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

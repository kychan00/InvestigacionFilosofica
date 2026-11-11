#!/usr/bin/env python3
"""Backfill eight source-verified Sincronía issue 44 papers (Dialnet, 2007).

Evidence: targeted Dialnet exemplar 547426, GitHub Actions run 42975312757.
Only 8 additions are pinned here. The other 2 issue-44 records already exist
in the corpus and must be preserved, not overwritten or renumbered.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from scripts.cucsh.audit_sincronia_historical import normalized_title
from scripts.cucsh.harvest import serialize_dataset
from scripts.cucsh.sincronia_dialnet import build_record

ISSUE_NUMBER = 44
ISSUE_YEAR = 2007
EVIDENCE_URL = "https://dialnet.unirioja.es/ejemplar/547426"
VERIFIED_MISSING_ARTICLES = (
    {"code": "7417990", "title": "Génesis de un personaje teatral",
     "authors": ["Guillermo Schmidhuber de la Mora"]},
    {"code": "7417991", "title": "Un estudio contrastivo de los fonemas oclusivos entre español y chino",
     "authors": ["Cao Yufei"]},
    {"code": "7417992", "title": "Antropología de la conquista",
     "authors": ["Maximiliano Emanuel Korstanje"]},
    {"code": "7417993", "title": "Una aproximación sistémica a la realidad política",
     "authors": ["Cruz García Lirios"]},
    {"code": "7417994", "title": "‘Trust’ and Power",
     "authors": ["Tony Gilbert","Jason L. Powell"]},
    {"code": "7417995", "title": "Elementos simbólicos y míticos en La Fiesta del Chivo, de Mario Vargas Llosa",
     "authors": ["Claudia Macías Rodríguez"]},
    {"code": "7417996", "title": "Pedro Páramo, de Juan Rulfo y La viuda, de Hwang Sun Won",
     "authors": ["Bong Seo Yoon"]},
    {"code": "7417997", "title": "Desarrollo de habilidades lecto-investigadoras en lengua extranjera mediante textos virtuales",
     "authors": ["María Patricia Velázquez Martínez"]},
)


def issue44_additions():
    issue = {"year": ISSUE_YEAR, "number": ISSUE_NUMBER}
    return [
        build_record(
            {
                "code": evidence["code"],
                "url": (
                    "https://dialnet.unirioja.es/servlet/articulo?codigo="
                    + evidence["code"]
                ),
                "title": evidence["title"],
                "authors": list(evidence["authors"]),
            },
            issue,
        )
        for evidence in VERIFIED_MISSING_ARTICLES
    ]


def backfill_snapshot(snapshot):
    records = snapshot["records"]
    if not isinstance(records, list):
        raise ValueError("Missing record list")

    previously_in_issue = [
        row for row in records
        if row.get("journal") == "Sincronía"
        and row.get("issueNumber") == ISSUE_NUMBER
    ]
    if len(previously_in_issue) not in (2, 10):
        raise ValueError(
            f"Expected 2 existing issue-44 records (or 10 after backfill); "
            f"found {len(previously_in_issue)}"
        )

    additions = issue44_additions()
    if len(additions) != 8 or len({r["id"] for r in additions}) != 8:
        raise ValueError("Pinned Dialnet evidence is not eight distinct articles")

    by_id = {row.get("id"): row for row in records}
    canonical_urls = {
        (row.get("urls") or {}).get("canonical")
        for row in records
        if (row.get("urls") or {}).get("canonical")
    }
    keys = {
        (row.get("issueNumber"), normalized_title(row.get("title")))
        for row in records
        if row.get("journal") == "Sincronía"
    }

    absent = []
    for row in additions:
        identifier = row["id"]
        existing = by_id.get(identifier)
        if existing is not None:
            if (
                existing.get("journal") != "Sincronía"
                or existing.get("issueNumber") != ISSUE_NUMBER
                or normalized_title(existing.get("title")) !=
                normalized_title(row.get("title"))
            ):
                raise ValueError(f"Conflicting record already exists: {identifier}")
            continue
        if row["urls"]["canonical"] in canonical_urls:
            raise ValueError(f"Duplicate canonical URL for {identifier}")
        if (ISSUE_NUMBER, normalized_title(row["title"])) in keys:
            raise ValueError(f"Duplicate issue-44 title: {row['title']}")
        # Same title in another issue may be a true reprint or a wrong
        # assignment; require review before adding one automatically.
        if any(
            normalized_title(item.get("title")) == normalized_title(row["title"])
            and item.get("journal") == "Sincronía"
            for item in records
        ):
            raise ValueError(f"Title found in another Sincronía issue: {row['title']}")
        absent.append(row)

    if absent and (len(previously_in_issue) != 2 or len(absent) != 8):
        raise ValueError("Partial backfill requires manual investigation")

    output = dict(snapshot)
    output["records"] = [*records, *absent]
    output["records"].sort(
        key=lambda row: (
            row.get("journal") or "",
            row.get("year") or 0,
            row.get("doi") or "",
            row.get("sourceId") or "",
        )
    )
    final_issue = [
        r for r in output["records"]
        if r.get("journal") == "Sincronía"
        and r.get("issueNumber") == ISSUE_NUMBER
    ]
    if len(final_issue) != 10:
        raise ValueError(f"Expected exactly 10 issue-44 records, got {len(final_issue)}")
    report = {
        "issue": ISSUE_NUMBER,
        "year": ISSUE_YEAR,
        "source": EVIDENCE_URL,
        "before": len(previously_in_issue),
        "added": len(absent),
        "after": len(final_issue),
        "articleIdsAdded": [row["sourceId"] for row in absent],
        "preservedOriginalCount": len(records),
    }
    return output, report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--after", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    before = json.loads(args.before.read_text(encoding="utf-8"))
    after, report = backfill_snapshot(before)
    args.after.write_text(serialize_dataset(after), encoding="utf-8")
    args.report.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_ISSUE_44_BACKFILL", json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re

from collections import Counter
from pathlib import Path


PROVIDER = "CUCSH Filosofía"

REQUIRED_JOURNALS = {
    "Protrepsis",
    "Quadripartita Ratio",
}


ALLOWED_JOURNALS = {
    *REQUIRED_JOURNALS,
    "Sincronía",
}


def fail(message):
    raise SystemExit(
        "CUCSH UPDATE VALIDATION: FAIL\n"
        + str(message)
    )


def load_json(path):
    try:
        return json.loads(
            path.read_text(
                encoding="utf-8"
            )
        )
    except Exception as exc:
        fail(
            f"cannot read {path}: {exc}"
        )


def record_key(record):
    return (
        record.get("id")
        or record.get("sourceId")
    )


def duplicates(values):
    counts = Counter(
        value
        for value in values
        if value
    )

    return sorted(
        value
        for value, count
        in counts.items()
        if count > 1
    )


def validate_snapshot(
    data,
    label,
):
    if (
        data.get("schemaVersion")
        != 1
    ):
        fail(
            f"{label}: "
            "invalid schemaVersion"
        )


    if (
        data.get("provider")
        != PROVIDER
    ):
        fail(
            f"{label}: "
            "invalid provider"
        )


    records = data.get(
        "records"
    )


    if not isinstance(
        records,
        list,
    ):
        fail(
            f"{label}: "
            "records is not a list"
        )


    if not records:
        fail(
            f"{label}: "
            "empty corpus"
        )


    ids = [
        record_key(record)
        for record in records
    ]


    if any(
        not value
        for value in ids
    ):
        fail(
            f"{label}: "
            "record without stable id"
        )


    duplicate_ids = duplicates(
        ids
    )

    if duplicate_ids:
        fail(
            f"{label}: duplicate ids: "
            f"{duplicate_ids[:10]}"
        )


    dois = [
        record.get("doi")
        for record in records
        if record.get("doi")
    ]

    duplicate_dois = duplicates(
        dois
    )

    if duplicate_dois:
        fail(
            f"{label}: duplicate DOI: "
            f"{duplicate_dois[:10]}"
        )


    urls = [
        record.get(
            "urls",
            {}
        ).get(
            "canonical"
        )
        for record in records
        if record.get(
            "urls",
            {}
        ).get(
            "canonical"
        )
    ]

    duplicate_urls = duplicates(
        urls
    )

    if duplicate_urls:
        fail(
            f"{label}: duplicate URLs: "
            f"{duplicate_urls[:10]}"
        )


    journals = {
        record.get("journal")
        for record in records
    }


    if not journals.issubset(
        ALLOWED_JOURNALS
    ):
        fail(
            f"{label}: "
            "unexpected journals: "
            f"{sorted(journals)}"
        )


    missing_required = (
        REQUIRED_JOURNALS
        - journals
    )

    if missing_required:
        fail(
            f"{label}: "
            "missing required journals: "
            f"{sorted(missing_required)}"
        )


    for record in records:
        key = record_key(
            record
        )


        for field in (
            "title",
            "year",
            "journal",
        ):
            if not record.get(
                field
            ):
                fail(
                    f"{label}: "
                    f"missing {field} "
                    f"in {key}"
                )


        if (
            not record.get(
                "authors"
            )
            and not record.get(
                "legacyOriginal"
            )
        ):
            fail(
                f"{label}: "
                "missing authors "
                f"in {key}"
            )


        if record.get(
            "legacyOriginal"
        ):
            if (
                record.get(
                    "journal"
                )
                != "Sincronía"
            ):
                fail(
                    f"{label}: "
                    "legacy record outside "
                    f"Sincronía: {key}"
                )

            issue_number = (
                record.get(
                    "issueNumber"
                )
            )

            if (
                not isinstance(
                    issue_number,
                    int,
                )
                or not (
                    1 <=
                    issue_number <=
                    84
                )
            ):
                fail(
                    f"{label}: "
                    "invalid legacy "
                    f"issue number in {key}"
                )


        doi = record.get(
            "doi"
        )

        if (
            doi
            and doi.endswith(
                (
                    ".",
                    ",",
                    ";",
                    ":",
                )
            )
        ):
            fail(
                f"{label}: "
                "DOI with trailing "
                f"punctuation: {doi}"
            )


        title = str(
            record.get(
                "title"
            )
            or ""
        ).strip()


        if (
            title.casefold()
            == "editorial"
        ):
            fail(
                f"{label}: "
                "Editorial remained "
                f"in corpus: {key}"
            )


        searchable = json.dumps(
            {
                "abstract":
                    record.get(
                        "abstract"
                    ),

                "abstractVariants":
                    record.get(
                        "abstractVariants",
                        [],
                    ),
            },
            ensure_ascii=False,
        )


        if re.search(
            r"temperie.*"
            r"secci[oó]n\s+literaria\s+"
            r"no\s+arbitrada",
            searchable,
            re.IGNORECASE,
        ):
            fail(
                f"{label}: "
                "non-peer-reviewed "
                f"Temperie remained: {key}"
            )


    return records


# Minimum OBSERVED historical records, not a claim of exhaustive
# completeness. Numbers 1-48 and 50-51 come from the 2026-11-11
# legacy-v3 GitHub Actions evidence (run 42961992150).
# Number 44: audit 42975312757 confirmed 10 Dialnet articles and
# release 42975808247 safely added 8 records without deleting the 2 prior.
# Number 49's 21 titles are sourced from Dialnet exemplar 251060.
# Numbers 52-60 are from targeted successful Dialnet audit run
# 42971659878, de-duplicated by Dialnet article code across issues.
# Counts prevent a later network hiccup from silently publishing fewer
# records than were already found. Full article-level provenance is
# still required before calling the entire corpus complete.
SINCRONIA_HISTORICAL_OBSERVED_MINIMUM = {
    1: 14,
    2: 8,
    3: 4,
    4: 8,
    5: 10,
    6: 3,
    7: 7,
    8: 3,
    9: 6,
    10: 7,
    11: 5,
    12: 8,
    13: 8,
    14: 8,
    15: 7,
    16: 13,
    17: 13,
    18: 10,
    19: 18,
    20: 16,
    21: 26,
    22: 30,
    23: 9,
    24: 14,
    25: 17,
    26: 12,
    27: 11,
    28: 15,
    29: 2,
    30: 6,
    31: 3,
    32: 11,
    33: 2,
    34: 4,
    35: 8,
    36: 6,
    37: 9,
    38: 5,
    39: 6,
    40: 9,
    41: 13,
    42: 7,
    43: 7,
    44: 10,
    45: 10,
    46: 19,
    47: 14,
    48: 10,
    49: 21,
    50: 10,
    51: 9,
    52: 9,
    53: 8,
    54: 12,
    55: 4,
    56: 9,
    57: 11,
    58: 9,
    59: 6,
    60: 19,
}


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--before",
        type=Path,
        required=True,
    )

    parser.add_argument(
        "--after",
        type=Path,
        required=True,
    )

    parser.add_argument(
        "--allow-incomplete-sincronia",
        action="store_true",
        help=(
            "Discovery mode: report missing Sincronía "
            "issues without failing coverage validation. "
            "All structural and destructive-update checks "
            "remain strict."
        ),
    )

    args = parser.parse_args()


    before = validate_snapshot(
        load_json(
            args.before
        ),
        "BEFORE",
    )

    after = validate_snapshot(
        load_json(
            args.after
        ),
        "AFTER",
    )


    if not any(
        record.get("journal")
        == "Sincronía"
        for record in after
    ):
        fail(
            "AFTER: Sincronía is missing "
            "from the harvested corpus"
        )


    sincronia_issue_numbers = {
        record.get(
            "issueNumber"
        )
        for record in after
        if (
            record.get(
                "journal"
            )
            == "Sincronía"
            and isinstance(
                record.get(
                    "issueNumber"
                ),
                int,
            )
        )
    }

    expected_sincronia_issues = set(
        range(
            1,
            91,
        )
    )

    missing_sincronia_issues = sorted(
        expected_sincronia_issues
        - sincronia_issue_numbers
    )

    if missing_sincronia_issues:
        if args.allow_incomplete_sincronia:
            print(
                "CUCSH UPDATE VALIDATION: "
                "DISCOVERY WARNING"
            )
            print(
                "AFTER: incomplete Sincronía "
                "issue coverage; missing "
                f"{missing_sincronia_issues}"
            )
        else:
            fail(
                "AFTER: incomplete Sincronía "
                "issue coverage; missing "
                f"{missing_sincronia_issues}"
            )



    # Issue presence alone is insufficient: one record per issue would
    # pass the issue-number gate while discarding hundreds of articles.
    historical_counts = Counter(
        record.get("issueNumber")
        for record in after
        if record.get("journal") == "Sincronía"
        and isinstance(record.get("issueNumber"), int)
        and 1 <= record["issueNumber"] <= 60
    )
    below_observed_baseline = {
        issue: {
            "found": historical_counts[issue],
            "minimum": floor,
        }
        for issue, floor in SINCRONIA_HISTORICAL_OBSERVED_MINIMUM.items()
        if historical_counts[issue] < floor
    }
    if below_observed_baseline:
        message = (
            "AFTER: Sincronía historical article counts fell below "
            "previously observed evidence: "
            f"{below_observed_baseline}"
        )
        if args.allow_incomplete_sincronia:
            print("CUCSH UPDATE VALIDATION: DISCOVERY WARNING")
            print(message)
        else:
            fail(message)


    before_by_id = {
        record_key(record):
            record
        for record in before
    }

    after_by_id = {
        record_key(record):
            record
        for record in after
    }


    removed = sorted(
        set(before_by_id)
        - set(after_by_id)
    )

    added = sorted(
        set(after_by_id)
        - set(before_by_id)
    )

    common = (
        set(before_by_id)
        & set(after_by_id)
    )


    changed = sorted(
        key
        for key in common
        if (
            before_by_id[key]
            != after_by_id[key]
        )
    )


    if removed:
        print(
            "===== REMOVED RECORDS ====="
        )

        for key in removed[:25]:
            record = (
                before_by_id[key]
            )

            print(
                "-",
                key,
                "|",
                record.get(
                    "title"
                ),
            )

        fail(
            "refusing destructive "
            "update: "
            f"{len(removed)} "
            "previous records disappeared"
        )


    # A source hiccup must not silently erase an author already verified
    # and committed. This applies equally to strict and discovery mode.
    lost_authors = [
        key for key in sorted(common)
        if before_by_id[key].get("journal") == "Sincronía"
        and before_by_id[key].get("authors")
        and not after_by_id[key].get("authors")
    ]
    if lost_authors:
        fail(
            "AFTER: previously verified Sincronía authors disappeared "
            f"from {len(lost_authors)} records: {lost_authors[:15]}"
        )


    before_counts = Counter(
        record["journal"]
        for record in before
    )

    after_counts = Counter(
        record["journal"]
        for record in after
    )


    print(
        "===== CUCSH UPDATE VALIDATION ====="
    )

    print(
        "before =",
        len(before),
    )

    print(
        "after  =",
        len(after),
    )

    print(
        "added  =",
        len(added),
    )

    print(
        "changed metadata =",
        len(changed),
    )

    print(
        "removed =",
        len(removed),
    )


    print()
    print(
        "===== JOURNALS ====="
    )

    for journal in sorted(
        ALLOWED_JOURNALS
    ):
        print(
            f"{journal}: "
            f"{before_counts[journal]} "
            f"-> "
            f"{after_counts[journal]}"
        )


    if added:
        print()
        print(
            "===== NEW RECORDS ====="
        )

        for key in added[:50]:
            record = (
                after_by_id[key]
            )

            print(
                "-",
                record["journal"],
                record["year"],
                "|",
                record["title"],
                "|",
                record.get("doi"),
            )


    if changed:
        print()
        print(
            "===== UPDATED METADATA ====="
        )

        for key in changed[:25]:
            record = (
                after_by_id[key]
            )

            print(
                "-",
                record["journal"],
                "|",
                record["title"],
            )


    print()
    print(
        "CUCSH UPDATE VALIDATION: PASS"
    )


if __name__ == "__main__":
    main()

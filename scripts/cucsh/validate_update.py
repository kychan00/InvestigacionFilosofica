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
                    51
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
        fail(
            "AFTER: incomplete Sincronía "
            "issue coverage; missing "
            f"{missing_sincronia_issues}"
        )


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

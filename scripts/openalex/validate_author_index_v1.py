import json
from pathlib import Path

from author_index_common import (
    BUCKET_COUNT,
    INDEX_VERSION,
    bucket_for,
    sha256_file,
)


ROOT = Path(
    "artifacts/author-index-v1/site"
) / INDEX_VERSION


def load_json(path):
    return json.loads(
        Path(path).read_text(
            encoding="utf-8"
        )
    )


def validate_inventory(root, entries):
    for entry in entries:
        path = root / entry["path"]

        if not path.is_file():
            raise AssertionError(
                f"Missing file: {path}"
            )

        if path.stat().st_size != entry[
            "size_bytes"
        ]:
            raise AssertionError(
                f"Size mismatch: {path}"
            )

        if sha256_file(path) != entry[
            "sha256"
        ]:
            raise AssertionError(
                f"SHA-256 mismatch: {path}"
            )


def validate_aliases(paths):
    rows = 0

    for path in paths:
        expected_bucket = int(
            path.stem
        )

        with path.open(
            "r",
            encoding="utf-8",
        ) as stream:
            for line in stream:
                payload = json.loads(line)

                if bucket_for(
                    payload["s"]
                ) != expected_bucket:
                    raise AssertionError(
                        "Alias in wrong bucket: "
                        f"{path}"
                    )

                if not payload["n"]:
                    raise AssertionError(
                        "Empty canonical name"
                    )

                rows += 1

    return rows


def validate_works(paths):
    rows = 0

    for path in paths:
        expected_bucket = int(
            path.stem
        )

        with path.open(
            "r",
            encoding="utf-8",
        ) as stream:
            for line in stream:
                payload = json.loads(line)

                if bucket_for(
                    str(payload["id"])
                ) != expected_bucket:
                    raise AssertionError(
                        "Work in wrong bucket: "
                        f"{path}"
                    )

                if not payload["t"]:
                    raise AssertionError(
                        "Work without title"
                    )

                rows += 1

    return rows


def main():
    manifest = load_json(
        ROOT / "manifest.json"
    )

    if manifest["version"] != INDEX_VERSION:
        raise AssertionError(
            "Unexpected index version"
        )

    if manifest["bucket_count"] != (
        BUCKET_COUNT
    ):
        raise AssertionError(
            "Unexpected bucket count"
        )

    aliases = manifest["files"]["aliases"]
    works = manifest["files"]["works"]

    validate_inventory(ROOT, aliases)
    validate_inventory(ROOT, works)

    alias_paths = [
        ROOT / entry["path"]
        for entry in aliases
    ]

    work_paths = [
        ROOT / entry["path"]
        for entry in works
    ]

    alias_rows = validate_aliases(
        alias_paths
    )

    work_rows = validate_works(
        work_paths
    )

    counts = manifest["counts"]

    if alias_rows != counts["alias_rows"]:
        raise AssertionError(
            "Alias row count mismatch"
        )

    if work_rows != counts[
        "work_rows_published"
    ]:
        raise AssertionError(
            "Work row count mismatch"
        )

    if counts["corpus_works"] != 451823:
        raise AssertionError(
            "Corpus membership drift"
        )

    coverage = manifest["coverage"]

    if coverage[
        "authors_resolved_ratio"
    ] < 0.95:
        raise AssertionError(
            "Author identity coverage below 95%"
        )

    if not 0 <= coverage[
        "works_with_authorship_ratio"
    ] <= 1:
        raise AssertionError(
            "Invalid work coverage ratio"
        )

    sample = load_json(
        ROOT / "sample-kant.json"
    )

    if not any(
        "kant" in row["display_name"].casefold()
        for row in sample["authors"]
    ):
        raise AssertionError(
            "Kant smoke sample is empty"
        )

    print(
        json.dumps({
            "status": "ok",
            "alias_rows": alias_rows,
            "work_rows": work_rows,
            "coverage": coverage,
        })
    )


if __name__ == "__main__":
    main()

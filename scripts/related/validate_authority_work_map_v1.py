#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from authority_work_map_v1 import (
    load_authority_work_map,
    sha256_file,
)


def _assert_equal(
    actual: Any,
    expected: Any,
    label: str,
) -> None:
    if actual != expected:
        raise RuntimeError(
            f"{label} mismatch: expected {expected!r}, got {actual!r}"
        )


def validate_authority_work_map(
    root: Path,
    *,
    author_index_root: Path | None = None,
    authority_root: Path | None = None,
) -> dict[str, Any]:
    root = Path(root)
    authority_map = load_authority_work_map(root)
    manifest = authority_map.manifest
    counts = manifest.get("counts") or {}
    source = manifest.get("source") or {}

    works_seen = int(counts.get("worksSeen", -1))
    works_mapped = int(counts.get("worksMapped", -1))
    works_without = int(
        counts.get("worksWithoutConfirmedAuthority", -1)
    )

    if min(works_seen, works_mapped, works_without) < 0:
        raise RuntimeError("authority work map counts are incomplete")

    _assert_equal(
        works_seen,
        works_mapped + works_without,
        "work coverage arithmetic",
    )

    raw_mentions = int(counts.get("rawAuthorMentions", -1))
    confirmed_mentions = int(
        counts.get("confirmedAuthorityMentions", -1)
    )
    unresolved_mentions = int(
        counts.get("unresolvedAuthorMentions", -1)
    )
    collapsed_mentions = int(
        counts.get("collapsedAuthorityMentions", -1)
    )

    if min(
        raw_mentions,
        confirmed_mentions,
        unresolved_mentions,
        collapsed_mentions,
    ) < 0:
        raise RuntimeError(
            "authority work map author mention counts are incomplete"
        )

    _assert_equal(
        raw_mentions,
        confirmed_mentions
        + unresolved_mentions
        + collapsed_mentions,
        "author mention arithmetic",
    )

    observed_confirmed = sum(
        len(info.authority_refs)
        for info in authority_map.works.values()
    )

    _assert_equal(
        observed_confirmed,
        confirmed_mentions,
        "confirmed authority memberships",
    )

    if author_index_root is not None:
        author_manifest = Path(author_index_root) / "manifest.json"
        if not author_manifest.is_file():
            raise RuntimeError(
                "author-index manifest is missing for source validation"
            )

        _assert_equal(
            source.get("authorIndex", {}).get("manifestSha256"),
            sha256_file(author_manifest),
            "author-index manifest SHA-256",
        )

    if authority_root is not None:
        authority_root = Path(authority_root)
        authority_manifest = authority_root / "manifest.json"
        registry = authority_root / "registry.json"

        if not authority_manifest.is_file():
            raise RuntimeError(
                "authority batch manifest is missing for source validation"
            )

        if not registry.is_file():
            raise RuntimeError(
                "authority registry is missing for source validation"
            )

        _assert_equal(
            source.get("authorityGraph", {}).get("manifestSha256"),
            sha256_file(authority_manifest),
            "authority manifest SHA-256",
        )

        _assert_equal(
            source.get("authorityGraph", {}).get("registrySha256"),
            sha256_file(registry),
            "authority registry SHA-256",
        )

    report = {
        "schemaVersion": "authority-work-map-validation-v1",
        "status": "pass",
        "manifestSha256": sha256_file(root / "manifest.json"),
        "worksSeen": works_seen,
        "worksMapped": works_mapped,
        "worksWithoutConfirmedAuthority": works_without,
        "rawAuthorMentions": raw_mentions,
        "confirmedAuthorityMentions": confirmed_mentions,
        "unresolvedAuthorMentions": unresolved_mentions,
        "collapsedAuthorityMentions": collapsed_mentions,
        "uniqueMappedWorks": len(authority_map.works),
    }

    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--map", type=Path, required=True)
    parser.add_argument("--author-index", type=Path)
    parser.add_argument("--authority", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    report = validate_authority_work_map(
        args.map,
        author_index_root=args.author_index,
        authority_root=args.authority,
    )

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(
                report,
                ensure_ascii=False,
                sort_keys=True,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    print(
        json.dumps(
            report,
            ensure_ascii=False,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()

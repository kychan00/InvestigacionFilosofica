#!/usr/bin/env python3
"""Build an item-level registry of structural program-metadata conflicts.

The registry is deliberately non-admissive. It freezes both sides of exact
(title + thesis-author) cross-program conflicts so later authority work can
protect ambiguous records symmetrically without guessing which label is right.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import audit_program_metadata_integrity_v2 as integrity


SCHEMA_VERSION = "thesis-program-metadata-conflict-registry-v1"
DECISION_CONSTRAINT = "conflict-registry-does-not-change-admission"
EVIDENCE_CODE = "exact-title-author-cross-program-conflict"


def read_json(path: Path) -> Any:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            return json.load(handle)
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    opener = gzip.open if path.suffix == ".gz" else open
    output: list[dict[str, Any]] = []
    with opener(path, "rt", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                output.append(json.loads(line))
    return output


def handle_for_work(work: dict[str, Any]) -> str | None:
    return next(
        (
            identifier.get("normalizedValue")
            for identifier in work.get("persistentIdentifiers", [])
            if identifier.get("scheme") == "handle"
        ),
        None,
    )


def side_descriptor(
    work: dict[str, Any],
    source: dict[str, Any],
) -> dict[str, Any]:
    date = work.get("date") or {}
    return {
        "workId": work.get("id"),
        "sourceRecordId": source.get("id"),
        "providerRecordId": source.get("providerRecordId"),
        "handle": handle_for_work(work),
        "provider": source.get("provider"),
        "programRaw": work.get("programRaw"),
        "programKey": integrity.normalize_key(work.get("programRaw")),
        "academicUnitRaw": work.get("academicUnitRaw"),
        "year": date.get("value"),
        "dateQuality": date.get("quality"),
        "accessionDay": integrity.accession_day(source),
    }


def stable_pair_id(
    left_provider_record_id: str,
    right_provider_record_id: str,
) -> str:
    ordered = sorted(
        [left_provider_record_id, right_provider_record_id]
    )
    digest = hashlib.sha256("|".join(ordered).encode("utf-8")).hexdigest()
    return f"program-conflict:{digest[:20]}"


def build_registry(
    integrity_audit: dict[str, Any],
    corpus: dict[str, Any],
    source_records: list[dict[str, Any]],
) -> dict[str, Any]:
    target_key = integrity.normalize_key(
        integrity_audit.get("targetProgramKey")
    )
    if not target_key:
        raise ValueError("Integrity audit targetProgramKey is required")

    source_by_id = {
        source["id"]: source
        for source in source_records
        if source.get("id")
    }

    works = list(corpus.get("works", []))
    work_by_id = {
        work["id"]: work
        for work in works
        if work.get("id")
    }

    title_index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for work in works:
        title_key = integrity.normalize_key(work.get("title"))
        if title_key:
            title_index[title_key].append(work)

    target_structural_ids = {
        record["workId"]
        for record in integrity_audit.get("records", [])
        if record.get("auditClass") == "structural-conflict"
        and record.get("workId")
    }

    pairs: list[dict[str, Any]] = []
    alternate_programs: Counter[str] = Counter()
    unique_work_ids: set[str] = set()
    unique_source_ids: set[str] = set()
    target_work_ids: set[str] = set()
    alternate_work_ids: set[str] = set()
    accession_pair_days: Counter[str] = Counter()

    for work_id in sorted(target_structural_ids):
        work = work_by_id.get(work_id)
        if not work:
            raise ValueError(
                f"Structural work missing from canonical corpus: {work_id}"
            )

        if integrity.normalize_key(work.get("programRaw")) != target_key:
            raise ValueError(
                f"Structural work does not match target program: {work_id}"
            )

        refs = work.get("sourceRecordRefs") or []
        if not refs or refs[0] not in source_by_id:
            raise ValueError(
                f"Target source record missing for {work_id}"
            )
        source = source_by_id[refs[0]]

        title_key = integrity.normalize_key(work.get("title"))
        author_key = integrity.thesis_authors(work)
        if not title_key or not author_key:
            raise ValueError(
                f"Structural conflict lacks normalized title/authors: {work_id}"
            )

        alternatives = [
            other
            for other in title_index.get(title_key, [])
            if other.get("id") != work_id
            and integrity.normalize_key(other.get("programRaw")) != target_key
            and integrity.thesis_authors(other) == author_key
        ]

        if not alternatives:
            raise ValueError(
                f"Structural conflict has no reproducible counterpart: {work_id}"
            )

        for other in sorted(
            alternatives,
            key=lambda item: str(item.get("id") or ""),
        ):
            other_refs = other.get("sourceRecordRefs") or []
            if (
                not other_refs
                or other_refs[0] not in source_by_id
            ):
                raise ValueError(
                    f"Alternate source record missing for {other.get('id')}"
                )
            other_source = source_by_id[other_refs[0]]

            left_provider_id = source.get("providerRecordId")
            right_provider_id = other_source.get("providerRecordId")
            if not left_provider_id or not right_provider_id:
                raise ValueError(
                    "Provider record identifiers are required for stable pairs"
                )

            target_side = side_descriptor(work, source)
            alternate_side = side_descriptor(other, other_source)

            pair_id = stable_pair_id(
                left_provider_id,
                right_provider_id,
            )

            pair = {
                "pairId": pair_id,
                "evidenceCode": EVIDENCE_CODE,
                "integrityState": "structural-conflict",
                "decisionConstraint": DECISION_CONSTRAINT,
                "recommendedConfidenceState": "conflicted",
                "recommendedAuthorityApplicability": "blocked",
                "normalizedTitle": title_key,
                "normalizedThesisAuthors": list(author_key),
                "target": target_side,
                "alternate": alternate_side,
            }
            pairs.append(pair)

            unique_work_ids.update(
                [target_side["workId"], alternate_side["workId"]]
            )
            unique_source_ids.update(
                [
                    target_side["sourceRecordId"],
                    alternate_side["sourceRecordId"],
                ]
            )
            target_work_ids.add(target_side["workId"])
            alternate_work_ids.add(alternate_side["workId"])

            alternate_programs[
                alternate_side["programKey"]
            ] += 1

            accession_pair_days[
                (
                    f"{target_side['accessionDay'] or '<missing>'}"
                    f" | {alternate_side['accessionDay'] or '<missing>'}"
                )
            ] += 1

    pairs.sort(key=lambda pair: pair["pairId"])

    if len(target_work_ids) != len(target_structural_ids):
        missing = sorted(target_structural_ids - target_work_ids)
        raise ValueError(
            "Not every structural target work produced a registry pair: "
            + ", ".join(missing)
        )

    pair_ids = [pair["pairId"] for pair in pairs]
    if len(pair_ids) != len(set(pair_ids)):
        raise ValueError("Duplicate stable conflict pair id")

    return {
        "schemaVersion": SCHEMA_VERSION,
        "targetProgramKey": target_key,
        "sourceIntegrityAuditSchema": integrity_audit.get(
            "schemaVersion"
        ),
        "decisionConstraint": DECISION_CONSTRAINT,
        "authorityDecision": "hold",
        "applicationState": "recommendation-only",
        "metrics": {
            "conflictPairs": len(pairs),
            "targetStructuralWorks": len(target_work_ids),
            "alternateWorks": len(alternate_work_ids),
            "uniqueWorks": len(unique_work_ids),
            "uniqueSourceRecords": len(unique_source_ids),
            "alternateProgramKeys": dict(
                alternate_programs.most_common()
            ),
            "accessionPairDays": dict(
                accession_pair_days.most_common()
            ),
        },
        "pairs": pairs,
        "notes": [
            (
                "Both sides of each pair are preserved because the conflict "
                "does not prove which program label is correct."
            ),
            (
                "recommendedAuthorityApplicability=blocked is a future gate "
                "recommendation only; this registry does not change admission."
            ),
            (
                "Stable pair ids are derived only from RIUdeG provider record "
                "identifiers, not corpus row order or thesis topic."
            ),
        ],
    }


def markdown_summary(registry: dict[str, Any]) -> str:
    metrics = registry["metrics"]
    lines = [
        "# Program Metadata Conflict Registry V1",
        "",
        f"Target: `{registry['targetProgramKey']}`",
        "",
        f"Decision constraint: `{registry['decisionConstraint']}`",
        "",
        f"Authority decision: **{registry['authorityDecision'].upper()}**",
        "",
        "## Metrics",
        "",
        f"- conflict pairs: **{metrics['conflictPairs']}**",
        (
            "- target structural works: "
            f"**{metrics['targetStructuralWorks']}**"
        ),
        f"- alternate works: **{metrics['alternateWorks']}**",
        f"- unique works: **{metrics['uniqueWorks']}**",
        (
            "- unique source records: "
            f"**{metrics['uniqueSourceRecords']}**"
        ),
        "",
        "## Alternate program labels",
        "",
    ]

    for key, count in metrics["alternateProgramKeys"].items():
        lines.append(f"- `{key}`: {count}")

    lines.extend(
        [
            "",
            "## Pairs",
            "",
            "| Pair | Target handle | Alternate handle | Alternate program |",
            "|---|---|---|---|",
        ]
    )

    for pair in registry["pairs"]:
        lines.append(
            "| {pair_id} | {target} | {alternate} | {program} |".format(
                pair_id=pair["pairId"],
                target=pair["target"].get("handle") or "—",
                alternate=pair["alternate"].get("handle") or "—",
                program=pair["alternate"].get("programKey") or "—",
            )
        )

    lines.extend(
        [
            "",
            "## Governance",
            "",
            (
                "This registry isolates ambiguity symmetrically. It does not "
                "choose a correct program, change admission, or create V25."
            ),
            "",
        ]
    )
    return "\n".join(lines)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)
        + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--integrity-audit", type=Path, required=True)
    parser.add_argument("--canonical-corpus", type=Path, required=True)
    parser.add_argument("--source-records", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    registry = build_registry(
        read_json(args.integrity_audit),
        read_json(args.canonical_corpus),
        read_jsonl(args.source_records),
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_json(
        args.output_dir / "program-metadata-conflict-registry.json",
        registry,
    )
    (
        args.output_dir / "program-metadata-conflict-registry.md"
    ).write_text(markdown_summary(registry), encoding="utf-8")

    print(
        json.dumps(
            registry["metrics"],
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()

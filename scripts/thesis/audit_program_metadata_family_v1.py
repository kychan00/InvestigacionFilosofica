#!/usr/bin/env python3
"""Audit structural program-metadata conflicts inside a program-name family.

This audit is deliberately non-admissive. A normalized-program regex is used
only to define an evidence cohort. It never creates, merges, or applies Program
Authority and never infers identity from thesis topic.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import audit_program_metadata_integrity_v2 as integrity


SCHEMA_VERSION = "thesis-program-metadata-family-audit-v1"
DECISION_CONSTRAINT = "family-audit-does-not-change-admission"


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
            item.get("normalizedValue")
            for item in work.get("persistentIdentifiers", [])
            if item.get("scheme") == "handle"
        ),
        None,
    )


def stable_pair_id(left: str, right: str) -> str:
    ordered = sorted([left, right])
    digest = hashlib.sha256("|".join(ordered).encode("utf-8")).hexdigest()
    return f"program-conflict:{digest[:20]}"


def source_for_work(
    work: dict[str, Any],
    source_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    refs = work.get("sourceRecordRefs") or []
    if not refs or refs[0] not in source_by_id:
        raise ValueError(
            f"Missing source record for work {work.get('id')}"
        )
    return source_by_id[refs[0]]


def build_family_audit(
    corpus: dict[str, Any],
    source_records: list[dict[str, Any]],
    *,
    normalized_program_regex: str,
    family_id: str,
) -> dict[str, Any]:
    pattern = re.compile(normalized_program_regex)
    source_by_id = {
        source["id"]: source
        for source in source_records
        if source.get("id")
    }

    works = list(corpus.get("works", []))
    selected = [
        work
        for work in works
        if pattern.search(
            integrity.normalize_key(work.get("programRaw"))
        )
    ]
    selected_ids = {
        work.get("id")
        for work in selected
        if work.get("id")
    }

    title_index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for work in works:
        title_key = integrity.normalize_key(work.get("title"))
        if title_key:
            title_index[title_key].append(work)

    units: Counter[str] = Counter()
    providers: Counter[str] = Counter()
    program_groups: Counter[str] = Counter()
    date_quality: Counter[str] = Counter()
    accession_days: Counter[str] = Counter()
    source_field_presence: Counter[str] = Counter()
    years: list[int] = []

    source_agreement = 0
    source_disagreement = 0
    title_conflict_works = 0
    structural_conflict_works = 0
    warning_only_works = 0
    no_detected_conflict_works = 0

    pair_map: dict[str, dict[str, Any]] = {}
    external_structural_pairs = 0

    for work in selected:
        program_key = integrity.normalize_key(work.get("programRaw"))
        program_groups[program_key] += 1
        units[str(work.get("academicUnitRaw") or "<missing>")] += 1

        source = source_for_work(work, source_by_id)
        providers[str(source.get("provider") or "<missing>")] += 1
        raw = source.get("rawFields") or {}

        quality = str((work.get("date") or {}).get("quality") or "unknown")
        date_quality[quality] += 1

        year = integrity.valid_year(work)
        if year is not None:
            years.append(year)

        day = integrity.accession_day(source)
        accession_days[day or "<missing>"] += 1

        for field in (
            "dc.date.issued",
            "dc.description.abstract",
            "dc.date.submitted",
        ):
            if integrity.has_field(source, field):
                source_field_presence[field] += 1

        degree_names = raw.get("dc.degree.name") or []
        if (
            degree_names
            and any(
                integrity.normalize_key(value) == program_key
                for value in degree_names
            )
        ):
            source_agreement += 1
        else:
            source_disagreement += 1

        title_key = integrity.normalize_key(work.get("title"))
        conflicting = [
            other
            for other in title_index.get(title_key, [])
            if other.get("id") != work.get("id")
            and integrity.normalize_key(other.get("programRaw"))
            != program_key
        ]

        author_key = integrity.thesis_authors(work)
        same_author = [
            other
            for other in conflicting
            if author_key
            and integrity.thesis_authors(other) == author_key
        ]

        if same_author:
            title_conflict_works += 1
            structural_conflict_works += 1
        elif conflicting:
            title_conflict_works += 1
            warning_only_works += 1
        else:
            no_detected_conflict_works += 1

        if not same_author:
            continue

        left_source = source
        left_provider_id = left_source.get("providerRecordId")
        if not left_provider_id:
            raise ValueError(
                f"Provider record id required for {work.get('id')}"
            )

        for other in same_author:
            other_source = source_for_work(other, source_by_id)
            right_provider_id = other_source.get("providerRecordId")
            if not right_provider_id:
                raise ValueError(
                    f"Provider record id required for {other.get('id')}"
                )

            pair_id = stable_pair_id(
                left_provider_id,
                right_provider_id,
            )
            if pair_id in pair_map:
                continue

            other_program_key = integrity.normalize_key(
                other.get("programRaw")
            )
            internal = other.get("id") in selected_ids
            if not internal:
                external_structural_pairs += 1

            sides = [
                (
                    work,
                    left_source,
                    program_key,
                ),
                (
                    other,
                    other_source,
                    other_program_key,
                ),
            ]
            sides.sort(
                key=lambda item: str(
                    item[1].get("providerRecordId") or ""
                )
            )

            pair_map[pair_id] = {
                "pairId": pair_id,
                "evidenceCode": (
                    "exact-title-author-cross-program-conflict"
                ),
                "integrityState": "structural-conflict",
                "internalToSelectedFamily": internal,
                "normalizedTitle": title_key,
                "normalizedThesisAuthors": list(author_key),
                "sides": [
                    {
                        "workId": side_work.get("id"),
                        "sourceRecordId": side_source.get("id"),
                        "providerRecordId": side_source.get(
                            "providerRecordId"
                        ),
                        "handle": handle_for_work(side_work),
                        "programRaw": side_work.get("programRaw"),
                        "programKey": side_program_key,
                        "academicUnitRaw": side_work.get(
                            "academicUnitRaw"
                        ),
                        "accessionDay": integrity.accession_day(
                            side_source
                        ),
                    }
                    for (
                        side_work,
                        side_source,
                        side_program_key,
                    ) in sides
                ],
            }

    pairs = [
        pair_map[key]
        for key in sorted(pair_map)
    ]

    metrics = {
        "works": len(selected),
        "normalizedProgramGroups": len(program_groups),
        "providers": dict(providers.most_common()),
        "observedUnits": dict(units.most_common()),
        "sourceProgramAgreementWorks": source_agreement,
        "sourceProgramDisagreementWorks": source_disagreement,
        "dateQuality": dict(date_quality.most_common()),
        "validYearSpan": {
            "min": min(years) if years else None,
            "max": max(years) if years else None,
            "observations": len(years),
        },
        "accessionDays": dict(accession_days.most_common()),
        "sourceFieldPresence": dict(
            source_field_presence.most_common()
        ),
        "exactTitleCrossProgramConflictWorks": (
            title_conflict_works
        ),
        "structuralConflictWorks": structural_conflict_works,
        "warningOnlyWorks": warning_only_works,
        "noDetectedConflictWorks": no_detected_conflict_works,
        "structuralConflictPairs": len(pairs),
        "externalStructuralConflictPairs": (
            external_structural_pairs
        ),
    }

    return {
        "schemaVersion": SCHEMA_VERSION,
        "familyId": family_id,
        "normalizedProgramRegex": normalized_program_regex,
        "decisionConstraint": DECISION_CONSTRAINT,
        "authorityDecision": "hold",
        "applicationState": "audit-only",
        "metrics": metrics,
        "programGroups": [
            {
                "normalizedKey": key,
                "works": count,
            }
            for key, count in program_groups.most_common()
        ],
        "pairs": pairs,
        "notes": [
            (
                "The regex defines an audit cohort only and never creates "
                "Program Authority or aliases."
            ),
            (
                "Exact title + exact thesis-author conflicts identify "
                "structural metadata ambiguity but do not prove which label "
                "is correct."
            ),
            (
                "Thesis title/topic semantics never resolve program identity."
            ),
        ],
    }


def markdown_summary(audit: dict[str, Any]) -> str:
    metrics = audit["metrics"]
    lines = [
        "# Program Metadata Family Audit V1",
        "",
        f"Family: `{audit['familyId']}`",
        "",
        (
            "Decision constraint: "
            f"`{audit['decisionConstraint']}`"
        ),
        "",
        f"Works: **{metrics['works']:,}**",
        (
            "Normalized program groups: "
            f"**{metrics['normalizedProgramGroups']:,}**"
        ),
        (
            "Structural conflict pairs: "
            f"**{metrics['structuralConflictPairs']:,}**"
        ),
        (
            "Structural conflict works: "
            f"**{metrics['structuralConflictWorks']:,}**"
        ),
        (
            "External structural pairs: "
            f"**{metrics['externalStructuralConflictPairs']:,}**"
        ),
        "",
        "## Pairs",
        "",
    ]
    for pair in audit["pairs"]:
        lines.append(f"- `{pair['pairId']}`")
        for side in pair["sides"]:
            lines.append(
                "  - "
                f"{side['handle']} · "
                f"`{side['programKey']}`"
            )
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--canonical-corpus", required=True, type=Path)
    parser.add_argument("--source-records", required=True, type=Path)
    parser.add_argument(
        "--normalized-program-regex",
        required=True,
    )
    parser.add_argument("--family-id", required=True)
    parser.add_argument("--output-dir", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    corpus = read_json(args.canonical_corpus)
    source_records = read_jsonl(args.source_records)
    audit = build_family_audit(
        corpus,
        source_records,
        normalized_program_regex=args.normalized_program_regex,
        family_id=args.family_id,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (
        args.output_dir
        / "program-metadata-family-audit.json"
    ).write_text(
        json.dumps(
            audit,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    (
        args.output_dir
        / "program-metadata-family-audit.md"
    ).write_text(
        markdown_summary(audit),
        encoding="utf-8",
    )

    print(json.dumps(audit["metrics"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generic program-metadata integrity audit.

This layer is deliberately non-admissive:
- it never creates or changes AcademicProgramAuthority;
- it never reassigns a work to another program;
- title/topic semantics never decide integrity or scope;
- exact title + same thesis-author across different program labels is treated
  as a structural source-metadata conflict that requires item-level review.
"""

from __future__ import annotations

import argparse
import gzip
import html
import json
import re
import unicodedata

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "thesis-program-metadata-integrity-audit-v2"
DECISION_CONSTRAINT = "metadata-integrity-audit-does-not-change-admission"


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = html.unescape(str(value))
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def normalize_key(value: Any) -> str:
    text = clean_text(value) or ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.casefold()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


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


def valid_year(work: dict[str, Any]) -> int | None:
    date = work.get("date") or {}
    value = str(date.get("value") or "")
    if (
        date.get("quality") == "valid"
        and len(value) >= 4
        and value[:4].isdigit()
    ):
        return int(value[:4])
    return None


def thesis_authors(work: dict[str, Any]) -> tuple[str, ...]:
    return tuple(
        sorted(
            normalize_key(contribution.get("rawName"))
            for contribution in work.get("contributions", [])
            if contribution.get("role") == "thesis-author"
            and normalize_key(contribution.get("rawName"))
        )
    )


def accession_day(source: dict[str, Any] | None) -> str | None:
    if not source:
        return None
    raw = source.get("rawFields") or {}
    values = (
        raw.get("dc.date.accessioned")
        or raw.get("DC.date.accessioned")
        or []
    )
    value = clean_text(values[0]) if values else None
    return value[:10] if value and len(value) >= 10 else value


def has_field(source: dict[str, Any] | None, field: str) -> bool:
    if not source:
        return False
    return bool((source.get("rawFields") or {}).get(field))


def collection_analysis(
    source_records: list[dict[str, Any]],
    target_collection_counts: Counter[str],
) -> list[dict[str, Any]]:
    output = []
    for set_spec, target_count in target_collection_counts.most_common():
        degree_counts: Counter[str] = Counter()
        collection_records = 0

        for source in source_records:
            if set_spec not in (source.get("setSpecs") or []):
                continue
            collection_records += 1
            raw = source.get("rawFields") or {}
            degree_names = raw.get("dc.degree.name") or []
            degree_key = (
                normalize_key(degree_names[0])
                if degree_names
                else "<missing>"
            )
            degree_counts[degree_key] += 1

        output.append(
            {
                "setSpec": set_spec,
                "targetWorks": target_count,
                "collectionRecords": collection_records,
                "distinctDegreeProgramKeys": len(degree_counts),
                "topDegreePrograms": [
                    {"normalizedKey": key, "count": count}
                    for key, count in degree_counts.most_common(12)
                ],
            }
        )

    return output


def cohort_metrics(records: list[dict[str, Any]]) -> dict[str, int]:
    metrics = Counter()
    for record in records:
        metrics["works"] += 1
        metrics["validYearObservations"] += int(record["year"] is not None)
        metrics["hasIssuedDate"] += int(record["hasIssuedDate"])
        metrics["hasAbstract"] += int(record["hasAbstract"])
        metrics["hasSubmittedDate"] += int(record["hasSubmittedDate"])
        metrics["exactTitleCrossProgramConflictWorks"] += int(
            record["hasExactTitleConflict"]
        )
        metrics["exactTitleAuthorCrossProgramConflictWorks"] += int(
            record["hasExactTitleAuthorConflict"]
        )
        if record["auditClass"] == "structural-conflict":
            metrics["structuralConflictWorks"] += 1
        elif record["auditClass"] == "cross-program-title-warning":
            metrics["warningOnlyWorks"] += 1
        else:
            metrics["noDetectedConflictWorks"] += 1

    keys = (
        "works",
        "validYearObservations",
        "hasIssuedDate",
        "hasAbstract",
        "hasSubmittedDate",
        "exactTitleCrossProgramConflictWorks",
        "exactTitleAuthorCrossProgramConflictWorks",
        "structuralConflictWorks",
        "warningOnlyWorks",
        "noDetectedConflictWorks",
    )
    return {key: int(metrics.get(key, 0)) for key in keys}


def build_audit(
    corpus: dict[str, Any],
    source_records: list[dict[str, Any]],
    *,
    target_program_key: str,
    legacy_accession_day: str | None = None,
) -> dict[str, Any]:
    target_key = normalize_key(target_program_key)
    source_by_id = {source["id"]: source for source in source_records}

    title_index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for work in corpus.get("works", []):
        key = normalize_key(work.get("title"))
        if key:
            title_index[key].append(work)

    target_works = [
        work
        for work in corpus.get("works", [])
        if normalize_key(work.get("programRaw")) == target_key
    ]

    units: Counter[str] = Counter()
    providers: Counter[str] = Counter()
    date_quality: Counter[str] = Counter()
    raw_degree_names: Counter[str] = Counter()
    degree_creators: Counter[str] = Counter()
    set_specs: Counter[str] = Counter()
    target_collection_counts: Counter[str] = Counter()
    accession_days: Counter[str] = Counter()
    conflict_program_keys: Counter[str] = Counter()
    years: list[int] = []

    source_agreement = 0
    source_disagreement = 0
    source_field_presence: Counter[str] = Counter()
    exact_title_conflicts = 0
    exact_title_author_conflicts = 0
    structural_conflicts = 0
    warning_only = 0
    no_detected_conflict = 0

    examples = {
        "structuralConflicts": [],
        "titleWarnings": [],
    }
    records: list[dict[str, Any]] = []

    for work in target_works:
        refs = work.get("sourceRecordRefs") or []
        source = source_by_id.get(refs[0]) if refs else None
        raw = (source or {}).get("rawFields") or {}

        units[str(work.get("academicUnitRaw") or "<missing>")] += 1
        providers[str((source or {}).get("provider") or "<missing>")] += 1

        quality = str((work.get("date") or {}).get("quality") or "unknown")
        date_quality[quality] += 1

        year = valid_year(work)
        if year is not None:
            years.append(year)

        degree_names = raw.get("dc.degree.name") or []
        creators = raw.get("dc.degree.creator") or []

        for value in degree_names:
            raw_degree_names[value] += 1
        for value in creators:
            degree_creators[value] += 1

        for field in (
            "dc.date.issued",
            "dc.description.abstract",
            "dc.date.submitted",
        ):
            if has_field(source, field):
                source_field_presence[field] += 1

        day = accession_day(source)
        accession_days[day or "<missing>"] += 1

        for set_spec in (source or {}).get("setSpecs") or []:
            set_specs[set_spec] += 1
            if set_spec.startswith("col_"):
                target_collection_counts[set_spec] += 1

        source_matches = bool(
            degree_names
            and any(normalize_key(value) == target_key for value in degree_names)
        )
        if source_matches:
            source_agreement += 1
        else:
            source_disagreement += 1

        title_key = normalize_key(work.get("title"))
        conflicting = [
            other
            for other in title_index.get(title_key, [])
            if other.get("id") != work.get("id")
            and normalize_key(other.get("programRaw")) != target_key
        ]
        has_title_conflict = bool(conflicting)
        if has_title_conflict:
            exact_title_conflicts += 1

        author_key = thesis_authors(work)
        same_author_conflicts = [
            other
            for other in conflicting
            if author_key
            and thesis_authors(other) == author_key
        ]
        has_author_conflict = bool(same_author_conflicts)
        if has_author_conflict:
            exact_title_author_conflicts += 1
            for other in same_author_conflicts:
                other_key = normalize_key(other.get("programRaw"))
                if other_key:
                    conflict_program_keys[other_key] += 1

        if has_author_conflict:
            audit_class = "structural-conflict"
            structural_conflicts += 1
        elif has_title_conflict:
            audit_class = "cross-program-title-warning"
            warning_only += 1
        else:
            audit_class = "no-detected-conflict"
            no_detected_conflict += 1

        handle = next(
            (
                identifier.get("normalizedValue")
                for identifier in work.get("persistentIdentifiers", [])
                if identifier.get("scheme") == "handle"
            ),
            None,
        )

        item = {
            "workId": work.get("id"),
            "handle": handle,
            "title": work.get("title"),
            "year": year,
            "dateQuality": quality,
            "academicUnitRaw": work.get("academicUnitRaw"),
            "programRaw": work.get("programRaw"),
            "sourceProgramMatchesTarget": source_matches,
            "accessionDay": day,
            "hasIssuedDate": has_field(source, "dc.date.issued"),
            "hasAbstract": has_field(source, "dc.description.abstract"),
            "hasSubmittedDate": has_field(source, "dc.date.submitted"),
            "hasExactTitleConflict": has_title_conflict,
            "hasExactTitleAuthorConflict": has_author_conflict,
            "auditClass": audit_class,
            "conflictingPrograms": sorted(
                {
                    normalize_key(other.get("programRaw"))
                    for other in same_author_conflicts
                    if normalize_key(other.get("programRaw"))
                }
            ),
        }
        records.append(item)

        if (
            has_author_conflict
            and len(examples["structuralConflicts"]) < 20
        ):
            examples["structuralConflicts"].append(item)
        elif (
            has_title_conflict
            and len(examples["titleWarnings"]) < 20
        ):
            examples["titleWarnings"].append(item)

    metrics = {
        "observedWorks": len(target_works),
        "providers": dict(providers),
        "observedUnits": dict(units),
        "dateQuality": dict(date_quality),
        "validYearSpan": {
            "min": min(years) if years else None,
            "max": max(years) if years else None,
            "observations": len(years),
        },
        "rawDegreeNameVariants": dict(raw_degree_names),
        "degreeCreatorVariants": dict(degree_creators),
        "sourceProgramAgreementWorks": source_agreement,
        "sourceProgramDisagreementWorks": source_disagreement,
        "sourceFieldPresence": dict(source_field_presence),
        "accessionDays": dict(accession_days.most_common()),
        "setSpecs": dict(set_specs),
        "exactTitleCrossProgramConflictWorks": exact_title_conflicts,
        "exactTitleAuthorCrossProgramConflictWorks": (
            exact_title_author_conflicts
        ),
        "structuralConflictWorks": structural_conflicts,
        "warningOnlyWorks": warning_only,
        "noDetectedConflictWorks": no_detected_conflict,
        "structuralConflictProgramKeys": dict(
            conflict_program_keys.most_common()
        ),
    }

    cohort = None
    if legacy_accession_day:
        legacy_records = [
            record
            for record in records
            if record.get("accessionDay") == legacy_accession_day
        ]
        other_records = [
            record
            for record in records
            if record.get("accessionDay") != legacy_accession_day
        ]
        legacy_metrics = cohort_metrics(legacy_records)
        other_metrics = cohort_metrics(other_records)
        cohort = {
            "legacyAccessionDay": legacy_accession_day,
            "legacy": legacy_metrics,
            "other": other_metrics,
            "concentration": {
                "allExactTitleConflictsInLegacy": (
                    other_metrics[
                        "exactTitleCrossProgramConflictWorks"
                    ] == 0
                ),
                "allStructuralConflictsInLegacy": (
                    other_metrics[
                        "exactTitleAuthorCrossProgramConflictWorks"
                    ] == 0
                ),
                "legacyHasNoIssuedDates": (
                    legacy_metrics["hasIssuedDate"] == 0
                ),
                "legacyHasNoAbstracts": (
                    legacy_metrics["hasAbstract"] == 0
                ),
            },
        }

    conflict_confirmed = bool(
        target_works
        and source_agreement == len(target_works)
        and structural_conflicts > 0
    )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "targetProgramKey": target_key,
        "decisionConstraint": DECISION_CONSTRAINT,
        "authorityDecision": "hold",
        "conclusion": (
            "source-program-metadata-conflict-confirmed"
            if conflict_confirmed
            else "metadata-integrity-review-required"
        ),
        "metrics": metrics,
        "cohortAnalysis": cohort,
        "collectionAnalysis": collection_analysis(
            source_records,
            target_collection_counts,
        ),
        "examples": examples,
        "records": records,
        "notes": [
            (
                "Exact title plus the same normalized thesis-author under "
                "different program labels is structural conflict evidence; "
                "it does not identify which label is correct."
            ),
            (
                "Exact title without the same author is a warning only."
            ),
            (
                "No title keyword, abstract topic or semantic similarity is "
                "used to decide integrity, scope or program identity."
            ),
            (
                "no-detected-conflict is not program confirmation."
            ),
            (
                "This audit never changes admission and never creates "
                "AcademicProgramAuthority."
            ),
        ],
    }


def markdown_summary(report: dict[str, Any]) -> str:
    metrics = report["metrics"]
    lines = [
        "# Program Metadata Integrity Audit V2",
        "",
        f"Target: `{report['targetProgramKey']}`",
        "",
        f"Decision constraint: `{report['decisionConstraint']}`",
        "",
        f"Conclusion: **{report['conclusion']}**",
        "",
        f"Program Authority: **{report['authorityDecision'].upper()}**",
        "",
        "## Metrics",
        "",
        f"- observed works: **{metrics['observedWorks']}**",
        (
            "- source dc.degree.name agrees with target: "
            f"**{metrics['sourceProgramAgreementWorks']}/"
            f"{metrics['observedWorks']}**"
        ),
        (
            "- exact-title cross-program conflicts: "
            f"**{metrics['exactTitleCrossProgramConflictWorks']}**"
        ),
        (
            "- exact-title + same-author structural conflicts: "
            f"**{metrics['exactTitleAuthorCrossProgramConflictWorks']}**"
        ),
        f"- warning-only works: **{metrics['warningOnlyWorks']}**",
        (
            "- no detected conflict: "
            f"**{metrics['noDetectedConflictWorks']}**"
        ),
        "",
        (
            "`no-detected-conflict` does not mean that the program label "
            "has been independently confirmed."
        ),
        "",
        "## Accession days",
        "",
    ]

    for day, count in metrics["accessionDays"].items():
        lines.append(f"- {day}: {count}")

    if report.get("cohortAnalysis"):
        cohort = report["cohortAnalysis"]
        lines.extend(
            [
                "",
                "## Legacy cohort",
                "",
                (
                    f"Legacy day: `{cohort['legacyAccessionDay']}`"
                ),
                (
                    "- legacy works: "
                    f"**{cohort['legacy']['works']}**"
                ),
                (
                    "- structural conflicts in legacy: "
                    f"**{cohort['legacy']['structuralConflictWorks']}**"
                ),
                (
                    "- other works: "
                    f"**{cohort['other']['works']}**"
                ),
                (
                    "- structural conflicts outside legacy: "
                    f"**{cohort['other']['structuralConflictWorks']}**"
                ),
            ]
        )

    lines.extend(
        [
            "",
            "## Governance",
            "",
            (
                "This audit confirms only that conflicting program metadata "
                "exists in the source. It does not determine which program "
                "label is correct and does not authorize blanket low-trust "
                "classification for the whole cohort."
            ),
            "",
        ]
    )
    return "\n".join(lines)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--canonical-corpus", type=Path, required=True)
    parser.add_argument("--source-records", type=Path, required=True)
    parser.add_argument("--program-key", required=True)
    parser.add_argument("--legacy-accession-day")
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    report = build_audit(
        read_json(args.canonical_corpus),
        read_jsonl(args.source_records),
        target_program_key=args.program_key,
        legacy_accession_day=args.legacy_accession_day,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_json(
        args.output_dir / "program-metadata-integrity-audit.json",
        report,
    )
    (
        args.output_dir / "program-metadata-integrity-audit.md"
    ).write_text(markdown_summary(report), encoding="utf-8")

    print(
        json.dumps(
            {
                "conclusion": report["conclusion"],
                "authorityDecision": report["authorityDecision"],
                "metrics": report["metrics"],
                "cohortAnalysis": report["cohortAnalysis"],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()

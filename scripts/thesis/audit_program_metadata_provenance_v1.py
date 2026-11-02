#!/usr/bin/env python3
"""Partition Psychology metadata into provenance cohorts after T2AG.

This layer is deliberately non-admissive. It identifies source-provenance
cohorts so a future authority/gate can avoid treating contaminated legacy
metadata as equivalent to richer later records.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

import audit_program_metadata_contamination_v1 as contamination


SCHEMA_VERSION = "thesis-program-metadata-provenance-cohort-v1"
DECISION_CONSTRAINT = "provenance-does-not-change-admission"


def accession_day(source: dict[str, Any] | None) -> str | None:
    if not source:
        return None
    raw = source.get("rawFields") or {}
    values = raw.get("dc.date.accessioned") or []
    if not values:
        return None
    value = contamination.clean_text(values[0])
    return value[:10] if value and len(value) >= 10 else value


def has_field(source: dict[str, Any] | None, field: str) -> bool:
    if not source:
        return False
    return bool((source.get("rawFields") or {}).get(field))


def build_provenance_report(
    corpus: dict[str, Any],
    source_records: list[dict[str, Any]],
    *,
    target_program_key: str,
    foundation_year: int,
    legacy_accession_day: str,
) -> dict[str, Any]:
    base = contamination.build_audit(
        corpus,
        source_records,
        target_program_key=target_program_key,
        foundation_year=foundation_year,
    )

    target_key = contamination.normalize_key(target_program_key)
    source_by_id = {source["id"]: source for source in source_records}
    base_record_by_work = {
        record["workId"]: record for record in base.get("records", [])
    }

    cohorts = {
        "legacy-migration-review": {
            "definition": {
                "accessionDayEquals": legacy_accession_day,
            },
            "provenanceState": "low-trust-review",
            "metrics": Counter(),
            "accessionDays": Counter(),
        },
        "post-migration-review": {
            "definition": {
                "accessionDayNotEquals": legacy_accession_day,
            },
            "provenanceState": "higher-context-review",
            "metrics": Counter(),
            "accessionDays": Counter(),
        },
    }

    records: list[dict[str, Any]] = []

    for work in corpus.get("works", []):
        if contamination.normalize_key(work.get("programRaw")) != target_key:
            continue

        refs = work.get("sourceRecordRefs") or []
        source = source_by_id.get(refs[0]) if refs else None
        day = accession_day(source)
        cohort_id = (
            "legacy-migration-review"
            if day == legacy_accession_day
            else "post-migration-review"
        )
        cohort = cohorts[cohort_id]
        metrics: Counter[str] = cohort["metrics"]

        base_record = base_record_by_work.get(work.get("id")) or {}
        flags = list(base_record.get("flags") or [])
        audit_class = base_record.get("auditClass")

        metrics["works"] += 1
        if has_field(source, "dc.date.issued"):
            metrics["hasIssuedDate"] += 1
        if has_field(source, "dc.description.abstract"):
            metrics["hasAbstract"] += 1
        if has_field(source, "dc.date.submitted"):
            metrics["hasSubmittedDate"] += 1

        year = contamination.valid_year(work)
        if year is not None:
            metrics["validYearObservations"] += 1
        if "pre-program-foundation" in flags:
            metrics["preProgramFoundationWorks"] += 1
        if "exact-title-cross-program-conflict" in flags:
            metrics["exactTitleCrossProgramConflictWorks"] += 1
        if "exact-title-author-cross-program-conflict" in flags:
            metrics["exactTitleAuthorCrossProgramConflictWorks"] += 1
        if any(flag.startswith("title-domain-warning:") for flag in flags):
            metrics["titleDomainWarningWorks"] += 1

        if audit_class == "high-confidence-anomaly":
            metrics["highConfidenceAnomalyWorks"] += 1
        elif audit_class == "warning-only":
            metrics["warningOnlyWorks"] += 1
        elif audit_class == "no-detected-contradiction":
            metrics["noDetectedContradictionWorks"] += 1

        cohort["accessionDays"][day or "<missing>"] += 1

        records.append(
            {
                "workId": work.get("id"),
                "handle": base_record.get("handle"),
                "title": work.get("title"),
                "programRaw": work.get("programRaw"),
                "academicUnitRaw": work.get("academicUnitRaw"),
                "accessionDay": day,
                "cohort": cohort_id,
                "provenanceState": cohort["provenanceState"],
                "auditClass": audit_class,
                "flags": flags,
                "hasIssuedDate": has_field(source, "dc.date.issued"),
                "hasAbstract": has_field(source, "dc.description.abstract"),
                "hasSubmittedDate": has_field(source, "dc.date.submitted"),
            }
        )

    metric_keys = (
        "works",
        "hasIssuedDate",
        "hasAbstract",
        "hasSubmittedDate",
        "validYearObservations",
        "preProgramFoundationWorks",
        "exactTitleCrossProgramConflictWorks",
        "exactTitleAuthorCrossProgramConflictWorks",
        "titleDomainWarningWorks",
        "highConfidenceAnomalyWorks",
        "warningOnlyWorks",
        "noDetectedContradictionWorks",
    )

    normalized_cohorts: dict[str, Any] = {}
    for cohort_id, cohort in cohorts.items():
        normalized_cohorts[cohort_id] = {
            "definition": cohort["definition"],
            "provenanceState": cohort["provenanceState"],
            "metrics": {
                key: int(cohort["metrics"].get(key, 0))
                for key in metric_keys
            },
            "accessionDays": dict(cohort["accessionDays"].most_common()),
        }

    legacy = normalized_cohorts["legacy-migration-review"]["metrics"]
    later = normalized_cohorts["post-migration-review"]["metrics"]

    concentration = {
        "allPreFoundationInLegacy": (
            later.get("preProgramFoundationWorks", 0) == 0
        ),
        "allExactTitleConflictsInLegacy": (
            later.get("exactTitleCrossProgramConflictWorks", 0) == 0
        ),
        "allExactTitleAuthorConflictsInLegacy": (
            later.get("exactTitleAuthorCrossProgramConflictWorks", 0) == 0
        ),
        "allTitleDomainWarningsInLegacy": (
            later.get("titleDomainWarningWorks", 0) == 0
        ),
        "legacyHasNoIssuedDates": legacy.get("hasIssuedDate", 0) == 0,
        "legacyHasNoAbstracts": legacy.get("hasAbstract", 0) == 0,
    }

    return {
        "schemaVersion": SCHEMA_VERSION,
        "targetProgramKey": target_key,
        "foundationYear": foundation_year,
        "legacyAccessionDay": legacy_accession_day,
        "decisionConstraint": DECISION_CONSTRAINT,
        "authorityDecision": "hold",
        "gateRecommendation": (
            "do-not-apply-program-authority-unconditionally"
        ),
        "cohorts": normalized_cohorts,
        "anomalyConcentration": concentration,
        "records": records,
        "notes": [
            (
                "low-trust-review does not assign another program; it only "
                "marks a provenance cohort whose source program metadata "
                "cannot safely drive unconditional authority application."
            ),
            (
                "higher-context-review is not trusted/confirmed Psychology; "
                "it only has richer source context than the legacy batch."
            ),
            (
                "This report never changes admission and never creates "
                "AcademicProgramAuthority."
            ),
        ],
    }


def markdown_summary(report: dict[str, Any]) -> str:
    legacy = report["cohorts"]["legacy-migration-review"]["metrics"]
    later = report["cohorts"]["post-migration-review"]["metrics"]
    lines = [
        "# Psychology Program Metadata Provenance Cohort V1",
        "",
        f"Target: `{report['targetProgramKey']}`",
        "",
        f"Decision constraint: `{report['decisionConstraint']}`",
        "",
        f"Authority decision: **{report['authorityDecision'].upper()}**",
        "",
        "## Cohorts",
        "",
        (
            f"- legacy migration day `{report['legacyAccessionDay']}`: "
            f"**{legacy.get('works', 0)}** works"
        ),
        (
            "- post-migration cohort: "
            f"**{later.get('works', 0)}** works"
        ),
        "",
        "### Legacy migration cohort",
        "",
        f"- issued dates: **{legacy.get('hasIssuedDate', 0)}**",
        f"- abstracts: **{legacy.get('hasAbstract', 0)}**",
        f"- submitted dates: **{legacy.get('hasSubmittedDate', 0)}**",
        (
            "- pre-foundation: "
            f"**{legacy.get('preProgramFoundationWorks', 0)}**"
        ),
        (
            "- exact-title conflicts: "
            f"**{legacy.get('exactTitleCrossProgramConflictWorks', 0)}**"
        ),
        (
            "- title + author conflicts: "
            f"**{legacy.get('exactTitleAuthorCrossProgramConflictWorks', 0)}**"
        ),
        (
            "- title-domain warnings: "
            f"**{legacy.get('titleDomainWarningWorks', 0)}**"
        ),
        (
            "- high-confidence anomalies: "
            f"**{legacy.get('highConfidenceAnomalyWorks', 0)}**"
        ),
        "",
        "### Post-migration cohort",
        "",
        f"- issued dates: **{later.get('hasIssuedDate', 0)}**",
        f"- abstracts: **{later.get('hasAbstract', 0)}**",
        f"- submitted dates: **{later.get('hasSubmittedDate', 0)}**",
        (
            "- pre-foundation: "
            f"**{later.get('preProgramFoundationWorks', 0)}**"
        ),
        (
            "- exact-title conflicts: "
            f"**{later.get('exactTitleCrossProgramConflictWorks', 0)}**"
        ),
        (
            "- title + author conflicts: "
            f"**{later.get('exactTitleAuthorCrossProgramConflictWorks', 0)}**"
        ),
        (
            "- title-domain warnings: "
            f"**{later.get('titleDomainWarningWorks', 0)}**"
        ),
        "",
        "## Interpretation",
        "",
        (
            "All currently known structural contradictions are concentrated "
            "in the legacy migration cohort. This does not prove that the "
            "post-migration cohort is correct; it only gives it richer and "
            "less contradictory provenance."
        ),
        "",
        (
            "A future Program Authority must not be applied unconditionally "
            "to all 485 records until the admission pipeline can distinguish "
            "program-metadata confidence."
        ),
        "",
    ]
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
    parser.add_argument(
        "--program-key",
        default="licenciatura en psicologia",
    )
    parser.add_argument("--foundation-year", type=int, default=1975)
    parser.add_argument(
        "--legacy-accession-day",
        default="2015-09-09",
    )
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    report = build_provenance_report(
        contamination.read_json(args.canonical_corpus),
        contamination.read_jsonl(args.source_records),
        target_program_key=args.program_key,
        foundation_year=args.foundation_year,
        legacy_accession_day=args.legacy_accession_day,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_json(
        args.output_dir / "program-metadata-provenance-cohort.json",
        report,
    )
    (
        args.output_dir / "program-metadata-provenance-cohort.md"
    ).write_text(markdown_summary(report), encoding="utf-8")

    print(
        json.dumps(
            {
                "cohorts": report["cohorts"],
                "anomalyConcentration": report["anomalyConcentration"],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()

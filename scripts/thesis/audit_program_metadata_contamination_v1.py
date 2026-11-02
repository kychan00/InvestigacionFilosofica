#!/usr/bin/env python3
"""Audit program-metadata contamination before creating Psychology authority.

This audit is deliberately non-admissive:
- it never creates or changes AcademicProgramAuthority;
- title/topic signals are anomaly evidence only;
- source-side degree metadata is preserved;
- "no detected contradiction" never means "confirmed Psychology".
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
from typing import Any, Iterable


SCHEMA_VERSION = "thesis-program-metadata-contamination-audit-v1"
DECISION_CONSTRAINT = "audit-does-not-change-admission"

TITLE_WARNING_PATTERNS: dict[str, tuple[str, ...]] = {
    "dental-procedural": (
        r"\bodontolog",
        r"\bcaries dental\b",
        r"\bpulpotom",
        r"\bpulpectom",
        r"\bprotesis fija\b",
        r"\bresinas? fotocur",
        r"\bamalgama\b",
        r"\bmaxilar(?:es)?\b",
        r"\bcefalo",
        r"\bcirugia maxilofacial\b",
        r"\bcoronas? de acero\b",
        r"\blabio leporino\b",
    ),
    "medical-procedural": (
        r"\bcarcinoma\b",
        r"\bcancer cervico",
        r"\bcuello uterino\b",
        r"\bautopsia\b",
        r"\bbiopsia\b",
        r"\burolog",
        r"\bmeningitis\b",
        r"\bneumonia",
        r"\bhernia hiatal\b",
        r"\binfarto\b",
        r"\bgastritis\b",
        r"\bembarazo ectopico\b",
        r"\bdiabetes gestacional\b",
        r"\bcardiotocograf",
        r"\btransfusion\b",
        r"\bhematolog",
        r"\binsuficiencia renal\b",
        r"\btraumatismos? vasculares\b",
    ),
    "other-professional-field": (
        r"\bganado caprino\b",
        r"\bzootec",
        r"\bmedicina veterinaria\b",
        r"\bcarrera de enfermeria\b",
    ),
}


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


def title_warning_categories(title: Any) -> list[str]:
    normalized = normalize_key(title)
    output: list[str] = []
    for category, patterns in TITLE_WARNING_PATTERNS.items():
        if any(re.search(pattern, normalized) for pattern in patterns):
            output.append(category)
    return output


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


def build_audit(
    corpus: dict[str, Any],
    source_records: list[dict[str, Any]],
    *,
    target_program_key: str,
    foundation_year: int,
) -> dict[str, Any]:
    target_key = normalize_key(target_program_key)
    source_by_id = {source["id"]: source for source in source_records}

    title_index: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for work in corpus.get("works", []):
        title_index[normalize_key(work.get("title"))].append(work)

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
    years: list[int] = []

    source_agreement = 0
    source_disagreement = 0
    pre_foundation = 0
    exact_title_conflicts = 0
    exact_title_author_conflicts = 0
    title_domain_warnings = 0
    high_confidence_anomalies = 0
    warning_only = 0
    no_detected_contradiction = 0

    examples: dict[str, list[dict[str, Any]]] = {
        "preFoundation": [],
        "exactTitleAuthorConflicts": [],
        "titleDomainWarnings": [],
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

        is_pre_foundation = (
            year is not None and year < foundation_year
        )
        if is_pre_foundation:
            pre_foundation += 1

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

        warning_categories = title_warning_categories(work.get("title"))
        if warning_categories:
            title_domain_warnings += 1

        high_confidence = is_pre_foundation or has_author_conflict
        warning = (
            (has_title_conflict or bool(warning_categories))
            and not high_confidence
        )

        if high_confidence:
            audit_class = "high-confidence-anomaly"
            high_confidence_anomalies += 1
        elif warning:
            audit_class = "warning-only"
            warning_only += 1
        else:
            audit_class = "no-detected-contradiction"
            no_detected_contradiction += 1

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
            "flags": [],
            "auditClass": audit_class,
        }

        if is_pre_foundation:
            item["flags"].append("pre-program-foundation")
        if has_title_conflict:
            item["flags"].append("exact-title-cross-program-conflict")
        if has_author_conflict:
            item["flags"].append(
                "exact-title-author-cross-program-conflict"
            )
        for category in warning_categories:
            item["flags"].append(f"title-domain-warning:{category}")

        records.append(item)

        if (
            is_pre_foundation
            and len(examples["preFoundation"]) < 12
        ):
            examples["preFoundation"].append(item)

        if (
            has_author_conflict
            and len(examples["exactTitleAuthorConflicts"]) < 12
        ):
            example = dict(item)
            example["conflictingPrograms"] = sorted(
                {
                    other.get("programRaw")
                    for other in same_author_conflicts
                    if other.get("programRaw")
                }
            )
            examples["exactTitleAuthorConflicts"].append(example)

        if (
            warning_categories
            and len(examples["titleDomainWarnings"]) < 20
        ):
            examples["titleDomainWarnings"].append(item)

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
        "preProgramFoundationWorks": pre_foundation,
        "rawDegreeNameVariants": dict(raw_degree_names),
        "degreeCreatorVariants": dict(degree_creators),
        "sourceProgramAgreementWorks": source_agreement,
        "sourceProgramDisagreementWorks": source_disagreement,
        "setSpecs": dict(set_specs),
        "exactTitleCrossProgramConflictWorks": exact_title_conflicts,
        "exactTitleAuthorCrossProgramConflictWorks": (
            exact_title_author_conflicts
        ),
        "titleDomainWarningWorks": title_domain_warnings,
        "highConfidenceAnomalyWorks": high_confidence_anomalies,
        "warningOnlyWorks": warning_only,
        "noDetectedContradictionWorks": no_detected_contradiction,
    }

    source_contamination_confirmed = bool(
        target_works
        and pre_foundation
        and source_agreement == len(target_works)
    )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "targetProgramKey": target_key,
        "foundationYear": foundation_year,
        "decisionConstraint": DECISION_CONSTRAINT,
        "authorityDecision": "hold",
        "conclusion": (
            "source-metadata-contamination-confirmed"
            if source_contamination_confirmed
            else "metadata-integrity-review-required"
        ),
        "metrics": metrics,
        "collectionAnalysis": collection_analysis(
            source_records,
            target_collection_counts,
        ),
        "examples": examples,
        "records": records,
        "notes": [
            (
                "Title signals are anomaly evidence only and never determine "
                "Humanities admission."
            ),
            (
                "no-detected-contradiction does not mean confirmed Psychology; "
                "it only means this audit did not detect one of its narrow "
                "structural contradictions."
            ),
            (
                "Program Authority must remain uncreated until contaminated "
                "source metadata is separated from trustworthy program evidence."
            ),
        ],
    }


def markdown_summary(audit: dict[str, Any]) -> str:
    metrics = audit["metrics"]
    lines = [
        "# CUCS / Psychology Program Metadata Contamination Audit V1",
        "",
        f"Target: `{audit['targetProgramKey']}`",
        "",
        f"Decision constraint: `{audit['decisionConstraint']}`",
        "",
        f"Conclusion: **{audit['conclusion']}**",
        "",
        f"Program Authority: **{audit['authorityDecision'].upper()}**",
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
            "- valid year span: "
            f"**{metrics['validYearSpan']['min']}–"
            f"{metrics['validYearSpan']['max']}**"
        ),
        (
            f"- pre-foundation works (< {audit['foundationYear']}): "
            f"**{metrics['preProgramFoundationWorks']}**"
        ),
        (
            "- exact-title conflicts with another program: "
            f"**{metrics['exactTitleCrossProgramConflictWorks']}**"
        ),
        (
            "- exact-title + same-author conflicts: "
            f"**{metrics['exactTitleAuthorCrossProgramConflictWorks']}**"
        ),
        (
            "- narrow title-domain warnings: "
            f"**{metrics['titleDomainWarningWorks']}**"
        ),
        (
            "- high-confidence anomaly works: "
            f"**{metrics['highConfidenceAnomalyWorks']}**"
        ),
        f"- warning-only works: **{metrics['warningOnlyWorks']}**",
        (
            "- no detected contradiction: "
            f"**{metrics['noDetectedContradictionWorks']}**"
        ),
        "",
        (
            "`no-detected-contradiction` is **not** confirmation that a "
            "work belongs to Psychology."
        ),
        "",
        "## Units",
        "",
    ]

    for unit, count in sorted(
        metrics["observedUnits"].items(),
        key=lambda pair: (-pair[1], pair[0]),
    ):
        lines.append(f"- {unit}: {count}")

    lines.extend(["", "## Collection context", ""])
    for collection in audit["collectionAnalysis"]:
        lines.append(
            f"- `{collection['setSpec']}`: "
            f"{collection['targetWorks']} target works / "
            f"{collection['collectionRecords']} collection records / "
            f"{collection['distinctDegreeProgramKeys']} degree-program keys"
        )

    lines.extend(
        [
            "",
            "## Why this is a metadata-integrity problem",
            "",
            (
                "The canonical program value is not being invented by the local "
                "parser: the source-side `dc.degree.name` already contains the "
                "Psychology label for the target records. Temporal impossibilities "
                "and cross-program duplicate conflicts therefore require a "
                "source-metadata audit before any disciplinary authority is created."
            ),
            "",
            "## Governance",
            "",
            "- Do not create `program:udg:lic-psicologia` in this phase.",
            "- Do not change Admission Gate.",
            "- Do not use title/keywords to admit or exclude a thesis.",
            "- Preserve Scope/closure contracts.",
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
    parser.add_argument(
        "--program-key",
        default="licenciatura en psicologia",
    )
    parser.add_argument("--foundation-year", type=int, default=1975)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    audit = build_audit(
        read_json(args.canonical_corpus),
        read_jsonl(args.source_records),
        target_program_key=args.program_key,
        foundation_year=args.foundation_year,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_json(
        args.output_dir / "program-metadata-contamination-audit.json",
        audit,
    )
    (
        args.output_dir / "program-metadata-contamination-audit.md"
    ).write_text(
        markdown_summary(audit),
        encoding="utf-8",
    )

    print(
        json.dumps(
            audit["metrics"],
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()

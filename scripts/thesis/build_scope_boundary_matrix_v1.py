#!/usr/bin/env python3
"""Build a non-admission humanities scope boundary matrix report.

The matrix is governance evidence only. It must never mutate or infer
AcademicProgramAuthority admission decisions.
"""

from __future__ import annotations

import argparse
import gzip
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import build_canonical_corpus_v1 as canonical


SCHEMA_VERSION = "thesis-humanities-scope-boundary-report-v1"
DEFAULT_CONFIG = (
    Path(__file__).resolve().parent
    / "config"
    / "scope-boundary-matrix-v1.json"
)


def read_json(path: Path) -> Any:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            return json.load(handle)
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def validate_config(config: dict[str, Any]) -> bool:
    if config.get("schemaVersion") != "thesis-humanities-scope-boundary-matrix-v1":
        raise ValueError("Unsupported scope boundary matrix schema")

    if config.get("decisionConstraint") != "scope-matrix-does-not-change-admission":
        raise ValueError("Scope matrix must not change admission")

    allowed_states = set((config.get("states") or {}).keys())
    required_states = {
        "core-humanities",
        "boundary-review",
        "outside-scope",
        "unresolved-evidence",
    }
    if allowed_states != required_states:
        raise ValueError("Scope matrix states do not match the V1 contract")

    row_ids: set[str] = set()
    program_keys: set[str] = set()

    for row in config.get("rows") or []:
        row_id = row.get("id")
        if not row_id:
            raise ValueError("Scope matrix row without id")
        if row_id in row_ids:
            raise ValueError(f"Duplicate scope row id: {row_id}")
        row_ids.add(row_id)

        state = row.get("boundaryState")
        if state not in allowed_states:
            raise ValueError(
                f"Unsupported boundaryState for {row_id}: {state}"
            )

        if not row.get("label"):
            raise ValueError(f"Scope row without label: {row_id}")
        if not row.get("rationale"):
            raise ValueError(f"Scope row without rationale: {row_id}")
        if not row.get("evidence"):
            raise ValueError(f"Scope row without evidence: {row_id}")
        if not row.get("nextQuestion"):
            raise ValueError(f"Scope row without nextQuestion: {row_id}")

        keys = row.get("programKeys") or []
        if not keys:
            raise ValueError(f"Scope row without programKeys: {row_id}")

        for raw_key in keys:
            key = canonical.normalize_key(raw_key)
            if key != raw_key:
                raise ValueError(
                    f"programKey must already be normalized: {raw_key}"
                )
            if key in program_keys:
                raise ValueError(f"Duplicate programKey across rows: {key}")
            program_keys.add(key)

    return True


def dimensions_by_program(
    corpus: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    output: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "works": 0,
            "units": Counter(),
            "years": [],
            "admissionStatuses": Counter(),
            "institutionRefs": Counter(),
        }
    )

    for work in corpus.get("works") or []:
        key = canonical.normalize_key(work.get("programRaw"))
        if not key:
            continue

        row = output[key]
        row["works"] += 1

        unit = work.get("academicUnitRaw")
        if unit:
            row["units"][unit] += 1

        date = work.get("date") or {}
        value = date.get("value")
        quality = date.get("quality")
        if quality == "valid" and value:
            try:
                year = int(str(value)[:4])
            except (TypeError, ValueError):
                year = None
            if year is not None:
                row["years"].append(year)

        row["admissionStatuses"][work.get("admissionStatus") or "unknown"] += 1
        row["institutionRefs"][work.get("institutionRef") or "unresolved"] += 1

    return output


def build_report(
    observed: dict[str, Any],
    corpus: dict[str, Any],
    registry: dict[str, Any],
    config: dict[str, Any],
) -> dict[str, Any]:
    validate_config(config)

    observed_map = {
        item.get("normalizedKey"): item
        for item in (observed.get("programs") or [])
        if item.get("normalizedKey")
    }
    dimensions = dimensions_by_program(corpus)

    rows = []
    row_states = Counter()
    work_states = Counter()
    observed_program_groups = 0
    observed_works = 0
    unobserved_keys = []

    for config_row in config.get("rows") or []:
        programs = []
        row_works = 0
        row_groups = 0

        for key in config_row.get("programKeys") or []:
            observed_row = observed_map.get(key)
            dims = dimensions.get(key) or {
                "works": 0,
                "units": Counter(),
                "years": [],
                "admissionStatuses": Counter(),
                "institutionRefs": Counter(),
            }

            count = int(
                (observed_row or {}).get("count")
                or dims.get("works")
                or 0
            )
            if count:
                row_groups += 1
                row_works += count
            else:
                unobserved_keys.append(key)

            years = sorted(dims.get("years") or [])
            program = canonical.resolve_program(key, registry)

            programs.append(
                {
                    "normalizedKey": key,
                    "observedCount": count,
                    "variants": dict(
                        sorted(
                            ((observed_row or {}).get("variants") or {}).items(),
                            key=lambda item: (-item[1], item[0]),
                        )
                    ),
                    "providers": dict(
                        sorted(
                            ((observed_row or {}).get("providers") or {}).items()
                        )
                    ),
                    "units": dict(
                        sorted(
                            (dims.get("units") or {}).items(),
                            key=lambda item: (-item[1], item[0]),
                        )
                    ),
                    "validYearSpan": {
                        "min": years[0] if years else None,
                        "max": years[-1] if years else None,
                        "validObservations": len(years),
                    },
                    "currentAdmissionStatuses": dict(
                        sorted(
                            (dims.get("admissionStatuses") or {}).items()
                        )
                    ),
                    "institutionRefs": dict(
                        sorted(
                            (dims.get("institutionRefs") or {}).items()
                        )
                    ),
                    "programAuthority": (
                        {
                            "status": program.get("status"),
                            "programRef": program.get("programRef"),
                            "admissionState": program.get("admissionState"),
                        }
                        if program.get("status") == "confirmed"
                        else {
                            "status": program.get("status"),
                            "programRef": None,
                            "admissionState": None,
                        }
                    ),
                }
            )

        state = config_row["boundaryState"]
        row_states[state] += 1
        work_states[state] += row_works
        observed_program_groups += row_groups
        observed_works += row_works

        rows.append(
            {
                "id": config_row["id"],
                "label": config_row["label"],
                "boundaryState": state,
                "decisionConstraint": config["decisionConstraint"],
                "observedProgramGroups": row_groups,
                "observedWorks": row_works,
                "programs": programs,
                "rationale": config_row["rationale"],
                "evidence": config_row["evidence"],
                "nextQuestion": config_row["nextQuestion"],
            }
        )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "policyRevision": config.get("policyRevision"),
        "programAuthorityRevision": registry.get(
            "registryRevision",
            registry.get("schemaVersion"),
        ),
        "institutionAuthorityRevision": registry.get(
            "institutionRevision",
            "institution-authority-v1",
        ),
        "targetScope": config.get("targetScope"),
        "decisionConstraint": config.get("decisionConstraint"),
        "policyPrinciples": config.get("policyPrinciples") or [],
        "precedence": config.get("precedence") or [],
        "organizationalGuidance": config.get("organizationalGuidance") or [],
        "metrics": {
            "matrixRows": len(rows),
            "rowsByBoundaryState": dict(sorted(row_states.items())),
            "observedProgramGroups": observed_program_groups,
            "observedWorks": observed_works,
            "worksByBoundaryState": dict(sorted(work_states.items())),
            "unobservedProgramKeys": sorted(set(unobserved_keys)),
        },
        "rows": rows,
    }


def markdown_summary(report: dict[str, Any]) -> str:
    metrics = report["metrics"]
    lines = [
        "# Thesis Humanities Scope Boundary Matrix V1",
        "",
        "**Esta matriz no cambia admisión.**",
        "",
        f"- policy revision: `{report['policyRevision']}`",
        f"- program authority: `{report['programAuthorityRevision']}`",
        f"- institution authority: `{report['institutionAuthorityRevision']}`",
        f"- filas: {metrics['matrixRows']}",
        f"- grupos observados: {metrics['observedProgramGroups']}",
        f"- tesis representadas: {metrics['observedWorks']}",
        "",
        "## Matriz",
        "",
        "| Frontera | Estado | Grupos | Tesis | Programas |",
        "|---|---|---:|---:|---|",
    ]

    for row in report["rows"]:
        labels = []
        for program in row["programs"]:
            count = program["observedCount"]
            labels.append(
                f"{program['normalizedKey']} ({count})"
            )
        lines.append(
            "| {label} | {state} | {groups} | {works} | {programs} |".format(
                label=row["label"].replace("|", "\\|"),
                state=row["boundaryState"],
                groups=row["observedProgramGroups"],
                works=row["observedWorks"],
                programs="<br>".join(labels).replace("|", "\\|"),
            )
        )

    lines.extend(
        [
            "",
            "## Regla de precedencia",
            "",
        ]
    )
    for index, item in enumerate(report["precedence"], start=1):
        lines.append(f"{index}. {item}")

    lines.extend(
        [
            "",
            "## Restricción",
            "",
            "La matriz sólo organiza decisiones de alcance. "
            "AcademicProgramAuthority sigue siendo la única autoridad que "
            "puede cambiar INCLUDE/REVIEW/EXCLUDE.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--observed-authorities", required=True)
    parser.add_argument("--canonical-corpus", required=True)
    parser.add_argument(
        "--registry",
        default=str(canonical.DEFAULT_REGISTRY),
    )
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG),
    )
    parser.add_argument(
        "--output-dir",
        default="artifacts/thesis-scope-boundary",
    )
    args = parser.parse_args()

    observed = read_json(Path(args.observed_authorities))
    corpus = read_json(Path(args.canonical_corpus))
    registry = canonical.load_program_registry(args.registry)
    config = read_json(Path(args.config))

    report = build_report(
        observed,
        corpus,
        registry,
        config,
    )

    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / "scope-boundary-matrix.json", report)
    (output / "scope-boundary-matrix.md").write_text(
        markdown_summary(report),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "schemaVersion": report["schemaVersion"],
                "policyRevision": report["policyRevision"],
                "programAuthorityRevision": report[
                    "programAuthorityRevision"
                ],
                "institutionAuthorityRevision": report[
                    "institutionAuthorityRevision"
                ],
                "metrics": report["metrics"],
                "rows": [
                    {
                        "id": row["id"],
                        "boundaryState": row["boundaryState"],
                        "observedProgramGroups": row[
                            "observedProgramGroups"
                        ],
                        "observedWorks": row["observedWorks"],
                    }
                    for row in report["rows"]
                ],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

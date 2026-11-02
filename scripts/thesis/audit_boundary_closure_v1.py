#!/usr/bin/env python3
"""Audit closure invariants for humanities boundary-review programs.

This audit never changes admission. It verifies that the curated
boundary-review surface remains explicitly governed by AcademicProgramAuthority.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

import build_canonical_corpus_v1 as canonical
import build_scope_boundary_matrix_v1 as scope_boundary


SCHEMA_VERSION = "thesis-humanities-boundary-closure-audit-v1"
DEFAULT_SCOPE_CONFIG = scope_boundary.DEFAULT_CONFIG
DEFAULT_CONTRACT = (
    Path(__file__).resolve().parent
    / "config"
    / "boundary-closure-contract-v1.json"
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def validate_contract(contract: dict[str, Any]) -> bool:
    if contract.get("schemaVersion") != (
        "thesis-humanities-boundary-closure-contract-v1"
    ):
        raise ValueError("Unsupported boundary closure contract schema")
    if contract.get("boundaryState") != "boundary-review":
        raise ValueError("Boundary closure V1 must target boundary-review")
    if contract.get("decisionConstraint") != (
        "scope-matrix-does-not-change-admission"
    ):
        raise ValueError("Closure audit must preserve the scope admission constraint")
    if contract.get("targetScope") != "humanities-only":
        raise ValueError("Boundary closure V1 must target humanities-only")
    for key in (
        "expectedBoundaryRows",
        "expectedProgramKeys",
        "expectedAuthorityObservedWorks",
    ):
        value = contract.get(key)
        if not isinstance(value, int) or value < 0:
            raise ValueError(f"Invalid closure contract integer: {key}")
    states = contract.get("expectedAdmissionStates")
    if not isinstance(states, dict) or not states:
        raise ValueError("Closure contract requires expectedAdmissionStates")
    if any(not isinstance(v, int) or v < 0 for v in states.values()):
        raise ValueError("Invalid expectedAdmissionStates")
    return True


def registry_by_id(registry: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        item["id"]: item
        for item in registry.get("programs") or []
        if item.get("id")
    }


def scope_report_programs(
    report: dict[str, Any],
) -> dict[str, tuple[dict[str, Any], dict[str, Any]]]:
    output = {}
    for row in report.get("rows") or []:
        for program in row.get("programs") or []:
            key = program.get("normalizedKey")
            if key:
                output[key] = (row, program)
    return output


def add_violation(
    violations: list[dict[str, Any]],
    code: str,
    *,
    key: str | None = None,
    row_id: str | None = None,
    detail: str,
) -> None:
    item = {"code": code, "detail": detail}
    if key is not None:
        item["normalizedKey"] = key
    if row_id is not None:
        item["rowId"] = row_id
    violations.append(item)


def build_audit(
    report: dict[str, Any],
    registry: dict[str, Any],
    scope_config: dict[str, Any],
    contract: dict[str, Any],
) -> dict[str, Any]:
    scope_boundary.validate_config(scope_config)
    validate_contract(contract)

    violations: list[dict[str, Any]] = []

    if scope_config.get("decisionConstraint") != contract["decisionConstraint"]:
        add_violation(
            violations,
            "decision-constraint-mismatch",
            detail="Scope config decisionConstraint diverged from closure contract.",
        )
    if report.get("decisionConstraint") != contract["decisionConstraint"]:
        add_violation(
            violations,
            "scope-report-decision-constraint-mismatch",
            detail="Scope report decisionConstraint diverged from closure contract.",
        )
    if scope_config.get("targetScope") != contract["targetScope"]:
        add_violation(
            violations,
            "target-scope-mismatch",
            detail="Scope config targetScope diverged from closure contract.",
        )
    if report.get("targetScope") != contract["targetScope"]:
        add_violation(
            violations,
            "scope-report-target-mismatch",
            detail="Scope report targetScope diverged from closure contract.",
        )

    boundary_rows = [
        row
        for row in scope_config.get("rows") or []
        if row.get("boundaryState") == contract["boundaryState"]
    ]
    boundary_keys = [
        key
        for row in boundary_rows
        for key in row.get("programKeys") or []
    ]

    if len(boundary_rows) != contract["expectedBoundaryRows"]:
        add_violation(
            violations,
            "boundary-row-count-mismatch",
            detail=(
                f"Expected {contract['expectedBoundaryRows']} boundary rows; "
                f"found {len(boundary_rows)}."
            ),
        )
    if len(boundary_keys) != contract["expectedProgramKeys"]:
        add_violation(
            violations,
            "boundary-program-key-count-mismatch",
            detail=(
                f"Expected {contract['expectedProgramKeys']} boundary keys; "
                f"found {len(boundary_keys)}."
            ),
        )

    registry_ids = registry_by_id(registry)
    report_programs = scope_report_programs(report)
    admission_states = Counter()
    authority_observed_works = 0
    sample_observed_works = 0
    sample_unobserved_keys = []
    programs = []

    key_to_row = {
        key: row
        for row in boundary_rows
        for key in row.get("programKeys") or []
    }

    for key in boundary_keys:
        config_row = key_to_row[key]
        row_id = config_row["id"]
        resolved = canonical.resolve_program(key, registry)
        authority_ref = resolved.get("programRef")
        authority = registry_ids.get(authority_ref) if authority_ref else None

        report_pair = report_programs.get(key)
        report_row = report_pair[0] if report_pair else None
        report_program = report_pair[1] if report_pair else None

        if resolved.get("status") != "confirmed" or authority is None:
            add_violation(
                violations,
                "unresolved-program-authority",
                key=key,
                row_id=row_id,
                detail="Boundary program has no confirmed AcademicProgramAuthority.",
            )
            authority_count = 0
        else:
            admission_state = resolved.get("admissionState")
            admission_states[admission_state or "unknown"] += 1
            raw_count = authority.get("observedCount")
            if not isinstance(raw_count, int) or raw_count < 1:
                add_violation(
                    violations,
                    "invalid-authority-observed-count",
                    key=key,
                    row_id=row_id,
                    detail="Confirmed boundary authority lacks a positive observedCount.",
                )
                authority_count = 0
            else:
                authority_count = raw_count
                authority_observed_works += authority_count

        if report_pair is None:
            add_violation(
                violations,
                "scope-report-program-missing",
                key=key,
                row_id=row_id,
                detail="Boundary program is absent from the generated scope report.",
            )
            sample_count = 0
        else:
            if report_row.get("boundaryState") != contract["boundaryState"]:
                add_violation(
                    violations,
                    "scope-report-boundary-state-mismatch",
                    key=key,
                    row_id=row_id,
                    detail="Generated scope row is no longer boundary-review.",
                )
            report_authority = report_program.get("programAuthority") or {}
            if (
                report_authority.get("status") != resolved.get("status")
                or report_authority.get("programRef") != authority_ref
                or report_authority.get("admissionState")
                != resolved.get("admissionState")
            ):
                add_violation(
                    violations,
                    "scope-report-authority-mismatch",
                    key=key,
                    row_id=row_id,
                    detail="Scope report authority projection diverges from registry.",
                )
            sample_count = int(report_program.get("observedCount") or 0)
            sample_observed_works += sample_count
            if sample_count == 0:
                sample_unobserved_keys.append(key)

        programs.append(
            {
                "rowId": row_id,
                "normalizedKey": key,
                "authorityStatus": resolved.get("status"),
                "programRef": authority_ref,
                "admissionState": resolved.get("admissionState"),
                "authorityObservedCount": authority_count,
                "sampleObservedCount": sample_count,
            }
        )

    expected_states = dict(
        sorted((contract.get("expectedAdmissionStates") or {}).items())
    )
    actual_states = dict(sorted(admission_states.items()))
    if actual_states != expected_states:
        add_violation(
            violations,
            "boundary-admission-state-mismatch",
            detail=(
                f"Expected admission states {expected_states}; "
                f"found {actual_states}."
            ),
        )

    if authority_observed_works != contract["expectedAuthorityObservedWorks"]:
        add_violation(
            violations,
            "boundary-observed-works-mismatch",
            detail=(
                f"Expected {contract['expectedAuthorityObservedWorks']} curated "
                f"boundary works; found {authority_observed_works}."
            ),
        )

    closure_state = "closed" if not violations else "open"
    return {
        "schemaVersion": SCHEMA_VERSION,
        "policyRevision": contract.get("policyRevision"),
        "programAuthorityRevision": registry.get("registryRevision"),
        "institutionAuthorityRevision": registry.get("institutionRevision"),
        "targetScope": contract["targetScope"],
        "boundaryState": contract["boundaryState"],
        "decisionConstraint": contract["decisionConstraint"],
        "closureRule": contract.get("closureRule"),
        "closureState": closure_state,
        "metrics": {
            "boundaryRows": len(boundary_rows),
            "boundaryProgramKeys": len(boundary_keys),
            "confirmedAuthorities": sum(
                1 for item in programs if item["authorityStatus"] == "confirmed"
            ),
            "authorityObservedWorks": authority_observed_works,
            "sampleObservedWorks": sample_observed_works,
            "sampleUnobservedProgramKeys": sorted(sample_unobserved_keys),
            "admissionStates": actual_states,
            "violations": len(violations),
        },
        "expected": {
            "boundaryRows": contract["expectedBoundaryRows"],
            "boundaryProgramKeys": contract["expectedProgramKeys"],
            "authorityObservedWorks": contract["expectedAuthorityObservedWorks"],
            "admissionStates": expected_states,
        },
        "programs": programs,
        "violations": violations,
    }


def markdown_summary(audit: dict[str, Any]) -> str:
    metrics = audit["metrics"]
    expected = audit["expected"]
    lines = [
        "# Thesis Humanities Boundary Closure Audit V1",
        "",
        f"- closure: **{audit['closureState']}**",
        f"- policy revision: `{audit['policyRevision']}`",
        f"- program authority: `{audit['programAuthorityRevision']}`",
        f"- boundary rows: {metrics['boundaryRows']} / {expected['boundaryRows']}",
        (
            f"- boundary program keys: {metrics['boundaryProgramKeys']} / "
            f"{expected['boundaryProgramKeys']}"
        ),
        (
            f"- curated boundary works: {metrics['authorityObservedWorks']} / "
            f"{expected['authorityObservedWorks']}"
        ),
        f"- sample observed works: {metrics['sampleObservedWorks']}",
        f"- violations: {metrics['violations']}",
        "",
        "## Programas",
        "",
        "| Programa | Autoridad | Estado | Full curado | Sample |",
        "|---|---|---|---:|---:|",
    ]
    for item in audit["programs"]:
        lines.append(
            "| {key} | {ref} | {state} | {full} | {sample} |".format(
                key=item["normalizedKey"],
                ref=item["programRef"] or "unresolved",
                state=item["admissionState"] or "unknown",
                full=item["authorityObservedCount"],
                sample=item["sampleObservedCount"],
            )
        )

    lines.extend(["", "## Violaciones", ""])
    if audit["violations"]:
        for item in audit["violations"]:
            lines.append(
                f"- `{item['code']}`: {item['detail']}"
            )
    else:
        lines.append("- Ninguna.")

    lines.extend(
        [
            "",
            "## Restricción",
            "",
            "Este audit no cambia admisión. Si el contrato deja de cumplirse, "
            "reabre curaduría y hace fallar CI.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope-report", required=True)
    parser.add_argument(
        "--registry",
        default=str(canonical.DEFAULT_REGISTRY),
    )
    parser.add_argument(
        "--scope-config",
        default=str(DEFAULT_SCOPE_CONFIG),
    )
    parser.add_argument(
        "--contract",
        default=str(DEFAULT_CONTRACT),
    )
    parser.add_argument(
        "--output-dir",
        default="artifacts/thesis-boundary-closure",
    )
    args = parser.parse_args()

    report = read_json(Path(args.scope_report))
    registry = canonical.load_program_registry(args.registry)
    scope_config = read_json(Path(args.scope_config))
    contract = read_json(Path(args.contract))

    audit = build_audit(report, registry, scope_config, contract)

    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / "boundary-closure-audit.json", audit)
    (output / "boundary-closure-audit.md").write_text(
        markdown_summary(audit),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "schemaVersion": audit["schemaVersion"],
                "closureState": audit["closureState"],
                "metrics": audit["metrics"],
                "expected": audit["expected"],
                "violations": audit["violations"],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )
    return 0 if audit["closureState"] == "closed" else 1


if __name__ == "__main__":
    raise SystemExit(main())

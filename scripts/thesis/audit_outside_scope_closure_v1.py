#!/usr/bin/env python3
"""Audit explicit outside-scope closure contracts.

This audit never changes admission. It verifies that selected outside-scope
rows remain explicitly governed by AcademicProgramAuthority and continue to
match a reviewed closure contract.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

import build_canonical_corpus_v1 as canonical
import build_scope_boundary_matrix_v1 as scope_boundary


SCHEMA_VERSION = "thesis-humanities-outside-scope-closure-audit-v1"
DEFAULT_SCOPE_CONFIG = scope_boundary.DEFAULT_CONFIG
DEFAULT_CONTRACT = (
    Path(__file__).resolve().parent
    / "config"
    / "outside-scope-social-sciences-closure-v1.json"
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def add_violation(
    violations: list[dict[str, Any]],
    code: str,
    *,
    row_id: str | None = None,
    key: str | None = None,
    detail: str,
) -> None:
    item: dict[str, Any] = {"code": code, "detail": detail}
    if row_id is not None:
        item["rowId"] = row_id
    if key is not None:
        item["normalizedKey"] = key
    violations.append(item)


def validate_contract(contract: dict[str, Any]) -> bool:
    if contract.get("schemaVersion") != (
        "thesis-humanities-outside-scope-closure-contract-v1"
    ):
        raise ValueError("Unsupported outside-scope closure contract schema")
    if contract.get("boundaryState") != "outside-scope":
        raise ValueError("Outside-scope closure must target outside-scope")
    if contract.get("targetScope") != "humanities-only":
        raise ValueError("Outside-scope closure must target humanities-only")
    if contract.get("decisionConstraint") != (
        "scope-matrix-does-not-change-admission"
    ):
        raise ValueError("Outside-scope closure must preserve scope admission constraint")
    if not contract.get("closureId"):
        raise ValueError("Outside-scope closure contract requires closureId")

    rows = contract.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Outside-scope closure contract requires rows")

    seen_rows: set[str] = set()
    seen_keys: set[str] = set()
    for row in rows:
        row_id = row.get("id")
        if not row_id or row_id in seen_rows:
            raise ValueError("Outside-scope closure row ids must be unique")
        seen_rows.add(row_id)
        programs = row.get("programs")
        if not isinstance(programs, list) or not programs:
            raise ValueError("Each outside-scope closure row requires programs")
        for program in programs:
            key = program.get("normalizedKey")
            if not key or key in seen_keys:
                raise ValueError("Outside-scope closure program keys must be unique")
            seen_keys.add(key)
            if not program.get("programRef"):
                raise ValueError("Outside-scope closure program requires programRef")
            if program.get("admissionState") != "exclude":
                raise ValueError("V1 outside-scope closure requires EXCLUDE authorities")
            count = program.get("authorityObservedCount")
            if not isinstance(count, int) or count < 1:
                raise ValueError("Outside-scope closure requires positive observed count")

    expected_rows = contract.get("expectedRows")
    expected_keys = contract.get("expectedProgramKeys")
    expected_works = contract.get("expectedAuthorityObservedWorks")
    if expected_rows != len(rows):
        raise ValueError("expectedRows must equal configured contract rows")
    if expected_keys != len(seen_keys):
        raise ValueError("expectedProgramKeys must equal configured program keys")
    if expected_works != sum(
        program["authorityObservedCount"]
        for row in rows
        for program in row["programs"]
    ):
        raise ValueError("expectedAuthorityObservedWorks must equal program totals")
    if contract.get("expectedAdmissionStates") != {"exclude": expected_keys}:
        raise ValueError("V1 expectedAdmissionStates must be all EXCLUDE")
    return True


def registry_by_id(registry: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        item["id"]: item
        for item in registry.get("programs") or []
        if item.get("id")
    }


def config_rows_by_id(scope_config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        row["id"]: row
        for row in scope_config.get("rows") or []
        if row.get("id")
    }


def report_rows_by_id(report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        row["id"]: row
        for row in report.get("rows") or []
        if row.get("id")
    }


def programs_by_key(row: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    if not row:
        return {}
    return {
        item["normalizedKey"]: item
        for item in row.get("programs") or []
        if item.get("normalizedKey")
    }


def build_audit(
    report: dict[str, Any],
    registry: dict[str, Any],
    scope_config: dict[str, Any],
    contract: dict[str, Any],
) -> dict[str, Any]:
    scope_boundary.validate_config(scope_config)
    validate_contract(contract)

    violations: list[dict[str, Any]] = []

    if scope_config.get("policyRevision") != contract.get("policyRevision"):
        add_violation(
            violations,
            "policy-revision-mismatch",
            detail="Scope config policyRevision diverged from closure contract.",
        )
    if report.get("policyRevision") != contract.get("policyRevision"):
        add_violation(
            violations,
            "scope-report-policy-revision-mismatch",
            detail="Scope report policyRevision diverged from closure contract.",
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

    config_rows = config_rows_by_id(scope_config)
    report_rows = report_rows_by_id(report)
    registry_ids = registry_by_id(registry)

    programs: list[dict[str, Any]] = []
    admission_states: Counter[str] = Counter()
    authority_observed_works = 0
    sample_observed_works = 0
    sample_unobserved_keys: list[str] = []

    for expected_row in contract["rows"]:
        row_id = expected_row["id"]
        config_row = config_rows.get(row_id)
        report_row = report_rows.get(row_id)

        if config_row is None:
            add_violation(
                violations,
                "scope-config-row-missing",
                row_id=row_id,
                detail="Contract row is absent from Scope Boundary config.",
            )
            config_keys: list[str] = []
        else:
            if config_row.get("boundaryState") != contract["boundaryState"]:
                add_violation(
                    violations,
                    "scope-config-boundary-state-mismatch",
                    row_id=row_id,
                    detail="Contract row is no longer outside-scope.",
                )
            config_keys = list(config_row.get("programKeys") or [])

        expected_keys = [
            item["normalizedKey"]
            for item in expected_row["programs"]
        ]
        if config_keys != expected_keys:
            add_violation(
                violations,
                "row-program-keys-mismatch",
                row_id=row_id,
                detail=(
                    f"Expected row keys {expected_keys}; found {config_keys}."
                ),
            )

        if report_row is None:
            add_violation(
                violations,
                "scope-report-row-missing",
                row_id=row_id,
                detail="Contract row is absent from generated scope report.",
            )
            report_programs = {}
        else:
            if report_row.get("boundaryState") != contract["boundaryState"]:
                add_violation(
                    violations,
                    "scope-report-boundary-state-mismatch",
                    row_id=row_id,
                    detail="Generated contract row is no longer outside-scope.",
                )
            report_programs = programs_by_key(report_row)

        for expected_program in expected_row["programs"]:
            key = expected_program["normalizedKey"]
            expected_ref = expected_program["programRef"]
            expected_state = expected_program["admissionState"]
            expected_count = expected_program["authorityObservedCount"]

            resolved = canonical.resolve_program(key, registry)
            authority_ref = resolved.get("programRef")
            authority = registry_ids.get(authority_ref) if authority_ref else None

            if resolved.get("status") != "confirmed" or authority is None:
                add_violation(
                    violations,
                    "unresolved-program-authority",
                    row_id=row_id,
                    key=key,
                    detail="Outside-scope program lacks confirmed AcademicProgramAuthority.",
                )
                authority_count = 0
            else:
                admission_states[resolved.get("admissionState") or "unknown"] += 1
                authority_count = authority.get("observedCount")
                if authority_ref != expected_ref:
                    add_violation(
                        violations,
                        "program-ref-mismatch",
                        row_id=row_id,
                        key=key,
                        detail=f"Expected {expected_ref}; found {authority_ref}.",
                    )
                if resolved.get("admissionState") != expected_state:
                    add_violation(
                        violations,
                        "program-admission-state-mismatch",
                        row_id=row_id,
                        key=key,
                        detail=(
                            f"Expected {expected_state}; "
                            f"found {resolved.get('admissionState')}."
                        ),
                    )
                if authority_count != expected_count:
                    add_violation(
                        violations,
                        "program-observed-count-mismatch",
                        row_id=row_id,
                        key=key,
                        detail=f"Expected {expected_count}; found {authority_count}.",
                    )
                if isinstance(authority_count, int) and authority_count > 0:
                    authority_observed_works += authority_count
                else:
                    authority_count = 0

            report_program = report_programs.get(key)
            if report_program is None:
                add_violation(
                    violations,
                    "scope-report-program-missing",
                    row_id=row_id,
                    key=key,
                    detail="Contract program is absent from generated scope report.",
                )
                sample_count = 0
            else:
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
                        row_id=row_id,
                        key=key,
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

    actual_rows = sum(
        1
        for expected_row in contract["rows"]
        if expected_row["id"] in config_rows
    )
    actual_keys = sum(
        len(config_rows[expected_row["id"]].get("programKeys") or [])
        for expected_row in contract["rows"]
        if expected_row["id"] in config_rows
    )
    actual_states = dict(sorted(admission_states.items()))

    if actual_rows != contract["expectedRows"]:
        add_violation(
            violations,
            "closure-row-count-mismatch",
            detail=f"Expected {contract['expectedRows']} rows; found {actual_rows}.",
        )
    if actual_keys != contract["expectedProgramKeys"]:
        add_violation(
            violations,
            "closure-program-key-count-mismatch",
            detail=(
                f"Expected {contract['expectedProgramKeys']} program keys; "
                f"found {actual_keys}."
            ),
        )
    if authority_observed_works != contract["expectedAuthorityObservedWorks"]:
        add_violation(
            violations,
            "closure-observed-works-mismatch",
            detail=(
                f"Expected {contract['expectedAuthorityObservedWorks']} curated works; "
                f"found {authority_observed_works}."
            ),
        )
    if actual_states != contract["expectedAdmissionStates"]:
        add_violation(
            violations,
            "closure-admission-states-mismatch",
            detail=(
                f"Expected {contract['expectedAdmissionStates']}; "
                f"found {actual_states}."
            ),
        )

    closure_state = "closed" if not violations else "open"
    return {
        "schemaVersion": SCHEMA_VERSION,
        "closureId": contract["closureId"],
        "policyRevision": contract["policyRevision"],
        "programAuthorityRevision": registry.get("registryRevision"),
        "institutionAuthorityRevision": registry.get("institutionRevision"),
        "targetScope": contract["targetScope"],
        "boundaryState": contract["boundaryState"],
        "decisionConstraint": contract["decisionConstraint"],
        "closureRule": contract["closureRule"],
        "closureState": closure_state,
        "metrics": {
            "contractRows": actual_rows,
            "contractProgramKeys": actual_keys,
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
            "contractRows": contract["expectedRows"],
            "contractProgramKeys": contract["expectedProgramKeys"],
            "authorityObservedWorks": contract["expectedAuthorityObservedWorks"],
            "admissionStates": contract["expectedAdmissionStates"],
        },
        "programs": programs,
        "violations": violations,
    }


def markdown_summary(audit: dict[str, Any]) -> str:
    metrics = audit["metrics"]
    expected = audit["expected"]
    lines = [
        "# Thesis Humanities Outside-Scope Closure Audit V1",
        "",
        f"- closure id: `{audit['closureId']}`",
        f"- closure: **{audit['closureState']}**",
        f"- program authority: `{audit['programAuthorityRevision']}`",
        (
            f"- contract rows: {metrics['contractRows']} / "
            f"{expected['contractRows']}"
        ),
        (
            f"- program keys: {metrics['contractProgramKeys']} / "
            f"{expected['contractProgramKeys']}"
        ),
        (
            f"- curated works: {metrics['authorityObservedWorks']} / "
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
            lines.append(f"- `{item['code']}`: {item['detail']}")
    else:
        lines.append("- Ninguna.")

    lines.extend(
        [
            "",
            "## Restricción",
            "",
            "Este audit no cambia admisión. Verifica únicamente filas "
            "outside-scope explícitamente incluidas en el contrato.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope-report", required=True)
    parser.add_argument("--registry", default=str(canonical.DEFAULT_REGISTRY))
    parser.add_argument("--scope-config", default=str(DEFAULT_SCOPE_CONFIG))
    parser.add_argument("--contract", default=str(DEFAULT_CONTRACT))
    parser.add_argument(
        "--output-dir",
        default="artifacts/thesis-outside-scope-closure",
    )
    args = parser.parse_args()

    report = read_json(Path(args.scope_report))
    registry = canonical.load_program_registry(args.registry)
    scope_config = read_json(Path(args.scope_config))
    contract = read_json(Path(args.contract))

    audit = build_audit(report, registry, scope_config, contract)

    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / "outside-scope-closure-audit.json", audit)
    (output / "outside-scope-closure-audit.md").write_text(
        markdown_summary(audit),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "schemaVersion": audit["schemaVersion"],
                "closureId": audit["closureId"],
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

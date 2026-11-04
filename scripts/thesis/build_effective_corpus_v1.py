#!/usr/bin/env python3
"""Build the effective thesis corpus from frozen evidence plus approved work decisions.

Order of authority:
1. frozen SourceRecord/canonical evidence;
2. current institution/program authority projection;
3. explicit, merged, primary-source work-level decisions.

The final layer is exact-work only. It never mutates Program Authority.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

import audit_program_coverage_v1 as coverage
import build_canonical_corpus_v1 as canonical
import apply_work_admission_decisions_v1 as work_admission

SCHEMA_VERSION = "thesis-effective-corpus-v1"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def build_effective_corpus(
    corpus: dict[str, Any],
    registry: dict[str, Any],
    decisions: dict[str, Any],
    candidate: dict[str, Any],
    *,
    reference_year: int = 2026,
) -> tuple[dict[str, Any], dict[str, Any]]:
    program_projected, program_report = coverage.reproject_corpus(
        corpus,
        registry,
        reference_year=reference_year,
    )
    effective, activation = work_admission.apply_decisions(
        program_projected,
        decisions,
        candidate,
        registry,
    )

    before = Counter(
        work.get("admissionStatus") or "unknown"
        for work in program_projected.get("works") or []
    )
    after = Counter(
        work.get("admissionStatus") or "unknown"
        for work in effective.get("works") or []
    )
    if len(program_projected.get("works") or []) != len(effective.get("works") or []):
        raise ValueError("Effective projection changed corpus cardinality")

    effective["effectiveCorpusSchemaVersion"] = SCHEMA_VERSION
    effective["effectiveAdmissionRevision"] = decisions["revision"]
    effective["programAuthorityRevision"] = registry.get("registryRevision")
    effective["metrics"] = {
        **dict(effective.get("metrics") or {}),
        "works": len(effective.get("works") or []),
        "worksByAdmission": dict(sorted(after.items())),
    }

    decision_ids = set(activation["selectedWorkIds"])
    changed = []
    for source, target in zip(
        program_projected.get("works") or [],
        effective.get("works") or [],
        strict=True,
    ):
        if source != target:
            changed.append(target.get("id"))

    if set(changed) != decision_ids:
        raise ValueError(
            "Effective corpus differs outside approved work decisions: "
            + json.dumps(changed, ensure_ascii=False)
        )

    report = {
        "schemaVersion": "thesis-effective-corpus-report-v1",
        "effectiveCorpusSchemaVersion": SCHEMA_VERSION,
        "programAuthorityRevision": registry.get("registryRevision"),
        "programMetadataEvidenceRevision": effective.get(
            "programMetadataEvidenceRevision"
        ),
        "workAdmissionDecisionRevision": decisions["revision"],
        "sourceWorks": len(program_projected.get("works") or []),
        "outputWorks": len(effective.get("works") or []),
        "programProjectedAdmission": dict(sorted(before.items())),
        "effectiveAdmission": dict(sorted(after.items())),
        "admissionDelta": activation["admissionDelta"],
        "changedWorkIds": sorted(changed),
        "programAuthorityMutated": False,
        "projectionOrder": [
            "frozen-source-evidence",
            "current-program-authority",
            "approved-work-level-decisions",
        ],
        "baseProjectionGateBlockers": program_report["gateBlockerCount"],
    }
    return effective, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--canonical-corpus", type=Path, required=True)
    parser.add_argument(
        "--registry",
        type=Path,
        default=canonical.DEFAULT_REGISTRY,
    )
    parser.add_argument(
        "--decisions",
        type=Path,
        default=(
            Path(__file__).resolve().parent
            / "config"
            / "work-admission-decisions-v1.json"
        ),
    )
    parser.add_argument(
        "--candidate",
        type=Path,
        default=(
            Path(__file__).resolve().parent
            / "config"
            / "estudios-genero-adjudication-batch-001-v1.json"
        ),
    )
    parser.add_argument("--reference-year", type=int, default=2026)
    parser.add_argument("--output-corpus", type=Path, required=True)
    parser.add_argument("--output-report", type=Path, required=True)
    args = parser.parse_args()

    registry = canonical.load_program_registry(args.registry)
    effective, report = build_effective_corpus(
        read_json(args.canonical_corpus),
        registry,
        read_json(args.decisions),
        read_json(args.candidate),
        reference_year=args.reference_year,
    )
    write_json(args.output_corpus, effective)
    write_json(args.output_report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build a non-admissive program-lineage evidence matrix.

The builder maps every exact normalized raw program key in a previously audited
family to one evidence class. It never creates Program Authority, applies
aliases, or changes admission.
"""

from __future__ import annotations

import argparse
import json

from collections import Counter
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "thesis-program-lineage-evidence-matrix-v1"
DECISION_CONSTRAINT = "lineage-evidence-does-not-create-program-authority"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def build_matrix(
    family_audit: dict[str, Any],
    config: dict[str, Any],
) -> dict[str, Any]:
    if (
        config.get("decisionConstraint")
        != DECISION_CONSTRAINT
    ):
        raise ValueError("Unexpected lineage decision constraint")

    if family_audit.get("familyId") != config.get("familyId"):
        raise ValueError("Family id mismatch")

    observed = {
        row["normalizedKey"]: int(row["works"])
        for row in family_audit.get("programGroups", [])
    }

    classification: dict[str, dict[str, Any]] = {}
    duplicate_keys: list[str] = []

    for evidence_class in config.get("evidenceClasses", []):
        class_id = evidence_class.get("id")
        recommendation = evidence_class.get(
            "authorityRecommendation"
        )
        if recommendation not in {"candidate-v27", "hold"}:
            raise ValueError(
                f"Unsupported authorityRecommendation: {recommendation}"
            )

        for program_key in evidence_class.get("programKeys", []):
            if program_key in classification:
                duplicate_keys.append(program_key)
                continue
            classification[program_key] = {
                "evidenceClass": class_id,
                "authorityRecommendation": recommendation,
                "evidenceLevel": evidence_class.get("evidenceLevel"),
                "rationale": evidence_class.get("rationale"),
            }

    if duplicate_keys:
        raise ValueError(
            "Program keys classified more than once: "
            + ", ".join(sorted(duplicate_keys))
        )

    missing = sorted(set(observed) - set(classification))
    extra = sorted(set(classification) - set(observed))
    if missing:
        raise ValueError(
            "Observed program keys missing from lineage config: "
            + ", ".join(missing)
        )
    if extra:
        raise ValueError(
            "Lineage config contains unobserved program keys: "
            + ", ".join(extra)
        )

    rows: list[dict[str, Any]] = []
    class_group_counts: Counter[str] = Counter()
    class_work_counts: Counter[str] = Counter()
    recommendation_groups: Counter[str] = Counter()
    recommendation_works: Counter[str] = Counter()

    for program_group in family_audit.get("programGroups", []):
        key = program_group["normalizedKey"]
        works = int(program_group["works"])
        meta = classification[key]
        class_id = meta["evidenceClass"]
        recommendation = meta["authorityRecommendation"]

        class_group_counts[class_id] += 1
        class_work_counts[class_id] += works
        recommendation_groups[recommendation] += 1
        recommendation_works[recommendation] += works

        rows.append(
            {
                "normalizedKey": key,
                "works": works,
                **meta,
            }
        )

    pair_disposition: Counter[str] = Counter()
    pair_rows: list[dict[str, Any]] = []

    for pair in family_audit.get("pairs", []):
        recommendations = []
        sides = []

        for side in pair.get("sides", []):
            key = side.get("programKey")
            if key not in classification:
                raise ValueError(
                    f"Structural pair side outside lineage matrix: {key}"
                )
            recommendation = classification[key][
                "authorityRecommendation"
            ]
            recommendations.append(
                "candidate"
                if recommendation == "candidate-v27"
                else "hold"
            )
            sides.append(
                {
                    "programKey": key,
                    "providerRecordId": side.get(
                        "providerRecordId"
                    ),
                    "authorityRecommendation": recommendation,
                }
            )

        disposition = "|".join(sorted(recommendations))
        pair_disposition[disposition] += 1

        pair_rows.append(
            {
                "pairId": pair.get("pairId"),
                "disposition": disposition,
                "sides": sides,
            }
        )

    summary = {
        "familyGroups": len(observed),
        "familyWorks": sum(observed.values()),
        "candidateV27": {
            "groups": recommendation_groups.get(
                "candidate-v27",
                0,
            ),
            "works": recommendation_works.get(
                "candidate-v27",
                0,
            ),
        },
        "hold": {
            "groups": recommendation_groups.get("hold", 0),
            "works": recommendation_works.get("hold", 0),
        },
        "byClass": {
            class_id: {
                "groups": class_group_counts[class_id],
                "works": class_work_counts[class_id],
            }
            for class_id in sorted(class_group_counts)
        },
        "structuralPairDisposition": dict(
            sorted(pair_disposition.items())
        ),
    }

    return {
        "schemaVersion": SCHEMA_VERSION,
        "familyId": config["familyId"],
        "decisionConstraint": DECISION_CONSTRAINT,
        "authorityDecision": "hold",
        "candidateAuthorityId": config.get(
            "candidateAuthorityId"
        ),
        "evidenceSources": config.get("evidenceSources", {}),
        "summary": summary,
        "rows": rows,
        "structuralPairs": pair_rows,
        "notes": [
            (
                "candidate-v27 is an evidence recommendation only and "
                "does not create or apply Program Authority."
            ),
            (
                "Every observed normalized raw program key is classified "
                "exactly once by an explicit config entry."
            ),
            (
                "No fuzzy matching or thesis-topic semantics are used."
            ),
        ],
    }


def markdown(matrix: dict[str, Any]) -> str:
    summary = matrix["summary"]
    lines = [
        "# Program Lineage Evidence Matrix V1",
        "",
        f"Family: `{matrix['familyId']}`",
        "",
        (
            "Decision constraint: "
            f"`{matrix['decisionConstraint']}`"
        ),
        "",
        f"Family groups: **{summary['familyGroups']:,}**",
        f"Family works: **{summary['familyWorks']:,}**",
        (
            "Candidate V27: "
            f"**{summary['candidateV27']['groups']:,} groups / "
            f"{summary['candidateV27']['works']:,} works**"
        ),
        (
            "HOLD: "
            f"**{summary['hold']['groups']:,} groups / "
            f"{summary['hold']['works']:,} works**"
        ),
        "",
        "## Evidence classes",
        "",
    ]
    for class_id, metrics in summary["byClass"].items():
        lines.append(
            f"- `{class_id}`: "
            f"{metrics['groups']:,} groups / "
            f"{metrics['works']:,} works"
        )

    lines += [
        "",
        "## Program rows",
        "",
    ]
    for row in matrix["rows"]:
        lines.append(
            "- "
            f"**{row['works']:,}** · "
            f"`{row['normalizedKey']}` · "
            f"`{row['evidenceClass']}` · "
            f"`{row['authorityRecommendation']}`"
        )

    lines += [
        "",
        "## Structural pair disposition",
        "",
    ]
    for disposition, count in (
        summary["structuralPairDisposition"].items()
    ):
        lines.append(
            f"- `{disposition}`: **{count}**"
        )

    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--family-audit", required=True, type=Path)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    family_audit = read_json(args.family_audit)
    config = read_json(args.config)

    matrix = build_matrix(family_audit, config)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "program-lineage-evidence-matrix.json").write_text(
        json.dumps(
            matrix,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "program-lineage-evidence-matrix.md").write_text(
        markdown(matrix),
        encoding="utf-8",
    )

    print(
        json.dumps(
            matrix["summary"],
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

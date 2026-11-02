#!/usr/bin/env python3
"""Build an auditable work-level review queue for boundary REVIEW programs.

This tool never changes Humanities admission. It projects the current
Institution / Program Authority state over frozen evidence, then creates a
primary-source review queue for programs whose program-level scope decision is
explicitly exhausted.

Title, abstract, keywords, embeddings, semantic similarity and language-model
classification are supporting navigation signals only and are never sufficient
to change admission.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
from collections import Counter
from pathlib import Path
from typing import Any

import audit_program_coverage_v1 as coverage
import build_canonical_corpus_v1 as canonical


SCHEMA_VERSION = "thesis-boundary-work-review-queue-v1"
DEFAULT_POLICY = (
    Path(__file__).resolve().parent
    / "config"
    / "boundary-work-review-policy-v1.json"
)


def read_json(path: Path) -> Any:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as stream:
            return json.load(stream)
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def validate_policy(policy: dict[str, Any]) -> bool:
    if policy.get("schemaVersion") != "thesis-boundary-work-review-policy-v1":
        raise ValueError("Unsupported boundary work review policy schema")
    if policy.get("targetScope") != "humanities-only":
        raise ValueError("Boundary work review policy must target humanities-only")
    if policy.get("decisionConstraint") != (
        "boundary-work-review-does-not-change-admission"
    ):
        raise ValueError("Boundary work review must be non-admissive")

    programs = policy.get("programs")
    if not isinstance(programs, list) or not programs:
        raise ValueError("Boundary work review policy requires programs")

    refs: set[str] = set()
    for item in programs:
        ref = item.get("programRef")
        if not isinstance(ref, str) or not ref:
            raise ValueError("Boundary work review programRef is required")
        if ref in refs:
            raise ValueError(f"Duplicate boundary work review programRef: {ref}")
        refs.add(ref)

        if item.get("requiredProgramAdmissionState") != "review":
            raise ValueError(
                "Boundary work review may only target REVIEW authorities"
            )
        if item.get("resolutionMode") != (
            "work-level-primary-source-adjudication"
        ):
            raise ValueError("Unsupported boundary work resolution mode")
        if item.get("admissionInvariant") != (
            "review-until-explicit-work-decision"
        ):
            raise ValueError("Boundary work review admission invariant missing")

        required = item.get("requiredDecisionEvidence")
        if not isinstance(required, list) or not required:
            raise ValueError("Primary-source decision evidence is required")

        prohibited = set(item.get("prohibitedAsSoleDecisionBasis") or [])
        for required_signal in {
            "title",
            "abstract",
            "keywords",
            "language-model-classification",
            "embedding",
            "semantic-similarity",
        }:
            if required_signal not in prohibited:
                raise ValueError(
                    f"Unsafe sole-decision signal not prohibited: {required_signal}"
                )

    return True


def registry_by_id(registry: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        item["id"]: item
        for item in registry.get("programs") or []
        if item.get("id")
    }


def first_handle(work: dict[str, Any]) -> str | None:
    for item in work.get("persistentIdentifiers") or []:
        if item.get("scheme") != "handle":
            continue
        raw = item.get("rawValue")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
        normalized = item.get("normalizedValue")
        if isinstance(normalized, str) and normalized.strip():
            return f"https://hdl.handle.net/{normalized.strip()}"
    return None


def projected_target_works(
    corpus: dict[str, Any],
    registry: dict[str, Any],
    program_ref: str,
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    selected = []
    for work in corpus.get("works") or []:
        projection = coverage.project_work_admission(work, registry)
        program = projection.get("program") or {}
        if program.get("programRef") == program_ref:
            selected.append((work, projection))
    return selected


def build_queue(
    corpus: dict[str, Any],
    registry: dict[str, Any],
    policy: dict[str, Any],
) -> dict[str, Any]:
    validate_policy(policy)
    authorities = registry_by_id(registry)

    all_items: list[dict[str, Any]] = []
    program_summaries = []

    global_admission = Counter()
    global_applicability = Counter()
    global_confidence = Counter()
    global_units = Counter()
    global_date_quality = Counter()
    total_abstract = 0
    total_keywords = 0
    total_handles = 0
    total_contributors = 0

    for policy_program in policy["programs"]:
        program_ref = policy_program["programRef"]
        authority = authorities.get(program_ref)
        if authority is None:
            raise ValueError(
                f"Boundary work review authority missing: {program_ref}"
            )
        if authority.get("admissionState") != (
            policy_program["requiredProgramAdmissionState"]
        ):
            raise ValueError(
                f"Boundary work review authority must remain REVIEW: {program_ref}"
            )

        selected = projected_target_works(corpus, registry, program_ref)
        admission = Counter()
        applicability = Counter()
        confidence = Counter()
        units = Counter()
        dates = Counter()
        abstract_available = 0
        keywords_available = 0
        handles_available = 0
        contributors_available = 0

        for work, projection in selected:
            evidence = projection.get("programMetadataEvidence") or {}
            handle = first_handle(work)
            abstract = work.get("abstract") or ""
            keywords = work.get("keywords") or []
            contributors = work.get("contributions") or []
            date = work.get("date") or {}

            status = projection.get("status") or "unknown"
            applicability_state = (
                evidence.get("authorityApplicability") or "allowed"
            )
            confidence_state = (
                evidence.get("confidenceState") or "unassessed"
            )
            unit = work.get("academicUnitRaw") or "unknown"
            date_quality = date.get("quality") or "unknown"

            admission[status] += 1
            applicability[applicability_state] += 1
            confidence[confidence_state] += 1
            units[unit] += 1
            dates[date_quality] += 1

            global_admission[status] += 1
            global_applicability[applicability_state] += 1
            global_confidence[confidence_state] += 1
            global_units[unit] += 1
            global_date_quality[date_quality] += 1

            has_abstract = bool(str(abstract).strip())
            has_keywords = bool(keywords)
            has_contributors = bool(contributors)

            abstract_available += int(has_abstract)
            keywords_available += int(has_keywords)
            handles_available += int(handle is not None)
            contributors_available += int(has_contributors)

            total_abstract += int(has_abstract)
            total_keywords += int(has_keywords)
            total_handles += int(handle is not None)
            total_contributors += int(has_contributors)

            all_items.append(
                {
                    "workId": work.get("id"),
                    "programRef": program_ref,
                    "title": work.get("title"),
                    "academicUnitRaw": work.get("academicUnitRaw"),
                    "date": {
                        "value": date.get("value"),
                        "quality": date_quality,
                    },
                    "handle": handle,
                    "sourceRecordRefs": work.get("sourceRecordRefs") or [],
                    "supportingEvidenceAvailability": {
                        "abstract": has_abstract,
                        "keywords": has_keywords,
                        "keywordCount": len(keywords),
                        "contributors": has_contributors,
                    },
                    "programMetadataEvidence": {
                        "confidenceState": confidence_state,
                        "authorityApplicability": applicability_state,
                    },
                    "projectedAdmissionStatus": status,
                    "workReviewState": "pending-primary-source-review",
                    "resolutionMode": policy_program["resolutionMode"],
                    "requiredDecisionEvidence": list(
                        policy_program["requiredDecisionEvidence"]
                    ),
                    "prohibitedAsSoleDecisionBasis": list(
                        policy_program["prohibitedAsSoleDecisionBasis"]
                    ),
                    "decisionConstraint": policy["decisionConstraint"],
                }
            )

        program_summaries.append(
            {
                "programRef": program_ref,
                "canonicalName": authority.get("canonicalName"),
                "programAdmissionState": authority.get("admissionState"),
                "resolutionMode": policy_program["resolutionMode"],
                "programLevelConclusion": policy_program[
                    "programLevelConclusion"
                ],
                "works": len(selected),
                "projectedAdmission": dict(sorted(admission.items())),
                "programAuthorityApplicability": dict(
                    sorted(applicability.items())
                ),
                "programMetadataConfidenceStates": dict(
                    sorted(confidence.items())
                ),
                "academicUnits": dict(units.most_common()),
                "dateQuality": dict(sorted(dates.items())),
                "abstractAvailable": abstract_available,
                "keywordsAvailable": keywords_available,
                "handleAvailable": handles_available,
                "contributorsAvailable": contributors_available,
                "pendingPrimarySourceReview": len(selected),
                "automaticAdmissionDecisions": 0,
                "admissionChanges": 0,
            }
        )

    all_items.sort(
        key=lambda item: (
            item.get("programRef") or "",
            item.get("workId") or "",
        )
    )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "policyRevision": policy["policyRevision"],
        "programAuthorityRevision": registry.get("registryRevision"),
        "programMetadataEvidenceRevision": (
            canonical.load_program_metadata_evidence_policy().get(
                "policyRevision"
            )
        ),
        "targetScope": policy["targetScope"],
        "decisionConstraint": policy["decisionConstraint"],
        "metrics": {
            "programs": len(program_summaries),
            "workItems": len(all_items),
            "projectedAdmission": dict(sorted(global_admission.items())),
            "programAuthorityApplicability": dict(
                sorted(global_applicability.items())
            ),
            "programMetadataConfidenceStates": dict(
                sorted(global_confidence.items())
            ),
            "academicUnits": dict(global_units.most_common()),
            "dateQuality": dict(sorted(global_date_quality.items())),
            "abstractAvailable": total_abstract,
            "abstractMissing": len(all_items) - total_abstract,
            "keywordsAvailable": total_keywords,
            "handleAvailable": total_handles,
            "contributorsAvailable": total_contributors,
            "pendingPrimarySourceReview": len(all_items),
            "automaticAdmissionDecisions": 0,
            "admissionChanges": 0,
        },
        "programs": program_summaries,
        "items": all_items,
    }


def write_csv(path: Path, queue: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = [
        "workId",
        "programRef",
        "title",
        "academicUnitRaw",
        "dateValue",
        "dateQuality",
        "handle",
        "abstractAvailable",
        "keywordsAvailable",
        "keywordCount",
        "contributorsAvailable",
        "confidenceState",
        "authorityApplicability",
        "projectedAdmissionStatus",
        "workReviewState",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for item in queue.get("items") or []:
            support = item["supportingEvidenceAvailability"]
            evidence = item["programMetadataEvidence"]
            writer.writerow(
                {
                    "workId": item["workId"],
                    "programRef": item["programRef"],
                    "title": item.get("title") or "",
                    "academicUnitRaw": item.get("academicUnitRaw") or "",
                    "dateValue": item["date"].get("value") or "",
                    "dateQuality": item["date"].get("quality") or "",
                    "handle": item.get("handle") or "",
                    "abstractAvailable": support["abstract"],
                    "keywordsAvailable": support["keywords"],
                    "keywordCount": support["keywordCount"],
                    "contributorsAvailable": support["contributors"],
                    "confidenceState": evidence["confidenceState"],
                    "authorityApplicability": evidence[
                        "authorityApplicability"
                    ],
                    "projectedAdmissionStatus": item[
                        "projectedAdmissionStatus"
                    ],
                    "workReviewState": item["workReviewState"],
                }
            )


def markdown_summary(queue: dict[str, Any]) -> str:
    metrics = queue["metrics"]
    lines = [
        "# Boundary Work Review Queue V1",
        "",
        "**Esta cola no cambia admisión.**",
        "",
        f"- policy: `{queue['policyRevision']}`",
        f"- Program Authority: `{queue['programAuthorityRevision']}`",
        f"- programas: {metrics['programs']}",
        f"- obras pendientes: {metrics['workItems']}",
        (
            "- projected admission: "
            + json.dumps(
                metrics["projectedAdmission"],
                ensure_ascii=False,
                sort_keys=True,
            )
        ),
        (
            "- authority applicability: "
            + json.dumps(
                metrics["programAuthorityApplicability"],
                ensure_ascii=False,
                sort_keys=True,
            )
        ),
        f"- abstract disponible: {metrics['abstractAvailable']}",
        f"- keywords disponibles: {metrics['keywordsAvailable']}",
        f"- handle disponible: {metrics['handleAvailable']}",
        (
            "- decisiones automáticas: "
            f"{metrics['automaticAdmissionDecisions']}"
        ),
        f"- cambios de admission: {metrics['admissionChanges']}",
        "",
        "## Restricción",
        "",
        (
            "Título, abstract, keywords, similitud semántica, embeddings y "
            "clasificación por modelos sólo pueden orientar la revisión. "
            "Nunca bastan para INCLUDE/EXCLUDE."
        ),
        "",
        (
            "Cada obra permanece REVIEW hasta una decisión explícita basada "
            "en fuente primaria/institucional y revisión humana."
        ),
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--canonical-corpus", required=True)
    parser.add_argument(
        "--registry",
        default=str(canonical.DEFAULT_REGISTRY),
    )
    parser.add_argument(
        "--policy",
        default=str(DEFAULT_POLICY),
    )
    parser.add_argument(
        "--output-dir",
        default="artifacts/thesis-boundary-work-review",
    )
    args = parser.parse_args()

    corpus = read_json(Path(args.canonical_corpus))
    registry = canonical.load_program_registry(args.registry)
    policy = read_json(Path(args.policy))

    queue = build_queue(corpus, registry, policy)
    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / "boundary-work-review-queue.json", queue)
    write_csv(output / "boundary-work-review-queue.csv", queue)
    (output / "boundary-work-review-queue.md").write_text(
        markdown_summary(queue),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "schemaVersion": queue["schemaVersion"],
                "policyRevision": queue["policyRevision"],
                "programAuthorityRevision": queue[
                    "programAuthorityRevision"
                ],
                "metrics": queue["metrics"],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

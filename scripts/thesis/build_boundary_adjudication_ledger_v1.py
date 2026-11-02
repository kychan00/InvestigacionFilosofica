#!/usr/bin/env python3
"""Build a non-admissive adjudication ledger from a boundary work-review queue.

The ledger records primary-source access, candidate status and explicit human
validation state. It never changes admission. A restricted primary source
cannot produce an INCLUDE/EXCLUDE candidate from title/abstract/keywords alone.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "thesis-boundary-work-adjudication-ledger-v1"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def validate_batch(batch: dict[str, Any]) -> bool:
    if batch.get("schemaVersion") != (
        "thesis-boundary-work-adjudication-batch-v1"
    ):
        raise ValueError("Unsupported adjudication batch schema")
    if batch.get("decisionConstraint") != "batch-does-not-change-admission":
        raise ValueError("Adjudication batch must be non-admissive")
    if batch.get("humanValidationRequired") is not True:
        raise ValueError("Adjudication batch requires explicit human validation")

    works = batch.get("works")
    if not isinstance(works, list) or not works:
        raise ValueError("Adjudication batch requires works")

    ids: set[str] = set()
    for item in works:
        work_id = item.get("workId")
        if not isinstance(work_id, str) or not work_id:
            raise ValueError("Batch workId is required")
        if work_id in ids:
            raise ValueError(f"Duplicate batch workId: {work_id}")
        ids.add(work_id)

        if item.get("primarySourceAccess") not in {
            "available",
            "restricted",
            "missing",
            "unverified",
        }:
            raise ValueError(
                f"Unsupported primarySourceAccess for {work_id}"
            )
        if not item.get("institutionalRecordUrl"):
            raise ValueError(
                f"Institutional record URL is required for {work_id}"
            )
    return True


def build_ledger(
    queue: dict[str, Any],
    batch: dict[str, Any],
) -> dict[str, Any]:
    validate_batch(batch)

    if queue.get("decisionConstraint") != (
        "boundary-work-review-does-not-change-admission"
    ):
        raise ValueError("Input queue is not a non-admissive work-review queue")
    if queue.get("policyRevision") != batch.get("workReviewPolicyRevision"):
        raise ValueError("Work-review policy revision mismatch")

    by_id = {
        item["workId"]: item
        for item in queue.get("items") or []
        if item.get("workId")
    }

    entries: list[dict[str, Any]] = []
    access_states = Counter()
    adjudication_states = Counter()
    candidate_decisions = Counter()
    human_validation = Counter()

    for source in batch["works"]:
        work_id = source["workId"]
        work = by_id.get(work_id)
        if work is None:
            raise ValueError(f"Batch work absent from work-review queue: {work_id}")

        if work.get("programRef") != batch.get("programRef"):
            raise ValueError(f"Batch work program mismatch: {work_id}")
        if work.get("projectedAdmissionStatus") != "review":
            raise ValueError(f"Batch work must remain REVIEW: {work_id}")
        if work.get("workReviewState") != "pending-primary-source-review":
            raise ValueError(
                f"Batch work must be pending primary-source review: {work_id}"
            )
        if work.get("handle") != source.get("handle"):
            raise ValueError(f"Batch handle mismatch: {work_id}")

        access = source["primarySourceAccess"]
        access_states[access] += 1

        if access == "available":
            adjudication_state = "candidate-evidence-ready"
            candidate_decision = None
        else:
            adjudication_state = "blocked-primary-source-access"
            candidate_decision = None

        adjudication_states[adjudication_state] += 1
        candidate_decisions["none"] += 1
        human_validation["required"] += 1

        entries.append(
            {
                "workId": work_id,
                "programRef": work["programRef"],
                "title": work.get("title"),
                "handle": work.get("handle"),
                "institutionalRecordUrl": source["institutionalRecordUrl"],
                "primarySourceAccess": access,
                "accessEvidence": source.get("accessEvidence"),
                "accessVerifiedDate": source.get("accessVerifiedDate"),
                "projectedAdmissionStatus": "review",
                "adjudicationState": adjudication_state,
                "candidateDecision": candidate_decision,
                "humanValidationStatus": "required",
                "admissionChangeRequested": False,
                "decisionConstraint": "ledger-does-not-change-admission",
                "prohibitedDecisionShortcut": (
                    "title-abstract-keywords-semantic-model-not-sufficient"
                ),
            }
        )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "phase": batch.get("phase"),
        "batchId": batch["batchId"],
        "programRef": batch["programRef"],
        "workReviewPolicyRevision": batch["workReviewPolicyRevision"],
        "sourceQueueSchemaVersion": queue.get("schemaVersion"),
        "decisionConstraint": "ledger-does-not-change-admission",
        "humanValidationRequired": True,
        "metrics": {
            "batchWorks": len(entries),
            "primarySourceAccess": dict(sorted(access_states.items())),
            "adjudicationStates": dict(sorted(adjudication_states.items())),
            "candidateDecisions": dict(sorted(candidate_decisions.items())),
            "humanValidation": dict(sorted(human_validation.items())),
            "admissionChanges": 0,
        },
        "entries": entries,
    }


def write_csv(path: Path, ledger: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = [
        "workId",
        "title",
        "handle",
        "institutionalRecordUrl",
        "primarySourceAccess",
        "adjudicationState",
        "candidateDecision",
        "humanValidationStatus",
        "projectedAdmissionStatus",
        "admissionChangeRequested",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for item in ledger["entries"]:
            writer.writerow({key: item.get(key) for key in columns})


def markdown_summary(ledger: dict[str, Any]) -> str:
    metrics = ledger["metrics"]
    lines = [
        "# Boundary Work Adjudication Ledger V1",
        "",
        "**Este ledger no cambia admisión.**",
        "",
        f"- batch: `{ledger['batchId']}`",
        f"- programa: `{ledger['programRef']}`",
        f"- obras: {metrics['batchWorks']}",
        (
            "- acceso a fuente primaria: "
            + json.dumps(
                metrics["primarySourceAccess"],
                ensure_ascii=False,
                sort_keys=True,
            )
        ),
        (
            "- estados de adjudicación: "
            + json.dumps(
                metrics["adjudicationStates"],
                ensure_ascii=False,
                sort_keys=True,
            )
        ),
        "- decisiones candidatas: 0",
        "- validaciones humanas completadas: 0",
        "- cambios de admission: 0",
        "",
        "## Regla",
        "",
        (
            "Un PDF restringido bloquea la adjudicación. La ficha RIUdeG, "
            "título, abstract, keywords o clasificación automática no bastan "
            "para producir INCLUDE/EXCLUDE."
        ),
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--work-review-queue", required=True)
    parser.add_argument("--batch", required=True)
    parser.add_argument(
        "--output-dir",
        default="artifacts/thesis-boundary-adjudication",
    )
    args = parser.parse_args()

    queue = read_json(Path(args.work_review_queue))
    batch = read_json(Path(args.batch))
    ledger = build_ledger(queue, batch)

    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / "adjudication-ledger.json", ledger)
    write_csv(output / "adjudication-ledger.csv", ledger)
    (output / "adjudication-ledger.md").write_text(
        markdown_summary(ledger),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "schemaVersion": ledger["schemaVersion"],
                "batchId": ledger["batchId"],
                "programRef": ledger["programRef"],
                "metrics": ledger["metrics"],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

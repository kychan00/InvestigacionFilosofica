#!/usr/bin/env python3
"""Audit Program Metadata Evidence Confidence over a canonical thesis corpus."""

from __future__ import annotations

import argparse
import gzip
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import build_canonical_corpus_v1 as canonical


SCHEMA_VERSION = "thesis-program-metadata-evidence-confidence-audit-v1"
DECISION_CONSTRAINT = "metadata-confidence-does-not-create-program-authority"


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


def build_audit(
    corpus: dict[str, Any],
    queue: dict[str, Any] | None = None,
) -> dict[str, Any]:
    confidence_states: Counter[str] = Counter()
    applicability: Counter[str] = Counter()
    rule_matches: Counter[str] = Counter()
    blocked_programs: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "works": 0,
            "programRefs": Counter(),
            "ruleMatches": Counter(),
            "admissionStatuses": Counter(),
        }
    )
    violations: list[dict[str, Any]] = []

    for work in corpus.get("works", []):
        evidence = work.get("programMetadataEvidence") or {
            "confidenceState": "unassessed",
            "authorityApplicability": "allowed",
            "matchedRuleId": None,
        }
        state = evidence.get("confidenceState") or "unassessed"
        authority_applicability = (
            evidence.get("authorityApplicability") or "allowed"
        )
        rule_id = evidence.get("matchedRuleId")

        confidence_states[state] += 1
        applicability[authority_applicability] += 1
        if rule_id:
            rule_matches[rule_id] += 1

        if authority_applicability != "blocked":
            continue

        key = canonical.normalize_key(work.get("programRaw")) or "<missing>"
        row = blocked_programs[key]
        row["works"] += 1
        if work.get("programRef"):
            row["programRefs"][work["programRef"]] += 1
        if rule_id:
            row["ruleMatches"][rule_id] += 1
        row["admissionStatuses"][
            work.get("admissionStatus") or "unknown"
        ] += 1

        if not rule_id:
            violations.append(
                {
                    "type": "blocked-without-rule",
                    "workId": work.get("id"),
                    "programRaw": work.get("programRaw"),
                }
            )

        if work.get("admissionStatus") in {"include", "review"}:
            violations.append(
                {
                    "type": "blocked-evidence-admitted",
                    "workId": work.get("id"),
                    "programRaw": work.get("programRaw"),
                    "admissionStatus": work.get("admissionStatus"),
                }
            )

    blocked_rows = []
    for key, row in blocked_programs.items():
        blocked_rows.append(
            {
                "normalizedKey": key,
                "works": row["works"],
                "programRefs": dict(row["programRefs"].most_common()),
                "ruleMatches": dict(row["ruleMatches"].most_common()),
                "admissionStatuses": dict(
                    row["admissionStatuses"].most_common()
                ),
            }
        )
    blocked_rows.sort(key=lambda row: (-row["works"], row["normalizedKey"]))

    metadata_queue_items = []
    for item in (queue or {}).get("items", []):
        if item.get("queueState") != "metadata-review":
            continue
        metadata_queue_items.append(
            {
                "rank": item.get("rank"),
                "normalizedKey": item.get("normalizedKey"),
                "count": item.get("count"),
                "curationLane": item.get("curationLane"),
                "authority": item.get("authority"),
                "programMetadataEvidence": item.get(
                    "programMetadataEvidence"
                ),
            }
        )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "decisionConstraint": DECISION_CONSTRAINT,
        "programMetadataEvidenceRevision": corpus.get(
            "programMetadataEvidenceRevision"
        ),
        "programAuthorityRevision": corpus.get(
            "programAuthorityRevision"
        ),
        "metrics": {
            "works": len(corpus.get("works", [])),
            "confidenceStates": dict(sorted(confidence_states.items())),
            "authorityApplicability": dict(sorted(applicability.items())),
            "ruleMatches": dict(rule_matches.most_common()),
            "blockedWorks": applicability.get("blocked", 0),
            "blockedProgramGroups": len(blocked_rows),
            "metadataReviewQueueItems": len(metadata_queue_items),
            "violations": len(violations),
        },
        "blockedPrograms": blocked_rows,
        "metadataReviewQueueItems": metadata_queue_items,
        "violations": violations,
    }


def markdown_summary(report: dict[str, Any]) -> str:
    metrics = report["metrics"]
    lines = [
        "# Program Metadata Evidence Confidence Audit V1",
        "",
        (
            "Decision constraint: "
            f"`{report['decisionConstraint']}`"
        ),
        "",
        (
            "Policy revision: "
            f"`{report.get('programMetadataEvidenceRevision')}`"
        ),
        "",
        f"- works: **{metrics['works']}**",
        f"- blocked works: **{metrics['blockedWorks']}**",
        (
            "- blocked program groups: "
            f"**{metrics['blockedProgramGroups']}**"
        ),
        (
            "- metadata-review queue items: "
            f"**{metrics['metadataReviewQueueItems']}**"
        ),
        f"- violations: **{metrics['violations']}**",
        "",
        "## Confidence states",
        "",
    ]

    for state, count in metrics["confidenceStates"].items():
        lines.append(f"- {state}: {count}")

    lines.extend(["", "## Rule matches", ""])
    if metrics["ruleMatches"]:
        for rule_id, count in metrics["ruleMatches"].items():
            lines.append(f"- `{rule_id}`: {count}")
    else:
        lines.append("- none")

    lines.extend(["", "## Blocked program groups", ""])
    if report["blockedPrograms"]:
        for row in report["blockedPrograms"]:
            lines.append(
                f"- `{row['normalizedKey']}`: {row['works']} works"
            )
    else:
        lines.append("- none")

    lines.extend(
        [
            "",
            (
                "Blocked metadata never creates, changes or removes an "
                "AcademicProgramAuthority; it only prevents automatic "
                "authority application for the affected record."
            ),
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--canonical-corpus", type=Path, required=True)
    parser.add_argument("--queue", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    report = build_audit(
        read_json(args.canonical_corpus),
        read_json(args.queue) if args.queue else None,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_json(
        args.output_dir / "program-metadata-confidence-audit.json",
        report,
    )
    (
        args.output_dir / "program-metadata-confidence-audit.md"
    ).write_text(markdown_summary(report), encoding="utf-8")

    print(
        json.dumps(
            report["metrics"],
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()

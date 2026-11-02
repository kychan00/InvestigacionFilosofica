#!/usr/bin/env python3
"""Reapply the current program-metadata confidence policy to a frozen corpus.

This is intentionally narrower than a re-harvest:
- raw source records remain frozen;
- program/institution authority is not changed here;
- only ProgramMetadataEvidence is recomputed from the current executable policy;
- the output is suitable for deterministic full-baseline confidence/queue audits.
"""

from __future__ import annotations

import argparse
import gzip
import json

from collections import Counter
from pathlib import Path
from typing import Any

import build_canonical_corpus_v1 as canonical


SCHEMA_VERSION = "thesis-program-metadata-confidence-reprojection-v1"


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


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def reproject(
    corpus: dict[str, Any],
    source_records: list[dict[str, Any]],
    policy: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    source_by_id = {
        source["id"]: source
        for source in source_records
        if source.get("id")
    }

    confidence_states: Counter[str] = Counter()
    applicability: Counter[str] = Counter()
    rule_matches: Counter[str] = Counter()
    missing_source_refs: list[dict[str, Any]] = []
    multi_source_works: list[dict[str, Any]] = []

    projected = dict(corpus)
    projected_works: list[dict[str, Any]] = []

    for original in corpus.get("works", []):
        work = dict(original)
        refs = list(work.get("sourceRecordRefs") or [])

        if not refs:
            missing_source_refs.append(
                {
                    "workId": work.get("id"),
                    "reason": "work-without-source-record-ref",
                }
            )
            continue

        if len(refs) > 1:
            multi_source_works.append(
                {
                    "workId": work.get("id"),
                    "sourceRecordRefs": refs,
                }
            )

        # Canonical V1 stores ProgramMetadataEvidence from the primary candidate.
        # For the frozen baseline each work has exactly one sourceRecordRef.
        source = source_by_id.get(refs[0])
        if source is None:
            missing_source_refs.append(
                {
                    "workId": work.get("id"),
                    "sourceRecordRef": refs[0],
                    "reason": "source-record-not-found",
                }
            )
            continue

        evidence = canonical.evaluate_program_metadata_evidence(
            source,
            work.get("programRaw"),
            policy,
        )
        work["programMetadataEvidence"] = evidence
        projected_works.append(work)

        state = evidence.get("confidenceState") or "unassessed"
        authority_applicability = (
            evidence.get("authorityApplicability") or "allowed"
        )
        confidence_states[state] += 1
        applicability[authority_applicability] += 1
        if evidence.get("matchedRuleId"):
            rule_matches[evidence["matchedRuleId"]] += 1

    if missing_source_refs:
        raise ValueError(
            "Frozen confidence reprojection has missing source records: "
            + json.dumps(missing_source_refs[:10], ensure_ascii=False)
        )

    projected["works"] = projected_works
    projected["programMetadataEvidenceRevision"] = policy.get(
        "policyRevision",
        policy.get("schemaVersion"),
    )

    metrics = dict(projected.get("metrics") or {})
    metrics["programMetadataConfidenceStates"] = dict(
        confidence_states.most_common()
    )
    metrics["programAuthorityApplicability"] = dict(
        applicability.most_common()
    )
    projected["metrics"] = metrics

    report = {
        "schemaVersion": SCHEMA_VERSION,
        "programMetadataEvidenceRevision": projected[
            "programMetadataEvidenceRevision"
        ],
        "metrics": {
            "works": len(projected_works),
            "sourceRecords": len(source_records),
            "confidenceStates": dict(
                sorted(confidence_states.items())
            ),
            "authorityApplicability": dict(
                sorted(applicability.items())
            ),
            "ruleMatches": dict(rule_matches.most_common()),
            "multiSourceWorks": len(multi_source_works),
        },
        "multiSourceWorks": multi_source_works,
    }

    return projected, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--canonical-corpus", type=Path, required=True)
    parser.add_argument("--source-records", type=Path, required=True)
    parser.add_argument(
        "--policy",
        type=Path,
        default=canonical.DEFAULT_PROGRAM_METADATA_EVIDENCE_POLICY,
    )
    parser.add_argument("--output-corpus", type=Path, required=True)
    parser.add_argument("--output-report", type=Path, required=True)
    args = parser.parse_args()

    policy = canonical.load_program_metadata_evidence_policy(args.policy)
    projected, report = reproject(
        read_json(args.canonical_corpus),
        read_jsonl(args.source_records),
        policy,
    )

    write_json(args.output_corpus, projected)
    write_json(args.output_report, report)

    print(
        json.dumps(
            report,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()

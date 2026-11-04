#!/usr/bin/env python3
"""Apply explicit, approved work-level Humanities admission decisions.

This is an opt-in projection layer, not a program-wide authority mutation.
The frozen source corpus, raw metadata and Program Authority remain immutable.
"""
from __future__ import annotations

import argparse
import copy
import json
from collections import Counter
from pathlib import Path
from typing import Any

SCHEMA = "thesis-work-admission-decisions-v1"
DECISION_EXPLANATION = "explicit-work-primary-source-adjudication"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def handles(work: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for entry in work.get("persistentIdentifiers") or []:
        if entry.get("scheme") != "handle":
            continue
        value = entry.get("normalizedValue") or entry.get("rawValue") or ""
        out.add(str(value).replace("https://hdl.handle.net/", "").strip())
    return out


def validate_decisions(
    decisions: dict[str, Any],
    candidate: dict[str, Any],
    registry: dict[str, Any],
) -> None:
    if decisions.get("schemaVersion") != SCHEMA:
        raise ValueError("Invalid work-level admission decision schema")
    if decisions.get("targetScope") != "humanities-only":
        raise ValueError("Only humanities-only decisions are supported")
    if decisions.get("sourceProgramAuthorityRevision") != registry.get(
        "registryRevision"
    ):
        raise ValueError("Program Authority revision mismatch")
    approval = decisions.get("approval") or {}
    if (
        approval.get("pullRequest") != 158
        or approval.get("merged") is not True
        or approval.get("mergeCommitSha")
        != "71f58709f727d7e7b3b081bc5bc3e89cb75b3ce3"
        or approval.get("approvedHeadSha")
        != "eb73b297c6eedd13f70e71fde9d5a763e135e350"
    ):
        raise ValueError("Explicit human merge provenance absent or wrong")
    if (
        candidate.get("schemaVersion")
        != "thesis-boundary-work-adjudication-batch-v1"
        or candidate.get("batchId") != "estudios-genero-001"
        or candidate.get("decisionConstraint")
        != "batch-does-not-change-admission"
        or candidate.get("humanValidationRequired") is not True
    ):
        raise ValueError("Approved candidate batch contract mismatch")
    rows = decisions.get("decisions")
    if not isinstance(rows, list) or not rows:
        raise ValueError("At least one explicit work decision is required")
    if len({row.get("workId") for row in rows}) != len(rows):
        raise ValueError("Duplicate work decision")
    candidates = {row.get("workId"): row for row in candidate.get("works") or []}
    programs = {p.get("id"): p for p in registry.get("programs") or []}
    for row in rows:
        id_ = row.get("workId")
        matched = candidates.get(id_)
        if matched is None or matched.get("candidateDecision") != "include-candidate":
            raise ValueError(f"Missing approved INCLUDE candidate for {id_}")
        if matched.get("primarySourceAccess") != "available":
            raise ValueError(f"Missing available primary source for {id_}")
        if (
            matched.get("candidateDecisionBasis")
            != "official-thesis-fulltext-reviewed"
            or matched.get("humanValidationStatus") != "pending-user-merge"
        ):
            raise ValueError(f"Missing source-grounded adjudication for {id_}")
        if not matched.get("candidateDecisionRationale"):
            raise ValueError(f"Missing candidate rationale for {id_}")
        if row.get("candidateBatchId") != candidate["batchId"]:
            raise ValueError(f"Wrong candidate batch for {id_}")
        if (
            row.get("previousAdmissionStatus") != "review"
            or row.get("newAdmissionStatus") != "include"
        ):
            raise ValueError(f"Unsupported work-level transition for {id_}")
        if row.get("programRef") != candidate.get("programRef"):
            raise ValueError(f"Candidate program mismatch for {id_}")
        if (programs.get(row.get("programRef")) or {}).get(
            "admissionState"
        ) != "review":
            raise ValueError(f"Program authority must remain REVIEW for {id_}")
        for key in ("primarySourceSha256", "primarySourceUrl"):
            if row.get(key) != matched.get(key):
                raise ValueError(f"Primary-source identity mismatch for {id_}")
        if not row.get("rationale"):
            raise ValueError(f"Admission rationale missing for {id_}")
        if row.get("reversal", {}).get("restores") != "review":
            raise ValueError(f"Rollback contract missing for {id_}")


def apply_decisions(
    corpus: dict[str, Any],
    decisions: dict[str, Any],
    candidate: dict[str, Any],
    registry: dict[str, Any],
    *,
    reverse: bool = False,
) -> tuple[dict[str, Any], dict[str, Any]]:
    validate_decisions(decisions, candidate, registry)
    original = corpus.get("works")
    if not isinstance(original, list):
        raise ValueError("Corpus has no works")
    rules = {d["workId"]: d for d in decisions["decisions"]}
    selected = {w.get("id"): w for w in original if w.get("id") in rules}
    if len(selected) != len(rules):
        raise ValueError("Decision work ID absent from corpus")
    output = copy.deepcopy(corpus)
    before = Counter(w.get("admissionStatus") for w in original)
    found = []
    for work in output["works"]:
        rule = rules.get(work.get("id"))
        if rule is None:
            continue
        work_id = work["id"]
        if work.get("programRef") != rule["programRef"]:
            raise ValueError(f"Work program mismatch for {work_id}")
        if rule["handle"] not in handles(work):
            raise ValueError(f"Handle mismatch for {work_id}")
        if rule["sourceRecordRef"] not in (work.get("sourceRecordRefs") or []):
            raise ValueError(f"Source record mismatch for {work_id}")
        if (work.get("programMetadataEvidence") or {}).get(
            "authorityApplicability"
        ) != "allowed":
            raise ValueError(f"Blocked program evidence for {work_id}")
        if reverse:
            if (
                work.get("admissionStatus") != rule["newAdmissionStatus"]
                or (work.get("workAdmissionDecision") or {}).get("revision")
                != decisions["revision"]
            ):
                raise ValueError(f"Cannot reverse non-matching decision: {work_id}")
            work["admissionStatus"] = rule["previousAdmissionStatus"]
            work["admissionExplanationCodes"] = ["program-review"]
            work.pop("workAdmissionDecision", None)
        else:
            if work.get("admissionStatus") != rule["previousAdmissionStatus"]:
                raise ValueError(f"Source work is not REVIEW: {work_id}")
            work["admissionStatus"] = rule["newAdmissionStatus"]
            work["admissionExplanationCodes"] = [DECISION_EXPLANATION]
            work["workAdmissionDecision"] = {
                "revision": decisions["revision"],
                "sourceProgramAuthority": rule["programRef"],
                "candidateBatchId": rule["candidateBatchId"],
                "sourceSha256": rule["primarySourceSha256"],
                "approvalPullRequest": decisions["approval"]["pullRequest"],
                "approvalMergeSha": decisions["approval"]["mergeCommitSha"],
                "previousStatus": rule["previousAdmissionStatus"],
                "newStatus": rule["newAdmissionStatus"],
            }
        found.append(work_id)
    if len(found) != len(rules):
        raise ValueError("Not all work decisions were applied")
    after = Counter(w.get("admissionStatus") for w in output["works"])
    delta = {key: after[key] - before[key] for key in sorted(before | after)}
    expected = {"include": -1 if reverse else 1, "review": 1 if reverse else -1}
    if {k: v for k, v in delta.items() if v} != expected:
        raise ValueError(f"Unexpected admission delta: {delta}")
    if len(output["works"]) != len(original):
        raise ValueError("Corpus cardinality changed")
    output["workAdmissionDecisionRevision"] = (
        None if reverse else decisions["revision"]
    )
    metrics = dict(output.get("metrics") or {})
    metrics["worksByAdmission"] = dict(sorted(after.items()))
    output["metrics"] = metrics
    report = {
        "schemaVersion": "thesis-work-admission-activation-report-v1",
        "revision": decisions["revision"],
        "mode": "reverse" if reverse else "apply",
        "approvedMergeSha": decisions["approval"]["mergeCommitSha"],
        "selectedWorkIds": sorted(found),
        "beforeAdmission": dict(sorted(before.items())),
        "afterAdmission": dict(sorted(after.items())),
        "admissionDelta": {k: v for k, v in delta.items() if v},
        "programAuthorityUnchanged": True,
        "sourceWorks": len(original),
        "outputWorks": len(output["works"]),
    }
    return output, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus", type=Path, required=True)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--decisions", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--output-corpus", type=Path, required=True)
    parser.add_argument("--output-report", type=Path, required=True)
    parser.add_argument("--reverse", action="store_true")
    args = parser.parse_args()
    output, report = apply_decisions(
        read_json(args.corpus),
        read_json(args.decisions),
        read_json(args.candidate),
        read_json(args.registry),
        reverse=args.reverse,
    )
    write_json(args.output_corpus, output)
    write_json(args.output_report, report)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2))


if __name__ == "__main__":
    main()

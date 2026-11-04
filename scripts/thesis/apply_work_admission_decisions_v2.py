#!/usr/bin/env python3
"""T2CC: reversible work-level admissions with approval provenance per decision.

Input is the immutable effective corpus V1, not the program-only projection.
The historical T2BX work is validated and preserved byte-for-byte as a work
object; only the explicitly authorized DCTS work may change. This module
does not publish or overwrite any GitHub release.
"""
from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = "thesis-work-admission-decisions-v2"
CANDIDATE_SCHEMA = "thesis-boundary-work-adjudication-batch-v1"
DECISION_EXPLANATION = "explicit-work-primary-source-adjudication"
HEX40 = re.compile(r"^[0-9a-f]{40}$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def read_json(path: Path) -> dict[str, Any]:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as stream:
            return json.load(stream)
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def handle_ids(work: dict[str, Any]) -> set[str]:
    result: set[str] = set()
    for entry in work.get("persistentIdentifiers") or []:
        if entry.get("scheme") != "handle":
            continue
        value = entry.get("normalizedValue") or entry.get("rawValue") or ""
        result.add(str(value).removeprefix("https://hdl.handle.net/").strip())
    return result


def load_candidates(decisions: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Load exact candidate configs under the repository, never arbitrary paths."""
    result = {}
    root = (ROOT / "scripts" / "thesis" / "config").resolve()
    for row in decisions.get("decisions") or []:
        name = row.get("candidateConfig")
        if not isinstance(name, str) or not name.startswith("scripts/thesis/config/"):
            raise ValueError("Candidate config path is not an approved repo path")
        path = (ROOT / name).resolve()
        if path.parent != root or path.suffix != ".json":
            raise ValueError("Candidate config must be an exact config file")
        result[name] = read_json(path)
    return result


def validate_contract(
    contract: dict[str, Any],
    registry: dict[str, Any],
    candidates: dict[str, dict[str, Any]],
) -> None:
    if contract.get("schemaVersion") != SCHEMA:
        raise ValueError("Unsupported per-work decision schema")
    if contract.get("targetScope") != "humanities-only":
        raise ValueError("Work decisions must remain humanities-only")
    if contract.get("decisionPolicy") != (
        "decision-scoped-approved-primary-source-provenance-only"
    ):
        raise ValueError("Per-work approval policy missing")
    if contract.get("sourceProgramAuthorityRevision") != registry.get(
        "registryRevision"
    ):
        raise ValueError("Program Authority revision mismatch")
    if contract.get("sourceScopePolicyRevision") != "2026-11-02.v5":
        raise ValueError("Scope Policy V5 invariant lost")
    if contract.get("sourceMetadataConfidenceRevision") != "2026-11-02.v5":
        raise ValueError("Metadata Confidence V5 invariant lost")
    if contract.get("sourceWorkReviewPolicyRevision") != "2026-11-03.boundary-v4":
        raise ValueError("Boundary Work Review policy invariant lost")
    release = contract.get("baseEffectiveRelease") or {}
    if release.get("tag") != "thesis-effective-corpus-v1":
        raise ValueError("Only immutable release V1 is an approved base")
    if release.get("jsonSha256") != (
        "0a4d24810d90f8e4c748abd0c8f3978afba6561eade46fcbf29f2bda6416b892"
    ):
        raise ValueError("Immutable V1 payload identity mismatch")
    if release.get("effectiveAdmissionRevision") != "2026-11-03.t2bx-v1":
        raise ValueError("T2BX legacy revision must remain intact")
    if not isinstance(contract.get("revision"), str) or not contract["revision"]:
        raise ValueError("Decision registry revision missing")

    rows = contract.get("decisions")
    if not isinstance(rows, list) or not rows:
        raise ValueError("At least one decision is required")
    ids = [row.get("workId") for row in rows]
    if any(not isinstance(work_id, str) or not work_id for work_id in ids):
        raise ValueError("Exact work ID required")
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate work decision")
    authorities = {item.get("id"): item for item in registry.get("programs") or []}
    if {row.get("activation") for row in rows} != {
        "preserve-approved", "activate-now"
    }:
        raise ValueError("Expected preserved T2BX and one new activation")
    expected = contract.get("expected") or {}
    apply_ids = sorted(
        row["workId"] for row in rows if row["activation"] == "activate-now"
    )
    preserve_ids = sorted(
        row["workId"] for row in rows if row["activation"] == "preserve-approved"
    )
    if (apply_ids != expected.get("changedWorkIds")
        or preserve_ids != expected.get("preservedActiveWorkIds")):
        raise ValueError("Selected work set differs from reviewed T2CC contract")
    if apply_ids != ["thesis:work:00024461"]:
        raise ValueError("T2CC may activate only DCTS work 00024461")
    if preserve_ids != ["thesis:work:00002062"]:
        raise ValueError("T2BX historical work must be preserved")
    for row in rows:
        wid = row["workId"]
        if (
            row.get("previousAdmissionStatus") != "review"
            or row.get("newAdmissionStatus") != "include"
        ):
            raise ValueError(f"Unsupported transition for {wid}")
        if row.get("reversal", {}).get("restores") != "review":
            raise ValueError(f"Rollback contract missing for {wid}")
        if not row.get("rationale"):
            raise ValueError(f"Admission rationale missing for {wid}")
        if not isinstance(row.get("sourceRecordRef"), str):
            raise ValueError(f"Exact SourceRecordRef required for {wid}")
        if not HEX64.fullmatch(str(row.get("primarySourceSha256"))):
            raise ValueError(f"Official primary source SHA-256 missing for {wid}")
        approval = row.get("approval") or {}
        if (
            approval.get("merged") is not True
            or not isinstance(approval.get("pullRequest"), int)
            or not HEX40.fullmatch(str(approval.get("mergeCommitSha")))
            or not HEX40.fullmatch(str(approval.get("approvedHeadSha")))
            or approval.get("approvalMeaning")
            != "manual-merge-of-evidence-grounded-include-candidate"
        ):
            raise ValueError(f"Human merge approval missing for {wid}")
        if (authorities.get(row.get("programRef")) or {}).get(
            "admissionState"
        ) != "review":
            raise ValueError(f"Program Authority must remain REVIEW for {wid}")

        batch = candidates.get(row.get("candidateConfig")) or {}
        if (
            batch.get("schemaVersion") != CANDIDATE_SCHEMA
            or batch.get("batchId") != row.get("candidateBatchId")
            or batch.get("programRef") != row.get("programRef")
            or batch.get("workReviewPolicyRevision")
            != contract.get("sourceWorkReviewPolicyRevision")
            or batch.get("decisionConstraint") != "batch-does-not-change-admission"
            or batch.get("humanValidationRequired") is not True
        ):
            raise ValueError(f"Candidate batch provenance mismatch for {wid}")
        candidates_for_work = [
            item for item in batch.get("works") or []
            if item.get("workId") == wid
        ]
        if len(candidates_for_work) != 1:
            raise ValueError(f"Expected one exact candidate for {wid}")
        candidate = candidates_for_work[0]
        if (
            candidate.get("candidateDecision") != "include-candidate"
            or candidate.get("primarySourceAccess") != "available"
            or candidate.get("candidateDecisionBasis")
            != "official-thesis-fulltext-reviewed"
            or candidate.get("humanValidationStatus") != "pending-user-merge"
            or not candidate.get("candidateDecisionRationale")
        ):
            raise ValueError(f"Missing approved official full-text candidate: {wid}")
        if (
            candidate.get("primarySourceSha256") != row["primarySourceSha256"]
            or candidate.get("primarySourceUrl") != row.get("primarySourceUrl")
            or candidate.get("handle")
            != "https://hdl.handle.net/" + row.get("handle", "")
        ):
            raise ValueError(f"Primary-source identity mismatch for {wid}")

        if row["activation"] == "preserve-approved":
            if (
                wid != "thesis:work:00002062"
                or row.get("decisionRevision") != release["effectiveAdmissionRevision"]
                or approval.get("pullRequest") != 158
            ):
                raise ValueError("Legacy T2BX approval identity changed")
        else:
            if (
                wid != "thesis:work:00024461"
                or row.get("decisionRevision") != contract["revision"]
                or approval.get("pullRequest") != 163
            ):
                raise ValueError("New DCTS approval identity changed")

    retained = contract.get("retainReviewGuarantee") or {}
    if (
        retained.get("workId") != "thesis:work:00024462"
        or retained.get("admissionStatus") != "review"
        or retained.get("candidateDecision") != "retain-review"
        or retained.get("workId") in ids
    ):
        raise ValueError("DCTS retain-REVIEW protection missing")
    dcts_batch = next(
        candidates[row["candidateConfig"]]
        for row in rows if row["activation"] == "activate-now"
    )
    if (
        dcts_batch.get("batchId") != retained.get("candidateBatchId")
        or dcts_batch.get("programRef") != retained.get("programRef")
        or len([
            item for item in dcts_batch["works"]
            if item.get("workId") == retained["workId"]
            and item.get("candidateDecision") == "retain-review"
            and item.get("candidateDecisionBasis") == "official-thesis-fulltext-reviewed"
        ]) != 1
    ):
        raise ValueError("Approved retain-review decision not found")


def validate_work_identity(
    work: dict[str, Any],
    row: dict[str, Any],
    source_records: dict[str, dict[str, Any]],
) -> None:
    wid = row["workId"]
    if work.get("id") != wid or work.get("programRef") != row["programRef"]:
        raise ValueError(f"Work/program mismatch for {wid}")
    if row["handle"] not in handle_ids(work):
        raise ValueError(f"Handle mismatch for {wid}")
    if row["sourceRecordRef"] not in (work.get("sourceRecordRefs") or []):
        raise ValueError(f"SourceRecordRef mismatch for {wid}")
    evidence = work.get("programMetadataEvidence") or {}
    if evidence.get("authorityApplicability") != "allowed":
        raise ValueError(f"Blocked metadata evidence for {wid}")
    provider_id = "oai:riudg.udg.mx:" + row["handle"]
    expected_source_id = (
        "source:thesis:riudg:"
        + hashlib.sha256(provider_id.encode("utf-8")).hexdigest()[:20]
    )
    if row["sourceRecordRef"] != expected_source_id:
        raise ValueError(f"SourceRecordRef hash mismatch for {wid}")
    source = source_records.get(row["sourceRecordRef"])
    if (
        source is None
        or source.get("provider") != "riudg"
        or source.get("providerRecordId") != provider_id
    ):
        raise ValueError(f"Missing exact institutional SourceRecord for {wid}")


def validate_active_provenance(
    work: dict[str, Any], row: dict[str, Any]
) -> None:
    provenance = work.get("workAdmissionDecision") or {}
    approval = row["approval"]
    required = {
        "revision": row["decisionRevision"],
        "sourceProgramAuthority": row["programRef"],
        "candidateBatchId": row["candidateBatchId"],
        "sourceSha256": row["primarySourceSha256"],
        "approvalPullRequest": approval["pullRequest"],
        "approvalMergeSha": approval["mergeCommitSha"],
        "previousStatus": row["previousAdmissionStatus"],
        "newStatus": row["newAdmissionStatus"],
    }
    if any(provenance.get(k) != v for k, v in required.items()):
        raise ValueError(f"Active decision provenance mismatch: {row['workId']}")
    if (
        work.get("admissionStatus") != "include"
        or work.get("admissionExplanationCodes") != [DECISION_EXPLANATION]
    ):
        raise ValueError(f"Active admission status mismatch: {row['workId']}")


def apply_decisions_v2(
    corpus: dict[str, Any],
    contract: dict[str, Any],
    registry: dict[str, Any],
    candidates: dict[str, dict[str, Any]],
    *,
    reverse: bool = False,
) -> tuple[dict[str, Any], dict[str, Any]]:
    validate_contract(contract, registry, candidates)
    works = corpus.get("works")
    if not isinstance(works, list):
        raise ValueError("Corpus must contain work objects")
    source_records = {
        item["id"]: item for item in corpus.get("sourceRecords") or []
    }
    if len(source_records) != len(corpus.get("sourceRecords") or []):
        raise ValueError("Ambiguous SourceRecord identity")
    selected = {row["workId"]: row for row in contract["decisions"]}
    indexed = {work.get("id"): work for work in works if work.get("id") in selected}
    if set(indexed) != set(selected):
        raise ValueError("Exact decision work ID absent from input corpus")
    retained = contract["retainReviewGuarantee"]["workId"]
    retained_works = [work for work in works if work.get("id") == retained]
    if len(retained_works) != 1 or retained_works[0].get("admissionStatus") != "review":
        raise ValueError("Retain-review DCTS work is missing or not REVIEW")

    base = contract["baseEffectiveRelease"]
    if reverse:
        if (
            corpus.get("effectiveCorpusSchemaVersion")
            != "thesis-effective-corpus-v2"
            or corpus.get("effectiveAdmissionRevision") != contract["revision"]
            or corpus.get("workAdmissionDecisionRevision") != contract["revision"]
            or corpus.get("effectiveCorpusBaseRelease") != base["tag"]
        ):
            raise ValueError("Cannot reverse a non-matching T2CC snapshot")
    else:
        if (
            corpus.get("effectiveCorpusSchemaVersion")
            != "thesis-effective-corpus-v1"
            or corpus.get("effectiveAdmissionRevision")
            != base["effectiveAdmissionRevision"]
            or corpus.get("workAdmissionDecisionRevision")
            != base["effectiveAdmissionRevision"]
        ):
            raise ValueError("Input must be the unmodified effective corpus V1")

    expected = contract["expected"]
    before = dict(sorted(Counter(w.get("admissionStatus") for w in works).items()))
    input_counts = (
        expected["outputAdmission"] if reverse else expected["inputAdmission"]
    )
    if (
        len(works) != expected["sourceWorks"]
        or before != input_counts
    ):
        raise ValueError("Unexpected input work count or admission projection")

    output = copy.deepcopy(corpus)
    for work in output["works"]:
        row = selected.get(work.get("id"))
        if not row:
            continue
        validate_work_identity(work, row, source_records)
        if row["activation"] == "preserve-approved":
            validate_active_provenance(work, row)
            continue
        if reverse:
            validate_active_provenance(work, row)
            work["admissionStatus"] = "review"
            work["admissionExplanationCodes"] = ["program-review"]
            work.pop("workAdmissionDecision")
        else:
            if (
                work.get("admissionStatus") != "review"
                or work.get("workAdmissionDecision")
            ):
                raise ValueError(f"Work is not a clean REVIEW: {row['workId']}")
            approval = row["approval"]
            work["admissionStatus"] = "include"
            work["admissionExplanationCodes"] = [DECISION_EXPLANATION]
            work["workAdmissionDecision"] = {
                "revision": row["decisionRevision"],
                "sourceProgramAuthority": row["programRef"],
                "candidateBatchId": row["candidateBatchId"],
                "sourceSha256": row["primarySourceSha256"],
                "approvalPullRequest": approval["pullRequest"],
                "approvalMergeSha": approval["mergeCommitSha"],
                "previousStatus": row["previousAdmissionStatus"],
                "newStatus": row["newAdmissionStatus"],
                "approvedHeadSha": approval["approvedHeadSha"],
                "sourceRecordRef": row["sourceRecordRef"],
            }

    changed = [
        newer["id"]
        for older, newer in zip(works, output["works"], strict=True)
        if older != newer
    ]
    if sorted(changed) != expected["changedWorkIds"]:
        raise ValueError(f"Changed work set is not exact: {changed}")
    if output["works"][works.index(retained_works[0])] != retained_works[0]:
        raise ValueError("Retain-review thesis was mutated")

    after = dict(sorted(Counter(w.get("admissionStatus") for w in output["works"]).items()))
    target_counts = (
        expected["inputAdmission"] if reverse else expected["outputAdmission"]
    )
    if after != target_counts:
        raise ValueError(f"Unexpected effective admission counts: {after}")
    delta = {key: after.get(key, 0) - before.get(key, 0) for key in set(before) | set(after)}
    delta = {key: delta[key] for key in sorted(delta) if delta[key]}
    if delta != ({"include": -1, "review": 1} if reverse else {"include": 1, "review": -1}):
        raise ValueError("Unexpected work-level admission delta")

    version = (
        base["effectiveAdmissionRevision"] if reverse else contract["revision"]
    )
    output["effectiveCorpusSchemaVersion"] = (
        "thesis-effective-corpus-v1" if reverse else "thesis-effective-corpus-v2"
    )
    output["effectiveAdmissionRevision"] = version
    output["workAdmissionDecisionRevision"] = version
    if reverse:
        output.pop("effectiveCorpusBaseRelease", None)
    else:
        output["effectiveCorpusBaseRelease"] = base["tag"]
    metrics = dict(output.get("metrics") or {})
    metrics["worksByAdmission"] = after
    output["metrics"] = metrics
    report = {
        "schemaVersion": "thesis-work-admission-activation-report-v2",
        "revision": contract["revision"],
        "mode": "reverse" if reverse else "apply",
        "baseRelease": base["tag"],
        "selectedWorkIds": sorted(changed),
        "preservedApprovedWorkIds": expected["preservedActiveWorkIds"],
        "retainReviewWorkId": retained,
        "beforeAdmission": before,
        "afterAdmission": after,
        "admissionDelta": delta,
        "approvals": {
            row["workId"]: {
                "pullRequest": row["approval"]["pullRequest"],
                "mergeCommitSha": row["approval"]["mergeCommitSha"],
                "approvedHeadSha": row["approval"]["approvedHeadSha"],
            }
            for row in contract["decisions"]
        },
        "programAuthorityMutated": False,
        "sourceWorks": len(works),
        "outputWorks": len(output["works"]),
        "publicationStatus": "artifact-only-not-production",
    }
    return output, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus", type=Path, required=True)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--decisions", type=Path, required=True)
    parser.add_argument("--output-corpus", type=Path, required=True)
    parser.add_argument("--output-report", type=Path, required=True)
    parser.add_argument("--reverse", action="store_true")
    args = parser.parse_args()
    contract = read_json(args.decisions)
    output, report = apply_decisions_v2(
        read_json(args.corpus),
        contract,
        read_json(args.registry),
        load_candidates(contract),
        reverse=args.reverse,
    )
    write_json(args.output_corpus, output)
    write_json(args.output_report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

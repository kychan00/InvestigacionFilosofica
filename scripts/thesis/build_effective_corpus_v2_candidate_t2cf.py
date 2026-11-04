#!/usr/bin/env python3
"""T2CF: compose an auditable Effective Corpus V2 candidate from approved inputs.

The candidate is built from the immutable Effective Corpus V1, then:
1. applies the already-approved T2CC DCTS work-level decision; and
2. adds the four exact-program Philosophy works approved by T2CE.

It does not create or overwrite a GitHub release and it does not publish Pages.
The curated interdisciplinary Philosophy view remains separate from canonical
admission.
"""
from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import io
import json
from collections import Counter
from pathlib import Path
from typing import Any

import apply_work_admission_decisions_v2 as admissions
import build_canonical_corpus_v1 as canonical
import harvest_cucsh_philosophy_v1 as philosophy_source

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONTRACT = (
    ROOT / "scripts/thesis/config/effective-corpus-v2-candidate-t2cf.json"
)
DEFAULT_REGISTRY = ROOT / "scripts/thesis/config/program-authority-v1.json"
FORBIDDEN_URL_TOKENS = (".pdf", "/bitstream", "/download")


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


def canonical_json_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def write_deterministic_gzip(path: Path, payload: dict[str, Any]) -> str:
    encoded = canonical_json_bytes(payload)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(
            fileobj=raw,
            mode="wb",
            compresslevel=9,
            mtime=0,
            filename="",
        ) as stream:
            stream.write(encoded)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize(value: Any) -> str:
    return canonical.normalize_key(canonical.clean_text(value))


def year(value: Any) -> str:
    text = str(value or "")
    return text[:4] if len(text) >= 4 and text[:4].isdigit() else ""


def first_author(contributions: list[dict[str, Any]]) -> str:
    for item in contributions:
        if item.get("role") == "thesis-author":
            return normalize(item.get("normalizedName") or item.get("rawName"))
    return ""


def work_key(work: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        normalize(work.get("title")),
        first_author(work.get("contributions") or []),
        str(work.get("programRef") or ""),
        year((work.get("date") or {}).get("value")),
    )


def candidate_key(candidate: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        normalize(candidate.get("title")),
        first_author(candidate.get("contributions") or []),
        str((candidate.get("program") or {}).get("programRef") or ""),
        year((candidate.get("date") or {}).get("value")),
    )


def validate_base_bytes(path: Path, contract: dict[str, Any]) -> None:
    base = contract["baseEffectiveRelease"]
    blob = path.read_bytes()
    if path.suffix != ".gz":
        raise ValueError("T2CF requires the immutable V1 gzip asset")
    if hashlib.sha256(blob).hexdigest() != base["gzipSha256"]:
        raise ValueError("Immutable V1 gzip SHA-256 mismatch")
    raw = gzip.decompress(blob)
    if hashlib.sha256(raw).hexdigest() != base["jsonSha256"]:
        raise ValueError("Immutable V1 JSON SHA-256 mismatch")


def validate_contract(
    contract: dict[str, Any],
    registry: dict[str, Any],
    dcts: dict[str, Any],
    supplement: dict[str, Any],
) -> None:
    if contract.get("schemaVersion") != (
        "thesis-effective-corpus-v2-candidate-contract-v1"
    ):
        raise ValueError("Unsupported T2CF candidate contract")
    if contract.get("publicationState") != "candidate-not-release":
        raise ValueError("T2CF must remain candidate-only")
    if contract.get("targetScope") != "humanities-only":
        raise ValueError("T2CF scope must remain humanities-only")
    if registry.get("registryRevision") != contract.get(
        "programAuthorityRevision"
    ):
        raise ValueError("Program Authority revision mismatch")
    if dcts.get("revision") != contract["dcts"]["decisionRevision"]:
        raise ValueError("T2CC decision revision mismatch")
    if supplement.get("revision") != contract["philosophy"]["supplementRevision"]:
        raise ValueError("T2CE Philosophy supplement revision mismatch")
    if len(supplement.get("seedRecords") or []) != contract["philosophy"][
        "expectedSeedRecords"
    ]:
        raise ValueError("Unexpected Philosophy seed cardinality")
    observed_provider_ids = sorted(
        row["providerRecordId"] for row in supplement.get("seedRecords") or []
    )
    if observed_provider_ids != sorted(
        contract["philosophy"]["expectedProviderRecordIds"]
    ):
        raise ValueError("Philosophy seed identity set changed")
    if supplement.get("targetProgramRefs") != contract["philosophy"][
        "targetProgramRefs"
    ]:
        raise ValueError("Philosophy Program Authority target set changed")
    invariants = contract.get("invariants") or {}
    if not all(
        invariants.get(key) is True
        for key in (
            "referenceOnly",
            "canonicalProgramTruthPreserved",
            "curatedInterdisciplinaryViewNotCanonicalized",
            "immutableV1NotMutated",
            "programAuthorityNotMutated",
            "noReleasePublication",
            "noPagesPublication",
        )
    ):
        raise ValueError("T2CF publication/scope invariants are incomplete")


def recompute_metrics(corpus: dict[str, Any]) -> dict[str, Any]:
    works = corpus.get("works") or []
    sources = corpus.get("sourceRecords") or []
    identity = corpus.get("identityDecisions") or []
    return {
        "sourceRecords": len(sources),
        "works": len(works),
        "worksByAdmission": dict(
            sorted(Counter(work.get("admissionStatus") for work in works).items())
        ),
        "providers": dict(
            sorted(Counter(row.get("provider") for row in sources).items())
        ),
        "dateQuality": dict(
            sorted(
                Counter(
                    (work.get("date") or {}).get("quality")
                    for work in works
                ).items()
            )
        ),
        "identityDecisions": dict(
            sorted(Counter(item.get("status") for item in identity).items())
        ),
        "metadataQualityFlags": dict(
            sorted(
                Counter(
                    flag
                    for work in works
                    for flag in work.get("metadataQualityFlags", [])
                ).items()
            )
        ),
        "programMetadataConfidenceStates": dict(
            sorted(
                Counter(
                    (work.get("programMetadataEvidence") or {}).get(
                        "confidenceState"
                    )
                    or "unassessed"
                    for work in works
                ).items()
            )
        ),
        "programAuthorityApplicability": dict(
            sorted(
                Counter(
                    (work.get("programMetadataEvidence") or {}).get(
                        "authorityApplicability"
                    )
                    or "allowed"
                    for work in works
                ).items()
            )
        ),
    }


def validate_reference_only(record: dict[str, Any]) -> None:
    url = str(record.get("recordUrl") or "")
    decoded = __import__("urllib.parse", fromlist=["unquote"]).unquote(url).casefold()
    if not decoded.startswith("https://"):
        raise ValueError(f"Non-HTTPS Philosophy reference: {url}")
    if any(token in decoded for token in FORBIDDEN_URL_TOKENS):
        raise ValueError(f"Full-text-like Philosophy reference URL: {url}")
    for key in (record.get("rawFields") or {}):
        if any(
            marker in key.casefold()
            for marker in ("fulltext", "full_text", "bitstream", "filecontent")
        ):
            raise ValueError(f"Full-text-like metadata field: {key}")


def compose_candidate(
    base: dict[str, Any],
    contract: dict[str, Any],
    registry: dict[str, Any],
    dcts_contract: dict[str, Any],
    philosophy_supplement: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    validate_contract(
        contract,
        registry,
        dcts_contract,
        philosophy_supplement,
    )
    expected_base = contract["baseEffectiveRelease"]
    if (
        base.get("effectiveCorpusSchemaVersion") != "thesis-effective-corpus-v1"
        or len(base.get("works") or []) != expected_base["works"]
        or dict(
            sorted(
                Counter(
                    work.get("admissionStatus")
                    for work in base.get("works") or []
                ).items()
            )
        )
        != expected_base["admission"]
    ):
        raise ValueError("Input object is not the contracted immutable V1")

    base_copy = copy.deepcopy(base)
    candidates = admissions.load_candidates(dcts_contract)
    dcts_output, dcts_report = admissions.apply_decisions_v2(
        base,
        dcts_contract,
        registry,
        candidates,
        reverse=False,
    )

    seeds = philosophy_source.load_seeds(
        Path(contract["philosophy"]["supplementConfig"]),
        registry,
    )
    if len(seeds) != contract["philosophy"]["expectedSeedRecords"]:
        raise ValueError("Unexpected loaded Philosophy seed count")

    existing_index: dict[tuple[str, str, str, str], list[dict[str, Any]]] = {}
    for work in dcts_output["works"]:
        existing_index.setdefault(work_key(work), []).append(work)

    prepared: list[dict[str, Any]] = []
    for record in seeds:
        validate_reference_only(record)
        candidate = canonical.canonical_candidate(
            record,
            registry,
            reference_year=2026,
        )
        program_ref = (candidate.get("program") or {}).get("programRef")
        if program_ref not in set(contract["philosophy"]["targetProgramRefs"]):
            raise ValueError(
                f"Philosophy seed left exact approved program scope: "
                f"{record.get('providerRecordId')}"
            )
        if candidate.get("admission", {}).get("status") != "include":
            raise ValueError(
                f"Philosophy seed no longer resolves INCLUDE: "
                f"{record.get('providerRecordId')}"
            )
        key = candidate_key(candidate)
        if not all(key):
            raise ValueError(
                f"Philosophy seed lacks exact bibliographic identity: "
                f"{record.get('providerRecordId')}"
            )
        matches = existing_index.get(key, [])
        if matches:
            raise ValueError(
                "T2CF expects all four approved Philosophy seed works to be "
                f"new relative to V1: {record.get('providerRecordId')}"
            )
        prepared.append(record)

    output = copy.deepcopy(dcts_output)
    delta = canonical.build_corpus(
        prepared,
        registry,
        previous_work_registry=output["workIdRegistry"],
        reference_year=2026,
        build_revision=contract["revision"] + ".philosophy-delta",
    )
    if len(delta["works"]) != contract["philosophy"]["expectedNewWorks"]:
        raise ValueError("Unexpected Philosophy delta cardinality")
    for work in delta["works"]:
        if (
            work.get("programRef")
            not in set(contract["philosophy"]["targetProgramRefs"])
            or work.get("admissionStatus") != "include"
        ):
            raise ValueError("Philosophy delta contains a non-approved work")

    prior_source_ids = {row["id"] for row in output["sourceRecords"]}
    if any(row["id"] in prior_source_ids for row in delta["sourceRecords"]):
        raise ValueError("Philosophy SourceRecord unexpectedly collides with V1")
    output["sourceRecords"].extend(copy.deepcopy(delta["sourceRecords"]))
    output["works"].extend(copy.deepcopy(delta["works"]))
    output["admissionDecisions"].extend(
        copy.deepcopy(delta["admissionDecisions"])
    )
    output["identityDecisions"].extend(copy.deepcopy(delta["identityDecisions"]))
    output["workIdRegistry"] = copy.deepcopy(delta["workIdRegistry"])

    output["effectiveCorpusSchemaVersion"] = "thesis-effective-corpus-v2"
    output["effectiveAdmissionRevision"] = contract["revision"]
    output["workAdmissionDecisionRevision"] = dcts_contract["revision"]
    output["effectiveCorpusBaseRelease"] = expected_base["tag"]
    output["philosophyCompletenessRevision"] = philosophy_supplement["revision"]
    output["effectiveCorpusCandidatePhase"] = contract["phase"]
    output["publicationState"] = "candidate-not-release"
    output["metrics"] = recompute_metrics(output)

    expected = contract["expected"]
    observed_counts = output["metrics"]["worksByAdmission"]
    if len(output["works"]) != expected["works"]:
        raise ValueError(
            f"Unexpected V2 candidate work count: {len(output['works'])}"
        )
    if observed_counts != expected["admission"]:
        raise ValueError(
            f"Unexpected V2 candidate admission counts: {observed_counts}"
        )

    base_by_id = {row["id"]: row for row in base_copy["works"]}
    output_by_id = {row["id"]: row for row in output["works"]}
    base_ids = set(base_by_id)
    if len(base_ids) != expected["baseWorksPreserved"]:
        raise ValueError("Unexpected V1 ID cardinality")
    if not base_ids.issubset(output_by_id):
        raise ValueError("V2 candidate dropped a V1 work")

    changed_existing = sorted(
        work_id
        for work_id in base_ids
        if base_by_id[work_id] != output_by_id[work_id]
    )
    if changed_existing != expected["dctsExistingWorkChanges"]:
        raise ValueError(
            f"Unexpected mutation among V1 works: {changed_existing}"
        )

    new_ids = sorted(set(output_by_id) - base_ids)
    if new_ids != sorted(expected["newWorkIds"]):
        raise ValueError(f"Unexpected new V2 work IDs: {new_ids}")

    dcts_id = contract["dcts"]["activatedWorkId"]
    retain_id = contract["dcts"]["retainReviewWorkId"]
    preserved_id = contract["dcts"]["preservedApprovedWorkId"]
    if output_by_id[dcts_id].get("admissionStatus") != "include":
        raise ValueError("Approved DCTS work was not activated")
    provenance = output_by_id[dcts_id].get("workAdmissionDecision") or {}
    if provenance.get("revision") != dcts_contract["revision"]:
        raise ValueError("DCTS approval provenance lost in V2 composition")
    if output_by_id[retain_id].get("admissionStatus") != "review":
        raise ValueError("Protected DCTS retain-review work changed")
    if output_by_id[preserved_id] != base_by_id[preserved_id]:
        raise ValueError("Previously approved T2BX work changed")

    if output["programAuthorities"] != base_copy["programAuthorities"]:
        raise ValueError("Program Authority mutated in T2CF")
    if output["institutionAuthorities"] != base_copy["institutionAuthorities"]:
        raise ValueError("Institution Authority mutated in T2CF")

    canonical.validate_corpus(output)

    new_works = [
        {
            "workId": work["id"],
            "title": work["title"],
            "programRef": work["programRef"],
            "admissionStatus": work["admissionStatus"],
            "sourceRecordRefs": work["sourceRecordRefs"],
        }
        for work in output["works"]
        if work["id"] in set(new_ids)
    ]
    new_works.sort(key=lambda row: row["workId"])

    report = {
        "schemaVersion": "thesis-effective-corpus-v2-candidate-report-v1",
        "revision": contract["revision"],
        "phase": contract["phase"],
        "publicationState": "candidate-not-release",
        "baseRelease": expected_base["tag"],
        "baseWorks": len(base_copy["works"]),
        "candidateWorks": len(output["works"]),
        "beforeAdmission": expected_base["admission"],
        "afterAdmission": observed_counts,
        "dcts": {
            "report": dcts_report,
            "changedExistingWorkIds": changed_existing,
            "retainReviewWorkId": retain_id,
            "preservedApprovedWorkId": preserved_id,
        },
        "philosophy": {
            "supplementRevision": philosophy_supplement["revision"],
            "approvedByPullRequest": contract["philosophy"]["approval"][
                "pullRequest"
            ],
            "newWorks": new_works,
        },
        "newWorkIds": new_ids,
        "referenceOnly": True,
        "canonicalProgramTruthPreserved": True,
        "curatedInterdisciplinaryViewCanonicalized": False,
        "programAuthorityMutated": False,
        "immutableV1Mutated": False,
        "releasePublished": False,
        "pagesPublishedFromCandidate": False,
    }
    return output, report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", type=Path, required=True)
    parser.add_argument("--contract", type=Path, default=DEFAULT_CONTRACT)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--output-corpus", type=Path, required=True)
    parser.add_argument("--output-gzip", type=Path, required=True)
    parser.add_argument("--output-report", type=Path, required=True)
    parser.add_argument("--output-json-sha", type=Path, required=True)
    parser.add_argument("--output-gzip-sha", type=Path, required=True)
    args = parser.parse_args()

    contract = read_json(args.contract)
    validate_base_bytes(args.base, contract)
    dcts_contract = read_json(Path(contract["dcts"]["decisionsConfig"]))
    philosophy_supplement = read_json(
        Path(contract["philosophy"]["supplementConfig"])
    )
    registry = read_json(args.registry)
    candidate, report = compose_candidate(
        read_json(args.base),
        contract,
        registry,
        dcts_contract,
        philosophy_supplement,
    )

    write_json(args.output_corpus, candidate)
    write_json(args.output_report, report)
    canonical_bytes = canonical_json_bytes(candidate)
    json_sha = hashlib.sha256(canonical_bytes).hexdigest()
    gzip_sha = write_deterministic_gzip(args.output_gzip, candidate)
    args.output_json_sha.parent.mkdir(parents=True, exist_ok=True)
    args.output_json_sha.write_text(json_sha + "\n", encoding="utf-8")
    args.output_gzip_sha.write_text(gzip_sha + "\n", encoding="utf-8")

    summary = {
        "candidateWorks": report["candidateWorks"],
        "afterAdmission": report["afterAdmission"],
        "newWorkIds": report["newWorkIds"],
        "jsonSha256": json_sha,
        "gzipSha256": gzip_sha,
        "publicationState": report["publicationState"],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

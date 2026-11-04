#!/usr/bin/env python3
"""Build and verify immutable Effective Corpus V2 release metadata."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any


MANIFEST_SCHEMA = "thesis-effective-corpus-release-manifest-v2"
CONTRACT_SCHEMA = "thesis-effective-corpus-release-contract-v2"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_gzip_payload(path: Path) -> str:
    digest = hashlib.sha256()
    with gzip.open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_checksum(path: Path) -> str:
    token = path.read_text(encoding="utf-8").strip().split()[0]
    if len(token) != 64:
        raise ValueError(f"Invalid SHA-256 file: {path}")
    return token.lower()


def require_equal(label: str, actual: Any, expected: Any) -> None:
    if actual != expected:
        raise ValueError(f"{label} mismatch: {actual!r} != {expected!r}")


def validate_contract(contract: dict[str, Any]) -> None:
    require_equal("contract schema", contract.get("schemaVersion"), CONTRACT_SCHEMA)
    require_equal("release tag", contract.get("releaseTag"), "thesis-effective-corpus-v2")
    require_equal(
        "base release",
        (contract.get("baseRelease") or {}).get("tag"),
        "thesis-effective-corpus-v1",
    )
    require_equal(
        "candidate revision",
        (contract.get("candidate") or {}).get("revision"),
        contract["effectiveAdmissionRevision"],
    )
    if contract.get("worksTotal") != sum(contract["admissionCounts"].values()):
        raise ValueError("Admission counts do not sum to worksTotal")
    if contract["admissionCounts"].get("include") != 566:
        raise ValueError("T2CG must publish exactly 566 INCLUDE works")
    if contract.get("changedExistingWorkIds") != ["thesis:work:00024461"]:
        raise ValueError("Unexpected existing-work delta")
    if contract.get("newWorkIds") != [
        "thesis:work:00027577",
        "thesis:work:00027578",
        "thesis:work:00027579",
        "thesis:work:00027580",
    ]:
        raise ValueError("Unexpected new-work set")


def validate_candidate(
    corpus: dict[str, Any],
    report: dict[str, Any],
    contract: dict[str, Any],
) -> None:
    validate_contract(contract)
    counts = dict(sorted(Counter(
        work.get("admissionStatus") or "unknown"
        for work in corpus.get("works") or []
    ).items()))

    require_equal(
        "effective corpus schema",
        corpus.get("effectiveCorpusSchemaVersion"),
        contract["effectiveCorpusSchemaVersion"],
    )
    require_equal(
        "program authority revision",
        corpus.get("programAuthorityRevision"),
        contract["programAuthorityRevision"],
    )
    require_equal(
        "metadata confidence revision",
        corpus.get("programMetadataEvidenceRevision"),
        contract["metadataConfidenceRevision"],
    )
    require_equal(
        "effective admission revision",
        corpus.get("effectiveAdmissionRevision"),
        contract["effectiveAdmissionRevision"],
    )
    require_equal(
        "work admission decision revision",
        corpus.get("workAdmissionDecisionRevision"),
        contract["workAdmissionDecisionRevision"],
    )
    require_equal(
        "philosophy completeness revision",
        corpus.get("philosophyCompletenessRevision"),
        contract["philosophyCompletenessRevision"],
    )
    require_equal("work cardinality", len(corpus.get("works") or []), contract["worksTotal"])
    require_equal("admission counts", counts, contract["admissionCounts"])
    require_equal("candidate report revision", report.get("revision"), contract["candidate"]["revision"])
    require_equal("candidate report phase", report.get("phase"), "T2CF")
    require_equal("candidate report state", report.get("publicationState"), "candidate-not-release")
    require_equal("candidate report works", report.get("candidateWorks"), contract["worksTotal"])
    require_equal("candidate report counts", report.get("afterAdmission"), contract["admissionCounts"])
    require_equal(
        "candidate changed existing work IDs",
        ((report.get("dcts") or {}).get("changedExistingWorkIds")),
        contract["changedExistingWorkIds"],
    )
    require_equal("candidate new work IDs", report.get("newWorkIds"), contract["newWorkIds"])
    require_equal("candidate release flag", report.get("releasePublished"), False)
    require_equal("candidate pages flag", report.get("pagesPublishedFromCandidate"), False)

    indexed = {work["id"]: work for work in corpus["works"]}
    for work_id in contract["newWorkIds"]:
        if indexed.get(work_id, {}).get("admissionStatus") != "include":
            raise ValueError(f"New Philosophy work is not INCLUDE: {work_id}")
    if indexed["thesis:work:00024461"].get("admissionStatus") != "include":
        raise ValueError("DCTS approved work was not activated")
    if indexed["thesis:work:00024462"].get("admissionStatus") != "review":
        raise ValueError("Protected DCTS work did not remain REVIEW")
    if indexed["thesis:work:00002062"].get("admissionStatus") != "include":
        raise ValueError("Previously approved T2BX work is no longer INCLUDE")


def validate_root_release_manifest(
    root_manifest: dict[str, Any],
    contract: dict[str, Any],
) -> None:
    thesis = ((root_manifest.get("corpora") or {}).get("thesesHumanities") or {})
    expected = {
        "version": "2",
        "releaseTag": contract["releaseTag"],
        "corpusRevision": contract["revision"],
        "effectiveCorpusSchemaVersion": contract["effectiveCorpusSchemaVersion"],
        "programAuthorityRevision": contract["programAuthorityRevision"],
        "metadataConfidenceRevision": contract["metadataConfidenceRevision"],
        "effectiveAdmissionRevision": contract["effectiveAdmissionRevision"],
        "workAdmissionDecisionRevision": contract["workAdmissionDecisionRevision"],
        "philosophyCompletenessRevision": contract["philosophyCompletenessRevision"],
        "effectiveCorpusJsonSha256": contract["effectiveCorpusJsonSha256"],
        "effectiveCorpusGzipSha256": contract["effectiveCorpusGzipSha256"],
        "records": contract["worksTotal"],
        "admissionCounts": contract["admissionCounts"],
        "publicManifest": contract["publicManifestPath"],
        "publicCorpus": contract["publicCorpusPath"],
    }
    for key, value in expected.items():
        require_equal(f"root manifest {key}", thesis.get(key), value)


def build_manifest(args: argparse.Namespace) -> None:
    contract = read_json(args.contract)
    corpus = read_json(args.corpus_json)
    report = read_json(args.report)
    validate_candidate(corpus, report, contract)

    json_hash = sha256_file(args.corpus_json)
    gzip_hash = sha256_file(args.corpus_gzip)
    gzip_payload_hash = sha256_gzip_payload(args.corpus_gzip)
    require_equal("JSON SHA-256", json_hash, contract["effectiveCorpusJsonSha256"])
    require_equal("gzip payload SHA-256", gzip_payload_hash, contract["effectiveCorpusJsonSha256"])
    require_equal("gzip SHA-256", gzip_hash, contract["effectiveCorpusGzipSha256"])

    manifest = {
        "schemaVersion": MANIFEST_SCHEMA,
        "corpusRevision": contract["revision"],
        "phase": contract["phase"],
        "release": {
            "tag": contract["releaseTag"],
            "title": contract["releaseTitle"],
            "immutable": True,
        },
        "lineage": {
            "baseRelease": contract["baseRelease"],
            "candidate": contract["candidate"],
        },
        "revisions": {
            "effectiveCorpusSchemaVersion": contract["effectiveCorpusSchemaVersion"],
            "programAuthorityRevision": contract["programAuthorityRevision"],
            "metadataConfidenceRevision": contract["metadataConfidenceRevision"],
            "effectiveAdmissionRevision": contract["effectiveAdmissionRevision"],
            "workAdmissionDecisionRevision": contract["workAdmissionDecisionRevision"],
            "philosophyCompletenessRevision": contract["philosophyCompletenessRevision"],
        },
        "effectiveCorpus": {
            "asset": contract["assets"]["corpusGzip"],
            "jsonSha256": json_hash,
            "gzipSha256": gzip_hash,
            "worksTotal": contract["worksTotal"],
            "admissionCounts": contract["admissionCounts"],
            "changedExistingWorkIds": contract["changedExistingWorkIds"],
            "newWorkIds": contract["newWorkIds"],
            "preservedWorkIds": contract["preservedWorkIds"],
        },
        "candidateReport": {
            "asset": contract["assets"]["report"],
            "sha256": sha256_file(args.report),
            "schemaVersion": report.get("schemaVersion"),
            "revision": report.get("revision"),
        },
        "publication": {
            "basePath": contract["publicBasePath"],
            "manifestPath": contract["publicManifestPath"],
            "corpusPath": contract["publicCorpusPath"],
        },
        "generatedFrom": {
            "repository": args.repository,
            "commit": args.generated_from_sha,
            "workflowRun": args.workflow_run,
            "createdAt": args.created_at,
        },
    }
    write_json(args.output_manifest, manifest)
    args.output_json_sha.write_text(
        f"{json_hash}  effective-corpus.json\n",
        encoding="utf-8",
    )
    args.output_gzip_sha.write_text(
        f"{gzip_hash}  {contract['assets']['corpusGzip']}\n",
        encoding="utf-8",
    )


def verify_release(args: argparse.Namespace) -> None:
    contract = read_json(args.contract)
    validate_contract(contract)
    root = args.release_dir
    assets = contract["assets"]
    manifest = read_json(root / assets["manifest"])

    require_equal("manifest schema", manifest.get("schemaVersion"), MANIFEST_SCHEMA)
    require_equal("manifest revision", manifest.get("corpusRevision"), contract["revision"])
    require_equal("manifest phase", manifest.get("phase"), contract["phase"])
    require_equal("manifest tag", (manifest.get("release") or {}).get("tag"), contract["releaseTag"])
    require_equal("manifest immutable", (manifest.get("release") or {}).get("immutable"), True)
    require_equal("manifest base lineage", (manifest.get("lineage") or {}).get("baseRelease"), contract["baseRelease"])
    require_equal("manifest candidate lineage", (manifest.get("lineage") or {}).get("candidate"), contract["candidate"])

    revisions = manifest.get("revisions") or {}
    for key in (
        "effectiveCorpusSchemaVersion",
        "programAuthorityRevision",
        "metadataConfidenceRevision",
        "effectiveAdmissionRevision",
        "workAdmissionDecisionRevision",
        "philosophyCompletenessRevision",
    ):
        require_equal(f"manifest {key}", revisions.get(key), contract[key])

    corpus_asset = root / assets["corpusGzip"]
    require_equal("release gzip hash", sha256_file(corpus_asset), contract["effectiveCorpusGzipSha256"])
    require_equal("release JSON payload hash", sha256_gzip_payload(corpus_asset), contract["effectiveCorpusJsonSha256"])

    effective = manifest.get("effectiveCorpus") or {}
    require_equal("manifest JSON hash", effective.get("jsonSha256"), contract["effectiveCorpusJsonSha256"])
    require_equal("manifest gzip hash", effective.get("gzipSha256"), contract["effectiveCorpusGzipSha256"])
    require_equal("manifest works", effective.get("worksTotal"), contract["worksTotal"])
    require_equal("manifest counts", effective.get("admissionCounts"), contract["admissionCounts"])
    require_equal("manifest changed existing", effective.get("changedExistingWorkIds"), contract["changedExistingWorkIds"])
    require_equal("manifest new works", effective.get("newWorkIds"), contract["newWorkIds"])
    require_equal("manifest preserved works", effective.get("preservedWorkIds"), contract["preservedWorkIds"])

    report_asset = root / assets["report"]
    report = read_json(report_asset)
    require_equal("report SHA-256", sha256_file(report_asset), (manifest.get("candidateReport") or {}).get("sha256"))
    require_equal("report revision", report.get("revision"), contract["candidate"]["revision"])
    require_equal("report works", report.get("candidateWorks"), contract["worksTotal"])
    require_equal("report counts", report.get("afterAdmission"), contract["admissionCounts"])

    publication = manifest.get("publication") or {}
    require_equal("manifest public base", publication.get("basePath"), contract["publicBasePath"])
    require_equal("manifest public manifest", publication.get("manifestPath"), contract["publicManifestPath"])
    require_equal("manifest public corpus", publication.get("corpusPath"), contract["publicCorpusPath"])

    require_equal(
        "JSON checksum file",
        parse_checksum(root / assets["corpusJsonSha256"]),
        contract["effectiveCorpusJsonSha256"],
    )
    require_equal(
        "gzip checksum file",
        parse_checksum(root / assets["corpusGzipSha256"]),
        contract["effectiveCorpusGzipSha256"],
    )
    if args.root_release_manifest:
        validate_root_release_manifest(read_json(args.root_release_manifest), contract)


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser()
    sub = root.add_subparsers(dest="command", required=True)

    build = sub.add_parser("build-manifest")
    build.add_argument("--contract", type=Path, required=True)
    build.add_argument("--corpus-json", type=Path, required=True)
    build.add_argument("--corpus-gzip", type=Path, required=True)
    build.add_argument("--report", type=Path, required=True)
    build.add_argument("--repository", required=True)
    build.add_argument("--generated-from-sha", required=True)
    build.add_argument("--workflow-run", required=True)
    build.add_argument("--created-at", required=True)
    build.add_argument("--output-manifest", type=Path, required=True)
    build.add_argument("--output-json-sha", type=Path, required=True)
    build.add_argument("--output-gzip-sha", type=Path, required=True)
    build.set_defaults(func=build_manifest)

    verify = sub.add_parser("verify-release")
    verify.add_argument("--contract", type=Path, required=True)
    verify.add_argument("--release-dir", type=Path, required=True)
    verify.add_argument("--root-release-manifest", type=Path)
    verify.set_defaults(func=verify_release)
    return root


def main() -> None:
    args = parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

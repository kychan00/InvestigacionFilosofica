#!/usr/bin/env python3
"""Build and verify the immutable publication contract for the effective thesis corpus."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any


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


def require_equal(label: str, actual: Any, expected: Any) -> None:
    if actual != expected:
        raise ValueError(f"{label} mismatch: {actual!r} != {expected!r}")


def parse_checksum(path: Path) -> str:
    token = path.read_text(encoding="utf-8").strip().split()[0]
    if len(token) != 64:
        raise ValueError(f"Invalid SHA-256 file: {path}")
    return token.lower()


def validate_root_release_manifest(
    root_manifest: dict[str, Any], contract: dict[str, Any]
) -> None:
    thesis = ((root_manifest.get("corpora") or {}).get("thesesHumanities") or {})
    require_equal("root release tag", thesis.get("releaseTag"), contract["releaseTag"])
    require_equal(
        "root corpus revision", thesis.get("corpusRevision"), contract["revision"]
    )
    require_equal(
        "root effective corpus schema",
        thesis.get("effectiveCorpusSchemaVersion"),
        contract["effectiveCorpusSchemaVersion"],
    )
    require_equal(
        "root program authority revision",
        thesis.get("programAuthorityRevision"),
        contract["programAuthorityRevision"],
    )
    require_equal(
        "root metadata confidence revision",
        thesis.get("metadataConfidenceRevision"),
        contract["metadataConfidenceRevision"],
    )
    require_equal(
        "root work admission revision",
        thesis.get("workAdmissionDecisionRevision"),
        contract["workAdmissionDecisionRevision"],
    )
    require_equal(
        "root JSON hash",
        thesis.get("effectiveCorpusJsonSha256"),
        contract["effectiveCorpusJsonSha256"],
    )
    require_equal(
        "root gzip hash",
        thesis.get("effectiveCorpusGzipSha256"),
        contract["effectiveCorpusGzipSha256"],
    )
    require_equal("root records", thesis.get("records"), contract["worksTotal"])
    require_equal(
        "root admission counts",
        thesis.get("admissionCounts"),
        contract["admissionCounts"],
    )
    require_equal(
        "root public manifest",
        thesis.get("publicManifest"),
        contract["publicManifestPath"],
    )
    require_equal(
        "root public corpus",
        thesis.get("publicCorpus"),
        contract["publicCorpusPath"],
    )


def build_manifest(args: argparse.Namespace) -> None:
    contract = read_json(args.contract)
    corpus = read_json(args.corpus_json)
    report = read_json(args.report)

    counts = dict(
        sorted(
            Counter(
                work.get("admissionStatus") or "unknown"
                for work in corpus.get("works") or []
            ).items()
        )
    )
    json_hash = sha256_file(args.corpus_json)
    gzip_hash = sha256_file(args.corpus_gzip)
    gzip_payload_hash = sha256_gzip_payload(args.corpus_gzip)

    require_equal(
        "corpus schema",
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
        report.get("programMetadataEvidenceRevision"),
        contract["metadataConfidenceRevision"],
    )
    require_equal(
        "work admission revision",
        corpus.get("effectiveAdmissionRevision"),
        contract["workAdmissionDecisionRevision"],
    )
    require_equal(
        "work cardinality",
        len(corpus.get("works") or []),
        contract["worksTotal"],
    )
    require_equal("admission counts", counts, contract["admissionCounts"])
    require_equal(
        "changed work IDs",
        report.get("changedWorkIds"),
        contract["changedWorkIds"],
    )
    require_equal(
        "JSON SHA-256",
        json_hash,
        contract["effectiveCorpusJsonSha256"],
    )
    require_equal(
        "gzip payload SHA-256",
        gzip_payload_hash,
        contract["effectiveCorpusJsonSha256"],
    )
    require_equal(
        "gzip SHA-256",
        gzip_hash,
        contract["effectiveCorpusGzipSha256"],
    )

    assets = contract["assets"]
    manifest = {
        "schemaVersion": "thesis-effective-corpus-release-manifest-v1",
        "corpusRevision": contract["revision"],
        "phase": contract["phase"],
        "release": {
            "tag": contract["releaseTag"],
            "title": contract["releaseTitle"],
            "immutable": True,
        },
        "revisions": {
            "effectiveCorpusSchemaVersion": contract[
                "effectiveCorpusSchemaVersion"
            ],
            "programAuthorityRevision": contract["programAuthorityRevision"],
            "metadataConfidenceRevision": contract[
                "metadataConfidenceRevision"
            ],
            "workAdmissionDecisionRevision": contract[
                "workAdmissionDecisionRevision"
            ],
        },
        "source": {
            "artifactId": contract["sourceArtifactId"],
            "canonicalCorpusSha256": contract[
                "sourceCanonicalCorpusSha256"
            ],
            "t2byEvidenceArtifactId": contract["t2byEvidenceArtifactId"],
            "t2byEvidenceArchiveSha256": contract[
                "t2byEvidenceArchiveSha256"
            ],
        },
        "effectiveCorpus": {
            "asset": assets["corpusGzip"],
            "jsonSha256": json_hash,
            "gzipSha256": gzip_hash,
            "worksTotal": contract["worksTotal"],
            "admissionCounts": counts,
            "changedWorkIds": contract["changedWorkIds"],
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
        f"{gzip_hash}  {assets['corpusGzip']}\n",
        encoding="utf-8",
    )


def verify_release(args: argparse.Namespace) -> None:
    contract = read_json(args.contract)
    release_dir = args.release_dir
    assets = contract["assets"]
    manifest = read_json(release_dir / assets["manifest"])

    require_equal(
        "manifest schema",
        manifest.get("schemaVersion"),
        "thesis-effective-corpus-release-manifest-v1",
    )
    require_equal(
        "manifest corpus revision",
        manifest.get("corpusRevision"),
        contract["revision"],
    )
    require_equal("manifest phase", manifest.get("phase"), contract["phase"])
    require_equal(
        "manifest release tag",
        (manifest.get("release") or {}).get("tag"),
        contract["releaseTag"],
    )
    require_equal(
        "manifest immutable flag",
        (manifest.get("release") or {}).get("immutable"),
        True,
    )

    revisions = manifest.get("revisions") or {}
    for key in (
        "effectiveCorpusSchemaVersion",
        "programAuthorityRevision",
        "metadataConfidenceRevision",
        "workAdmissionDecisionRevision",
    ):
        require_equal(f"manifest {key}", revisions.get(key), contract[key])

    source = manifest.get("source") or {}
    require_equal(
        "manifest source artifact",
        source.get("artifactId"),
        contract["sourceArtifactId"],
    )
    require_equal(
        "manifest source corpus hash",
        source.get("canonicalCorpusSha256"),
        contract["sourceCanonicalCorpusSha256"],
    )
    require_equal(
        "manifest T2BY evidence artifact",
        source.get("t2byEvidenceArtifactId"),
        contract["t2byEvidenceArtifactId"],
    )
    require_equal(
        "manifest T2BY evidence digest",
        source.get("t2byEvidenceArchiveSha256"),
        contract["t2byEvidenceArchiveSha256"],
    )

    corpus_asset = release_dir / assets["corpusGzip"]
    gzip_hash = sha256_file(corpus_asset)
    json_hash = sha256_gzip_payload(corpus_asset)
    require_equal(
        "release gzip hash",
        gzip_hash,
        contract["effectiveCorpusGzipSha256"],
    )
    require_equal(
        "release JSON payload hash",
        json_hash,
        contract["effectiveCorpusJsonSha256"],
    )

    effective = manifest.get("effectiveCorpus") or {}
    require_equal(
        "manifest JSON hash",
        effective.get("jsonSha256"),
        contract["effectiveCorpusJsonSha256"],
    )
    require_equal(
        "manifest gzip hash",
        effective.get("gzipSha256"),
        contract["effectiveCorpusGzipSha256"],
    )
    require_equal(
        "manifest works total",
        effective.get("worksTotal"),
        contract["worksTotal"],
    )
    require_equal(
        "manifest admission counts",
        effective.get("admissionCounts"),
        contract["admissionCounts"],
    )
    require_equal(
        "manifest changed works",
        effective.get("changedWorkIds"),
        contract["changedWorkIds"],
    )

    publication = manifest.get("publication") or {}
    require_equal(
        "manifest public base",
        publication.get("basePath"),
        contract["publicBasePath"],
    )
    require_equal(
        "manifest public manifest",
        publication.get("manifestPath"),
        contract["publicManifestPath"],
    )
    require_equal(
        "manifest public corpus",
        publication.get("corpusPath"),
        contract["publicCorpusPath"],
    )

    require_equal(
        "release JSON checksum file",
        parse_checksum(release_dir / assets["corpusJsonSha256"]),
        contract["effectiveCorpusJsonSha256"],
    )
    require_equal(
        "release gzip checksum file",
        parse_checksum(release_dir / assets["corpusGzipSha256"]),
        contract["effectiveCorpusGzipSha256"],
    )
    if args.root_release_manifest:
        validate_root_release_manifest(
            read_json(args.root_release_manifest),
            contract,
        )


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

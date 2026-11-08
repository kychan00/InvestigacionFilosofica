#!/usr/bin/env python3
"""RA12-B3: explicitly publish a fully verified lookup folder to Hugging Face.

Must be run manually with the exact confirmation phrase and HF_TOKEN.
Does not publish Qwen model weights, vectors, or activate the browser Atlas.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

REQUIRED_CONFIG_SCHEMA = "research-atlas-ra12b3-lookup-release-candidate-v1"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--release", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--confirm", required=True,
                        help="Exact workflow-dispatch authorization phrase")
    args = parser.parse_args()
    try:
        config = json.loads(args.config.read_text(encoding="utf-8"))
        if config.get("schemaVersion") != REQUIRED_CONFIG_SCHEMA:
            raise ValueError("Invalid RA12-B3 release configuration")
        details = config["release"]
        source = config["source"]
        corpus = config["corpus"]
        if args.confirm != details["confirmationPhrase"]:
            raise ValueError("Publication not authorized: confirmation phrase missing")
        if details.get("publicationRequiresManualDispatch") is not True:
            raise ValueError("Manual publication policy unexpectedly disabled")
        if details.get("published") is not False or details.get("runtimeEnabled") is not False:
            raise ValueError("Runtime/published state is inconsistent")
        if not args.release.is_dir():
            raise ValueError("Missing prepared release directory")
        provenance = json.loads((args.release / "release-provenance.json").read_text())
        manifest = json.loads((args.release / "lookup-manifest.json").read_text())
        if provenance.get("syntheticFixture") is not False:
            raise ValueError("Synthetic fixture cannot be published")
        if provenance.get("sourceArchiveSha256") != source["archiveSha256"]:
            raise ValueError("Source archive SHA mismatch")
        if provenance.get("targetPrefix") != details["targetPrefix"]:
            raise ValueError("HF prefix mismatch")
        if provenance.get("lookupEntries") != corpus["eligibleWorkIds"]:
            raise ValueError("Expected 451823 OpenAlex lookup entries")
        if manifest["lookup"]["entryCount"] != corpus["eligibleWorkIds"]:
            raise ValueError("Lookup manifest cardinality changed")
        if manifest["lookup"]["ambiguousWorkIdsExcluded"] != 0:
            raise ValueError("Ambiguous IDs cannot be published")
        if manifest["productionEnabled"] is not False:
            raise ValueError("Atlas runtime unexpectedly enabled")
        target = details["targetPrefix"]
        if not target.startswith("research-atlas/qwen3-document-lookup/v1/") or ".." in target:
            raise ValueError("Unsafe publication target")
        local_files = {
            str(file.relative_to(args.release)).replace("\\", "/"): file
            for file in args.release.rglob("*") if file.is_file()
        }
        partitions = manifest["lookup"]["partitions"]
        expected_files = {
            "lookup-manifest.json", "release-provenance.json",
            *(part["path"] for part in partitions)
        }
        if set(local_files) != expected_files:
            raise ValueError("Unexpected or missing local release files")
        for part in partitions:
            if sha256(local_files[part["path"]]) != part["sha256"]:
                raise ValueError("Partition hash changed after preparation")
        token = os.environ.get("HF_TOKEN")
        if not token:
            raise ValueError("HF_TOKEN is not configured in GitHub Actions")
        from huggingface_hub import HfApi, hf_hub_download
        api = HfApi(token=token)
        repo = corpus["repository"]
        repo_type = "dataset"
        # Refuse to mutate an existing publication; no silent overwrite.
        current_files = api.list_repo_files(repo_id=repo, repo_type=repo_type)
        if any(file == target or file.startswith(target + "/") for file in current_files):
            raise ValueError("HF target prefix is already occupied; refusing overwrite")
        commit = api.upload_folder(
            repo_id=repo, repo_type=repo_type,
            folder_path=str(args.release),
            path_in_repo=target,
            commit_message="Publish RA12-B3 document vector lookup validated from GitHub Actions 42439871082"
        )
        oid = getattr(commit, "oid", None)
        if not oid or len(oid) != 40:
            raise ValueError("Hugging Face did not provide an immutable commit OID")
        remote_files = set(api.list_repo_files(repo_id=repo, repo_type=repo_type, revision=oid))
        expected_remote = {target + "/" + name for name in local_files}
        observed_prefix = {path for path in remote_files if path.startswith(target + "/")}
        if observed_prefix != expected_remote:
            raise ValueError("Published HF directory contents differ from submitted files")
        verified = 0
        for name, local in sorted(local_files.items()):
            remote_file = hf_hub_download(
                repo_id=repo, repo_type=repo_type,
                filename=target + "/" + name,
                revision=oid, token=token
            )
            if sha256(Path(remote_file)) != sha256(local):
                raise ValueError("Remote Hugging Face content hash mismatch: " + name)
            verified += 1
        report = {
            "schemaVersion": "research-atlas-ra12b3-hf-publication-result-v1",
            "status": "published-and-verified",
            "dataset": repo,
            "repoType": repo_type,
            "commitOid": oid,
            "targetPrefix": target,
            "immutableResolveBaseUrl": (
                "https://huggingface.co/datasets/" + repo + "/resolve/" + oid + "/" + target
            ),
            "releaseFileCount": verified,
            "lookupDocumentCount": corpus["eligibleWorkIds"],
            "lookupCompressedBytes": corpus["partitionBytes"],
            "sourceArtifactId": source["artifactId"],
            "sourceArtifactZipSha256": source["archiveSha256"],
            "remoteHashVerified": True,
            "atlasRuntimeEnabled": False
        }
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, sort_keys=True, indent=2) + "\n")
        print(json.dumps(report, sort_keys=True))
        return 0
    except (OSError, ValueError, KeyError, TypeError, ImportError) as error:
        print(f"RA12-B3 HF publication ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

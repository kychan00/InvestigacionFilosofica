#!/usr/bin/env python3
"""RA12-C3: manual-only HF publication of the preflight-verified digest tree.

No write on PRs; GitHub workflow_dispatch requires explicit confirmation.
Never publishes original int8 vectors or model weights, and never enables Atlas.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys


class PublicationError(ValueError):
    pass


def sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require(cond, description):
    if not cond:
        raise PublicationError(description)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--config", required=True, type=Path)
    p.add_argument("--release", required=True, type=Path)
    p.add_argument("--confirm", required=True)
    p.add_argument("--report", required=True, type=Path)
    args = p.parse_args()
    try:
        config = json.loads(args.config.read_text())
        require(config.get("schemaVersion") == "research-atlas-ra12c3-digest-publication-candidate-v1",
                "Publication candidate schema differs")
        policy, source, expected = config["publication"], config["source"], config["expected"]
        require(policy["manualDispatchOnly"] is True
                and policy["pullRequestNeverPublishes"] is True
                and policy["runtimeEnabled"] is False
                and policy["published"] is False, "Publication policy violated")
        require(args.confirm == policy["confirmationPhrase"], "Missing explicit publication confirmation")
        require(args.release.is_dir(), "Preflight-verified release directory missing")
        provenance = json.loads((args.release / "release-provenance.json").read_text())
        root = json.loads((args.release / "hash-manifest.json").read_text())
        require(provenance["syntheticFixture"] is False
                and provenance["rootManifestSha256"] == source["hashManifestSha256"]
                and provenance["sourceZipSha256"] == source["artifactZipSha256"]
                and provenance["targetPrefix"] == policy["targetPrefix"]
                and provenance["vectors"] == expected["documentCount"]
                and provenance["hashTiles"] == expected["tileCount"],
                "Release provenance failed")
        require(sha_file(args.release / "hash-manifest.json") == source["hashManifestSha256"],
                "Digest root content hash mismatch")
        require(root["documentCount"] == expected["documentCount"]
                and root["clusterCount"] == expected["clusterCount"]
                and root["tileCount"] == expected["tileCount"]
                and root["digestsBytes"] == expected["digestBytes"]
                and root["productionEnabled"] is False,
                "Root digest tree differs")
        files = {
            file.relative_to(args.release).as_posix(): file
            for file in args.release.rglob("*") if file.is_file()
        }
        inventory = {"hash-manifest.json", "release-provenance.json"}
        for record in root["clusters"]:
            for prop in ("digests", "index"):
                detail = record[prop]
                local = args.release / detail["path"]
                require(local.is_file() and local.stat().st_size == detail["bytes"]
                        and sha_file(local) == detail["sha256"],
                        "Final SHA verification failed: " + detail["path"])
                inventory.add(detail["path"])
        require(set(files) == inventory
                and len(files) == expected["publicationFileCount"],
                "Publication includes unexpected files or omits a digest")
        target = policy["targetPrefix"]
        require(re.fullmatch(
            r"research-atlas/qwen3-document-digests/v1/ra12c2-run[0-9]+", target
        ) is not None, "Unsafe target prefix")
        token = os.environ.get("HF_TOKEN")
        require(bool(token), "HF_TOKEN secret missing; configure it in GitHub Actions")
        from huggingface_hub import HfApi, hf_hub_download
        api = HfApi(token=token)
        repo = policy["dataset"]
        require(repo == "CristianPelayo/openalex-philosophy", "Wrong destination dataset")
        existing = api.list_repo_files(repo_id=repo, repo_type="dataset")
        require(not any(f == target or f.startswith(target + "/") for f in existing),
                "Target prefix already occupied; never overwrite an existing HF release")
        uploaded = api.upload_folder(
            folder_path=str(args.release), repo_id=repo,
            repo_type="dataset", path_in_repo=target,
            commit_message="Publish RA12-C3 authenticated Qwen3 V4 digest tree, source RA12-C2 run 42495212950"
        )
        oid = getattr(uploaded, "oid", "")
        require(re.fullmatch(r"[a-f0-9]{40}", oid or "") is not None,
                "Upload returned no verifiable immutable HF commit")
        listing = set(api.list_repo_files(repo_id=repo, repo_type="dataset", revision=oid))
        names = {target + "/" + name for name in files}
        require({f for f in listing if f.startswith(target + "/")} == names,
                "Remote HF release has missing/extra files")
        for name, local in sorted(files.items()):
            remote = hf_hub_download(repo_id=repo, repo_type="dataset",
                                     filename=target + "/" + name, revision=oid, token=token)
            require(sha_file(Path(remote)) == sha_file(local),
                    "Remote immutable file failed SHA check: " + name)
        report = {
            "schemaVersion": "research-atlas-ra12c3-hf-publication-result-v1",
            "status": "published-and-remotely-verified",
            "repo": repo, "repoType": "dataset", "commitOid": oid,
            "targetPrefix": target,
            "immutableResolveBaseUrl":
                "https://huggingface.co/datasets/" + repo + "/resolve/" + oid + "/" + target,
            "hashManifestSha256": source["hashManifestSha256"],
            "sourceArtifactId": source["artifactId"],
            "sourceArtifactZipSha256": source["artifactZipSha256"],
            "verifiedRemoteFileCount": len(files),
            "verifiedVectors": expected["documentCount"],
            "remoteShaVerified": True,
            "atlasRuntimeEnabled": False
        }
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
        print(json.dumps(report, sort_keys=True))
        return 0
    except (PublicationError, ValueError, OSError, KeyError, TypeError, ImportError) as error:
        print("RA12-C3 publish ERROR:", error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

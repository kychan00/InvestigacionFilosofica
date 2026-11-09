#!/usr/bin/env python3
"""RA12-C5-C: manual-only immutable publication of the exact C5-B overlay release."""
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


def require(value, message):
    if not value:
        raise PublicationError(message)


def sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--config", required=True, type=Path)
    p.add_argument("--release", required=True, type=Path)
    p.add_argument("--confirm", required=True)
    p.add_argument("--report", required=True, type=Path)
    args = p.parse_args()
    try:
        config = json.loads(args.config.read_text(encoding="utf-8"))
        require(config.get("schemaVersion") == "research-atlas-ra12c5c-overlay-publication-candidate-v1",
                "Publication candidate schema differs")
        source, expected = config["source"], config["expected"]
        policy, v4 = config["publication"], config["v4DigestProof"]
        require(policy["manualDispatchOnly"] is True
                and policy["pullRequestNeverPublishes"] is True
                and policy["runtimeEnabled"] is False
                and policy["semanticNeighborEnabled"] is False
                and policy["published"] is False,
                "Publication safety policy violated")
        require(args.confirm == policy["confirmationPhrase"], "Missing explicit publication confirmation")
        require(args.release.is_dir(), "Verified release directory missing")
        provenance = json.loads((args.release / "release-provenance.json").read_text(encoding="utf-8"))
        manifest = json.loads((args.release / "manifest.json").read_text(encoding="utf-8"))
        lookup = json.loads((args.release / "identity-lookup.json").read_text(encoding="utf-8"))
        reference = json.loads((args.release / "browser-reference.json").read_text(encoding="utf-8"))
        require(provenance.get("syntheticFixture") is False
                and provenance.get("sourceZipSha256") == source["artifactZipSha256"]
                and provenance.get("overlayManifestSha256") == source["overlayManifestSha256"]
                and provenance.get("targetPrefix") == policy["targetPrefix"]
                and provenance.get("documents") == expected["documentCount"],
                "Release provenance failed")
        require(manifest.get("documentCount") == expected["documentCount"]
                and manifest.get("dimension") == 1024
                and manifest.get("productionEnabled") is False
                and manifest.get("publishedToHf") is False,
                "Overlay manifest changed")
        require(lookup.get("sourceManifestSha256") == source["overlayManifestSha256"]
                and lookup.get("documentCount") == expected["documentCount"]
                and lookup.get("productionEnabled") is False,
                "Overlay lookup changed")
        require(reference.get("sourceManifestSha256") == source["overlayManifestSha256"]
                and reference.get("productionEnabled") is False,
                "Browser reference changed")
        files = {p.relative_to(args.release).as_posix(): p for p in args.release.rglob("*") if p.is_file()}
        require(len(files) == expected["publicationFileCount"], "Publication file count changed")
        expected_names = {
            "manifest.json", "vectors.i8", "vector-digests.sha256.bin", "vector-index.jsonl.gz",
            "overlay-metadata.jsonl.gz", "v4-compatibility-audit.json", "identity-lookup.json",
            "browser-reference.json", "release-provenance.json"
        }
        require(set(files) == expected_names, "Unexpected/missing release file")
        for name, detail in provenance["files"].items():
            local = files.get(name)
            require(local is not None and local.stat().st_size == detail["bytes"]
                    and sha_file(local) == detail["sha256"], "Release file changed: " + name)
        require(sha_file(files["manifest.json"]) == source["overlayManifestSha256"], "Manifest SHA changed")
        for name, key in (("vectors.i8","vectors"),("vector-digests.sha256.bin","digests"),
                          ("vector-index.jsonl.gz","index"),("overlay-metadata.jsonl.gz","metadata")):
            require(sha_file(files[name]) == expected["artifacts"][key], "Pinned artifact hash changed: " + name)
        target = policy["targetPrefix"]
        require(re.fullmatch(r"research-atlas/qwen3-semantic-overlay/v1/ra12c5b-run[0-9]+", target) is not None,
                "Unsafe overlay target prefix")
        require(re.fullmatch(r"[a-f0-9]{40}", v4["commitOid"]) is not None
                and re.fullmatch(r"[a-f0-9]{64}", v4["rootSha256"]) is not None,
                "Invalid pinned V4 digest publication")
        token = os.environ.get("HF_TOKEN")
        require(bool(token), "HF_TOKEN secret missing")
        from huggingface_hub import HfApi, hf_hub_download
        api = HfApi(token=token)
        repo = policy["dataset"]
        require(repo == "CristianPelayo/openalex-philosophy", "Wrong destination dataset")
        existing = api.list_repo_files(repo_id=repo, repo_type="dataset")
        require(not any(f == target or f.startswith(target + "/") for f in existing),
                "Target prefix already occupied; refusing overwrite")
        commit = api.upload_folder(
            folder_path=str(args.release), repo_id=repo, repo_type="dataset", path_in_repo=target,
            commit_message="Publish RA12-C5-C immutable semantic overlay from exact C5-B artifact 13649068736"
        )
        oid = getattr(commit, "oid", "")
        require(re.fullmatch(r"[a-f0-9]{40}", oid or "") is not None,
                "Upload returned no immutable HF commit OID")
        listing = set(api.list_repo_files(repo_id=repo, repo_type="dataset", revision=oid))
        expected_remote = {target + "/" + name for name in files}
        require({f for f in listing if f.startswith(target + "/")} == expected_remote,
                "Remote overlay file inventory mismatch")
        verified, hashes = 0, {}
        for name, local in sorted(files.items()):
            local_sha = sha_file(local)
            remote = hf_hub_download(repo_id=repo, repo_type="dataset",
                                     filename=target + "/" + name, revision=oid, token=token)
            require(sha_file(Path(remote)) == local_sha, "Remote immutable SHA mismatch: " + name)
            hashes[name] = {"sha256": local_sha, "bytes": local.stat().st_size}
            verified += 1
        report = {
            "schemaVersion": "research-atlas-ra12c5c-hf-publication-result-v1",
            "status": "published-and-remotely-verified",
            "repo": repo, "repoType": "dataset", "commitOid": oid,
            "targetPrefix": target,
            "immutableResolveBaseUrl": "https://huggingface.co/datasets/" + repo + "/resolve/" + oid + "/" + target,
            "sourceArtifactId": source["artifactId"], "sourceArtifactRunId": source["runId"],
            "sourceArtifactZipSha256": source["artifactZipSha256"],
            "overlayManifestSha256": source["overlayManifestSha256"],
            "verifiedRemoteFileCount": verified, "files": hashes,
            "documents": expected["documentCount"],
            "v4DigestPublication": v4,
            "remoteShaVerified": True,
            "atlasRuntimeEnabled": False, "semanticNeighborEnabled": False
        }
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps(report, sort_keys=True))
        return 0
    except (PublicationError, OSError, ValueError, KeyError, TypeError, ImportError) as error:
        print("RA12-C5-C publish ERROR:", error, file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3

import argparse
import hashlib
import json
import os
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_manifest(root: Path) -> dict:
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit("manifest.json is required in the publication root")
    with manifest_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def safe_prefix(value: str) -> str:
    prefix = value.strip().strip("/")
    if not prefix.startswith("research-atlas/"):
        raise SystemExit("target prefix must live under research-atlas/")
    if ".." in prefix.split("/"):
        raise SystemExit("target prefix may not contain '..'")
    return prefix


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Publish a validated Research Atlas enrichment artifact to Hugging Face."
    )
    parser.add_argument("--input", required=True)
    parser.add_argument("--target-prefix", required=True)
    parser.add_argument(
        "--repo",
        default="CristianPelayo/openalex-philosophy",
    )
    parser.add_argument(
        "--repo-type",
        default="dataset",
        choices=["dataset"],
    )
    parser.add_argument(
        "--token-env",
        default="HF_TOKEN",
    )
    parser.add_argument(
        "--output",
        default="artifacts/research-atlas-ra10/hf-publication.json",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = Path(args.input).resolve()
    if not root.is_dir():
        raise SystemExit(f"publication root does not exist: {root}")

    manifest = require_manifest(root)
    prefix = safe_prefix(args.target_prefix)

    manifest_path = root / "manifest.json"
    registry_path = root / "registry.json"

    result = {
        "schemaVersion": "research-atlas-hf-publication-result-v1",
        "repo": args.repo,
        "repoType": args.repo_type,
        "pathPrefix": prefix,
        "input": str(root),
        "manifestSha256": sha256_file(manifest_path),
        "registrySha256": (
            sha256_file(registry_path)
            if registry_path.is_file()
            else None
        ),
        "artifactSchema": (
            manifest.get("schemaVersion")
            or manifest.get("schema_version")
        ),
        "dryRun": bool(args.dry_run),
        "commitOid": None,
        "commitUrl": None,
    }

    if not args.dry_run:
        token = os.environ.get(args.token_env)
        if not token:
            raise SystemExit(
                f"required Hugging Face token is missing from {args.token_env}"
            )

        from huggingface_hub import HfApi

        api = HfApi(token=token)
        info = api.upload_folder(
            repo_id=args.repo,
            repo_type=args.repo_type,
            folder_path=str(root),
            path_in_repo=prefix,
            commit_message=(
                "Publish Research Atlas enrichment artifact "
                f"{manifest.get('buildRevision') or manifest.get('generator_version') or 'v1'}"
            ),
        )

        result["commitOid"] = getattr(info, "oid", None)
        result["commitUrl"] = str(info)

        if not result["commitOid"]:
            raise SystemExit("Hugging Face upload did not return an immutable commit oid")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

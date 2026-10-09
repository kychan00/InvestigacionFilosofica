from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent, prefix=f".{path.name}.", suffix=".tmp"
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temporary_name, path)
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise


class ICloudController(Protocol):
    def status(self, path: Path) -> dict[str, Any]: ...

    def wait_uploaded(self, path: Path, timeout_seconds: int) -> dict[str, Any]: ...

    def evict(self, path: Path) -> dict[str, Any]: ...

    def download(self, path: Path, timeout_seconds: int) -> dict[str, Any]: ...


@dataclass(frozen=True)
class SwiftICloudController:
    helper: Path

    def _run(self, command: str, path: Path, *arguments: object) -> dict[str, Any]:
        executable = (
            ["xcrun", "swift", str(self.helper)]
            if self.helper.suffix == ".swift"
            else [str(self.helper)]
        )
        result = subprocess.run(
            [
                *executable,
                command,
                str(path),
                *(str(argument) for argument in arguments),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout)

    def status(self, path: Path) -> dict[str, Any]:
        return self._run("status", path)

    def wait_uploaded(self, path: Path, timeout_seconds: int) -> dict[str, Any]:
        return self._run("wait-uploaded", path, timeout_seconds)

    def evict(self, path: Path) -> dict[str, Any]:
        return self._run("evict", path)

    def download(self, path: Path, timeout_seconds: int) -> dict[str, Any]:
        return self._run("download", path, timeout_seconds)


def _safe_target(source: Path, icloud_root: Path, relative_target: Path) -> Path:
    source = source.resolve(strict=True)
    root = icloud_root.resolve(strict=True)
    if relative_target.is_absolute() or ".." in relative_target.parts:
        raise ValueError("The iCloud target must be a safe relative path")
    target = (root / relative_target).resolve(strict=False)
    if not target.is_relative_to(root):
        raise ValueError("The iCloud target escapes the configured root")
    if source == target:
        raise ValueError("Source and iCloud target must be different files")
    if not source.is_file() or source.is_symlink():
        raise ValueError("Only regular, non-symlink files can be archived")
    return target


def roundtrip_archive(
    source: Path,
    *,
    icloud_root: Path,
    relative_target: Path,
    controller: ICloudController,
    timeout_seconds: int = 1800,
    evict_after_verify: bool = True,
    move_source: bool = False,
) -> dict[str, Any]:
    source = source.resolve(strict=True)
    target = _safe_target(source, icloud_root, relative_target)
    target.parent.mkdir(parents=True, exist_ok=True)
    source_hash = sha256_file(source)
    source_size = source.stat().st_size

    if target.exists():
        if not target.is_file() or sha256_file(target) != source_hash:
            raise FileExistsError(f"Refusing to overwrite iCloud target: {target}")
    else:
        temporary = target.with_name(f".{target.name}.{source_hash[:12]}.partial")
        if temporary.exists():
            raise FileExistsError(f"Stale iCloud partial requires review: {temporary}")
        if move_source:
            os.replace(source, temporary)
        else:
            shutil.copy2(source, temporary)
        copied_hash = sha256_file(temporary)
        if copied_hash != source_hash:
            raise RuntimeError(f"Copied iCloud file hash mismatch: {temporary}")
        os.replace(temporary, target)

    uploaded = controller.wait_uploaded(target, timeout_seconds)
    if uploaded.get("isUploaded") is not True:
        raise RuntimeError(f"iCloud did not confirm upload: {target}")
    if sha256_file(target) != source_hash:
        raise RuntimeError(f"Uploaded iCloud file hash mismatch: {target}")

    controller.evict(target)
    controller.download(target, timeout_seconds)
    downloaded_hash = sha256_file(target)
    if downloaded_hash != source_hash:
        raise RuntimeError(f"Downloaded iCloud file hash mismatch: {target}")

    if move_source and source.exists():
        if sha256_file(source) != source_hash:
            raise RuntimeError(f"Local source changed before pruning: {source}")
        source.unlink()

    final_status = controller.status(target)
    if evict_after_verify:
        final_status = controller.evict(target)

    return {
        "schema_version": "semantic-retrieval-icloud-roundtrip-v1",
        "completed_at": _now(),
        "source": str(source),
        "icloud_target": str(target),
        "size_bytes": source_size,
        "sha256": source_hash,
        "upload_confirmed": True,
        "download_confirmed": True,
        "roundtrip_hash_equal": True,
        "evicted_after_verify": evict_after_verify,
        "source_moved": move_source,
        "final_status": final_status,
    }


def write_receipt(path: Path, payload: dict[str, Any]) -> None:
    _atomic_json(path, payload)

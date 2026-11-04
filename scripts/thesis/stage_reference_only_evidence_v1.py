#!/usr/bin/env python3
"""Stage reference-only audit evidence; never retain thesis PDF or full-text files.

The source capture directory is ephemeral. Only explicitly listed JSON,
CSV and Markdown summaries may be exported to a GitHub Actions artifact.
No PDF, extracted thesis text or viewer response is exported.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

SAFE_PATHS = (
    "capture/capture-summary.json",
    "work-review/boundary-work-review-queue.json",
    "ledger/adjudication-ledger.json",
    "ledger/adjudication-ledger.csv",
    "ledger/adjudication-ledger.md",
    "t2cb-summary.json",
)
ALLOWED_SUFFIXES = {".json", ".csv", ".md"}
FORBIDDEN_KEYS = {
    "fulltext", "full_text", "extractedtext", "extracted_text",
    "pdfbytes", "pdf_base64", "pdfbase64", "rawpdf", "raw_pdf",
}


def _validate_json_metadata(value: object) -> None:
    """Fail closed if a future summary starts embedding primary-source text."""
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in FORBIDDEN_KEYS:
                raise ValueError(f"Full-text payload key is prohibited: {key}")
            _validate_json_metadata(item)
    elif isinstance(value, list):
        for item in value:
            _validate_json_metadata(item)


def stage_evidence(source: Path, export: Path) -> list[str]:
    if not source.is_dir():
        raise ValueError("Expected T2CB evidence directory is absent")
    if export.exists():
        raise ValueError("Export directory must not preexist")
    exported: list[str] = []
    try:
        for relative in SAFE_PATHS:
            origin = source / relative
            if not origin.exists():
                continue
            if not origin.is_file() or origin.is_symlink():
                raise ValueError(f"Unsafe evidence path: {relative}")
            if origin.suffix not in ALLOWED_SUFFIXES:
                raise ValueError(f"Unexpected artifact format: {relative}")
            data = origin.read_bytes()
            if data.startswith(b"%PDF-"):
                raise ValueError(f"PDF payload disguised as metadata: {relative}")
            if origin.suffix == ".json":
                _validate_json_metadata(json.loads(data.decode("utf-8")))
            target = export / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            exported.append(relative)
        if not exported:
            raise ValueError("No reference-only evidence available")
        staged = sorted(
            p.relative_to(export).as_posix()
            for p in export.rglob("*") if p.is_file()
        )
        if staged != sorted(exported):
            raise ValueError("Artifact includes a non-allowlisted file")
        return exported
    except Exception:
        shutil.rmtree(export, ignore_errors=True)
        raise


def destroy_ephemeral_capture(source: Path) -> None:
    """Remove documents and OCR/text from the ephemeral CI runner workspace."""
    capture = source / "capture"
    if capture.is_dir():
        for item in capture.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
            elif item.name != "capture-summary.json":
                item.unlink()
    # CI must fail if a primary-source payload is found outside capture.
    forbidden = {".pdf", ".txt", ".bin", ".epub", ".djvu"}
    leaked = [
        str(p.relative_to(source)) for p in source.rglob("*")
        if p.is_file() and p.suffix.lower() in forbidden
    ]
    if leaked:
        raise ValueError(f"Unremoved primary-source files: {leaked}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--export", type=Path, required=True)
    args = parser.parse_args()
    try:
        exported = stage_evidence(args.source, args.export)
        print(json.dumps({"referenceOnlyFiles": exported}, indent=2))
    finally:
        destroy_ephemeral_capture(args.source)


if __name__ == "__main__":
    main()

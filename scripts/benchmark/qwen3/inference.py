#!/usr/bin/env python3
"""Resumable batched inference engine for the frozen Qwen3 reranker experiment.

Responsibilities:
- verify frozen dataset/instruction/model configuration before inference;
- load the model at most once per run;
- score missing query-document pairs in batches;
- checkpoint a reusable local cache atomically after each batch;
- write the final raw score artifact only when the full dataset is complete.

This module never reads human judgments and never changes production ranking.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import sys
import time
from pathlib import Path
from typing import Any

import torch
import transformers

from adapter import (
    Qwen3RerankerAdapter,
    build_document_text,
    build_input_fingerprint,
    dtype_name,
    resolve_device,
    resolve_dtype,
    sha256_text,
    validate_dataset_record,
)

DEFAULT_MANIFEST = "benchmark/qwen3/configs/qwen3-reranker-v1.experiment.json"
DEFAULT_OUTPUT = "benchmark/qwen3/scores/qwen3-reranker-v1.raw.jsonl"
DEFAULT_META = "benchmark/qwen3/scores/qwen3-reranker-v1.raw.meta.json"
DEFAULT_CACHE = "benchmark/qwen3/cache/qwen3-reranker-v1.cache.jsonl"
SCORING_VERSION = "qwen3-yes-no-softmax-v1"
SCORE_SCHEMA = "qwen3-score-v1"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def write_text_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    temp.write_text(text, encoding="utf-8")
    temp.replace(path)


def serialize_jsonl(records: list[dict[str, Any]]) -> str:
    return "".join(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n" for record in records)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"invalid JSONL at {path}:{line_number}: {error}") from error
            if not isinstance(value, dict):
                raise TypeError(f"JSONL record at {path}:{line_number} is not an object")
            records.append(value)
    return records


def load_manifest(path: Path) -> dict[str, Any]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("experiment_id") != "qwen3-reranker-v1":
        raise ValueError("unexpected experiment_id in manifest")
    return manifest


def validate_frozen_inputs(manifest: dict[str, Any]) -> tuple[Path, Path, str]:
    dataset_path = Path(manifest["dataset"]["path"])
    instruction_path = Path(manifest["instruction"]["path"])

    actual_dataset_sha = file_sha256(dataset_path)
    expected_dataset_sha = manifest["dataset"]["sha256"]
    if actual_dataset_sha != expected_dataset_sha:
        raise RuntimeError(
            f"dataset SHA mismatch: expected {expected_dataset_sha}, got {actual_dataset_sha}"
        )

    instruction = instruction_path.read_text(encoding="utf-8")
    actual_instruction_sha = sha256_text(instruction)
    expected_instruction_sha = manifest["instruction"]["sha256"]
    if actual_instruction_sha != expected_instruction_sha:
        raise RuntimeError(
            f"instruction SHA mismatch: expected {expected_instruction_sha}, got {actual_instruction_sha}"
        )

    return dataset_path, instruction_path, instruction


def cache_key_for(
    *,
    model: str,
    revision: str,
    instruction_sha256: str,
    input_sha256: str,
    max_length: int,
    device: str,
    dtype: str,
) -> str:
    payload = {
        "scoring_version": SCORING_VERSION,
        "model": model,
        "revision": revision,
        "instruction_sha256": instruction_sha256,
        "input_sha256": input_sha256,
        "max_length": max_length,
        "device": device,
        "dtype": dtype,
    }
    return sha256_text(stable_json(payload))


def validate_cached_entry(entry: dict[str, Any]) -> None:
    required = {"cache_key", "score"}
    if set(entry) != required:
        raise ValueError(f"cache entry has unexpected fields: {sorted(set(entry) - required)}")
    if not isinstance(entry["cache_key"], str) or len(entry["cache_key"]) != 64:
        raise ValueError("invalid cache_key")
    if not isinstance(entry["score"], dict):
        raise TypeError("cache score must be an object")


def load_cache(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    cache: dict[str, dict[str, Any]] = {}
    for entry in read_jsonl(path):
        validate_cached_entry(entry)
        key = entry["cache_key"]
        if key in cache and stable_json(cache[key]) != stable_json(entry["score"]):
            raise RuntimeError(f"conflicting cache entries for key {key}")
        cache[key] = entry["score"]
    return cache


def save_cache(path: Path, cache: dict[str, dict[str, Any]]) -> None:
    entries = [
        {"cache_key": key, "score": cache[key]}
        for key in sorted(cache)
    ]
    write_text_atomic(path, serialize_jsonl(entries))


def build_score_record(
    *,
    manifest: dict[str, Any],
    dataset_record: dict[str, Any],
    instruction_sha256: str,
    input_sha256: str,
    raw_score: float,
    latency_ms: float,
    device: str,
    dtype: str,
    max_length: int,
) -> dict[str, Any]:
    return {
        "schema_version": SCORE_SCHEMA,
        "experiment_id": manifest["experiment_id"],
        "query_id": dataset_record["query_id"],
        "record_id": dataset_record["record_id"],
        "model": manifest["model"]["name"],
        "revision": manifest["model"]["revision"],
        "instruction_sha256": instruction_sha256,
        "input_sha256": input_sha256,
        "raw_score": float(raw_score),
        "latency_ms": float(latency_ms),
        "device": device,
        "dtype": dtype,
        "max_length": int(max_length),
        # This field describes how the immutable score was originally produced.
        # Cache reuse is counted separately in run metadata.
        "cache_hit": False,
    }


def validate_score_record(record: dict[str, Any]) -> None:
    required = {
        "schema_version",
        "experiment_id",
        "query_id",
        "record_id",
        "model",
        "revision",
        "instruction_sha256",
        "input_sha256",
        "raw_score",
        "latency_ms",
        "device",
        "dtype",
        "max_length",
        "cache_hit",
    }
    if set(record) != required:
        raise ValueError("score record does not match qwen3-score-v1 fields")
    if record["schema_version"] != SCORE_SCHEMA:
        raise ValueError("unexpected score schema")
    if not (0.0 <= float(record["raw_score"]) <= 1.0):
        raise ValueError("raw_score outside [0,1]")
    if record["cache_hit"] is not False:
        raise ValueError("persisted raw score records must preserve original inference provenance")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run resumable batched Qwen3 inference")
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--meta", default=DEFAULT_META)
    parser.add_argument("--cache", default=DEFAULT_CACHE)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--device", default="auto", choices=["auto", "cuda", "mps", "cpu"])
    parser.add_argument("--dtype", default="auto", choices=["auto", "float32", "float16", "bfloat16"])
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Score only the first N rows into cache; do not finalize raw output unless N covers the full dataset.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow replacing an existing completed raw output after recomputing/validating the run.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.batch_size <= 0:
        raise ValueError("--batch-size must be positive")
    if args.limit is not None and args.limit <= 0:
        raise ValueError("--limit must be positive")

    manifest_path = Path(args.manifest)
    output_path = Path(args.output)
    meta_path = Path(args.meta)
    cache_path = Path(args.cache)

    if output_path.exists() and not args.force:
        raise FileExistsError(
            f"completed output already exists: {output_path}; use --force only for an intentional rerun"
        )

    manifest = load_manifest(manifest_path)
    dataset_path, _instruction_path, instruction = validate_frozen_inputs(manifest)
    dataset = read_jsonl(dataset_path)
    for record in dataset:
        validate_dataset_record(record)

    expected_rows = int(manifest["dataset"]["rows"])
    if len(dataset) != expected_rows:
        raise RuntimeError(f"dataset row count mismatch: expected {expected_rows}, got {len(dataset)}")

    max_length = int(manifest["adapter"]["max_length"])
    model_name = manifest["model"]["name"]
    revision = manifest["model"]["revision"]
    instruction_sha = manifest["instruction"]["sha256"]
    device = resolve_device(args.device)
    torch_dtype = resolve_dtype(device, args.dtype)
    dtype = dtype_name(torch_dtype)

    selected = dataset if args.limit is None else dataset[: min(args.limit, len(dataset))]
    full_run = len(selected) == len(dataset)
    cache = load_cache(cache_path)

    work: list[dict[str, Any]] = []
    resolved_scores: dict[tuple[str, str], dict[str, Any]] = {}
    cache_hits = 0

    for record in selected:
        document = build_document_text(record)
        input_sha = build_input_fingerprint(instruction, record["query"], document)
        key = cache_key_for(
            model=model_name,
            revision=revision,
            instruction_sha256=instruction_sha,
            input_sha256=input_sha,
            max_length=max_length,
            device=device,
            dtype=dtype,
        )
        cached = cache.get(key)
        if cached is not None:
            validate_score_record(cached)
            if cached["query_id"] != record["query_id"] or cached["record_id"] != record["record_id"]:
                raise RuntimeError("cache key collision across query-document identifiers")
            resolved_scores[(record["query_id"], record["record_id"])] = cached
            cache_hits += 1
            continue
        work.append(
            {
                "record": record,
                "document": document,
                "input_sha": input_sha,
                "cache_key": key,
            }
        )

    print("Qwen3 inference plan")
    print(f"rows_selected={len(selected)}")
    print(f"cache_hits={cache_hits}")
    print(f"fresh_scores_needed={len(work)}")
    print(f"batch_size={args.batch_size}")
    print(f"device={device}")
    print(f"dtype={dtype}")
    print(f"full_run={str(full_run).lower()}")

    adapter: Qwen3RerankerAdapter | None = None
    if work:
        adapter = Qwen3RerankerAdapter(
            model_name=model_name,
            revision=revision,
            instruction=instruction,
            max_length=max_length,
            device=device,
            dtype=dtype,
        )

    fresh_scores = 0
    started = time.perf_counter()
    for offset in range(0, len(work), args.batch_size):
        batch_items = work[offset : offset + args.batch_size]
        assert adapter is not None
        batch_pairs = [
            (item["record"]["query"], item["document"])
            for item in batch_items
        ]
        batch_started = time.perf_counter()
        raw_scores = adapter.score_many(batch_pairs)
        batch_latency_ms = (time.perf_counter() - batch_started) * 1000.0
        per_record_latency = batch_latency_ms / len(batch_items)

        for item, raw_score in zip(batch_items, raw_scores):
            record = item["record"]
            score_record = build_score_record(
                manifest=manifest,
                dataset_record=record,
                instruction_sha256=instruction_sha,
                input_sha256=item["input_sha"],
                raw_score=raw_score,
                latency_ms=per_record_latency,
                device=device,
                dtype=dtype,
                max_length=max_length,
            )
            validate_score_record(score_record)
            cache[item["cache_key"]] = score_record
            resolved_scores[(record["query_id"], record["record_id"])] = score_record
            fresh_scores += 1

        save_cache(cache_path, cache)
        completed = cache_hits + fresh_scores
        print(f"progress={completed}/{len(selected)}")

    elapsed_seconds = time.perf_counter() - started

    if not full_run:
        print("preview_complete=true")
        print(f"cache_path={cache_path}")
        print("raw_output_finalized=false")
        return

    ordered_scores: list[dict[str, Any]] = []
    for record in dataset:
        pair = (record["query_id"], record["record_id"])
        score = resolved_scores.get(pair)
        if score is None:
            raise RuntimeError(f"missing score for {pair[0]} / {pair[1]}")
        ordered_scores.append(score)

    output_text = serialize_jsonl(ordered_scores)
    output_sha = sha256_text(output_text)
    write_text_atomic(output_path, output_text)

    meta = {
        "schema_version": "qwen3-score-meta-v1",
        "experiment_id": manifest["experiment_id"],
        "purpose": "development-raw-scores",
        "model": model_name,
        "revision": revision,
        "scoring_version": SCORING_VERSION,
        "dataset_path": str(dataset_path),
        "dataset_sha256": manifest["dataset"]["sha256"],
        "instruction_sha256": instruction_sha,
        "output_path": str(output_path),
        "output_sha256": output_sha,
        "row_count": len(ordered_scores),
        "batch_size": args.batch_size,
        "device": device,
        "dtype": dtype,
        "max_length": max_length,
        "cache_hits_this_run": cache_hits,
        "fresh_scores_this_run": fresh_scores,
        "model_loaded": adapter is not None,
        "elapsed_seconds": elapsed_seconds,
        "python": platform.python_version(),
        "torch": torch.__version__,
        "transformers": transformers.__version__,
        "human_labels_used_as_model_input": False,
        "production_ranking_changed": False,
    }
    write_text_atomic(meta_path, json.dumps(meta, ensure_ascii=False, indent=2) + "\n")

    print("Qwen3 inference complete")
    print(f"rows={len(ordered_scores)}")
    print(f"output_sha256={output_sha}")
    print(f"output={output_path}")
    print(f"meta={meta_path}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("interrupted: completed batches remain available in the local cache", file=sys.stderr)
        raise

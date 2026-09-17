#!/usr/bin/env python3
"""Minimal, reproducible adapter for Qwen3-Reranker-0.6B.

This module owns only model input formatting and raw relevance scoring.
It does not read human judgments, ranking scores, provider provenance, or A/B labels.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
from pathlib import Path
from typing import Any, Iterable

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
import transformers

DEFAULT_MODEL = "Qwen/Qwen3-Reranker-0.6B"
DEFAULT_REVISION = "e61197ed45024b0ed8a2d74b80b4d909f1255473"
DEFAULT_DATASET = "benchmark/qwen3/datasets/human-audit-v1.jsonl"
DEFAULT_INSTRUCTION = "benchmark/qwen3/configs/qwen3-reranker-v1.instruction.txt"
DEFAULT_MAX_LENGTH = 4096

SYSTEM_PREFIX = (
    "<|im_start|>system\n"
    "Judge whether the Document meets the requirements based on the Query and the Instruct provided. "
    'Note that the answer can only be "yes" or "no".'
    "<|im_end|>\n<|im_start|>user\n"
)
SYSTEM_SUFFIX = "<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"

ALLOWED_DATASET_FIELDS = {
    "schema_version",
    "query_id",
    "query",
    "record_id",
    "title",
    "abstract",
    "authors",
    "year",
    "document_language",
}


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def validate_dataset_record(record: dict[str, Any]) -> None:
    unknown = set(record) - ALLOWED_DATASET_FIELDS
    missing = ALLOWED_DATASET_FIELDS - set(record)
    if unknown:
        raise ValueError(f"dataset record contains forbidden/unknown fields: {sorted(unknown)}")
    if missing:
        raise ValueError(f"dataset record is missing fields: {sorted(missing)}")
    for key in ("query_id", "query", "record_id", "title"):
        if not isinstance(record[key], str) or not record[key].strip():
            raise ValueError(f"dataset record field {key!r} must be a non-empty string")


def build_document_text(record: dict[str, Any]) -> str:
    """Mirror scripts/benchmark/qwen3/contracts.mjs exactly."""
    validate_dataset_record(record)
    lines = [f"Title: {record['title']}"]

    authors = record.get("authors") or []
    if authors:
        lines.append(f"Authors: {'; '.join(authors)}")

    if record.get("year") is not None:
        lines.append(f"Year: {record['year']}")

    if record.get("document_language"):
        lines.append(f"Document language: {record['document_language']}")

    abstract = record.get("abstract")
    abstract_text = abstract.strip() if isinstance(abstract, str) and abstract.strip() else "[unavailable]"
    lines.append(f"Abstract: {abstract_text}")
    return "\n".join(lines)


def format_instruction(instruction: str, query: str, document: str) -> str:
    separator = "" if instruction.endswith("\n") else "\n"
    return f"<Instruct>: {instruction}{separator}<Query>: {query}\n<Document>: {document}"


def build_input_fingerprint(instruction: str, query: str, document: str) -> str:
    payload = f"{instruction}\0{query}\0{document}"
    return sha256_text(payload)


def resolve_device(requested: str) -> str:
    if requested != "auto":
        if requested == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA was requested but is not available")
        if requested == "mps" and not torch.backends.mps.is_available():
            raise RuntimeError("MPS was requested but is not available")
        if requested not in {"cuda", "mps", "cpu"}:
            raise ValueError(f"unsupported device: {requested}")
        return requested

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def resolve_dtype(device: str, requested: str) -> torch.dtype:
    if requested != "auto":
        mapping = {
            "float32": torch.float32,
            "float16": torch.float16,
            "bfloat16": torch.bfloat16,
        }
        try:
            return mapping[requested]
        except KeyError as error:
            raise ValueError(f"unsupported dtype: {requested}") from error

    if device == "cuda":
        return torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    if device == "mps":
        return torch.float16
    return torch.float32


def dtype_name(dtype: torch.dtype) -> str:
    return str(dtype).removeprefix("torch.")


def read_jsonl_row(path: Path, row_number: int) -> dict[str, Any]:
    if row_number < 1:
        raise ValueError("--row is 1-based and must be >= 1")

    with path.open("r", encoding="utf-8") as handle:
        for index, line in enumerate(handle, start=1):
            if index != row_number:
                continue
            record = json.loads(line)
            validate_dataset_record(record)
            return record

    raise IndexError(f"row {row_number} does not exist in {path}")


class Qwen3RerankerAdapter:
    def __init__(
        self,
        *,
        model_name: str = DEFAULT_MODEL,
        revision: str = DEFAULT_REVISION,
        instruction: str,
        max_length: int = DEFAULT_MAX_LENGTH,
        device: str = "auto",
        dtype: str = "auto",
    ) -> None:
        if max_length <= 0:
            raise ValueError("max_length must be positive")
        if not instruction.strip():
            raise ValueError("instruction must not be empty")

        self.model_name = model_name
        self.revision = revision
        self.instruction = instruction
        self.max_length = max_length
        self.device = resolve_device(device)
        self.torch_dtype = resolve_dtype(self.device, dtype)

        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_name,
            revision=self.revision,
            padding_side="left",
        )
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            revision=self.revision,
            dtype=self.torch_dtype,
        ).eval()
        self.model.to(self.device)

        self.token_false_id = self.tokenizer.convert_tokens_to_ids("no")
        self.token_true_id = self.tokenizer.convert_tokens_to_ids("yes")
        if self.token_false_id is None or self.token_true_id is None:
            raise RuntimeError("tokenizer does not expose expected yes/no token ids")

        self.prefix_tokens = self.tokenizer.encode(SYSTEM_PREFIX, add_special_tokens=False)
        self.suffix_tokens = self.tokenizer.encode(SYSTEM_SUFFIX, add_special_tokens=False)
        available = self.max_length - len(self.prefix_tokens) - len(self.suffix_tokens)
        if available <= 0:
            raise ValueError("max_length is too small for Qwen3 reranker prefix/suffix")
        self.content_max_length = available

    @torch.inference_mode()
    def _score_batch(self, pair_list: list[tuple[str, str]]) -> list[float]:
        formatted = [
            format_instruction(self.instruction, query, document)
            for query, document in pair_list
        ]
        inputs = self.tokenizer(
            formatted,
            padding=False,
            truncation="longest_first",
            return_attention_mask=False,
            max_length=self.content_max_length,
        )
        input_ids = [
            self.prefix_tokens + ids + self.suffix_tokens
            for ids in inputs["input_ids"]
        ]
        batch = self.tokenizer.pad(
            {"input_ids": input_ids},
            padding=True,
            return_tensors="pt",
        )
        batch = {key: value.to(self.device) for key, value in batch.items()}

        logits = self.model(**batch).logits[:, -1, :]
        true_logits = logits[:, self.token_true_id]
        false_logits = logits[:, self.token_false_id]
        yes_no_logits = torch.stack([false_logits, true_logits], dim=1)
        scores = torch.softmax(yes_no_logits.float(), dim=1)[:, 1]
        values = [float(value) for value in scores.detach().cpu().tolist()]

        for value in values:
            if not math.isfinite(value) or not 0.0 <= value <= 1.0:
                raise FloatingPointError(
                    f"Qwen3 produced a non-finite/out-of-range relevance score: {value!r}"
                )

        return values

    def score_many(self, pairs: Iterable[tuple[str, str]]) -> list[float]:
        pair_list = list(pairs)
        if not pair_list:
            return []

        # On the validated Apple MPS runtime, padded multi-item forwards
        # produced non-finite yes/no logits in both float16 and bfloat16.
        # Keep the model loaded once, but evaluate MPS pairs as singleton
        # microbatches. CUDA/CPU retain true model batching.
        if self.device == "mps" and len(pair_list) > 1:
            return [
                self._score_batch([pair])[0]
                for pair in pair_list
            ]

        return self._score_batch(pair_list)

    def score(self, query: str, document: str) -> float:
        return self.score_many([(query, document)])[0]


def runtime_metadata(device: str, dtype: torch.dtype) -> dict[str, Any]:
    return {
        "python": platform.python_version(),
        "torch": torch.__version__,
        "transformers": transformers.__version__,
        "device": device,
        "dtype": dtype_name(dtype),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-test the frozen Qwen3 reranker adapter")
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--instruction", default=DEFAULT_INSTRUCTION)
    parser.add_argument("--row", type=int, default=1, help="1-based JSONL row to score")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--revision", default=DEFAULT_REVISION)
    parser.add_argument("--max-length", type=int, default=DEFAULT_MAX_LENGTH)
    parser.add_argument("--device", default="auto", choices=["auto", "cuda", "mps", "cpu"])
    parser.add_argument("--dtype", default="auto", choices=["auto", "float32", "float16", "bfloat16"])
    parser.add_argument(
        "--metadata-only",
        action="store_true",
        help="Validate files/config and report the resolved runtime without loading model weights",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dataset_path = Path(args.dataset)
    instruction_path = Path(args.instruction)
    record = read_jsonl_row(dataset_path, args.row)
    instruction = instruction_path.read_text(encoding="utf-8")
    if not instruction.strip():
        raise ValueError(f"instruction file is empty: {instruction_path}")
    document = build_document_text(record)
    device = resolve_device(args.device)
    dtype = resolve_dtype(device, args.dtype)

    base_output = {
        "smoke_only": True,
        "row": args.row,
        "query_id": record["query_id"],
        "record_id": record["record_id"],
        "model": args.model,
        "revision": args.revision,
        "instruction_sha256": sha256_text(instruction),
        "input_sha256": build_input_fingerprint(instruction, record["query"], document),
        "max_length": args.max_length,
        **runtime_metadata(device, dtype),
    }

    if args.metadata_only:
        print(json.dumps({**base_output, "model_loaded": False}, ensure_ascii=False, indent=2))
        return

    adapter = Qwen3RerankerAdapter(
        model_name=args.model,
        revision=args.revision,
        instruction=instruction,
        max_length=args.max_length,
        device=args.device,
        dtype=args.dtype,
    )
    raw_score = adapter.score(record["query"], document)
    output = {
        **base_output,
        "device": adapter.device,
        "dtype": dtype_name(adapter.torch_dtype),
        "model_loaded": True,
        "raw_score": raw_score,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

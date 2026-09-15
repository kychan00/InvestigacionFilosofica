#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from huggingface_hub import model_info
from transformers import AutoModelForSequenceClassification, AutoTokenizer

ROOT = Path(__file__).resolve().parents[2]


def read_jsonl(path: Path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows):
    path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")


def choose_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def document_text(row: dict, max_abstract_chars: int) -> str:
    parts = [f"Title: {row.get('title') or ''}"]
    authors = row.get("authors") or []
    if authors:
        parts.append("Authors: " + ", ".join(authors[:8]))
    if row.get("journal"):
        parts.append(f"Journal/source: {row['journal']}")
    if row.get("type"):
        parts.append(f"Document type: {row['type']}")
    abstract = (row.get("abstract") or "").strip()
    if abstract:
        parts.append("Abstract: " + abstract[:max_abstract_chars])
    else:
        parts.append("Abstract: unavailable")
    return "\n".join(parts)


def softmax(values):
    arr = np.asarray(values, dtype=np.float64)
    arr -= arr.max()
    exp = np.exp(arr)
    return exp / exp.sum()


class LocalModels:
    def __init__(self, config: dict):
        self.device = choose_device()
        self.max_length = int(config["inference"]["maxLength"])
        self.nli_batch_size = int(config["inference"]["nliBatchSize"])
        self.reranker_batch_size = int(config["inference"]["rerankerBatchSize"])

        nli_repo = config["models"]["nli"]
        reranker_repo = config["models"]["reranker"]

        self.nli_revision = model_info(nli_repo).sha
        self.reranker_revision = model_info(reranker_repo).sha

        print(f"Device: {self.device}")
        print(f"NLI: {nli_repo}@{self.nli_revision}")
        print(f"Reranker: {reranker_repo}@{self.reranker_revision}")

        self.nli_tokenizer = AutoTokenizer.from_pretrained(nli_repo, revision=self.nli_revision)
        self.nli_model = AutoModelForSequenceClassification.from_pretrained(
            nli_repo,
            revision=self.nli_revision,
        ).to(self.device)
        self.nli_model.eval()

        self.reranker_tokenizer = AutoTokenizer.from_pretrained(
            reranker_repo,
            revision=self.reranker_revision,
        )
        self.reranker_model = AutoModelForSequenceClassification.from_pretrained(
            reranker_repo,
            revision=self.reranker_revision,
        ).to(self.device)
        self.reranker_model.eval()

        self.entailment_index = self._entailment_index()

    def _entailment_index(self) -> int:
        labels = {
            int(k): str(v).lower()
            for k, v in self.nli_model.config.id2label.items()
        }
        for index, label in labels.items():
            if "entail" in label:
                return index
        if self.nli_model.config.num_labels == 3:
            return 2
        raise RuntimeError(f"Could not infer entailment label from {labels}")

    @torch.inference_mode()
    def rerank(self, pairs):
        scores = []
        for start in range(0, len(pairs), self.reranker_batch_size):
            batch = pairs[start:start + self.reranker_batch_size]
            queries = [query for query, _ in batch]
            documents = [document for _, document in batch]
            encoded = self.reranker_tokenizer(
                queries,
                documents,
                padding=True,
                truncation=True,
                max_length=self.max_length,
                return_tensors="pt",
            )
            encoded = {key: value.to(self.device) for key, value in encoded.items()}
            logits = self.reranker_model(**encoded).logits.detach().float().cpu().numpy()
            if logits.ndim == 2 and logits.shape[1] == 1:
                logits = logits[:, 0]
            elif logits.ndim == 2:
                logits = logits[:, -1]
            scores.extend(float(value) for value in logits)
        return scores

    @torch.inference_mode()
    def zero_shot(self, sequences, candidates, hypothesis_template):
        """
        Single-label zero-shot classification.

        For each sequence, score every candidate with the NLI entailment logit,
        then apply softmax across candidate entailment logits. This mirrors the
        usual single-label zero-shot policy and avoids applying a second softmax
        to already-normalized entailment probabilities.
        """
        output = []
        expanded = []
        owner = []

        for sequence_index, sequence in enumerate(sequences):
            for candidate_id, phrase in candidates:
                expanded.append((sequence, hypothesis_template.format(phrase)))
                owner.append((sequence_index, candidate_id))

        entailment_logits = []
        for start in range(0, len(expanded), self.nli_batch_size):
            batch = expanded[start:start + self.nli_batch_size]
            premise = [item[0] for item in batch]
            hypothesis = [item[1] for item in batch]
            encoded = self.nli_tokenizer(
                premise,
                hypothesis,
                padding=True,
                truncation=True,
                max_length=self.max_length,
                return_tensors="pt",
            )
            encoded = {key: value.to(self.device) for key, value in encoded.items()}
            logits = self.nli_model(**encoded).logits
            entailment_logits.extend(
                float(value)
                for value in logits[:, self.entailment_index].detach().float().cpu().tolist()
            )

        grouped = defaultdict(list)
        for (sequence_index, candidate_id), score in zip(owner, entailment_logits):
            grouped[sequence_index].append((candidate_id, score))

        for sequence_index in range(len(sequences)):
            labels = grouped[sequence_index]
            normalized = softmax([score for _, score in labels])
            ranked = sorted(
                ((candidate_id, float(prob)) for (candidate_id, _), prob in zip(labels, normalized)),
                key=lambda item: item[1],
                reverse=True,
            )
            output.append(ranked)
        return output


def percentile_buckets(rows, scores):
    by_query = defaultdict(list)
    for index, (row, score) in enumerate(zip(rows, scores)):
        by_query[row["query_id"]].append((index, score))

    percentiles = [0.0] * len(rows)
    buckets = [0] * len(rows)

    for values in by_query.values():
        ordered_scores = [score for _, score in values]
        for index, score in values:
            percentile = sum(candidate <= score for candidate in ordered_scores) / len(ordered_scores)
            percentiles[index] = percentile
            if percentile >= 0.80:
                bucket = 3
            elif percentile >= 0.50:
                bucket = 2
            elif percentile >= 0.20:
                bucket = 1
            else:
                bucket = 0
            buckets[index] = bucket
    return percentiles, buckets


def main():
    parser = argparse.ArgumentParser(description="Generate AI-assisted silver judgments locally.")
    parser.add_argument(
        "--config",
        default="benchmark/ai-judge-v1.json",
        help="Judge configuration JSON relative to repository root.",
    )
    parser.add_argument("--limit", type=int, default=None, help="Optional smoke-test row limit.")
    args = parser.parse_args()

    config_path = ROOT / args.config
    config = json.loads(config_path.read_text(encoding="utf-8"))
    run_path = ROOT / config["baselineRun"]

    all_rows = read_jsonl(run_path)
    baseline_counts = Counter(row["query_id"] for row in all_rows)

    rows = all_rows
    if args.limit:
        rows = rows[:args.limit]

    selected_counts = Counter(row["query_id"] for row in rows)
    complete_query_pool = {
        query_id: selected_counts[query_id] == baseline_counts[query_id]
        for query_id in selected_counts
    }

    max_abstract_chars = int(config["inference"]["maxAbstractChars"])
    documents = [document_text(row, max_abstract_chars) for row in rows]
    sequences = [
        f"Research query: {row['query']}\n\nDocument metadata:\n{document}"
        for row, document in zip(rows, documents)
    ]

    models = LocalModels(config)

    print(f"Scoring reranker for {len(rows)} rows...")
    reranker_scores = models.rerank([(row["query"], document) for row, document in zip(rows, documents)])
    reranker_percentiles, reranker_buckets = percentile_buckets(rows, reranker_scores)

    print("Classifying relevance...")
    relevance_candidates = [
        (0, "irrelevant or unrelated"),
        (1, "only tangentially or indirectly related"),
        (2, "substantively relevant"),
        (3, "highly relevant and directly focused on the query"),
    ]
    relevance_predictions = models.zero_shot(
        sequences,
        relevance_candidates,
        "The document is {}.",
    )

    print("Classifying discipline...")
    discipline_candidates = [
        (0, "not a philosophical work"),
        (1, "interdisciplinary or philosophically adjacent"),
        (2, "a philosophical work or work of philosophy scholarship"),
    ]
    discipline_predictions = models.zero_shot(
        sequences,
        discipline_candidates,
        "The document is {}.",
    )

    print("Classifying documentary role...")
    role_candidates = [
        ("PRIMARY", "a primary philosophical source by the original philosopher or author"),
        ("SCHOLARLY", "secondary scholarly research or philosophical scholarship"),
        ("REVIEW", "a book review or scholarly review"),
        ("EMPIRICAL_ADJACENT", "an empirical or interdisciplinary application adjacent to philosophy"),
        ("PARATEXT", "paratext such as an editorial, index, table of contents, front matter, or cover"),
        ("NOISE", "noise or a false positive unrelated to the research task"),
    ]
    role_predictions = models.zero_shot(
        sequences,
        role_candidates,
        "The document is {}.",
    )

    thresholds = config["thresholds"]
    judgments = []
    review_count = 0

    for index, row in enumerate(rows):
        relevance, relevance_confidence = relevance_predictions[index][0]
        discipline, discipline_confidence = discipline_predictions[index][0]
        role, role_confidence = role_predictions[index][0]

        if role_confidence < float(thresholds["roleLowConfidence"]):
            role = "UNSURE"

        reasons = []
        if relevance_confidence < float(thresholds["relevanceLowConfidence"]):
            reasons.append("low_relevance_confidence")
        if discipline_confidence < float(thresholds["disciplineLowConfidence"]):
            reasons.append("low_discipline_confidence")
        if role_confidence < float(thresholds["roleLowConfidence"]):
            reasons.append("low_role_confidence")
        if not (row.get("abstract") or "").strip():
            reasons.append("missing_abstract")

        disagreement = abs(int(relevance) - int(reranker_buckets[index]))
        disagreement_applicable = bool(complete_query_pool.get(row["query_id"]))
        if (
            disagreement_applicable
            and disagreement >= int(thresholds["rerankerDisagreementDistance"])
        ):
            reasons.append("nli_reranker_disagreement")
        if role == "UNSURE":
            reasons.append("role_unsure")

        needs_review = bool(reasons)
        review_count += int(needs_review)

        judgments.append({
            "query_id": row["query_id"],
            "record_id": row["record_id"],
            "relevance": int(relevance),
            "discipline": int(discipline),
            "role": role,
            "judge_type": "ai_silver_v1",
            "confidence": {
                "relevance_nli": round(float(relevance_confidence), 6),
                "discipline_nli": round(float(discipline_confidence), 6),
                "role_nli": round(float(role_confidence), 6),
            },
            "reranker": {
                "raw_score": round(float(reranker_scores[index]), 6),
                "within_query_percentile": round(float(reranker_percentiles[index]), 6),
                "percentile_bucket_0_3": int(reranker_buckets[index]),
                "distance_from_nli_label": int(disagreement),
                "disagreement_applicable": disagreement_applicable,
            },
            "needs_human_review": needs_review,
            "review_reasons": sorted(set(reasons)),
        })

    output_path = ROOT / config["outputs"]["judgments"]
    metadata_path = ROOT / config["outputs"]["metadata"]
    if args.limit:
        output_path = output_path.with_name(output_path.stem + f"-smoke-{args.limit}" + output_path.suffix)
        metadata_path = metadata_path.with_name(metadata_path.stem + f"-smoke-{args.limit}" + metadata_path.suffix)

    write_jsonl(output_path, judgments)

    metadata = {
        "schemaVersion": 1,
        "judge": config["name"],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "baselineRun": config["baselineRun"],
        "rows": len(judgments),
        "smokeTest": bool(args.limit),
        "needsHumanReview": review_count,
        "device": models.device,
        "models": {
            "nli": {
                "repository": config["models"]["nli"],
                "resolvedRevision": models.nli_revision,
            },
            "reranker": {
                "repository": config["models"]["reranker"],
                "resolvedRevision": models.reranker_revision,
            },
        },
        "thresholds": thresholds,
        "policy": config["policy"],
        "notes": [
            "NLI confidence is softmax over candidate entailment logits.",
            "Reranker disagreement is only used when the selected rows contain the complete 20-document pool for that query.",
        ],
        "outputs": {
            "judgments": str(output_path.relative_to(ROOT)),
        },
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print()
    print("AI SILVER JUDGMENTS: PASS")
    print(f"rows={len(judgments)}")
    print(f"needs_human_review={review_count}")
    print(f"judgments={output_path.relative_to(ROOT)}")
    print(f"metadata={metadata_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

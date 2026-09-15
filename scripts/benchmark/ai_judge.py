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
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def write_jsonl(path: Path, rows):
    path.write_text(
        "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n",
        encoding="utf-8",
    )


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
    if abstract and abstract != "-":
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

        self.nli_tokenizer = AutoTokenizer.from_pretrained(
            nli_repo,
            revision=self.nli_revision,
        )
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
            batch = pairs[start : start + self.reranker_batch_size]
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
        """Single-label zero-shot classification using entailment logits."""
        expanded = []
        owner = []

        for sequence_index, sequence in enumerate(sequences):
            for candidate_id, phrase in candidates:
                expanded.append((sequence, hypothesis_template.format(phrase)))
                owner.append((sequence_index, candidate_id))

        entailment_logits = []
        for start in range(0, len(expanded), self.nli_batch_size):
            batch = expanded[start : start + self.nli_batch_size]
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
                for value in logits[:, self.entailment_index]
                .detach()
                .float()
                .cpu()
                .tolist()
            )

        grouped = defaultdict(list)
        for (sequence_index, candidate_id), score in zip(owner, entailment_logits):
            grouped[sequence_index].append((candidate_id, score))

        output = []
        for sequence_index in range(len(sequences)):
            labels = grouped[sequence_index]
            normalized = softmax([score for _, score in labels])
            ranked = sorted(
                (
                    (candidate_id, float(prob))
                    for (candidate_id, _), prob in zip(labels, normalized)
                ),
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
            percentile = sum(candidate <= score for candidate in ordered_scores) / len(
                ordered_scores
            )
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


def one_per_query(rows):
    selected = []
    seen = set()
    for row in rows:
        query_id = row["query_id"]
        if query_id in seen:
            continue
        selected.append(row)
        seen.add(query_id)
    return selected


def main():
    parser = argparse.ArgumentParser(
        description="Generate AI-assisted silver judgments locally."
    )
    parser.add_argument(
        "--config",
        default="benchmark/ai-judge-v1.json",
        help="Judge configuration JSON relative to repository root.",
    )
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument(
        "--one-per-query",
        action="store_true",
        help="Smoke test using the first frozen result from each benchmark query.",
    )
    args = parser.parse_args()

    if args.limit and args.one_per_query:
        raise SystemExit("Use either --limit or --one-per-query, not both.")

    config_path = ROOT / args.config
    config = json.loads(config_path.read_text(encoding="utf-8"))
    run_path = ROOT / config["baselineRun"]

    all_rows = read_jsonl(run_path)
    baseline_counts = Counter(row["query_id"] for row in all_rows)

    rows = all_rows
    smoke_label = None
    if args.limit:
        rows = rows[: args.limit]
        smoke_label = f"smoke-{args.limit}"
    elif args.one_per_query:
        rows = one_per_query(rows)
        smoke_label = "smoke-one-per-query"

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
    reranker_scores = models.rerank(
        [(row["query"], document) for row, document in zip(rows, documents)]
    )
    reranker_percentiles, reranker_buckets = percentile_buckets(rows, reranker_scores)

    print("Classifying relevance...")
    relevance_candidates = [
        (0, "does not substantively address the research query"),
        (1, "has a related topic, but the queried philosopher, work, concept, or problem is peripheral"),
        (2, "substantively addresses the queried philosopher, work, concept, or problem as an important part of the document"),
        (3, "is specifically centered on and directly about the queried philosopher, work, concept, or problem"),
    ]
    relevance_predictions = models.zero_shot(
        sequences,
        relevance_candidates,
        "In relation to the research query, the document {}.",
    )

    print("Classifying discipline...")
    discipline_candidates = [
        (0, "primarily belongs to a non-philosophy discipline and does not substantially analyze philosophical arguments, concepts, works, or philosophers"),
        (1, "is primarily interdisciplinary or from another field but substantially uses, applies, or discusses philosophical ideas"),
        (2, "is primarily philosophy scholarship, including analysis of philosophical arguments, concepts, philosophers, philosophical works, or history of philosophy"),
    ]
    discipline_predictions = models.zero_shot(
        sequences,
        discipline_candidates,
        "Regarding academic discipline, the document {}.",
    )

    print("Classifying documentary role...")
    role_candidates = [
        ("PRIMARY", "is a primary text authored by the philosopher or thinker who is the object of the research query, rather than a later study about that thinker"),
        ("SCHOLARLY", "is a secondary academic study about a philosopher, philosophical work, concept, argument, or problem"),
        ("REVIEW", "is explicitly a review of a book or scholarly publication"),
        ("EMPIRICAL_ADJACENT", "is primarily an empirical or applied study in another field that uses philosophical ideas"),
        ("PARATEXT", "is paratext such as an editorial, index, table of contents, front matter, or cover"),
        ("NOISE", "does not substantively address the research task and is a false positive"),
    ]
    role_predictions = models.zero_shot(
        sequences,
        role_candidates,
        "Regarding documentary role, the document {}.",
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

        audit_reasons = []
        critical_reasons = []

        if relevance_confidence < float(thresholds["relevanceLowConfidence"]):
            audit_reasons.append("low_relevance_confidence")
        if discipline_confidence < float(thresholds["disciplineLowConfidence"]):
            audit_reasons.append("low_discipline_confidence")
        if role_confidence < float(thresholds["roleLowConfidence"]):
            audit_reasons.append("low_role_confidence")
        if not (row.get("abstract") or "").strip() or row.get("abstract") == "-":
            audit_reasons.append("missing_abstract")
        if role == "UNSURE":
            audit_reasons.append("role_unsure")

        if relevance_confidence < float(
            thresholds["criticalRelevanceLowConfidence"]
        ):
            critical_reasons.append("critical_relevance_uncertainty")
        if discipline_confidence < float(
            thresholds["criticalDisciplineLowConfidence"]
        ):
            critical_reasons.append("critical_discipline_uncertainty")

        disagreement = abs(int(relevance) - int(reranker_buckets[index]))
        disagreement_applicable = bool(complete_query_pool.get(row["query_id"]))
        if (
            disagreement_applicable
            and disagreement >= int(thresholds["rerankerDisagreementDistance"])
        ):
            audit_reasons.append("nli_reranker_disagreement")
            critical_reasons.append("nli_reranker_disagreement")

        needs_review = bool(critical_reasons)
        review_count += int(needs_review)

        audit_priority = (
            (1.0 - float(relevance_confidence))
            + 0.75 * (1.0 - float(discipline_confidence))
            + 0.20 * (1.0 - float(role_confidence))
            + (0.20 if "missing_abstract" in audit_reasons else 0.0)
            + (0.75 if "nli_reranker_disagreement" in audit_reasons else 0.0)
        )

        judgments.append(
            {
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
                    "within_query_percentile": round(
                        float(reranker_percentiles[index]), 6
                    ),
                    "percentile_bucket_0_3": int(reranker_buckets[index]),
                    "distance_from_nli_label": int(disagreement),
                    "disagreement_applicable": disagreement_applicable,
                },
                "needs_human_review": needs_review,
                "review_reasons": sorted(set(critical_reasons)),
                "audit_reasons": sorted(set(audit_reasons)),
                "audit_priority": round(float(audit_priority), 6),
            }
        )

    output_path = ROOT / config["outputs"]["judgments"]
    metadata_path = ROOT / config["outputs"]["metadata"]
    if smoke_label:
        output_path = output_path.with_name(
            output_path.stem + f"-{smoke_label}" + output_path.suffix
        )
        metadata_path = metadata_path.with_name(
            metadata_path.stem + f"-{smoke_label}" + metadata_path.suffix
        )

    write_jsonl(output_path, judgments)

    metadata = {
        "schemaVersion": 2,
        "judge": config["name"],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "baselineRun": config["baselineRun"],
        "rows": len(judgments),
        "smokeTest": bool(smoke_label),
        "smokeLabel": smoke_label,
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
            "Role uncertainty is auxiliary and does not by itself force human review.",
            "Missing abstracts increase audit priority but do not by themselves force human review.",
            "Reranker disagreement is only actionable when the selected rows contain the complete 20-document pool for that query.",
        ],
        "outputs": {
            "judgments": str(output_path.relative_to(ROOT)),
        },
    }
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print()
    print("AI SILVER JUDGMENTS: PASS")
    print(f"rows={len(judgments)}")
    print(f"needs_human_review={review_count}")
    print(f"judgments={output_path.relative_to(ROOT)}")
    print(f"metadata={metadata_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

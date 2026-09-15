#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

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


def calibrate_relevance(base: int, percentile: float) -> tuple[int, str]:
    """
    Conservative silver calibration.

    The NLI classifier decides whether a document is irrelevant (0), adjacent (1),
    relevant (2), or already clearly central (3). The reranker is only allowed to
    refine centrality inside the already-relevant class: a base-2 document in the
    top 20% of its frozen 20-document query pool becomes grade 3.

    This deliberately prevents a relative reranker score from turning an
    absolutely irrelevant/adjacent result into a relevant one.
    """
    if base >= 3:
        return 3, "nli_central"
    if base == 2 and percentile >= 0.80:
        return 3, "nli_relevant_plus_top20pct_reranker"
    return base, "nli_grade_preserved"


def main():
    parser = argparse.ArgumentParser(
        description="Calibrate AI judge outputs into conservative silver relevance labels."
    )
    parser.add_argument(
        "--input",
        default="benchmark/ai-judgments-v1.jsonl",
    )
    parser.add_argument(
        "--output",
        default="benchmark/ai-silver-v1.jsonl",
    )
    parser.add_argument(
        "--metadata",
        default="benchmark/ai-silver-v1.meta.json",
    )
    args = parser.parse_args()

    input_path = ROOT / args.input
    output_path = ROOT / args.output
    metadata_path = ROOT / args.metadata

    rows = read_jsonl(input_path)
    if len(rows) != 1000:
        raise SystemExit(f"Expected 1000 AI judgments, found {len(rows)}")

    query_counts = Counter(row["query_id"] for row in rows)
    if len(query_counts) != 50 or set(query_counts.values()) != {20}:
        raise SystemExit(
            f"Expected 50 queries with 20 rows each; got {dict(sorted(query_counts.items()))}"
        )

    seen = set()
    output = []
    calibration_counts = Counter()
    final_counts = Counter()
    base_counts = Counter()
    review_count = 0

    for row in rows:
        key = (row["query_id"], row["record_id"])
        if key in seen:
            raise SystemExit(f"Duplicate judgment key: {key}")
        seen.add(key)

        base = int(row["relevance"])
        percentile = float(row["reranker"]["within_query_percentile"])
        final, reason = calibrate_relevance(base, percentile)

        # Only critical absolute relevance uncertainty is treated as a direct
        # review flag in the silver set. Relative reranker disagreement remains
        # available in audit metadata, but it is not a contradiction by itself.
        review_reasons = [
            reason_name
            for reason_name in row.get("review_reasons", [])
            if reason_name == "critical_relevance_uncertainty"
        ]
        needs_review = bool(review_reasons)

        calibrated = dict(row)
        calibrated["relevance_nli"] = base
        calibrated["relevance"] = final
        calibrated["relevance_calibration"] = reason
        calibrated["source_needs_human_review"] = bool(
            row.get("needs_human_review", False)
        )
        calibrated["source_review_reasons"] = list(row.get("review_reasons", []))
        calibrated["needs_human_review"] = needs_review
        calibrated["review_reasons"] = review_reasons
        calibrated["judge_type"] = "ai_silver_calibrated_v1"

        output.append(calibrated)
        base_counts[base] += 1
        final_counts[final] += 1
        calibration_counts[reason] += 1
        review_count += int(needs_review)

    write_jsonl(output_path, output)

    metadata = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": args.input,
        "output": args.output,
        "rows": len(output),
        "queries": len(query_counts),
        "rowsPerQuery": sorted(set(query_counts.values())),
        "policy": {
            "0": "NLI irrelevant remains 0 regardless of reranker position.",
            "1": "NLI adjacent remains 1 regardless of reranker position.",
            "2": "NLI relevant remains 2 unless it is in the top 20% of the frozen per-query reranker distribution, in which case it becomes 3.",
            "3": "NLI central remains 3.",
            "binaryRelevantThreshold": 2,
            "rationale": "The reranker refines centrality but cannot promote an absolutely irrelevant or merely adjacent item into the relevant set.",
        },
        "baseNliDistribution": dict(sorted(base_counts.items())),
        "finalSilverDistribution": dict(sorted(final_counts.items())),
        "calibration": dict(sorted(calibration_counts.items())),
        "needsHumanReview": review_count,
        "disciplinePolicy": "Discipline labels are retained as experimental diagnostic metadata and should not be treated as human gold labels.",
        "rolePolicy": "Documentary-role labels are retained as diagnostic metadata only because the NLI role classifier showed poor separation in the smoke/full runs.",
    }
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("AI SILVER CALIBRATION: PASS")
    print(f"rows={len(output)}")
    print(f"queries={len(query_counts)}")
    print(f"base_relevance={dict(sorted(base_counts.items()))}")
    print(f"final_relevance={dict(sorted(final_counts.items()))}")
    print(f"needs_human_review={review_count}")
    print(f"judgments={output_path.relative_to(ROOT)}")
    print(f"metadata={metadata_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

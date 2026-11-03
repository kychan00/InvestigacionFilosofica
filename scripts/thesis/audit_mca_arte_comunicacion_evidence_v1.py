#!/usr/bin/env python3
"""T2BL: evidence-only audit for historical MCA Arte y Comunicación.

No thesis title, abstract, keyword, embedding, or semantic feature participates
in admission or program-family decisions. This tool does not mutate the corpus.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "thesis"))
import build_canonical_corpus_v1 as canonical


def exact_equal(name: str, observed: Any, expected: Any) -> None:
    if observed != expected:
        raise AssertionError(f"{name}: observed={observed!r}, expected={expected!r}")


def build_report(
    corpus: dict[str, Any],
    queue: dict[str, Any],
    registry: dict[str, Any],
    baseline: dict[str, Any],
) -> dict[str, Any]:
    expected = baseline["expected"]
    exact_equal("registryRevision", registry["registryRevision"], baseline["registryRevision"])
    exact_equal("source corpus works", len(corpus["works"]), expected["corpusWorks"])
    exact_equal(
        "projected global admission",
        dict(Counter(w["admissionStatus"] for w in corpus["works"])),
        expected["globalAdmission"],
    )

    scope = json.loads(
        (ROOT / "scripts/thesis/config/scope-boundary-matrix-v1.json")
        .read_text(encoding="utf-8")
    )
    metadata = json.loads(
        (ROOT / "scripts/thesis/config/program-metadata-evidence-confidence-v1.json")
        .read_text(encoding="utf-8")
    )
    exact_equal("scope policy", scope["policyRevision"], baseline["scopePolicyRevision"])
    exact_equal(
        "metadata policy",
        metadata["policyRevision"],
        baseline["metadataConfidenceRevision"],
    )

    authority_ref = baseline["authorityRef"]
    authority = next(p for p in registry["programs"] if p["id"] == authority_ref)
    exact_equal("historical program state", authority["lifecycleState"], "historical")
    exact_equal("historical program admission", authority["admissionState"], "review")
    exact_equal("authority observedCount", authority["observedCount"], expected["totalAuthorityWorks"])
    selected = [w for w in corpus["works"] if w.get("programRef") == authority_ref]
    exact_equal("authority works", len(selected), expected["totalAuthorityWorks"])
    statuses = dict(Counter(w.get("admissionStatus") for w in selected))
    exact_equal("authority admission", statuses, expected["authorityAdmissions"])
    units = dict(Counter(w.get("academicUnitRaw") for w in selected))
    exact_equal("authority units", units, expected["authorityAcademicUnits"])
    applicability = dict(Counter(
        (w.get("programMetadataEvidence") or {}).get("authorityApplicability")
        for w in selected
    ))
    exact_equal(
        "authority metadata applicability",
        applicability,
        expected["authorityMetadataApplicability"],
    )

    raw_variants = dict(sorted(Counter(
        w.get("programRaw") for w in selected
    ).items()))
    by_key: dict[str, dict[str, int]] = {}
    for raw, count in raw_variants.items():
        key = canonical.normalize_key(raw)
        by_key.setdefault(key, {})[raw] = count
        resolved = canonical.resolve_program(raw, registry)
        exact_equal(f"exact authority for {raw}", resolved["programRef"], authority_ref)
        exact_equal(f"review-only for {raw}", resolved["admissionState"], "review")

    exact_equal(
        "all historical exact raw variants",
        raw_variants,
        expected["rawProgramVariants"],
    )
    exact_equal(
        "all historical normalized keys",
        {k: sum(v.values()) for k, v in sorted(by_key.items())},
        expected["normalizedProgramKeys"],
    )
    key = expected["firstQueueNormalizedKey"]
    exact_equal(
        "first historical key variants",
        by_key.get(key),
        expected["firstQueueVariants"],
    )
    first = next((item for item in queue["items"] if item["normalizedKey"] == key), None)
    if first is None:
        raise AssertionError("expected historical orientation was missing from curation queue")
    exact_equal("first queue count", first["count"], expected["firstQueueCount"])
    exact_equal("first queue authority", first["authority"]["id"], authority_ref)
    exact_equal("first queue admission", first["authority"]["admissionState"], "review")
    exact_equal("first queue state", first["queueState"], "review")
    exact_equal(
        "first queue current admission",
        first["currentObservedAdmissionStatuses"],
        {"review": expected["firstQueueCount"]},
    )
    exact_equal("first queue variants", first["variants"], expected["firstQueueVariants"])
    exact_equal(
        "first queue year min", first["observedYears"]["min"],
        expected["firstQueueYears"]["min"],
    )
    exact_equal(
        "first queue year max", first["observedYears"]["max"],
        expected["firstQueueYears"]["max"],
    )
    exact_equal("next humanities key", queue["nextHumanitiesAction"]["normalizedKey"], key)
    for metric in (
        "humanitiesActionQueueItems", "humanitiesActionWorks",
        "workReviewQueueItems", "workReviewWorks"
    ):
        exact_equal(metric, queue["metrics"][metric], expected[metric])

    return {
        "schemaVersion": "thesis-mca-arte-comunicacion-evidence-audit-v1",
        "phase": "T2BL",
        "decision": "hold-review",
        "constraint": baseline["decisionConstraint"],
        "authorityRef": authority_ref,
        "programName": authority["canonicalName"],
        "registryRevision": registry["registryRevision"],
        "scopePolicyRevision": scope["policyRevision"],
        "metadataConfidenceRevision": metadata["policyRevision"],
        "metrics": {
            "corpusWorks": len(corpus["works"]),
            "authorityWorks": len(selected),
            "admission": statuses,
            "academicUnits": units,
            "authorityApplicability": applicability,
            "normalizedProgramKeys": {
                k: sum(v.values()) for k, v in sorted(by_key.items())
            },
            "rawProgramVariants": raw_variants,
            "firstQueueWorks": first["count"],
            "firstQueueYears": first["observedYears"],
            "globalAdmission": dict(Counter(
                w["admissionStatus"] for w in corpus["works"]
            )),
        },
        "evidence": baseline["evidence"],
        "invariants": baseline["invariants"],
        "finding": (
            "Official 1999 and 1998-1999 sources establish a distinct historical "
            "terminal orientation, but not a program-specific humanistic curriculum. "
            "REVIEW remains required; thesis subjects never resolve scope."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus", required=True)
    parser.add_argument("--queue", required=True)
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    corpus = json.loads(Path(args.corpus).read_text(encoding="utf-8"))
    queue = json.loads(Path(args.queue).read_text(encoding="utf-8"))
    baseline = json.loads(Path(args.baseline).read_text(encoding="utf-8"))
    registry = canonical.load_program_registry()
    report = build_report(corpus, queue, registry, baseline)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "phase": report["phase"], "decision": report["decision"],
        "metrics": report["metrics"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

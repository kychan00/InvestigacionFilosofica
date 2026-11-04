#!/usr/bin/env python3
"""T2CR — Aggregate reviewed Aleph candidate evidence by source and author.

The unit of inquiry is the *source thesis*, not each Aleph hit. This
prevents inflating discoveries when one author has many unrelated books.
No thesis identity or physical location is inferred from author similarity.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

SCHEMA = "thesis-philosophy-aleph-author-clusters-v1"
INPUT_SCHEMA = "thesis-philosophy-aleph-discrepancy-review-v1"
FORBIDDEN = re.compile(r"/F/[^\\s\\\"']+|(?i:session[-_]?id|cookie|password|bitstream|\\.pdf)")


def summarize(review: dict[str, Any]) -> dict[str, Any]:
    if review.get("schemaVersion") != INPUT_SCHEMA:
        raise ValueError("Expected T2CQ discrepancy review evidence")
    if not review.get("referenceOnly") or review.get("automaticIdentityPromotion") is not False:
        raise ValueError("Evidence must be reference-only, without identity promotion")
    if review.get("physicalClaimsAdded") is not False:
        raise ValueError("Evidence must not assert new physical locations")
    cases = []
    seen_source_ids: set[str] = set()
    all_systems: set[str] = set()
    total_author_hits = 0
    author_source_ids: set[str] = set()
    no_candidate_count = 0
    for row in review.get("reviews") or []:
        source_id = str(row.get("id") or "")
        if not source_id or source_id in seen_source_ids:
            raise ValueError("Each source thesis must have a distinct stable id")
        seen_source_ids.add(source_id)
        if row.get("status") not in {"unresolved", "ambiguous", "resolved"}:
            raise ValueError("Unexpected T2CQ decision")
        raw_candidates = row.get("reviewCandidates") or []
        if row["status"] == "resolved" and raw_candidates:
            raise ValueError("Resolved identities do not belong to the rejection queue")
        unique: dict[str, dict[str, Any]] = {}
        for candidate in raw_candidates:
            if (candidate.get("reviewOnly") is not True
                or candidate.get("sameWorkConfirmed") is not False
                or candidate.get("physicalLocationConfirmed") is not False):
                raise ValueError("Cannot promote unverified candidate evidence")
            sys = str(candidate.get("systemNumber") or "")
            if not re.fullmatch(r"\\d{9}", sys):
                raise ValueError("Invalid Aleph system number")
            if sys in unique:
                raise ValueError("Repeated system number within a source")
            unique[sys] = candidate
            all_systems.add(sys)
        author_hits = [c for c in unique.values() if c.get("sameAuthorTokens") is True]
        total_author_hits += len(author_hits)
        if author_hits:
            author_source_ids.add(source_id)
        if not unique:
            no_candidate_count += 1
        cases.append({
            "sourceId": source_id,
            "sourceTitle": row.get("sourceTitle"),
            "sourceAuthor": row.get("sourceAuthor"),
            "sourceYear": row.get("sourceYear"),
            "sourceProgram": row.get("sourceProgram"),
            "status": row["status"],
            "reason": row.get("reason"),
            "distinctCandidateCount": len(unique),
            "sameAuthorCandidateCount": len(author_hits),
            "candidateSystems": sorted(unique),
            "authorCandidateSystems": sorted(c["systemNumber"] for c in author_hits),
            "reviewPriority": (
                "author-overlap-different-title" if author_hits
                else "candidate-identity-discrepancy" if unique
                else "candidate-overflow-or-incomplete" if row.get("reason") in {
                    "candidate-overflow", "candidate-pool-too-large"
                } else "no-candidate-confirmed"
            ),
            "reviewOnly": True,
            "sourceThesisLocated": False,
        })
    return {
        "schemaVersion": SCHEMA,
        "referenceOnly": True,
        "autoMerged": False,
        "holdingsPromoted": False,
        "inputRevision": review.get("revision"),
        "inputOffset": review.get("offset"),
        "metrics": {
            "sourceThesesExamined": len(cases),
            "sourceThesesWithSameAuthorCandidates": len(author_source_ids),
            "sameAuthorCandidateHits": total_author_hits,
            "distinctAlephSystemsSeen": len(all_systems),
            "sourceThesesWithoutInspectedCandidates": no_candidate_count,
            "newThesesConfirmed": 0,
            "newPhysicalLocationsConfirmed": 0,
        },
        "cases": cases,
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    source = json.loads(args.input.read_text(encoding="utf-8"))
    result = summarize(source)
    raw = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if FORBIDDEN.search(raw):
        raise ValueError("Rejected session, credential or full-text data")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(raw, encoding="utf-8")
    print(json.dumps(result["metrics"], ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

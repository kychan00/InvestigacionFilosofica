#!/usr/bin/env python3
"""T2CQ: reference-only Aleph/CUCSH discrepancy evidence for human review.

This never reconciles a mismatching work or asserts physical holdings. It
captures bounded, explicitly rejected Aleph candidate metadata to investigate
why two institutional catalogues disagree.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import time
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[2]
T2CO = ROOT / "scripts/thesis/resolve_philosophy_holdings_batches_t2co.py"
spec = importlib.util.spec_from_file_location("t2co_review", T2CO)
t2co = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(t2co)
pilot = t2co.pilot

SCHEMA = "thesis-philosophy-aleph-discrepancy-review-v1"
REVISION = "2026-11-04.t2cq-v1"
SAFE_KEYS = {"título", "titulo", "autor", "nota de tesis", "base lógica", "base logica", "número de sistema", "numero de sistema"}
ALLOWED_STATUSES = {"resolved", "unresolved", "ambiguous"}
FORBIDDEN = re.compile(r"/F/[^\\s\\\"']+|(?i:session[-_]?id|cookie|password|bitstream|\\.pdf)")


def public_metadata(fields: dict[str, str]) -> dict[str, str]:
    """Restrict evidence to bibliographic fields, never URLs or raw HTML."""
    result = {}
    for key, value in fields.items():
        canonical = str(key).casefold().strip()
        if canonical not in SAFE_KEYS:
            continue
        clean = " ".join(str(value).split())[:400]
        if FORBIDDEN.search(clean):
            continue
        result[canonical] = clean
    return result


def review_candidate(source: dict[str, Any], system_number: str, fields: dict[str, str]) -> dict[str, Any]:
    safe = public_metadata(fields)
    exact, flags = pilot.exact_bibliographic_match(source, safe)
    observed_sys = safe.get("número de sistema") or safe.get("numero de sistema")
    if observed_sys and observed_sys != system_number:
        flags.append("system-number-mismatch")
    if exact and not t2co.has_thesis_evidence(safe):
        flags.append("missing-thesis-evidence")
    title = safe.get("título") or safe.get("titulo") or ""
    author = safe.get("autor") or ""
    same_author = bool(
        pilot.author_tokens((source.get("authors") or [""])[0])
        and pilot.author_tokens((source.get("authors") or [""])[0]) == pilot.author_tokens(author)
    )
    return {
        "systemNumber": system_number,
        "observedTitle": title,
        "observedAuthor": author,
        "observedThesisEvidence": t2co.has_thesis_evidence(safe),
        "sameAuthorTokens": same_author,
        "reviewReasons": sorted(set(flags)),
        "reviewOnly": True,
        "sameWorkConfirmed": False,
        "physicalLocationConfirmed": False,
    }


def audit_one(
    source: dict[str, Any],
    *,
    opener: Any,
    action: str,
    query: Callable[..., list[str]] | None = None,
    fetch: Callable[..., tuple[dict[str, Any], list[dict[str, str]]]] | None = None,
    max_candidates: int = 8,
) -> dict[str, Any]:
    """Piggyback on T2CO's strict identity decisions; capture only metadata."""
    actual_fetch = fetch or pilot.fetch_record
    captured: dict[str, dict[str, str]] = {}

    def capture(opener: Any, action: str, system_number: str):
        record, holdings = actual_fetch(opener, action, system_number)
        captured[system_number] = public_metadata(record.get("fields") or {})
        return record, holdings

    options = {"opener": opener, "action": action, "fetch": capture, "max_candidates": max_candidates}
    if query is not None:
        options["query"] = query
    decision = t2co.resolve_one(source, **options)
    if decision["status"] not in ALLOWED_STATUSES:
        raise ValueError("Unknown resolution status")
    if decision["status"] == "resolved":
        # A confirmed identity belongs in the validated holdings pipeline,
        # never in a discrepancy list.
        return {"decision": decision, "candidates": []}
    candidates = [
        review_candidate(source, system_number, fields)
        for system_number, fields in sorted(captured.items())
    ]
    return {"decision": decision, "candidates": candidates}


def build_review(
    whereabouts: dict[str, Any],
    seeds: dict[str, Any],
    *,
    offset: int,
    limit: int,
    opener: Any = None,
    action: str = "",
    auditor: Callable[..., dict[str, Any]] = audit_one,
    sleep_seconds: float = 0.2,
) -> dict[str, Any]:
    if offset < 0 or not 1 <= limit <= 40:
        raise ValueError("Offset must be nonnegative; limit must be 1..40")
    eligible = t2co.eligible_records(whereabouts, seeds)
    batch = eligible[offset:offset + limit]
    if batch and opener is None:
        opener, action = pilot.open_session()
    reviews = []
    for index, row in enumerate(batch):
        outcome = auditor(row, opener=opener, action=action)
        decision = outcome["decision"]
        candidates = outcome["candidates"]
        if decision["status"] == "resolved" and candidates:
            raise ValueError("Resolved record must not be in discrepancy queue")
        reviews.append({
            "id": row["id"],
            "sourceTitle": row["title"],
            "sourceAuthor": row["authors"][0],
            "sourceYear": row.get("year"),
            "sourceProgram": row.get("program"),
            "status": decision["status"],
            "reason": decision.get("reason"),
            "searchAttempts": decision.get("attempts", []),
            "candidateRecordsChecked": len(candidates),
            "reviewCandidates": candidates,
            "whereaboutsStatus": row.get("whereaboutsStatus"),
        })
        if index + 1 < len(batch) and sleep_seconds:
            time.sleep(sleep_seconds)
    return {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "canonicalAdmissionMutation": False,
        "automaticIdentityPromotion": False,
        "physicalClaimsAdded": False,
        "sessionUrlsPersisted": False,
        "rawHtmlPersisted": False,
        "inputRevision": whereabouts.get("revision"),
        "selectionStrategy": "nonseed-decade-round-robin-offset-v1",
        "offset": offset,
        "limit": limit,
        "metrics": {
            "inputRecords": len(whereabouts.get("records") or []),
            "eligible": len(eligible),
            "attempted": len(reviews),
            "unresolved": sum(x["status"] == "unresolved" for x in reviews),
            "ambiguous": sum(x["status"] == "ambiguous" for x in reviews),
            "resolved": sum(x["status"] == "resolved" for x in reviews),
            "reviewCandidates": sum(len(x["reviewCandidates"]) for x in reviews),
            "sameAuthorReviewCandidates": sum(
                c["sameAuthorTokens"] for x in reviews for c in x["reviewCandidates"]
            ),
            "remaining": max(0, len(eligible) - offset - len(reviews)),
        },
        "reviews": reviews,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--whereabouts-index", required=True, type=Path)
    parser.add_argument("--seeds", required=True, type=Path)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--limit", type=int, default=8)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    result = build_review(
        json.loads(args.whereabouts_index.read_text(encoding="utf-8")),
        json.loads(args.seeds.read_text(encoding="utf-8")),
        offset=args.offset, limit=args.limit,
    )
    output = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if FORBIDDEN.search(output):
        raise ValueError("Sensitive or full-text content rejected")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output, encoding="utf-8")
    print(json.dumps(result["metrics"], ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

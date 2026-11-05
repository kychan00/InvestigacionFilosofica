#!/usr/bin/env python3
"""T2CZ: resolve T2CY MEF thesis candidates against the live UdeG Aleph OPAC.

Search is discovery only. A SYS becomes an institutional MEF work identity only
when title + author + thesis evidence + programme evidence are all present.
Dynamic Aleph sessions and raw HTML are never persisted.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[2]
PILOT_PATH = ROOT / "scripts/thesis/resolve_philosophy_holdings_v1.py"
T2CO_PATH = ROOT / "scripts/thesis/resolve_philosophy_holdings_batches_t2co.py"

pilot_spec = importlib.util.spec_from_file_location("t2cz_pilot", PILOT_PATH)
pilot = importlib.util.module_from_spec(pilot_spec)
assert pilot_spec.loader is not None
pilot_spec.loader.exec_module(pilot)

t2co_spec = importlib.util.spec_from_file_location("t2cz_t2co", T2CO_PATH)
t2co = importlib.util.module_from_spec(t2co_spec)
assert t2co_spec.loader is not None
t2co_spec.loader.exec_module(t2co)

SCHEMA = "thesis-mef-aleph-resolution-t2cz-v1"
REVISION = "2026-11-05.t2cz-v1"
MAX_CANDIDATES = 8
FORBIDDEN = re.compile(r"/F/[^\s\"']+|(?i:session[-_]?id|cookie|password|bitstream|\.pdf)")
PROGRAM_MARKERS = (
    "maestria en estudios filosoficos",
    "maestro en estudios filosoficos",
    "maestra en estudios filosoficos",
    "estudios filosoficos",
)


def expected_author_forms(row: dict[str, Any]) -> list[tuple[str, str]]:
    """Return only author forms justified by T2CY evidence."""
    forms: list[tuple[str, str]] = []
    canonical = str(row.get("canonicalName") or "").strip()
    source = str(row.get("sourceAuthor") or "").strip()
    if canonical:
        forms.append((canonical, "canonical"))
    elif source:
        forms.append((source, "source"))

    candidate = str(row.get("canonicalCandidate") or "").strip()
    if candidate and row.get("authorIdentityStatus") != "variant-review":
        # Only trust an expanded candidate when an institutional corroboration
        # explicitly supports both programme and exact thesis title.
        for item in row.get("corroboration") or []:
            supports = set(item.get("supports") or [])
            kind = str(item.get("kind") or "")
            if (
                {"program", "exactThesisTitle"} <= supports
                and kind.startswith("institutional-")
            ):
                forms.append((candidate, "institutional-corroborated-alias"))
                break

    unique: list[tuple[str, str]] = []
    seen: set[tuple[str, ...]] = set()
    for value, kind in forms:
        tokens = pilot.author_tokens(value)
        if tokens and tokens not in seen:
            seen.add(tokens)
            unique.append((value, kind))
    return unique


def programme_evidence(fields: dict[str, str]) -> bool:
    note = pilot.normalize(fields.get("nota de tesis"))
    base = pilot.normalize(fields.get("base lógica") or fields.get("base logica"))
    text = " ".join([note, base]).strip()
    return any(marker in text for marker in PROGRAM_MARKERS)


def safe_fields(fields: dict[str, str]) -> dict[str, str]:
    allowed = {
        "número de sistema",
        "numero de sistema",
        "autor",
        "título",
        "titulo",
        "nota de tesis",
        "base lógica",
        "base logica",
    }
    out: dict[str, str] = {}
    for key, value in fields.items():
        canonical = str(key).casefold().strip()
        if canonical not in allowed:
            continue
        clean = " ".join(str(value).split())[:800]
        if FORBIDDEN.search(clean):
            continue
        out[canonical] = clean
    return out


def query_plan(row: dict[str, Any]) -> list[tuple[str, str, str]]:
    title = str(row.get("exactTitleCandidate") or "").strip()
    plans = [("WTI", title, "N"), ("WTI", title, "Y")]
    # Variant-review identities are never searched by author automatically.
    if row.get("authorIdentityStatus") != "variant-review":
        author = str(row.get("canonicalName") or row.get("sourceAuthor") or "").strip()
        if author:
            plans.append(("WAU", author, "Y"))
    return [(code, request, adjacent) for code, request, adjacent in plans if request]


def adjudicate_candidate(
    row: dict[str, Any],
    system_number: str,
    fields: dict[str, str],
    holdings: list[dict[str, str]],
) -> dict[str, Any]:
    fields = safe_fields(fields)
    observed_title = fields.get("título") or fields.get("titulo") or ""
    observed_author = fields.get("autor") or ""
    title_exact = bool(
        pilot.title_core(row.get("exactTitleCandidate"))
        and pilot.title_core(row.get("exactTitleCandidate")) == pilot.title_core(observed_title)
    )

    author_match = False
    author_match_kind = None
    observed_tokens = pilot.author_tokens(observed_author)
    for expected, kind in expected_author_forms(row):
        if observed_tokens and observed_tokens == pilot.author_tokens(expected):
            author_match = True
            author_match_kind = kind
            break

    thesis_evidence = t2co.has_thesis_evidence(fields)
    program_confirmed = programme_evidence(fields)
    variant_review = row.get("authorIdentityStatus") == "variant-review"

    institutional = (
        title_exact
        and author_match
        and thesis_evidence
        and program_confirmed
        and not variant_review
    )
    physical = institutional and bool(holdings)

    if institutional:
        status = "institutional-work-confirmed"
    elif title_exact and author_match and thesis_evidence:
        status = "exact-work-program-unresolved"
    elif title_exact:
        status = "title-exact-review"
    else:
        status = "rejected"

    return {
        "systemNumber": system_number,
        "observedTitle": observed_title,
        "observedAuthor": observed_author,
        "titleExact": title_exact,
        "authorExact": author_match,
        "authorMatchKind": author_match_kind,
        "thesisEvidence": thesis_evidence,
        "programEvidence": program_confirmed,
        "variantReview": variant_review,
        "institutionalWorkIdentityConfirmed": institutional,
        "physicalHoldingConfirmed": physical,
        "holdings": holdings if physical else [],
        "status": status,
        "recordFields": fields,
    }


def resolve_one(
    row: dict[str, Any],
    *,
    opener: Any,
    action: str,
    query: Callable[..., list[str]] = pilot.query_candidates,
    fetch: Callable[..., tuple[dict[str, Any], list[dict[str, str]]]] = pilot.fetch_record,
    max_candidates: int = MAX_CANDIDATES,
) -> dict[str, Any]:
    attempts: list[dict[str, Any]] = []
    candidates: list[str] = []
    overflow = False

    for code, request, adjacent in query_plan(row):
        try:
            systems = list(dict.fromkeys(
                value
                for value in query(opener, action, code=code, request=request, adjacent=adjacent)
                if re.fullmatch(r"\d{9}", str(value))
            ))
            attempts.append({
                "code": code,
                "adjacent": adjacent,
                "candidateCount": len(systems),
                "status": "ok",
            })
        except Exception:
            attempts.append({"code": code, "adjacent": adjacent, "status": "error"})
            continue

        if len(systems) > max_candidates:
            overflow = True
            continue
        for number in systems:
            if number not in candidates:
                candidates.append(number)

        # Exact-title searches are preferred. If they found a bounded pool,
        # do not broaden to author discovery.
        if code == "WTI" and systems:
            break

    if len(candidates) > max_candidates:
        return {
            "status": "unresolved",
            "reason": "candidate-pool-too-large",
            "attempts": attempts,
            "candidates": [],
        }

    reviews: list[dict[str, Any]] = []
    fetch_errors = 0
    for system_number in candidates:
        try:
            record, holdings = fetch(opener, action, system_number)
        except Exception:
            fetch_errors += 1
            continue
        reviews.append(
            adjudicate_candidate(
                row,
                system_number,
                record.get("fields") or {},
                holdings,
            )
        )

    confirmed = [x for x in reviews if x["institutionalWorkIdentityConfirmed"]]
    if len(confirmed) == 1:
        result_status = "resolved"
        reason = None
    elif len(confirmed) > 1:
        result_status = "ambiguous"
        reason = "multiple-institutional-identities"
    else:
        result_status = "unresolved"
        if overflow:
            reason = "candidate-overflow"
        elif fetch_errors and not reviews:
            reason = "candidate-fetch-failure"
        elif reviews:
            reason = "no-program-confirmed-institutional-identity"
        else:
            reason = "no-candidates"

    return {
        "status": result_status,
        "reason": reason,
        "attempts": attempts,
        "candidateRecordsChecked": len(reviews),
        "recordFetchErrors": fetch_errors,
        "candidates": reviews,
    }


def build(
    t2cy: dict[str, Any],
    *,
    opener: Any = None,
    action: str = "",
    resolver: Callable[..., dict[str, Any]] = resolve_one,
    sleep_seconds: float = 0.2,
) -> dict[str, Any]:
    if t2cy.get("schemaVersion") != "thesis-mef-supervision-evidence-t2cy-v1":
        raise ValueError("Unsupported T2CY input")
    records = list(t2cy.get("records") or [])
    if len(records) != 11:
        raise ValueError("T2CZ expects the frozen 11-entry T2CY ledger")

    if records and opener is None:
        opener, action = pilot.open_session()

    results: list[dict[str, Any]] = []
    for index, row in enumerate(records):
        outcome = resolver(row, opener=opener, action=action)
        results.append({
            "sourceAuthor": row.get("sourceAuthor"),
            "canonicalName": row.get("canonicalName"),
            "canonicalCandidate": row.get("canonicalCandidate"),
            "authorIdentityStatus": row.get("authorIdentityStatus"),
            "exactTitleCandidate": row.get("exactTitleCandidate"),
            "approvalDate": row.get("approvalDate"),
            "t2cyDecision": row.get("decision"),
            **outcome,
        })
        if index + 1 < len(records) and sleep_seconds:
            time.sleep(sleep_seconds)

    institutional = [
        candidate
        for row in results
        for candidate in row.get("candidates") or []
        if candidate.get("institutionalWorkIdentityConfirmed")
    ]
    physical = [x for x in institutional if x.get("physicalHoldingConfirmed")]
    exact_work_program_unresolved = sum(
        candidate.get("status") == "exact-work-program-unresolved"
        for row in results
        for candidate in row.get("candidates") or []
    )

    return {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "canonicalAdmissionMutation": False,
        "programAuthorityMutation": False,
        "publicProjectionMutation": False,
        "sessionUrlsPersisted": False,
        "rawHtmlPersisted": False,
        "sourceRevision": t2cy.get("revision"),
        "metrics": {
            "inputRecords": len(records),
            "resolved": sum(row["status"] == "resolved" for row in results),
            "ambiguous": sum(row["status"] == "ambiguous" for row in results),
            "unresolved": sum(row["status"] == "unresolved" for row in results),
            "institutionalWorkIdentitiesConfirmed": len(institutional),
            "physicalHoldingsConfirmed": len(physical),
            "exactWorkProgramUnresolvedCandidates": exact_work_program_unresolved,
            "publicRecordsAdded": 0,
        },
        "results": results,
    }


def validate_output(data: dict[str, Any]) -> None:
    if data.get("schemaVersion") != SCHEMA:
        raise ValueError("Wrong T2CZ output schema")
    output = json.dumps(data, ensure_ascii=False, sort_keys=True)
    if FORBIDDEN.search(output):
        raise ValueError("Sensitive/session/full-text material detected")
    metrics = data.get("metrics") or {}
    if metrics.get("inputRecords") != 11:
        raise ValueError("T2CZ input cardinality drift")
    if metrics.get("publicRecordsAdded") != 0:
        raise ValueError("T2CZ must remain reference-only")
    for row in data.get("results") or []:
        for candidate in row.get("candidates") or []:
            if candidate.get("physicalHoldingConfirmed") and not candidate.get("institutionalWorkIdentityConfirmed"):
                raise ValueError("Physical holding cannot precede institutional work identity")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    t2cy = json.loads(args.input.read_text(encoding="utf-8"))
    result = build(t2cy)
    validate_output(result)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(result["metrics"], ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

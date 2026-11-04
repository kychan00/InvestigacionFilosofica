#!/usr/bin/env python3
"""T2CO: paginated, strict Aleph discovery for T2CL whereabouts references.

Search terms generate candidates only. Only a unique exact bibliography with
explicit thesis evidence can become a resolved identity; no PDFs or sessions
are persisted.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PILOT = ROOT / "scripts/thesis/resolve_philosophy_holdings_v1.py"
spec = importlib.util.spec_from_file_location("t2cn_resolver", PILOT)
pilot = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(pilot)

SCHEMA = "thesis-philosophy-holdings-batch-v1"
REVISION = "2026-11-04.t2co-v1"
STOPWORDS = {
    "a", "al", "ante", "como", "con", "de", "del", "desde", "el", "en",
    "entre", "es", "esta", "este", "la", "las", "lo", "los", "o", "para",
    "por", "que", "se", "sin", "sobre", "su", "sus", "un", "una", "y",
}


def eligible_records(whereabouts: dict[str, Any], seeds: dict[str, Any]) -> list[dict[str, Any]]:
    if whereabouts.get("schemaVersion") != "thesis-philosophy-whereabouts-index-v1":
        raise ValueError("Unsupported whereabouts schema")
    if seeds.get("schemaVersion") != "philosophy-aleph-identity-seeds-v1":
        raise ValueError("Unsupported seed schema")
    known = set(pilot.seed_map(seeds))
    groups: dict[int | None, list[dict[str, Any]]] = {}
    for row in whereabouts.get("records") or []:
        if row.get("whereaboutsStatus") != "cataloged-location-unresolved":
            continue
        if row.get("reviewFlags"):
            continue
        authors = row.get("authors") or []
        if not row.get("title") or not authors or not row.get("id"):
            continue
        key = (pilot.title_core(row["title"]), pilot.author_tokens(authors[0]))
        if key in known:
            continue
        year = row.get("year")
        decade = year // 10 * 10 if isinstance(year, int) and 1800 <= year <= 2100 else None
        groups.setdefault(decade, []).append(row)
    for group in groups.values():
        group.sort(key=lambda row: (
            -(row.get("year") or 0) if isinstance(row.get("year"), int) else 0,
            pilot.title_core(row["title"]), row["id"],
        ))
    ordered: list[dict[str, Any]] = []
    keys = sorted((key for key in groups if key is not None))
    if None in groups:
        keys.append(None)
    for index in range(max((len(group) for group in groups.values()), default=0)):
        for key in keys:
            if index < len(groups[key]):
                ordered.append(groups[key][index])
    return ordered


def distinctive_terms(title: str) -> list[str]:
    tokens = [
        token for token in pilot.title_core(title).split()
        if token not in STOPWORDS and len(token) >= 5
    ]
    return list(dict.fromkeys(sorted(tokens, key=lambda term: (-len(term), term))))[:3]


def strategies(row: dict[str, Any]) -> list[tuple[str, str, str]]:
    title = str(row.get("title") or "").strip()
    author = str((row.get("authors") or [""])[0]).strip()
    terms = distinctive_terms(title)
    queries = [("WTI", title, "N"), ("WTI", title, "Y"), ("WAU", author, "Y")]
    if len(terms) >= 2:
        queries.append(("WTI", " ".join(terms[:2]), "N"))
    # Do not query an isolated title word: the live OPAC systematically
    # fills its first 10-result page, making identity adjudication incomplete.
    # Distinctive *pairs* are discovery only; the full record still decides.
    return [(code, request, adjacent) for code, request, adjacent in queries if request]


def has_thesis_evidence(fields: dict[str, str]) -> bool:
    base = pilot.normalize(fields.get("base lógica") or fields.get("base logica"))
    note = pilot.normalize(fields.get("nota de tesis"))
    return "tesis" in base.split() or bool(note)


def resolve_one(
    row: dict[str, Any],
    *,
    opener: Any,
    action: str,
    query=pilot.query_candidates,
    fetch=pilot.fetch_record,
    max_candidates: int = 8,
) -> dict[str, Any]:
    candidates: dict[str, str] = {}
    attempts: list[dict[str, Any]] = []
    overflow = False
    for code, request, adjacent in strategies(row):
        try:
            systems = query(opener, action, code=code, request=request, adjacent=adjacent)
            systems = list(dict.fromkeys(
                value for value in systems if re.fullmatch(r"\d{9}", str(value))
            ))
            attempts.append({
                "code": code, "adjacent": adjacent, "candidateCount": len(systems),
                "status": "ok",
            })
            if len(systems) > max_candidates:
                overflow = True
                continue
            for number in systems:
                candidates.setdefault(number, code + "-" + adjacent)
        except Exception:
            # Do not persist raw error strings: Aleph exceptions may contain
            # dynamic /F/<session> URLs.
            attempts.append({"code": code, "adjacent": adjacent, "status": "error"})
    if len(candidates) > max_candidates:
        # No arbitrary truncation or adjudication against a partial pool.
        return {
            "status": "unresolved", "reason": "candidate-pool-too-large",
            "attempts": attempts,
        }
    matches: list[dict[str, Any]] = []
    rejected = 0
    fetch_errors = 0
    rejected_reasons: Counter[str] = Counter()
    for number, method in candidates.items():
        try:
            record, holdings = fetch(opener, action, number)
            fields = record["fields"]
            exact, flags = pilot.exact_bibliographic_match(row, fields)
            observed_number = fields.get("número de sistema") or fields.get("numero de sistema")
            if observed_number and observed_number != number:
                exact = False
                flags.append("system-number-mismatch")
            if exact and has_thesis_evidence(fields):
                matches.append({
                    "systemNumber": number,
                    "method": method,
                    "holdings": holdings,
                    "recordFields": fields,
                })
            else:
                rejected += 1
                if exact:
                    rejected_reasons["missing-thesis-evidence"] += 1
                else:
                    for reason in flags:
                        rejected_reasons[reason] += 1
        except Exception:
            fetch_errors += 1
    if len(matches) > 1:
        return {
            "status": "ambiguous", "reason": "multiple-exact-identities",
            "matchingSystemNumbers": [item["systemNumber"] for item in matches],
            "attempts": attempts,
        }
    if len(matches) == 1:
        return {"status": "resolved", **matches[0], "attempts": attempts}
    return {
        "status": "unresolved",
        "reason": (
            "candidate-overflow" if overflow else
            "candidate-fetch-failure" if fetch_errors else
            "no-exact-thesis-identity"
        ),
        "rejectedCandidates": rejected,
        "candidateRecordsChecked": len(candidates) - fetch_errors,
        "recordFetchErrors": fetch_errors,
        "rejectionReasonCounts": dict(sorted(rejected_reasons.items())),
        "attempts": attempts,
    }


def build_batch(
    whereabouts: dict[str, Any],
    seeds: dict[str, Any],
    *,
    offset: int,
    limit: int,
    opener: Any = None,
    action: str = "",
    resolver=resolve_one,
    sleep_seconds: float = 0.2,
) -> dict[str, Any]:
    if offset < 0 or not 1 <= limit <= 40:
        raise ValueError("Offset must be >= 0 and limit in [1,40]")
    eligible = eligible_records(whereabouts, seeds)
    selected = eligible[offset:offset + limit]
    if selected and opener is None:
        opener, action = pilot.open_session()
    decisions = []
    for index, row in enumerate(selected):
        decision = resolver(row, opener=opener, action=action)
        decisions.append({
            "id": row["id"], "title": row["title"],
            "author": row["authors"][0], "year": row.get("year"), **decision,
        })
        if index + 1 < len(selected) and sleep_seconds:
            time.sleep(sleep_seconds)
    resolved = [row for row in decisions if row["status"] == "resolved"]
    return {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "canonicalAdmissionMutation": False,
        "sessionUrlsPersisted": False,
        "rawHtmlPersisted": False,
        "selectionStrategy": "nonseed-decade-round-robin-offset-v1",
        "inputRevision": whereabouts.get("revision"),
        "offset": offset,
        "limit": limit,
        "metrics": {
            "inputRecords": len(whereabouts.get("records") or []),
            "eligible": len(eligible),
            "attempted": len(decisions),
            "resolved": len(resolved),
            "physicalConfirmed": sum(bool(row.get("holdings")) for row in resolved),
            "ambiguous": sum(row["status"] == "ambiguous" for row in decisions),
            "unresolved": sum(row["status"] == "unresolved" for row in decisions),
            "remaining": max(0, len(eligible) - offset - len(decisions)),
            "unresolvedOverflow": sum(
                row["status"] == "unresolved"
                and row.get("reason") in {"candidate-overflow", "candidate-pool-too-large"}
                for row in decisions
            ),
        },
        "decisions": decisions,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--whereabouts-index", required=True, type=Path)
    parser.add_argument("--seeds", required=True, type=Path)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    data = build_batch(
        json.loads(args.whereabouts_index.read_text(encoding="utf-8")),
        json.loads(args.seeds.read_text(encoding="utf-8")),
        offset=args.offset, limit=args.limit,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    output = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if re.search(r"/F/[^\s\"']+|(?i:session[-_]?id|cookie|password|bitstream|\\.pdf)", output):
        raise ValueError("Sensitive or full-text material detected")
    args.output.write_text(output, encoding="utf-8")
    print(json.dumps(data["metrics"], ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

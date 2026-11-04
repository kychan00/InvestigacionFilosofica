#!/usr/bin/env python3
"""Resolve a bounded T2CL batch against Aleph and attach verified holdings."""
from __future__ import annotations

import argparse
import copy
import importlib.util
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
import http.cookiejar
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
OPAC_PATH = ROOT / "scripts" / "thesis" / "probe_udg_opac_endpoints_v1.py"

spec = importlib.util.spec_from_file_location("t2cm_opac", OPAC_PATH)
opac = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(opac)

SCHEMA = "thesis-philosophy-holdings-resolution-v1"
REVISION = "2026-11-04.t2cn-pilot-v2"
ROLE_WORDS = {
    "autor", "autora", "sustentante", "tesis", "tesista", "presenta",
    "licenciado", "licenciada", "maestro", "maestra", "doctor", "doctora",
}


def normalize(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.casefold()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def title_core(value: Any) -> str:
    text = str(value or "")
    text = re.split(r"\s+/\s+", text, maxsplit=1)[0]
    return normalize(text)


def author_tokens(value: Any) -> tuple[str, ...]:
    tokens = [
        token for token in normalize(value).split()
        if token not in ROLE_WORDS
    ]
    return tuple(sorted(tokens))


def exact_bibliographic_match(
    source: dict[str, Any],
    fields: dict[str, str],
) -> tuple[bool, list[str]]:
    flags = []
    source_title = title_core(source.get("title"))
    record_title = title_core(fields.get("título") or fields.get("titulo"))
    if not source_title or not record_title or source_title != record_title:
        flags.append("title-not-exact")

    source_author = author_tokens((source.get("authors") or [""])[0])
    record_author = author_tokens(fields.get("autor"))
    if not source_author or not record_author or source_author != record_author:
        flags.append("author-not-exact")

    return not flags, flags


def record_fields(page: dict[str, Any]) -> dict[str, str]:
    fields: dict[str, str] = {}
    allowed = {
        "número de sistema", "numero de sistema", "autor", "título", "titulo",
        "nota de tesis", "biblioteca", "base lógica", "base logica",
    }
    for row in page.get("relevantRows") or []:
        if len(row) < 2:
            continue
        key = opac.one_line(row[0]).casefold()
        if key in allowed:
            fields[key] = opac.one_line(row[1])
    return fields


def system_numbers_from_search(page: dict[str, Any]) -> list[str]:
    found: list[str] = []
    for link in page.get("relevantLinks") or []:
        parsed = urllib.parse.urlparse(link.get("url") or "")
        query = urllib.parse.parse_qs(parsed.query)
        for value in query.get("doc_number") or []:
            if re.fullmatch(r"\d{9}", value) and value not in found:
                found.append(value)
    return found


def search_url(
    action: str,
    *,
    find_code: str,
    request: str,
    adjacent: str,
) -> str:
    params = [
        ("func", "find-b"),
        ("request", request),
        ("find_code", find_code),
        ("adjacent", adjacent),
        ("local_base", "UDG01"),
        ("filter_code_1", "WLN"),
        ("filter_request_1", ""),
        ("filter_code_2", "WYR"),
        ("filter_request_2", ""),
        ("filter_code_3", "WYR"),
        ("filter_request_3", ""),
        ("filter_code_4", "WFM"),
        ("filter_request_4", ""),
    ]
    return action + ("&" if "?" in action else "?") + urllib.parse.urlencode(params)


def open_session() -> tuple[urllib.request.OpenerDirector, str]:
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    failures = []
    for attempt in range(1, 5):
        try:
            html, final, _, _ = opac.fetch_with_opener(
                opener, opac.CUCSH_OPAC, timeout=40
            )
            parser = opac.FormContractParser()
            parser.feed(html)
            actions = [
                urllib.parse.urljoin(final, form.get("action") or "")
                for form in parser.forms
                if form.get("action")
            ]
            actions = [url for url in actions if opac.is_safe_candidate(url)]
            if actions:
                return opener, actions[0]
            failures.append(f"attempt {attempt}: no safe action")
        except Exception as exc:
            failures.append(f"attempt {attempt}: {exc}")
        if attempt < 4:
            time.sleep(1)
    raise RuntimeError("Aleph session failed: " + " | ".join(failures))


def fetch_record(
    opener: urllib.request.OpenerDirector,
    action: str,
    system_number: str,
) -> tuple[dict[str, Any], list[dict[str, str]]]:
    url = opac.direct_record_url(action, system_number, "UDG01")
    page = opac.page_evidence(url, opener=opener)
    fields = record_fields(page)
    if fields.get("número de sistema") not in {None, system_number}:
        raise ValueError("Aleph direct record returned another system number")

    holdings: list[dict[str, str]] = []
    item_urls = [
        link["url"]
        for link in page.get("relevantLinks") or []
        if link.get("func") == "item-global"
    ]
    for item_url in item_urls[:4]:
        item_page = opac.page_evidence(item_url, opener=opener)
        for holding in opac.extract_holdings(item_page):
            if holding not in holdings:
                holdings.append(holding)
    return {"fields": fields}, holdings


def query_candidates(
    opener: urllib.request.OpenerDirector,
    action: str,
    *,
    code: str,
    request: str,
    adjacent: str,
) -> list[str]:
    page = opac.page_evidence(
        search_url(action, find_code=code, request=request, adjacent=adjacent),
        opener=opener,
    )
    return system_numbers_from_search(page)


def seed_map(payload: dict[str, Any]) -> dict[tuple[str, tuple[str, ...]], str]:
    output = {}
    for row in payload.get("records") or []:
        key = (title_core(row.get("title")), author_tokens(row.get("author")))
        output[key] = row["systemNumber"]
    return output


def resolve_record(
    source: dict[str, Any],
    *,
    opener: urllib.request.OpenerDirector,
    action: str,
    seeds: dict[tuple[str, tuple[str, ...]], str],
) -> dict[str, Any]:
    source_key = (
        title_core(source.get("title")),
        author_tokens((source.get("authors") or [""])[0]),
    )
    attempts = []
    candidates: list[tuple[str, str]] = []

    if source_key in seeds:
        candidates.append((seeds[source_key], "verified-seed"))
    else:
        queries = [
            ("WTI", source.get("title") or "", "N"),
            ("WTI", source.get("title") or "", "Y"),
            ("WAU", (source.get("authors") or [""])[0], "Y"),
        ]
        for code, request, adjacent in queries:
            if not request:
                continue
            try:
                systems = query_candidates(
                    opener, action, code=code, request=request, adjacent=adjacent
                )
            except Exception as exc:
                attempts.append({
                    "code": code, "adjacent": adjacent, "status": "error",
                    "error": str(exc),
                })
                continue
            attempts.append({
                "code": code,
                "adjacent": adjacent,
                "status": "ok",
                "candidateCount": len(systems),
            })
            if len(systems) == 1:
                candidates.append((systems[0], f"{code}-{adjacent}"))
                break
            if len(systems) > 1:
                # Candidate discovery only; validate all if the set is bounded.
                if len(systems) <= 8:
                    candidates.extend((number, f"{code}-{adjacent}-multi") for number in systems)
                break

    unique_candidates = []
    seen = set()
    for system_number, method in candidates:
        if system_number in seen:
            continue
        seen.add(system_number)
        unique_candidates.append((system_number, method))

    matches = []
    rejected = []
    for system_number, method in unique_candidates[:8]:
        try:
            record, holdings = fetch_record(opener, action, system_number)
        except Exception as exc:
            rejected.append({
                "systemNumber": system_number,
                "method": method,
                "reason": "record-fetch-error",
                "error": str(exc),
            })
            continue
        exact, flags = exact_bibliographic_match(source, record["fields"])
        if method == "verified-seed":
            # T2CM already manually verified these exact bibliographic identities.
            exact = True
            flags = []
        if exact:
            matches.append({
                "systemNumber": system_number,
                "method": method,
                "fields": record["fields"],
                "holdings": holdings,
            })
        else:
            rejected.append({
                "systemNumber": system_number,
                "method": method,
                "reason": "bibliographic-mismatch",
                "flags": flags,
                "fields": record["fields"],
            })

    if len(matches) == 1:
        match = matches[0]
        return {
            "status": "resolved",
            "systemNumber": match["systemNumber"],
            "method": match["method"],
            "holdings": match["holdings"],
            "recordFields": match["fields"],
            "attempts": attempts,
            "rejectedCandidates": rejected,
        }
    if len(matches) > 1:
        return {
            "status": "ambiguous",
            "attempts": attempts,
            "matchingCandidates": [
                {"systemNumber": row["systemNumber"], "method": row["method"]}
                for row in matches
            ],
            "rejectedCandidates": rejected,
        }
    return {
        "status": "unresolved",
        "attempts": attempts,
        "rejectedCandidates": rejected,
    }


def apply_resolution(
    record: dict[str, Any],
    decision: dict[str, Any],
) -> dict[str, Any]:
    output = copy.deepcopy(record)
    output.setdefault("identity", {})
    output.setdefault("catalogEvidence", [])

    if decision["status"] != "resolved":
        output.setdefault("reviewFlags", []).append({
            "type": "aleph-holdings-resolution",
            "status": decision["status"],
        })
        return output

    output["identity"]["alephSystemNumber"] = decision["systemNumber"]
    holdings = decision.get("holdings") or []
    output["physicalLocation"] = {
        "provider": "aleph-opac",
        "systemNumber": decision["systemNumber"],
        "holdings": holdings,
    } if holdings else None
    output["catalogEvidence"].append({
        "source": "aleph-opac",
        "systemNumber": decision["systemNumber"],
        "matchMethod": decision["method"],
    })
    if holdings:
        output["whereaboutsStatus"] = "both" if output.get("digitalLocation") else "physical-confirmed"
        output["whereaboutsConfidence"] = "verified-aleph-holdings"
    return output


def build_resolution(
    whereabouts: dict[str, Any],
    seed_payload: dict[str, Any],
    *,
    limit: int,
) -> dict[str, Any]:
    if whereabouts.get("schemaVersion") != "thesis-philosophy-whereabouts-index-v1":
        raise ValueError("Unsupported T2CL index")
    if seed_payload.get("schemaVersion") != "philosophy-aleph-identity-seeds-v1":
        raise ValueError("Unsupported Aleph seed config")

    seeds = seed_map(seed_payload)
    eligible = [
        row for row in whereabouts.get("records") or []
        if row.get("whereaboutsStatus") == "cataloged-location-unresolved"
        and not row.get("reviewFlags")
    ]
    eligible.sort(key=lambda row: (
        0 if row.get("programRef") == "program:udg:lic-filosofia" else 1,
        -(row.get("year") or 0),
        title_core(row.get("title")),
        row.get("id"),
    ))

    # A newest-first sample badly over-represents 2014-2015. T2CN instead
    # prioritizes already verified seeds and then round-robins across decades.
    selected: list[dict[str, Any]] = []
    selected_ids: set[str] = set()

    seed_keys = set(seeds)
    for row in eligible:
        key = (
            title_core(row.get("title")),
            author_tokens((row.get("authors") or [""])[0]),
        )
        if key in seed_keys and row["id"] not in selected_ids:
            selected.append(row)
            selected_ids.add(row["id"])
            if len(selected) >= limit:
                break

    decade_groups: dict[int, list[dict[str, Any]]] = {}
    no_year: list[dict[str, Any]] = []
    for row in eligible:
        if row["id"] in selected_ids:
            continue
        year = row.get("year")
        if isinstance(year, int):
            decade_groups.setdefault((year // 10) * 10, []).append(row)
        else:
            no_year.append(row)

    for rows in decade_groups.values():
        rows.sort(key=lambda row: (
            -(row.get("year") or 0),
            title_core(row.get("title")),
            row.get("id"),
        ))
    no_year.sort(key=lambda row: (title_core(row.get("title")), row.get("id")))

    decades = sorted(decade_groups)
    index = 0
    while len(selected) < limit:
        progressed = False
        for decade in decades:
            rows = decade_groups[decade]
            if index < len(rows):
                row = rows[index]
                if row["id"] not in selected_ids:
                    selected.append(row)
                    selected_ids.add(row["id"])
                    progressed = True
                    if len(selected) >= limit:
                        break
        if len(selected) >= limit:
            break
        if index < len(no_year):
            row = no_year[index]
            if row["id"] not in selected_ids:
                selected.append(row)
                selected_ids.add(row["id"])
                progressed = True
        if not progressed:
            break
        index += 1

    batch = selected[:limit]

    opener, action = open_session()
    decisions = []
    resolved_by_id = {}
    for index, row in enumerate(batch):
        decision = resolve_record(row, opener=opener, action=action, seeds=seeds)
        decisions.append({
            "id": row["id"],
            "title": row["title"],
            "author": (row.get("authors") or [""])[0],
            "year": row.get("year"),
            **decision,
        })
        resolved_by_id[row["id"]] = decision
        if index + 1 < len(batch):
            time.sleep(0.20)

    updated = [
        apply_resolution(row, resolved_by_id[row["id"]])
        if row["id"] in resolved_by_id else copy.deepcopy(row)
        for row in whereabouts["records"]
    ]

    resolved = [row for row in decisions if row["status"] == "resolved"]
    physical = [row for row in resolved if row.get("holdings")]
    return {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "canonicalAdmissionMutation": False,
        "sessionUrlsPersisted": False,
        "inputRevision": whereabouts.get("revision"),
        "limit": limit,
        "selectionStrategy": "verified-seeds-then-decade-round-robin",
        "metrics": {
            "inputRecords": len(whereabouts["records"]),
            "eligibleRecords": len(eligible),
            "attempted": len(decisions),
            "resolved": len(resolved),
            "physicalConfirmed": len(physical),
            "unresolved": sum(row["status"] == "unresolved" for row in decisions),
            "ambiguous": sum(row["status"] == "ambiguous" for row in decisions),
            "seedResolved": sum(
                row.get("method") == "verified-seed" for row in resolved
            ),
            "searchResolved": sum(
                row.get("method") != "verified-seed" for row in resolved
            ),
        },
        "decisions": decisions,
        "records": updated,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--whereabouts-index", required=True, type=Path)
    parser.add_argument("--seeds", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--limit", type=int, default=24)
    args = parser.parse_args()
    result = build_resolution(
        json.loads(args.whereabouts_index.read_text(encoding="utf-8")),
        json.loads(args.seeds.read_text(encoding="utf-8")),
        limit=args.limit,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(result["metrics"], ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

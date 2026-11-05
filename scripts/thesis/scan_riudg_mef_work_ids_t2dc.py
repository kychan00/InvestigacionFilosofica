#!/usr/bin/env python3
"""T2DC: exhaustive metadata-only RIUdeG OAI scan for MEF thesis work identities.

This phase never downloads thesis files. It traverses the RIUdeG thesis OAI set
and looks for exact title + author matches for the two T2DB priority cases.
Negative results are recorded as repository-search closure, not as proof that a
thesis does not exist.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import time
import unicodedata
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[2]
HARVEST_PATH = ROOT / "scripts/thesis/harvest_real_corpus_v1.py"

spec = importlib.util.spec_from_file_location("t2dc_harvest", HARVEST_PATH)
harvest = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(harvest)

SCHEMA = "thesis-mef-riudg-oai-work-resolution-t2dc-v1"
REVISION = "2026-11-05.t2dc-v1"
FORBIDDEN = re.compile(r"(?i)(?:bitstream|download|\.pdf(?:$|[?#])|password|cookie|session[-_]?id)")


def norm(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text.casefold())
    return " ".join(text.split())


def author_tokens(value: Any) -> tuple[str, ...]:
    return tuple(sorted(norm(value).split()))


def first(values: list[str] | None) -> str | None:
    return values[0] if values else None


def raw_values(record: dict[str, Any], key: str) -> list[str]:
    return list((record.get("rawFields") or {}).get(key) or [])


def safe_handles(record: dict[str, Any]) -> list[str]:
    values = raw_values(record, "dc.identifier.uri") + raw_values(record, "dc.identifier")
    out: list[str] = []
    for value in values:
        handle = None
        try:
            handle = harvest.canonical.normalize_handle(value)
        except Exception:
            handle = None
        if handle and not FORBIDDEN.search(handle) and handle not in out:
            out.append(handle)
    return out


def target_rows(t2db: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for item in t2db.get("priorityCases") or []:
        if item.get("author") not in {
            "Mario Damián Del Muro Silva",
            "Adriel Manuel Hernández Guzmán",
        }:
            continue
        titles = [str(item.get("title") or "").strip()]
        variant = str(item.get("titleVariant") or "").strip()
        if variant:
            titles.append(variant)
        rows.append({
            "author": item["author"],
            "authorTokens": author_tokens(item["author"]),
            "titles": [value for value in titles if value],
            "titleNorms": [norm(value) for value in titles if value],
            "mefProgramInstitutionallyConfirmed": item.get("mefProgramInstitutionallyConfirmed") is True,
        })
    rows.sort(key=lambda row: row["author"])
    if [row["author"] for row in rows] != [
        "Adriel Manuel Hernández Guzmán",
        "Mario Damián Del Muro Silva",
    ]:
        raise ValueError("T2DC expects exactly the two T2DB programme-confirmed priorities")
    return rows


def safe_candidate(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "providerRecordId": record.get("providerRecordId"),
        "title": first(raw_values(record, "dc.title")),
        "authors": raw_values(record, "dc.contributor.author"),
        "programRaw": first(raw_values(record, "dc.degree.name")),
        "dateIssued": first(raw_values(record, "dc.date.issued")),
        "handles": safe_handles(record),
        "sourceType": first(raw_values(record, "dc.type")),
    }


def classify_record(record: dict[str, Any], target: dict[str, Any]) -> str | None:
    title = first(raw_values(record, "dc.title")) or ""
    authors = raw_values(record, "dc.contributor.author")
    title_match = norm(title) in set(target["titleNorms"])
    author_match = any(author_tokens(author) == target["authorTokens"] for author in authors)
    if title_match and author_match:
        return "exact-title-author"
    if title_match:
        return "title-only"
    if author_match:
        return "author-only"
    return None


def scan(
    t2db: dict[str, Any],
    *,
    page_fetcher: Callable[..., dict[str, Any]] = harvest.riudg_list_records_page,
    max_pages: int = 500,
    delay_seconds: float = 0.15,
) -> dict[str, Any]:
    if t2db.get("schemaVersion") != "thesis-mef-program-resolution-t2db-v1":
        raise ValueError("Unsupported T2DB input")
    if not 1 <= max_pages <= 1000:
        raise ValueError("max_pages must be between 1 and 1000")

    targets = target_rows(t2db)
    hits: dict[str, dict[str, list[dict[str, Any]]]] = {
        row["author"]: {
            "exactTitleAuthor": [],
            "titleOnly": [],
            "authorOnly": [],
        }
        for row in targets
    }

    pages = 0
    records_scanned = 0
    tombstones_scanned = 0
    token: str | None = None
    complete_list_size = None
    completed = False

    while pages < max_pages:
        page = page_fetcher(token=token)
        pages += 1
        if complete_list_size is None:
            raw_size = page.get("completeListSize")
            try:
                complete_list_size = int(raw_size) if raw_size is not None else None
            except (TypeError, ValueError):
                complete_list_size = None

        records = list(page.get("records") or [])
        tombstones = list(page.get("tombstones") or [])
        records_scanned += len(records)
        tombstones_scanned += len(tombstones)

        for record in records:
            for target in targets:
                kind = classify_record(record, target)
                if not kind:
                    continue
                candidate = safe_candidate(record)
                bucket = {
                    "exact-title-author": "exactTitleAuthor",
                    "title-only": "titleOnly",
                    "author-only": "authorOnly",
                }[kind]
                if candidate not in hits[target["author"]][bucket]:
                    hits[target["author"]][bucket].append(candidate)

        token = page.get("nextToken")
        if not token:
            completed = True
            break
        if delay_seconds:
            time.sleep(delay_seconds)

    results = []
    exact_total = 0
    stable_work_ids = 0
    for target in targets:
        buckets = hits[target["author"]]
        exact = buckets["exactTitleAuthor"]
        exact_total += len(exact)
        exact_with_handle = [item for item in exact if item.get("handles")]
        stable_work_ids += len(exact_with_handle)

        if len(exact_with_handle) == 1:
            status = "institutional-work-confirmed"
            selected = exact_with_handle[0]
        elif len(exact_with_handle) > 1:
            status = "ambiguous-multiple-work-identities"
            selected = None
        elif exact:
            status = "exact-metadata-no-stable-handle"
            selected = None
        else:
            status = "not-found-in-completed-oai-scan" if completed else "scan-incomplete"
            selected = None

        results.append({
            "author": target["author"],
            "searchedTitles": target["titles"],
            "mefProgramInstitutionallyConfirmed": target["mefProgramInstitutionallyConfirmed"],
            "status": status,
            "selectedWork": selected,
            "exactTitleAuthor": exact,
            "titleOnly": buckets["titleOnly"],
            "authorOnly": buckets["authorOnly"],
            "institutionalWorkIdentityConfirmed": status == "institutional-work-confirmed",
            "physicalHoldingConfirmed": False,
        })

    payload = {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "canonicalAdmissionMutation": False,
        "programAuthorityMutation": False,
        "publicProjectionMutation": False,
        "downloadsThesisFiles": False,
        "rawOaiPayloadPersisted": False,
        "negativeResultMeansNonexistence": False,
        "source": {
            "provider": "RIUdeG",
            "endpoint": harvest.RIUDG_ENDPOINT,
            "set": harvest.RIUDG_THESIS_SET,
            "metadataPrefix": "dim",
        },
        "scan": {
            "pagesScanned": pages,
            "recordsScanned": records_scanned,
            "tombstonesScanned": tombstones_scanned,
            "completeListSize": complete_list_size,
            "completed": completed,
            "maxPages": max_pages,
        },
        "metrics": {
            "targets": len(targets),
            "exactTitleAuthorMatches": exact_total,
            "stableWorkIdentifiersRecovered": stable_work_ids,
            "institutionalWorkIdentitiesConfirmed": sum(
                row["institutionalWorkIdentityConfirmed"] for row in results
            ),
            "physicalHoldingsConfirmed": 0,
            "publicRecordsAdded": 0,
        },
        "results": results,
    }
    validate_output(payload)
    return payload


def validate_output(data: dict[str, Any]) -> None:
    if data.get("schemaVersion") != SCHEMA:
        raise ValueError("Wrong T2DC schema")
    if data.get("referenceOnly") is not True:
        raise ValueError("T2DC must be reference-only")
    if data.get("downloadsThesisFiles") is not False or data.get("rawOaiPayloadPersisted") is not False:
        raise ValueError("T2DC may not download thesis files or persist raw OAI")
    if data.get("negativeResultMeansNonexistence") is not False:
        raise ValueError("Negative repository search cannot mean nonexistence")

    scan_info = data.get("scan") or {}
    if int(scan_info.get("pagesScanned") or 0) < 1:
        raise ValueError("T2DC scan must visit at least one page")
    if int(scan_info.get("recordsScanned") or 0) < 0:
        raise ValueError("Invalid record count")

    results = data.get("results") or []
    if [row.get("author") for row in results] != [
        "Adriel Manuel Hernández Guzmán",
        "Mario Damián Del Muro Silva",
    ]:
        raise ValueError("Unexpected T2DC result set")

    confirmed = 0
    stable = 0
    exact_total = 0
    for row in results:
        if row.get("physicalHoldingConfirmed") is not False:
            raise ValueError("OAI metadata scan cannot confirm physical holdings")
        exact = row.get("exactTitleAuthor") or []
        exact_total += len(exact)
        exact_with_handle = [item for item in exact if item.get("handles")]
        stable += len(exact_with_handle)
        if row.get("institutionalWorkIdentityConfirmed"):
            confirmed += 1
            selected = row.get("selectedWork") or {}
            if not selected.get("handles"):
                raise ValueError("Confirmed institutional work requires stable handle")
            if row.get("status") != "institutional-work-confirmed":
                raise ValueError("Confirmed work status mismatch")
        for bucket in ("exactTitleAuthor", "titleOnly", "authorOnly"):
            for item in row.get(bucket) or []:
                encoded = json.dumps(item, ensure_ascii=False)
                if FORBIDDEN.search(encoded):
                    raise ValueError("Full-text/download/session material detected in T2DC output")

    metrics = data.get("metrics") or {}
    expected = {
        "targets": 2,
        "exactTitleAuthorMatches": exact_total,
        "stableWorkIdentifiersRecovered": stable,
        "institutionalWorkIdentitiesConfirmed": confirmed,
        "physicalHoldingsConfirmed": 0,
        "publicRecordsAdded": 0,
    }
    if metrics != expected:
        raise ValueError(f"T2DC metrics mismatch: expected {expected}, got {metrics}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--max-pages", type=int, default=500)
    p.add_argument("--delay", type=float, default=0.15)
    args = p.parse_args()

    data = json.loads(args.input.read_text(encoding="utf-8"))
    if args.delay < 0 or args.delay > 5:
        raise ValueError("delay must be between 0 and 5 seconds")
    result = scan(data, max_pages=args.max_pages, delay_seconds=args.delay)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(result["metrics"], ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

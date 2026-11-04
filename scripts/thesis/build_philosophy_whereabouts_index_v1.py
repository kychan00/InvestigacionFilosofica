#!/usr/bin/env python3
"""Build a master Philosophy thesis whereabouts index from verified references.

T2CL does not change canonical admission. It reconciles bibliographic references
and records where each thesis can currently be located or consulted.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, parse_qs

SCHEMA = "thesis-philosophy-whereabouts-index-v1"
REVISION = "2026-11-04.t2cl-v1"
ALLOWED_WHEREABOUTS = {
    "digital",
    "physical-confirmed",
    "both",
    "cataloged-location-unresolved",
    "administrative-only",
}

PROGRAM_REFS = {
    "licenciatura en filosofia": "program:udg:lic-filosofia",
    "maestria en estudios filosoficos": "program:udg:mae-estudios-filosoficos",
    "maestria en filosofia": "program:udg:mae-filosofia-historica",
}

DIGITAL_HOSTS = {
    "hdl.handle.net",
    "riudg.udg.mx",
    "www.riudg.udg.mx",
    "estadisticas.riudg.udg.mx",
}

CUCSH_HOSTS = {
    "biblioteca.cucsh.udg.mx",
    "www.biblioteca.cucsh.udg.mx",
}


def normalize(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.casefold()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def normalize_program(value: Any) -> str:
    text = normalize(value)
    if text == "maestria en filosofia":
        return text
    if "estudios filosoficos" in text:
        return "maestria en estudios filosoficos"
    if "licenciatura" in text and "filosofia" in text:
        return "licenciatura en filosofia"
    return text


def year_value(value: Any) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    match = re.match(r"^(19|20)\d{2}$", text)
    return int(text) if match else None


def first_author_from_public(row: dict[str, Any]) -> str:
    authors = row.get("authors") or []
    return authors[0] if authors else ""


def exact_key(*, title: Any, author: Any, year: Any, program: Any) -> tuple[str, str, int | None, str]:
    return (
        normalize(title),
        normalize(author),
        year_value(year),
        normalize_program(program),
    )


def candidate_key(*, author: Any, year: Any, program: Any) -> tuple[str, int | None, str]:
    return (
        normalize(author),
        year_value(year),
        normalize_program(program),
    )


def stable_id(prefix: str, values: list[str]) -> str:
    digest = hashlib.sha256("|".join(values).encode("utf-8")).hexdigest()[:20]
    return f"{prefix}:{digest}"


def cucsh_identity(url: str | None) -> dict[str, Any] | None:
    if not url:
        return None
    parsed = urlparse(url)
    if (parsed.hostname or "").casefold() not in CUCSH_HOSTS:
        return None
    query = parse_qs(parsed.query)
    q_values = query.get("q") or []
    q_value = q_values[0] if len(q_values) == 1 else None
    return {
        "provider": "cucsh-thesis-catalog",
        "recordUrl": url,
        "catalogKey": q_value,
    }


def digital_location(row: dict[str, Any]) -> dict[str, Any] | None:
    url = row.get("sourceUrl")
    if not isinstance(url, str) or not url:
        return None
    host = (urlparse(url).hostname or "").casefold()
    if host not in DIGITAL_HOSTS:
        return None
    return {
        "provider": "riudg",
        "url": url,
        "handle": row.get("handle"),
    }


def public_record_to_whereabouts(row: dict[str, Any]) -> dict[str, Any]:
    digital = digital_location(row)
    status = "digital" if digital else "cataloged-location-unresolved"
    evidence = [{
        "source": "t2ci",
        "recordId": row.get("id"),
        "status": row.get("philosophyStatus"),
        "role": row.get("philosophyRole"),
        "sourceUrl": row.get("sourceUrl"),
    }]
    return {
        "id": stable_id("philosophy:whereabouts", [
            str(row.get("id") or ""),
            normalize(row.get("title")),
            normalize(first_author_from_public(row)),
        ]),
        "canonicalWorkId": row.get("canonicalWorkId") or (
            row.get("id") if str(row.get("id") or "").startswith("thesis:work:") else None
        ),
        "title": row.get("title") or "",
        "authors": list(row.get("authors") or []),
        "director": (row.get("directors") or [None])[0],
        "year": row.get("year"),
        "program": row.get("program") or "Sin programa registrado",
        "programRef": row.get("programRef"),
        "degree": row.get("degree") or "",
        "philosophyStatus": row.get("philosophyStatus") or "include",
        "philosophyRole": row.get("philosophyRole") or "program-core",
        "identity": {
            "canonicalWorkId": row.get("canonicalWorkId") or row.get("id"),
            "handle": row.get("handle"),
            "cucsh": None,
        },
        "digitalLocation": digital,
        "physicalLocation": None,
        "catalogEvidence": evidence,
        "whereaboutsStatus": status,
        "whereaboutsConfidence": "verified-digital" if digital else "bibliographic-reference-only",
        "reviewFlags": [],
    }


def cucsh_record_to_whereabouts(row: dict[str, Any]) -> dict[str, Any]:
    identity = cucsh_identity(row.get("recordUrl"))
    program = row.get("program") or "Sin programa registrado"
    program_ref = PROGRAM_REFS.get(normalize_program(program))
    authors = [value for value in [row.get("author"), row.get("coauthor")] if value]
    evidence = [{
        "source": "cucsh-thesis-catalog",
        "recordUrl": row.get("recordUrl"),
        "catalogPageUrl": row.get("catalogPageUrl"),
    }]
    flags = []
    if year_value(row.get("year")) is None:
        flags.append("invalid-or-missing-year")
    if not row.get("recordUrl"):
        flags.append("missing-detail-url")
    return {
        "id": stable_id("philosophy:whereabouts", [
            "cucsh",
            normalize(row.get("title")),
            normalize(row.get("author")),
            str(row.get("year") or ""),
            normalize_program(program),
        ]),
        "canonicalWorkId": None,
        "title": row.get("title") or "",
        "authors": authors,
        "director": row.get("director") or None,
        "year": year_value(row.get("year")),
        "program": program,
        "programRef": program_ref,
        "degree": "licenciatura" if normalize_program(program).startswith("licenciatura") else (
            "maestria" if normalize_program(program).startswith("maestria") else ""
        ),
        "philosophyStatus": "include" if program_ref else "review",
        "philosophyRole": "program-core" if program_ref else "program-core-candidate",
        "identity": {
            "canonicalWorkId": None,
            "handle": None,
            "cucsh": identity,
        },
        "digitalLocation": None,
        "physicalLocation": None,
        "catalogEvidence": evidence,
        "whereaboutsStatus": "cataloged-location-unresolved",
        "whereaboutsConfidence": "institutional-catalog-reference",
        "reviewFlags": flags,
    }


def merge_exact(base: dict[str, Any], other: dict[str, Any]) -> dict[str, Any]:
    merged = json.loads(json.dumps(base, ensure_ascii=False))
    if not merged.get("canonicalWorkId") and other.get("canonicalWorkId"):
        merged["canonicalWorkId"] = other["canonicalWorkId"]
    if other.get("programRef") and not merged.get("programRef"):
        merged["programRef"] = other["programRef"]
    if other.get("digitalLocation") and not merged.get("digitalLocation"):
        merged["digitalLocation"] = other["digitalLocation"]
    if other.get("identity"):
        for key, value in other["identity"].items():
            if value and not merged["identity"].get(key):
                merged["identity"][key] = value
    for item in other.get("catalogEvidence") or []:
        if item not in merged["catalogEvidence"]:
            merged["catalogEvidence"].append(item)
    merged["reviewFlags"] = sorted(set(
        (merged.get("reviewFlags") or []) + (other.get("reviewFlags") or [])
    ))
    if merged.get("digitalLocation") and merged.get("physicalLocation"):
        merged["whereaboutsStatus"] = "both"
        merged["whereaboutsConfidence"] = "verified-digital-and-physical"
    elif merged.get("digitalLocation"):
        merged["whereaboutsStatus"] = "digital"
        merged["whereaboutsConfidence"] = "verified-digital"
    return merged


def build_index(cucsh: dict[str, Any], philosophy: dict[str, Any]) -> dict[str, Any]:
    if cucsh.get("schemaVersion") != "thesis-cucsh-catalog-recon-v1":
        raise ValueError("Unsupported CUCSH catalog recon schema")
    if philosophy.get("schemaVersion") != "thesis-philosophy-public-index-v1":
        raise ValueError("Unsupported T2CI Philosophy index schema")
    if philosophy.get("referenceOnly") is not True:
        raise ValueError("T2CL requires reference-only Philosophy input")

    cucsh_rows = [
        row
        for group in cucsh.get("philosophyInventories") or []
        for row in group.get("records") or []
    ]
    public_rows = list(philosophy.get("records") or [])

    master: dict[tuple[str, str, int | None, str], dict[str, Any]] = {}
    candidate_groups: dict[tuple[str, int | None, str], list[tuple[str, str, int | None, str]]] = {}
    exact_merges = 0

    for row in cucsh_rows:
        item = cucsh_record_to_whereabouts(row)
        key = exact_key(
            title=item["title"],
            author=item["authors"][0] if item["authors"] else "",
            year=item["year"],
            program=item["program"],
        )
        if key in master:
            master[key] = merge_exact(master[key], item)
        else:
            master[key] = item
        candidate_groups.setdefault(candidate_key(
            author=item["authors"][0] if item["authors"] else "",
            year=item["year"],
            program=item["program"],
        ), []).append(key)

    unresolved_public = []
    for row in public_rows:
        item = public_record_to_whereabouts(row)
        key = exact_key(
            title=item["title"],
            author=item["authors"][0] if item["authors"] else "",
            year=item["year"],
            program=item["program"],
        )
        if key in master:
            master[key] = merge_exact(master[key], item)
            exact_merges += 1
            continue

        ckey = candidate_key(
            author=item["authors"][0] if item["authors"] else "",
            year=item["year"],
            program=item["program"],
        )
        candidates = list(candidate_groups.get(ckey) or [])
        if len(candidates) == 1:
            candidate = master[candidates[0]]
            flag = {
                "type": "same-author-year-program-title-mismatch",
                "candidateId": candidate["id"],
                "candidateTitle": candidate["title"],
                "publicRecordId": row.get("id"),
                "publicTitle": row.get("title"),
            }
            candidate["reviewFlags"].append(flag)
            item["reviewFlags"].append({
                "type": "same-author-year-program-title-mismatch",
                "candidateId": candidate["id"],
                "candidateTitle": candidate["title"],
            })
            unresolved_public.append(row.get("id"))

        if key in master:
            raise ValueError("Unexpected duplicate key after candidate review")
        master[key] = item

    records = list(master.values())
    records.sort(key=lambda row: (
        normalize_program(row.get("program")),
        -(row.get("year") or 0),
        normalize(row.get("title")),
        row["id"],
    ))

    ids = [row["id"] for row in records]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate T2CL whereabouts IDs")

    for row in records:
        if row["whereaboutsStatus"] not in ALLOWED_WHEREABOUTS:
            raise ValueError("Invalid whereabouts status")
        if row.get("physicalLocation") is not None:
            raise ValueError("T2CL v1 must not assert physical holdings before OPAC verification")
        if not row.get("title") or not row.get("authors"):
            raise ValueError("Incomplete whereabouts bibliographic record")

    status_counts = Counter(row["whereaboutsStatus"] for row in records)
    program_counts = Counter(row["program"] for row in records)
    review_flagged = sum(bool(row.get("reviewFlags")) for row in records)
    digital_count = sum(bool(row.get("digitalLocation")) for row in records)
    cucsh_count = sum(bool((row.get("identity") or {}).get("cucsh")) for row in records)
    canonical_count = sum(bool(row.get("canonicalWorkId")) for row in records)

    return {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "canonicalAdmissionMutation": False,
        "physicalClaimsRequireOpacHoldings": True,
        "inputs": {
            "cucshSchemaVersion": cucsh.get("schemaVersion"),
            "cucshRevision": cucsh.get("revision"),
            "philosophySchemaVersion": philosophy.get("schemaVersion"),
            "philosophyRevision": philosophy.get("revision"),
            "philosophySourceRelease": philosophy.get("sourceRelease"),
        },
        "metrics": {
            "records": len(records),
            "cucshInventoryRecords": len(cucsh_rows),
            "t2ciRecords": len(public_rows),
            "exactMerges": exact_merges,
            "canonicalWorkIds": canonical_count,
            "digitalLocations": digital_count,
            "cucshCatalogIdentities": cucsh_count,
            "reviewFlaggedRecords": review_flagged,
            "whereaboutsStatus": dict(sorted(status_counts.items())),
            "programs": dict(sorted(program_counts.items())),
        },
        "records": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cucsh-report", required=True, type=Path)
    parser.add_argument("--philosophy-index", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = build_index(
        json.loads(args.cucsh_report.read_text(encoding="utf-8")),
        json.loads(args.philosophy_index.read_text(encoding="utf-8")),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(output["metrics"], ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

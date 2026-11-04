#!/usr/bin/env python3
"""Produce a small, reference-only thesis search index from an immutable effective release.

No thesis PDF, full-text extraction, raw SourceRecord, or non-INCLUDE work
is exported. The input release is byte-verified before JSON parsing.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

SCHEMA = "thesis-demo-index-v1"
YEAR = re.compile(r"^(\d{4})(?:-|$)")
HANDLE = re.compile(r"^\d+(?:\.\d+)+/[a-zA-Z0-9._~/-]+$")
ALLOWED_HOSTS = {
    "hdl.handle.net",
    "riudg.udg.mx",
    "www.riudg.udg.mx",
    "biblioteca.udgvirtual.udg.mx",
    "editorial.udg.mx",
    "biblioteca.cucsh.udg.mx",
    "www.biblioteca.cucsh.udg.mx",
    "cucsh.udg.mx",
    "www.cucsh.udg.mx",
}
BLOCKED_PATH = re.compile(r"(?:\.pdf(?:$|[?#])|/bitstream(?:s)?/|/download(?:$|[/?#]))", re.I)
ALLOWED_STATUS = "include"


def sha256(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def one_line(value: Any, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())[:limit]


def verified_release(path: Path, contract: dict[str, Any]) -> dict[str, Any]:
    blob = path.read_bytes()
    if sha256(blob) != contract["effectiveCorpusGzipSha256"]:
        raise ValueError("Immutable release gzip SHA-256 mismatch")
    raw = gzip.decompress(blob)
    expected = contract["effectiveCorpusJsonSha256"]
    if sha256(raw) == expected:
        return json.loads(raw)

    # T2CF/V2 stores a canonical compact JSON payload in gzip while the
    # separately hashed JSON asset uses the repository's stable pretty form.
    # Verify semantic identity by reconstructing that exact pretty form.
    parsed = json.loads(raw)
    reconstructed = (
        json.dumps(parsed, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    if sha256(reconstructed) != expected:
        raise ValueError("Immutable release JSON SHA-256 mismatch")
    return parsed


def safe_institutional_url(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    try:
        parsed = urlparse(raw)
    except ValueError:
        return None
    host = (parsed.hostname or "").lower()
    if (parsed.scheme != "https"
        or host not in ALLOWED_HOSTS
        or parsed.username or parsed.password
        or parsed.port not in (None, 443)
        or BLOCKED_PATH.search(parsed.path)):
        return None
    if parsed.path and parsed.path != "/":
        return raw
    if host in {"biblioteca.cucsh.udg.mx", "www.biblioteca.cucsh.udg.mx"}:
        query = parse_qs(parsed.query, keep_blank_values=True)
        values = query.get("q") or []
        if set(query) == {"q"} and len(values) == 1 and re.fullmatch(
            r"node/\d+", values[0], re.I
        ):
            return raw
    return None


def official_link(
    work: dict[str, Any], records: dict[str, dict[str, Any]]
) -> tuple[str | None, str | None]:
    for entry in work.get("persistentIdentifiers") or []:
        if entry.get("scheme") != "handle":
            continue
        handle = str(entry.get("normalizedValue") or "").strip()
        if HANDLE.fullmatch(handle):
            return safe_institutional_url(
                "https://hdl.handle.net/" + handle
            ), handle

    for ref in work.get("sourceRecordRefs") or []:
        record = records.get(ref) or {}
        fields = record.get("rawFields") or {}
        for key in ("dc.identifier.uri", "DC.identifier", "dc.identifier"):
            for value in fields.get(key) or []:
                safe = safe_institutional_url(value)
                if safe:
                    return safe, None
    return None, None


def extract_year(date: dict[str, Any] | None) -> int | None:
    date = date or {}
    if date.get("quality") != "valid":
        return None
    value = str(date.get("value") or "")
    match = YEAR.match(value)
    if not match:
        return None
    year = int(match.group(1))
    return year if 1500 <= year <= 2026 else None


def named_contributors(work: dict[str, Any], roles: set[str]) -> list[str]:
    output: list[str] = []
    for contribution in work.get("contributions") or []:
        if contribution.get("role") not in roles:
            continue
        if contribution.get("resolutionState") == "blocked-role-conflict":
            continue
        name = one_line(contribution.get("rawName"), 160)
        if name and name not in output:
            output.append(name)
    return output[:16]


def build_index(
    corpus: dict[str, Any],
    contract: dict[str, Any],
    *,
    registry: dict[str, Any] | None = None,
    enforce_full_release: bool = True,
) -> dict[str, Any]:
    works = corpus.get("works") or []
    counts = dict(Counter(work.get("admissionStatus") for work in works))
    if corpus.get("effectiveCorpusSchemaVersion") != contract["effectiveCorpusSchemaVersion"]:
        raise ValueError("Effective corpus schema mismatch")
    if corpus.get("programAuthorityRevision") != contract["programAuthorityRevision"]:
        raise ValueError("Program Authority revision mismatch")
    if corpus.get("programMetadataEvidenceRevision") != contract["metadataConfidenceRevision"]:
        raise ValueError("Metadata confidence revision mismatch")
    expected_admission_revision = contract.get(
        "effectiveAdmissionRevision", contract["workAdmissionDecisionRevision"]
    )
    if corpus.get("effectiveAdmissionRevision") != expected_admission_revision:
        raise ValueError("Effective admission revision mismatch")
    if "workAdmissionDecisionRevision" in contract and corpus.get(
        "workAdmissionDecisionRevision", corpus.get("effectiveAdmissionRevision")
    ) != contract["workAdmissionDecisionRevision"]:
        raise ValueError("Work admission decision revision mismatch")
    if enforce_full_release:
        if len(works) != contract["worksTotal"] or counts != contract["admissionCounts"]:
            raise ValueError("Immutable release admission counts mismatch")

    if registry is not None and registry.get("registryRevision") != (
        contract["programAuthorityRevision"]
    ):
        raise ValueError("Demo registry Program Authority revision mismatch")
    authorities = (
        registry.get("programs") if registry is not None
        else corpus.get("programAuthorities")
    )
    program_names = {
        item["id"]: item for item in authorities or []
        if item.get("id")
    }
    sources = {
        item["id"]: item for item in corpus.get("sourceRecords") or []
        if item.get("id")
    }
    records = []
    for work in works:
        if work.get("admissionStatus") != ALLOWED_STATUS:
            continue
        identity = work.get("id")
        if not isinstance(identity, str) or not identity.startswith("thesis:work:"):
            raise ValueError("Invalid included thesis ID")
        source_url, handle = official_link(work, sources)
        program = program_names.get(work.get("programRef")) or {}
        abstract = one_line(work.get("abstract"), 460)
        keywords = [
            one_line(x, 90) for x in work.get("keywords") or []
            if one_line(x, 90)
        ][:12]
        records.append({
            "id": identity,
            "title": one_line(work.get("title"), 400) or "Título no registrado",
            "authors": named_contributors(work, {"thesis-author"}),
            "directors": named_contributors(
                work, {"thesis-director", "thesis-codirector"}
            ),
            "year": extract_year(work.get("date")),
            "dateQuality": (work.get("date") or {}).get("quality"),
            "program": one_line(
                program.get("canonicalName") or work.get("programRaw"), 250
            ),
            "programRef": work.get("programRef"),
            "degree": one_line(program.get("level"), 90),
            "unit": one_line(work.get("academicUnitRaw"), 120),
            "abstractExcerpt": abstract,
            "keywords": keywords,
            "sourceUrl": source_url,
            "handle": handle,
        })

    expected_include = counts.get(ALLOWED_STATUS, 0)
    if len(records) != expected_include:
        raise ValueError("An INCLUDE work was lost")
    if len({record["id"] for record in records}) != len(records):
        raise ValueError("Duplicate work ID in demo index")
    records.sort(
        key=lambda w: (
            -(w["year"] or 0),
            w["title"].casefold(),
            w["id"],
        )
    )
    output = {
        "schemaVersion": SCHEMA,
        "sourceRelease": contract["releaseTag"],
        "sourceGzipSha256": contract["effectiveCorpusGzipSha256"],
        "programAuthorityRevision": contract["programAuthorityRevision"],
        "workAdmissionDecisionRevision": contract["workAdmissionDecisionRevision"],
        "totalIncluded": len(records),
        "totalCanonical": len(works),
        "referenceOnly": True,
        "metadataScope": "bibliographic-metadata-and-short-institutional-abstract-only",
        "records": records,
    }
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus-gzip", required=True, type=Path)
    parser.add_argument(
        "--contract",
        type=Path,
        default=Path(__file__).resolve().parent
        / "config/effective-corpus-release-t2bz-v1.json",
    )
    parser.add_argument(
        "--registry",
        type=Path,
        default=Path(__file__).resolve().parent / "config/program-authority-v1.json",
    )
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    contract = json.loads(args.contract.read_text(encoding="utf-8"))
    corpus = verified_release(args.corpus_gzip, contract)
    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    output = build_index(corpus, contract, registry=registry)
    expected_include = int(contract["admissionCounts"]["include"])
    if output["totalIncluded"] != expected_include:
        raise ValueError(
            f"Demo index must contain exactly {expected_include} approved theses"
        )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n"
    if len(data.encode("utf-8")) > 2_500_000:
        raise ValueError("Demo search metadata is unexpectedly large")
    args.output.write_text(data, encoding="utf-8")
    print(json.dumps({
        "schemaVersion": SCHEMA,
        "sourceRelease": output["sourceRelease"],
        "records": output["totalIncluded"],
        "institutionalLinks": sum(bool(x["sourceUrl"]) for x in output["records"]),
        "bytes": len(data.encode("utf-8")),
        "output": str(args.output),
        "thesisFilesStored": 0,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

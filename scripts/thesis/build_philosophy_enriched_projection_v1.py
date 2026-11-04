#!/usr/bin/env python3
"""Build a fail-closed Philosophy completeness projection over immutable V1."""
from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

import build_canonical_corpus_v1 as canonical

BASE_TAG = "thesis-effective-corpus-v1"
BASE_JSON_SHA256 = "0a4d24810d90f8e4c748abd0c8f3978afba6561eade46fcbf29f2bda6416b892"
BASE_GZIP_SHA256 = "4e2484482be783bcb004f4a343cfede516806d56d4e56dffa4a6d20cfe3750c3"
REVISION = "2026-11-03.philosophy-v1-projection"
TARGET_PROGRAM_REFS = {
    "program:udg:lic-filosofia",
    "program:udg:mae-estudios-filosoficos",
    "program:udg:mae-filosofia-historica",
}
ALLOWED_PROVIDERS = {"riudg", "cucsh-library", "cucsh-official", "udg-official-profile"}
FORBIDDEN = (".pdf", "/bitstream", "/download")


def read_json(path: Path) -> dict[str, Any]:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as stream:
            return json.load(stream)
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl_gz(path: Path) -> list[dict[str, Any]]:
    with gzip.open(path, "rt", encoding="utf-8") as stream:
        return [json.loads(line) for line in stream if line.strip()]


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def write_json_gz(path: Path, payload: dict[str, Any]) -> None:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=9, mtime=0, filename="") as compressed:
            compressed.write(encoded)


def verify_base(path: Path, corpus: dict[str, Any]) -> None:
    blob = path.read_bytes()
    if path.suffix != ".gz" or hashlib.sha256(blob).hexdigest() != BASE_GZIP_SHA256:
        raise ValueError("Immutable V1 gzip SHA-256 mismatch")
    if hashlib.sha256(gzip.decompress(blob)).hexdigest() != BASE_JSON_SHA256:
        raise ValueError("Immutable V1 JSON SHA-256 mismatch")
    if corpus.get("effectiveCorpusSchemaVersion") != "thesis-effective-corpus-v1":
        raise ValueError("Input is not immutable Effective Corpus V1")
    if len(corpus.get("works") or []) != 27576:
        raise ValueError("Immutable V1 work cardinality mismatch")
    expected = {
        "include": 561,
        "review": 193,
        "quarantine": 18971,
        "exclude": 7849,
        "reject-source": 2,
    }
    if dict(Counter(work.get("admissionStatus") for work in corpus["works"])) != expected:
        raise ValueError("Immutable V1 admission counts mismatch")


def normalize(value: str | None) -> str:
    return canonical.normalize_key(canonical.clean_text(value))


def year(value: Any) -> str:
    text = str(value or "")
    return text[:4] if len(text) >= 4 and text[:4].isdigit() else ""


def first_author(contributions: list[dict[str, Any]]) -> str:
    values = [
        row.get("normalizedName") or row.get("rawName") or ""
        for row in contributions
        if row.get("role") == "thesis-author"
    ]
    return normalize(values[0] if values else "")


def work_key(work: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        normalize(work.get("title")),
        first_author(work.get("contributions") or []),
        str(work.get("programRef") or ""),
        year((work.get("date") or {}).get("value")),
    )


def candidate_key(candidate: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        normalize(candidate.get("title")),
        first_author(candidate.get("contributions") or []),
        str((candidate.get("program") or {}).get("programRef") or ""),
        year((candidate.get("date") or {}).get("value")),
    )


def persistent_handles(identifiers: list[dict[str, Any]]) -> set[str]:
    return {
        str(item.get("normalizedValue") or "")
        for item in identifiers
        if item.get("scheme") == "handle" and item.get("normalizedValue")
    }


def validate_reference_record(record: dict[str, Any]) -> None:
    if record.get("provider") not in ALLOWED_PROVIDERS:
        raise ValueError(f"Unapproved supplement provider: {record.get('provider')}")
    url = str(record.get("recordUrl") or "")
    if not url.startswith("https://") or any(token in url.casefold() for token in FORBIDDEN):
        raise ValueError(f"Unsafe supplement URL: {url}")
    for key in (record.get("rawFields") or {}):
        if any(marker in key.casefold() for marker in ("fulltext", "full_text", "bitstream", "filecontent")):
            raise ValueError(f"Full-text-like field in supplement: {key}")


def recompute_metrics(corpus: dict[str, Any]) -> dict[str, Any]:
    works = corpus.get("works") or []
    sources = corpus.get("sourceRecords") or []
    identity = corpus.get("identityDecisions") or []
    return {
        "sourceRecords": len(sources),
        "works": len(works),
        "worksByAdmission": dict(Counter(work["admissionStatus"] for work in works)),
        "providers": dict(Counter(record["provider"] for record in sources)),
        "dateQuality": dict(Counter((work.get("date") or {}).get("quality") for work in works)),
        "identityDecisions": dict(Counter(item.get("status") for item in identity)),
        "metadataQualityFlags": dict(
            Counter(flag for work in works for flag in work.get("metadataQualityFlags", []))
        ),
        "programMetadataConfidenceStates": dict(
            Counter(
                (work.get("programMetadataEvidence") or {}).get("confidenceState") or "unassessed"
                for work in works
            )
        ),
        "programAuthorityApplicability": dict(
            Counter(
                (work.get("programMetadataEvidence") or {}).get("authorityApplicability") or "allowed"
                for work in works
            )
        ),
    }


def build_projection(
    base: dict[str, Any],
    records: list[dict[str, Any]],
    registry: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    if registry.get("registryRevision") != "2026-11-03.v47":
        raise ValueError("Philosophy completeness V1 is pinned to Program Authority V47")

    base_index: dict[tuple[str, str, str, str], list[dict[str, Any]]] = {}
    base_handle_index: dict[str, list[dict[str, Any]]] = {}
    for work in base["works"]:
        base_index.setdefault(work_key(work), []).append(work)
        for handle in persistent_handles(work.get("persistentIdentifiers") or []):
            bucket = base_handle_index.setdefault(handle, [])
            if all(existing.get("id") != work.get("id") for existing in bucket):
                bucket.append(work)

    prepared = []
    for record in records:
        validate_reference_record(record)
        candidate = canonical.canonical_candidate(record, registry, reference_year=2026)
        program_ref = (candidate.get("program") or {}).get("programRef")
        if program_ref not in TARGET_PROGRAM_REFS:
            raise ValueError(f"Supplement is not exact Philosophy: {record.get('providerRecordId')}")
        if candidate.get("admission", {}).get("status") != "include":
            raise ValueError(f"Supplement did not resolve INCLUDE: {record.get('providerRecordId')}")
        key = candidate_key(candidate)
        handles = persistent_handles(candidate.get("persistentIdentifiers") or [])
        if not handles and not all(key):
            raise ValueError(
                "Supplement lacks both a persistent handle and a complete exact "
                f"bibliographic key: {record.get('providerRecordId')}"
            )
        prepared.append((record, candidate, key, handles))

    output = copy.deepcopy(base)
    source_ids = {row["id"] for row in output["sourceRecords"]}
    work_by_id = {row["id"]: row for row in output["works"]}
    covered = []
    missing = []

    for record, candidate, key, handles in prepared:
        handle_matches_by_id: dict[str, dict[str, Any]] = {}
        for handle in handles:
            for match in base_handle_index.get(handle, []):
                handle_matches_by_id[match["id"]] = match
        matches = list(handle_matches_by_id.values())
        match_mode = "shared-persistent-identifier" if matches else None

        if len(matches) > 1:
            raise ValueError(
                f"Ambiguous persistent-handle Philosophy match: {record.get('providerRecordId')}"
            )

        if not matches and all(key):
            matches = base_index.get(key, [])
            match_mode = "exact-title-author-program-year" if matches else None
            if len(matches) > 1:
                raise ValueError(
                    f"Ambiguous exact Philosophy match: {record.get('providerRecordId')}"
                )

        if not matches:
            missing.append(record)
            continue

        target = work_by_id[matches[0]["id"]]
        if record["id"] not in source_ids:
            output["sourceRecords"].append(copy.deepcopy(record))
            source_ids.add(record["id"])
        target["sourceRecordRefs"] = sorted(set(target.get("sourceRecordRefs") or []) | {record["id"]})
        output["workIdRegistry"][record["id"]] = target["id"]
        output["admissionDecisions"].append(copy.deepcopy(candidate["admission"]))
        output["identityDecisions"].append(
            {
                "id": "identity:" + hashlib.sha256((record["id"] + "|" + target["id"]).encode()).hexdigest()[:20],
                "sourceRecordRefs": [record["id"]],
                "workRef": target["id"],
                "status": "confirmed",
                "explanationCode": match_mode,
                "decisionMode": "deterministic-reference-only",
            }
        )
        covered.append(
            {
                "sourceRecordId": record["id"],
                "provider": record["provider"],
                "providerRecordId": record["providerRecordId"],
                "workId": target["id"],
                "title": target["title"],
                "programRef": target["programRef"],
                "matchMode": match_mode,
            }
        )

    added = []
    if missing:
        delta = canonical.build_corpus(
            missing,
            registry,
            previous_work_registry=output["workIdRegistry"],
            reference_year=2026,
            build_revision=REVISION + ".delta",
        )
        for work in delta["works"]:
            if work.get("programRef") not in TARGET_PROGRAM_REFS or work.get("admissionStatus") != "include":
                raise ValueError("Delta contains non-Philosophy or non-INCLUDE work")
        output["sourceRecords"].extend(copy.deepcopy(delta["sourceRecords"]))
        output["works"].extend(copy.deepcopy(delta["works"]))
        output["admissionDecisions"].extend(copy.deepcopy(delta["admissionDecisions"]))
        output["identityDecisions"].extend(copy.deepcopy(delta["identityDecisions"]))
        output["workIdRegistry"] = copy.deepcopy(delta["workIdRegistry"])
        added = [
            {
                "workId": work["id"],
                "title": work["title"],
                "programRef": work["programRef"],
                "sourceRecordRefs": work["sourceRecordRefs"],
            }
            for work in delta["works"]
        ]

    output["buildRevision"] = REVISION
    output["projectionBaseRelease"] = BASE_TAG
    output["projectionBaseJsonSha256"] = BASE_JSON_SHA256
    output["projectionBaseGzipSha256"] = BASE_GZIP_SHA256
    output["philosophyCompletenessRevision"] = REVISION
    output["publicationState"] = "projection-not-release"
    output["metrics"] = recompute_metrics(output)
    canonical.validate_corpus(output)

    original = next(work for work in base["works"] if work["id"] == "thesis:work:00002062")
    projected = next(work for work in output["works"] if work["id"] == "thesis:work:00002062")
    if original != projected:
        raise ValueError("Existing approved work-level decision was mutated")

    philosophy_counts = Counter(
        work.get("programRef")
        for work in output["works"]
        if work.get("programRef") in TARGET_PROGRAM_REFS and work.get("admissionStatus") == "include"
    )
    report = {
        "schemaVersion": "thesis-philosophy-completeness-projection-report-v1",
        "revision": REVISION,
        "baseRelease": BASE_TAG,
        "baseWorks": len(base["works"]),
        "baseInclude": base["metrics"]["worksByAdmission"]["include"],
        "supplementSourceRecords": len(records),
        "alreadyCoveredWorks": len(covered),
        "newWorks": len(added),
        "projectedWorks": len(output["works"]),
        "projectedAdmission": output["metrics"]["worksByAdmission"],
        "philosophyIncludeByProgram": dict(sorted(philosophy_counts.items())),
        "covered": covered,
        "added": added,
        "doctoralPolicy": {
            "exactDoctorateProgramPresent": False,
            "programRef": "program:udg:doc-humanidades",
            "rule": "do-not-auto-label-doctorado-en-humanidades-works-as-philosophy",
        },
        "referenceOnly": True,
        "publicationState": "projection-not-release",
    }
    return output, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", type=Path, required=True)
    parser.add_argument("--source-records", type=Path, required=True)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--output-corpus", type=Path, required=True)
    parser.add_argument("--output-report", type=Path, required=True)
    args = parser.parse_args()

    base = read_json(args.base)
    verify_base(args.base, base)
    output, report = build_projection(
        base,
        read_jsonl_gz(args.source_records),
        read_json(args.registry),
    )
    write_json_gz(args.output_corpus, output)
    write_json(args.output_report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

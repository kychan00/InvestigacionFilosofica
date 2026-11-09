#!/usr/bin/env python3
"""RA12-C5-B: prepare a deduplicated external semantic-overlay seed.

Inputs are a real federated SearchResponse capture plus RA12-C5-A DOI authority.
The frozen OpenAlex V4 corpus is never mutated. Exact V4 matches are removed;
remaining works are normalized into the historical V3.3 document-text contract.

This script does NOT run Qwen and does NOT publish anything.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
from typing import Any

from build_ra12_semantic_alias_index import normalize_doi
from analyze_ra12c4_live_coverage import resolve_alias

TEXT_CONTRACT = "semantic-retrieval-v3.3-document-text-v1"
MAX_CHARACTERS = 24_000
SCHEMA = "research-atlas-ra12c5b-overlay-seed-v1"
WS = re.compile(r"\s+")


class OverlaySeedError(RuntimeError):
    pass


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split()).strip()
    return text or None


def string_list(value: Any) -> list[str]:
    if value is None:
        return []
    candidates = value if isinstance(value, list) else [value]
    out = []
    seen = set()
    for item in candidates:
        text = clean_text(item)
        if not text:
            continue
        key = text.casefold()
        if key not in seen:
            seen.add(key)
            out.append(text)
    return out


def build_document_text(item: dict) -> tuple[str | None, list[str]]:
    title = clean_text(item.get("title"))
    abstract = clean_text(item.get("abstract"))
    authors = string_list(item.get("authors"))
    topics = string_list(item.get("topics"))
    keywords = string_list(item.get("keywords"))
    fields = [
        ("Title", title),
        ("Abstract", abstract),
        ("Authors", "; ".join(authors) if authors else None),
        ("Topics", "; ".join(topics) if topics else None),
        ("Keywords", "; ".join(keywords) if keywords else None),
    ]
    blocks = [f"{label}:\n{value}" for label, value in fields if value]
    if not blocks:
        return None, []
    text = "\n\n".join(blocks)[:MAX_CHARACTERS]
    present = [label.lower() for label, value in fields if value]
    return text, present


def doi_values(item: dict) -> list[str]:
    values = set()
    for raw in (
        item.get("doi"),
        item.get("crossrefId"),
        item.get("crossref_id"),
        (item.get("urls") or {}).get("doi"),
        (item.get("urls") or {}).get("canonical"),
    ):
        doi = normalize_doi(raw)
        if doi:
            values.add(doi)
    for alias in item.get("semanticAliases") or []:
        if isinstance(alias, str) and alias.startswith(("doi:", "crossref:")):
            doi = normalize_doi(alias.split(":", 1)[1])
            if doi:
                values.add(doi)
    return sorted(values)


def authority_by_doi(report: dict) -> dict[str, dict]:
    records = report.get("authority", {}).get("records")
    if not isinstance(records, list):
        raise OverlaySeedError("C5-A authority report lacks records")
    out = {}
    for record in records:
        doi = normalize_doi(record.get("doi"))
        if not doi:
            raise OverlaySeedError("Authority record contains invalid DOI")
        if doi in out:
            raise OverlaySeedError("Duplicate DOI authority record")
        out[doi] = record
    return out


def canonical_identity(
    item: dict,
    authority: dict[str, dict],
    alias_root: Path,
    alias_cache: dict[int, dict],
) -> tuple[str | None, str, dict | None]:
    # First reject anything already in V4 by exact OpenAlex alias.
    for alias in item.get("semanticAliases") or []:
        if isinstance(alias, str) and alias.startswith("openalex:"):
            existing = resolve_alias(alias_root, alias, alias_cache)
            if existing:
                return None, "base-direct", existing

    authorities = []
    for doi in doi_values(item):
        record = authority.get(doi)
        if record:
            authorities.append(record)

    exact_v4 = [x for x in authorities if x.get("state") == "v4-existing-by-doi"]
    if exact_v4:
        # Any exact DOI→V4 match excludes the work from overlay.
        return None, "base-v4-by-doi", exact_v4[0].get("v4Location")

    outside = sorted(
        {
            x.get("openalexWorkId")
            for x in authorities
            if x.get("state") == "openalex-outside-v4" and x.get("openalexWorkId")
        }
    )
    if len(outside) == 1:
        return "openalex:" + outside[0], "overlay-openalex-outside-v4", None
    if len(outside) > 1:
        return None, "ambiguous-openalex-authority", None

    dois = doi_values(item)
    if dois:
        return "doi:" + dois[0], "overlay-doi-source-authority", None

    identity = item.get("overlayIdentity")
    if isinstance(identity, str) and identity.startswith("provider:"):
        return identity, "overlay-provider-authority", None
    return None, "unresolved-identity", None


def candidate_quality(item: dict, text: str, fields: list[str]) -> tuple:
    abstract_chars = len(clean_text(item.get("abstract")) or "")
    return (
        1 if "abstract" in fields else 0,
        abstract_chars,
        len(fields),
        len(text),
        -int(item.get("rank") or 10_000),
        str(item.get("id") or ""),
    )


def prepare(capture: dict, authority_report: dict, alias_root: Path) -> tuple[list[dict], list[dict], dict]:
    authority = authority_by_doi(authority_report)
    alias_cache: dict[int, dict] = {}
    by_identity: dict[str, dict] = {}
    excluded = defaultdict(int)
    appearances = 0

    for run in capture.get("runs") or []:
        query_id = str(run.get("id") or "")
        for item in run.get("results") or []:
            appearances += 1
            identity, state, _location = canonical_identity(
                item, authority, alias_root, alias_cache
            )
            if not identity:
                excluded[state] += 1
                continue

            text, fields = build_document_text(item)
            if not text:
                excluded["missing-document-text"] += 1
                continue

            text_sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
            providers = sorted({str(x) for x in item.get("providers") or [] if x})
            source_ids = sorted({
                str(x.get("sourceId"))
                for x in item.get("sourceRecords") or []
                if isinstance(x, dict) and x.get("sourceId")
            })
            dois = doi_values(item)
            authority_records = [authority[d] for d in dois if d in authority]
            openalex_ids = sorted({
                x.get("openalexWorkId")
                for x in authority_records
                if x.get("openalexWorkId")
            })
            proposal = {
                "identity": identity,
                "identityState": state,
                "title": clean_text(item.get("title")) or "",
                "abstract": clean_text(item.get("abstract")),
                "authors": string_list(item.get("authors")),
                "topics": string_list(item.get("topics")),
                "keywords": string_list(item.get("keywords")),
                "year": item.get("year"),
                "doi": dois[0] if dois else None,
                "allDois": dois,
                "openalexWorkId": openalex_ids[0] if len(openalex_ids) == 1 else None,
                "providers": providers,
                "sourceIds": source_ids,
                "urls": {
                    "canonical": (item.get("urls") or {}).get("canonical"),
                    "doi": (item.get("urls") or {}).get("doi"),
                },
                "firstQueryId": query_id,
                "firstRank": int(item.get("rank") or 10_000),
                "documentText": text,
                "textSha256": text_sha,
                "textCharacters": len(text),
                "textBytes": len(text.encode("utf-8")),
                "fieldsPresent": fields,
                "appearances": 1,
                "queryIds": [query_id] if query_id else [],
            }

            existing = by_identity.get(identity)
            if existing is None:
                by_identity[identity] = proposal
                continue

            existing["appearances"] += 1
            existing["queryIds"] = sorted(set(existing["queryIds"]) | set(proposal["queryIds"]))
            existing["providers"] = sorted(set(existing["providers"]) | set(proposal["providers"]))
            existing["sourceIds"] = sorted(set(existing["sourceIds"]) | set(proposal["sourceIds"]))
            existing["allDois"] = sorted(set(existing["allDois"]) | set(proposal["allDois"]))
            if candidate_quality(item, text, fields) > candidate_quality(
                existing, existing["documentText"], existing["fieldsPresent"]
            ):
                keep = {
                    "appearances": existing["appearances"],
                    "queryIds": existing["queryIds"],
                    "providers": existing["providers"],
                    "sourceIds": existing["sourceIds"],
                    "allDois": existing["allDois"],
                }
                by_identity[identity] = {**proposal, **keep}

    candidates = [by_identity[key] for key in sorted(by_identity)]
    release_rows = []
    text_tiers = defaultdict(int)
    identity_states = defaultdict(int)
    provider_counts = defaultdict(int)

    for ordinal, item in enumerate(candidates):
        tier = (
            "title+abstract"
            if "abstract" in item["fieldsPresent"]
            else "title+metadata"
            if len(item["fieldsPresent"]) > 1
            else "title-only"
        )
        text_tiers[tier] += 1
        identity_states[item["identityState"]] += 1
        for provider in item["providers"]:
            provider_counts[provider] += 1

        # Deliberately excludes abstract/body text from the publishable metadata.
        release_rows.append({
            "ordinal": ordinal,
            "identity": item["identity"],
            "identityState": item["identityState"],
            "title": item["title"],
            "year": item["year"],
            "doi": item["doi"],
            "openalexWorkId": item["openalexWorkId"],
            "providers": item["providers"],
            "sourceIds": item["sourceIds"],
            "urls": item["urls"],
            "textSha256": item["textSha256"],
            "textCharacters": item["textCharacters"],
            "textBytes": item["textBytes"],
            "fieldsPresent": item["fieldsPresent"],
            "textTier": tier,
            "appearances": item["appearances"],
            "queryIds": item["queryIds"],
        })

    report = {
        "schemaVersion": SCHEMA,
        "status": "prepared-unembedded",
        "textContract": {
            "name": TEXT_CONTRACT,
            "maxCharacters": MAX_CHARACTERS,
            "fieldOrder": ["Title", "Abstract", "Authors", "Topics", "Keywords"],
            "fieldFormat": "<Label>:\\n<normalized value>",
            "blockSeparator": "\\n\\n",
            "historicalSource": "PR #4 semantic_retrieval/documents.py@4ad76042...",
        },
        "capture": {
            "queryCount": len(capture.get("runs") or []),
            "resultAppearances": appearances,
            "completedAt": capture.get("completedAt"),
        },
        "candidateCount": len(candidates),
        "excluded": dict(sorted(excluded.items())),
        "identityStates": dict(sorted(identity_states.items())),
        "textTiers": dict(sorted(text_tiers.items())),
        "providers": dict(sorted(provider_counts.items())),
        "rawAbstractIncludedInPublishableMetadata": False,
        "embeddingsGenerated": False,
        "productionEnabled": False,
        "publishedToHf": False,
    }
    return candidates, release_rows, report


def write_outputs(candidates: list[dict], release_rows: list[dict], report: dict,
                  private_output: Path, artifact_output: Path) -> None:
    private_output.parent.mkdir(parents=True, exist_ok=True)
    with private_output.open("w", encoding="utf-8") as handle:
        for item in candidates:
            handle.write(json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n")

    artifact_output.mkdir(parents=True, exist_ok=True)
    metadata_path = artifact_output / "overlay-metadata.jsonl.gz"
    with metadata_path.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as zipped:
            for row in release_rows:
                zipped.write(
                    (json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
                    .encode("utf-8")
                )
    report["metadata"] = {
        "path": metadata_path.name,
        "bytes": metadata_path.stat().st_size,
        "sha256": hashlib.sha256(metadata_path.read_bytes()).hexdigest(),
        "count": len(release_rows),
    }
    (artifact_output / "seed-report.json").write_text(
        json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", required=True, type=Path)
    parser.add_argument("--authority-report", required=True, type=Path)
    parser.add_argument("--alias-root", required=True, type=Path)
    parser.add_argument("--private-output", required=True, type=Path)
    parser.add_argument("--artifact-output", required=True, type=Path)
    args = parser.parse_args()
    try:
        capture = json.loads(args.capture.read_text(encoding="utf-8"))
        authority = json.loads(args.authority_report.read_text(encoding="utf-8"))
        candidates, metadata, report = prepare(capture, authority, args.alias_root)
        if not candidates:
            raise OverlaySeedError("No overlay candidates survived exact identity filtering")
        write_outputs(candidates, metadata, report, args.private_output, args.artifact_output)
        print(json.dumps({
            "candidateCount": len(candidates),
            "identityStates": report["identityStates"],
            "textTiers": report["textTiers"],
            "excluded": report["excluded"],
            "publishableContainsAbstract": False,
        }, sort_keys=True))
        return 0
    except (OverlaySeedError, OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"RA12-C5-B seed ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""RA12-C5-A: resolve DOI-bearing federated results to exact OpenAlex works.

The resolver is deliberately offline from the browser runtime:
- reads a captured real federated SearchResponse snapshot;
- batches up to 100 DOI values per OpenAlex API request;
- accepts only exact DOI echoes and canonical OpenAlex W IDs;
- checks whether each W ID exists in the frozen V4 semantic base;
- writes a deterministic sharded DOI authority index plus audit evidence.

It never fuzzy-matches title/year and never generates embeddings.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from build_ra12_semantic_alias_index import normalize_doi
from analyze_ra12c4_live_coverage import resolve_alias
from build_ra12_vector_lookup import gzip_deterministic, sha256

SCHEMA = "research-atlas-ra12c5a-doi-openalex-authority-v1"
INDEX_SCHEMA = "research-atlas-ra12c5a-doi-authority-index-v1"
OPENALEX_BASE = "https://api.openalex.org/works"
WORK_RE = re.compile(r"(?:^|openalex\.org/)(W[1-9][0-9]*)$", re.I)
MAX_BATCH = 100


class AuthorityError(RuntimeError):
    pass


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def canonical_work_id(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    match = WORK_RE.search(text)
    return match.group(1).upper() if match else None


def doi_aliases(item: dict) -> list[str]:
    found = set()
    for value in (
        item.get("doi"),
        item.get("crossrefId"),
        item.get("crossref_id"),
        (item.get("urls") or {}).get("doi"),
        (item.get("urls") or {}).get("canonical"),
    ):
        doi = normalize_doi(value)
        if doi:
            found.add(doi)
    for alias in item.get("semanticAliases") or []:
        if isinstance(alias, str) and alias.startswith(("doi:", "crossref:")):
            doi = normalize_doi(alias.split(":", 1)[1])
            if doi:
                found.add(doi)
    return sorted(found)


def collect_doi_candidates(capture: dict) -> tuple[list[str], dict[str, dict]]:
    evidence: dict[str, dict] = {}
    appearances = 0
    for run in capture.get("runs") or []:
        query_id = str(run.get("id") or "")
        for item in run.get("results") or []:
            dois = doi_aliases(item)
            if not dois:
                continue
            appearances += 1
            for doi in dois:
                entry = evidence.setdefault(doi, {
                    "doi": doi,
                    "queryIds": set(),
                    "providers": set(),
                    "resultIds": set(),
                    "titles": set(),
                    "ranks": [],
                    "appearances": 0,
                })
                entry["appearances"] += 1
                if query_id:
                    entry["queryIds"].add(query_id)
                for provider in item.get("providers") or []:
                    entry["providers"].add(str(provider))
                if item.get("id"):
                    entry["resultIds"].add(str(item["id"]))
                if item.get("title"):
                    entry["titles"].add(str(item["title"]))
                if isinstance(item.get("rank"), int):
                    entry["ranks"].append(item["rank"])
    serial = {}
    for doi, item in evidence.items():
        serial[doi] = {
            "doi": doi,
            "queryIds": sorted(item["queryIds"]),
            "providers": sorted(item["providers"]),
            "resultIds": sorted(item["resultIds"]),
            "titles": sorted(item["titles"])[:8],
            "ranks": sorted(item["ranks"]),
            "appearances": item["appearances"],
        }
    return sorted(serial), serial


def filter_value(doi: str) -> str:
    # OpenAlex filtering treats comma as a filter separator unless quoted.
    value = f"https://doi.org/{doi}"
    if "," in value:
        value = '"' + value.replace('"', "") + '"'
    if "|" in doi:
        raise AuthorityError(f"DOI contains unsupported OpenAlex OR delimiter: {doi}")
    return value


def request_url(dois: list[str]) -> str:
    if not 1 <= len(dois) <= MAX_BATCH:
        raise AuthorityError("OpenAlex DOI batch must contain 1..100 values")
    filter_expr = "doi:" + "|".join(filter_value(doi) for doi in dois)
    return OPENALEX_BASE + "?" + urlencode({
        "filter": filter_expr,
        "per_page": "100",
        "select": "id,doi,title,publication_year,type",
    })


def fetch_json(url: str, timeout: int = 45, attempts: int = 4) -> tuple[dict, bytes, dict]:
    last_error: Exception | None = None
    headers = {
        "Accept": "application/json",
        "User-Agent": "InvestigacionFilosofica-RA12-C5A/1.0",
    }
    for attempt in range(attempts):
        try:
            request = Request(url, headers=headers, method="GET")
            with urlopen(request, timeout=timeout) as response:
                status = getattr(response, "status", 200)
                body = response.read()
                response_headers = {k.lower(): v for k, v in response.headers.items()}
            if status != 200:
                raise AuthorityError(f"OpenAlex HTTP {status}")
            try:
                payload = json.loads(body)
            except json.JSONDecodeError as exc:
                raise AuthorityError("OpenAlex returned invalid JSON") from exc
            return payload, body, response_headers
        except HTTPError as exc:
            last_error = exc
            retryable = exc.code == 429 or exc.code >= 500
            if not retryable or attempt + 1 >= attempts:
                raise AuthorityError(f"OpenAlex HTTP {exc.code}") from exc
            retry_after = exc.headers.get("Retry-After")
            wait = float(retry_after) if retry_after and retry_after.replace(".", "", 1).isdigit() else (1.5 * (attempt + 1))
        except (URLError, TimeoutError, OSError) as exc:
            last_error = exc
            if attempt + 1 >= attempts:
                raise AuthorityError(f"OpenAlex network failure: {exc}") from exc
            wait = 1.5 * (attempt + 1)
        time.sleep(min(wait, 10))
    raise AuthorityError(f"OpenAlex request failed: {last_error}")


def normalize_response(
    payload: dict, requested: set[str]
) -> tuple[dict[str, list[dict]], list[dict], list[dict]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
        raise AuthorityError("OpenAlex response missing results list")
    mapping: dict[str, list[dict]] = defaultdict(list)
    ignored_overreturns: list[dict] = []
    anomalies: list[dict] = []
    for result in payload["results"]:
        if not isinstance(result, dict):
            anomalies.append({"reason": "non-object-result"})
            continue
        doi = normalize_doi(result.get("doi"))
        work_id = canonical_work_id(result.get("id"))
        if not doi:
            anomalies.append({
                "reason": "invalid-or-missing-doi",
                "doi": result.get("doi"),
                "id": result.get("id"),
            })
            continue
        if doi not in requested:
            # A live OpenAlex batch can over-return a nearby DOI. This is not
            # accepted as identity evidence; record and ignore it fail-closed.
            ignored_overreturns.append({
                "reason": "unrequested-doi-overreturn",
                "doi": doi,
                "id": result.get("id"),
            })
            continue
        if not work_id:
            anomalies.append({
                "reason": "invalid-openalex-work-id",
                "doi": doi,
                "id": result.get("id"),
            })
            continue
        mapping[doi].append({
            "doi": doi,
            "workId": work_id,
            "title": result.get("title"),
            "publicationYear": result.get("publication_year"),
            "type": result.get("type"),
        })
    for doi in list(mapping):
        unique = {}
        for item in mapping[doi]:
            unique[item["workId"]] = item
        mapping[doi] = [unique[key] for key in sorted(unique)]
    return dict(mapping), ignored_overreturns, anomalies


def v4_location(alias_root: Path, work_id: str, cache: dict[int, dict]) -> dict | None:
    return resolve_alias(alias_root, "openalex:" + work_id, cache)


def classify_authority(
    dois: list[str],
    evidence: dict[str, dict],
    openalex_mapping: dict[str, list[dict]],
    alias_root: Path,
) -> list[dict]:
    cache: dict[int, dict] = {}
    records = []
    for doi in dois:
        candidates = openalex_mapping.get(doi, [])
        record = {
            **evidence[doi],
            "state": None,
            "openalexWorkId": None,
            "v4Location": None,
        }
        if len(candidates) == 0:
            record["state"] = "openalex-unmatched"
        elif len(candidates) > 1:
            record["state"] = "openalex-ambiguous"
            record["openalexCandidates"] = candidates
        else:
            work = candidates[0]
            record["openalexWorkId"] = work["workId"]
            record["openalex"] = {
                "title": work.get("title"),
                "publicationYear": work.get("publicationYear"),
                "type": work.get("type"),
            }
            location = v4_location(alias_root, work["workId"], cache)
            if location:
                record["state"] = "v4-existing-by-doi"
                record["v4Location"] = location
            else:
                record["state"] = "openalex-outside-v4"
        records.append(record)
    return records


def direct_v4(item: dict, alias_root: Path, cache: dict[int, dict]) -> bool:
    for alias in item.get("semanticAliases") or []:
        if isinstance(alias, str) and alias.startswith("openalex:"):
            if resolve_alias(alias_root, alias, cache):
                return True
    return False


def coverage_after_enrichment(
    capture: dict,
    records: list[dict],
    alias_root: Path,
    cutoffs: list[int],
) -> dict:
    by_doi = {item["doi"]: item for item in records}
    cache: dict[int, dict] = {}
    aggregate = {}
    unique_overlay = set()
    unique_recovered = set()

    for cutoff in cutoffs:
        counts = {
            "observedResults": 0,
            "baseDirect": 0,
            "baseAliasEnriched": 0,
            "overlayAfterEnrichment": 0,
            "unresolved": 0,
        }
        for run in capture.get("runs") or []:
            for item in (run.get("results") or [])[:cutoff]:
                counts["observedResults"] += 1
                if direct_v4(item, alias_root, cache):
                    counts["baseDirect"] += 1
                    continue
                recovered = None
                for doi in doi_aliases(item):
                    authority = by_doi.get(doi)
                    if authority and authority["state"] == "v4-existing-by-doi":
                        recovered = authority
                        break
                if recovered:
                    counts["baseAliasEnriched"] += 1
                    unique_recovered.add(recovered["doi"])
                    continue
                identity = item.get("overlayIdentity")
                if identity and int(item.get("overlayTextBytes") or 0) > 0:
                    counts["overlayAfterEnrichment"] += 1
                    unique_overlay.add(identity)
                else:
                    counts["unresolved"] += 1
        observed = counts["observedResults"]
        before = counts["baseDirect"] / observed if observed else 0.0
        after = (counts["baseDirect"] + counts["baseAliasEnriched"]) / observed if observed else 0.0
        aggregate[str(cutoff)] = {
            **counts,
            "baseV4CoverageBeforeDoiAuthority": before,
            "baseV4CoverageAfterDoiAuthority": after,
            "coverageGainAbsolute": after - before,
        }

    return {
        "cutoffs": aggregate,
        "uniqueRecoveredDoiAliases": len(unique_recovered),
        "uniqueOverlayIdentitiesAfterEnrichment": len(unique_overlay),
    }


def write_sharded_index(records: list[dict], output: Path) -> dict:
    if output.exists():
        raise AuthorityError(f"Output already exists: {output}")
    partitions = [[] for _ in range(256)]
    for record in records:
        doi = record["doi"]
        prefix = hashlib.sha256(doi.encode("utf-8")).digest()[0]
        row = [
            doi,
            record["state"],
            record.get("openalexWorkId"),
            (record.get("v4Location") or {}).get("vectorId"),
            (record.get("v4Location") or {}).get("cluster"),
            (record.get("v4Location") or {}).get("ordinal"),
        ]
        partitions[prefix].append(row)
    output.mkdir(parents=True)
    entries = []
    total_bytes = 0
    for prefix, rows in enumerate(partitions):
        rows.sort(key=lambda row: row[0])
        payload = b"".join(canonical_json(row) for row in rows)
        compressed = gzip_deterministic(payload)
        path = output / f"part-{prefix:03d}.jsonl.gz"
        path.write_bytes(compressed)
        entries.append({
            "prefix": prefix,
            "path": path.name,
            "count": len(rows),
            "bytes": len(compressed),
            "sha256": sha256(compressed),
        })
        total_bytes += len(compressed)
    return {
        "schemaVersion": INDEX_SCHEMA,
        "partitionRule": "first-byte-sha256(normalized-doi)",
        "partitionCount": 256,
        "entryCount": len(records),
        "compressedBytes": total_bytes,
        "partitions": entries,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", required=True, type=Path)
    parser.add_argument("--alias-root", required=True, type=Path)
    parser.add_argument("--query-set", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()

    try:
        if not 1 <= args.batch_size <= MAX_BATCH:
            raise AuthorityError("batch-size must be 1..100")
        capture = json.loads(args.capture.read_text(encoding="utf-8"))
        query_set = json.loads(args.query_set.read_text(encoding="utf-8"))
        dois, evidence = collect_doi_candidates(capture)

        args.output_dir.mkdir(parents=True, exist_ok=True)
        raw_dir = args.output_dir / "raw-openalex"
        raw_dir.mkdir()
        openalex_mapping: dict[str, list[dict]] = {}
        requests = []
        ignored_overreturns = []
        anomalies = []

        for batch_number, start in enumerate(range(0, len(dois), args.batch_size), start=1):
            batch = dois[start:start + args.batch_size]
            url = request_url(batch)
            payload, raw, headers = fetch_json(url)
            raw_path = raw_dir / f"batch-{batch_number:03d}.json"
            raw_path.write_bytes(raw)
            normalized, batch_overreturns, batch_anomalies = normalize_response(payload, set(batch))
            for doi, values in normalized.items():
                openalex_mapping.setdefault(doi, []).extend(values)
            ignored_overreturns.extend(batch_overreturns)
            anomalies.extend(batch_anomalies)
            requests.append({
                "batch": batch_number,
                "requestedDoiCount": len(batch),
                "url": url,
                "responseBytes": len(raw),
                "responseSha256": hashlib.sha256(raw).hexdigest(),
                "resultCount": len(payload.get("results") or []),
                "rateLimitRemaining": headers.get("x-ratelimit-remaining"),
            })

        # Dedupe across responses, though batches are disjoint by DOI.
        for doi in list(openalex_mapping):
            unique = {}
            for item in openalex_mapping[doi]:
                unique[item["workId"]] = item
            openalex_mapping[doi] = [unique[key] for key in sorted(unique)]

        records = classify_authority(dois, evidence, openalex_mapping, args.alias_root)
        counts = defaultdict(int)
        providers = defaultdict(lambda: defaultdict(int))
        for record in records:
            counts[record["state"]] += 1
            for provider in record["providers"]:
                providers[provider][record["state"]] += 1

        index = write_sharded_index(records, args.output_dir / "doi-index")
        coverage = coverage_after_enrichment(
            capture, records, args.alias_root, [int(v) for v in query_set["cutoffs"]]
        )

        report = {
            "schemaVersion": SCHEMA,
            "status": "live-openalex-doi-authority-measured",
            "capturedAt": datetime.now(timezone.utc).isoformat(),
            "source": {
                "openAlexApi": OPENALEX_BASE,
                "batchLimit": MAX_BATCH,
                "exactDoiEchoRequired": True,
                "fuzzyTitleYearIdentity": False,
                "liveOpenAlexClientRuntimeEnabled": False,
            },
            "input": {
                "captureCompletedAt": capture.get("completedAt"),
                "queryCount": len(capture.get("runs") or []),
                "doiCandidateCount": len(dois),
                "doiAppearanceCount": sum(item["appearances"] for item in evidence.values()),
            },
            "authority": {
                "counts": dict(sorted(counts.items())),
                "providerStates": {
                    provider: dict(sorted(states.items()))
                    for provider, states in sorted(providers.items())
                },
                "records": records,
                "ignoredFilterOverreturns": ignored_overreturns,
                "anomalies": anomalies,
            },
            "requests": requests,
            "index": index,
            "coverage": coverage,
            "productionEnabled": False,
            "embeddingsGenerated": False,
            "publishedToHf": False,
        }
        (args.output_dir / "authority-report.json").write_text(
            json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
            encoding="utf-8",
        )
        print(json.dumps({
            "doiCandidates": len(dois),
            "states": dict(sorted(counts.items())),
            "coverage": coverage,
            "requests": len(requests),
            "ignoredFilterOverreturns": len(ignored_overreturns),
            "anomalies": len(anomalies),
        }, sort_keys=True))
        return 0
    except (AuthorityError, OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"RA12-C5-A ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

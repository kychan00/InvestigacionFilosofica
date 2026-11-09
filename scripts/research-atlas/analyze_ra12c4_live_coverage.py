#!/usr/bin/env python3
"""RA12-C4: join real federated SearchResponses to the V4 semantic alias index.

Outputs coverage at top 5/20/50, provider-level breakdown and a deduplicated
overlay candidate queue. No embedding is generated and no source record is
silently treated as an identity match by title/year.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
from statistics import median


def load_partition(alias_root: Path, prefix: int, cache: dict[int, dict]):
    if prefix in cache:
        return cache[prefix]
    path = alias_root / f"aliases/part-{prefix:03d}.jsonl.gz"
    data = {}
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        for line in handle:
            row = json.loads(line)
            if not isinstance(row, list) or len(row) != 5:
                raise ValueError("Invalid alias row")
            alias, work_id, vector_id, cluster, ordinal = row
            if alias in data:
                raise ValueError("Duplicate alias inside partition")
            data[alias] = {
                "workId": work_id,
                "vectorId": vector_id,
                "cluster": cluster,
                "ordinal": ordinal,
            }
    cache[prefix] = data
    return data


def resolve_alias(alias_root: Path, alias: str, cache: dict[int, dict]):
    prefix = hashlib.sha256(alias.encode("utf-8")).digest()[0]
    return load_partition(alias_root, prefix, cache).get(alias)


def classify(alias_root: Path, item: dict, cache: dict[int, dict]):
    for alias in item.get("semanticAliases", []):
        found = resolve_alias(alias_root, alias, cache)
        if found:
            return {
                "state": "base-direct" if alias.startswith("openalex:") else "base-alias",
                "alias": alias,
                "location": found,
            }
    if item.get("overlayIdentity") and int(item.get("overlayTextBytes") or 0) > 0:
        return {
            "state": "overlay-candidate",
            "overlayIdentity": item["overlayIdentity"],
        }
    return {"state": "unresolved"}


def pctl(values, p):
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round((len(ordered) - 1) * p)))
    return ordered[index]


def analyze(capture: dict, alias_root: Path, alias_manifest: dict, cutoffs: list[int]):
    cache = {}
    overlay = {}
    runs = []
    provider_totals = {}
    for run in capture["runs"]:
        classified = []
        for item in run["results"]:
            state = classify(alias_root, item, cache)
            row = {**item, "semanticCoverage": state}
            classified.append(row)
            if state["state"] == "overlay-candidate":
                identity = state["overlayIdentity"]
                current = overlay.get(identity)
                candidate = {
                    "identity": identity,
                    "title": item.get("title") or "",
                    "abstract": item.get("abstract"),
                    "year": item.get("year"),
                    "doi": item.get("doi"),
                    "providers": item.get("providers") or [],
                    "sourceRecords": item.get("sourceRecords") or [],
                    "textBytes": item.get("overlayTextBytes") or 0,
                    "firstQueryId": run["id"],
                    "firstRank": item["rank"],
                }
                if current is None or candidate["firstRank"] < current["firstRank"]:
                    overlay[identity] = candidate

        cut = {}
        for cutoff in cutoffs:
            subset = classified[:cutoff]
            counts = {k: 0 for k in ("base-direct", "base-alias", "overlay-candidate", "unresolved")}
            for item in subset:
                counts[item["semanticCoverage"]["state"]] += 1
            available = counts["base-direct"] + counts["base-alias"]
            joinable = available + counts["overlay-candidate"]
            cut[str(cutoff)] = {
                "observedResults": len(subset),
                **counts,
                "baseV4Coverage": available / len(subset) if subset else 0,
                "eventualQwenCoverageIfOverlayEmbedded": joinable / len(subset) if subset else 0,
            }
        for item in classified:
            state = item["semanticCoverage"]["state"]
            for provider in item.get("providers") or ["(unknown)"]:
                bucket = provider_totals.setdefault(provider, {
                    "results": 0, "base-direct": 0, "base-alias": 0,
                    "overlay-candidate": 0, "unresolved": 0
                })
                bucket["results"] += 1
                bucket[state] += 1
        runs.append({
            "id": run["id"], "query": run["query"],
            "durationMs": run["durationMs"],
            "resultCount": run["resultCount"],
            "capturedTop": len(classified),
            "errors": run["errors"],
            "providerStats": run["stats"].get("providers", {}),
            "cutoffs": cut,
            "results": classified,
        })

    durations = [r["durationMs"] for r in runs]
    cutoff_summary = {}
    for cutoff in cutoffs:
        rows = [r["cutoffs"][str(cutoff)] for r in runs]
        observed = sum(x["observedResults"] for x in rows)
        aggregate = {k: sum(x[k] for x in rows)
                     for k in ("base-direct", "base-alias", "overlay-candidate", "unresolved")}
        base = aggregate["base-direct"] + aggregate["base-alias"]
        eventual = base + aggregate["overlay-candidate"]
        cutoff_summary[str(cutoff)] = {
            "queryCount": len(rows),
            "observedResults": observed,
            **aggregate,
            "baseV4Coverage": base / observed if observed else 0,
            "eventualQwenCoverageIfOverlayEmbedded": eventual / observed if observed else 0,
        }

    return {
        "schemaVersion": "research-atlas-ra12c4-live-federated-coverage-v1",
        "status": "measured-live-search-snapshot",
        "sourceAliasIndex": {
            "schemaVersion": alias_manifest["schemaVersion"],
            "entries": alias_manifest["index"]["entryCount"],
            "compressedBytes": alias_manifest["index"]["compressedBytes"],
            "ambiguousAliasesExcluded": alias_manifest["identity"]["ambiguousAliasesExcluded"],
        },
        "queryCount": len(runs),
        "cutoffs": cutoff_summary,
        "providers": dict(sorted(provider_totals.items())),
        "searchLatencyMs": {
            "p50": median(durations) if durations else None,
            "p95": pctl(durations, 0.95),
            "min": min(durations) if durations else None,
            "max": max(durations) if durations else None,
            "note": "whole federated search latency in CI Chromium; not vector-proof latency"
        },
        "runs": runs,
        "overlayQueue": {
            "candidateCount": len(overlay),
            "items": sorted(overlay.values(), key=lambda x: (x["firstQueryId"], x["firstRank"], x["identity"])),
            "embeddingGenerated": False,
            "publicationEnabled": False,
        },
        "methodology": {
            "baseDirect": "OpenAlex alias resolves directly into frozen V4",
            "baseAlias": "DOI/Crossref alias resolves exactly into frozen V4",
            "overlayCandidate": "stable DOI or single-provider identity plus title text; requires future Qwen embedding",
            "unresolved": "no exact V4 alias and insufficient stable identity/text",
            "fuzzyTitleYearIdentity": False,
            "liveOpenAlexApiUsed": False,
        },
        "productionEnabled": False,
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--capture", required=True, type=Path)
    p.add_argument("--alias-root", required=True, type=Path)
    p.add_argument("--query-set", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--overlay-output", required=True, type=Path)
    args = p.parse_args()
    capture = json.loads(args.capture.read_text())
    query_set = json.loads(args.query_set.read_text())
    alias_manifest = json.loads((args.alias_root / "alias-manifest.json").read_text())
    result = analyze(capture, args.alias_root, alias_manifest, query_set["cutoffs"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n")
    args.overlay_output.write_text(json.dumps(result["overlayQueue"], ensure_ascii=False, sort_keys=True, indent=2) + "\n")
    print(json.dumps({
        "queries": result["queryCount"],
        "cutoffs": result["cutoffs"],
        "overlayCandidates": result["overlayQueue"]["candidateCount"],
        "latencyMs": result["searchLatencyMs"],
    }, sort_keys=True))


if __name__ == "__main__":
    main()

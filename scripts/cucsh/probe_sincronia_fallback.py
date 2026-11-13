#!/usr/bin/env python3
"""Second-pass fallback for Sincronía pages unavailable in first source audit.

Only uses prior run 43035275585 evidence to target unavailable originals and
still-damaged original titles. Tries documented UdeG historical host aliases
and one Internet Archive availability lookup, without a broad archive crawl.
No changes are accepted without page/title identity checks from the strict
enrichment code. All unresolved cases remain in a downloadable report.
"""
from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from scripts.cucsh.enrich_sincronia_remaining import (
    TRUSTED_HOSTS, apply_evidence, derive_proposals,
)
from scripts.cucsh.harvest import serialize_dataset
from scripts.cucsh.sincronia_legacy import (
    request_bytes, wayback_snapshot_url, is_html_url,
)

FIRST_AUDIT_RUN = 43035275585
RUN_ID = int(os.environ.get("GITHUB_RUN_ID", "0"))


def fallback_candidates(url):
    parsed = urlsplit(url)
    host = (parsed.hostname or "").casefold()
    if host not in TRUSTED_HOSTS:
        return []
    path = parsed.path
    variants = []
    # Real archived copies of Sincronía lived under these two UdeG hosts.
    if host == "sincronia.cucsh.udg.mx":
        variants.append(urlunsplit((
            "http", "fuentes.csh.udg.mx",
            "/CUCSH/Sincronia/" + path.lstrip("/"),
            parsed.query, "",
        )))
    elif host == "fuentes.csh.udg.mx" and path.casefold().startswith("/cucsh/sincronia/"):
        variants.append(urlunsplit((
            "http", "sincronia.cucsh.udg.mx",
            "/" + path.split("/", 3)[-1], parsed.query, "",
        )))
    # Some modern mirrors redirect only the HTTPS spelling successfully.
    variants.append(urlunsplit((
        "https", parsed.netloc, parsed.path, parsed.query, "",
    )))
    return list(dict.fromkeys(v for v in variants if v != url))


def targets_from_evidence(snapshot, first_report):
    errors = {
        item.get("id") for item in (first_report.get("sourceFindings") or [])
        if item.get("status") == "source_unavailable"
    }
    selected = []
    for row in snapshot["records"]:
        url = (row.get("urls") or {}).get("canonical") or ""
        if (
            row.get("journal") == "Sincronía"
            and row.get("legacyOriginal")
            and isinstance(row.get("issueNumber"), int)
            and 1 <= row["issueNumber"] <= 60
            and urlsplit(url).hostname in TRUSTED_HOSTS
            and is_html_url(url)
            and (
                row.get("id") in errors
                or "\ufffd" in str(row.get("title") or "")
                or "\ufffd" in str(row.get("abstract") or "")
            )
        ):
            selected.append(row)
    return sorted(selected, key=lambda r: (r["issueNumber"], r["id"]))


def inspect_alternatives(row):
    canonical = row["urls"]["canonical"]
    attempted, weak = [], []
    for alternative in fallback_candidates(canonical):
        try:
            html = request_bytes(alternative, timeout=6, attempts=1)
            finding = derive_proposals(row, html, False)
            attempted.append({"url": alternative, "status": finding["status"]})
            if finding["status"] == "verified_corrections":
                finding["retrievalUrl"] = alternative
                finding["retrievalMethod"] = "alternate-udg-host"
                finding["attempts"] = attempted
                return finding
            weak.append(finding)
        except Exception as exc:
            attempted.append({"url": alternative, "error": str(exc)[:200]})

    # A single availability lookup, then one archived snapshot attempt.
    try:
        snapshot_url = wayback_snapshot_url(canonical)
        if snapshot_url:
            html = request_bytes(snapshot_url, timeout=10, attempts=1)
            finding = derive_proposals(row, html, True)
            attempted.append({"url": snapshot_url, "status": finding["status"]})
            if finding["status"] == "verified_corrections":
                finding["retrievalUrl"] = snapshot_url
                finding["retrievalMethod"] = "internet-archive-snapshot"
                finding["attempts"] = attempted
                return finding
            weak.append(finding)
        else:
            attempted.append({"method": "archive-availability", "status": "not_found"})
    except Exception as exc:
        attempted.append({"method": "archive-availability", "error": str(exc)[:200]})

    return {
        "id": row["id"],
        "issue": row["issueNumber"],
        "url": canonical,
        "status": "alternative_sources_unresolved",
        "corrections": {},
        "attempts": attempted,
        "review": [
            {"status": f.get("status"), "score": f.get("identityScore"),
             "candidates": f.get("review")}
            for f in weak[:2]
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--first-evidence", type=Path, required=True)
    parser.add_argument("--after", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.before.read_text(encoding="utf-8"))
    prior = json.loads(args.first_evidence.read_text(encoding="utf-8"))
    if prior.get("runId") != FIRST_AUDIT_RUN:
        raise ValueError("Historical first-pass audit evidence does not match")
    targets = targets_from_evidence(source, prior)
    findings = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(inspect_alternatives, row): row for row in targets}
        for i, future in enumerate(as_completed(futures), start=1):
            findings.append(future.result())
            if i % 20 == 0 or i == len(targets):
                print("FALLBACK_PROGRESS", f"inspected={i}/{len(targets)}", flush=True)

    findings.sort(key=lambda f: (f.get("issue") or 0, f.get("id") or ""))
    updated, changes = apply_evidence(source, findings)

    # Preserve the exact retrieval path for every changed field, not only
    # the historical canonical URL saved in the original record.
    retrieval = {
        item["id"]: item.get("retrievalUrl")
        for item in findings if item.get("status") == "verified_corrections"
    }
    for row in updated["records"]:
        if row["id"] not in retrieval:
            continue
        for key in (
            "legacyTitleEncodingEvidence",
            "legacyAbstractEncodingEvidence",
            "legacyAuthorEvidence",
        ):
            if (
                isinstance(row.get(key), dict)
                and row[key].get("auditRunId") == RUN_ID
            ):
                row[key]["retrievalUrl"] = retrieval[row["id"]]

    remain_authors = sum(
        row.get("journal") == "Sincronía"
        and isinstance(row.get("issueNumber"), int)
        and 1 <= row["issueNumber"] <= 60
        and not row.get("authors")
        for row in updated["records"]
    )
    remain_bad_text = sum(
        row.get("journal") == "Sincronía"
        and isinstance(row.get("issueNumber"), int)
        and 1 <= row["issueNumber"] <= 60
        and any("\ufffd" in str(row.get(k) or "") for k in ("title", "abstract"))
        for row in updated["records"]
    )
    report = {
        "firstAuditRun": FIRST_AUDIT_RUN,
        "currentRun": RUN_ID,
        "targetCount": len(targets),
        "statusCounts": dict(sorted(Counter(
            item["status"] for item in findings
        ).items())),
        "recordsUpdated": len(changes),
        "changes": changes,
        "stillWithoutAuthors": remain_authors,
        "stillWithDamagedText": remain_bad_text,
        "evidence": findings,
        "policy": (
            "Only strict original-page title identity plus explicit byline "
            "or title-adjacent attribution authorizes changes. No guesswork, "
            "no modification of unrelated records, no main branch changes."
        ),
    }
    args.after.write_text(serialize_dataset(updated), encoding="utf-8")
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_FALLBACK_SUMMARY", json.dumps({
        key: report[key] for key in (
            "targetCount", "statusCounts", "recordsUpdated",
            "stillWithoutAuthors", "stillWithDamagedText"
        )
    }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()

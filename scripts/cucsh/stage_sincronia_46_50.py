#!/usr/bin/env python3
"""Stage strictly matched Sincronía issue-46/50 author-index repair evidence.

Read the immutable report from GitHub Actions #43131658279. Only one-to-one
author-label matches with original URL, journal/issue and catalogue article-ID
agreement can change. Restore article titles only where no prior verified
title repair exists. Previously verified title repairs stay immutable.
Do not remove the two navigation items or invent missing source articles.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
from collections import Counter
from pathlib import Path

from scripts.cucsh.harvest import serialize_dataset
from scripts.cucsh.reconstruct_sincronia_issue17 import score_legacy_label

RUN_ID = int(os.environ.get("GITHUB_RUN_ID", "0"))
EVIDENCE_RUN = 43131658279
TARGET_ISSUES = {46, 50}
EXPECTED = {46: 14, 50: 4}
MATCH_KIND = "author_label_needs_title_reconstruction"
SOURCE_PREFIX = "https://dialnet.unirioja.es/servlet/articulo?codigo="


def source_rows(report):
    if (
        report.get("issuesRetrieved") != [46, 47, 48, 50]
        or report.get("issuesUnavailable")
        or report.get("status") != "review_ready"
    ):
        raise ValueError("Prior source audit was incomplete or unexpected")
    found, codes = {}, set()
    for group in report.get("issues") or []:
        issue = group.get("issue")
        if issue not in TARGET_ISSUES:
            continue
        if group.get("status") != "needs_review":
            raise ValueError(f"Issue {issue} source review status changed")
        entries = [
            x for x in group.get("articleMatches") or []
            if x.get("status") == MATCH_KIND
        ]
        if len(entries) != EXPECTED[issue]:
            raise ValueError(
                f"Issue {issue} expected {EXPECTED[issue]} author labels, got {len(entries)}"
            )
        for item in entries:
            source = item.get("source") or {}
            code = source.get("sourceId") or ""
            url = source.get("url")
            if (
                not code.startswith("dialnet:")
                or not code.split(":", 1)[1].isdecimal()
                or url != SOURCE_PREFIX + code.split(":", 1)[1]
                or item.get("method") != "index_author_label_to_article"
                or not source.get("title")
                or "\ufffd" in source["title"]
                or not source.get("authors")
                or not item.get("localId")
                or not item.get("localUrl")
                or not item.get("localTitle")
                or item["localId"] in found
                or (issue, code) in codes
            ):
                raise ValueError("Untrusted or duplicate Dialnet source mapping")
            score = score_legacy_label(item["localTitle"], [
                {"name": name} for name in source["authors"]
            ])
            if (
                score < 0.8
                or abs(score - item.get("confidence", 0)) > 0.0002
            ):
                raise ValueError("Source name does not independently match index label")
            found[item["localId"]] = (issue, item, score)
            codes.add((issue, code))
    if len(found) != sum(EXPECTED.values()):
        raise ValueError("Evidence did not provide all 18 exact unique mappings")
    return found


def stage(snapshot, report, run_id=RUN_ID):
    rows = snapshot.get("records")
    if not isinstance(rows, list) or len({r.get("id") for r in rows}) != len(rows):
        raise ValueError("Invalid source snapshot or repeated ID")
    targets = source_rows(report)
    by_id = {r["id"]: r for r in rows}
    if not set(targets) <= set(by_id):
        raise ValueError("Catalogue source mapping refers to unknown local article")
    revised, changes = [], []
    for row in rows:
        key = row.get("id")
        if key not in targets:
            revised.append(row)
            continue
        issue, item, score = targets[key]
        evidence = item["source"]
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != issue
            or row.get("legacyOriginal") is not True
            or row.get("title") != item["localTitle"]
            or (row.get("urls") or {}).get("canonical") != item["localUrl"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
        ):
            raise ValueError("Source record changed since prior audit: " + str(key))
        newer = copy.deepcopy(row)
        persons = evidence["authors"]
        newer["authors"] = [
            {"name": name, "sourceName": name} for name in persons
        ]
        identity = {
            "kind": "verified-dialnet-author-index-to-article",
            "auditRunId": run_id, "sourceAuditRunId": EVIDENCE_RUN,
            "sourceIssue": issue,
            "sourceId": evidence["sourceId"],
            "sourceUrl": evidence["url"],
            "previousIndexTitle": item["localTitle"],
            "matchingScore": score,
        }
        newer["legacyAuthorEvidence"] = {
            **identity, "verifiedAuthors": persons,
        }
        title_repaired = not row.get("legacyTitleEncodingEvidence")
        if title_repaired:
            newer["title"] = evidence["title"]
            newer["titleVariants"] = [evidence["title"]]
            newer["legacyIndexMislabelEvidence"] = {
                **identity,
                "kind": "original-issue-index-used-author-names-instead-of-title",
                "previousTitle": item["localTitle"],
            }
        revised.append(newer)
        changes.append({
            "recordId": key,
            "issue": issue,
            "authors": persons,
            "sourceArticleId": evidence["sourceId"],
            "titleBefore": row["title"],
            "titleAfter": newer["title"],
            "titleReconstructed": title_repaired,
            "priorTitleEvidencePreserved": bool(
                row.get("legacyTitleEncodingEvidence")
            ),
        })
    if len(changes) != 18 or len(revised) != len(rows):
        raise ValueError(f"Expected exactly 18 article repairs, got {len(changes)}")
    stats = Counter((c["issue"], c["titleReconstructed"]) for c in changes)
    output = {
        "sourceAuditRunId": EVIDENCE_RUN, "auditRunId": run_id,
        "sourceScope": "Sincronía original issues 46 and 50",
        "changedRecords": len(changes),
        "reconstructedTitles": sum(c["titleReconstructed"] for c in changes),
        "authorsRestored": len(changes),
        "priorTitleEvidencePreserved": sum(
            c["priorTitleEvidencePreserved"] for c in changes
        ),
        "beforeRecords": len(rows), "afterRecords": len(revised),
        "changes": changes,
        "policy": (
            "Only 18 1:1 matched issue 46/50 author-label records. Keep all "
            "prior title-encoding evidence unchanged, preserve source URLs "
            "and IDs, and never remove navigation/administrative records."
        ),
    }
    return {**snapshot, "records": revised}, output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--after", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    snapshot = json.loads(args.before.read_text(encoding="utf-8"))
    prior = json.loads(args.evidence.read_text(encoding="utf-8"))
    after, report = stage(snapshot, prior)
    args.after.write_text(serialize_dataset(after), encoding="utf-8")
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_46_50_RECONCILIATION", json.dumps({
        k: report[k] for k in (
            "changedRecords", "reconstructedTitles", "authorsRestored",
            "priorTitleEvidencePreserved", "beforeRecords", "afterRecords",
        )
    }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()

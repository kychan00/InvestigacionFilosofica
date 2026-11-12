#!/usr/bin/env python3
"""Reconstruct issue 17 Sincronía articles misindexed under author names.

Dialnet issue 17 contains 13 articles; the original early issue index yielded
13 records with author-list labels instead of article titles. Reconcile those
records by a unique author-token identity and retain both source URLs, all
stable record identities, and the original index text as provenance.

This is all-or-nothing: do not stage a partial/inferred remap.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import unicodedata
from collections import Counter
from pathlib import Path

from scripts.cucsh.harvest import serialize_dataset
from scripts.cucsh.sincronia_dialnet import KNOWN_ISSUE_URLS, harvest_dialnet_records

ISSUE = 17
EXPECTED = 13
DIALNET_ISSUE_URL = "https://dialnet.unirioja.es/ejemplar/547854"
RUN_ID = int(os.environ.get("GITHUB_RUN_ID", "0"))
STOPWORDS = {"y", "e", "and", "de", "del", "la", "las", "los", "da", "do",
             "dos", "van", "von", "el", "jr", "dr", "dra"}

# Two precisely identified errors in the original *index labels* of issue 17.
# These aliases are solely for matching author tokens, never for rewriting
# the original source text, which is preserved in provenance.
INDEX_LABEL_MATCH_ALIASES = {
    "M a rtinez , François": "Martínez, François",
    "Cardaillac-Hermosilla, Yvette": "Cardaillac-Hemosilla, Yvette",
}
TITLE_ENCODING_AUDIT = 43032349081


def tokens(text):
    value = unicodedata.normalize("NFKD", str(text or "").casefold())
    plain = "".join(letter for letter in value if not unicodedata.combining(letter))
    return set(re.findall(r"[a-z]+", plain)) - STOPWORDS


def score_legacy_label(legacy_title, catalogue_authors):
    names = [
        (value.get("name") if isinstance(value, dict) else str(value or ""))
        for value in (catalogue_authors or [])
    ]
    label_words = tokens(INDEX_LABEL_MATCH_ALIASES.get(
        legacy_title, legacy_title
    ))
    author_words = set().union(*(tokens(name) for name in names))
    if len(label_words) < 2 or len(author_words) < 2:
        return 0.0
    overlap = label_words & author_words
    if len(overlap) < 2:
        return 0.0
    coverage_label = len(overlap) / len(label_words)
    coverage_author = len(overlap) / len(author_words)
    if min(coverage_label, coverage_author) < 0.74:
        return 0.0
    return round((coverage_label + coverage_author) / 2, 4)


def reconcile_issue17(snapshot, dialnet, expected=EXPECTED, audit_run=RUN_ID):
    records = snapshot.get("records")
    if not isinstance(records, list):
        raise ValueError("Invalid snapshot")
    local = [
        row for row in records
        if row.get("journal") == "Sincronía" and row.get("issueNumber") == ISSUE
    ]
    external = [
        row for row in dialnet
        if row.get("journal") == "Sincronía" and row.get("issueNumber") == ISSUE
    ]
    if len(local) != expected or len(external) != expected:
        raise ValueError(
            f"Issue 17 source coverage mismatch: local={len(local)} "
            f"Dialnet={len(external)} expected={expected}"
        )
    if len({row.get("id") for row in records}) != len(records):
        raise ValueError("Duplicate snapshot IDs")
    if any(
        not row.get("legacyOriginal")
        or row.get("legacyIndexMislabelEvidence")
        for row in local
    ):
        raise ValueError("Issue 17 source records are not raw unreconstructed labels")

    # Five of the index author labels were ALREADY repaired for byte-encoding
    # errors in audit 43032349081. Those repairs were valid corrections of the
    # *index text*, not verification that it was an article title. Keep their
    # evidence byte-for-byte; the next layer restores the real work title.
    for row in local:
        prior = row.get("legacyTitleEncodingEvidence")
        if not prior:
            continue
        if (
            prior.get("kind") != "original-issue-index-article-url-and-title"
            or prior.get("auditRunId") != TITLE_ENCODING_AUDIT
            or prior.get("sourceIndexUrl") !=
               (row.get("urls") or {}).get("canonical")
            or not prior.get("previousTitle")
        ):
            raise ValueError(
                "Issue 17 has incompatible prior title evidence: "
                + str(row.get("id"))
            )

    if len({row.get("sourceId") for row in external}) != expected:
        raise ValueError("Dialnet article identifiers are missing or duplicated")
    if any(
        not str(row.get("sourceId") or "").startswith("dialnet:")
        or not row.get("title")
        or "\ufffd" in str(row.get("title"))
        or not row.get("authors")
        for row in external
    ):
        raise ValueError("Dialnet issue 17 metadata is incomplete")

    pairs = {}
    for old in local:
        candidates = sorted(
            [
                (score_legacy_label(old.get("title"), item["authors"]), item)
                for item in external
            ],
            key=lambda pair: pair[0],
            reverse=True,
        )
        top_score, selected = candidates[0]
        second_score = candidates[1][0] if len(candidates) > 1 else 0
        if top_score < 0.8 or top_score - second_score < 0.2:
            raise ValueError(
                "Uncertain issue 17 name-to-article relationship for "
                + str(old.get("id")) + f": {top_score}, {second_score}"
            )
        if old.get("authors"):
            original_names = {frozenset(tokens(name.get("name") if isinstance(name, dict) else name))
                              for name in old["authors"]}
            expected_names = {frozenset(tokens(a.get("name"))) for a in selected["authors"]}
            if original_names != expected_names:
                raise ValueError("Existing authors conflict: " + str(old.get("id")))
        pairs[old["id"]] = (selected, top_score)

    codes = [row.get("sourceId") for row, _ in pairs.values()]
    if len(set(codes)) != expected:
        raise ValueError("Issue 17 author labels do not yield a one-to-one article map")

    staged, repairs = [], []
    for row in records:
        if row.get("id") not in pairs:
            staged.append(row)
            continue
        external_row, confidence = pairs[row["id"]]
        original_title = row["title"]
        updated = dict(row)
        updated["title"] = external_row["title"]
        updated["titleVariants"] = [external_row["title"]]
        if not row.get("authors"):
            updated["authors"] = [
                {"name": item["name"], "sourceName": item["name"]}
                for item in external_row["authors"]
            ]
            updated["legacyAuthorEvidence"] = {
                "kind": "author-name-label-matched-to-dialnet-issue-17",
                "auditRunId": audit_run,
                "verifiedAuthors": [a["name"] for a in external_row["authors"]],
                "sourceUrl": (external_row.get("urls") or {}).get("canonical"),
            }
        evidence = {
            "kind": "original-issue-index-used-author-names-instead-of-title",
            "auditRunId": audit_run,
            "sourceIssueUrl": DIALNET_ISSUE_URL,
            "dialnetArticleId": external_row["sourceId"],
            "sourceUrl": (external_row.get("urls") or {}).get("canonical"),
            "previousTitle": original_title,
            "score": confidence,
            "priorIndexEncodingEvidencePreserved": bool(
                row.get("legacyTitleEncodingEvidence")
            ),
            "labelMatchAlias": INDEX_LABEL_MATCH_ALIASES.get(original_title),
        }
        updated["legacyIndexMislabelEvidence"] = evidence
        staged.append(updated)
        repairs.append({
            "recordId": row["id"],
            "previousIndexLabel": original_title,
            "restoredArticleTitle": updated["title"],
            "authors": [a["name"] for a in updated["authors"]],
            "dialnetArticleUrl": evidence["sourceUrl"],
            "matchingScore": confidence,
        })

    if len(staged) != len(records) or len(repairs) != expected:
        raise ValueError("Issue 17 reconciliation was not complete")
    return {**snapshot, "records": staged}, {
        "issue": ISSUE, "reconciled": len(repairs),
        "snapshotCountBefore": len(records),
        "snapshotCountAfter": len(staged),
        "sourceIssueUrl": DIALNET_ISSUE_URL,
        "auditRunId": audit_run,
        "repairs": repairs,
        "policy": (
            "Exact issue and one-to-one evidence-backed matching by historical "
            "author-label tokens; no additions or deletions. Preserve original "
            "URLs and stable article IDs."
        ),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", type=Path, required=True)
    ap.add_argument("--after", type=Path, required=True)
    ap.add_argument("--report", type=Path, required=True)
    args = ap.parse_args()

    if KNOWN_ISSUE_URLS.get(ISSUE) != DIALNET_ISSUE_URL:
        raise ValueError("Mapped Dialnet issue URL differs from source evidence")
    raw = json.loads(args.before.read_text(encoding="utf-8"))
    catalogue, covered = harvest_dialnet_records(max_issue=60, target_issues={ISSUE})
    if covered != [ISSUE]:
        raise ValueError("Dialnet issue 17 unavailable; refuse to change data")
    updated, report = reconcile_issue17(raw, catalogue)
    args.after.write_text(serialize_dataset(updated), encoding="utf-8")
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_ISSUE17_RECONCILED", json.dumps({
        "reconciled": report["reconciled"],
        "before": report["snapshotCountBefore"],
        "after": report["snapshotCountAfter"],
        "source": report["sourceIssueUrl"],
    }), flush=True)
    for repair in report["repairs"]:
        print("SINCRONIA_ISSUE17_REPAIR", json.dumps(repair, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()

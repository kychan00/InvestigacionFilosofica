#!/usr/bin/env python3
"""Offline, evidence-preserving review queue for missing Sincronía authors.

This audit never changes articles or guesses missing authors. A failed or
unverified original URL must never be interpreted as a usable access link.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path



def classify_work_identity_review(row):
    """Flag suspicious historical index labels without treating them as facts.

    A potential author label is NOT sufficient bibliographic evidence to
    overwrite a title or assign an author. All flags require manual review.
    """
    title = str(row.get("title") or "").strip()
    issue = row.get("issueNumber")
    url = str((row.get("urls") or {}).get("canonical") or "").lower()
    basename = url.rsplit("/", 1)[-1].split("?", 1)[0]

    if not re.search(r"\w", title, flags=re.UNICODE):
        return "malformed_or_punctuation_only_title"
    if issue == 46 and (
        (basename == "creditos.html" and title == "Editorial Board/Consejo Editorial")
        or (basename == "info.htm" and title == "Further information for contributors.")
    ):
        return "possible_editorial_navigation_not_article"
    if issue == 8 and basename == "bio.html" and title == "Dante Medina":
        return "possible_biography_not_article"
    if issue == 7:
        if title.casefold() == "introducción":
            return "generic_index_heading_needs_source"
        if basename in {
            "bedregal.htm", "revilla.htm", "velia.htm", "saavedra.htm",
            "quiroga.htm", "selum.htm",
        }:
            return "person_name_entry_needs_article_identity"
    if issue in {12, 13, 14, 15, 16, 18, 46, 50}:
        # Early indexes often used surname, given-name where the article
        # title should be. Require a short phrase and no colon or semicolon.
        # A 2008 multi-author label is also a possible index transposition.
        looks_like_name_label = (
            len(title) <= 90
            and bool(re.fullmatch(r"[^,:;]{2,45},\s*[^:;]{2,100}", title))
        )
        multi_name_label = (
            issue == 46 and ";" in title and title.count(",") >= 2
        )
        if looks_like_name_label or multi_name_label:
            return "possible_author_name_transcribed_as_title"
    return None


def audit_pending_authors(records):
    sincronia = [row for row in records if row.get("journal") == "Sincronía"]
    pending = [row for row in sincronia if not row.get("authors")]
    by_source = Counter()
    by_issue = Counter()
    by_availability = Counter()
    queue = []
    identity_queue = []
    identity_flags = Counter()

    for row in pending:
        source = row.get("legacyMetadataSource") or "original"
        availability = (row.get("legacyAccessStatus") or {}).get("status") or "not_verified"
        issue = row.get("issueNumber")
        by_source[source] += 1
        by_issue[str(issue) if issue is not None else "unknown"] += 1
        by_availability[availability] += 1

        urls = row.get("urls") or {}
        evidence_urls = []
        for field in (
            "legacyAuthorEvidence",
            "legacyTitleEncodingEvidence",
            "legacyCompletenessEvidence",
        ):
            evidence = row.get(field) or {}
            if isinstance(evidence, dict):
                for key in ("sourceUrl", "sourceArticleUrl", "sourceIssueUrl"):
                    url = evidence.get(key)
                    if isinstance(url, str) and url.startswith(("https://", "http://")):
                        if url not in evidence_urls:
                            evidence_urls.append(url)
        for key in ("reference",):
            url = urls.get(key)
            if isinstance(url, str) and url.startswith(("https://", "http://")):
                if url not in evidence_urls:
                    evidence_urls.append(url)

        # Evidence URLs are references for manual verification, not certified
        # working full-text links. Never upgrade source availability by inference.
        priority = (
            "inspect_bibliographic_evidence"
            if evidence_urls else
            "seek_independent_bibliography"
        )
        identity_reason = classify_work_identity_review(row)
        if identity_reason:
            identity_flags[identity_reason] += 1
            identity_queue.append({
                "id": row.get("id"),
                "issueNumber": issue,
                "titleAsIndexed": row.get("title"),
                "originalUrl": urls.get("canonical"),
                "sourceAvailability": availability,
                "reviewReason": identity_reason,
                "recommendation": (
                    "Find independent article-level table of contents or "
                    "bibliographic citation before changing title, authorship "
                    "or record type. Preserve this original index entry."
                ),
            })
        queue.append({
            "id": row.get("id"),
            "issueNumber": issue,
            "year": row.get("year"),
            "title": row.get("title"),
            "metadataSource": source,
            "sourceAvailability": availability,
            "originalUrl": urls.get("canonical"),
            "evidenceUrlsForManualReview": evidence_urls,
            "reviewPriority": priority,
            "possibleWorkIdentityIssue": identity_reason,
        })

    queue.sort(key=lambda item: (
        item["reviewPriority"] != "inspect_bibliographic_evidence",
        item["issueNumber"] if isinstance(item["issueNumber"], int) else 999,
        str(item["id"] or ""),
    ))
    title_encoding_remaining = sum(
        "\ufffd" in str(row.get("title") or "") for row in sincronia
    )
    return {
        "scope": "All available Sincronía issues",
        "status": "manual_evidence_review_required" if pending else "complete",
        "totalSincroniaRecords": len(sincronia),
        "pendingAuthorRecords": len(pending),
        "titlesWithUnicodeReplacementCharacter": title_encoding_remaining,
        "pendingBySource": dict(sorted(by_source.items())),
        "pendingByIssue": dict(sorted(by_issue.items(), key=lambda x: (
            int(x[0]) if x[0].isdigit() else 999
        ))),
        "pendingByOriginalAvailability": dict(sorted(by_availability.items())),
        "records": queue,
        "suspectedWorkIdentityRecords": sorted(
            identity_queue,
            key=lambda item: (
                item["issueNumber"] if isinstance(item["issueNumber"], int) else 999,
                item["id"] or "",
            ),
        ),
        "suspectedWorkIdentityByType": dict(sorted(identity_flags.items())),
        "suspectedWorkIdentityCount": len(identity_queue),
        "policy": (
            "Never guess an author, delete an incomplete article, or treat "
            "an unavailable historical page as an accessible full text. "
            "Reference URLs are evidence to review, not verified live links."
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    report = audit_pending_authors(data["records"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        "SINCRONIA_PENDING_AUTHOR_AUDIT",
        f"total={report['totalSincroniaRecords']}",
        f"pending={report['pendingAuthorRecords']}",
        f"damaged_titles={report['titlesWithUnicodeReplacementCharacter']}",
        f"evidence_first={sum(x['reviewPriority'] == 'inspect_bibliographic_evidence' for x in report['records'])}",
    )
    print("PENDING_BY_SOURCE", report["pendingBySource"])
    print("SUSPECTED_WORK_IDENTITY", report["suspectedWorkIdentityCount"])
    print("IDENTITY_REVIEW_BY_TYPE", report["suspectedWorkIdentityByType"])
    print("PENDING_BY_ORIGINAL_AVAILABILITY", report["pendingByOriginalAvailability"])


if __name__ == "__main__":
    main()

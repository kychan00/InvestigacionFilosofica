#!/usr/bin/env python3
"""Evidence-gated addition of four missing Sincronía articles from issues 47/48.

The full Dialnet TOCs were preserved in GitHub Action 43131658279. We first
prove one-to-one identity for ALL 24 existing local article records and then
permit exactly four new source article IDs (one in issue 47, three in 48).
Source errors, competing matches, changes to historical records, or duplicate
IDs stop the operation. No generated guesses or deleted entries.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

from scripts.cucsh.audit_sincronia_historical import normalized_title
from scripts.cucsh.harvest import serialize_dataset
from scripts.cucsh.sincronia_dialnet import KNOWN_ISSUE_URLS, build_record

SOURCE_AUDIT_RUN = 43131658279
EXPECTED = {
    47: {"local": 14, "source": 15, "missing": {"dialnet:3296017"}},
    48: {"local": 10, "source": 13, "missing": {
        "dialnet:3296366", "dialnet:3296374", "dialnet:3296377",
    }},
}
# Individually reviewed pairs from the immutable article-level audit:
# catalogue titles abbreviated in Dialnet must not create false 'new' works.
SOURCE_TO_EXISTING = {
    47: {
        "dialnet:3295928": "cucsh:sincronia-legacy:8b3cd0a09bbc44c1ef1a",
        "dialnet:3295943": "cucsh:sincronia-legacy:42f588461e4fdccc802b",
        "dialnet:3296006": "cucsh:sincronia-legacy:28a0dbaf40e37d406a5a",
        "dialnet:3296009": "cucsh:sincronia-legacy:e4386de4eb370de99a23",
        "dialnet:3296015": "cucsh:sincronia-legacy:52e8bd42da04504dc974",
        "dialnet:3296016": "cucsh:sincronia-legacy:c7a8809b261362f79466",
    },
    48: {
        "dialnet:3296306": "cucsh:sincronia-legacy:60b1adbef4601be4c580",
        "dialnet:3296311": "cucsh:sincronia-legacy:7fdfd9409dbe03393c1a",
        "dialnet:3296315": "cucsh:sincronia-legacy:2b07f117b2138a454136",
        "dialnet:3296331": "cucsh:sincronia-legacy:a3e5a0ef6bb0c5c38b36",
        "dialnet:3296340": "cucsh:sincronia-legacy:21e83b4cf2267d92ee5a",
        "dialnet:3296351": "cucsh:sincronia-legacy:f5a82dd5a4d91f5e57a3",
        "dialnet:3296362": "cucsh:sincronia-legacy:0612eae7bddf9a81c927",
    },
}
# Primary-source article titles and attribution checked in the audited issue
# TOCs. These exact expectations make unexpected/rewritten artifacts fail shut.
MISSING_BIBLIOGRAPHY = {
    "dialnet:3296017": (
        "Contrabando de tabaco en la Nueva España",
        ["Alfredo Barragán Cabral"],
    ),
    "dialnet:3296366": (
        "El Clima Organizacional desde los recursos humanos",
        ["Raúl Mercado Pérez", "Demetrio Navarro del Ángel"],
    ),
    "dialnet:3296374": (
        "Servidores públicos, profesionalización y gestión",
        ["Angélica Cazares Alvarado"],
    ),
    "dialnet:3296377": (
        "El personaje histórico en la dramaturgia de Aurelio Luis Gallardo",
        ["María Guadalupe Sánchez Robles"],
    ),
}


def check_source(source, issue):
    sid = source.get("sourceId") or ""
    title = source.get("title")
    authors = source.get("authors")
    if (
        not sid.startswith("dialnet:")
        or not sid.split(":", 1)[1].isdecimal()
        or not isinstance(title, str)
        or len(title) < 8
        or "\ufffd" in title
        or not isinstance(authors, list)
        or not authors
        or any(not isinstance(a, str) or len(a.strip()) < 4 for a in authors)
    ):
        raise ValueError(f"Invalid bibliographic article metadata in issue {issue}")
    expected_url = (
        "https://dialnet.unirioja.es/servlet/articulo?codigo=" +
        sid.split(":", 1)[1]
    )
    if source.get("url") != expected_url:
        raise ValueError(f"Unexpected Dialnet article URL: {sid}")
    return True


def verify_issue(snapshot, evidence, issue):
    expected = EXPECTED[issue]
    local = [
        r for r in snapshot if
        r.get("journal") == "Sincronía" and r.get("issueNumber") == issue
    ]
    if len(local) != expected["local"]:
        raise ValueError(f"Issue {issue} local article count changed")
    if (
        evidence.get("issue") != issue
        # The prior audit records successful retrieval by its status
        # and counts. It does not publish a sourceAvailable field.
        or evidence.get("status") != "needs_review"
        or evidence.get("dialnetCount") != expected["source"]
        or evidence.get("localCount") != expected["local"]
        or evidence.get("issueUrl") != KNOWN_ISSUE_URLS[issue]
        or evidence.get("navigationReview")
    ):
        raise ValueError(f"Issue {issue} TOC evidence missing or inconsistent")
    indexed = {r["id"]: r for r in local}
    if len(indexed) != len(local):
        raise ValueError("Duplicate local record ID")

    # First verify the 11 exact-title matches against the live candidate
    # snapshot, not against stale count-only evidence.
    confirmed = {}
    article_sources = {}
    for verified in evidence["articleMatches"]:
        if verified.get("status") not in {
            "original_title_matched", "title_and_author_identity_confirmed"
        }:
            raise ValueError("Unexpected article identity in source audit")
        rid = verified["localId"]
        row = indexed.get(rid)
        item = verified["source"]
        if (
            not row or row.get("title") != verified.get("localTitle")
            or (row.get("urls") or {}).get("canonical") != verified.get("localUrl")
            or [a.get("name") for a in row.get("authors") or []] !=
               verified.get("localAuthors")
            or normalized_title(row.get("title")) != normalized_title(item.get("title"))
        ):
            raise ValueError("Existing source-verified article changed")
        check_source(item, issue)
        sid = item["sourceId"]
        if sid in article_sources or rid in confirmed:
            raise ValueError("Duplicate title-match identity")
        confirmed[rid] = sid
        article_sources[sid] = item

    # Each of the 13 title-abbreviation / encoding mismatch cases has an
    # explicitly reviewed identity. Title shortening is NOT a missing work.
    unresolved_by_id = {r["localId"]: r for r in evidence["localUnresolved"]}
    mapping = SOURCE_TO_EXISTING[issue]
    if (
        len(unresolved_by_id) != len(evidence["localUnresolved"])
        or set(unresolved_by_id) != set(mapping.values())
    ):
        raise ValueError(f"Issue {issue} unmatched existing article set changed")
    sources_unmatched = {r["sourceId"]: r for r in evidence["sourceUnmatched"]}
    if len(sources_unmatched) != len(evidence["sourceUnmatched"]):
        raise ValueError("Duplicate unmatched bibliographic source")
    for sid, rid in mapping.items():
        row = indexed.get(rid)
        item = sources_unmatched.get(sid)
        historical = unresolved_by_id[rid]
        if (
            not row or not item or rid in confirmed
            or historical.get("status") != "no_unique_source_match"
            or row.get("title") != historical.get("localTitle")
            or (row.get("urls") or {}).get("canonical") != historical.get("localUrl")
            or [a.get("name") for a in row.get("authors") or []] !=
               historical.get("localAuthors")
        ):
            raise ValueError(f"Reviewed abbreviated-title match changed: {sid}")
        check_source(item, issue)
        confirmed[rid] = sid
        article_sources[sid] = item
    if len(confirmed) != expected["local"] or len(set(confirmed.values())) != len(confirmed):
        raise ValueError(f"Issue {issue} existing article identity incomplete")

    missing = set(sources_unmatched) - set(mapping)
    if missing != expected["missing"]:
        raise ValueError(
            f"Issue {issue} candidate source gaps do not match evidence: {missing}"
        )
    for sid in missing:
        item = sources_unmatched[sid]
        check_source(item, issue)
        approved_title, approved_authors = MISSING_BIBLIOGRAPHY[sid]
        if item["title"] != approved_title or item["authors"] != approved_authors:
            raise ValueError(f"Catalogued new article changed: {sid}")
        article_sources[sid] = item
    if len(article_sources) != expected["source"]:
        raise ValueError("Audited TOC is not fully accounted for")
    return [sources_unmatched[sid] for sid in sorted(missing)]


def reconcile(snapshot, report):
    rows = snapshot.get("records")
    if not isinstance(rows, list) or len({r.get("id") for r in rows}) != len(rows):
        raise ValueError("Invalid source snapshot")
    if (
        report.get("issuesRequested") != [46, 47, 48, 50]
        or report.get("issuesRetrieved") != [46, 47, 48, 50]
        or report.get("issuesUnavailable")
    ):
        raise ValueError("Audit did not independently retrieve all four issues")

    by_issue = {r["issue"]: r for r in report["issues"]}
    if len(by_issue) != len(report["issues"]):
        raise ValueError("Duplicate issue evidence")
    expected_missing = set(MISSING_BIBLIOGRAPHY)
    candidates = []
    for issue in EXPECTED:
        candidates.extend((issue, x) for x in verify_issue(rows, by_issue[issue], issue))
    if (
        len(candidates) != 4
        or {x["sourceId"] for _, x in candidates} != expected_missing
    ):
        raise ValueError("Four exact new bibliographic sources not confirmed")

    old_ids = {r["id"] for r in rows}
    old_source_ids = {r.get("sourceId") for r in rows}
    old_titles = {
        (r.get("issueNumber"), normalized_title(r.get("title")))
        for r in rows if r.get("journal") == "Sincronía"
    }
    additions = []
    for issue, item in candidates:
        sid = item["sourceId"]
        code = sid.split(":", 1)[1]
        new_record = build_record({
            "code": code, "url": item["url"],
            "title": item["title"], "authors": item["authors"],
        }, {"year": 2008, "number": issue})
        if (
            new_record["id"] in old_ids
            or sid in old_source_ids
            or (issue, normalized_title(item["title"])) in old_titles
            or new_record["journal"] != "Sincronía"
        ):
            raise ValueError("Refusing to create potentially duplicate article: " + sid)
        new_record["legacyCompletenessEvidence"] = {
            "kind": "original-dialnet-issue-toc-crosscheck",
            "sourceAuditRunId": SOURCE_AUDIT_RUN,
            "sourceIssueUrl": KNOWN_ISSUE_URLS[issue],
            "sourceArticleUrl": item["url"],
            "articleSourceId": sid,
            "issueLocalExistingVerified": EXPECTED[issue]["local"],
            "issueSourceTotal": EXPECTED[issue]["source"],
        }
        additions.append(new_record)
    if len({r["id"] for r in additions}) != 4:
        raise ValueError("Repeated added article ID")
    output = {**snapshot, "records": rows + additions}
    evidence = {
        "sourceAuditRunId": SOURCE_AUDIT_RUN,
        "before": len(rows), "after": len(output["records"]),
        "previousIdentitiesVerified": sum(v["local"] for v in EXPECTED.values()),
        "newArticles": [{
            "id": r["id"], "sourceId": r["sourceId"],
            "issue": r["issueNumber"], "title": r["title"],
            "authors": [a["name"] for a in r["authors"]],
            "url": r["urls"]["canonical"],
        } for r in additions],
        "policy": (
            "Exactly 24 prior issue 47/48 identities checked against source "
            "evidence (including 13 abbreviated/encoding title matches). "
            "Only four independently verified missing Dialnet article IDs "
            "added; no existing records or metadata altered."
        ),
    }
    return output, evidence


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--after", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    snapshot = json.loads(args.before.read_text(encoding="utf-8"))
    report = json.loads(args.audit.read_text(encoding="utf-8"))
    updated, evidence = reconcile(snapshot, report)
    args.after.write_text(serialize_dataset(updated), encoding="utf-8")
    args.report.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_GAP_BACKFILL", json.dumps({
        "before": evidence["before"], "after": evidence["after"],
        "existingVerified": evidence["previousIdentitiesVerified"],
        "additions": len(evidence["newArticles"]),
    }, ensure_ascii=False), flush=True)
    for article in evidence["newArticles"]:
        print("SINCRONIA_GAP_ARTICLE", json.dumps(article, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()

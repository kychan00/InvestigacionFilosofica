#!/usr/bin/env python3
"""Evidence-gated repair of outstanding Sincronía 1–60 metadata.

A single targeted run inspects only original articles with absent author
metadata or U+FFFD-damaged text, plus damaged Dialnet titles by their article
IDs. Network failures are recorded, never treated as evidence. No guessed
authors, no loss of existing metadata, no new articles, no automatic merges.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlparse

from scripts.cucsh.harvest import serialize_dataset
from scripts.cucsh.sincronia_legacy import (
    clean_text, extract_abstract, is_html_url, parse_html, request_legacy_bytes,
)
from scripts.cucsh.sincronia_dialnet import harvest_dialnet_records

TRUSTED_HOSTS = {
    "sincronia.cucsh.udg.mx",
    "fuentes.csh.udg.mx",
    "www.cucsh.udg.mx",
}
AUTHOR_META_KEYS = ("citation_author", "dc.creator", "author")
TITLE_META_KEYS = ("citation_title", "dc.title", "og:title")
BAD_PERSON_TOKENS = (
    "university", "universidad", "université", "facultad",
    "instituto", "department", "departamento", "editorial",
    "revista", "sincronía", "sincronia", "regresar", "return",
    "copyright", "contacto", "home", "http", "www.", "abstract",
    "resumen", "bibliograf", "journal", "previous", "siguiente",
    "número", "numero", "volver", "enlaces", "professor",
)
RUN_ID = int(os.environ.get("GITHUB_RUN_ID", "0"))


def similarity(a, b):
    a = " ".join(str(a or "").casefold().split())
    b = " ".join(str(b or "").casefold().split())
    return SequenceMatcher(None, a, b).ratio()


def human_name(value):
    text = clean_text(value or "")
    if not text or not 5 <= len(text) <= 75:
        return None
    if any(token in text.casefold() for token in BAD_PERSON_TOKENS):
        return None
    if any(char.isdigit() for char in text) or "@" in text or ":" in text:
        return None
    words = text.replace(",", " ").split()
    if not 2 <= len(words) <= 6:
        return None
    if not all(re.fullmatch(r"[\wÀ-ÿ.\-']+", w, flags=re.UNICODE) for w in words):
        return None
    ignore = {"de", "del", "la", "las", "los", "y", "and", "van", "von", "da", "do"}
    capitals = [
        w for w in words
        if w.casefold() not in ignore and w[0].isupper()
    ]
    if len(capitals) < 2:
        return None
    return text


def trustworthy_title_candidates(parser):
    output = []
    for key in TITLE_META_KEYS:
        if parser.meta.get(key):
            output.append((key, parser.meta[key]))
    for heading in parser.headings[:8]:
        output.append(("heading", heading))
    if parser.title:
        output.append(("html-title", parser.title))
    return [
        (kind, text) for kind, text in output
        if text and "\ufffd" not in text and 12 <= len(text) <= 220
    ]


def derive_proposals(row, data, used_wayback=False):
    parser = parse_html(data)
    old_title = row.get("title") or ""
    titles = trustworthy_title_candidates(parser)
    matches = sorted(
        ((similarity(old_title, value), kind, value) for kind, value in titles),
        reverse=True,
    )
    best_score, best_kind, best_title = matches[0] if matches else (0, None, None)
    # A high-fidelity article-title match guards against Wayback error pages
    # and author/profile HTML accidentally linked as an article.
    identity = best_score >= 0.89
    result = {
        "id": row.get("id"),
        "issue": row.get("issueNumber"),
        "title": old_title,
        "url": (row.get("urls") or {}).get("canonical"),
        "source": "original-html",
        "retrievedViaWayback": bool(used_wayback),
        "identityScore": round(best_score, 4),
        "identityMethod": best_kind,
        "status": "no_high_confidence_evidence",
        "corrections": {},
        "review": {},
    }
    if not identity:
        result["review"]["reason"] = "source_title_mismatch_or_missing"
        return result

    if "\ufffd" in old_title and best_title != old_title:
        if best_score >= 0.90:
            result["corrections"]["title"] = {
                "previous": old_title, "value": best_title,
                "evidence": "original-article-title",
                "score": round(best_score, 4),
            }
        else:
            result["review"]["title"] = best_title

    old_abstract = row.get("abstract") or ""
    if "\ufffd" in old_abstract:
        abstract = extract_abstract(parser)
        if (
            abstract and "\ufffd" not in abstract
            and len(abstract) >= 40
            and similarity(old_abstract, abstract) >= 0.92
        ):
            result["corrections"]["abstract"] = {
                "previous": old_abstract, "value": abstract,
                "evidence": "original-article-abstract",
                "score": round(similarity(old_abstract, abstract), 4),
            }

    if not row.get("authors"):
        explicit = [
            (field, human_name(parser.meta.get(field)))
            for field in AUTHOR_META_KEYS if parser.meta.get(field)
        ]
        explicit = [(field, value) for field, value in explicit if value]
        unique = {name for _, name in explicit}
        if len(unique) == 1:
            name = next(iter(unique))
            result["corrections"]["author"] = {
                "value": name, "evidence": "original-article-author-meta",
                "field": explicit[0][0],
            }
        elif not explicit:
            # Visual bylines are accepted only directly beneath the exact
            # full article heading and with an affiliation/abstract cue.
            target_title = (
                result["corrections"].get("title", {}).get("value")
                or old_title
            )
            for i, line in enumerate(parser.lines[:90]):
                if (
                    len(line) < 12
                    or similarity(line, target_title) < 0.96
                    or i + 2 >= len(parser.lines)
                ):
                    continue
                name = human_name(parser.lines[i + 1])
                context = (parser.lines[i + 2] or "").casefold()
                cue = (
                    any(word in context for word in (
                        "universidad", "university", "université",
                        "facultad", "instituto", "department",
                        "departamento", "resumen", "abstract", "@",
                    ))
                )
                if name and cue:
                    result["corrections"]["author"] = {
                        "value": name,
                        "evidence": "original-article-adjacent-byline",
                        "context": parser.lines[i + 2][:100],
                    }
                break
            if "author" not in result["corrections"]:
                result["review"]["heuristicCandidates"] = [
                    value for value in (
                        human_name(parser.lines[i])
                        for i in range(min(12, len(parser.lines)))
                    ) if value
                ][:4]

    if result["corrections"]:
        result["status"] = "verified_corrections"
    return result


def eligible_original_records(rows):
    result = []
    for row in rows:
        if (
            row.get("journal") != "Sincronía"
            or not row.get("legacyOriginal")
            or not isinstance(row.get("issueNumber"), int)
            or not 1 <= row["issueNumber"] <= 60
        ):
            continue
        url = (row.get("urls") or {}).get("canonical") or ""
        parsed = urlparse(url)
        if (
            parsed.hostname in TRUSTED_HOSTS
            and is_html_url(url)
            and (not row.get("authors") or any(
                "\ufffd" in str(row.get(key) or "")
                for key in ("title", "abstract")
            ))
        ):
            result.append(row)
    return sorted(result, key=lambda r: (r["issueNumber"], r["id"]))


def inspect_remote(row):
    url = row["urls"]["canonical"]
    try:
        page, archived = request_legacy_bytes(
            url, prefer_wayback=False, allow_live_fallback=True,
        )
        return derive_proposals(row, page, archived)
    except Exception as exc:
        return {
            "id": row["id"], "issue": row["issueNumber"],
            "url": url, "status": "source_unavailable",
            "corrections": {}, "error": repr(exc)[:500],
        }


def dialnet_title_proposals(rows):
    damaged = [
        r for r in rows if r.get("journal") == "Sincronía"
        and (r.get("legacyMetadataSource") or "") == "Dialnet"
        and "\ufffd" in str(r.get("title") or "")
        and isinstance(r.get("issueNumber"), int)
        and 1 <= r["issueNumber"] <= 60
    ]
    findings = []
    for issue in sorted({row["issueNumber"] for row in damaged}):
        try:
            external, covered = harvest_dialnet_records(
                max_issue=60, target_issues={issue},
            )
            by_source = {r.get("sourceId"): r for r in external}
            for row in [r for r in damaged if r["issueNumber"] == issue]:
                reference = by_source.get(row.get("sourceId"))
                good = reference.get("title") if reference else None
                score = similarity(row.get("title"), good)
                finding = {
                    "id": row["id"], "issue": issue,
                    "url": row["urls"]["canonical"],
                    "source": "dialnet-issue-catalogue",
                    "status": "no_high_confidence_evidence",
                    "corrections": {},
                    "identityScore": round(score, 4),
                }
                if good and "\ufffd" not in good and score >= 0.90:
                    finding["status"] = "verified_corrections"
                    finding["corrections"]["title"] = {
                        "previous": row["title"], "value": good,
                        "evidence": "dialnet-exact-article-id",
                        "score": round(score, 4),
                    }
                findings.append(finding)
        except Exception as exc:
            findings.extend({
                "id": row["id"], "issue": issue,
                "url": row["urls"]["canonical"],
                "source": "dialnet-issue-catalogue",
                "status": "source_unavailable", "corrections": {},
                "error": repr(exc)[:500],
            } for row in damaged if row["issueNumber"] == issue)
    return findings


def apply_evidence(snapshot, findings):
    updates = {}
    for finding in findings:
        changes = finding.get("corrections") or {}
        if finding.get("status") != "verified_corrections" or not changes:
            continue
        if finding["id"] in updates:
            raise ValueError("Conflicting evidence for " + finding["id"])
        updates[finding["id"]] = finding

    rows = snapshot["records"]
    original_ids = [r.get("id") for r in rows]
    if len(set(original_ids)) != len(original_ids):
        raise ValueError("Duplicate existing record identifiers")

    updated_rows = []
    changed = []
    for row in rows:
        evidence = updates.get(row.get("id"))
        if not evidence:
            updated_rows.append(row)
            continue
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != evidence.get("issue")
            or (row.get("urls") or {}).get("canonical") != evidence.get("url")
        ):
            raise ValueError("Evidence conflicts with original source record")

        item = copy.deepcopy(row)
        changes = evidence["corrections"]
        source = evidence["url"]
        for field in ("title", "abstract"):
            if field not in changes:
                continue
            change = changes[field]
            if (
                item.get(field) != change["previous"]
                or "\ufffd" not in (item.get(field) or "")
                or "\ufffd" in change["value"]
            ):
                raise ValueError("Unverified replacement: " + str(item.get("id")))
            item[field] = change["value"]
            variants = field + "Variants"
            item[variants] = [
                change["value"] if text == change["previous"] else text
                for text in (item.get(variants) or [])
            ]
            item["legacy" + field.capitalize() + "EncodingEvidence"] = {
                "kind": change["evidence"],
                "sourceUrl": source,
                "auditRunId": RUN_ID,
                "previous" + field.capitalize(): change["previous"],
                "score": change["score"],
            }
        if "author" in changes:
            if item.get("authors"):
                raise ValueError("Author overwrite forbidden: " + item["id"])
            author = changes["author"]
            item["authors"] = [{
                "name": author["value"], "sourceName": author["value"],
            }]
            item["legacyAuthorEvidence"] = {
                "kind": author["evidence"], "sourceUrl": source,
                "auditRunId": RUN_ID,
                "verifiedAuthor": author["value"],
                "fieldOrContext": author.get("field") or author.get("context"),
            }
        updated_rows.append(item)
        changed.append({
            "id": item["id"], "issue": item["issueNumber"],
            "fields": sorted(changes),
            "title": item.get("title"), "sourceUrl": source,
        })
    if len(updated_rows) != len(rows):
        raise ValueError("Record count changed")
    return {**snapshot, "records": updated_rows}, changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", type=Path, required=True)
    ap.add_argument("--after", type=Path, required=True)
    ap.add_argument("--report", type=Path, required=True)
    args = ap.parse_args()
    original = json.loads(args.before.read_text(encoding="utf-8"))
    rows = original["records"]
    targets = eligible_original_records(rows)
    findings = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(inspect_remote, row): row for row in targets}
        for index, future in enumerate(as_completed(futures), start=1):
            result = future.result()
            findings.append(result)
            if index % 15 == 0 or index == len(targets):
                print(
                    "SINCRONIA_SOURCE_PROGRESS",
                    f"inspected={index}/{len(targets)}",
                    flush=True,
                )

    findings.extend(dialnet_title_proposals(rows))
    findings.sort(key=lambda f: (f.get("issue") or 0, f.get("id") or ""))
    after, changed = apply_evidence(original, findings)
    counters = Counter(f.get("status") for f in findings)
    fields = Counter(field for c in changed for field in c["fields"])
    unresolved_authors = sum(
        r.get("journal") == "Sincronía" and
        isinstance(r.get("issueNumber"), int) and
        1 <= r["issueNumber"] <= 60 and not r.get("authors")
        for r in after["records"]
    )
    unresolved_damaged = sum(
        r.get("journal") == "Sincronía" and
        isinstance(r.get("issueNumber"), int) and
        1 <= r["issueNumber"] <= 60 and any(
            "\ufffd" in str(r.get(field) or "") for field in ("title", "abstract")
        )
        for r in after["records"]
    )
    report = {
        "runId": RUN_ID,
        "status": "review_needed" if unresolved_damaged or unresolved_authors else "complete",
        "beforeRecords": len(rows),
        "afterRecords": len(after["records"]),
        "originalPagesAttempted": len(targets),
        "sourceStatuses": dict(sorted(counters.items())),
        "changedRecords": len(changed),
        "changedFields": dict(sorted(fields.items())),
        "stillWithoutAuthors": unresolved_authors,
        "stillWithDamagedText": unresolved_damaged,
        "changes": changed,
        "sourceFindings": findings,
        "policy": (
            "Only explicit bylines or uniquely title-adjacent source bylines, "
            "verified title headings, source abstracts, or exact Dialnet "
            "article identifiers may change the dataset. All uncertain "
            "candidates remain in sourceFindings for review. No invented data."
        ),
    }
    args.after.write_text(serialize_dataset(after), encoding="utf-8")
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_TARGETED_ENRICHMENT", json.dumps({
        key: report[key] for key in (
            "beforeRecords", "afterRecords", "originalPagesAttempted",
            "sourceStatuses", "changedRecords", "changedFields",
            "stillWithoutAuthors", "stillWithDamagedText",
        )
    }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()

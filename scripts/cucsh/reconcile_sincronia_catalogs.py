#!/usr/bin/env python3
"""Reconcile historical Sincronía articles with ISSN-filtered external catalogues.

Sources: Dialnet's mapped original issues, Crossref, and OpenAlex.
Only unique, strong title matches within the correct issue or journal/year
may enrich records. Missing or unavailable catalogue metadata is not guessed.
No additions, destructive changes, PRs, or main-branch updates.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import re
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

from scripts.cucsh.harvest import serialize_dataset
from scripts.cucsh.sincronia_dialnet import KNOWN_ISSUE_URLS, harvest_dialnet_records
from scripts.cucsh.enrich_sincronia_remaining import human_name

ISSN = "1562-384X"
RUN_ID = int(os.environ.get("GITHUB_RUN_ID", "0"))


def normalized(value):
    result = unicodedata.normalize("NFKD", str(value or "").casefold())
    result = "".join(ch for ch in result if not unicodedata.combining(ch))
    return " ".join(re.findall(r"[\w\ufffd]+", result, flags=re.UNICODE))


def match_strength(old, new, source):
    left, right = normalized(old), normalized(new)
    if not left or not right or "\ufffd" in right:
        return 0
    if "\ufffd" not in left:
        return 1.0 if left == right and len(left) >= 14 else 0
    if len(left) < 27 or left.count("\ufffd") > 7:
        return 0
    score = SequenceMatcher(None, left, right).ratio()
    return score if score >= 0.94 else 0


def normalize_authors(values):
    if not isinstance(values, list) or not values or len(values) > 12:
        return []
    names = []
    for value in values:
        name = human_name(str(value or "").strip())
        if not name:
            return []
        if normalized(name) not in {normalized(x) for x in names}:
            names.append(name)
    return names


def year_from_crossref(row):
    for key in ("published", "issued", "published-print", "published-online"):
        parts = (row.get(key) or {}).get("date-parts") or []
        if parts and parts[0] and isinstance(parts[0][0], int):
            return parts[0][0]
    return None


def crossref_records(items):
    records = []
    for item in items:
        issns = [str(i).upper() for i in (item.get("ISSN") or [])]
        if ISSN not in issns:
            continue
        title = next(iter(item.get("title") or []), None)
        if not title:
            continue
        authors = [
            " ".join(p for p in (author.get("given"), author.get("family")) if p)
            for author in (item.get("author") or [])
        ]
        records.append({
            "source": "Crossref", "sourceId": item.get("DOI"),
            "sourceUrl": item.get("URL") or "https://api.crossref.org/journals/" + ISSN,
            "title": title, "authors": normalize_authors(authors),
            "issue": None, "year": year_from_crossref(item),
        })
    return records


def openalex_records(items):
    records = []
    for item in items:
        source = ((item.get("primary_location") or {}).get("source") or {})
        issns = [str(i).upper() for i in (source.get("issn") or [])]
        issn_l = str(source.get("issn_l") or "").upper()
        if ISSN not in issns and issn_l != ISSN:
            continue
        title = item.get("title")
        if not title:
            continue
        authors = [
            ((entry.get("author") or {}).get("display_name") or "")
            for entry in (item.get("authorships") or [])
        ]
        records.append({
            "source": "OpenAlex", "sourceId": item.get("id"),
            "sourceUrl": item.get("id"), "title": title,
            "authors": normalize_authors(authors),
            "issue": None, "year": item.get("publication_year"),
        })
    return records


def dialnet_records(rows):
    return [{
        "source": "Dialnet", "sourceId": row.get("sourceId"),
        "sourceUrl": (row.get("urls") or {}).get("canonical"),
        "title": row.get("title"),
        "authors": normalize_authors([
            x.get("name") if isinstance(x, dict) else x
            for x in (row.get("authors") or [])
        ]),
        "issue": row.get("issueNumber"), "year": row.get("year"),
    } for row in rows]


def parse_eligible_records(rows):
    return [row for row in rows if (
        row.get("journal") == "Sincronía"
        and isinstance(row.get("issueNumber"), int)
        and 1 <= row["issueNumber"] <= 60
        and (not row.get("authors") or any(
            "\ufffd" in str(row.get(k) or "") for k in ("title", "abstract")
        ))
    )]


def relevant_candidate(row, candidate):
    if candidate.get("source") == "Dialnet":
        if candidate.get("issue") != row.get("issueNumber"):
            return 0
    else:
        if candidate.get("year") != row.get("year"):
            return 0
    score = match_strength(row.get("title"), candidate.get("title"), candidate.get("source"))
    if candidate.get("source") != "Dialnet" and len(normalized(row.get("title"))) < 26:
        return 0
    return score


def choose_candidate(row, catalogue):
    matches = []
    for candidate in catalogue:
        score = relevant_candidate(row, candidate)
        if score:
            matches.append((score, candidate))
    if not matches:
        return None, "no_verified_catalog_match", []
    identities = {
        (c["source"], str(c.get("sourceId") or c.get("sourceUrl")))
        for _, c in matches
    }
    if len(identities) != len(matches):
        return None, "duplicate_catalogue_identity", matches
    signatures = {
        tuple(normalized(name) for name in c["authors"])
        for _, c in matches if c.get("authors")
    }
    if len(signatures) > 1:
        return None, "conflicting_catalogue_authors", matches
    if sum(c["source"] == "Dialnet" for _, c in matches) > 1:
        return None, "ambiguous_dialnet_article", matches
    matches.sort(key=lambda pair: (
        pair[1]["source"] == "Dialnet", pair[0],
        bool(pair[1].get("authors")),
    ), reverse=True)
    winner = matches[0][1]
    if not winner.get("authors"):
        with_authors = [c for _, c in matches if c.get("authors")]
        if with_authors:
            winner = with_authors[0]
    return winner, "verified", matches


def reconcile_snapshot(snapshot, catalogue, run_id=RUN_ID):
    rows = snapshot.get("records")
    if not isinstance(rows, list):
        raise ValueError("Invalid snapshot: records missing")
    if len({x.get("id") for x in rows}) != len(rows):
        raise ValueError("Duplicate record IDs in source snapshot")
    targets = {r["id"] for r in parse_eligible_records(rows)}
    indexed = defaultdict(list)
    for item in catalogue:
        if item.get("issue") is not None:
            indexed[("issue", item["issue"])].append(item)
        elif item.get("year") is not None:
            indexed[("year", item["year"])].append(item)
    output, findings, changes = [], [], []
    for record in rows:
        if record.get("id") not in targets:
            output.append(record)
            continue
        candidates = (
            indexed[("issue", record.get("issueNumber"))]
            + indexed[("year", record.get("year"))]
        )
        best, status, matches = choose_candidate(record, candidates)
        review = {
            "id": record.get("id"), "issue": record.get("issueNumber"),
            "title": record.get("title"), "status": status,
            "matches": [{
                "source": m["source"], "title": m["title"],
                "sourceUrl": m.get("sourceUrl"), "score": round(score, 4),
                "authors": m.get("authors"),
            } for score, m in matches[:5]],
        }
        if not best:
            findings.append(review)
            output.append(record)
            continue
        updated = copy.deepcopy(record)
        fields = []
        provenance = {
            "kind": "matching-issn-or-issue-title",
            "source": best["source"], "sourceId": best.get("sourceId"),
            "sourceUrl": best.get("sourceUrl"), "auditRunId": run_id,
        }
        if not updated.get("authors") and best.get("authors"):
            updated["authors"] = [
                {"name": name, "sourceName": name}
                for name in best["authors"]
            ]
            updated["legacyAuthorEvidence"] = {
                **provenance, "verifiedAuthors": best["authors"],
            }
            fields.append("authors")
        if "\ufffd" in str(updated.get("title") or "") and "\ufffd" not in best["title"]:
            old = updated["title"]
            updated["title"] = best["title"]
            updated["titleVariants"] = [
                best["title"] if t == old else t
                for t in (record.get("titleVariants") or [old])
            ]
            updated["legacyTitleEncodingEvidence"] = {
                **provenance, "previousTitle": old,
            }
            fields.append("title")
        # Indexed catalogue abstracts are not substituted for source abstracts.
        review["status"] = "changed" if fields else "verified_but_no_safe_change"
        review["changedFields"] = fields
        review["selectedSource"] = best.get("source")
        if fields:
            changes.append({
                "id": updated["id"], "issue": updated["issueNumber"],
                "fields": fields, "source": best["source"],
                "sourceUrl": best.get("sourceUrl"),
            })
        findings.append(review)
        output.append(updated)
    if len(output) != len(rows):
        raise ValueError("Source record count was altered")
    return {**snapshot, "records": output}, findings, changes


def fetch_json(url, timeout=14):
    request = urllib.request.Request(url, headers={
        "User-Agent": "InvestigacionFilosofica-SincroniaBibliographicAudit/1.0",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_crossref():
    params = urllib.parse.urlencode({
        "filter": "from-pub-date:1996-01-01,until-pub-date:2013-12-31",
        "rows": "1000",
        "select": "DOI,title,author,ISSN,issued,published,URL,issue,container-title",
    })
    url = f"https://api.crossref.org/journals/{ISSN}/works?{params}"
    response = fetch_json(url, timeout=18)
    message = response.get("message") or {}
    total = message.get("total-results") or 0
    if total > 1000:
        raise RuntimeError(f"Crossref journal results exceed safe cap: {total}")
    return crossref_records(message.get("items") or [])


def fetch_openalex():
    results = []
    for page in range(1, 6):
        params = urllib.parse.urlencode({
            "filter": (
                f"primary_location.source.issn:{ISSN},"
                "from_publication_date:1996-01-01,"
                "to_publication_date:2013-12-31"
            ),
            "select": "id,title,publication_year,authorships,primary_location",
            "per_page": 200, "page": page,
        })
        response = fetch_json("https://api.openalex.org/works?" + params, timeout=18)
        meta = response.get("meta") or {}
        if (meta.get("count") or 0) > 1000:
            raise RuntimeError("OpenAlex journal results exceed safe cap")
        batch = response.get("results") or []
        results.extend(openalex_records(batch))
        if len(batch) < 200:
            break
    return results


def fetch_dialnet(rows):
    targets = {
        row["issueNumber"] for row in parse_eligible_records(rows)
        if row["issueNumber"] in KNOWN_ISSUE_URLS
    }
    if not targets:
        return [], []
    result, covered = harvest_dialnet_records(
        max_issue=60, target_issues=targets
    )
    return dialnet_records(result), covered


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--after", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    before = json.loads(args.before.read_text(encoding="utf-8"))
    rows = before["records"]
    eligible = parse_eligible_records(rows)
    print("SINCRONIA_CATALOG_AUDIT_TARGETS", len(eligible), flush=True)
    collected, status = [], {}
    for name, load in (
        ("Dialnet", lambda: fetch_dialnet(rows)),
        ("Crossref", fetch_crossref),
        ("OpenAlex", fetch_openalex),
    ):
        try:
            if name == "Dialnet":
                items, covered = load()
                status[name] = {"records": len(items), "coveredIssues": covered}
            else:
                items = load()
                status[name] = {"records": len(items)}
            collected.extend(items)
            print("CATALOG_SOURCE", name, status[name], flush=True)
        except Exception as exc:
            status[name] = {"error": repr(exc)[:500], "records": 0}
            print("CATALOG_SOURCE_UNAVAILABLE", name, repr(exc)[:300], flush=True)

    after, findings, changes = reconcile_snapshot(before, collected)
    remaining = parse_eligible_records(after["records"])
    result = {
        "status": "review_pending" if remaining else "complete",
        "runId": RUN_ID, "issn": ISSN,
        "beforeRecords": len(rows), "afterRecords": len(after["records"]),
        "targets": len(eligible), "sourceStatus": status,
        "catalogueCandidates": len(collected),
        "changes": changes, "changedRecords": len(changes),
        "matched": dict(Counter(x["status"] for x in findings)),
        "stillWithoutAuthors": sum(not r.get("authors") for r in remaining),
        "stillWithDamagedText": sum(any(
            "\ufffd" in str(r.get(k) or "") for k in ("title", "abstract")
        ) for r in remaining),
        "reviewQueue": findings,
        "policy": (
            "ISSN 1562-384X; exact source issue or journal/year plus "
            "unambiguous title identity. No guessed names or article "
            "additions. Existing metadata and provenance remain protected."
        ),
    }
    args.after.write_text(serialize_dataset(after), encoding="utf-8")
    args.report.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_CATALOG_RECONCILIATION", json.dumps({
        k: result[k] for k in (
            "beforeRecords", "afterRecords", "targets", "catalogueCandidates",
            "changedRecords", "matched", "stillWithoutAuthors",
            "stillWithDamagedText",
        )
    }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()

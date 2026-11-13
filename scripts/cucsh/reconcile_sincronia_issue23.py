#!/usr/bin/env python3
"""Complete two unmatched Sincronía issue-23 records using a verified TOC.

Issue 23 has nine articles both locally and at Dialnet. Seven other entries
already have catalog-verified authors. These two are the remaining incomplete
entries. The full original title is retained for 'Risa, burla y escarnio';
the other title is repaired only after exact same-issue article-ID evidence.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
from difflib import SequenceMatcher
from pathlib import Path

from scripts.cucsh.audit_sincronia_historical import normalized_title
from scripts.cucsh.harvest import serialize_dataset
from scripts.cucsh.sincronia_dialnet import KNOWN_ISSUE_URLS, harvest_dialnet_records

ISSUE = 23
ISSUE_URL = "https://dialnet.unirioja.es/ejemplar/253500"
EXPECTED_COUNT = 9
RUN_ID = int(os.environ.get("GITHUB_RUN_ID", "0"))

APPROVED = {
    "cucsh:sincronia-legacy:6d373859a21cdc921a08": {
        "sourceId": "dialnet:3325204",
        "localUrl": "http://sincronia.cucsh.udg.mx/quint02.htm",
        "title": "Risa, burla y escarnio: el apodo una herramienta para desenmascarar",
        "authors": ["Harriet Kristl Quint Berdac de Comparán"],
        "repairTitle": False,
    },
    "cucsh:sincronia-legacy:bd2ae7d1640a301cd2ce": {
        "sourceId": "dialnet:3325211",
        "localUrl": "http://sincronia.cucsh.udg.mx/gonzalezserna.htm",
        "title": "Una lectura mágica de Los ríos profundos, de José Mª Arguedas",
        "authors": ["José María González-Serna Sánchez"],
        "repairTitle": True,
    },
}


def compare_text(a, b):
    return SequenceMatcher(None, normalized_title(a), normalized_title(b)).ratio()


def verify_source(entry, external):
    if (
        external.get("sourceId") != entry["sourceId"]
        or external.get("journal") != "Sincronía"
        or external.get("issueNumber") != ISSUE
        or external.get("year") != 2002
        or (external.get("urls") or {}).get("canonical") !=
           "https://dialnet.unirioja.es/servlet/articulo?codigo=" +
           entry["sourceId"].split(":")[1]
    ):
        raise ValueError("Dialnet source identity mismatch")

    actual_authors = [author.get("name") for author in external.get("authors") or []]
    if [
        normalized_title(name) for name in actual_authors
    ] != [normalized_title(name) for name in entry["authors"]]:
        raise ValueError("Issue 23 source authors differ from verified TOC")

    source_title = external.get("title") or ""
    clean_source, expected = normalized_title(source_title), normalized_title(entry["title"])
    if "\ufffd" in source_title or len(clean_source) < 18:
        raise ValueError("Dialnet returned a damaged or generic article title")

    if entry["repairTitle"]:
        if compare_text(source_title, entry["title"]) < 0.95:
            raise ValueError("Source title not confirmed for encoding repair")
    else:
        # Dialnet's HTML parser may return only the first inline fragment
        # 'Risa, burla y escarnio', while the original TOC displays the full
        # author-proven article title. Never truncate the fuller local title.
        if not expected.startswith(clean_source):
            raise ValueError("Source title is not an anchored prefix")
    return source_title


def stage_issue23(snapshot, catalogue, run_id=RUN_ID):
    rows = snapshot.get("records")
    if not isinstance(rows, list) or len(set(r.get("id") for r in rows)) != len(rows):
        raise ValueError("Invalid snapshot or duplicate IDs")
    local = [row for row in rows if row.get("journal") == "Sincronía" and row.get("issueNumber") == ISSUE]
    external = [row for row in catalogue if row.get("journal") == "Sincronía" and row.get("issueNumber") == ISSUE]
    if len(local) != EXPECTED_COUNT or len(external) != EXPECTED_COUNT:
        raise ValueError(f"Coverage differs from verified nine records: {len(local)}, {len(external)}")
    if {r["id"] for r in local} & set(APPROVED) != set(APPROVED):
        raise ValueError("Approved historical issue-23 record is absent")
    by_code = {r.get("sourceId"): r for r in external}
    if len(by_code) != EXPECTED_COUNT:
        raise ValueError("Duplicated source article code")
    if not {entry["sourceId"] for entry in APPROVED.values()} <= set(by_code):
        raise ValueError("Missing one of the exact two catalog article IDs")

    updated_rows, changed = [], []
    for original in rows:
        entry = APPROVED.get(original.get("id"))
        if entry is None:
            updated_rows.append(original)
            continue
        if (
            original.get("journal") != "Sincronía"
            or original.get("issueNumber") != ISSUE
            or original.get("year") != 2002
            or not original.get("legacyOriginal")
            or (original.get("urls") or {}).get("canonical") != entry["localUrl"]
            or original.get("authors")
            or original.get("legacyTitleEncodingEvidence")
            or original.get("legacyAuthorEvidence")
        ):
            raise ValueError("Record altered since source audit, refusing change")

        source = by_code[entry["sourceId"]]
        source_title = verify_source(entry, source)
        next_row = copy.deepcopy(original)
        before_title = original.get("title") or ""
        if entry["repairTitle"]:
            if "\ufffd" not in before_title or compare_text(before_title, entry["title"]) < 0.90:
                raise ValueError("Unexpected damaged-title identity")
            next_row["title"] = entry["title"]
            next_row["titleVariants"] = [
                entry["title"] if text == before_title else text
                for text in (original.get("titleVariants") or [before_title])
            ]
            next_row["legacyTitleEncodingEvidence"] = {
                "kind": "dialnet-issue23-exact-article-title",
                "auditRunId": run_id,
                "sourceIssueUrl": ISSUE_URL,
                "sourceArticleUrl": (source.get("urls") or {}).get("canonical"),
                "sourceArticleId": entry["sourceId"],
                "previousTitle": before_title,
                "originalTitleSimilarity": round(compare_text(before_title, entry["title"]), 4),
            }
        else:
            if before_title != entry["title"]:
                raise ValueError("Refusing to change the fuller original title")
        next_row["authors"] = [
            {"name": author, "sourceName": author} for author in entry["authors"]
        ]
        next_row["legacyAuthorEvidence"] = {
            "kind": "dialnet-issue23-exact-article-id",
            "auditRunId": run_id,
            "sourceIssueUrl": ISSUE_URL,
            "sourceArticleUrl": (source.get("urls") or {}).get("canonical"),
            "sourceArticleId": entry["sourceId"],
            "verifiedAuthors": entry["authors"],
        }
        updated_rows.append(next_row)
        changed.append({
            "id": original["id"], "titleBefore": before_title,
            "titleAfter": next_row["title"],
            "authors": entry["authors"],
            "sourceArticleId": entry["sourceId"],
            "sourceArticleTitle": source_title,
        })
    if len(changed) != 2 or len(updated_rows) != len(rows):
        raise ValueError("Issue 23 staged changes were incomplete")

    report = {
        "issue": ISSUE, "sourceIssueUrl": ISSUE_URL,
        "auditRunId": run_id, "sourceArticleCount": len(external),
        "localArticleCount": len(local),
        "updatedRecords": len(changed),
        "beforeCount": len(rows), "afterCount": len(updated_rows),
        "changes": changed,
        "policy": (
            "Exactly two predetermined source-linked records may change. "
            "One source-confirmed encoding repair plus two author restorations. "
            "Preserve all other titles, records, IDs and original source URLs."
        )
    }
    return {**snapshot, "records": updated_rows}, report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--after", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    if KNOWN_ISSUE_URLS.get(ISSUE) != ISSUE_URL:
        raise ValueError("Issue source index changed")
    snapshot = json.loads(args.before.read_text(encoding="utf-8"))
    evidence, covered = harvest_dialnet_records(max_issue=60, target_issues={ISSUE})
    if covered != [ISSUE]:
        raise ValueError("Dialnet did not return verified issue 23")
    staged, report = stage_issue23(snapshot, evidence)
    args.after.write_text(serialize_dataset(staged), encoding="utf-8")
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("SINCRONIA_ISSUE23_RECONCILED", json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()

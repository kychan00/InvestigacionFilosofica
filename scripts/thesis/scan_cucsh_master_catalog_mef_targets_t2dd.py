#!/usr/bin/env python3
"""T2DD: exhaustive CUCSH master's-catalog scan for Mario/Adriel.

Reuses the T2CV unfiltered master's catalogue crawler, but intentionally ignores
the programme column when discovering the two priority works. This catches
mislabelled programme rows without fuzzy matching. A CUCSH catalogue row may
confirm a library bibliographic reference, but never a physical holding by
itself.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[2]
THESIS_DIR = ROOT / "scripts/thesis"
if str(THESIS_DIR) not in sys.path:
    sys.path.insert(0, str(THESIS_DIR))

T2CV_PATH = THESIS_DIR / "recover_cucsh_philosophy_masters_t2cv.py"
spec = importlib.util.spec_from_file_location("t2dd_t2cv", T2CV_PATH)
t2cv = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(t2cv)

SCHEMA = "thesis-mef-cucsh-master-catalog-resolution-t2dd-v1"
REVISION = "2026-11-05.t2dd-v1"


def norm(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text.casefold())
    return " ".join(text.split())


def author_tokens(value: Any) -> tuple[str, ...]:
    return tuple(sorted(norm(value).split()))


def targets_from_t2db(t2db: dict[str, Any]) -> list[dict[str, Any]]:
    if t2db.get("schemaVersion") != "thesis-mef-program-resolution-t2db-v1":
        raise ValueError("Unsupported T2DB input")

    output = []
    for row in t2db.get("priorityCases") or []:
        author = str(row.get("author") or "")
        if author not in {
            "Mario Damián Del Muro Silva",
            "Adriel Manuel Hernández Guzmán",
        }:
            continue
        titles = [str(row.get("title") or "").strip()]
        variant = str(row.get("titleVariant") or "").strip()
        if variant:
            titles.append(variant)
        output.append({
            "author": author,
            "authorTokens": author_tokens(author),
            "titles": [x for x in titles if x],
            "titleNorms": [norm(x) for x in titles if x],
            "year": row.get("year"),
            "program": "Maestría en Estudios Filosóficos",
            "programInstitutionallyConfirmed": row.get("mefProgramInstitutionallyConfirmed") is True,
        })

    output.sort(key=lambda row: row["author"])
    if [x["author"] for x in output] != [
        "Adriel Manuel Hernández Guzmán",
        "Mario Damián Del Muro Silva",
    ]:
        raise ValueError("T2DD expects exactly Mario and Adriel from T2DB")
    if not all(x["programInstitutionallyConfirmed"] for x in output):
        raise ValueError("T2DD targets require institutional MEF programme confirmation")
    return output


def classify(row: dict[str, Any], target: dict[str, Any]) -> str | None:
    title_match = norm(row.get("title")) in set(target["titleNorms"])
    author_match = author_tokens(row.get("author")) == target["authorTokens"]
    if title_match and author_match:
        return "exact-title-author"
    if title_match:
        return "title-only"
    if author_match:
        return "author-only"
    return None


def safe_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": row.get("title"),
        "author": row.get("author"),
        "coauthor": row.get("coauthor"),
        "director": row.get("director"),
        "yearRaw": row.get("yearRaw"),
        "year": row.get("year"),
        "programRaw": row.get("programRaw"),
        "recordUrl": row.get("recordUrl"),
        "catalogPageUrl": row.get("catalogPageUrl"),
    }


def scan(
    t2db: dict[str, Any],
    *,
    crawler: Callable[..., dict[str, Any]] = t2cv.crawl_unfiltered,
    delay: float = 0.03,
    max_pages: int = 320,
) -> dict[str, Any]:
    targets = targets_from_t2db(t2db)
    crawl = crawler(delay=delay, max_pages=max_pages)

    rows = list(crawl.get("rows") or [])
    pages = list(crawl.get("pageEvidence") or [])
    pages_fetched = int(crawl.get("pagesFetched") or 0)
    last_page = int(crawl.get("lastPageIndex") or 0)
    completed = pages_fetched == last_page + 1

    if not completed:
        raise ValueError("CUCSH master catalogue crawl did not complete pagination")

    buckets: dict[str, dict[str, list[dict[str, Any]]]] = {
        target["author"]: {
            "exactTitleAuthor": [],
            "titleOnly": [],
            "authorOnly": [],
        }
        for target in targets
    }

    for row in rows:
        for target in targets:
            kind = classify(row, target)
            if not kind:
                continue
            key = {
                "exact-title-author": "exactTitleAuthor",
                "title-only": "titleOnly",
                "author-only": "authorOnly",
            }[kind]
            item = safe_row(row)
            if item not in buckets[target["author"]][key]:
                buckets[target["author"]][key].append(item)

    results = []
    exact_total = 0
    institutional_refs = 0

    for target in targets:
        found = buckets[target["author"]]
        exact = found["exactTitleAuthor"]
        exact_total += len(exact)

        if len(exact) == 1:
            selected = exact[0]
            observed_program = norm(selected.get("programRaw"))
            expected_program = norm(target["program"])
            if observed_program == expected_program:
                status = "cucsh-library-catalog-reference-confirmed"
                institutional_refs += 1
            elif observed_program:
                status = "exact-reference-program-conflict-review"
            else:
                status = "exact-reference-program-unresolved"
        elif len(exact) > 1:
            status = "ambiguous-multiple-catalog-references"
            selected = None
        else:
            status = "not-found-in-completed-cucsh-master-catalog"
            selected = None

        results.append({
            "author": target["author"],
            "searchedTitles": target["titles"],
            "expectedYear": target["year"],
            "expectedProgram": target["program"],
            "status": status,
            "selectedCatalogReference": selected,
            "programConflict": bool(
                selected
                and norm(selected.get("programRaw"))
                and norm(selected.get("programRaw")) != norm(target["program"])
            ),
            "exactTitleAuthor": exact,
            "titleOnly": found["titleOnly"],
            "authorOnly": found["authorOnly"],
            "libraryCatalogReferenceConfirmed": status == "cucsh-library-catalog-reference-confirmed",
            "physicalHoldingConfirmed": False,
        })

    programme_counts: dict[str, int] = {}
    for row in rows:
        label = str(row.get("programRaw") or "").strip()
        if label:
            programme_counts[label] = programme_counts.get(label, 0) + 1

    philosophy_like = {
        label: count
        for label, count in programme_counts.items()
        if "filosof" in norm(label)
    }

    result = {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "rawHtmlPersisted": False,
        "downloadsThesisFiles": False,
        "catalogReferenceDoesNotEqualPhysicalHolding": True,
        "negativeResultMeansNonexistence": False,
        "source": {
            "provider": "Biblioteca Central Dr. Manuel Rodríguez Lapuente / CUCSH",
            "catalogView": "vista-tesis-maestria",
            "catalogBaseUrls": list(t2cv.MASTER_URLS),
        },
        "scan": {
            "completed": completed,
            "pagesFetched": pages_fetched,
            "lastPageIndex": last_page,
            "rowsScanned": len(rows),
            "distinctProgramLabels": len(programme_counts),
            "philosophyLikeProgramLabels": philosophy_like,
        },
        "metrics": {
            "targets": len(targets),
            "exactTitleAuthorMatches": exact_total,
            "libraryCatalogReferencesConfirmed": institutional_refs,
            "physicalHoldingsConfirmed": 0,
            "publicRecordsAdded": 0,
        },
        "results": results,
        "pageEvidence": pages,
    }
    validate_output(result)
    return result


def validate_output(data: dict[str, Any]) -> None:
    if data.get("schemaVersion") != SCHEMA:
        raise ValueError("Wrong T2DD schema")
    if data.get("referenceOnly") is not True:
        raise ValueError("T2DD must remain reference-only")
    if data.get("rawHtmlPersisted") is not False or data.get("downloadsThesisFiles") is not False:
        raise ValueError("T2DD cannot persist HTML or download thesis files")
    if data.get("catalogReferenceDoesNotEqualPhysicalHolding") is not True:
        raise ValueError("CUCSH catalogue references cannot auto-confirm physical holdings")
    if data.get("negativeResultMeansNonexistence") is not False:
        raise ValueError("Negative CUCSH catalogue result cannot mean nonexistence")

    scan_info = data.get("scan") or {}
    if scan_info.get("completed") is not True:
        raise ValueError("T2DD output must come from a completed catalogue scan")
    if int(scan_info.get("pagesFetched") or 0) != int(scan_info.get("lastPageIndex") or -1) + 1:
        raise ValueError("T2DD pagination mismatch")
    if int(scan_info.get("rowsScanned") or 0) < 1:
        raise ValueError("T2DD must inspect at least one master-catalogue row")

    results = data.get("results") or []
    if [row.get("author") for row in results] != [
        "Adriel Manuel Hernández Guzmán",
        "Mario Damián Del Muro Silva",
    ]:
        raise ValueError("Unexpected T2DD target set")

    exact_total = 0
    refs = 0
    for row in results:
        if row.get("physicalHoldingConfirmed") is not False:
            raise ValueError("T2DD cannot confirm physical holdings from catalogue rows alone")
        exact = row.get("exactTitleAuthor") or []
        exact_total += len(exact)
        if row.get("libraryCatalogReferenceConfirmed"):
            refs += 1
            selected = row.get("selectedCatalogReference") or {}
            if not selected.get("recordUrl"):
                raise ValueError("Confirmed CUCSH catalogue reference requires institutional detail URL")
        for bucket in ("exactTitleAuthor", "titleOnly", "authorOnly"):
            for item in row.get(bucket) or []:
                url = str(item.get("recordUrl") or "")
                if url and "biblioteca.cucsh.udg.mx" not in url:
                    raise ValueError("Catalogue detail URL left CUCSH allowlist")

    expected = {
        "targets": 2,
        "exactTitleAuthorMatches": exact_total,
        "libraryCatalogReferencesConfirmed": refs,
        "physicalHoldingsConfirmed": 0,
        "publicRecordsAdded": 0,
    }
    if data.get("metrics") != expected:
        raise ValueError(f"T2DD metrics mismatch: expected {expected}, got {data.get('metrics')}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--delay", type=float, default=0.03)
    p.add_argument("--max-pages", type=int, default=320)
    args = p.parse_args()

    if args.delay < 0 or args.delay > 5:
        raise ValueError("delay must be between 0 and 5 seconds")

    t2db = json.loads(args.input.read_text(encoding="utf-8"))
    result = scan(t2db, delay=args.delay, max_pages=args.max_pages)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(result["metrics"], ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

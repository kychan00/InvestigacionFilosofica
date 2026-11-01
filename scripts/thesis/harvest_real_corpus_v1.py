#!/usr/bin/env python3
"""Real-source harvester for UdeG Humanities thesis corpus (T2B).

RIUdeG:
  OAI-PMH ListRecords + DIM + resumption tokens.

UDGVirtual:
  collection-bound JSPUI browse + individual item HTML/DC metadata.

The harvester is read-only, rate-limited, retry-aware, and produces compressed
versioned artifacts rather than committing large datasets to Git.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from collections import Counter
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import build_canonical_corpus_v1 as canonical


OAI = "http://www.openarchives.org/OAI/2.0/"
NS = {"oai": OAI}

RIUDG_ENDPOINT = "https://riudg.udg.mx/oai/request"
RIUDG_THESIS_SET = "com_20.500.12104_9"

UDGVIRTUAL_BASE = "https://biblioteca.udgvirtual.udg.mx"
UDGVIRTUAL_COLLECTION_HANDLE = "123456789/6"
UDGVIRTUAL_PARENT_HANDLE = "123456789/5"

USER_AGENT = (
    "InvestigacionFilosofica-ThesisHarvester/1.0 "
    "(+https://github.com/kychan00/InvestigacionFilosofica)"
)

DEFAULT_TIMEOUT = 45
DEFAULT_RETRIES = 4
DEFAULT_DELAY = 0.35


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def request_bytes(
    url: str,
    *,
    timeout: int = DEFAULT_TIMEOUT,
    retries: int = DEFAULT_RETRIES,
    delay: float = DEFAULT_DELAY,
    accept: str = "application/xml,text/xml,text/html;q=0.9,*/*;q=0.5",
) -> tuple[bytes, dict[str, Any]]:
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        started = time.monotonic()
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": accept,
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = response.read()
                return payload, {
                    "url": response.geturl(),
                    "status": response.status,
                    "elapsedMs": round((time.monotonic() - started) * 1000),
                    "bytes": len(payload),
                    "attempt": attempt + 1,
                    "contentType": response.headers.get("Content-Type"),
                }
        except urllib.error.HTTPError as exc:
            last_error = exc
            retry_after = None
            if exc.headers:
                raw = exc.headers.get("Retry-After")
                if raw:
                    try:
                        retry_after = float(raw)
                    except ValueError:
                        retry_after = None

            if exc.code not in {429, 500, 502, 503, 504} or attempt >= retries:
                raise

            wait = retry_after if retry_after is not None else delay * (2 ** attempt)
            time.sleep(min(wait, 10.0))
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            if attempt >= retries:
                raise
            time.sleep(min(delay * (2 ** attempt), 10.0))

    raise RuntimeError(f"Request failed: {url}: {last_error}")


def oai_url(params: dict[str, str]) -> str:
    return RIUDG_ENDPOINT + "?" + urllib.parse.urlencode(params)


def parse_oai_error(root: ET.Element) -> dict[str, str] | None:
    node = root.find("oai:error", NS)
    if node is None:
        return None
    return {
        "code": node.attrib.get("code", ""),
        "message": (node.text or "").strip(),
    }


def riudg_list_records_page(
    *,
    token: str | None = None,
    from_datestamp: str | None = None,
    until_datestamp: str | None = None,
) -> dict[str, Any]:
    if token:
        params = {
            "verb": "ListRecords",
            "resumptionToken": token,
        }
    else:
        params = {
            "verb": "ListRecords",
            "metadataPrefix": "dim",
            "set": RIUDG_THESIS_SET,
        }
        if from_datestamp:
            params["from"] = from_datestamp
        if until_datestamp:
            params["until"] = until_datestamp

    url = oai_url(params)
    payload, transport = request_bytes(url)
    root = ET.fromstring(payload)

    error = parse_oai_error(root)
    if error:
        raise RuntimeError(f"OAI error {error['code']}: {error['message']}")

    records: list[dict[str, Any]] = []
    tombstones: list[dict[str, Any]] = []

    for node in root.findall("oai:ListRecords/oai:record", NS):
        header = node.find("oai:header", NS)
        if header is None:
            continue

        identifier = canonical.clean_text(
            header.findtext("oai:identifier", default="", namespaces=NS)
        )
        datestamp = canonical.clean_text(
            header.findtext("oai:datestamp", default="", namespaces=NS)
        )
        set_specs = [
            canonical.clean_text(item.text)
            for item in header.findall("oai:setSpec", NS)
            if canonical.clean_text(item.text)
        ]

        if header.attrib.get("status") == "deleted":
            tombstones.append(
                {
                    "provider": "riudg",
                    "providerRecordId": identifier,
                    "datestamp": datestamp,
                    "setSpecs": set_specs,
                    "status": "deleted",
                }
            )
            continue

        xml_text = ET.tostring(node, encoding="unicode")
        records.append(
            canonical.parse_riudg_dim(
                xml_text,
                source_url=url,
            )
        )

    token_node = root.find("oai:ListRecords/oai:resumptionToken", NS)
    next_token = (token_node.text or "").strip() if token_node is not None else ""

    return {
        "records": records,
        "tombstones": tombstones,
        "nextToken": next_token or None,
        "cursor": token_node.attrib.get("cursor") if token_node is not None else None,
        "completeListSize": (
            token_node.attrib.get("completeListSize")
            if token_node is not None
            else None
        ),
        "expirationDate": (
            token_node.attrib.get("expirationDate")
            if token_node is not None
            else None
        ),
        "transport": transport,
    }


def harvest_riudg(
    *,
    max_records: int | None,
    max_pages: int | None,
    from_datestamp: str | None,
    until_datestamp: str | None,
    delay: float,
) -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    tombstones: list[dict[str, Any]] = []
    pages: list[dict[str, Any]] = []
    token: str | None = None
    page_number = 0
    stop_reason = "exhausted"
    complete_list_size: int | None = None

    while True:
        page_number += 1
        page = riudg_list_records_page(
            token=token,
            from_datestamp=from_datestamp if token is None else None,
            until_datestamp=until_datestamp if token is None else None,
        )

        if page.get("completeListSize"):
            try:
                complete_list_size = int(page["completeListSize"])
            except (TypeError, ValueError):
                pass

        page_records = page["records"]
        remaining = None
        if max_records is not None:
            remaining = max(max_records - len(records), 0)

        if remaining is not None and len(page_records) > remaining:
            page_records = page_records[:remaining]
            stop_reason = "max-records"

        records.extend(page_records)
        tombstones.extend(page["tombstones"])

        pages.append(
            {
                "page": page_number,
                "records": len(page_records),
                "tombstones": len(page["tombstones"]),
                "cursor": page.get("cursor"),
                "completeListSize": page.get("completeListSize"),
                "transport": page["transport"],
            }
        )

        if max_records is not None and len(records) >= max_records:
            stop_reason = "max-records"
            break

        if max_pages is not None and page_number >= max_pages:
            stop_reason = "max-pages"
            break

        token = page.get("nextToken")
        if not token:
            stop_reason = "exhausted"
            break

        if delay:
            time.sleep(delay)

    return {
        "provider": "riudg",
        "status": "exhausted" if stop_reason == "exhausted" else "partial",
        "stopReason": stop_reason,
        "completeListSize": complete_list_size,
        "records": records,
        "tombstones": tombstones,
        "pages": pages,
        "from": from_datestamp,
        "until": until_datestamp,
    }


class BrowseParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hrefs: list[str] = []
        self.text_chunks: list[str] = []

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        if tag.casefold() == "a":
            values = {str(k).casefold(): (v or "") for k, v in attrs}
            href = values.get("href")
            if href:
                self.hrefs.append(unescape(href))

    def handle_data(self, data: str) -> None:
        value = data.strip()
        if value:
            self.text_chunks.append(value)


def udgvirtual_browse_url(*, offset: int, rpp: int = 100) -> str:
    params = urllib.parse.urlencode(
        {
            "type": "title",
            "rpp": str(rpp),
            "sort_by": "1",
            "order": "ASC",
            "offset": str(offset),
        }
    )
    return (
        f"{UDGVIRTUAL_BASE}/jspui/handle/"
        f"{UDGVIRTUAL_COLLECTION_HANDLE}/browse?{params}"
    )


def parse_udgvirtual_browse(html_text: str) -> dict[str, Any]:
    parser = BrowseParser()
    parser.feed(html_text)

    handles: list[str] = []
    seen: set[str] = set()
    excluded = {
        UDGVIRTUAL_COLLECTION_HANDLE.split("/", 1)[1],
        UDGVIRTUAL_PARENT_HANDLE.split("/", 1)[1],
    }

    for href in parser.hrefs:
        match = re.search(r"(?:/jspui)?/handle/123456789/(\d+)", href)
        if not match:
            continue
        item_id = match.group(1)
        if item_id in excluded or item_id in seen:
            continue
        seen.add(item_id)
        handles.append(item_id)

    visible = re.sub(r"\s+", " ", " ".join(parser.text_chunks)).strip()
    total = None
    patterns = [
        r"(?:of|de)\s+([0-9][0-9,]*)",
        r"([0-9][0-9,]*)\s+(?:items|ítems|registros|resultados)",
    ]
    for pattern in patterns:
        match = re.search(pattern, visible, flags=re.IGNORECASE)
        if match:
            try:
                total = int(match.group(1).replace(",", ""))
                break
            except ValueError:
                pass

    return {
        "handles": handles,
        "reportedTotal": total,
    }


def enumerate_udgvirtual(*, delay: float) -> dict[str, Any]:
    handles: list[str] = []
    seen: set[str] = set()
    pages: list[dict[str, Any]] = []
    reported_total: int | None = None

    offset = 0
    rpp = 100

    while True:
        url = udgvirtual_browse_url(offset=offset, rpp=rpp)
        payload, transport = request_bytes(
            url,
            accept="text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        )
        parsed = parse_udgvirtual_browse(payload.decode("utf-8", "replace"))
        page_handles = [
            item for item in parsed["handles"]
            if item not in seen
        ]

        for item in page_handles:
            seen.add(item)
            handles.append(item)

        if parsed.get("reportedTotal") is not None:
            reported_total = parsed["reportedTotal"]

        pages.append(
            {
                "offset": offset,
                "handles": len(page_handles),
                "reportedTotal": parsed.get("reportedTotal"),
                "transport": transport,
            }
        )

        if len(page_handles) < rpp:
            break

        offset += rpp
        if delay:
            time.sleep(delay)

        if offset > 10000:
            raise RuntimeError("UDGVirtual browse pagination exceeded safety bound")

    return {
        "handles": handles,
        "pages": pages,
        "reportedTotal": reported_total,
    }


def harvest_udgvirtual(
    *,
    max_records: int | None,
    delay: float,
) -> dict[str, Any]:
    enumeration = enumerate_udgvirtual(delay=delay)
    handles = enumeration["handles"]

    if max_records is not None:
        selected = handles[:max_records]
        stop_reason = "max-records" if len(handles) > len(selected) else "exhausted"
    else:
        selected = handles
        stop_reason = "exhausted"

    records: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    requests: list[dict[str, Any]] = []

    for index, item_id in enumerate(selected):
        handle = f"123456789/{item_id}"
        url = f"{UDGVIRTUAL_BASE}/jspui/handle/{handle}"
        try:
            payload, transport = request_bytes(
                url,
                accept="text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
            )
            html_text = payload.decode("utf-8", "replace")
            record = canonical.parse_udgvirtual_html(
                html_text,
                handle=handle,
                source_url=url,
            )

            if not record.get("rawFields"):
                raise ValueError("No DC metadata found in item HTML")

            records.append(record)
            requests.append(
                {
                    "handle": handle,
                    "transport": transport,
                    "fieldCount": len(record.get("rawFields") or {}),
                }
            )
        except Exception as exc:
            failures.append(
                {
                    "handle": handle,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

        if delay and index + 1 < len(selected):
            time.sleep(delay)

    return {
        "provider": "udgvirtual",
        "status": (
            "exhausted"
            if stop_reason == "exhausted" and not failures
            else "partial"
        ),
        "stopReason": stop_reason,
        "reportedTotal": enumeration.get("reportedTotal"),
        "enumeratedHandles": len(handles),
        "selectedHandles": len(selected),
        "records": records,
        "failures": failures,
        "browsePages": enumeration["pages"],
        "itemRequests": requests,
    }


def observed_catalog(
    corpus: dict[str, Any],
) -> dict[str, Any]:
    source_map = {
        item["id"]: item
        for item in corpus.get("sourceRecords", [])
    }

    programs: dict[str, dict[str, Any]] = {}
    units: Counter[str] = Counter()
    institutions: Counter[str] = Counter()

    for work in corpus.get("works", []):
        raw_program = canonical.clean_text(work.get("programRaw"))
        if raw_program:
            key = canonical.normalize_key(raw_program)
            entry = programs.setdefault(
                key,
                {
                    "normalizedKey": key,
                    "variants": Counter(),
                    "programRefs": Counter(),
                    "admissionStatuses": Counter(),
                    "providers": Counter(),
                },
            )
            entry["variants"][raw_program] += 1
            if work.get("programRef"):
                entry["programRefs"][work["programRef"]] += 1
            entry["admissionStatuses"][work.get("admissionStatus") or "unknown"] += 1
            for ref in work.get("sourceRecordRefs", []):
                provider = source_map.get(ref, {}).get("provider")
                if provider:
                    entry["providers"][provider] += 1

        if canonical.clean_text(work.get("academicUnitRaw")):
            units[canonical.clean_text(work["academicUnitRaw"])] += 1
        if canonical.clean_text(work.get("institutionRaw")):
            institutions[canonical.clean_text(work["institutionRaw"])] += 1

    program_rows = []
    for key, item in sorted(
        programs.items(),
        key=lambda pair: (-sum(pair[1]["variants"].values()), pair[0]),
    ):
        program_rows.append(
            {
                "normalizedKey": key,
                "count": sum(item["variants"].values()),
                "variants": dict(item["variants"].most_common()),
                "programRefs": dict(item["programRefs"].most_common()),
                "admissionStatuses": dict(item["admissionStatuses"].most_common()),
                "providers": dict(item["providers"].most_common()),
            }
        )

    return {
        "schemaVersion": "thesis-observed-authorities-v1",
        "programs": program_rows,
        "academicUnits": dict(units.most_common()),
        "institutions": dict(institutions.most_common()),
    }


def coverage_ledger(
    *,
    riudg: dict[str, Any],
    udgvirtual: dict[str, Any],
    corpus: dict[str, Any],
    started_at: str,
    finished_at: str,
) -> dict[str, Any]:
    works = corpus.get("works", [])
    field_counts = Counter()

    for work in works:
        checks = {
            "title": work.get("title"),
            "date": (work.get("date") or {}).get("value"),
            "language": work.get("language"),
            "abstract": work.get("abstract"),
            "keywords": work.get("keywords"),
            "program": work.get("programRaw"),
            "programResolved": work.get("programRef"),
            "institutionResolved": work.get("institutionRef"),
            "academicUnit": work.get("academicUnitRaw"),
            "persistentIdentifier": work.get("persistentIdentifiers"),
            "author": [
                item
                for item in work.get("contributions", [])
                if item.get("role") == "thesis-author"
            ],
            "director": [
                item
                for item in work.get("contributions", [])
                if item.get("role") == "thesis-director"
            ],
        }
        for key, value in checks.items():
            if value:
                field_counts[key] += 1

    total = len(works)
    coverage = {
        key: {
            "present": count,
            "total": total,
            "ratio": round(count / total, 6) if total else 0.0,
        }
        for key, count in sorted(field_counts.items())
    }

    return {
        "schemaVersion": "thesis-coverage-ledger-v1",
        "startedAt": started_at,
        "finishedAt": finished_at,
        "providers": {
            "riudg": {
                "status": riudg["status"],
                "stopReason": riudg["stopReason"],
                "completeListSize": riudg.get("completeListSize"),
                "records": len(riudg["records"]),
                "tombstones": len(riudg["tombstones"]),
                "pages": len(riudg["pages"]),
                "from": riudg.get("from"),
                "until": riudg.get("until"),
            },
            "udgvirtual": {
                "status": udgvirtual["status"],
                "stopReason": udgvirtual["stopReason"],
                "reportedTotal": udgvirtual.get("reportedTotal"),
                "enumeratedHandles": udgvirtual.get("enumeratedHandles"),
                "selectedHandles": udgvirtual.get("selectedHandles"),
                "records": len(udgvirtual["records"]),
                "failures": len(udgvirtual["failures"]),
                "browsePages": len(udgvirtual["browsePages"]),
            },
        },
        "corpus": {
            "sourceRecords": corpus["metrics"]["sourceRecords"],
            "works": corpus["metrics"]["works"],
            "worksByAdmission": corpus["metrics"]["worksByAdmission"],
            "providers": corpus["metrics"]["providers"],
            "dateQuality": corpus["metrics"]["dateQuality"],
            "identityDecisions": corpus["metrics"]["identityDecisions"],
        },
        "fieldCoverage": coverage,
    }


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_json_gz(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")
    with gzip.open(path, "wb", compresslevel=9, mtime=0) as handle:
        handle.write(encoded)


def write_jsonl_gz(path: Path, values: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8", compresslevel=9, mtime=0) as handle:
        for value in values:
            handle.write(
                json.dumps(
                    value,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                )
                + "\n"
            )


def build_manifest(
    output_dir: Path,
    *,
    mode: str,
    corpus: dict[str, Any],
    ledger: dict[str, Any],
) -> dict[str, Any]:
    files = []
    for path in sorted(output_dir.rglob("*")):
        if not path.is_file() or path.name == "manifest.json":
            continue
        files.append(
            {
                "path": str(path.relative_to(output_dir)),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )

    return {
        "schemaVersion": "thesis-harvest-manifest-v1",
        "mode": mode,
        "createdAt": ledger["finishedAt"],
        "builderVersion": "thesis-canonical-corpus-v1",
        "harvesterVersion": "thesis-real-harvest-v1",
        "programAuthorityRevision": corpus["programAuthorityRevision"],
        "metrics": corpus["metrics"],
        "coverageLedgerVersion": ledger["schemaVersion"],
        "files": files,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["sample", "full"], default="sample")
    parser.add_argument("--output-dir", default="artifacts/thesis-real-harvest")
    parser.add_argument("--registry", default=str(canonical.DEFAULT_REGISTRY))
    parser.add_argument("--riudg-max-records", type=int)
    parser.add_argument("--riudg-max-pages", type=int)
    parser.add_argument("--udgvirtual-max-records", type=int)
    parser.add_argument("--riudg-from")
    parser.add_argument("--riudg-until")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY)
    args = parser.parse_args()

    if args.mode == "sample":
        riudg_max_records = (
            args.riudg_max_records
            if args.riudg_max_records is not None
            else 200
        )
        riudg_max_pages = (
            args.riudg_max_pages
            if args.riudg_max_pages is not None
            else 3
        )
        udgvirtual_max_records = (
            args.udgvirtual_max_records
            if args.udgvirtual_max_records is not None
            else 20
        )
    else:
        riudg_max_records = args.riudg_max_records
        riudg_max_pages = args.riudg_max_pages
        udgvirtual_max_records = args.udgvirtual_max_records

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    started_at = utc_now()
    registry = canonical.load_program_registry(args.registry)

    riudg = harvest_riudg(
        max_records=riudg_max_records,
        max_pages=riudg_max_pages,
        from_datestamp=args.riudg_from,
        until_datestamp=args.riudg_until,
        delay=args.delay,
    )
    udgvirtual = harvest_udgvirtual(
        max_records=udgvirtual_max_records,
        delay=args.delay,
    )

    source_records = [
        *riudg["records"],
        *udgvirtual["records"],
    ]

    corpus = canonical.build_corpus(
        source_records,
        registry,
        reference_year=datetime.now(timezone.utc).year,
        build_revision=(
            "thesis-real-harvest-full-v1"
            if args.mode == "full"
            else "thesis-real-harvest-sample-v1"
        ),
    )

    finished_at = utc_now()
    ledger = coverage_ledger(
        riudg=riudg,
        udgvirtual=udgvirtual,
        corpus=corpus,
        started_at=started_at,
        finished_at=finished_at,
    )
    catalog = observed_catalog(corpus)

    write_jsonl_gz(
        output_dir / "source-records.jsonl.gz",
        corpus["sourceRecords"],
    )
    write_jsonl_gz(
        output_dir / "riudg-tombstones.jsonl.gz",
        riudg["tombstones"],
    )
    write_json_gz(
        output_dir / "canonical-corpus.json.gz",
        corpus,
    )
    write_json(
        output_dir / "coverage-ledger.json",
        ledger,
    )
    write_json(
        output_dir / "observed-authorities.json",
        catalog,
    )
    write_json(
        output_dir / "riudg-pages.json",
        riudg["pages"],
    )
    write_json(
        output_dir / "udgvirtual-reconciliation.json",
        {
            "reportedTotal": udgvirtual.get("reportedTotal"),
            "enumeratedHandles": udgvirtual.get("enumeratedHandles"),
            "selectedHandles": udgvirtual.get("selectedHandles"),
            "failures": udgvirtual["failures"],
            "browsePages": udgvirtual["browsePages"],
        },
    )

    manifest = build_manifest(
        output_dir,
        mode=args.mode,
        corpus=corpus,
        ledger=ledger,
    )
    write_json(output_dir / "manifest.json", manifest)

    summary = {
        "mode": args.mode,
        "outputDir": str(output_dir),
        "riudg": ledger["providers"]["riudg"],
        "udgvirtual": ledger["providers"]["udgvirtual"],
        "corpus": ledger["corpus"],
        "programsObserved": len(catalog["programs"]),
        "manifestFiles": len(manifest["files"]),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))

    if args.mode == "full":
        expected = udgvirtual.get("reportedTotal")
        enumerated = udgvirtual.get("enumeratedHandles")
        if expected is not None and enumerated != expected:
            raise RuntimeError(
                f"UDGVirtual reconciliation failed: enumerated={enumerated}, expected={expected}"
            )
        if udgvirtual["failures"]:
            raise RuntimeError(
                f"UDGVirtual item failures: {len(udgvirtual['failures'])}"
            )
        if riudg["status"] != "exhausted":
            raise RuntimeError("RIUdeG full harvest did not exhaust ListRecords")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

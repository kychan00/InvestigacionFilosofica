#!/usr/bin/env python3
"""Harvest reference-only Philosophy thesis metadata from official UdeG sources."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import re
import subprocess
import time
import urllib.parse
from collections import Counter
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import build_canonical_corpus_v1 as canonical

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REGISTRY = ROOT / "scripts/thesis/config/program-authority-v1.json"
DEFAULT_SUPPLEMENT = ROOT / "scripts/thesis/config/philosophy-official-supplement-v1.json"
LIBRARY_BASE = "https://www.biblioteca.cucsh.udg.mx/"
USER_AGENT = "InvestigacionFilosofica-PhilosophyThesisHarvester/1.0 (+https://github.com/kychan00/InvestigacionFilosofica)"
FORBIDDEN = (".pdf", "/bitstream", "/download")
TARGET_PROGRAM_REFS = (
    "program:udg:lic-filosofia",
    "program:udg:mae-estudios-filosoficos",
    "program:udg:mae-filosofia-historica",
)
LIBRARY_VIEWS = (
    ("licenciatura", "vista-tesis-licenciatura"),
    ("maestria", "vista-tesis-maestria"),
)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize(value: str | None) -> str:
    return canonical.normalize_key(canonical.clean_text(value))


def stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def safe_url(url: str | None) -> bool:
    if not url:
        return False
    value = urllib.parse.unquote(url).casefold()
    return value.startswith("https://") and not any(token in value for token in FORBIDDEN)


def request_text(url: str, *, retries: int = 3, delay: float = 0.8) -> str:
    """Fetch CUCSH HTML through curl/IPv4; Azure runners can stall on urllib routing."""
    command = [
        "curl",
        "-4",
        "--fail",
        "--location",
        "--silent",
        "--show-error",
        "--compressed",
        "--connect-timeout",
        "15",
        "--max-time",
        "45",
        "--user-agent",
        USER_AGENT,
        "--header",
        "Accept: text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        url,
    ]
    last = ""
    for attempt in range(retries + 1):
        proc = subprocess.run(command, capture_output=True, text=True, check=False)
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout
        last = (proc.stderr or f"curl exit {proc.returncode}").strip()
        if attempt < retries:
            time.sleep(delay * (attempt + 1))
    raise RuntimeError(f"CUCSH request failed: {url}: {last}")

class ThesisTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[dict[str, Any]]] = []
        self.row: list[dict[str, Any]] | None = None
        self.cell: dict[str, Any] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        name = tag.casefold()
        if name == "tr":
            self.row = []
        elif name in {"td", "th"} and self.row is not None:
            self.cell = {"text": [], "hrefs": []}
        elif name == "a" and self.cell is not None:
            values = {str(k).casefold(): (v or "") for k, v in attrs}
            href = unescape(values.get("href", "")).strip()
            if href:
                self.cell["hrefs"].append(href)

    def handle_endtag(self, tag: str) -> None:
        name = tag.casefold()
        if name in {"td", "th"} and self.cell is not None and self.row is not None:
            self.row.append(
                {
                    "text": canonical.clean_text(" ".join(self.cell["text"])) or "",
                    "hrefs": list(self.cell["hrefs"]),
                }
            )
            self.cell = None
        elif name == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None
            self.cell = None

    def handle_data(self, data: str) -> None:
        if self.cell is not None and data.strip():
            self.cell["text"].append(data.strip())


def parse_library_table(html_text: str, *, source_url: str, level: str) -> list[dict[str, Any]]:
    parser = ThesisTableParser()
    parser.feed(html_text)
    rows = []
    for cells in parser.rows:
        if len(cells) < 6:
            continue
        title, author, coauthor, director, year, program = [cell["text"] for cell in cells[:6]]
        if normalize(title) in {"titulo", "title"} or not title or not author or not program:
            continue
        href = next((value for value in cells[0]["hrefs"] if value), None)
        record_url = urllib.parse.urljoin(source_url, href) if href else source_url
        if not safe_url(record_url):
            raise ValueError(f"Unsafe CUCSH thesis reference URL: {record_url}")
        rows.append(
            {
                "level": level,
                "title": title,
                "authors": [value for value in (author, coauthor) if value],
                "directors": [director] if director else [],
                "year": year or None,
                "program": program,
                "recordUrl": record_url,
            }
        )
    return rows


def program_alias_index(registry: dict[str, Any]) -> dict[str, str]:
    index: dict[str, str] = {}
    found: set[str] = set()
    for program in registry.get("programs") or []:
        if program.get("id") not in TARGET_PROGRAM_REFS:
            continue
        found.add(program["id"])
        for value in [program.get("canonicalName"), *(program.get("aliases") or [])]:
            key = normalize(value)
            if not key:
                continue
            if key in index and index[key] != program["id"]:
                raise ValueError(f"Ambiguous Philosophy program alias: {value}")
            index[key] = program["id"]
    missing = sorted(set(TARGET_PROGRAM_REFS) - found)
    if missing:
        raise ValueError(f"Missing Philosophy Program Authority entries: {missing}")
    return index


def source_record(
    *,
    provider: str,
    provider_record_id: str,
    record_url: str,
    title: str,
    authors: list[str],
    directors: list[str],
    year: str | None,
    program: str,
    institution: str,
    academic_unit: str,
    thesis_type: str,
    evidence_kind: str,
) -> dict[str, Any]:
    if not safe_url(record_url):
        raise ValueError(f"Unsafe reference URL: {record_url}")
    fields: dict[str, list[str]] = {
        "dc.title": [title],
        "dc.contributor.author": authors,
        "dc.degree.name": [program],
        "dc.degree.grantor": [institution],
        "dc.degree.department": [academic_unit],
        "dc.type": [thesis_type],
        "dc.identifier.uri": [record_url],
        "local.evidence.kind": [evidence_kind],
    }
    if directors:
        fields["dc.contributor.director"] = directors
    if year:
        fields["dc.date.issued"] = [str(year)]
    payload = json.dumps(
        {
            "provider": provider,
            "providerRecordId": provider_record_id,
            "recordUrl": record_url,
            "title": title,
            "authors": authors,
            "directors": directors,
            "year": year,
            "program": program,
            "evidenceKind": evidence_kind,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return canonical.source_record(
        provider=provider,
        provider_record_id=provider_record_id,
        source_url=record_url,
        raw_fields=fields,
        raw_payload=payload,
    )


def library_record_id(url: str, row: dict[str, Any]) -> str:
    match = re.search(r"(?:q=)?node/(\d+)", urllib.parse.unquote(url), flags=re.IGNORECASE)
    if match:
        return f"node-{match.group(1)}"
    material = "|".join(
        [
            row.get("program") or "",
            row.get("title") or "",
            ";".join(row.get("authors") or []),
            str(row.get("year") or ""),
            url,
        ]
    )
    return "catalog-" + stable_hash(material)[:24]


def library_to_source(row: dict[str, Any]) -> dict[str, Any]:
    return source_record(
        provider="cucsh-library",
        provider_record_id=library_record_id(row["recordUrl"], row),
        record_url=row["recordUrl"],
        title=row["title"],
        authors=list(row.get("authors") or []),
        directors=list(row.get("directors") or []),
        year=row.get("year"),
        program=row["program"],
        institution="Universidad de Guadalajara",
        academic_unit="Centro Universitario de Ciencias Sociales y Humanidades",
        thesis_type=f"Tesis de {row['level']}",
        evidence_kind="official-cucsh-library-record",
    )


def seed_to_source(seed: dict[str, Any]) -> dict[str, Any]:
    return source_record(
        provider=seed["provider"],
        provider_record_id=seed["providerRecordId"],
        record_url=seed["recordUrl"],
        title=seed["title"],
        authors=list(seed.get("authors") or []),
        directors=list(seed.get("directors") or []),
        year=seed.get("year"),
        program=seed["program"],
        institution=seed["institution"],
        academic_unit=seed["academicUnit"],
        thesis_type=seed["thesisType"],
        evidence_kind=seed["evidenceKind"],
    )


def load_seeds(path: Path, registry: dict[str, Any]) -> list[dict[str, Any]]:
    config = read_json(path)
    if config.get("schemaVersion") != "thesis-philosophy-official-supplement-v1":
        raise ValueError("Unsupported Philosophy supplement schema")
    aliases = program_alias_index(registry)
    output = []
    for seed in config.get("seedRecords") or []:
        if aliases.get(normalize(seed.get("program"))) not in TARGET_PROGRAM_REFS:
            raise ValueError(f"Seed program authority mismatch: {seed.get('providerRecordId')}")
        if not safe_url(seed.get("recordUrl")):
            raise ValueError(f"Unsafe seed URL: {seed.get('providerRecordId')}")
        output.append(seed_to_source(seed))
    return output


def harvest_library(
    registry: dict[str, Any],
    *,
    max_pages_per_view: int | None = None,
    delay: float = 0.35,
) -> dict[str, Any]:
    aliases = program_alias_index(registry)
    selected: list[dict[str, Any]] = []
    pages: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for level, view in LIBRARY_VIEWS:
        page = 0
        previous_signature: str | None = None
        while True:
            if max_pages_per_view is not None and page >= max_pages_per_view:
                break
            url = f"{LIBRARY_BASE}?{urllib.parse.urlencode({'q': view, 'page': page})}"
            rows = parse_library_table(request_text(url), source_url=url, level=level)
            signature = stable_hash(json.dumps(rows, ensure_ascii=False, sort_keys=True))
            if not rows or signature == previous_signature:
                pages.append({"level": level, "page": page, "url": url, "rows": len(rows), "selected": 0, "stop": True})
                break
            previous_signature = signature
            kept = 0
            for row in rows:
                if aliases.get(normalize(row["program"])) not in TARGET_PROGRAM_REFS:
                    continue
                record = library_to_source(row)
                if record["id"] in seen_ids:
                    continue
                seen_ids.add(record["id"])
                selected.append(record)
                kept += 1
            pages.append({"level": level, "page": page, "url": url, "rows": len(rows), "selected": kept, "stop": False})
            page += 1
            if delay:
                time.sleep(delay)
    return {"records": selected, "pages": pages}


def bibliographic_key(record: dict[str, Any]) -> tuple[str, str, str, str]:
    title = canonical.first(canonical.field_values(record, "dc.title")) or ""
    authors = canonical.field_values(record, "dc.contributor.author")
    program = canonical.first(canonical.field_values(record, "dc.degree.name")) or ""
    year = canonical.first(canonical.field_values(record, "dc.date.issued")) or ""
    return normalize(title), normalize(authors[0] if authors else ""), normalize(program), str(year)[:4]


def merge_records(*groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for record in [item for group in groups for item in group]:
        key = bibliographic_key(record)
        existing = by_key.get(key)
        if existing is None or (
            record["provider"] == "cucsh-library" and existing["provider"] != "cucsh-library"
        ):
            by_key[key] = record
    return sorted(by_key.values(), key=lambda item: (item["provider"], item["providerRecordId"]))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def write_jsonl_gz(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=9, mtime=0, filename="") as compressed:
            with io.TextIOWrapper(compressed, encoding="utf-8", newline="") as stream:
                for row in rows:
                    stream.write(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--supplement", type=Path, default=DEFAULT_SUPPLEMENT)
    parser.add_argument("--output-dir", type=Path, default=Path("artifacts/thesis-philosophy-source-v1"))
    parser.add_argument("--max-pages-per-view", type=int)
    parser.add_argument("--delay", type=float, default=0.35)
    parser.add_argument("--skip-library", action="store_true")
    args = parser.parse_args()

    registry = read_json(args.registry)
    supplement = read_json(args.supplement)
    seeds = load_seeds(args.supplement, registry)
    live = {"records": [], "pages": []}
    if not args.skip_library:
        live = harvest_library(registry, max_pages_per_view=args.max_pages_per_view, delay=args.delay)
    records = merge_records(seeds, live["records"])
    report = {
        "schemaVersion": "thesis-philosophy-source-report-v1",
        "sourceRevision": supplement["revision"],
        "targetProgramRefs": list(TARGET_PROGRAM_REFS),
        "exactDoctorateProgramPresent": False,
        "doctoralContext": supplement["doctoralPolicy"],
        "seedRecords": len(seeds),
        "librarySelectedRecords": len(live["records"]),
        "mergedRecords": len(records),
        "providers": dict(Counter(row["provider"] for row in records)),
        "libraryPages": live["pages"],
        "referenceOnly": True,
    }
    write_jsonl_gz(args.output_dir / "source-records.jsonl.gz", records)
    write_json(args.output_dir / "report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

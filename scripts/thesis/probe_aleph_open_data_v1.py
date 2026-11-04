#!/usr/bin/env python3
"""Inspect UdeG ALEPH open-data XLSX without persisting the raw workbook."""
from __future__ import annotations

import argparse
import io
import json
import re
import unicodedata
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

ALEPH_XLSX = "https://transparencia.udg.mx/sites/default/files/datos_abiertos/Listado%20de%20t%C3%ADtulos%20del%20cat%C3%A1logo%20ALEPH.xlsx"
SCHEMA = "thesis-aleph-open-data-recon-v1"
REVISION = "2026-11-04.t2ck-v1"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def normalize(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return " ".join(text.casefold().split())


def col_index(ref: str) -> int:
    letters = re.match(r"[A-Z]+", ref)
    if not letters:
        return 0
    value = 0
    for ch in letters.group(0):
        value = value * 26 + (ord(ch) - 64)
    return value - 1


def shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        data = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(data)
    out = []
    for si in root.findall("m:si", NS):
        out.append("".join(node.text or "" for node in si.iterfind(".//m:t", NS)))
    return out


def workbook_sheets(zf: zipfile.ZipFile) -> list[tuple[str, str]]:
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("r:Relationship", REL_NS)}
    result = []
    for sheet in wb.findall(".//m:sheet", NS):
        name = sheet.attrib.get("name", "")
        rel_id = sheet.attrib.get(f"{{{OFFICE_REL_NS}}}id")
        target = rel_map.get(rel_id or "", "")
        if target and not target.startswith("/"):
            target = "xl/" + target.lstrip("/")
        result.append((name, target))
    return result


def parse_sheet(zf: zipfile.ZipFile, path: str, strings: list[str], max_rows: int | None = None) -> list[list[str]]:
    root = ET.fromstring(zf.read(path))
    rows: list[list[str]] = []
    for row in root.findall(".//m:sheetData/m:row", NS):
        values: dict[int, str] = {}
        for cell in row.findall("m:c", NS):
            ref = cell.attrib.get("r", "A1")
            idx = col_index(ref)
            kind = cell.attrib.get("t")
            value = ""
            if kind == "inlineStr":
                value = "".join(node.text or "" for node in cell.iterfind(".//m:t", NS))
            else:
                v = cell.find("m:v", NS)
                raw = v.text if v is not None and v.text is not None else ""
                if kind == "s" and raw.isdigit():
                    sidx = int(raw)
                    value = strings[sidx] if 0 <= sidx < len(strings) else raw
                else:
                    value = raw
            values[idx] = value.strip()
        if values:
            width = max(values) + 1
            rows.append([values.get(i, "") for i in range(width)])
            if max_rows is not None and len(rows) >= max_rows:
                break
    return rows


def fetch_bytes(url: str = ALEPH_XLSX) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "InvestigacionFilosofica-T2CK/1.0 (+metadata-only recon)"},
    )
    with urllib.request.urlopen(req, timeout=90) as response:
        data = response.read()
        ctype = response.headers.get("Content-Type", "")
    if not data.startswith(b"PK"):
        raise ValueError(f"ALEPH open-data URL did not return XLSX bytes: {ctype}")
    return data


def classify_row(row: list[str]) -> dict[str, bool]:
    text = normalize(" | ".join(row))
    return {
        "philosophy": "filosof" in text,
        "thesis": "tesis" in text,
        "masters": "maestr" in text,
        "doctorate": "doctor" in text,
        "humanities": "humanidad" in text,
        "cucsh": "cucsh" in text or "ciencias sociales y humanidades" in text,
    }


def build_report(data: bytes) -> dict[str, Any]:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        strings = shared_strings(zf)
        sheets = workbook_sheets(zf)
        output = []
        all_matches = []
        for name, path in sheets:
            rows = parse_sheet(zf, path, strings)
            headers = rows[0] if rows else []
            matches = []
            for row_number, row in enumerate(rows[1:], start=2):
                flags = classify_row(row)
                if any(flags.values()):
                    entry = {"row": row_number, "values": row, "signals": [k for k, v in flags.items() if v]}
                    matches.append(entry)
                    all_matches.append({"sheet": name, **entry})
            output.append({
                "name": name,
                "path": path,
                "rows": len(rows),
                "headers": headers,
                "matches": matches[:500],
                "matchCount": len(matches),
            })
    return {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "sourceUrl": ALEPH_XLSX,
        "referenceOnly": True,
        "rawWorkbookPersisted": False,
        "workbookBytes": len(data),
        "sheets": output,
        "metrics": {
            "sheets": len(output),
            "rows": sum(sheet["rows"] for sheet in output),
            "matches": len(all_matches),
            "philosophyRows": sum("philosophy" in row["signals"] for row in all_matches),
            "thesisRows": sum("thesis" in row["signals"] for row in all_matches),
            "mastersRows": sum("masters" in row["signals"] for row in all_matches),
            "doctorateRows": sum("doctorate" in row["signals"] for row in all_matches),
            "humanitiesRows": sum("humanities" in row["signals"] for row in all_matches),
            "cucshRows": sum("cucsh" in row["signals"] for row in all_matches),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = build_report(fetch_bytes())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["metrics"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

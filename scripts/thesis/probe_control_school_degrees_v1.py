#!/usr/bin/env python3
"""Inspect public UdeG Control Escolar degree statistics for Philosophy coverage."""
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

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
SCHEMA = "thesis-control-school-degree-recon-v1"
REVISION = "2026-11-04.t2ck-v1"

FILES = {
    "2025": "https://www.transparencia.udg.mx/sites/default/files/datos_abiertos/Titulos_Diplomas-y-Grados_2025.xlsx",
    "2024": "https://www.transparencia.udg.mx/sites/default/files/datos_abiertos/T%C3%ADtulos_Diplomas%20y%20grados_2024.xlsx",
    "2023": "https://www.transparencia.udg.mx/sites/default/files/datos_abiertos/T%C3%ADtulos_Diplomas%20y%20grados_2023.xlsx",
    "2022": "https://www.transparencia.udg.mx/sites/default/files/datos_abiertos/Titulos%20Diplomas%20y%20grados%202022.xlsx",
}


def normalize(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return " ".join(text.casefold().split())


def col_index(ref: str) -> int:
    match = re.match(r"[A-Z]+", ref)
    if not match:
        return 0
    value = 0
    for ch in match.group(0):
        value = value * 26 + ord(ch) - 64
    return value - 1


def shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return [
        "".join(node.text or "" for node in si.iterfind(".//m:t", NS))
        for si in root.findall("m:si", NS)
    ]


def workbook_sheets(zf: zipfile.ZipFile) -> list[tuple[str, str]]:
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("r:Relationship", REL_NS)}
    output = []
    for sheet in wb.findall(".//m:sheet", NS):
        rel_id = sheet.attrib.get(f"{{{OFFICE_REL_NS}}}id", "")
        target = rel_map.get(rel_id, "")
        if target and not target.startswith("/"):
            target = "xl/" + target.lstrip("/")
        output.append((sheet.attrib.get("name", ""), target))
    return output


def parse_sheet(zf: zipfile.ZipFile, path: str, strings: list[str]) -> list[list[str]]:
    root = ET.fromstring(zf.read(path))
    rows: list[list[str]] = []
    for row in root.findall(".//m:sheetData/m:row", NS):
        cells: dict[int, str] = {}
        for cell in row.findall("m:c", NS):
            idx = col_index(cell.attrib.get("r", "A1"))
            kind = cell.attrib.get("t")
            value = ""
            if kind == "inlineStr":
                value = "".join(node.text or "" for node in cell.iterfind(".//m:t", NS))
            else:
                node = cell.find("m:v", NS)
                raw = node.text if node is not None and node.text is not None else ""
                if kind == "s" and raw.isdigit():
                    sidx = int(raw)
                    value = strings[sidx] if sidx < len(strings) else raw
                else:
                    value = raw
            cells[idx] = value.strip()
        if cells:
            rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
    return rows


def fetch(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "InvestigacionFilosofica-T2CK/1.0 (+degree-statistics-recon)"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        data = response.read()
    if not data.startswith(b"PK"):
        raise ValueError(f"Control Escolar URL is not XLSX: {url}")
    return data


def signals(row: list[str]) -> list[str]:
    text = normalize(" | ".join(row))
    output = []
    if "filosof" in text:
        output.append("philosophy")
    if "estudios filosof" in text:
        output.append("philosophy-masters")
    if "doctorado en humanidades" in text:
        output.append("humanities-doctorate")
    if "cucsh" in text or "ciencias sociales y humanidades" in text:
        output.append("cucsh")
    return output


def inspect_workbook(year: str, data: bytes) -> dict[str, Any]:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        strings = shared_strings(zf)
        sheets = []
        relevant = []
        for name, path in workbook_sheets(zf):
            rows = parse_sheet(zf, path, strings)
            matches = []
            for row_number, row in enumerate(rows, start=1):
                row_signals = signals(row)
                if row_signals:
                    match = {"row": row_number, "values": row, "signals": row_signals}
                    matches.append(match)
                    relevant.append({"sheet": name, **match})
            sheets.append({
                "name": name,
                "rows": len(rows),
                "sampleRows": rows[:12],
                "relevantRows": matches[:500],
                "relevantCount": len(matches),
            })
    return {
        "year": year,
        "workbookBytes": len(data),
        "sheets": sheets,
        "metrics": {
            "rows": sum(sheet["rows"] for sheet in sheets),
            "relevantRows": len(relevant),
            "philosophyRows": sum("philosophy" in row["signals"] for row in relevant),
            "philosophyMastersRows": sum("philosophy-masters" in row["signals"] for row in relevant),
            "humanitiesDoctorateRows": sum("humanities-doctorate" in row["signals"] for row in relevant),
            "cucshRows": sum("cucsh" in row["signals"] for row in relevant),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    reports = [inspect_workbook(year, fetch(url)) for year, url in FILES.items()]
    payload = {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "referenceOnly": True,
        "rawWorkbooksPersisted": False,
        "files": reports,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({row["year"]: row["metrics"] for row in reports}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

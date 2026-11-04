#!/usr/bin/env python3
"""Fetch official RIUdeG thesis PDFs and produce reproducible primary-source evidence.

This tool is retrieval-only. It does not infer Humanities admission and does not
create work-level decisions. A successful capture requires a real PDF payload
(%PDF magic), then records SHA-256, page count and extracted text metadata.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "Chrome/131 Safari/537.36 InvestigacionFilosofica-T2CB/1.0"
)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def sha256_bytes(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def fetch(url: str, *, accept: str = "*/*", timeout: int = 45) -> tuple[bytes, dict[str, str], str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": accept,
            "Accept-Language": "es-MX,es;q=0.9,en;q=0.7",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
        headers = {k.lower(): v for k, v in response.headers.items()}
        return body, headers, response.geturl()


def is_pdf(blob: bytes, headers: dict[str, str]) -> bool:
    content_type = headers.get("content-type", "").lower()
    return blob.startswith(b"%PDF-") or "application/pdf" in content_type


def normalize_handle_path(handle: str) -> str:
    parsed = urllib.parse.urlparse(handle)
    value = parsed.path.strip("/") if parsed.scheme else handle.strip("/")
    if value.startswith("handle/"):
        value = value[len("handle/") :]
    return value


def viewer_pdf_param(viewer_url: str) -> str | None:
    query = urllib.parse.parse_qs(urllib.parse.urlparse(viewer_url).query)
    values = query.get("pdf") or []
    return values[0] if values else None


def common_candidates(item: dict[str, Any]) -> list[str]:
    viewer = item["primarySourceUrl"]
    pdf_path = viewer_pdf_param(viewer)
    handle_path = normalize_handle_path(item["handle"])
    filename = Path(pdf_path or "").name
    candidates = [viewer]

    if filename:
        encoded_name = urllib.parse.quote(filename)
        encoded_handle = "/".join(
            urllib.parse.quote(part) for part in handle_path.split("/")
        )
        for host in ("https://www.riudg.udg.mx", "https://riudg.udg.mx"):
            candidates.extend(
                [
                    f"{host}/bitstream/{encoded_handle}/1/{encoded_name}",
                    f"{host}/jspui/bitstream/{encoded_handle}/1/{encoded_name}",
                    f"{host}/bitstreams/{encoded_handle}/download",
                ]
            )
        if pdf_path:
            encoded_pdf = urllib.parse.quote(pdf_path, safe="/")
            candidates.extend(
                [
                    "https://www.riudg.udg.mx/visor/pdfjs/pdf.jsp?pdf="
                    + urllib.parse.quote(pdf_path, safe=""),
                    "https://www.riudg.udg.mx/visor/pdfjs/pdf.jsp?in=j&pdf="
                    + urllib.parse.quote(pdf_path, safe=""),
                    "https://www.riudg.udg.mx/visor/pdfjs/getPDF.jsp?pdf="
                    + urllib.parse.quote(pdf_path, safe=""),
                    "https://www.riudg.udg.mx/visor/pdfjs/" + encoded_pdf,
                ]
            )

    seen: set[str] = set()
    result = []
    for url in candidates:
        if url not in seen:
            result.append(url)
            seen.add(url)
    return result


def urls_from_viewer_html(viewer_url: str, blob: bytes) -> list[str]:
    try:
        text = blob.decode("utf-8", errors="replace")
    except Exception:
        return []

    text = html.unescape(text)
    values: list[str] = []

    patterns = [
        r"""(?P<url>https?://[^"'<>\s]+?\.pdf(?:\?[^"'<>\s]*)?)""",
        r"""(?P<url>/[^"'<>\s]+?\.pdf(?:\?[^"'<>\s]*)?)""",
        r"""(?P<url>[^"'<>\s=]+?\.pdf(?:\?[^"'<>\s]*)?)""",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            raw = match.group("url").replace("\\/", "/")
            values.append(urllib.parse.urljoin(viewer_url, raw))

    for key in ("file", "url", "pdf", "download", "source"):
        for match in re.finditer(
            rf"""[?&]?{key}=([^"'&<>\s]+)""",
            text,
            flags=re.IGNORECASE,
        ):
            raw = urllib.parse.unquote(match.group(1))
            if ".pdf" in raw.lower():
                values.append(urllib.parse.urljoin(viewer_url, raw))

    seen: set[str] = set()
    result = []
    for value in values:
        if value not in seen:
            result.append(value)
            seen.add(value)
    return result


def run_pdfinfo(path: Path) -> dict[str, Any]:
    completed = subprocess.run(
        ["pdfinfo", str(path)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    info: dict[str, str] = {}
    for line in completed.stdout.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        info[key.strip()] = value.strip()
    pages = int(info["Pages"]) if info.get("Pages", "").isdigit() else None
    return {
        "pages": pages,
        "title": info.get("Title"),
        "author": info.get("Author"),
        "producer": info.get("Producer"),
        "pdfVersion": info.get("PDF version"),
    }


def extract_text(pdf_path: Path, text_path: Path) -> dict[str, Any]:
    subprocess.run(
        ["pdftotext", "-layout", str(pdf_path), str(text_path)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    blob = text_path.read_bytes()
    return {
        "textSha256": sha256_bytes(blob),
        "textBytes": len(blob),
        "textCharacters": len(blob.decode("utf-8", errors="replace")),
    }


def capture_item(item: dict[str, Any], output_dir: Path) -> dict[str, Any]:
    work_id = item["workId"]
    work_slug = work_id.replace(":", "-")
    work_dir = output_dir / work_slug
    work_dir.mkdir(parents=True, exist_ok=True)

    attempts: list[dict[str, Any]] = []
    candidates = common_candidates(item)

    viewer_url = item["primarySourceUrl"]
    try:
        viewer_blob, viewer_headers, viewer_final = fetch(
            viewer_url,
            accept="text/html,application/pdf;q=0.9,*/*;q=0.8",
        )
        (work_dir / "viewer-response.bin").write_bytes(viewer_blob)
        attempts.append(
            {
                "url": viewer_url,
                "finalUrl": viewer_final,
                "status": "response",
                "contentType": viewer_headers.get("content-type"),
                "bytes": len(viewer_blob),
                "pdfMagic": viewer_blob.startswith(b"%PDF-"),
            }
        )
        if not is_pdf(viewer_blob, viewer_headers):
            candidates.extend(urls_from_viewer_html(viewer_final, viewer_blob))
    except Exception as exc:
        attempts.append(
            {
                "url": viewer_url,
                "status": "error",
                "error": f"{type(exc).__name__}: {exc}",
            }
        )

    seen: set[str] = set()
    ordered = []
    for candidate in candidates:
        if candidate not in seen:
            seen.add(candidate)
            ordered.append(candidate)

    pdf_blob = None
    pdf_headers: dict[str, str] = {}
    pdf_url = None
    final_url = None

    for candidate in ordered:
        if candidate == viewer_url and attempts and attempts[0].get("pdfMagic") is False:
            continue
        try:
            blob, headers, resolved = fetch(
                candidate,
                accept="application/pdf,*/*;q=0.8",
            )
            record = {
                "url": candidate,
                "finalUrl": resolved,
                "status": "response",
                "contentType": headers.get("content-type"),
                "contentLength": headers.get("content-length"),
                "bytes": len(blob),
                "pdfMagic": blob.startswith(b"%PDF-"),
            }
            attempts.append(record)
            if is_pdf(blob, headers) and blob.startswith(b"%PDF-"):
                pdf_blob = blob
                pdf_headers = headers
                pdf_url = candidate
                final_url = resolved
                break
        except urllib.error.HTTPError as exc:
            attempts.append(
                {
                    "url": candidate,
                    "status": "http-error",
                    "httpStatus": exc.code,
                    "error": str(exc),
                }
            )
        except Exception as exc:
            attempts.append(
                {
                    "url": candidate,
                    "status": "error",
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

    write_json(work_dir / "fetch-attempts.json", attempts)

    if pdf_blob is None:
        return {
            "workId": work_id,
            "handle": item["handle"],
            "captureStatus": "unresolved",
            "viewerUrl": viewer_url,
            "attempts": attempts,
        }

    filename = Path(viewer_pdf_param(viewer_url) or "primary-source.pdf").name
    pdf_path = work_dir / filename
    pdf_path.write_bytes(pdf_blob)

    info = run_pdfinfo(pdf_path)
    text_path = work_dir / "primary-source.txt"
    text_meta = extract_text(pdf_path, text_path)

    capture = {
        "workId": work_id,
        "handle": item["handle"],
        "captureStatus": "captured",
        "sourceUrl": pdf_url,
        "finalUrl": final_url,
        "contentType": pdf_headers.get("content-type"),
        "filename": filename,
        "bytes": len(pdf_blob),
        "sha256": sha256_bytes(pdf_blob),
        **info,
        **text_meta,
    }
    write_json(work_dir / "capture.json", capture)
    return capture


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    batch = read_json(args.batch)
    works = batch.get("works") or []
    if not works:
        raise ValueError("Batch has no works")

    captures = [capture_item(item, args.output_dir) for item in works]
    summary = {
        "schemaVersion": "riudg-primary-source-capture-v1",
        "batchId": batch.get("batchId"),
        "phase": "T2CB",
        "captures": captures,
        "captured": sum(item["captureStatus"] == "captured" for item in captures),
        "unresolved": sum(item["captureStatus"] != "captured" for item in captures),
        "admissionChangeRequested": False,
    }
    write_json(args.output_dir / "capture-summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))

    if summary["unresolved"]:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

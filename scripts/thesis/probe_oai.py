#!/usr/bin/env python3
"""Read-only OAI-PMH reconnaissance for UdeG thesis repositories.

This script deliberately performs only protocol discovery and a single-record
sample. It never follows ListRecords/ListIdentifiers resumption tokens and it
never downloads thesis files.

Output is a deterministic JSON report suitable for CI artifacts.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any

NS = {"oai": "http://www.openarchives.org/OAI/2.0/"}
USER_AGENT = "InvestigacionFilosofica-ThesisRecon/1.0 (+https://github.com/kychan00/InvestigacionFilosofica)"
TIMEOUT = 25
MAX_SAMPLE_VALUE = 240

CANDIDATES = {
    "riudg": [
        "https://www.riudg.udg.mx/oai/request",
        "https://riudg.udg.mx/oai/request",
        "https://www.riudg.udg.mx/server/oai/request",
        "https://riudg.udg.mx/server/oai/request",
        "https://www.riudg.udg.mx/dspace-oai/request",
        "https://riudg.udg.mx/dspace-oai/request",
    ],
    "udgvirtual": [
        "https://biblioteca.udgvirtual.udg.mx/oai/request",
        "https://biblioteca.udgvirtual.udg.mx/jspui/oai/request",
        "https://biblioteca.udgvirtual.udg.mx/server/oai/request",
        "http://biblioteca.udgvirtual.udg.mx/oai/request",
    ],
}


@dataclass
class Fetch:
    url: str
    status: int | None
    content_type: str | None
    body: bytes | None
    error: str | None
    elapsed_ms: int


def fetch(base: str, **params: str) -> Fetch:
    query = urllib.parse.urlencode(params)
    url = f"{base}?{query}" if query else base
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.1",
        },
    )
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            body = response.read()
            return Fetch(
                url=response.geturl(),
                status=response.status,
                content_type=response.headers.get("Content-Type"),
                body=body,
                error=None,
                elapsed_ms=round((time.monotonic() - started) * 1000),
            )
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read()
        except Exception:
            body = None
        return Fetch(
            url=url,
            status=exc.code,
            content_type=exc.headers.get("Content-Type") if exc.headers else None,
            body=body,
            error=f"HTTPError: {exc}",
            elapsed_ms=round((time.monotonic() - started) * 1000),
        )
    except Exception as exc:
        return Fetch(
            url=url,
            status=None,
            content_type=None,
            body=None,
            error=f"{type(exc).__name__}: {exc}",
            elapsed_ms=round((time.monotonic() - started) * 1000),
        )


def parse_oai(result: Fetch) -> tuple[ET.Element | None, dict[str, Any]]:
    info = {
        "url": result.url,
        "status": result.status,
        "content_type": result.content_type,
        "elapsed_ms": result.elapsed_ms,
        "transport_error": result.error,
        "xml": False,
        "oai_error": None,
    }
    if not result.body:
        return None, info
    try:
        root = ET.fromstring(result.body)
    except ET.ParseError as exc:
        info["parse_error"] = str(exc)
        info["body_prefix"] = result.body[:300].decode("utf-8", "replace")
        return None, info

    info["xml"] = True
    err = root.find("oai:error", NS)
    if err is not None:
        info["oai_error"] = {
            "code": err.attrib.get("code"),
            "message": (err.text or "").strip(),
        }
    return root, info


def text(root: ET.Element, path: str) -> str | None:
    node = root.find(path, NS)
    if node is None or node.text is None:
        return None
    value = node.text.strip()
    return value or None


def discover_endpoint(name: str, candidates: list[str]) -> tuple[str | None, list[dict[str, Any]]]:
    attempts = []
    for base in candidates:
        result = fetch(base, verb="Identify")
        root, info = parse_oai(result)
        valid = (
            root is not None
            and root.tag == "{http://www.openarchives.org/OAI/2.0/}OAI-PMH"
            and info["oai_error"] is None
            and root.find("oai:Identify", NS) is not None
        )
        info["candidate"] = base
        info["valid_identify"] = valid
        attempts.append(info)
        if valid:
            return base, attempts
    return None, attempts


def identify(base: str) -> dict[str, Any]:
    root, info = parse_oai(fetch(base, verb="Identify"))
    if root is None:
        return info
    return {
        **info,
        "repository_name": text(root, "oai:Identify/oai:repositoryName"),
        "base_url": text(root, "oai:Identify/oai:baseURL"),
        "protocol_version": text(root, "oai:Identify/oai:protocolVersion"),
        "admin_emails": [
            (node.text or "").strip()
            for node in root.findall("oai:Identify/oai:adminEmail", NS)
            if (node.text or "").strip()
        ],
        "earliest_datestamp": text(root, "oai:Identify/oai:earliestDatestamp"),
        "deleted_record": text(root, "oai:Identify/oai:deletedRecord"),
        "granularity": text(root, "oai:Identify/oai:granularity"),
        "compressions": [
            (node.text or "").strip()
            for node in root.findall("oai:Identify/oai:compression", NS)
            if (node.text or "").strip()
        ],
    }


def metadata_formats(base: str) -> dict[str, Any]:
    root, info = parse_oai(fetch(base, verb="ListMetadataFormats"))
    if root is None:
        return {**info, "formats": []}
    formats = []
    for item in root.findall("oai:ListMetadataFormats/oai:metadataFormat", NS):
        formats.append(
            {
                "metadata_prefix": text(item, "oai:metadataPrefix"),
                "schema": text(item, "oai:schema"),
                "namespace": text(item, "oai:metadataNamespace"),
            }
        )
    return {**info, "formats": formats}


def list_sets_first_page(base: str) -> dict[str, Any]:
    root, info = parse_oai(fetch(base, verb="ListSets"))
    if root is None:
        return {**info, "sets": [], "resumption_token": None}
    sets = []
    for item in root.findall("oai:ListSets/oai:set", NS):
        sets.append(
            {
                "set_spec": text(item, "oai:setSpec"),
                "set_name": text(item, "oai:setName"),
            }
        )
    token = root.find("oai:ListSets/oai:resumptionToken", NS)
    return {
        **info,
        "sets": sets,
        "resumption_token": {
            "value": (token.text or "").strip() if token is not None else None,
            "cursor": token.attrib.get("cursor") if token is not None else None,
            "complete_list_size": token.attrib.get("completeListSize") if token is not None else None,
            "expiration_date": token.attrib.get("expirationDate") if token is not None else None,
        }
        if token is not None
        else None,
    }


def list_identifiers_first_page(base: str, metadata_prefix: str = "oai_dc") -> dict[str, Any]:
    root, info = parse_oai(
        fetch(base, verb="ListIdentifiers", metadataPrefix=metadata_prefix)
    )
    if root is None:
        return {**info, "headers": [], "resumption_token": None}

    headers = []
    for header in root.findall("oai:ListIdentifiers/oai:header", NS):
        headers.append(
            {
                "identifier": text(header, "oai:identifier"),
                "datestamp": text(header, "oai:datestamp"),
                "status": header.attrib.get("status"),
                "set_specs": [
                    (node.text or "").strip()
                    for node in header.findall("oai:setSpec", NS)
                    if (node.text or "").strip()
                ],
            }
        )

    token = root.find("oai:ListIdentifiers/oai:resumptionToken", NS)
    return {
        **info,
        "headers": headers,
        "resumption_token": {
            "value_present": bool(token is not None and (token.text or "").strip()),
            "cursor": token.attrib.get("cursor") if token is not None else None,
            "complete_list_size": token.attrib.get("completeListSize") if token is not None else None,
            "expiration_date": token.attrib.get("expirationDate") if token is not None else None,
        }
        if token is not None
        else None,
    }


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def sample_metadata(base: str, identifier: str, metadata_prefix: str) -> dict[str, Any]:
    root, info = parse_oai(
        fetch(
            base,
            verb="GetRecord",
            identifier=identifier,
            metadataPrefix=metadata_prefix,
        )
    )
    if root is None:
        return {**info, "identifier": identifier, "metadata_prefix": metadata_prefix}

    metadata = root.find("oai:GetRecord/oai:record/oai:metadata", NS)
    signatures: dict[str, dict[str, Any]] = {}
    if metadata is not None:
        for node in metadata.iter():
            if node is metadata:
                continue
            attrs = {str(k): str(v) for k, v in sorted(node.attrib.items())}
            key = local_name(node.tag)
            if attrs:
                key += "|" + "|".join(f"{k}={v}" for k, v in attrs.items())
            value = (node.text or "").strip()
            if key not in signatures:
                signatures[key] = {
                    "tag": node.tag,
                    "attributes": attrs,
                    "example": value[:MAX_SAMPLE_VALUE] if value else None,
                }

    return {
        **info,
        "identifier": identifier,
        "metadata_prefix": metadata_prefix,
        "field_signatures": list(signatures.values()),
    }


def inspect_repository(name: str, candidates: list[str]) -> dict[str, Any]:
    base, attempts = discover_endpoint(name, candidates)
    report: dict[str, Any] = {
        "repository_key": name,
        "candidate_attempts": attempts,
        "selected_endpoint": base,
    }
    if not base:
        report["status"] = "endpoint-not-found"
        return report

    report["status"] = "identified"
    report["identify"] = identify(base)
    report["metadata_formats"] = metadata_formats(base)
    report["sets_first_page"] = list_sets_first_page(base)

    prefixes = [
        item.get("metadata_prefix")
        for item in report["metadata_formats"].get("formats", [])
        if item.get("metadata_prefix")
    ]
    preferred = "oai_dc" if "oai_dc" in prefixes else (prefixes[0] if prefixes else None)

    if preferred:
        ids = list_identifiers_first_page(base, preferred)
        report["identifiers_first_page"] = ids
        first = next(
            (
                item["identifier"]
                for item in ids.get("headers", [])
                if item.get("identifier") and item.get("status") != "deleted"
            ),
            None,
        )
        if first:
            sample_prefixes = [
                prefix
                for prefix in ("oai_dc", "dim", "xoai", "qdc")
                if prefix in prefixes
            ]
            if not sample_prefixes:
                sample_prefixes = [preferred]
            report["sample_records"] = [
                sample_metadata(base, first, prefix)
                for prefix in sample_prefixes
            ]

    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="-", help="JSON output path or - for stdout")
    args = parser.parse_args()

    report = {
        "schema_version": "thesis-source-recon-v1",
        "read_only": True,
        "limits": {
            "follows_resumption_tokens": False,
            "downloads_thesis_files": False,
            "samples_per_repository": 1,
        },
        "repositories": {
            name: inspect_repository(name, candidates)
            for name, candidates in CANDIDATES.items()
        },
    }

    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output == "-":
        sys.stdout.write(payload)
    else:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(payload)

    # Reconnaissance can legitimately find a broken/moved endpoint. The workflow
    # should still upload the report so the failure is inspectable.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

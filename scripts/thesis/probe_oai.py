#!/usr/bin/env python3
"""Read-only OAI-PMH reconnaissance for UdeG thesis repositories.

This script performs protocol discovery, set discovery and a small thesis-record
sample. It may follow ListSets resumption tokens so the repository topology can
be characterized. If a small repository advertises a thesis set but set-filtered
ListIdentifiers is broken, it may scan only OAI headers from the general
ListIdentifiers stream to recover thesis membership. It never downloads thesis
files.

Output is a deterministic JSON report suitable for CI artifacts.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any

NS = {"oai": "http://www.openarchives.org/OAI/2.0/"}
USER_AGENT = "InvestigacionFilosofica-ThesisRecon/1.1 (+https://github.com/kychan00/InvestigacionFilosofica)"
TIMEOUT = 25
MAX_SAMPLE_VALUE = 240
MAX_SET_PAGES = 10
MAX_HEADER_FALLBACK_PAGES = 40
MAX_HEADER_FALLBACK_UNIVERSE = 5000

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

REPRESENTATIVE_THESIS_IDS = {
    "riudg": "oai:riudg.udg.mx:20.500.12104/112380",
    "udgvirtual": "oai:biblioteca.udgvirtual.udg.mx:123456789/4102",
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


def set_page(root: ET.Element) -> tuple[list[dict[str, str | None]], ET.Element | None]:
    sets = []
    for item in root.findall("oai:ListSets/oai:set", NS):
        sets.append(
            {
                "set_spec": text(item, "oai:setSpec"),
                "set_name": text(item, "oai:setName"),
            }
        )
    return sets, root.find("oai:ListSets/oai:resumptionToken", NS)


def list_sets(base: str) -> dict[str, Any]:
    pages: list[dict[str, Any]] = []
    all_sets: list[dict[str, str | None]] = []
    token_value: str | None = None
    complete_list_size: str | None = None

    for page_number in range(MAX_SET_PAGES):
        if token_value is None:
            result = fetch(base, verb="ListSets")
        else:
            result = fetch(base, verb="ListSets", resumptionToken=token_value)

        root, info = parse_oai(result)
        if root is None or info["oai_error"] is not None:
            pages.append({"page": page_number + 1, **info})
            break

        sets, token = set_page(root)
        all_sets.extend(sets)

        next_token = (token.text or "").strip() if token is not None else ""
        if token is not None and complete_list_size is None:
            complete_list_size = token.attrib.get("completeListSize")

        pages.append(
            {
                "page": page_number + 1,
                "count": len(sets),
                "cursor": token.attrib.get("cursor") if token is not None else None,
                "complete_list_size": token.attrib.get("completeListSize") if token is not None else None,
                "token_present": bool(next_token),
                "status": info["status"],
                "elapsed_ms": info["elapsed_ms"],
            }
        )

        if not next_token:
            token_value = None
            break
        token_value = next_token

    return {
        "sets": all_sets,
        "pages": pages,
        "complete_list_size": complete_list_size or str(len(all_sets)),
        "truncated": bool(token_value),
    }


def find_thesis_set(sets: list[dict[str, str | None]]) -> dict[str, str | None] | None:
    exact = [
        item for item in sets
        if (item.get("set_name") or "").strip().casefold() == "tesis"
    ]
    if exact:
        return exact[0]
    candidates = [
        item for item in sets
        if "tesis" in (item.get("set_name") or "").strip().casefold()
        and "otras universidades" not in (item.get("set_name") or "").strip().casefold()
    ]
    return candidates[0] if candidates else None


def list_identifiers_first_page(
    base: str,
    metadata_prefix: str = "oai_dc",
    set_spec: str | None = None,
) -> dict[str, Any]:
    params = {"verb": "ListIdentifiers", "metadataPrefix": metadata_prefix}
    if set_spec:
        params["set"] = set_spec
    root, info = parse_oai(fetch(base, **params))
    if root is None:
        return {**info, "headers": [], "resumption_token": None, "set_spec": set_spec}

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
        "set_spec": set_spec,
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


def scan_headers_for_set(
    base: str,
    metadata_prefix: str,
    set_spec: str,
    first_page: dict[str, Any],
) -> dict[str, Any]:
    """Fallback for small repositories whose set-filtered endpoint is broken.

    Only OAI headers are traversed. Metadata bodies are not requested.
    """
    universe_token = first_page.get("resumption_token") or {}
    universe_size_raw = universe_token.get("complete_list_size")
    try:
        universe_size = int(universe_size_raw) if universe_size_raw is not None else None
    except (TypeError, ValueError):
        universe_size = None

    if universe_size is None or universe_size > MAX_HEADER_FALLBACK_UNIVERSE:
        return {
            "used": False,
            "reason": "universe-too-large-or-unknown",
            "complete_list_size": universe_size,
            "matching_headers": [],
        }

    matching = [
        header
        for header in first_page.get("headers", [])
        if set_spec in header.get("set_specs", [])
    ]
    pages = 1
    token_value = None

    root, _ = parse_oai(fetch(base, verb="ListIdentifiers", metadataPrefix=metadata_prefix))
    if root is not None:
        token = root.find("oai:ListIdentifiers/oai:resumptionToken", NS)
        token_value = (token.text or "").strip() if token is not None else ""

    while token_value and pages < MAX_HEADER_FALLBACK_PAGES:
        root, info = parse_oai(
            fetch(base, verb="ListIdentifiers", resumptionToken=token_value)
        )
        pages += 1
        if root is None or info["oai_error"] is not None:
            return {
                "used": True,
                "complete": False,
                "pages": pages,
                "complete_list_size": universe_size,
                "matching_headers": matching,
                "failure": info,
            }

        for header in root.findall("oai:ListIdentifiers/oai:header", NS):
            item = {
                "identifier": text(header, "oai:identifier"),
                "datestamp": text(header, "oai:datestamp"),
                "status": header.attrib.get("status"),
                "set_specs": [
                    (node.text or "").strip()
                    for node in header.findall("oai:setSpec", NS)
                    if (node.text or "").strip()
                ],
            }
            if set_spec in item["set_specs"]:
                matching.append(item)

        token = root.find("oai:ListIdentifiers/oai:resumptionToken", NS)
        token_value = (token.text or "").strip() if token is not None else ""

    return {
        "used": True,
        "complete": not bool(token_value),
        "pages": pages,
        "complete_list_size": universe_size,
        "matching_count": len(matching),
        "matching_headers": matching,
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


def compact_fetch(result: Fetch) -> dict[str, Any]:
    return {
        "url": result.url,
        "status": result.status,
        "content_type": result.content_type,
        "elapsed_ms": result.elapsed_ms,
        "transport_error": result.error,
        "body_prefix": (
            result.body[:300].decode("utf-8", "replace")
            if result.body
            else None
        ),
    }


def inspect_udgvirtual_html() -> dict[str, Any]:
    collection = "https://biblioteca.udgvirtual.udg.mx/jspui/handle/123456789/6"
    item = "https://biblioteca.udgvirtual.udg.mx/jspui/handle/123456789/4102"

    first = fetch(collection)
    second = fetch(collection, offset="20")
    normal = fetch(item)
    full = fetch(item, mode="full")

    def html_info(result: Fetch) -> dict[str, Any]:
        info = compact_fetch(result)
        body = result.body.decode("utf-8", "replace") if result.body else ""
        handles = sorted(set(
            re.findall(r"/jspui/handle/123456789/(\\d+)", body)
        ))
        total_match = re.search(
            r"(?:of|de)\\s+([0-9][0-9,]*)",
            re.sub(r"<[^>]+>", " ", body),
            flags=re.IGNORECASE,
        )
        info.update({
            "handle_ids": handles[:50],
            "handle_count": len(handles),
            "reported_total": total_match.group(1) if total_match else None,
            "contains_thesis_collection_label": bool(
                re.search(r"\\bTesis\\b", body, flags=re.IGNORECASE)
            ),
        })
        return info

    full_body = full.body.decode("utf-8", "replace") if full.body else ""
    normal_body = normal.body.decode("utf-8", "replace") if normal.body else ""
    dc_fields = sorted(set(
        re.findall(r"dc\\.[a-zA-Z0-9_.-]+", full_body)
    ))

    return {
        "collection_page_1": html_info(first),
        "collection_page_2": html_info(second),
        "representative_item": {
            **html_info(normal),
            "contains_director_marker": bool(
                re.search(r"director(?:a)? de tesis", normal_body, flags=re.IGNORECASE)
            ),
            "contains_udg": "Universidad de Guadalajara" in normal_body,
            "contains_degree_description": bool(
                re.search(r"Documento de titulaci[oó]n", normal_body, flags=re.IGNORECASE)
            ),
        },
        "representative_item_full": {
            **html_info(full),
            "dc_fields": dc_fields,
            "dc_field_count": len(dc_fields),
        },
    }


def inspect_udgvirtual_rest() -> dict[str, Any]:
    bases = [
        ("status", "https://biblioteca.udgvirtual.udg.mx/rest/status", {}),
        (
            "handle",
            "https://biblioteca.udgvirtual.udg.mx/rest/handle/123456789/4102",
            {},
        ),
        (
            "items",
            "https://biblioteca.udgvirtual.udg.mx/rest/items",
            {"limit": "1"},
        ),
    ]
    return {
        name: compact_fetch(fetch(url, **params))
        for name, url, params in bases
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
    report["sets"] = list_sets(base)

    thesis_set = find_thesis_set(report["sets"].get("sets", []))
    report["thesis_set"] = thesis_set

    prefixes = [
        item.get("metadata_prefix")
        for item in report["metadata_formats"].get("formats", [])
        if item.get("metadata_prefix")
    ]
    preferred = "oai_dc" if "oai_dc" in prefixes else (prefixes[0] if prefixes else None)

    if preferred:
        general_ids = list_identifiers_first_page(base, preferred)
        report["identifiers_first_page"] = general_ids

        thesis_ids = list_identifiers_first_page(
            base,
            preferred,
            thesis_set.get("set_spec") if thesis_set else None,
        )
        report["thesis_identifiers_first_page"] = thesis_ids

        thesis_headers = thesis_ids.get("headers", [])
        set_query_failed = (
            thesis_set is not None
            and (
                thesis_ids.get("status") != 200
                or thesis_ids.get("transport_error")
                or thesis_ids.get("oai_error")
            )
        )

        if set_query_failed:
            fallback = scan_headers_for_set(
                base,
                preferred,
                thesis_set["set_spec"],
                general_ids,
            )
            report["thesis_header_fallback_scan"] = fallback
            if fallback.get("complete"):
                thesis_headers = fallback.get("matching_headers", [])

        fixture_id = REPRESENTATIVE_THESIS_IDS.get(name)
        known_ids = {
            item.get("identifier")
            for item in thesis_headers
            if item.get("identifier") and item.get("status") != "deleted"
        }

        if fixture_id:
            first = fixture_id
            report["thesis_sample_selection"] = {
                "mode": "curated-public-fixture",
                "identifier": fixture_id,
                "observed_in_enumerated_thesis_headers": fixture_id in known_ids,
            }
        else:
            first = next(
                (
                    item["identifier"]
                    for item in thesis_headers
                    if item.get("identifier") and item.get("status") != "deleted"
                ),
                None,
            )
            report["thesis_sample_selection"] = {
                "mode": "first-enumerated-thesis-header",
                "identifier": first,
            }

        if first:
            sample_prefixes = [
                prefix
                for prefix in (
                    "oai_dc",
                    "dim",
                    "xoai",
                    "qdc",
                    "uketd_dc",
                    "etdms",
                    "mods",
                )
                if prefix in prefixes
            ]
            if not sample_prefixes:
                sample_prefixes = [preferred]
            report["thesis_sample_identifier"] = first
            report["thesis_sample_records"] = [
                sample_metadata(base, first, prefix)
                for prefix in sample_prefixes
            ]

    if name == "udgvirtual":
        report["html_fallback"] = inspect_udgvirtual_html()
        report["rest_fallback"] = inspect_udgvirtual_rest()

    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="-", help="JSON output path or - for stdout")
    args = parser.parse_args()

    report = {
        "schema_version": "thesis-source-recon-v1.3",
        "read_only": True,
        "limits": {
            "follows_set_resumption_tokens": True,
            "max_set_pages": MAX_SET_PAGES,
            "record_resumption_policy": "header-only fallback for small broken set endpoints",
            "max_header_fallback_pages": MAX_HEADER_FALLBACK_PAGES,
            "max_header_fallback_universe": MAX_HEADER_FALLBACK_UNIVERSE,
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

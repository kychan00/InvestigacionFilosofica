#!/usr/bin/env python3
"""Canonical corpus builder for UdeG Humanities theses (T2 foundation).

This module is intentionally conservative:
- it preserves raw source values;
- it admits a thesis only through a program authority registry;
- it never uses semantic similarity for Humanities admission;
- it never treats a director as an author;
- it merges records automatically only on an exact persistent identifier.

It uses only the Python standard library.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


OAI = "http://www.openarchives.org/OAI/2.0/"
DIM = "http://www.dspace.org/xmlns/dspace/dim"

RIUDG_ENDPOINT = "https://riudg.udg.mx/oai/request"
UDGVIRTUAL_ITEM = (
    "https://biblioteca.udgvirtual.udg.mx/jspui/handle/123456789/{handle}"
)

USER_AGENT = (
    "InvestigacionFilosofica-ThesisCanonicalCorpus/1.0 "
    "(+https://github.com/kychan00/InvestigacionFilosofica)"
)

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REGISTRY = ROOT / "scripts" / "thesis" / "config" / "program-authority-v1.json"
DEFAULT_RIUDG_FIXTURE = ROOT / "scripts" / "thesis" / "fixtures" / "riudg-history-dim.xml"
DEFAULT_UDGVIRTUAL_FIXTURE = ROOT / "scripts" / "thesis" / "fixtures" / "udgvirtual-philosophy.html"


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = html.unescape(str(value))
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def normalize_key(value: Any) -> str:
    text = clean_text(value) or ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.casefold()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def payload_hash(value: str) -> str:
    return "sha256:" + stable_hash(value)


def first(values: list[str] | None) -> str | None:
    return values[0] if values else None


def unique_strings(values: list[str] | None) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        clean = clean_text(value)
        if not clean:
            continue
        key = normalize_key(clean)
        if not key or key in seen:
            continue
        seen.add(key)
        output.append(clean)
    return output


def normalize_language(value: str | None) -> str | None:
    key = normalize_key(value)
    return {
        "spa": "es",
        "es": "es",
        "spanish": "es",
        "eng": "en",
        "en": "en",
        "english": "en",
        "fra": "fr",
        "fre": "fr",
        "fr": "fr",
        "deu": "de",
        "ger": "de",
        "de": "de",
    }.get(key, clean_text(value))


def normalize_handle(value: str | None) -> str | None:
    text = clean_text(value)
    if not text:
        return None

    match = re.search(
        r"(?:hdl\.handle\.net/|handle/)([0-9.]+/[A-Za-z0-9._-]+)",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1)

    match = re.search(r"\b(20\.500\.12104/[A-Za-z0-9._-]+)\b", text)
    if match:
        return match.group(1)

    match = re.search(r"\b(123456789/[A-Za-z0-9._-]+)\b", text)
    if match:
        return match.group(1)

    return None


def date_info(raw: str | None, reference_year: int | None = None) -> dict[str, Any]:
    raw = clean_text(raw)
    if not raw:
        return {
            "raw": None,
            "value": None,
            "precision": "unknown",
            "quality": "unknown",
        }

    reference_year = reference_year or datetime.now(timezone.utc).year

    numeric_only = re.fullmatch(r"\d{5,}", raw)
    if numeric_only:
        return {
            "raw": raw,
            "value": None,
            "precision": "unknown",
            "quality": "suspicious",
        }

    iso = re.fullmatch(r"(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?", raw)
    if iso:
        year = int(iso.group(1))
        month = int(iso.group(2)) if iso.group(2) else None
        day = int(iso.group(3)) if iso.group(3) else None

        # Historical DSpace metadata may encode unknown components as 00.
        # Preserve the raw value while lowering precision instead of inventing
        # month/day values.
        if month == 0 and (day is None or day == 0):
            month = None
            day = None
        elif month not in (None, 0) and day == 0:
            day = None
        elif month == 0 and day not in (None, 0):
            return {
                "raw": raw,
                "value": None,
                "precision": "unknown",
                "quality": "invalid",
            }

        try:
            if day is not None:
                datetime(year, month or 1, day)
                precision = "day"
                value = f"{year:04d}-{month:02d}-{day:02d}"
            elif month is not None:
                if month < 1 or month > 12:
                    raise ValueError("invalid month")
                precision = "month"
                value = f"{year:04d}-{month:02d}"
            else:
                precision = "year"
                value = f"{year:04d}"
        except ValueError:
            return {
                "raw": raw,
                "value": None,
                "precision": "unknown",
                "quality": "invalid",
            }

        quality = "valid"
        if year < 1800 or year > reference_year + 1:
            quality = "suspicious"

        return {
            "raw": raw,
            "value": value,
            "precision": precision,
            "quality": quality,
        }

    dmy = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw)
    if dmy:
        day = int(dmy.group(1))
        month = int(dmy.group(2))
        year = int(dmy.group(3))
        try:
            datetime(year, month, day)
        except ValueError:
            return {
                "raw": raw,
                "value": None,
                "precision": "unknown",
                "quality": "invalid",
            }

        quality = "valid"
        if year < 1800 or year > reference_year + 1:
            quality = "suspicious"

        return {
            "raw": raw,
            "value": f"{year:04d}-{month:02d}-{day:02d}",
            "precision": "day",
            "quality": quality,
        }

    return {
        "raw": raw,
        "value": None,
        "precision": "unknown",
        "quality": "invalid",
    }


def load_program_registry(path: str | Path = DEFAULT_REGISTRY) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if payload.get("schemaVersion") != "thesis-humanities-program-authority-v1":
        raise ValueError("Unsupported program authority registry")

    allowed_admission_states = {"include", "review", "exclude"}
    ids: set[str] = set()
    for program in payload.get("programs", []):
        program_id = program.get("id")
        if not program_id:
            raise ValueError("Program authority without id")
        if program_id in ids:
            raise ValueError(f"Duplicate program authority id: {program_id}")
        ids.add(program_id)

        state = program.get("admissionState")
        if state not in allowed_admission_states:
            raise ValueError(
                f"Unsupported program admissionState for {program_id}: {state}"
            )

        if not program.get("canonicalName"):
            raise ValueError(f"Program authority without canonicalName: {program_id}")

        if not program.get("evidence"):
            raise ValueError(f"Program authority without evidence: {program_id}")

    return payload


def build_program_index(registry: dict[str, Any]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for program in registry.get("programs", []):
        for label in [program.get("canonicalName"), *(program.get("aliases") or [])]:
            key = normalize_key(label)
            if not key:
                continue
            previous = index.get(key)
            if previous and previous["id"] != program["id"]:
                raise ValueError(f"Program alias collision: {label}")
            index[key] = program
    return index


def resolve_program(
    raw_program: str | None,
    registry: dict[str, Any],
) -> dict[str, Any]:
    raw = clean_text(raw_program)
    if not raw:
        return {
            "raw": None,
            "status": "unresolved",
            "programRef": None,
            "canonicalName": None,
        }

    index = build_program_index(registry)
    program = index.get(normalize_key(raw))
    if not program:
        return {
            "raw": raw,
            "status": "unknown",
            "programRef": None,
            "canonicalName": None,
        }

    return {
        "raw": raw,
        "status": "confirmed",
        "programRef": program["id"],
        "canonicalName": program["canonicalName"],
        "level": program.get("level"),
        "disciplineFamily": program.get("disciplineFamily"),
        "admissionState": program.get("admissionState"),
    }


def classify_source_type(value: str | None) -> dict[str, str]:
    raw = clean_text(value)
    key = normalize_key(raw)

    if not key:
        return {"raw": raw or "", "status": "unknown"}

    if "tesis" in key or "thesis" in key:
        return {"raw": raw or "", "status": "thesis"}

    rejected_prefixes = (
        "book chapter",
        "capitulo de libro",
        "articulo",
        "article",
        "libro",
        "book",
        "ponencia",
        "conference",
        "manual",
    )
    if any(key.startswith(prefix) for prefix in rejected_prefixes):
        return {"raw": raw or "", "status": "non-thesis"}

    return {"raw": raw or "", "status": "unknown"}


def looks_like_institution(value: str | None) -> bool:
    key = normalize_key(value)
    if not key:
        return False
    markers = (
        "universidad ",
        "university ",
        "instituto ",
        "institute ",
        "centro universitario ",
        "college ",
        "escuela ",
    )
    return key.startswith(markers)


def resolve_institution(
    values: list[str],
    registry: dict[str, Any],
) -> dict[str, Any]:
    clean_values = unique_strings(values)
    institution = registry.get("institution") or {}
    aliases = {
        normalize_key(value)
        for value in [
            institution.get("canonicalName"),
            *(institution.get("aliases") or []),
        ]
        if value
    }

    for value in clean_values:
        normalized = normalize_key(value)
        if normalized in aliases or "universidad de guadalajara" in normalized:
            return {
                "status": "confirmed",
                "institutionRef": institution.get("id"),
                "canonicalName": institution.get("canonicalName"),
                "raw": value,
            }

    for value in clean_values:
        normalized = normalize_key(value)
        if "universidad " in normalized or normalized.startswith("universidad "):
            return {
                "status": "external",
                "institutionRef": None,
                "canonicalName": value,
                "raw": value,
            }

    return {
        "status": "unresolved",
        "institutionRef": None,
        "canonicalName": None,
        "raw": first(clean_values),
    }


def admission_decision(
    *,
    source_record_id: str,
    institution: dict[str, Any],
    program: dict[str, Any],
    source_type: dict[str, str] | None = None,
    policy_version: str = "humanities-admission-v1",
) -> dict[str, Any]:
    source_type = source_type or {"status": "unknown"}

    if source_type.get("status") == "non-thesis":
        status = "reject-source"
        code = "not-a-thesis"
    elif institution["status"] == "external":
        status = "exclude"
        code = "external-institution"
    elif institution["status"] != "confirmed":
        status = "quarantine"
        code = "unresolved-institution"
    elif program["status"] == "confirmed" and program.get("admissionState") == "include":
        status = "include"
        code = "confirmed-humanities-program"
    elif program["status"] == "confirmed" and program.get("admissionState") == "review":
        status = "review"
        code = "program-review"
    elif program["status"] == "confirmed" and program.get("admissionState") == "exclude":
        status = "exclude"
        code = "non-humanities-program"
    elif program["status"] == "confirmed":
        status = "quarantine"
        code = "unsupported-program-admission-state"
    elif program["status"] == "unknown":
        status = "quarantine"
        code = "unknown-program"
    else:
        status = "quarantine"
        code = "insufficient-program-metadata"

    return {
        "id": "admission:" + stable_hash(source_record_id + "|" + policy_version)[:20],
        "sourceRecordRef": source_record_id,
        "status": status,
        "explanationCode": code,
        "programRef": program.get("programRef"),
        "institutionRef": institution.get("institutionRef"),
        "policyVersion": policy_version,
        "decisionMode": "deterministic",
    }


def contribution(role: str, raw_name: str, source_ref: str, position: int) -> dict[str, Any]:
    clean = clean_text(raw_name) or ""
    return {
        "id": "contribution:" + stable_hash(
            f"{source_ref}|{role}|{position}|{normalize_key(clean)}"
        )[:20],
        "role": role,
        "rawName": clean,
        "normalizedName": normalize_key(clean),
        "sourceRecordRef": source_ref,
        "position": position,
        "resolutionState": "unresolved",
    }


def parse_role_from_contributor(value: str) -> tuple[str, str]:
    clean = clean_text(value) or ""
    match = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", clean)
    if not match:
        return "unknown-thesis-role", clean

    name = clean_text(match.group(1)) or clean
    label = normalize_key(match.group(2))

    if "codirect" in label:
        return "thesis-codirector", name
    if "director" in label:
        return "thesis-director", name
    if "asesor" in label or "advisor" in label:
        return "thesis-advisor", name
    return "unknown-thesis-role", name


def source_record(
    *,
    provider: str,
    provider_record_id: str,
    source_url: str | None,
    raw_fields: dict[str, list[str]],
    raw_payload: str,
    sets: list[str] | None = None,
    datestamp: str | None = None,
) -> dict[str, Any]:
    return {
        "id": f"source:thesis:{provider}:{stable_hash(provider_record_id)[:20]}",
        "provider": provider,
        "providerRecordId": provider_record_id,
        "recordUrl": source_url,
        "datestamp": clean_text(datestamp),
        "setSpecs": unique_strings(sets),
        "rawFields": {
            key: unique_strings(values)
            for key, values in sorted(raw_fields.items())
            if unique_strings(values)
        },
        "payloadHash": payload_hash(raw_payload),
        "normalizationVersion": "thesis-source-normalizer-v1",
    }


def parse_riudg_dim(
    xml_text: str,
    *,
    source_url: str | None = None,
) -> dict[str, Any]:
    root = ET.fromstring(xml_text)
    ns = {"oai": OAI, "dim": DIM}

    header = root.find(".//oai:header", ns)
    identifier = (
        clean_text(header.findtext("oai:identifier", default="", namespaces=ns))
        if header is not None
        else None
    )
    datestamp = (
        clean_text(header.findtext("oai:datestamp", default="", namespaces=ns))
        if header is not None
        else None
    )
    sets = (
        [
            node.text or ""
            for node in header.findall("oai:setSpec", ns)
        ]
        if header is not None
        else []
    )

    fields: dict[str, list[str]] = {}
    for node in root.findall(".//dim:field", ns):
        schema = node.attrib.get("mdschema") or ""
        element = node.attrib.get("element") or ""
        qualifier = node.attrib.get("qualifier")
        key = ".".join(part for part in (schema, element, qualifier) if part)
        value = clean_text(node.text)
        if key and value:
            fields.setdefault(key, []).append(value)

    provider_record_id = identifier or first(fields.get("dc.identifier.uri")) or stable_hash(xml_text)

    return source_record(
        provider="riudg",
        provider_record_id=provider_record_id,
        source_url=source_url,
        raw_fields=fields,
        raw_payload=xml_text,
        sets=sets,
        datestamp=datestamp,
    )


class DCHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.fields: dict[str, list[str]] = {}

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        if tag.casefold() != "meta":
            return
        values = {str(k).casefold(): (v or "") for k, v in attrs}
        name = clean_text(values.get("name"))
        content = clean_text(values.get("content"))
        if not name or not content or not name.casefold().startswith("dc."):
            return
        self.fields.setdefault(name, []).append(content)


def parse_udgvirtual_html(
    html_text: str,
    *,
    handle: str,
    source_url: str | None = None,
) -> dict[str, Any]:
    parser = DCHTMLParser()
    parser.feed(html_text)

    return source_record(
        provider="udgvirtual",
        provider_record_id=handle,
        source_url=source_url or UDGVIRTUAL_ITEM.format(handle=handle),
        raw_fields=parser.fields,
        raw_payload=html_text,
    )


def field_values(record: dict[str, Any], *keys: str) -> list[str]:
    output: list[str] = []
    raw = record.get("rawFields") or {}
    for key in keys:
        output.extend(raw.get(key) or [])
    return unique_strings(output)


def infer_program_from_udgvirtual_description(values: list[str]) -> str | None:
    for value in values:
        match = re.search(
            r"grado\s+de\s+(.+?)(?:[.;]|$)",
            value,
            flags=re.IGNORECASE,
        )
        if match:
            return clean_text(match.group(1))
    return None


def canonical_candidate(
    record: dict[str, Any],
    registry: dict[str, Any],
    *,
    reference_year: int | None = None,
) -> dict[str, Any]:
    source_ref = record["id"]
    provider = record["provider"]

    if provider == "riudg":
        title = first(field_values(record, "dc.title"))
        authors = field_values(record, "dc.contributor.author")
        directors = field_values(record, "dc.contributor.director")
        codirectors = field_values(record, "dc.contributor.codirector")
        advisors = field_values(record, "dc.contributor.advisor")
        program_raw = first(field_values(record, "dc.degree.name"))
        institution_values = field_values(
            record,
            "dc.degree.grantor",
            "dc.publisher",
        )
        academic_unit_raw = first(field_values(record, "dc.degree.department"))
        date_raw = first(field_values(record, "dc.date.issued", "dc.date.submitted"))
        language = first(field_values(record, "dc.language.iso", "dc.language"))
        abstract = first(field_values(record, "dc.description.abstract"))
        keywords = field_values(record, "dc.subject")
        identifiers = field_values(record, "dc.identifier.uri", "dc.identifier")
        thesis_type = first(field_values(record, "dc.type", "dc.type.conacyt"))
    elif provider == "udgvirtual":
        title = first(field_values(record, "DC.title", "dc.title"))
        authors = field_values(record, "DC.creator", "dc.creator")
        contributor_values = field_values(record, "DC.contributor", "dc.contributor")
        directors = []
        codirectors = []
        advisors = []
        unknown = []
        for value in contributor_values:
            role, name = parse_role_from_contributor(value)
            if role == "thesis-director":
                directors.append(name)
            elif role == "thesis-codirector":
                codirectors.append(name)
            elif role == "thesis-advisor":
                advisors.append(name)
            else:
                unknown.append(name)

        descriptions = field_values(record, "DC.description", "dc.description")
        program_raw = infer_program_from_udgvirtual_description(descriptions)

        institution_values = field_values(
            record,
            "DC.publisher",
            "dc.publisher",
        )
        for value in contributor_values:
            role, name = parse_role_from_contributor(value)
            if role == "unknown-thesis-role" and looks_like_institution(name):
                institution_values.append(name)

        academic_unit_raw = None
        date_raw = first(field_values(record, "DC.date", "dc.date"))
        language = first(field_values(record, "DC.language", "dc.language"))
        abstract = first(descriptions)
        keywords = field_values(record, "DC.subject", "dc.subject")
        identifiers = field_values(record, "DC.identifier", "dc.identifier")
        thesis_type = first(field_values(record, "DC.type", "dc.type"))
    else:
        raise ValueError(f"Unsupported thesis provider: {provider}")

    persistent = []
    for raw in identifiers:
        handle = normalize_handle(raw)
        if handle:
            persistent.append(
                {
                    "scheme": "handle",
                    "rawValue": raw,
                    "normalizedValue": handle,
                }
            )

    source_type = classify_source_type(thesis_type)
    program = resolve_program(program_raw, registry)
    institution = resolve_institution(institution_values, registry)
    admission = admission_decision(
        source_record_id=source_ref,
        institution=institution,
        program=program,
        source_type=source_type,
    )

    contributions: list[dict[str, Any]] = []
    position = 0
    for name in authors:
        contributions.append(contribution("thesis-author", name, source_ref, position))
        position += 1
    for name in directors:
        contributions.append(contribution("thesis-director", name, source_ref, position))
        position += 1
    for name in codirectors:
        contributions.append(contribution("thesis-codirector", name, source_ref, position))
        position += 1
    for name in advisors:
        contributions.append(contribution("thesis-advisor", name, source_ref, position))
        position += 1

    if provider == "udgvirtual":
        for value in field_values(record, "DC.contributor", "dc.contributor"):
            role, name = parse_role_from_contributor(value)
            if role == "unknown-thesis-role":
                contributions.append(contribution(role, name, source_ref, position))
                position += 1

    return {
        "sourceRecordRef": source_ref,
        "provider": provider,
        "title": title,
        "titleNormalized": normalize_key(title),
        "date": date_info(date_raw, reference_year),
        "language": normalize_language(language),
        "abstract": abstract,
        "keywords": keywords,
        "program": program,
        "institution": institution,
        "academicUnitRaw": academic_unit_raw,
        "thesisTypeRaw": thesis_type,
        "sourceType": source_type,
        "persistentIdentifiers": persistent,
        "contributions": contributions,
        "admission": admission,
    }


def identity_key(candidate: dict[str, Any]) -> str:
    handles = [
        item["normalizedValue"]
        for item in candidate.get("persistentIdentifiers", [])
        if item.get("scheme") == "handle" and item.get("normalizedValue")
    ]
    if handles:
        return "handle:" + sorted(handles)[0]
    return "source:" + candidate["sourceRecordRef"]


def allocate_work_ids(
    groups: list[list[dict[str, Any]]],
    previous_registry: dict[str, str] | None = None,
) -> tuple[dict[str, str], dict[str, str]]:
    previous_registry = dict(previous_registry or {})
    registry = dict(previous_registry)

    existing_numbers = []
    for value in registry.values():
        match = re.match(r"^thesis:work:(\d+)$", value)
        if match:
            existing_numbers.append(int(match.group(1)))
    next_number = max(existing_numbers, default=0) + 1

    group_ids: dict[str, str] = {}
    for group in groups:
        source_refs = sorted(item["sourceRecordRef"] for item in group)
        reused = next(
            (registry[source_ref] for source_ref in source_refs if source_ref in registry),
            None,
        )
        if reused:
            work_id = reused
        else:
            work_id = f"thesis:work:{next_number:08d}"
            next_number += 1
        for source_ref in source_refs:
            registry[source_ref] = work_id
        group_ids["|".join(source_refs)] = work_id

    return group_ids, registry


def contribution_conflicts(
    contributions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    roles_by_name: dict[str, set[str]] = {}
    refs_by_name: dict[str, list[str]] = {}
    sources_by_name: dict[str, set[str]] = {}

    for item in contributions:
        name = item.get("normalizedName") or ""
        role = item.get("role") or ""
        if not name or not role:
            continue
        roles_by_name.setdefault(name, set()).add(role)
        refs_by_name.setdefault(name, []).append(item.get("id") or "")
        if item.get("sourceRecordRef"):
            sources_by_name.setdefault(name, set()).add(item["sourceRecordRef"])

    supervisory = {
        "thesis-director",
        "thesis-codirector",
        "thesis-advisor",
    }

    conflicts: list[dict[str, Any]] = []
    for name, roles in sorted(roles_by_name.items()):
        if "thesis-author" not in roles or not (roles & supervisory):
            continue

        conflicts.append(
            {
                "type": "author-supervisor-name-collision",
                "normalizedName": name,
                "roles": sorted(roles),
                "contributionRefs": sorted(
                    ref for ref in refs_by_name.get(name, []) if ref
                ),
                "sourceRecordRefs": sorted(sources_by_name.get(name, set())),
                "resolutionDirective": "do-not-auto-resolve",
            }
        )

    return conflicts


def build_corpus(
    source_records: list[dict[str, Any]],
    registry: dict[str, Any],
    *,
    previous_work_registry: dict[str, str] | None = None,
    reference_year: int | None = None,
    build_revision: str = "thesis-corpus-fixture-v1",
) -> dict[str, Any]:
    candidates = [
        canonical_candidate(record, registry, reference_year=reference_year)
        for record in source_records
    ]

    by_key: dict[str, list[dict[str, Any]]] = {}
    for candidate in candidates:
        by_key.setdefault(identity_key(candidate), []).append(candidate)

    groups: list[list[dict[str, Any]]] = []
    vetoed_identity_groups: set[str] = set()

    for key, raw_group in sorted(by_key.items()):
        group = sorted(
            raw_group,
            key=lambda item: (
                0 if item["provider"] == "riudg" else 1,
                item["sourceRecordRef"],
            ),
        )

        confirmed_institutions = {
            item["institution"].get("institutionRef")
            for item in group
            if item["institution"].get("status") == "confirmed"
        }
        external_institutions = {
            item["institution"].get("canonicalName")
            for item in group
            if item["institution"].get("status") == "external"
        }

        if len(group) > 1 and confirmed_institutions and external_institutions:
            vetoed_identity_groups.add(key)
            groups.extend([[item] for item in group])
        else:
            groups.append(group)

    group_ids, work_registry = allocate_work_ids(groups, previous_work_registry)

    works = []
    admissions = []
    identity_decisions = []

    for group in groups:
        source_refs = sorted(item["sourceRecordRef"] for item in group)
        work_id = group_ids["|".join(source_refs)]
        primary = group[0]

        group_identity_key = identity_key(primary)
        identity_veto_applied = group_identity_key in vetoed_identity_groups

        if len(group) > 1:
            status = "confirmed"
            explanation = "shared-persistent-identifier"
        elif identity_veto_applied:
            status = "rejected"
            explanation = "institution-contradiction-veto"
        else:
            status = "single-source"
            explanation = "no-merge-needed"

        identity_decisions.append(
            {
                "id": "identity:" + stable_hash("|".join(source_refs))[:20],
                "sourceRecordRefs": source_refs,
                "workRef": work_id,
                "status": status,
                "explanationCode": explanation,
                "decisionMode": "deterministic",
            }
        )

        contribution_map: dict[tuple[str, str], dict[str, Any]] = {}
        persistent_map: dict[tuple[str, str], dict[str, Any]] = {}
        for item in group:
            for contrib in item["contributions"]:
                contribution_map.setdefault(
                    (contrib["role"], contrib["normalizedName"]),
                    contrib,
                )
            for identifier in item["persistentIdentifiers"]:
                persistent_map.setdefault(
                    (identifier["scheme"], identifier["normalizedValue"]),
                    identifier,
                )
            admissions.append(item["admission"])

        group_contributions = list(contribution_map.values())
        role_conflicts = contribution_conflicts(group_contributions)
        blocked_names = {
            item["normalizedName"]
            for item in role_conflicts
            if item.get("normalizedName")
        }
        if blocked_names:
            group_contributions = [
                {
                    **item,
                    "resolutionState": (
                        "blocked-role-conflict"
                        if item.get("normalizedName") in blocked_names
                        else item.get("resolutionState", "unresolved")
                    ),
                }
                for item in group_contributions
            ]

        metadata_quality_flags = sorted(
            {
                item["type"]
                for item in role_conflicts
                if item.get("type")
            }
        )

        group_admission = "quarantine"
        group_codes = []
        if identity_veto_applied:
            group_admission = primary["admission"]["status"]
            group_codes.append("identity-contradiction-veto")
        elif any(item["admission"]["status"] == "include" for item in group):
            group_admission = "include"
            group_codes.append("confirmed-humanities-program")
        elif any(item["admission"]["status"] == "exclude" for item in group):
            group_admission = "exclude"
            group_codes.append("excluded-by-source-decision")
        elif all(item["admission"]["status"] == "reject-source" for item in group):
            group_admission = "reject-source"
            group_codes.append("not-a-thesis")
        elif any(item["admission"]["status"] == "review" for item in group):
            group_admission = "review"
            group_codes.append("program-review")
        else:
            group_codes.append("unresolved-or-unknown")

        works.append(
            {
                "id": work_id,
                "title": primary["title"],
                "date": primary["date"],
                "language": primary["language"],
                "abstract": primary["abstract"],
                "keywords": primary["keywords"],
                "programRef": primary["program"].get("programRef"),
                "programRaw": primary["program"].get("raw"),
                "institutionRef": primary["institution"].get("institutionRef"),
                "institutionRaw": primary["institution"].get("raw"),
                "academicUnitRaw": primary["academicUnitRaw"],
                "thesisTypeRaw": primary["thesisTypeRaw"],
                "sourceRecordRefs": source_refs,
                "persistentIdentifiers": list(persistent_map.values()),
                "contributions": group_contributions,
                "contributionConflicts": role_conflicts,
                "metadataQualityFlags": metadata_quality_flags,
                "admissionStatus": group_admission,
                "admissionExplanationCodes": group_codes,
            }
        )

    metrics = {
        "sourceRecords": len(source_records),
        "works": len(works),
        "worksByAdmission": dict(Counter(work["admissionStatus"] for work in works)),
        "providers": dict(Counter(record["provider"] for record in source_records)),
        "dateQuality": dict(Counter(work["date"]["quality"] for work in works)),
        "identityDecisions": dict(Counter(item["status"] for item in identity_decisions)),
        "metadataQualityFlags": dict(
            Counter(
                flag
                for work in works
                for flag in work.get("metadataQualityFlags", [])
            )
        ),
    }

    payload = {
        "schemaVersion": "thesis-canonical-corpus-v1",
        "buildRevision": build_revision,
        "programAuthorityRevision": registry.get("registryRevision", registry["schemaVersion"]),
        "sourceRecords": source_records,
        "programAuthorities": registry.get("programs", []),
        "institutionAuthorities": [registry.get("institution")],
        "works": works,
        "admissionDecisions": admissions,
        "identityDecisions": identity_decisions,
        "workIdRegistry": work_registry,
        "metrics": metrics,
    }

    validate_corpus(payload)
    return payload


def validate_corpus(corpus: dict[str, Any]) -> bool:
    sources = corpus.get("sourceRecords") or []
    works = corpus.get("works") or []

    source_ids = [item["id"] for item in sources]
    work_ids = [item["id"] for item in works]

    if len(source_ids) != len(set(source_ids)):
        raise ValueError("Duplicate SourceRecord IDs")
    if len(work_ids) != len(set(work_ids)):
        raise ValueError("Duplicate work IDs")

    source_id_set = set(source_ids)
    for work in works:
        for ref in work.get("sourceRecordRefs", []):
            if ref not in source_id_set:
                raise ValueError(f"Broken SourceRecord reference: {ref}")

        if work.get("admissionStatus") in {"include", "review"}:
            if not work.get("programRef"):
                raise ValueError(
                    f"{work.get('admissionStatus', '').upper()} work without programRef"
                )
            if work.get("institutionRef") != "institution:udg":
                raise ValueError(
                    f"{work.get('admissionStatus', '').upper()} work without UdeG institutionRef"
                )

        author_names = {
            contrib["normalizedName"]
            for contrib in work.get("contributions", [])
            if contrib["role"] == "thesis-author"
        }
        supervisory_names = {
            contrib["normalizedName"]
            for contrib in work.get("contributions", [])
            if contrib["role"] in {
                "thesis-director",
                "thesis-codirector",
                "thesis-advisor",
            }
        }
        overlap = {
            name
            for name in author_names & supervisory_names
            if name
        }

        reported_conflicts = {
            item.get("normalizedName")
            for item in work.get("contributionConflicts", [])
            if item.get("type") == "author-supervisor-name-collision"
            and item.get("normalizedName")
        }

        if overlap != reported_conflicts:
            raise ValueError(
                "Author/supervisor role collisions must be represented exactly "
                "as contributionConflicts"
            )

        if overlap:
            flags = set(work.get("metadataQualityFlags", []))
            if "author-supervisor-name-collision" not in flags:
                raise ValueError(
                    "Author/supervisor collision missing metadata quality flag"
                )

            for contrib in work.get("contributions", []):
                if contrib.get("normalizedName") in overlap:
                    if contrib.get("resolutionState") != "blocked-role-conflict":
                        raise ValueError(
                            "Conflicting contribution is not blocked from "
                            "automatic person resolution"
                        )

    return True


def request_text(url: str, timeout: int = 30) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/xml,text/xml,text/html;q=0.9,*/*;q=0.5",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", "replace")


def fetch_riudg_dim(identifier: str) -> dict[str, Any]:
    query = urllib.parse.urlencode(
        {
            "verb": "GetRecord",
            "identifier": identifier,
            "metadataPrefix": "dim",
        }
    )
    url = f"{RIUDG_ENDPOINT}?{query}"
    return parse_riudg_dim(request_text(url), source_url=url)


def fetch_udgvirtual_item(handle: str) -> dict[str, Any]:
    url = UDGVIRTUAL_ITEM.format(handle=handle)
    return parse_udgvirtual_html(
        request_text(url),
        handle=handle,
        source_url=url,
    )


def live_smoke(registry: dict[str, Any]) -> dict[str, Any]:
    riudg = fetch_riudg_dim(
        "oai:riudg.udg.mx:20.500.12104/112380"
    )
    udgvirtual = fetch_udgvirtual_item("4102")

    candidates = [
        canonical_candidate(riudg, registry),
        canonical_candidate(udgvirtual, registry),
    ]

    return {
        "schemaVersion": "thesis-live-smoke-v1",
        "riudg": {
            "providerRecordId": riudg["providerRecordId"],
            "fieldCount": len(riudg["rawFields"]),
            "titlePresent": bool(candidates[0]["title"]),
            "programRaw": candidates[0]["program"].get("raw"),
            "programStatus": candidates[0]["program"].get("status"),
            "institutionStatus": candidates[0]["institution"].get("status"),
            "admissionStatus": candidates[0]["admission"]["status"],
            "hasDirector": any(
                item["role"] == "thesis-director"
                for item in candidates[0]["contributions"]
            ),
        },
        "udgvirtual": {
            "providerRecordId": udgvirtual["providerRecordId"],
            "fieldCount": len(udgvirtual["rawFields"]),
            "titlePresent": bool(candidates[1]["title"]),
            "programRaw": candidates[1]["program"].get("raw"),
            "programStatus": candidates[1]["program"].get("status"),
            "institutionStatus": candidates[1]["institution"].get("status"),
            "admissionStatus": candidates[1]["admission"]["status"],
            "hasDirector": any(
                item["role"] == "thesis-director"
                for item in candidates[1]["contributions"]
            ),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    parser.add_argument("--riudg-xml", default=str(DEFAULT_RIUDG_FIXTURE))
    parser.add_argument("--udgvirtual-html", default=str(DEFAULT_UDGVIRTUAL_FIXTURE))
    parser.add_argument("--output")
    parser.add_argument("--live-smoke", action="store_true")
    args = parser.parse_args()

    registry = load_program_registry(args.registry)

    if args.live_smoke:
        payload = live_smoke(registry)
    else:
        riudg = parse_riudg_dim(
            Path(args.riudg_xml).read_text(encoding="utf-8")
        )
        udgvirtual = parse_udgvirtual_html(
            Path(args.udgvirtual_html).read_text(encoding="utf-8"),
            handle="fixture-philosophy",
        )
        payload = build_corpus(
            [riudg, udgvirtual],
            registry,
            reference_year=2026,
            build_revision="thesis-corpus-fixture-v1",
        )

    encoded = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output:
        path = Path(args.output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(encoded, encoding="utf-8")
    else:
        print(encoded, end="")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

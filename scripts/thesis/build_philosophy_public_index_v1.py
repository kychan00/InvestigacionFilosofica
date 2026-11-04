#!/usr/bin/env python3
"""Build the public, reference-only Philosophy thesis discovery index."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

SCHEMA = "thesis-philosophy-public-index-v1"
REVISION = "2026-11-04.t2ct-v1"
CORROBORATION_SCHEMA = "thesis-philosophy-external-corroboration-v1"
SOURCE_RELEASE = "thesis-effective-corpus-v2"
FORBIDDEN_URL_TOKENS = (".pdf", "/bitstream", "/download")
ALLOWED_STATUS = {"include", "review"}


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalized(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.casefold()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def safe_reference_url(value: str | None) -> str | None:
    if not value or not isinstance(value, str):
        return None
    if any(token in value.casefold() for token in FORBIDDEN_URL_TOKENS):
        return None
    try:
        parsed = urlparse(value)
    except ValueError:
        return None
    if parsed.scheme != "https" or parsed.username or parsed.password:
        return None
    if parsed.port not in (None, 443) or not parsed.hostname:
        return None
    return value


def first_author(record: dict[str, Any]) -> str:
    authors = record.get("authors") or []
    return normalized(authors[0] if authors else "")


def corroboration_key(record: dict[str, Any]) -> tuple[str, str]:
    author = record.get("sourceAuthor")
    if author is None:
        authors = record.get("authors") or []
        author = authors[0] if authors else ""
    return (normalized(record.get("sourceTitle") or record.get("title")), normalized(author))


def validate_corroboration_ledger(ledger: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    if ledger.get("schemaVersion") != CORROBORATION_SCHEMA:
        raise ValueError("Unsupported external corroboration schema")
    policy = ledger.get("policy") or {}
    expected = {
        "referenceOnly": True,
        "canonicalAdmissionMutation": False,
        "physicalLocationMutation": False,
        "automaticIdentityMerge": False,
        "externalEvidenceAloneMayNotAssertPhysicalHolding": True,
    }
    for key, value in expected.items():
        if policy.get(key) is not value:
            raise ValueError(f"Unsafe corroboration policy: {key}")
    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for row in ledger.get("records") or []:
        key = corroboration_key(row)
        if not all(key) or key in by_key:
            raise ValueError("Missing or duplicate corroboration identity")
        if (row.get("claims") or {}).get("physicalLocation") != "unresolved":
            raise ValueError("External corroboration cannot assert physical holdings")
        by_key[key] = row
    return by_key


def project_corroboration(public: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    if public.get("philosophyStatus") != "review":
        raise ValueError("T2CT only projects corroboration onto REVIEW records")
    safe_urls: list[str] = []
    evidence_kinds: list[str] = []
    for item in row.get("evidence") or []:
        url = safe_reference_url(item.get("url"))
        if url and url not in safe_urls:
            safe_urls.append(url)
        kind = str(item.get("evidenceKind") or "").strip()
        if kind and kind not in evidence_kinds:
            evidence_kinds.append(kind)
    claims = dict(row.get("claims") or {})
    return {
        "status": row.get("corroborationStatus"),
        "claims": claims,
        "evidenceUrls": safe_urls,
        "evidenceKinds": evidence_kinds,
        "identityConfirmed": False,
        "physicalLocationConfirmed": False,
        "note": (
            "Fuentes adicionales corroboran aspectos del trabajo, autor o programa; "
            "la identidad institucional exacta y el paradero físico siguen en revisión."
        ),
    }


def match_key(record: dict[str, Any]) -> tuple[str, str, str]:
    return (
        normalized(record.get("title")),
        first_author(record),
        str(record.get("year") or "")[:4],
    )


def stable_public_id(provider: str, provider_record_id: str) -> str:
    digest = hashlib.sha256(f"{provider}|{provider_record_id}".encode("utf-8")).hexdigest()[:20]
    return f"philosophy:reference:{digest}"


def degree_from_text(program: str | None, thesis_type: str | None = None) -> str:
    text = normalized(program) + " " + normalized(thesis_type)
    if "doctor" in text:
        return "doctorado"
    if "maestr" in text or "maestro" in text:
        return "maestria"
    if "licenci" in text:
        return "licenciatura"
    return ""


def source_label(provider: str | None) -> str:
    labels = {
        "udg-aleph": "Catálogo UdeG",
        "udg-official-program-page": "Página oficial UdeG",
        "udg-official-profile": "Perfil oficial UdeG",
        "cucsh-library": "Biblioteca CUCSH",
        "cucsh-official": "CUCSH",
        "riudg": "RIUdeG",
        "philpapers": "PhilPapers",
        "philarchive": "PhilArchive",
        "academia": "Academia.edu",
    }
    return labels.get(str(provider or ""), str(provider or "Fuente de referencia"))


def validate_inputs(demo: dict[str, Any], curated: dict[str, Any], supplement: dict[str, Any]) -> list[str]:
    if demo.get("schemaVersion") != "thesis-demo-index-v1":
        raise ValueError("Unsupported thesis demo schema")
    if demo.get("sourceRelease") != SOURCE_RELEASE or demo.get("referenceOnly") is not True:
        raise ValueError("Philosophy public view requires verified reference-only V2 demo data")
    if demo.get("totalIncluded") != 566 or len(demo.get("records") or []) != 566:
        raise ValueError("Unexpected V2 demo cardinality")
    if curated.get("schemaVersion") != "thesis-philosophy-curated-content-v1":
        raise ValueError("Unsupported curated Philosophy schema")
    rules = curated.get("rules") or {}
    if rules.get("preserveActualProgram") is not True or rules.get("canonicalAdmissionMutation") is not False:
        raise ValueError("Curated Philosophy contract must preserve actual programs")
    if supplement.get("schemaVersion") != "thesis-philosophy-official-supplement-v1":
        raise ValueError("Unsupported Philosophy supplement schema")
    refs = list(supplement.get("targetProgramRefs") or [])
    if refs != [
        "program:udg:lic-filosofia",
        "program:udg:mae-estudios-filosoficos",
        "program:udg:mae-filosofia-historica",
    ]:
        raise ValueError("Exact Philosophy program set changed unexpectedly")
    if (supplement.get("doctoralPolicy") or {}).get("exactDoctorateProgramPresent") is not False:
        raise ValueError("Do not publish a Doctorado en Filosofía without exact authority")
    return refs


def canonical_public_record(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "canonicalWorkId": row["id"],
        "title": row["title"],
        "authors": list(row.get("authors") or []),
        "directors": list(row.get("directors") or []),
        "year": row.get("year"),
        "dateQuality": row.get("dateQuality"),
        "program": row.get("program") or "Sin programa registrado",
        "programRef": row.get("programRef"),
        "degree": row.get("degree") or "",
        "unit": row.get("unit") or "",
        "abstractExcerpt": row.get("abstractExcerpt") or "",
        "keywords": list(row.get("keywords") or []),
        "sourceUrl": safe_reference_url(row.get("sourceUrl")),
        "handle": row.get("handle"),
        "philosophyStatus": "include",
        "philosophyRole": "program-core",
        "classificationSource": "program-authority-v47",
        "philosophyEvidence": "El programa académico resuelve por autoridad exacta a un programa de Filosofía aprobado.",
        "validationTier": "effective-corpus-v2",
        "sourceKind": "canonical-v2",
        "sourceLabel": "Repositorio institucional UdeG",
        "evidenceUrls": [],
    }


def curated_public_record(
    row: dict[str, Any],
    demo_match: dict[str, Any] | None = None,
    program_ref_by_name: dict[str, str] | None = None,
) -> dict[str, Any]:
    status = row.get("status")
    if status not in ALLOWED_STATUS:
        raise ValueError(f"Unsupported curated status: {status}")
    record_url = safe_reference_url(row.get("recordUrl"))
    if not record_url:
        raise ValueError(f"Unsafe curated reference URL: {row.get('id')}")
    evidence_urls = []
    for value in row.get("evidenceUrls") or []:
        safe = safe_reference_url(value)
        if not safe:
            raise ValueError(f"Unsafe curated evidence URL: {row.get('id')}")
        evidence_urls.append(safe)

    if demo_match:
        result = canonical_public_record(demo_match)
        result["sourceKind"] = "canonical-v2+curated"
    else:
        result = {
            "id": stable_public_id(row["provider"], row["providerRecordId"]),
            "canonicalWorkId": None,
            "title": row["title"],
            "authors": list(row.get("authors") or []),
            "directors": [],
            "year": int(row["year"]) if str(row.get("year") or "").isdigit() else None,
            "dateQuality": "valid" if str(row.get("year") or "").isdigit() else "unknown",
            "program": row.get("actualProgram") or "Sin programa registrado",
            "programRef": (program_ref_by_name or {}).get(normalized(row.get("actualProgram"))),
            "degree": degree_from_text(row.get("actualProgram"), row.get("thesisType")),
            "unit": row.get("academicUnit") or "",
            "abstractExcerpt": "",
            "keywords": [],
            "sourceUrl": record_url,
            "handle": None,
            "sourceKind": "curated-reference",
            "sourceLabel": source_label(row.get("provider")),
        }

    result.update({
        "philosophyStatus": status,
        "philosophyRole": row["inclusionBasis"],
        "classificationSource": row["classificationSource"],
        "philosophyEvidence": row["philosophyEvidence"],
        "validationTier": row["validationTier"],
        "curatedRecordId": row["id"],
        "provider": row["provider"],
        "providerRecordId": row["providerRecordId"],
        "referenceUrl": record_url,
        "evidenceUrls": evidence_urls,
    })
    if not result.get("sourceUrl"):
        result["sourceUrl"] = record_url
        result["sourceLabel"] = source_label(row.get("provider"))
    return result


def supplement_public_record(row: dict[str, Any], program_ref_by_name: dict[str, str]) -> dict[str, Any]:
    url = safe_reference_url(row.get("recordUrl"))
    if not url:
        raise ValueError(f"Unsafe official supplement URL: {row.get('providerRecordId')}")
    program = row.get("program") or "Sin programa registrado"
    return {
        "id": stable_public_id(row["provider"], row["providerRecordId"]),
        "canonicalWorkId": None,
        "title": row["title"],
        "authors": list(row.get("authors") or []),
        "directors": list(row.get("directors") or []),
        "year": int(row["year"]) if str(row.get("year") or "").isdigit() else None,
        "dateQuality": "valid" if str(row.get("year") or "").isdigit() else "unknown",
        "program": program,
        "programRef": program_ref_by_name.get(normalized(program)),
        "degree": degree_from_text(program, row.get("thesisType")),
        "unit": row.get("academicUnit") or "",
        "abstractExcerpt": "",
        "keywords": [],
        "sourceUrl": url,
        "handle": None,
        "philosophyStatus": "include",
        "philosophyRole": "program-core",
        "classificationSource": "official-program-evidence",
        "philosophyEvidence": "Fuente oficial UdeG documenta el programa filosófico de esta tesis.",
        "validationTier": row.get("evidenceKind") or "official-udg",
        "sourceKind": "official-supplement",
        "sourceLabel": source_label(row.get("provider")),
        "provider": row.get("provider"),
        "providerRecordId": row.get("providerRecordId"),
        "referenceUrl": url,
        "evidenceUrls": [],
    }


def build_index(demo: dict[str, Any], curated: dict[str, Any], supplement: dict[str, Any], corroboration: dict[str, Any]) -> dict[str, Any]:
    target_refs = validate_inputs(demo, curated, supplement)
    corroboration_by_key = validate_corroboration_ledger(corroboration)
    target_set = set(target_refs)
    demo_records = list(demo["records"])
    demo_by_key = {match_key(row): row for row in demo_records}
    demo_by_title_year: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for row in demo_records:
        demo_by_title_year.setdefault(
            (normalized(row.get("title")), str(row.get("year") or "")), []
        ).append(row)

    program_names: dict[str, str] = {}
    program_ref_by_name: dict[str, str] = {}
    output_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}

    for row in demo_records:
        if row.get("programRef") not in target_set:
            continue
        public = canonical_public_record(row)
        output_by_key[match_key(public)] = public
        program_names[row["programRef"]] = row.get("program") or row["programRef"]
        program_ref_by_name[normalized(row.get("program"))] = row["programRef"]

    for seed in supplement.get("seedRecords") or []:
        key = match_key(seed)
        existing = output_by_key.get(key)
        if existing:
            url = safe_reference_url(seed.get("recordUrl"))
            if url and url not in existing["evidenceUrls"]:
                existing["evidenceUrls"].append(url)
            continue
        demo_match = demo_by_key.get(key)
        if demo_match and demo_match.get("programRef") in target_set:
            public = canonical_public_record(demo_match)
            url = safe_reference_url(seed.get("recordUrl"))
            if url:
                public["evidenceUrls"].append(url)
            output_by_key[key] = public
            continue
        public = supplement_public_record(seed, program_ref_by_name)
        if public.get("programRef") not in target_set:
            raise ValueError("Official supplement no longer resolves to an exact Philosophy program")
        output_by_key[key] = public

    for row in curated.get("records") or []:
        key = match_key(row)
        demo_match = demo_by_key.get(key)
        if demo_match is None:
            candidates = demo_by_title_year.get(
                (normalized(row.get("title")), str(row.get("year") or "")), []
            )
            if len(candidates) == 1:
                demo_match = candidates[0]
        if key in output_by_key:
            base = output_by_key[key]
            curated_row = curated_public_record(
                row,
                demo_match=demo_match or base,
                program_ref_by_name=program_ref_by_name,
            )
            for field in (
                "philosophyStatus", "philosophyRole", "classificationSource",
                "philosophyEvidence", "validationTier", "curatedRecordId",
                "provider", "providerRecordId", "referenceUrl", "evidenceUrls",
            ):
                base[field] = curated_row.get(field)
            if curated_row.get("referenceUrl") and curated_row["referenceUrl"] not in base.get("evidenceUrls", []):
                base.setdefault("evidenceUrls", []).append(curated_row["referenceUrl"])
            continue
        output_by_key[key] = curated_public_record(
            row,
            demo_match=demo_match,
            program_ref_by_name=program_ref_by_name,
        )

    records = list(output_by_key.values())
    corroborated_review_records = 0
    for row in records:
        source = corroboration_by_key.get(corroboration_key(row))
        if source is None:
            continue
        row["externalCorroboration"] = project_corroboration(row, source)
        corroborated_review_records += 1

    ids = [row["id"] for row in records]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate Philosophy public record IDs")
    for row in records:
        if row.get("philosophyStatus") not in ALLOWED_STATUS:
            raise ValueError("Invalid Philosophy public status")
        if not row.get("title") or not row.get("authors"):
            raise ValueError("Incomplete Philosophy public bibliographic record")
        if row.get("sourceUrl") and not safe_reference_url(row["sourceUrl"]):
            raise ValueError("Unsafe Philosophy public source URL")

    role_counts = Counter(row["philosophyRole"] for row in records)
    status_counts = Counter(row["philosophyStatus"] for row in records)
    actual_programs = sorted(
        {row["program"] for row in records if row.get("program")},
        key=normalized,
    )

    documented_programs = []
    for ref in target_refs:
        name = program_names.get(ref)
        if not name:
            raise ValueError(f"Documented Philosophy program missing from V2: {ref}")
        rows = [row for row in records if row.get("programRef") == ref]
        documented_programs.append({
            "programRef": ref,
            "name": name,
            "include": sum(row["philosophyStatus"] == "include" for row in rows),
            "review": sum(row["philosophyStatus"] == "review" for row in rows),
            "records": len(rows),
        })

    records.sort(key=lambda row: (
        0 if row["philosophyStatus"] == "include" else 1,
        0 if row["philosophyRole"] == "program-core" else 1,
        -(row.get("year") or 0),
        normalized(row["title"]),
        row["id"],
    ))

    return {
        "schemaVersion": SCHEMA,
        "revision": REVISION,
        "sourceRelease": SOURCE_RELEASE,
        "sourceGzipSha256": demo.get("sourceGzipSha256"),
        "programAuthorityRevision": demo.get("programAuthorityRevision"),
        "referenceOnly": True,
        "canonicalAdmissionMutation": False,
        "preserveActualProgram": True,
        "doctoralPolicy": supplement["doctoralPolicy"],
        "documentedPhilosophyPrograms": documented_programs,
        "metrics": {
            "records": len(records),
            "byStatus": dict(sorted(status_counts.items())),
            "byRole": dict(sorted(role_counts.items())),
            "actualProgramsRepresented": len(actual_programs),
            "corroboratedReviewRecords": corroborated_review_records,
        },
        "actualProgramsRepresented": actual_programs,
        "records": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo-index", required=True, type=Path)
    parser.add_argument("--curated-config", required=True, type=Path)
    parser.add_argument("--supplement-config", required=True, type=Path)
    parser.add_argument(
        "--corroboration-config",
        type=Path,
        default=ROOT / "scripts/thesis/config/philosophy-external-corroboration-v1.json",
    )
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = build_index(
        read_json(args.demo_index),
        read_json(args.curated_config),
        read_json(args.supplement_config),
        read_json(args.corroboration_config),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n"
    if len(data.encode("utf-8")) > 300_000:
        raise ValueError("Philosophy public index is unexpectedly large")
    args.output.write_text(data, encoding="utf-8")
    print(json.dumps(output["metrics"], ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

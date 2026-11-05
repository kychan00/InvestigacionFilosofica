#!/usr/bin/env python3
"""Validate T2CY MEF supervision evidence without promoting CV entries to institutional work identities."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import unicodedata
import urllib.parse
from collections import Counter
from pathlib import Path
from typing import Any

SCHEMA = "thesis-mef-supervision-evidence-t2cy-v1"
PROGRAM_REF = "program:udg:mae-estudios-filosoficos"
SOURCE_URL = "https://www.academia.edu/108518083/CVU_Fernando_Leal_octubre_2023"
ROLES = {"director", "director-and-examiner", "examiner", "reader-and-examiner"}
AUTHOR_STATUSES = {"source-exact", "variant-review"}
DECISIONS = {"exact-title-candidate", "author-variant-review", "t2cx-overlap"}
ALLOWED_SUPPORTS = {
    "graduateIdentityCandidate",
    "authorVariantCandidate",
    "exactThesisTitle",
    "program",
    "approvalDate",
    "projectLineage",
    "topicLineage",
}
FORBIDDEN_URL = re.compile(r"(?i)(?:file:|sandbox:|/bitstream/|/download(?:/|$))")


def norm(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text.casefold())
    return " ".join(text.split())


def _public_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or FORBIDDEN_URL.search(url):
        raise ValueError("Evidence URL must be a public reference, not a local/download endpoint")


def _parse_date(value: Any) -> dt.date:
    try:
        parsed = dt.date.fromisoformat(str(value))
    except ValueError as exc:
        raise ValueError("approvalDate must be ISO YYYY-MM-DD") from exc
    if not (2000 <= parsed.year <= 2026):
        raise ValueError("approvalDate outside supported range")
    return parsed


def validate(data: dict[str, Any], t2cx: dict[str, Any]) -> dict[str, Any]:
    if data.get("schemaVersion") != SCHEMA:
        raise ValueError("Unsupported T2CY schema")
    if data.get("programRef") != PROGRAM_REF:
        raise ValueError("Wrong programme authority")

    scope = data.get("sourceScope") or {}
    if scope.get("sourceUrl") != SOURCE_URL:
        raise ValueError("T2CY must preserve the exact supervision source")
    if "presented/approved" not in str(scope.get("extractionRule") or "").casefold():
        raise ValueError("Source extraction rule must require completed theses")

    required_policy = {
        "referenceOnly": True,
        "publicProjectionRequested": False,
        "canonicalAdmissionMutation": False,
        "programAuthorityMutation": False,
        "automaticIdentityMerge": False,
        "sourceSupervisionEntryDoesNotConfirmInstitutionalWorkIdentity": True,
        "exactTitleCandidateDoesNotConfirmPhysicalHolding": True,
        "suspendedThesesExcluded": True,
    }
    if data.get("policy") != required_policy:
        raise ValueError("Unsafe or incomplete T2CY policy")

    t2cx_names = {
        norm(row.get("name")): row
        for row in (t2cx.get("records") or [])
        if norm(row.get("name"))
    }

    source_identities: set[tuple[str, str]] = set()
    decisions: Counter[str] = Counter()
    roles: Counter[str] = Counter()
    evidence_kinds: Counter[str] = Counter()
    overlap_count = 0
    variant_count = 0

    for row in data.get("records") or []:
        source_author = str(row.get("sourceAuthor") or "").strip()
        title = str(row.get("exactTitleCandidate") or "").strip()
        if not source_author or not title:
            raise ValueError("Every supervision entry requires source author and exact title")
        identity_key = (norm(source_author), norm(title))
        if identity_key in source_identities:
            raise ValueError("Duplicate source supervision identity")
        source_identities.add(identity_key)

        date = _parse_date(row.get("approvalDate"))
        if date.year != int(str(row.get("approvalDate"))[:4]):
            raise ValueError("Invalid approval date")

        role = row.get("role")
        if role not in ROLES:
            raise ValueError(f"Unsupported supervision role: {role}")
        roles[role] += 1

        source = row.get("sourceEvidence") or {}
        if source.get("url") != SOURCE_URL or source.get("kind") != "faculty-cv-supervision-list":
            raise ValueError("Every T2CY record must retain the Fernando Leal supervision source")
        _public_url(str(source.get("url") or ""))

        author_status = row.get("authorIdentityStatus")
        if author_status not in AUTHOR_STATUSES:
            raise ValueError("Unsupported author identity status")
        canonical = str(row.get("canonicalName") or "").strip()
        candidate = str(row.get("canonicalCandidate") or "").strip()
        if author_status == "variant-review":
            variant_count += 1
            if canonical or not candidate or row.get("decision") != "author-variant-review":
                raise ValueError("Variant-review author cannot be silently canonicalized")
        elif not canonical:
            raise ValueError("Source-exact author requires a canonical name")

        decision = row.get("decision")
        if decision not in DECISIONS:
            raise ValueError(f"Unsupported decision: {decision}")
        decisions[decision] += 1

        overlap = row.get("overlapsT2CX")
        if not isinstance(overlap, bool):
            raise ValueError("overlapsT2CX must be boolean")
        canonical_key = norm(canonical or candidate or source_author)
        if overlap:
            overlap_count += 1
            if decision != "t2cx-overlap":
                raise ValueError("T2CX overlap requires t2cx-overlap decision")
            match = t2cx_names.get(canonical_key)
            if not match:
                raise ValueError("Claimed T2CX overlap is not present in T2CX")
            if norm(match.get("exactThesisTitle")) != norm(title):
                raise ValueError("T2CX overlap title mismatch")
        elif decision == "t2cx-overlap":
            raise ValueError("t2cx-overlap decision requires overlap flag")
        elif canonical_key in t2cx_names:
            raise ValueError("Existing T2CX identity must be marked as overlap")

        if row.get("institutionalWorkIdentityConfirmed") is not False:
            raise ValueError("T2CY cannot promote supervision evidence to institutional work identity")
        if row.get("physicalHoldingConfirmed") is not False:
            raise ValueError("T2CY cannot infer a physical holding")

        for item in row.get("corroboration") or []:
            url = str(item.get("url") or "")
            _public_url(url)
            kind = str(item.get("kind") or "").strip()
            supports = set(item.get("supports") or [])
            if not item.get("provider") or not kind or not supports or not supports <= ALLOWED_SUPPORTS:
                raise ValueError("Corroboration must be typed, attributed, and use supported claims")
            evidence_kinds[kind] += 1

    total = len(source_identities)
    coverage = data.get("coverage") or {}
    expected = {
        "completedMefEntriesInSource": total,
        "overlapWithT2CX": overlap_count,
        "newNominalCandidates": total - overlap_count,
        "exactTitleCandidates": total,
        "authorVariantReview": variant_count,
        "institutionalWorkIdentitiesConfirmed": 0,
        "physicalHoldingsConfirmed": 0,
        "publicRecordsAdded": 0,
    }
    if coverage != expected:
        raise ValueError(f"Coverage ledger mismatch: expected {expected}, got {coverage}")
    if total != 11 or overlap_count != 1 or total - overlap_count != 10:
        raise ValueError("T2CY frozen source contract drifted from 11 completed / 1 overlap / 10 new candidates")

    return {
        "records": total,
        "decisions": dict(sorted(decisions.items())),
        "roles": dict(sorted(roles.items())),
        "corroborationKinds": dict(sorted(evidence_kinds.items())),
        **expected,
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--t2cx", required=True, type=Path)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    t2cx = json.loads(args.t2cx.read_text(encoding="utf-8"))
    print(json.dumps(validate(data, t2cx), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

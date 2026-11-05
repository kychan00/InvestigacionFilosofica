#!/usr/bin/env python3
"""Validate T2CX MEF thesis-title recovery without promoting unverified work identities."""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
import urllib.parse
from collections import Counter
from pathlib import Path
from typing import Any

SCHEMA = "thesis-mef-title-recovery-t2cx-v1"
PROGRAM_REF = "program:udg:mae-estudios-filosoficos"
DECISIONS = {
    "graduate-only",
    "topic-only",
    "exact-title-pending-institutional",
    "institutional-work-confirmed",
    "physical-holding-confirmed",
    "conflict",
    "unresolved",
}
ALLOWED_SUPPORTS = {
    "graduateIdentity",
    "graduationYear",
    "thesisTopic",
    "exactThesisTitle",
    "thesisDirector",
    "thesisExistence",
    "projectLineage",
    "publicationCandidate",
    "institutionalWorkIdentity",
    "physicalHolding",
}
FORBIDDEN_URL = re.compile(r"(?i)(?:file:|sandbox:|/bitstream/|/download(?:/|$))")


def norm(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text.casefold())
    return " ".join(text.split())


def _validate_evidence(items: list[dict[str, Any]], *, exact: bool = False) -> tuple[bool, Counter[str]]:
    has_exact = False
    kinds: Counter[str] = Counter()
    for item in items:
        url = str(item.get("url") or "")
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or FORBIDDEN_URL.search(url):
            raise ValueError("Evidence URL must be a public reference, not a local/download endpoint")
        provider = str(item.get("provider") or "").strip()
        kind = str(item.get("kind") or "").strip()
        supports = set(item.get("supports") or [])
        if not provider or not kind or not supports or not supports <= ALLOWED_SUPPORTS:
            raise ValueError("Evidence must be attributed, typed, and use supported claims")
        if "physicalHolding" in supports and kind != "institutional-holdings-record":
            raise ValueError("Only an institutional holdings record may support a physical holding")
        if "exactThesisTitle" in supports:
            has_exact = True
        kinds[kind] += 1
    if exact and not has_exact:
        raise ValueError("Exact thesis title requires explicit exact-title evidence")
    return has_exact, kinds


def validate(data: dict[str, Any]) -> dict[str, Any]:
    if data.get("schemaVersion") != SCHEMA:
        raise ValueError("Unsupported T2CX schema")
    if data.get("programRef") != PROGRAM_REF:
        raise ValueError("Wrong programme authority")

    policy = data.get("policy") or {}
    required_policy = {
        "referenceOnly": True,
        "publicProjectionRequested": False,
        "canonicalAdmissionMutation": False,
        "programAuthorityMutation": False,
        "automaticIdentityMerge": False,
        "degreeCountCreatesThesisIdentities": False,
        "exactTitleDoesNotConfirmInstitutionalWorkIdentity": True,
        "exactTitleDoesNotConfirmPhysicalHolding": True,
    }
    if policy != required_policy:
        raise ValueError("Unsafe or incomplete T2CX policy")

    names: set[str] = set()
    decisions: Counter[str] = Counter()
    evidence_kinds: Counter[str] = Counter()
    exact_count = 0
    topic_only_count = 0
    graduate_only_count = 0
    institutional_count = 0
    physical_count = 0

    for row in data.get("records") or []:
        name = str(row.get("name") or "").strip()
        nkey = norm(name)
        if not nkey or nkey in names:
            raise ValueError("Missing or duplicate graduate identity")
        names.add(nkey)

        if row.get("graduateIdentityConfirmed") is not True:
            raise ValueError("T2CX rows must originate from confirmed graduate identities")

        year = row.get("graduationYear")
        if year is not None and (not isinstance(year, int) or year < 1900 or year > 2026):
            raise ValueError("Invalid graduation year")

        topic = str(row.get("thesisTopic") or "").strip()
        title = str(row.get("exactThesisTitle") or "").strip()
        exact_evidence = row.get("exactTitleEvidence") or []
        supporting_evidence = row.get("supportingEvidence") or []
        all_evidence = list(exact_evidence) + list(supporting_evidence)
        if not all_evidence:
            raise ValueError("Every T2CX row requires evidence")
        if not any("graduateIdentity" in set(item.get("supports") or []) for item in all_evidence):
            raise ValueError("Every T2CX row requires explicit graduate-identity support")

        _, exact_kinds = _validate_evidence(exact_evidence, exact=bool(title))
        _, support_kinds = _validate_evidence(supporting_evidence)
        evidence_kinds.update(exact_kinds)
        evidence_kinds.update(support_kinds)

        decision = row.get("decision")
        if decision not in DECISIONS:
            raise ValueError(f"Unsupported decision: {decision}")
        decisions[decision] += 1

        institutional = row.get("institutionalWorkIdentityConfirmed")
        physical = row.get("physicalHoldingConfirmed")
        if not isinstance(institutional, bool) or not isinstance(physical, bool):
            raise ValueError("Identity/holding flags must be booleans")

        identifiers = {
            "catalogIdentifier": row.get("catalogIdentifier"),
            "handle": row.get("handle"),
            "alephSystemNumber": row.get("alephSystemNumber"),
        }

        if title:
            exact_count += 1
            if not exact_evidence:
                raise ValueError("Exact title cannot exist without exact-title evidence")
            if not institutional and decision != "exact-title-pending-institutional":
                raise ValueError("Non-institutional exact title must remain pending institutional identity")
        else:
            if exact_evidence:
                raise ValueError("Exact-title evidence cannot exist without an exact title")
            if topic:
                topic_only_count += 1
                if decision != "topic-only":
                    raise ValueError("Topic without exact title must remain topic-only")
            else:
                graduate_only_count += 1
                if decision != "graduate-only":
                    raise ValueError("Graduate without thesis title/topic must remain graduate-only")

        if institutional:
            institutional_count += 1
            if not title:
                raise ValueError("Institutional work identity requires an exact thesis title")
            if not any(value for value in identifiers.values()):
                raise ValueError("Institutional work identity requires a stable institutional identifier")
            if decision not in {"institutional-work-confirmed", "physical-holding-confirmed"}:
                raise ValueError("Institutional identity requires an institutional decision")
        elif any(value for value in identifiers.values()):
            raise ValueError("Unconfirmed institutional identity cannot persist catalog/handle/SYS identifiers")

        if physical:
            physical_count += 1
            if not institutional or not row.get("alephSystemNumber"):
                raise ValueError("Physical holding requires institutional identity and Aleph SYS")
            if decision != "physical-holding-confirmed":
                raise ValueError("Physical holding requires physical-holding-confirmed decision")
            if not any("physicalHolding" in set(item.get("supports") or []) for item in all_evidence):
                raise ValueError("Physical holding requires explicit holdings evidence")
        elif decision == "physical-holding-confirmed":
            raise ValueError("Physical-holding decision requires a confirmed holding")

    coverage = data.get("coverage") or {}
    expected = {
        "controlSchoolDegrees2018_2025": 45,
        "knownGraduateIdentities": len(names),
        "exactThesisTitlesRecovered": exact_count,
        "thesisTopicsWithoutExactTitle": topic_only_count,
        "graduateOnlyWithoutExactTitle": graduate_only_count,
        "institutionalWorkIdentitiesConfirmed": institutional_count,
        "physicalHoldingsConfirmed": physical_count,
        "publicRecordsAdded": 0,
    }
    if coverage != expected:
        raise ValueError(f"Coverage ledger mismatch: expected {expected}, got {coverage}")
    if len(names) >= coverage["controlSchoolDegrees2018_2025"]:
        raise ValueError("Nominal recovery must not reinterpret the aggregate 45-degree count as thesis identities")

    return {
        "records": len(names),
        "decisions": dict(sorted(decisions.items())),
        "evidenceKinds": dict(sorted(evidence_kinds.items())),
        **expected,
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, type=Path)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    print(json.dumps(validate(data), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

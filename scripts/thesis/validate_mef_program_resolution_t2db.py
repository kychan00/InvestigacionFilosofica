#!/usr/bin/env python3
"""Validate T2DB MEF programme resolution without inventing thesis work identities."""
from __future__ import annotations

import argparse
import json
import re
import urllib.parse
from pathlib import Path
from typing import Any

SCHEMA = "thesis-mef-program-resolution-t2db-v1"
PROGRAM_REF = "program:udg:mae-estudios-filosoficos"
FORBIDDEN = re.compile(r"(?i)(?:file:|sandbox:|/bitstream/|/download(?:/|$)|\.pdf(?:$|[?#]))")


def public_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or FORBIDDEN.search(url):
        raise ValueError("Evidence URL must be a public reference page")


def walk_urls(value: Any) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in {"url", "thesisCollectionUrl"} and child:
                public_url(str(child))
            walk_urls(child)
    elif isinstance(value, list):
        for child in value:
            walk_urls(child)


def validate(data: dict[str, Any], t2da: dict[str, Any]) -> dict[str, Any]:
    if data.get("schemaVersion") != SCHEMA:
        raise ValueError("Unsupported T2DB schema")
    if data.get("programRef") != PROGRAM_REF:
        raise ValueError("Wrong programme authority")

    required_policy = {
        "referenceOnly": True,
        "publicProjectionRequested": False,
        "canonicalAdmissionMutation": False,
        "programAuthorityMutation": False,
        "automaticIdentityMerge": False,
        "institutionalProgramEvidenceDoesNotEqualWorkIdentity": True,
        "noStableWorkIdentifierMeansNoInstitutionalWorkPromotion": True,
        "negativeRepositorySearchDoesNotProveAbsence": True,
        "derivedPublicationDoesNotEqualThesis": True,
    }
    if data.get("policy") != required_policy:
        raise ValueError("Unsafe or incomplete T2DB policy")

    walk_urls(data)

    if (t2da.get("schemaVersion") or "") != "thesis-mef-post-aleph-corroboration-t2da-v1":
        raise ValueError("T2DB requires T2DA")
    if (t2da.get("coverage") or {}).get("institutionalWorkIdentitiesConfirmed") != 0:
        raise ValueError("T2DB assumes zero work-level identities from T2DA")

    context = data.get("repositoryContext") or {}
    if context.get("role") != "discovery-context-only":
        raise ValueError("RIUdeG collection context cannot be treated as thesis identity")
    if int(context.get("observedCollectionSize") or 0) <= 0:
        raise ValueError("RIUdeG collection size observation missing")

    cases = data.get("priorityCases") or []
    if len(cases) != 3:
        raise ValueError("T2DB frozen priority set must contain exactly three cases")

    names = {str(r.get("author") or "") for r in cases}
    if names != {
        "Mario Damián Del Muro Silva",
        "Adriel Manuel Hernández Guzmán",
        "Jesús Octavio Campos Ramos",
    }:
        raise ValueError("Unexpected T2DB priority set")

    institutional = 0
    upgraded = 0
    unresolved = 0
    for row in cases:
        if (row.get("thesisCitation") or {}).get("status") != "institutional-bibliography-corroborated":
            raise ValueError("Every T2DB case must originate from T2DA bibliography corroboration")
        if row.get("thesisSpecificHandle") is not None or row.get("alephSystemNumber") is not None:
            raise ValueError("T2DB cannot invent thesis-specific identifiers")
        if row.get("institutionalWorkIdentityConfirmed") is not False:
            raise ValueError("Programme authority does not create work-level identity")
        if row.get("physicalHoldingConfirmed") is not False:
            raise ValueError("Programme authority does not create physical holdings")
        if row.get("workLevelSearchOutcome") != "no-stable-work-level-identifier-recovered":
            raise ValueError("Unexpected work-level search outcome")

        if row.get("mefProgramInstitutionallyConfirmed") is True:
            institutional += 1
            evidence = row.get("programEvidence") or []
            if not evidence:
                raise ValueError("Institutional programme confirmation requires programme evidence")
            if not any(str(x.get("kind") or "").startswith("official-udg-") for x in evidence):
                raise ValueError("MEF programme confirmation requires official UdeG evidence")
        else:
            unresolved += 1
            if row.get("programStatus") != "unresolved":
                raise ValueError("Non-confirmed programme must remain unresolved")

        if row.get("upgradedFromT2DA"):
            upgraded += 1
            if row.get("author") != "Adriel Manuel Hernández Guzmán":
                raise ValueError("Only Adriel is upgraded from noninstitutional to institutional programme evidence")
            if row.get("upgradedFromT2DA") != "mef-author-controlled-corroboration":
                raise ValueError("Unexpected T2DA upgrade source state")

    variants = data.get("titleVariantAdjudications") or []
    if len(variants) != 1 or variants[0].get("author") != "Adriel Manuel Hernández Guzmán":
        raise ValueError("Adriel title variant must remain explicit")
    if variants[0].get("sameWorkConfirmed") is not False:
        raise ValueError("Title variant cannot be silently merged without work-level evidence")
    if variants[0].get("decision") != "preserve-both-forms-until-work-level-source":
        raise ValueError("Unexpected title-variant decision")

    closure = data.get("workLevelSearchClosure") or {}
    if closure.get("exactStableIdentifiersRecovered") != 0:
        raise ValueError("T2DB found no stable work-level identifiers")
    if closure.get("thesisHandlesRecovered") != 0 or closure.get("alephSystemNumbersRecovered") != 0:
        raise ValueError("No thesis handles or SYS values may be introduced")

    expected = {
        "priorityCases": 3,
        "mefProgramsInstitutionallyConfirmed": institutional,
        "programsUpgradedFromNoninstitutionalToInstitutional": upgraded,
        "programsStillUnresolved": unresolved,
        "thesisSpecificInstitutionalIdentifiersAdded": 0,
        "institutionalWorkIdentitiesConfirmed": 0,
        "physicalHoldingsConfirmed": 0,
        "publicRecordsAdded": 0,
    }
    if data.get("coverage") != expected:
        raise ValueError(f"Coverage mismatch: expected {expected}, got {data.get('coverage')}")

    return expected


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--t2da", required=True, type=Path)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    t2da = json.loads(args.t2da.read_text(encoding="utf-8"))
    print(json.dumps(validate(data, t2da), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

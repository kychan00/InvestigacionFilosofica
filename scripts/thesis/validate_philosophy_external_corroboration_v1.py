#!/usr/bin/env python3
"""Validate T2CS external corroboration without promoting bibliographic identity."""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
import urllib.parse
from collections import Counter
from pathlib import Path
from typing import Any

SCHEMA="thesis-philosophy-external-corroboration-v1"
CLAIMS={"workExistence","titleAuthor","udgAffiliation","philosophyProgram","physicalLocation"}
ALLOWED={
    "corroborated","corroborated-secondary","candidate-lineage-corroborated",
    "variant-lineage-corroborated","degree-corroborated","unresolved"
}
FORBIDDEN_LOCAL=re.compile(r"(?i)(?:^|/)(?:bitstream|download)(?:/|$)|file://|sandbox:")

def norm(value: Any) -> str:
    text=unicodedata.normalize("NFD",str(value or ""))
    text="".join(ch for ch in text if unicodedata.category(ch)!="Mn")
    return " ".join(re.sub(r"[^a-z0-9]+"," ",text.casefold()).split())

def validate(data: dict[str,Any]) -> dict[str,Any]:
    if data.get("schemaVersion")!=SCHEMA:
        raise ValueError("Unsupported corroboration schema")
    policy=data.get("policy") or {}
    required_policy={
        "referenceOnly":True,
        "canonicalAdmissionMutation":False,
        "physicalLocationMutation":False,
        "automaticIdentityMerge":False,
        "externalEvidenceMayCorroborateExistence":True,
        "externalEvidenceAloneMayNotAssertPhysicalHolding":True,
    }
    for key,value in required_policy.items():
        if policy.get(key) is not value:
            raise ValueError(f"Invalid policy guard: {key}")
    seen=set()
    provider_counts=Counter()
    evidence_count=0
    claim_counts=Counter()
    for record in data.get("records") or []:
        key=(norm(record.get("sourceTitle")),norm(record.get("sourceAuthor")))
        if not all(key) or key in seen:
            raise ValueError("Missing or duplicate source identity")
        seen.add(key)
        claims=record.get("claims") or {}
        if set(claims)!=CLAIMS:
            raise ValueError("Each record must expose the complete claim surface")
        for name,status in claims.items():
            if status not in ALLOWED:
                raise ValueError(f"Invalid claim status {name}={status}")
            claim_counts[f"{name}:{status}"]+=1
        if claims["physicalLocation"]!="unresolved":
            raise ValueError("External corroboration cannot establish a physical location")
        identity_policy=str(record.get("identityPolicy") or "")
        if not identity_policy:
            raise ValueError("Every record requires an identity policy")
        evidence=record.get("evidence") or []
        if not evidence:
            raise ValueError("Every record requires evidence")
        for item in evidence:
            url=str(item.get("url") or "")
            parsed=urllib.parse.urlparse(url)
            if parsed.scheme not in {"http","https"} or not parsed.hostname:
                raise ValueError("Evidence requires a public http(s) reference")
            if FORBIDDEN_LOCAL.search(url):
                raise ValueError("Do not encode download/bitstream/local artifact endpoints")
            supports=item.get("supports") or []
            if not supports or any(s not in CLAIMS or s=="physicalLocation" for s in supports):
                raise ValueError("Evidence support claim is invalid")
            if not item.get("evidenceKind") or not item.get("provider"):
                raise ValueError("Evidence must be typed and attributed")
            provider_counts[str(item["provider"])]+=1
            evidence_count+=1
        # Lineage evidence is deliberately weaker than exact thesis identity.
        lineage = any("lineage" in str(claims[name]) for name in ("workExistence","titleAuthor"))
        if lineage and (
            claims["workExistence"]=="corroborated" or claims["titleAuthor"]=="corroborated"
        ):
            raise ValueError("Derived-work lineage cannot be upgraded to exact work identity")
    return {
        "records":len(seen),
        "evidenceReferences":evidence_count,
        "providers":dict(sorted(provider_counts.items())),
        "claims":dict(sorted(claim_counts.items())),
        "physicalLocationsConfirmed":0,
        "automaticIdentityMerges":0,
    }

def main()->int:
    p=argparse.ArgumentParser()
    p.add_argument("--input",required=True,type=Path)
    args=p.parse_args()
    data=json.loads(args.input.read_text(encoding="utf-8"))
    metrics=validate(data)
    print(json.dumps(metrics,ensure_ascii=False,sort_keys=True))
    return 0

if __name__=="__main__":
    raise SystemExit(main())

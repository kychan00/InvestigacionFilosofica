#!/usr/bin/env python3
"""Validate T2CW Maestría graduate evidence without fabricating thesis identities."""
from __future__ import annotations
import argparse
import json
import re
import unicodedata
import urllib.parse
from collections import Counter
from pathlib import Path
from typing import Any

SCHEMA="thesis-mef-graduate-evidence-ledger-v1"
LEVELS={"graduate-confirmed","thesis-topic-confirmed","thesis-title-confirmed"}
TITLE_STATUSES={"not-recovered","exact-from-author-cv"}
ALLOWED_SUPPORTS={"graduate","graduationYear","exactThesisTitle","thesisTopic","projectLineage"}
FORBIDDEN_URL=re.compile(r"(?i)(?:file:|sandbox:|/bitstream/|/download(?:/|$))")

def norm(value:Any)->str:
    text=unicodedata.normalize("NFD",str(value or ""))
    text="".join(ch for ch in text if unicodedata.category(ch)!="Mn")
    text=re.sub(r"[^a-z0-9]+"," ",text.casefold())
    return " ".join(text.split())

def validate(data:dict[str,Any])->dict[str,Any]:
    if data.get("schemaVersion")!=SCHEMA:
        raise ValueError("Unsupported T2CW schema")
    if data.get("programRef")!="program:udg:mae-estudios-filosoficos":
        raise ValueError("Wrong programme authority")
    for key,expected in {
        "referenceOnly":True,
        "publicProjectionRequested":False,
        "physicalHoldingsClaimed":False,
        "degreeCountsCreateThesisIdentities":False,
    }.items():
        if data.get(key) is not expected:
            raise ValueError(f"Unsafe T2CW guard: {key}")

    names=set()
    levels=Counter()
    exact_count=0
    topic_count=0
    graduate_only_count=0
    source_kinds=Counter()

    for row in data.get("records") or []:
        name=str(row.get("name") or "").strip()
        nkey=norm(name)
        if not nkey or nkey in names:
            raise ValueError("Missing or duplicate graduate identity")
        names.add(nkey)

        level=row.get("evidenceLevel")
        if level not in LEVELS:
            raise ValueError(f"Unsupported evidence level: {level}")
        levels[level]+=1

        year=row.get("graduationYear")
        if year is not None and (not isinstance(year,int) or year<1900 or year>2026):
            raise ValueError("Invalid graduation year")

        thesis=row.get("thesis") or {}
        status=thesis.get("titleStatus")
        if status not in TITLE_STATUSES:
            raise ValueError("Unsupported thesis title status")
        title=str(thesis.get("title") or "").strip()
        topic=str(thesis.get("topic") or "").strip()

        if level=="thesis-title-confirmed":
            if not title or status!="exact-from-author-cv":
                raise ValueError("Exact-title level requires exact thesis title")
            exact_count+=1
        elif level=="thesis-topic-confirmed":
            if title or not topic or status!="not-recovered":
                raise ValueError("Topic-only level cannot invent an exact title")
            topic_count+=1
        else:
            if title or topic or status!="not-recovered":
                raise ValueError("Graduate-only record cannot imply thesis identity")
            graduate_only_count+=1

        evidence=row.get("evidence") or []
        if not evidence:
            raise ValueError("Every graduate requires evidence")
        has_graduate_support=False
        for item in evidence:
            url=str(item.get("url") or "")
            parsed=urllib.parse.urlparse(url)
            if parsed.scheme not in {"http","https"} or not parsed.hostname or FORBIDDEN_URL.search(url):
                raise ValueError("Evidence URL must be a public non-download reference")
            supports=set(item.get("supports") or [])
            if not supports or not supports<=ALLOWED_SUPPORTS:
                raise ValueError("Unsupported evidence claim")
            if "graduate" in supports:
                has_graduate_support=True
            source_kinds[str(item.get("kind") or "")]+=1
        if not has_graduate_support:
            raise ValueError("Every graduate record needs explicit degree support")

    coverage=data.get("coverage") or {}
    expected={
        "controlSchoolDegrees2018_2025":45,
        "knownGraduateIdentities":len(names),
        "exactThesisTitlesRecovered":exact_count,
        "thesisTopicsWithoutExactTitle":topic_count,
        "graduateOnlyWithoutThesisIdentity":graduate_only_count,
    }
    if coverage!=expected:
        raise ValueError(f"Coverage ledger mismatch: expected {expected}, got {coverage}")

    return {
        "records":len(names),
        "levels":dict(sorted(levels.items())),
        "sourceKinds":dict(sorted(source_kinds.items())),
        "controlSchoolDegrees2018_2025":45,
        "exactThesisTitlesRecovered":exact_count,
        "thesisTopicsWithoutExactTitle":topic_count,
        "graduateOnlyWithoutThesisIdentity":graduate_only_count,
        "publicRecordsAdded":0,
        "physicalHoldingsAdded":0,
    }

def main()->int:
    p=argparse.ArgumentParser()
    p.add_argument("--input",required=True,type=Path)
    a=p.parse_args()
    data=json.loads(a.input.read_text(encoding="utf-8"))
    print(json.dumps(validate(data),ensure_ascii=False,sort_keys=True))
    return 0

if __name__=="__main__":
    raise SystemExit(main())

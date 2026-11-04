#!/usr/bin/env python3
"""T2CU — Expand the public Philosophy view with the official CUCSH inventory.

The CUCSH catalogue is treated as an institutional bibliographic source for
exact-program Licenciatura en Filosofía references. This projection never
claims a physical holding merely because a catalogue record exists.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

BASE_SCHEMA="thesis-philosophy-public-index-v1"
CUCSH_SCHEMA="thesis-cucsh-catalog-recon-v1"
REVISION="2026-11-04.t2cu-v1"
PROGRAM="Licenciatura en Filosofía"
PROGRAM_REF="program:udg:lic-filosofia"
ALLOWED_HOSTS={"biblioteca.cucsh.udg.mx","www.biblioteca.cucsh.udg.mx"}
FORBIDDEN=(".pdf","/bitstream","/download")

def norm(value: Any) -> str:
    text=unicodedata.normalize("NFD",str(value or ""))
    text="".join(ch for ch in text if unicodedata.category(ch)!="Mn")
    text=text.casefold()
    text=re.sub(r"[^a-z0-9]+"," ",text)
    return " ".join(text.split())

def year(value: Any) -> int|None:
    text=str(value or "").strip()
    return int(text) if re.fullmatch(r"(?:19|20)\d{2}",text) else None

def key(*,title:Any,author:Any,year_value:Any)->tuple[str,str,int|None]:
    return norm(title),norm(author),year(year_value)

def safe_cucsh_url(value: Any) -> str|None:
    if not isinstance(value,str) or not value:
        return None
    try:
        p=urllib.parse.urlparse(value)
    except ValueError:
        return None
    host=(p.hostname or "").casefold()
    if p.scheme not in {"http","https"} or host not in ALLOWED_HOSTS:
        return None
    if p.username or p.password or p.port not in (None,80,443):
        return None
    decoded=urllib.parse.unquote(value).casefold()
    if any(token in decoded for token in FORBIDDEN):
        return None
    # Public pages are HTTPS. Upgrade the legacy CUCSH catalogue reference
    # without altering host/path/query identity.
    return urllib.parse.urlunparse(("https",p.netloc,p.path,p.params,p.query,""))

def stable_id(row:dict[str,Any])->str:
    identity="|".join([
        norm(row.get("title")),norm(row.get("author")),
        str(year(row.get("year")) or ""),PROGRAM_REF,
    ])
    digest=hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
    return f"philosophy:cucsh:{digest}"

def inventory_rows(report:dict[str,Any])->list[dict[str,Any]]:
    if report.get("schemaVersion")!=CUCSH_SCHEMA:
        raise ValueError("Unsupported CUCSH catalogue report")
    if report.get("referenceOnly") is not True or report.get("rawHtmlPersisted") is not False:
        raise ValueError("CUCSH input must remain metadata-only")
    rows=[]
    for group in report.get("philosophyInventories") or []:
        if norm(group.get("program"))!=norm(PROGRAM):
            continue
        for row in group.get("records") or []:
            if norm(row.get("program"))!=norm(PROGRAM):
                raise ValueError("Mixed programme inside CUCSH Philosophy inventory")
            if not row.get("title") or not row.get("author"):
                raise ValueError("Incomplete CUCSH bibliographic row")
            rows.append(row)
    if not rows:
        raise ValueError("No CUCSH Licenciatura en Filosofía records")
    return rows

def collapse_inventory(rows:list[dict[str,Any]])->tuple[list[dict[str,Any]],list[dict[str,Any]]]:
    groups:dict[tuple[str,str,int|None],list[dict[str,Any]]]=defaultdict(list)
    for row in rows:
        groups[key(title=row["title"],author=row["author"],year_value=row.get("year"))].append(row)
    unique=[]
    duplicates=[]
    for identity,bucket in groups.items():
        chosen=sorted(bucket,key=lambda r:(0 if r.get("recordUrl") else 1,norm(r.get("title")),str(r.get("recordUrl") or "")))[0]
        item=json.loads(json.dumps(chosen,ensure_ascii=False))
        urls=[]
        for row in bucket:
            safe=safe_cucsh_url(row.get("recordUrl"))
            if safe and safe not in urls:
                urls.append(safe)
        item["catalogUrls"]=urls
        item["sourceRowCount"]=len(bucket)
        unique.append(item)
        if len(bucket)>1:
            duplicates.append({
                "identity":{"title":identity[0],"author":identity[1],"year":identity[2]},
                "sourceRows":len(bucket),
                "catalogUrls":urls,
            })
    unique.sort(key=lambda r:(year(r.get("year")) or 0,norm(r["title"]),norm(r["author"])))
    return unique,duplicates

def public_director(value:Any)->str|None:
    text=str(value or "").strip()
    if not text:
        return None
    if re.fullmatch(r"(?:19|20)\d{2}",text):
        return None
    if norm(text) in {"no tiene","tesis","tesina"}:
        return None
    return text

def public_record(row:dict[str,Any])->dict[str,Any]:
    url=safe_cucsh_url(row.get("recordUrl"))
    if not url:
        raise ValueError(f"CUCSH record lacks a safe detail URL: {row.get('title')}")
    director=public_director(row.get("director"))
    quality_flags=[]
    if year(row.get("year")) is None:
        quality_flags.append("invalid-or-missing-year")
    if int(row.get("sourceRowCount") or 1)>1:
        quality_flags.append("duplicate-catalog-row-collapsed")
    return {
        "id":stable_id(row),
        "canonicalWorkId":None,
        "title":row["title"],
        "authors":[row["author"]],
        "directors":[director] if director else [],
        "year":year(row.get("year")),
        "dateQuality":"valid" if year(row.get("year")) else "unknown",
        "program":PROGRAM,
        "programRef":PROGRAM_REF,
        "degree":"licenciatura",
        "unit":"Centro Universitario de Ciencias Sociales y Humanidades",
        "abstractExcerpt":"",
        "keywords":[],
        "sourceUrl":url,
        "handle":None,
        "philosophyStatus":"include",
        "philosophyRole":"program-core",
        "classificationSource":"official-cucsh-catalog",
        "philosophyEvidence":"La Biblioteca CUCSH cataloga esta referencia bajo Licenciatura en Filosofía.",
        "validationTier":"official-cucsh-library-record",
        "sourceKind":"official-cucsh-inventory",
        "sourceLabel":"Biblioteca CUCSH",
        "provider":"cucsh-library",
        "providerRecordId":url,
        "referenceUrl":url,
        "evidenceUrls":list(row.get("catalogUrls") or []),
        "cucshCatalog":{
            "sourceRowCount":row.get("sourceRowCount",1),
            "catalogUrls":list(row.get("catalogUrls") or []),
            "coauthorRaw":row.get("coauthor") or "",
            "directorRaw":row.get("director") or "",
            "dataQualityFlags":quality_flags,
        },
    }

def merge(base:dict[str,Any],report:dict[str,Any])->dict[str,Any]:
    if base.get("schemaVersion")!=BASE_SCHEMA or base.get("revision")!="2026-11-04.t2ct-v1":
        raise ValueError("T2CU requires the verified T2CT public base")
    if base.get("referenceOnly") is not True or base.get("canonicalAdmissionMutation") is not False:
        raise ValueError("Unsafe public Philosophy base")

    raw=inventory_rows(report)
    unique,duplicates=collapse_inventory(raw)
    output=json.loads(json.dumps(base,ensure_ascii=False))
    by_key={
        key(title=r["title"],author=(r.get("authors") or [""])[0],year_value=r.get("year")):r
        for r in output.get("records") or []
    }
    exact_merges=0
    added=0
    for source in unique:
        identity=key(title=source["title"],author=source["author"],year_value=source.get("year"))
        existing=by_key.get(identity)
        if existing:
            exact_merges+=1
            urls=existing.setdefault("evidenceUrls",[])
            for url in source.get("catalogUrls") or []:
                if url not in urls:
                    urls.append(url)
            existing["cucshCatalog"]={
                "sourceRowCount":source.get("sourceRowCount",1),
                "catalogUrls":list(source.get("catalogUrls") or []),
                "coauthorRaw":source.get("coauthor") or "",
                "directorRaw":source.get("director") or "",
                "dataQualityFlags":(
                    ["invalid-or-missing-year"] if year(source.get("year")) is None else []
                ) + (
                    ["duplicate-catalog-row-collapsed"]
                    if int(source.get("sourceRowCount") or 1)>1 else []
                ),
            }
            continue
        item=public_record(source)
        if item["id"] in {r["id"] for r in output["records"]}:
            raise ValueError("Stable CUCSH public id collision")
        output["records"].append(item)
        by_key[identity]=item
        added+=1

    ids=[r["id"] for r in output["records"]]
    if len(ids)!=len(set(ids)):
        raise ValueError("Duplicate public Philosophy ids after CUCSH merge")
    output["records"].sort(key=lambda r:(
        0 if r["philosophyStatus"]=="include" else 1,
        0 if r["philosophyRole"]=="program-core" else 1,
        -(r.get("year") or 0),norm(r["title"]),r["id"],
    ))
    statuses=Counter(r["philosophyStatus"] for r in output["records"])
    roles=Counter(r["philosophyRole"] for r in output["records"])
    programs=sorted({r["program"] for r in output["records"] if r.get("program")},key=norm)

    for documented in output.get("documentedPhilosophyPrograms") or []:
        rows=[r for r in output["records"] if r.get("programRef")==documented["programRef"]]
        documented["records"]=len(rows)
        documented["include"]=sum(r["philosophyStatus"]=="include" for r in rows)
        documented["review"]=sum(r["philosophyStatus"]=="review" for r in rows)

    output["revision"]=REVISION
    output["metrics"]={
        "records":len(output["records"]),
        "byStatus":dict(sorted(statuses.items())),
        "byRole":dict(sorted(roles.items())),
        "actualProgramsRepresented":len(programs),
        "corroboratedReviewRecords":sum(bool(r.get("externalCorroboration")) for r in output["records"]),
    }
    output["actualProgramsRepresented"]=programs
    output["cucshHistoricalInventory"]={
        "sourceRevision":report.get("revision"),
        "sourceRows":len(raw),
        "uniqueBibliographicIdentities":len(unique),
        "duplicateSourceRowsCollapsed":len(raw)-len(unique),
        "duplicateGroups":len(duplicates),
        "exactMergesWithT2CT":exact_merges,
        "newPublicReferences":added,
        "programme":PROGRAM,
        "physicalHoldingsClaimed":False,
        "unknownYearReferences":sum(year(row.get("year")) is None for row in unique),
        "duplicates":duplicates,
    }
    return output

def main()->int:
    p=argparse.ArgumentParser()
    p.add_argument("--base-index",required=True,type=Path)
    p.add_argument("--cucsh-report",required=True,type=Path)
    p.add_argument("--output",required=True,type=Path)
    a=p.parse_args()
    data=merge(
        json.loads(a.base_index.read_text(encoding="utf-8")),
        json.loads(a.cucsh_report.read_text(encoding="utf-8")),
    )
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print(json.dumps({
        "metrics":data["metrics"],
        "cucshHistoricalInventory":data["cucshHistoricalInventory"],
    },ensure_ascii=False,sort_keys=True))
    return 0

if __name__=="__main__":
    raise SystemExit(main())

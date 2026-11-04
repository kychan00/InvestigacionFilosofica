#!/usr/bin/env python3
"""T2CV — Recover Philosophy master's references from the unfiltered CUCSH catalogue.

The server-side programme filters currently return zero for both Philosophy
master labels. This tool crawls the *unfiltered* master's listing, then selects
rows by the programme column locally. It is reference-only and does not infer
physical holdings or fabricate thesis identities from degree counts.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import time
import unicodedata
import urllib.parse
from collections import Counter
from pathlib import Path
from typing import Any, Callable

ROOT=Path(__file__).resolve().parents[2]
T2CJ_PATH=ROOT/"scripts/thesis/probe_cucsh_thesis_catalog_v1.py"
spec=importlib.util.spec_from_file_location("t2cj_master_recovery",T2CJ_PATH)
t2cj=importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(t2cj)

SCHEMA="thesis-cucsh-philosophy-masters-recovery-v1"
REVISION="2026-11-04.t2cv-v1"
MASTER_URLS=(
    "https://www.biblioteca.cucsh.udg.mx/vista-tesis-maestria",
    "http://www.biblioteca.cucsh.udg.mx/vista-tesis-maestria",
)
PROGRAMS={
    "maestria en estudios filosoficos":{
        "programRef":"program:udg:mae-estudios-filosoficos",
        "canonicalName":"Maestría en Estudios Filosóficos",
        "lifecycle":"current",
    },
    "maestria en filosofia":{
        "programRef":"program:udg:mae-filosofia-historica",
        "canonicalName":"Maestría en Filosofía",
        "lifecycle":"historical",
    },
}


def norm(value:Any)->str:
    text=unicodedata.normalize("NFD",str(value or ""))
    text="".join(ch for ch in text if unicodedata.category(ch)!="Mn")
    text=re.sub(r"[^a-z0-9]+"," ",text.casefold())
    return " ".join(text.split())


def safe_year(value:Any)->int|None:
    raw=str(value or "").strip()
    return int(raw) if re.fullmatch(r"(?:19|20)\d{2}",raw) else None


def master_page_url(base_url:str,page:int)->str:
    parsed=urllib.parse.urlparse(base_url)
    query=urllib.parse.urlencode({"q":"vista-tesis-maestria","page":str(page)})
    return urllib.parse.urlunparse((parsed.scheme,parsed.netloc,"/","",query,""))


def page_indexes(parsed:dict[str,Any])->list[int]:
    values=[]
    for link in parsed.get("safeLinks") or []:
        try:
            query=urllib.parse.parse_qs(urllib.parse.urlparse(link["url"]).query)
        except (KeyError,ValueError):
            continue
        raw=(query.get("page") or [None])[0]
        if raw is not None and str(raw).isdigit():
            values.append(int(raw))
    return sorted(set(values))


def records_from_page(parsed:dict[str,Any],*,page_url:str)->list[dict[str,Any]]:
    title_urls:dict[str,list[str]]={}
    for link in parsed.get("safeLinks") or []:
        safe=t2cj.safe_catalog_url(link.get("url"),base_url=page_url)
        if not safe or "content/" not in urllib.parse.unquote(safe).casefold():
            continue
        key=norm(link.get("text"))
        if key:
            title_urls.setdefault(key,[])
            if safe not in title_urls[key]:
                title_urls[key].append(safe)

    records=[]
    for cells in parsed.get("_allRows") or []:
        if len(cells)<6 or norm(cells[0]) in {"titulo","title"}:
            continue
        title=cells[0].strip()
        program=cells[5].strip()
        candidates=title_urls.get(norm(title),[])
        records.append({
            "title":title,
            "author":cells[1].strip(),
            "coauthor":cells[2].strip(),
            "director":cells[3].strip(),
            "yearRaw":cells[4].strip(),
            "year":safe_year(cells[4]),
            "programRaw":program,
            "recordUrl":candidates[0] if candidates else None,
            "recordUrlAlternates":candidates[1:],
            "catalogPageUrl":page_url,
        })
    return records


def crawl_unfiltered(
    *,
    fetcher:Callable[...,tuple[str,str,int,str,str,list[dict[str,str]]]]|None=None,
    delay:float=0.03,
    max_pages:int=320,
)->dict[str,Any]:
    fetcher=fetcher or t2cj.fetch_with_fallback
    html,final_url,status,content_type,requested,failures=fetcher(MASTER_URLS)
    first=t2cj.parse_full_page(html,base_url=final_url)
    indexes=page_indexes(first)
    last=max(indexes) if indexes else 0
    if last+1>max_pages:
        raise ValueError(f"Master catalogue pagination exceeds safety bound: {last+1}")

    pages=[]
    rows=[]
    signatures=set()
    for page in range(last+1):
        if page==0:
            current_html,current_url,current_status,current_type,current_failures=(
                html,final_url,status,content_type,failures
            )
            parsed=first
        else:
            url=master_page_url(final_url,page)
            current_html,current_url,current_status,current_type,_requested,current_failures=fetcher(
                (url,t2cj.alternate_scheme(url))
            )
            parsed=t2cj.parse_full_page(current_html,base_url=current_url)
        current=records_from_page(parsed,page_url=current_url)
        signature=hashlib.sha256(
            json.dumps(current,ensure_ascii=False,sort_keys=True).encode("utf-8")
        ).hexdigest()
        if signature in signatures:
            raise ValueError(f"Repeated unfiltered master page before expected end: {page}")
        signatures.add(signature)
        pages.append({
            "page":page,
            "url":current_url,
            "rows":len(current),
            "httpStatus":current_status,
            "contentType":current_type,
            "htmlSha256":hashlib.sha256(current_html.encode("utf-8")).hexdigest(),
            "failuresBeforeSuccess":current_failures,
        })
        rows.extend(current)
        if delay and page<last:
            time.sleep(delay)

    return {
        "landingRequestedUrl":requested,
        "landingFinalUrl":final_url,
        "lastPageIndex":last,
        "pagesFetched":len(pages),
        "rows":rows,
        "pageEvidence":pages,
    }


def unique_program_records(rows:list[dict[str,Any]])->tuple[list[dict[str,Any]],list[dict[str,Any]]]:
    selected=[]
    for row in rows:
        meta=PROGRAMS.get(norm(row.get("programRaw")))
        if not meta:
            continue
        item=dict(row)
        item.update(meta)
        selected.append(item)

    unique={}
    duplicates=[]
    for row in selected:
        identity=(norm(row["title"]),norm(row["author"]),row.get("year"),row["programRef"])
        if identity in unique:
            duplicates.append({
                "identity":{
                    "title":identity[0],"author":identity[1],
                    "year":identity[2],"programRef":identity[3],
                },
                "recordUrls":[u for u in [
                    unique[identity].get("recordUrl"),row.get("recordUrl")
                ] if u],
            })
            continue
        unique[identity]=row
    output=sorted(
        unique.values(),
        key=lambda r:(r["lifecycle"],-(r.get("year") or 0),norm(r["title"]),norm(r["author"])),
    )
    return output,duplicates


def control_school_counts(report:dict[str,Any])->dict[str,Any]:
    if report.get("schemaVersion")!="thesis-control-school-degree-recon-v1":
        raise ValueError("Unsupported Control Escolar report")
    by_year={}
    total=0
    for file in report.get("files") or []:
        count=0
        rows=[]
        for sheet in file.get("sheets") or []:
            for row in sheet.get("relevantRows") or []:
                if "philosophy-masters" not in (row.get("signals") or []):
                    continue
                values=row.get("values") or []
                numeric=None
                for value in values[2:]:
                    raw=str(value).strip()
                    if re.fullmatch(r"\d+(?:\.0)?",raw):
                        numeric=int(float(raw))
                        break
                if numeric is None:
                    raise ValueError(f"Missing Control Escolar count: {file.get('year')} row {row.get('row')}")
                count+=numeric
                rows.append({"sheet":sheet.get("name"),"row":row.get("row"),"count":numeric})
        by_year[str(file.get("year"))]={"degrees":count,"evidenceRows":rows}
        total+=count
    return {"byYear":by_year,"total2018_2025":total}


def filtered_catalog_counts(report:dict[str,Any])->dict[str,int]:
    if report.get("schemaVersion")!="thesis-cucsh-catalog-recon-v1":
        raise ValueError("Unsupported T2CJ catalogue report")
    counts={"current":0,"historical":0}
    for group in report.get("philosophyInventories") or []:
        key=norm(group.get("program"))
        meta=PROGRAMS.get(key)
        if meta:
            counts[meta["lifecycle"]]+=int(group.get("count") or 0)
    return counts


def known_public_seeds(official:dict[str,Any],curated:dict[str,Any])->list[dict[str,Any]]:
    seeds=[]
    for row in official.get("seedRecords") or []:
        if norm(row.get("program"))==norm("Maestría en Estudios Filosóficos"):
            seeds.append({
                "title":row.get("title"),
                "author":(row.get("authors") or [""])[0],
                "year":row.get("year"),
                "status":"include",
                "source":"official-supplement",
            })
    for row in curated.get("records") or []:
        if norm(row.get("actualProgram"))==norm("Maestría en Estudios Filosóficos"):
            seeds.append({
                "title":row.get("title"),
                "author":(row.get("authors") or [""])[0],
                "year":row.get("year"),
                "status":row.get("status"),
                "source":"curated-reference",
            })
    return seeds


def seed_matches(records:list[dict[str,Any]],seeds:list[dict[str,Any]])->list[dict[str,Any]]:
    by_pair={(norm(r["title"]),norm(r["author"])):r for r in records}
    output=[]
    for seed in seeds:
        row=by_pair.get((norm(seed["title"]),norm(seed["author"])))
        output.append({
            **seed,
            "catalogMatch":bool(row),
            "catalogRecordUrl":row.get("recordUrl") if row else None,
            "catalogYear":row.get("year") if row else None,
            "catalogProgram":row.get("canonicalName") if row else None,
        })
    return output


def build_report(
    *,
    crawl:dict[str,Any],
    filtered_report:dict[str,Any],
    control_report:dict[str,Any],
    official:dict[str,Any],
    curated:dict[str,Any],
)->dict[str,Any]:
    records,duplicates=unique_program_records(crawl["rows"])
    current=[r for r in records if r["lifecycle"]=="current"]
    historical=[r for r in records if r["lifecycle"]=="historical"]
    control=control_school_counts(control_report)
    filters=filtered_catalog_counts(filtered_report)
    seeds=known_public_seeds(official,curated)
    matches=seed_matches(records,seeds)
    current_2018_2025=[
        r for r in current if r.get("year") is not None and 2018<=r["year"]<=2025
    ]
    return {
        "schemaVersion":SCHEMA,
        "revision":REVISION,
        "referenceOnly":True,
        "rawHtmlPersisted":False,
        "physicalHoldingsClaimed":False,
        "degreeCountsCreateThesisIdentities":False,
        "selectionMethod":"unfiltered-master-catalog-local-program-column-v1",
        "metrics":{
            "catalogPagesFetched":crawl["pagesFetched"],
            "catalogLastPageIndex":crawl["lastPageIndex"],
            "allMasterRowsScanned":len(crawl["rows"]),
            "philosophyMasterRowsSelected":len(current)+len(historical)+len(duplicates),
            "philosophyMasterUnique":len(records),
            "currentProgramUnique":len(current),
            "historicalProgramUnique":len(historical),
            "currentProgram2018_2025":len(current_2018_2025),
            "detailUrls":sum(bool(r.get("recordUrl")) for r in records),
            "duplicateRowsCollapsed":len(duplicates),
            "serverFilteredCurrent":filters["current"],
            "serverFilteredHistorical":filters["historical"],
            "controlSchoolDegrees2018_2025":control["total2018_2025"],
            "knownPublicSeeds":len(seeds),
            "knownPublicSeedsMatchedInCatalog":sum(m["catalogMatch"] for m in matches),
        },
        "controlSchool":control,
        "serverFilteredCatalogue":filters,
        "knownPublicSeeds":matches,
        "currentProgramRecords":current,
        "historicalProgramRecords":historical,
        "duplicates":duplicates,
        "pageEvidence":crawl["pageEvidence"],
    }


def main()->int:
    p=argparse.ArgumentParser()
    p.add_argument("--filtered-catalog-report",required=True,type=Path)
    p.add_argument("--control-school-report",required=True,type=Path)
    p.add_argument("--official-supplement",required=True,type=Path)
    p.add_argument("--curated-config",required=True,type=Path)
    p.add_argument("--output",required=True,type=Path)
    p.add_argument("--delay",type=float,default=0.03)
    args=p.parse_args()
    crawl=crawl_unfiltered(delay=args.delay)
    result=build_report(
        crawl=crawl,
        filtered_report=json.loads(args.filtered_catalog_report.read_text(encoding="utf-8")),
        control_report=json.loads(args.control_school_report.read_text(encoding="utf-8")),
        official=json.loads(args.official_supplement.read_text(encoding="utf-8")),
        curated=json.loads(args.curated_config.read_text(encoding="utf-8")),
    )
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps(result["metrics"],ensure_ascii=False,sort_keys=True))
    return 0


if __name__=="__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Read-only Wayback comparison of Sincronía's issue-15 index and two Campos URLs.

Captures of the reused /campos.htm URL after 2000 are not evidence of the
2000 article's title or signed authorship; no source metadata is mutated.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

from scripts.cucsh.probe_sincronia_wayback_eight import inspect_entry

TARGETS = [
    ("original_issue15_index",
     "http://fuentes.csh.udg.mx/CUCSH/Sincronia/summer00.htm"),
    ("original_campos_url",
     "http://sincronia.cucsh.udg.mx/campos.htm"),
    ("separate_campos2_url",
     "http://sincronia.cucsh.udg.mx/campos2.htm"),
    ("alternate_issue15_index",
     "http://sincronia.cucsh.udg.mx/summer00.htm"),
    ("alternate_campos",
     "http://fuentes.csh.udg.mx/CUCSH/Sincronia/campos.htm"),
    ("alternate_campos2",
     "http://fuentes.csh.udg.mx/CUCSH/Sincronia/campos2.htm"),
]

def inspect_target(item, *, inspector=inspect_entry):
    key,url=item
    row={"id":key, "issueNumber":15, "year":2000,
         "title":"Index/URL identity research, no inferred work title",
         "originalUrl":url, "sourceAvailability":"not_assumed_live"}
    result=inspector(row)
    result["sourceKind"]=key
    for capture in result["snapshots"]:
        stamp=str(capture.get("timestamp") or "")
        capture["sameCalendarYearAsIssue"]=stamp.startswith("2000")
        capture["year2000ArticleIdentityVerified"]=False
        capture["note"]="Snapshot requires original byline and issue/title context; 2001 re-use is not issue-15 evidence."
    return result

def report(*, inspector=inspect_entry):
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda row: inspect_target(row,inspector=inspector), TARGETS))
    return {
        "issue": 15, "year": 2000,
        "sourceIndex": TARGETS[0][1],
        "canonicalUnresolvedWorkUrl": TARGETS[1][1],
        "differentDeleuzeCitationUrl": TARGETS[2][1],
        "sourceUrlsChecked": len(results),
        "authorAssignments": 0, "corpusModified": False,
        "signed2000ArticleVerified": False,
        "warning": (
            "Do not transplant a 2001 interview from reused /campos.htm, "
            "nor a Deleuze 2006 citation from /campos2.htm, "
            "into issue-15 /campos.htm without a matching source capture."
        ),
        "sources":results,
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--output",required=True,type=Path)
    args=p.parse_args()
    result=report()
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    for row in result["sources"]:
        print("CAMPos2000_WAYBACK_SOURCE",row["sourceKind"],row["originalUrl"],row["archiveIndexStatus"],row.get("fallbackIndexStatus",""),len(row["snapshots"]))
        for snapshot in row["snapshots"][:4]:
            print("CAMPos2000_WAYBACK_CAPTURE",snapshot.get("timestamp"),snapshot.get("archivedOriginal"),snapshot.get("snapshotFetchStatus"),snapshot.get("archivedPageTitle",""),snapshot.get("unverifiedOpeningExcerpt","")[:650])
    print("SINCRONIA_CAMPOS_2000_LINKAGE_READ_ONLY",result["authorAssignments"],result["corpusModified"])

if __name__=="__main__":
    main()

#!/usr/bin/env python3
"""Conservative offline merge reconciliation of main into Sincronía.

Requires an in-progress git merge with the four known unmerged paths. Resolves
their exact, reviewed kinds of overlap; refuses any novel conflicts. Merges
main's curated Protrepsis/Quadripartita records with feature's Sincronía rows,
without reintroducing the explicitly excluded non-peer-reviewed Temperie.
Run the full tests before ever pushing the resulting merge commit.
"""
from __future__ import annotations
import argparse
import copy
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFLICT_PATHS = (
    "acerca.html",
    "scripts/cucsh/harvest.py",
    "src/data/cucsh-filosofia.json",
    "tests/cucsh-filosofia.test.mjs",
)
CONFLICT_MARKERS = re.compile(
    r"(?ms)^<<<<<<< HEAD\n(.*?)^=======\n(.*?)^>>>>>>> origin/main\n"
)

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT).decode("utf-8")

def read_stage(path, stage):
    return git("show", f":{stage}:{path}")

def resolve_text(path, expected_count):
    content=(ROOT/path).read_text(encoding="utf-8")
    conflicts=list(CONFLICT_MARKERS.finditer(content))
    if len(conflicts)!=expected_count:
        raise ValueError(f"{path}: expected {expected_count} conflict blocks, found {len(conflicts)}")
    block_index=iter(range(len(conflicts)))
    def replace(match):
        idx=next(block_index)
        ours, theirs=match.group(1), match.group(2)
        if path=="acerca.html":
            if idx==0:
                if "Protrepsis, Quadripartita Ratio y Sincronía" not in ours:
                    raise ValueError("Changed About content index block")
                return ours.replace(
                    "Protrepsis, Quadripartita Ratio y Sincronía, reunidas con procedencia explícita.",
                    "Protrepsis, Quadripartita Ratio y Sincronía, reunidas con procedencia explícita; "
                    "se excluye la sección literaria no arbitrada Temperie."
                ).replace("391+", "1,790")
            if "mobile-site-menu.js?v=20261109-v2" not in ours or "20261111-sidebar-icons-v3" not in theirs:
                raise ValueError("Unexpected mobile menu conflict")
            return ours.replace("20261109-v2","20261111-sidebar-icons-v3")
        if path=="scripts/cucsh/harvest.py":
            if idx==0:
                if "harvest_legacy_records" not in ours:
                    raise ValueError("Unexpected legacy import conflict")
                return ours
            if "if issue_metadata:" not in ours or "is_temperie_record" not in theirs:
                raise ValueError("Unexpected source metadata versus Temperie exclusion conflict")
            return ours+theirs
        if path=="tests/cucsh-filosofia.test.mjs":
            if idx==0 and "Sincronía" in ours and "Temperie" in theirs:
                return ours+theirs
            raise ValueError("Unexpected unit test conflict")
        raise ValueError(f"Unsupported conflict: {path}")
    repaired=CONFLICT_MARKERS.sub(replace,content)
    if path=="tests/cucsh-filosofia.test.mjs":
        original_feature=read_stage(path,2)
        original_main=read_stage(path,3)
        anchor='test(\\n  "Protrepsis conserva metadatos editoriales de los números 1–14"'
        anchor=anchor.replace('\\n','\n')
        if original_feature.count("Sincronía 1–90 contiene")!=1:
            raise ValueError("Sincronía article tests not found exactly once")
        if original_main.count(anchor)!=1:
            raise ValueError("Cannot identify new main Protrepsis tests")
        if original_feature.count("records.length >= 391")!=1:
            raise ValueError("Original feature corpus test precondition changed")
        if original_feature.count(").length >= 303")!=1:
            raise ValueError("Original feature Protrepsis test precondition changed")
        repaired=(
            original_feature
                .replace("records.length >= 391","records.length >= 1790")
                .replace(").length >= 303",").length >= 248")
                .rstrip()
            +"\\n\\n"+original_main[original_main.index(anchor):]
        )
    if "<<<<<<<" in repaired or ">>>>>>> origin/main" in repaired:
        raise ValueError(f"Merge markers remain in {path}")
    if path=="scripts/cucsh/harvest.py":
        if "from protrepsis_policy import is_temperie_record" not in repaired:
            import_policy=(
                "\\ntry:\\n"
                "    from scripts.cucsh.protrepsis_policy import is_temperie_record\\n"
                "    from scripts.cucsh.quadripartita_editorial import editorial_metadata\\n"
                "except ModuleNotFoundError:\\n"
                "    from protrepsis_policy import is_temperie_record\\n"
                "    from quadripartita_editorial import editorial_metadata\\n"
            ).replace("\\n","\n")
            marker="from pathlib import Path\n"
            if repaired.count(marker)!=1:
                raise ValueError("Cannot safely place main Protrepsis policy imports")
            repaired=repaired.replace(marker,marker+import_policy,1)
        if "is_temperie_record" not in repaired or "editorial_metadata" not in repaired:
            raise ValueError("Main's Protrepsis and Quadripartita imports are missing")
        if "harvest_legacy_records" not in repaired:
            raise ValueError("Sincronía historical harvester missing")
        if "is_temperie_record(record)" not in repaired.replace("\n",""):
            # Multi-line expression expected; check actual policy call instead.
            if "and is_temperie_record(" not in repaired:
                raise ValueError("Temperie filter missing")
    (ROOT/path).write_text(repaired,encoding="utf-8")
    return len(conflicts)

def reconcile_data():
    from protrepsis_policy import is_temperie_record
    path=CONFLICT_PATHS[2]
    ours=json.loads(read_stage(path,2))
    main=json.loads(read_stage(path,3))
    ours_records=ours["records"]
    main_records=main["records"]
    a={x["id"]:x for x in ours_records}
    b={x["id"]:x for x in main_records}
    assert len(a)==len(ours_records)==1845, "Historical feature baseline unexpected"
    assert len(b)==len(main_records)==336, "Main curated baseline unexpected"
    if main.get("schemaVersion")!=ours.get("schemaVersion") or main.get("provider")!=ours.get("provider"):
        raise ValueError("Incompatible source schema/provider")
    if not set(b).issubset(a):
        raise ValueError("Main gained unreviewed unique IDs; stop and reconcile explicitly")
    journal_counts={
        "feature": {journal:sum(x["journal"]==journal for x in ours_records)
                    for journal in ("Sincronía","Protrepsis","Quadripartita Ratio")},
        "main": {journal:sum(x["journal"]==journal for x in main_records)
                 for journal in ("Sincronía","Protrepsis","Quadripartita Ratio")},
    }
    if journal_counts["feature"]!={"Sincronía":1454,"Protrepsis":303,"Quadripartita Ratio":88}:
        raise ValueError("Feature journals diverged from frozen audited source")
    if journal_counts["main"]!={"Sincronía":0,"Protrepsis":248,"Quadripartita Ratio":88}:
        raise ValueError("Main journals diverged from latest peer-review policy")
    excluded=[r for r in ours_records if r["id"] not in b and r["journal"]!="Sincronía"]
    if len(excluded)!=55 or not all(is_temperie_record(r) for r in excluded):
        raise ValueError("Unexpected non-Sincronía differences beyond 55 Temperie records")
    sincronia=[r for r in ours_records if r["journal"]=="Sincronía"]
    if len(sincronia)!=1454 or len({r["id"] for r in sincronia})!=1454:
        raise ValueError("Sincronía original source records changed, repeated or disappeared")
    if any(r.get("issueNumber") not in range(1,91) for r in sincronia):
        raise ValueError("Sincronía issue-number inventory invalid")
    if set(r["id"] for r in sincronia)&set(b):
        raise ValueError("Main added records with Sincronía IDs and needs true merging")
    output=copy.deepcopy(main)
    output["records"]=main_records+sincronia
    if len(output["records"])!=1790:
        raise ValueError("Merged corpus size mismatch")
    if not all(output["records"][i]==main_records[i] for i in range(len(main_records))):
        raise ValueError("Main Protrepsis and Quadripartita metadata changed")
    if output["records"][len(main_records):]!=sincronia:
        raise ValueError("Sincronía article metadata changed")
    (ROOT/path).write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return {
        "mainCUCSHRecords":len(main_records),
        "featureCUCSHRecords":len(ours_records),
        "mergedCUCSHRecords":len(output["records"]),
        "preservedSincronia":len(sincronia),
        "retainedMainProtrepsis":248,
        "retainedMainQuadripartita":88,
        "excludedNonPeerReviewedTemperie":len(excluded),
        "excludedTemperieDois":[r.get("doi") for r in excluded],
        "featureOriginalSincroniaRecordsAltered":0,
        "mainCuratedJournalRecordsAltered":0,
    }

def adapt_quadripartita_test():
    path=ROOT/"tests/quadripartita-stamps.test.mjs"
    code=path.read_text(encoding="utf-8")
    before="  assert.equal(data.records.length, 336);"
    if code.count(before)!=1:
        raise ValueError("Quadripartita's main-only count assertion drifted")
    after=(
        "  assert.equal(data.records.length, 1790);\\n"
        '  assert.equal(data.records.filter(x => x.journal === "Sincronía").length, 1454);'
    ).replace("\\n","\n")
    path.write_text(code.replace(before,after),encoding="utf-8")
    return str(path.relative_to(ROOT))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",required=True,type=Path)
    args=parser.parse_args()
    conflicts=sorted(git("diff","--name-only","--diff-filter=U").splitlines())
    if conflicts!=sorted(CONFLICT_PATHS):
        raise ValueError("Unexpected unmerged files: "+repr(conflicts))
    sys.path.insert(0,str(ROOT/"scripts"/"cucsh"))
    details={
        "resolvedTextConflicts":{p:resolve_text(p,n) for p,n in (
            ("acerca.html",2),("scripts/cucsh/harvest.py",2),
            ("tests/cucsh-filosofia.test.mjs",1)
        )},
        "data":reconcile_data(),
        "adaptedMainOnlyTest":adapt_quadripartita_test(),
        "protectedMain":True,
        "branchIsOnlyAnEphemeralRunnerWorktree":True,
    }
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(details,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("SINCRONIA_RECONCILED_DRY_RUN",json.dumps({k:v for k,v in details.items()
             if k!="data"},ensure_ascii=False))
    print("SINCRONIA_RECONCILED_DATA_RECORDS",details["data"]["mergedCUCSHRecords"])
    print("SINCRONIA_RECONCILED_TEMPERIE_EXCLUDED",len(details["data"]["excludedTemperieDois"]))

if __name__=="__main__":
    main()

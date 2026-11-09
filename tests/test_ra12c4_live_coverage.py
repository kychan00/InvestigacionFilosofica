"""RA12-C4 coverage analyzer tests with a tiny exact alias partition."""
import gzip, hashlib, json, tempfile
from pathlib import Path
import sys, unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"research-atlas"))
from analyze_ra12c4_live_coverage import analyze

def write_alias(root:Path, alias:str, row:list):
    prefix=hashlib.sha256(alias.encode()).digest()[0]
    path=root/f"aliases/part-{prefix:03d}.jsonl.gz"
    path.parent.mkdir(parents=True,exist_ok=True)
    with gzip.GzipFile(filename="",mode="wb",fileobj=path.open("wb"),mtime=0) as z:
        z.write((json.dumps(row)+"\n").encode())

class CoverageTests(unittest.TestCase):
    def test_direct_alias_overlay_and_unresolved_are_distinct(self):
        with tempfile.TemporaryDirectory() as raw:
            root=Path(raw)
            write_alias(root,"openalex:W1",["openalex:W1","W1",0,1,2])
            write_alias(root,"doi:10.1000/x",["doi:10.1000/x","W2",1,2,3])
            # Ensure every possible requested shard file exists; analyzer loads on demand.
            for i in range(256):
                p=root/f"aliases/part-{i:03d}.jsonl.gz"
                if not p.exists():
                    p.parent.mkdir(parents=True,exist_ok=True)
                    with gzip.GzipFile(filename="",mode="wb",fileobj=p.open("wb"),mtime=0):
                        pass
            manifest={"schemaVersion":"fixture","index":{"entryCount":2,"compressedBytes":10},
                      "identity":{"ambiguousAliasesExcluded":0}}
            capture={"runs":[{
              "id":"q","query":"q","durationMs":100,"resultCount":4,"errors":[],
              "stats":{"providers":{"OpenAlex Philosophy":1,"Crossref":2,"X":1}},
              "results":[
                {"rank":1,"title":"a","providers":["OpenAlex Philosophy"],"semanticAliases":["openalex:W1"],"overlayIdentity":None,"overlayTextBytes":1},
                {"rank":2,"title":"b","providers":["Crossref"],"semanticAliases":["doi:10.1000/x"],"overlayIdentity":"doi:10.1000/x","overlayTextBytes":1},
                {"rank":3,"title":"c","providers":["Crossref"],"semanticAliases":["doi:10.2000/new"],"overlayIdentity":"doi:10.2000/new","overlayTextBytes":20},
                {"rank":4,"title":"","providers":["X"],"semanticAliases":[],"overlayIdentity":None,"overlayTextBytes":0},
              ]
            }]}
            out=analyze(capture,root,manifest,[5,20,50])
            c=out["cutoffs"]["5"]
            self.assertEqual((c["base-direct"],c["base-alias"],c["overlay-candidate"],c["unresolved"]),(1,1,1,1))
            self.assertEqual(c["baseV4Coverage"],0.5)
            self.assertEqual(c["eventualQwenCoverageIfOverlayEmbedded"],0.75)
            self.assertEqual(out["overlayQueue"]["candidateCount"],1)
            self.assertEqual(out["providers"]["Crossref"]["base-alias"],1)
            self.assertEqual(out["providers"]["Crossref"]["overlay-candidate"],1)

if __name__=="__main__":
    unittest.main()

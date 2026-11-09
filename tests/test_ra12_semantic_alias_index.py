"""RA12-C4 deterministic alias index tests with synthetic V4 metadata."""
from __future__ import annotations
import gzip, hashlib, json, struct, tempfile
from pathlib import Path
import sys, unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"research-atlas"))
from build_ra12_semantic_alias_index import build, normalize_doi
from build_ra12_vector_lookup import sha256

def record(path:Path, root:Path, **extra):
    data=path.read_bytes()
    return {"path":path.relative_to(root).as_posix(),"bytes":len(data),"sha256":sha256(data),**extra}

def fixture(folder:Path):
    source=folder/"source"
    source.mkdir()
    rows=[
      {"vector_id":0,"id":"https://openalex.org/W10","openalex_id":"W10","doi":"10.1000/A","crossref_id":"10.1000/a"},
      {"vector_id":1,"id":"https://openalex.org/W20","openalex_id":"W20","doi":"https://doi.org/10.2000/B","crossref_id":None},
      {"vector_id":2,"id":"https://openalex.org/W30","openalex_id":"W30","doi":"10.3000/C","crossref_id":"10.3000/c"},
    ]
    for row in rows:
        row.update({"title":"t","abstract":None,"authors":[],"year":2020,"topics":[],"keywords":[],"journal":None,"language":"en","source":"fixture","publication_type":"article","url":None})
    metadata=source/"metadata/page-0000.jsonl.gz"
    metadata.parent.mkdir(parents=True)
    with gzip.GzipFile(filename="",mode="wb",fileobj=metadata.open("wb"),mtime=0) as z:
        for row in rows:
            z.write((json.dumps(row,sort_keys=True,separators=(",",":"))+"\n").encode())
    ids0=source/"clusters/cluster-000.ids.u32"; ids0.parent.mkdir(parents=True)
    ids0.write_bytes(struct.pack("<II",0,2))
    ids1=source/"clusters/cluster-001.ids.u32"; ids1.write_bytes(struct.pack("<I",1))
    manifest={
      "document_count":3,"dimension":1024,"quantization":{"dtype":"int8"},"routing":{"cluster_count":2},
      "metadata":{"pages":[record(metadata,source,count=3,first_vector_id=0,last_vector_id=2)]},
      "clusters":[
        {"cluster":0,"count":2,"ids":record(ids0,source),"vectors":{"bytes":2048}},
        {"cluster":1,"count":1,"ids":record(ids1,source),"vectors":{"bytes":1024}},
      ],
      "source":{}
    }
    return manifest,source

class AliasTests(unittest.TestCase):
    def test_normalize_doi(self):
        self.assertEqual(normalize_doi("https://doi.org/10.1000/AbC"),"10.1000/abc")
        self.assertIsNone(normalize_doi("abc"))

    def test_builder_is_deterministic_and_maps_doi_to_vector_location(self):
        with tempfile.TemporaryDirectory() as raw:
            folder=Path(raw); manifest,source=fixture(folder)
            a=folder/"a"; b=folder/"b"
            one=build(manifest,"fixture-sha",source,a)
            two=build(manifest,"fixture-sha",source,b)
            self.assertEqual(one,two)
            names=sorted(p.relative_to(a) for p in a.rglob("*") if p.is_file())
            self.assertEqual(names,sorted(p.relative_to(b) for p in b.rglob("*") if p.is_file()))
            for name in names:self.assertEqual((a/name).read_bytes(),(b/name).read_bytes())
            self.assertEqual(one["coverage"]["workRows"],3)
            self.assertEqual(one["identity"]["ambiguousAliasesExcluded"],0)
            target="doi:10.2000/b"
            prefix=hashlib.sha256(target.encode()).digest()[0]
            part=gzip.decompress((a/f"aliases/part-{prefix:03d}.jsonl.gz").read_bytes()).decode().splitlines()
            row=next(json.loads(line) for line in part if json.loads(line)[0]==target)
            self.assertEqual(row,[target,"W20",1,1,0])

    def test_crossref_and_doi_aliases_dedupe_when_same(self):
        with tempfile.TemporaryDirectory() as raw:
            folder=Path(raw); manifest,source=fixture(folder)
            out=folder/"out"; data=build(manifest,"fixture-sha",source,out)
            # Each row always has one OpenAlex alias; DOI/crossref normalization should not duplicate same alias.
            self.assertEqual(data["coverage"]["rawAliasOccurrencesByKind"]["openalex"],3)
            self.assertEqual(data["coverage"]["rawAliasOccurrencesByKind"]["doi"],3)
            self.assertEqual(data["coverage"]["rawAliasOccurrencesByKind"]["crossref"],2)

if __name__=="__main__":
    unittest.main()

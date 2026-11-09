"""RA12-C5-B seed and compatibility contract tests; no model download."""
from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"research-atlas"))

from prepare_ra12c5b_overlay_seed import (
    build_document_text,
    prepare,
    write_outputs,
)
from build_ra12c5b_qwen_overlay import (
    compatibility_audit,
    normalize,
    quantize,
)


def write_alias_root(root:Path, work_ids:list[str]):
    aliases=root/"aliases"
    aliases.mkdir(parents=True)
    grouped={i:[] for i in range(256)}
    for i,work in enumerate(work_ids):
        alias="openalex:"+work
        prefix=hashlib.sha256(alias.encode()).digest()[0]
        grouped[prefix].append([alias,work,i,0,i])
    for prefix in range(256):
        path=aliases/f"part-{prefix:03d}.jsonl.gz"
        with path.open("wb") as raw:
            with gzip.GzipFile(filename="",mode="wb",fileobj=raw,mtime=0) as z:
                for row in grouped[prefix]:
                    z.write((json.dumps(row)+"\n").encode())


class OverlayTests(unittest.TestCase):
    def test_historical_document_text_is_exact_v33_contract(self):
        text,fields=build_document_text({
            "title":"  A   title ",
            "abstract":" An   abstract ",
            "authors":["Ada","Ada","Bob"],
            "topics":["Ontology"],
            "keywords":["identity"],
        })
        self.assertEqual(
            text,
            "Title:\nA title\n\nAbstract:\nAn abstract\n\nAuthors:\nAda; Bob\n\n"
            "Topics:\nOntology\n\nKeywords:\nidentity",
        )
        self.assertEqual(fields,["title","abstract","authors","topics","keywords"])

    def test_prepare_excludes_direct_and_doi_recovered_v4_but_keeps_true_external(self):
        with tempfile.TemporaryDirectory() as raw:
            root=Path(raw)/"alias"
            write_alias_root(root,["W1","W2"])
            capture={"runs":[{"id":"q","results":[
                {
                    "rank":1,"id":"https://openalex.org/W1","title":"Known",
                    "semanticAliases":["openalex:W1"],"providers":["OpenAlex Philosophy"],
                    "sourceRecords":[],"urls":{}
                },
                {
                    "rank":2,"id":"crossref:10.1000/recovered","title":"Recovered",
                    "doi":"10.1000/recovered","semanticAliases":["doi:10.1000/recovered"],
                    "overlayIdentity":"doi:10.1000/recovered","providers":["Crossref"],
                    "sourceRecords":[],"urls":{}
                },
                {
                    "rank":3,"id":"crossref:10.1000/new","title":"New","abstract":"Body",
                    "doi":"10.1000/new","semanticAliases":["doi:10.1000/new"],
                    "overlayIdentity":"doi:10.1000/new","providers":["Crossref"],
                    "sourceRecords":[{"sourceId":"crossref:10.1000/new"}],"urls":{}
                },
                {
                    "rank":4,"id":"cucsh:local","title":"Local",
                    "semanticAliases":[],"overlayIdentity":"provider:cucsh-filosofia:cucsh:local",
                    "providers":["CUCSH Filosofía"],"sourceRecords":[{"sourceId":"cucsh:local"}],"urls":{}
                }
            ]}]}
            authority={"authority":{"records":[
                {"doi":"10.1000/recovered","state":"v4-existing-by-doi",
                 "openalexWorkId":"W2","v4Location":{"workId":"W2","vectorId":1,"cluster":0,"ordinal":1}},
                {"doi":"10.1000/new","state":"openalex-outside-v4","openalexWorkId":"W3",
                 "v4Location":None},
            ]}}
            candidates,release,report=prepare(capture,authority,root)
            self.assertEqual([x["identity"] for x in candidates],[
                "openalex:W3","provider:cucsh-filosofia:cucsh:local"
            ])
            self.assertEqual(report["excluded"]["base-direct"],1)
            self.assertEqual(report["excluded"]["base-v4-by-doi"],1)
            self.assertEqual(report["candidateCount"],2)
            self.assertEqual(release[0]["openalexWorkId"],"W3")

    def test_dedup_selects_richer_text_and_publishable_metadata_contains_no_abstract_body(self):
        with tempfile.TemporaryDirectory() as raw:
            folder=Path(raw)
            alias=folder/"alias";write_alias_root(alias,[])
            capture={"runs":[
              {"id":"q1","results":[{
                "rank":1,"id":"crossref:10.2000/x","title":"T","doi":"10.2000/x",
                "semanticAliases":["doi:10.2000/x"],"overlayIdentity":"doi:10.2000/x",
                "providers":["Crossref"],"sourceRecords":[],"urls":{}
              }]},
              {"id":"q2","results":[{
                "rank":5,"id":"crossref:10.2000/x","title":"T","abstract":"Longer abstract text",
                "doi":"10.2000/x","semanticAliases":["doi:10.2000/x"],
                "overlayIdentity":"doi:10.2000/x","providers":["Crossref"],"sourceRecords":[],"urls":{}
              }]}
            ]}
            authority={"authority":{"records":[
              {"doi":"10.2000/x","state":"openalex-unmatched","openalexWorkId":None,"v4Location":None}
            ]}}
            candidates,release,report=prepare(capture,authority,alias)
            self.assertEqual(len(candidates),1)
            self.assertIn("Abstract:\nLonger abstract text",candidates[0]["documentText"])
            self.assertEqual(candidates[0]["appearances"],2)
            private=folder/"private.jsonl"
            artifact=folder/"artifact"
            write_outputs(candidates,release,report,private,artifact)
            with gzip.open(artifact/"overlay-metadata.jsonl.gz","rt") as f:
                published=json.loads(next(f))
            self.assertNotIn("abstract",published)
            self.assertNotIn("documentText",published)
            self.assertEqual(published["textTier"],"title+abstract")

    def test_quantization_and_control_cosine_gate(self):
        rng=np.random.default_rng(7)
        source=normalize(rng.normal(size=(8,1024)).astype(np.float32))
        embedded=normalize(source + rng.normal(scale=0.00005,size=source.shape).astype(np.float32))
        controls=[{
          "workId":f"W{i}","vectorId":i,"cluster":220 if i<4 else 208,
          "ordinal":i,"textSha256":"a"*64
        } for i in range(8)]
        audit=compatibility_audit(controls,embedded,source)
        self.assertTrue(audit["passed"])
        self.assertGreaterEqual(audit["minimumCosine"],0.995)
        q=quantize(source)
        self.assertEqual(q.shape,(8,1024))
        self.assertEqual(q.dtype,np.int8)

    def test_compatibility_gate_rejects_wrong_document_space(self):
        source=np.zeros((8,1024),dtype=np.float32)
        embedded=np.zeros((8,1024),dtype=np.float32)
        for i in range(8):
            source[i,i]=1
            embedded[i,i+16]=1
        controls=[{
          "workId":f"W{i}","vectorId":i,"cluster":220 if i<4 else 208,
          "ordinal":i,"textSha256":"b"*64
        } for i in range(8)]
        with self.assertRaisesRegex(Exception,"compatibility gate failed"):
            compatibility_audit(controls,embedded,source)


if __name__=="__main__":
    unittest.main()

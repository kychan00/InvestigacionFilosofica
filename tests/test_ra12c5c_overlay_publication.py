"""RA12-C5-C synthetic artifact preflight tests; no network/HF writes."""
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

SCRIPTS=Path(__file__).resolve().parents[1]/"scripts"/"research-atlas"
sys.path.insert(0,str(SCRIPTS))
from prepare_ra12c5c_overlay_publication import prepare, ReleaseError


def sha(b): return hashlib.sha256(b).hexdigest()
def enc(o): return (json.dumps(o,sort_keys=True,indent=2)+"\n").encode()
def gz_rows(rows):
    import io
    out=io.BytesIO()
    with gzip.GzipFile(filename="",mode="wb",fileobj=out,mtime=0) as z:
        for row in rows: z.write((json.dumps(row,sort_keys=True,separators=(",",":"))+"\n").encode())
    return out.getvalue()


def make_fixture(folder, with_abstract=False):
    count=207
    vectors=b"".join(bytes(((ordinal*17+i*11)%256 for i in range(1024))) for ordinal in range(count))
    digest_parts=[hashlib.sha256(vectors[i*1024:(i+1)*1024]).digest() for i in range(count)]
    digests=b"".join(digest_parts)
    index=[];meta=[]
    for i,d in enumerate(digest_parts):
        identity=f"doi:fixture-{i}"
        index.append({"identity":identity,"ordinal":i,"textSha256":sha(f"text-{i}".encode()),"vectorSha256":d.hex()})
        row={"identity":identity,"ordinal":i,"title":f"Title {i}","textSha256":index[-1]["textSha256"],"textTier":"titleOnly"}
        if with_abstract and i==0: row["abstract"]="must not publish"
        meta.append(row)
    index_b=gz_rows(index);meta_b=gz_rows(meta)
    compat={"schemaVersion":"research-atlas-ra12c5b-v4-compatibility-audit-v1","passed":True,"controlCount":8,
            "cases":[{"cluster":208 if i<4 else 41,"ordinal":i} for i in range(8)]}
    compat_b=enc(compat)
    manifest={
      "schemaVersion":"research-atlas-ra12c5b-semantic-overlay-v1","status":"built-unpublished",
      "documentCount":count,"dimension":1024,"productionEnabled":False,"publishedToHf":False,
      "embedding":{"model":"Qwen/Qwen3-Embedding-0.6B","revision":"97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3","documentsUseInstruction":False},
      "artifacts":{
        "vectors":{"path":"vectors.i8","bytes":len(vectors),"sha256":sha(vectors)},
        "digests":{"path":"vector-digests.sha256.bin","bytes":len(digests),"sha256":sha(digests)},
        "index":{"path":"vector-index.jsonl.gz","bytes":len(index_b),"sha256":sha(index_b)},
        "metadata":{"path":"overlay-metadata.jsonl.gz","bytes":len(meta_b),"sha256":sha(meta_b),"containsAbstractBody":False}},
      "v4Compatibility":{"passed":True,"auditSha256":sha(compat_b)}
    }
    manifest_b=enc(manifest)
    files={
      "seed/overlay-metadata.jsonl.gz":meta_b,
      "seed-summary.json":enc({"candidateCount":count}),
      "seed/seed-report.json":enc({"candidateCount":count,"rawAbstractIncludedInPublishableMetadata":False,"productionEnabled":False,"publishedToHf":False}),
      "doi-authority-report.json":enc({"fixture":True}),
      "overlay/manifest.json":manifest_b,
      "overlay/overlay-metadata.jsonl.gz":meta_b,
      "overlay/v4-compatibility-audit.json":compat_b,
      "overlay/vector-digests.sha256.bin":digests,
      "overlay/vector-index.jsonl.gz":index_b,
      "overlay/vectors.i8":vectors,
      "build-summary.json":enc({"fixture":True}),
      "independent-audit.json":enc({"status":"pass","documents":count,"uniqueVectorSha256":count,"duplicateVectorSha256":0,"publishableAbstractBodies":0,"productionEnabled":False,"publishedToHf":False})
    }
    archive=folder/"fixture.zip"
    with zipfile.ZipFile(archive,"w") as z:
        for name,payload in sorted(files.items()): z.writestr(name,payload,compress_type=zipfile.ZIP_DEFLATED)
    config={
      "schemaVersion":"research-atlas-ra12c5c-overlay-publication-candidate-v1",
      "source":{"artifactZipBytes":archive.stat().st_size,"artifactZipSha256":sha(archive.read_bytes()),"overlayManifestSha256":sha(manifest_b),"runId":1,"artifactId":2},
      "expected":{"documentCount":count,"dimension":1024,"vectorBytes":len(vectors),"digestBytes":len(digests),"indexBytes":len(index_b),"metadataBytes":len(meta_b),"uniqueVectorSha256":count,"duplicateVectorSha256":0,"publicationFileCount":9,
                  "artifacts":{"vectors":sha(vectors),"digests":sha(digests),"index":sha(index_b),"metadata":sha(meta_b)}},
      "publication":{"targetPrefix":"research-atlas/qwen3-semantic-overlay/v1/fixture","manualDispatchOnly":True,"pullRequestNeverPublishes":True,"runtimeEnabled":False,"semanticNeighborEnabled":False,"published":False}
    }
    return archive,config,files


class C5CPreflightTests(unittest.TestCase):
    def test_fixture_stages_exact_originals_plus_small_derived_proofs(self):
        with tempfile.TemporaryDirectory() as raw:
            folder=Path(raw);archive,config,_=make_fixture(folder)
            result=prepare(archive,config,folder/"out",True)
            self.assertEqual(result["documents"],207)
            self.assertEqual(result["publicationFiles"],9)
            self.assertEqual(result["uniqueVectorSha256"],207)
            self.assertFalse(result["publishedToHf"])
            names={p.relative_to(folder/"out").as_posix() for p in (folder/"out").rglob("*") if p.is_file()}
            self.assertEqual(names,{"manifest.json","vectors.i8","vector-digests.sha256.bin","vector-index.jsonl.gz","overlay-metadata.jsonl.gz","v4-compatibility-audit.json","identity-lookup.json","browser-reference.json","release-provenance.json"})
            self.assertEqual((folder/"out/vectors.i8").read_bytes(),zipfile.ZipFile(archive).read("overlay/vectors.i8"))
    def test_tampered_vector_bytes_fail_against_manifest(self):
        with tempfile.TemporaryDirectory() as raw:
            folder=Path(raw);archive,config,files=make_fixture(folder)
            bad=bytearray(files["overlay/vectors.i8"]);bad[0]^=1;files["overlay/vectors.i8"]=bytes(bad)
            with zipfile.ZipFile(archive,"w") as z:
                for n,b in files.items():z.writestr(n,b)
            with self.assertRaisesRegex(ReleaseError,"Artifact SHA/size mismatch"):
                prepare(archive,config,folder/"out",True)
    def test_publishable_abstract_body_fails_closed(self):
        with tempfile.TemporaryDirectory() as raw:
            folder=Path(raw);archive,config,_=make_fixture(folder,True)
            with self.assertRaisesRegex(ReleaseError,"forbidden source text"):
                prepare(archive,config,folder/"out",True)
    def test_runtime_enable_policy_is_rejected(self):
        with tempfile.TemporaryDirectory() as raw:
            folder=Path(raw);archive,config,_=make_fixture(folder)
            config["publication"]["runtimeEnabled"]=True
            with self.assertRaisesRegex(ReleaseError,"safety policy"):
                prepare(archive,config,folder/"out",True)

if __name__=="__main__": unittest.main()

#!/usr/bin/env python3
"""RA12-C5-B independent overlay artifact validator.

No model inference. Recomputes file/vector hashes, checks ordinal/identity/text
lineage against private build inputs, and verifies publishable metadata does
not contain abstract/documentText bodies.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import sys


class ValidationError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest=hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda:handle.read(1024*1024),b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    rows=[]
    with path.open("r",encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def load_gzip_jsonl(path: Path) -> list[dict]:
    rows=[]
    with gzip.open(path,"rt",encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def verify(overlay: Path, candidates_path: Path) -> dict:
    manifest_path=overlay/"manifest.json"
    manifest=json.loads(manifest_path.read_text())
    if manifest.get("schemaVersion")!="research-atlas-ra12c5b-semantic-overlay-v1":
        raise ValidationError("Unexpected overlay schema")
    if manifest.get("status")!="built-unpublished":
        raise ValidationError("Overlay is not an unpublished build")
    if manifest.get("productionEnabled") is not False or manifest.get("publishedToHf") is not False:
        raise ValidationError("Overlay unexpectedly enabled/published")
    if manifest.get("dimension")!=1024:
        raise ValidationError("Wrong vector dimension")
    if manifest.get("embedding",{}).get("model")!="Qwen/Qwen3-Embedding-0.6B":
        raise ValidationError("Wrong embedding model")
    if manifest.get("embedding",{}).get("revision")!="97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3":
        raise ValidationError("Wrong embedding revision")
    if manifest.get("embedding",{}).get("documentsUseInstruction") is not False:
        raise ValidationError("Documents unexpectedly use query instruction")
    if manifest.get("v4Compatibility",{}).get("passed") is not True:
        raise ValidationError("V4 compatibility did not pass")

    artifacts=manifest["artifacts"]
    resolved={}
    for key,meta in artifacts.items():
        path=overlay/meta["path"]
        if not path.is_file():
            raise ValidationError(f"Missing artifact: {key}")
        if path.stat().st_size!=meta["bytes"] or sha256_file(path)!=meta["sha256"]:
            raise ValidationError(f"Artifact hash/size mismatch: {key}")
        resolved[key]=path

    count=manifest["documentCount"]
    if artifacts["vectors"]["bytes"]!=count*1024:
        raise ValidationError("Vector byte count mismatch")
    if artifacts["digests"]["bytes"]!=count*32:
        raise ValidationError("Digest byte count mismatch")
    if artifacts["metadata"].get("containsAbstractBody") is not False:
        raise ValidationError("Metadata policy permits abstract body unexpectedly")

    vectors=resolved["vectors"].read_bytes()
    digests=resolved["digests"].read_bytes()
    index=load_gzip_jsonl(resolved["index"])
    metadata=load_gzip_jsonl(resolved["metadata"])
    candidates=load_jsonl(candidates_path)
    if not (len(index)==len(metadata)==len(candidates)==count):
        raise ValidationError("Ordinal collection count mismatch")

    identities=set()
    vector_hashes=set()
    text_tier_counts={}
    for ordinal in range(count):
        candidate=candidates[ordinal]
        idx=index[ordinal]
        meta=metadata[ordinal]
        if idx.get("ordinal")!=ordinal or meta.get("ordinal")!=ordinal:
            raise ValidationError(f"Ordinal mismatch: {ordinal}")
        identity=candidate.get("identity")
        if not identity or identity in identities:
            raise ValidationError(f"Missing/duplicate identity: {identity}")
        identities.add(identity)
        if idx.get("identity")!=identity or meta.get("identity")!=identity:
            raise ValidationError(f"Identity lineage mismatch: {ordinal}")
        text_hash=hashlib.sha256(candidate["documentText"].encode("utf-8")).hexdigest()
        if candidate.get("textSha256")!=text_hash or idx.get("textSha256")!=text_hash or meta.get("textSha256")!=text_hash:
            raise ValidationError(f"Text hash lineage mismatch: {ordinal}")
        # Raw text/abstract must not escape into publishable metadata.
        forbidden={"abstract","documentText","authors","topics","keywords"}
        if forbidden.intersection(meta):
            raise ValidationError(f"Publishable metadata exposes source text fields: {ordinal}")

        raw=vectors[ordinal*1024:(ordinal+1)*1024]
        digest=hashlib.sha256(raw).digest()
        expected=digests[ordinal*32:(ordinal+1)*32]
        if digest!=expected or idx.get("vectorSha256")!=digest.hex():
            raise ValidationError(f"Vector digest mismatch: {ordinal}")
        vector_hashes.add(digest.hex())
        tier=meta.get("textTier")
        text_tier_counts[tier]=text_tier_counts.get(tier,0)+1

    compatibility_path=overlay/manifest["v4Compatibility"]["auditPath"]
    compatibility=json.loads(compatibility_path.read_text())
    if compatibility.get("passed") is not True:
        raise ValidationError("Compatibility audit file failed")
    if compatibility["minimumCosine"]<compatibility["requiredMinimumCosine"]:
        raise ValidationError("Compatibility minimum cosine below gate")
    if compatibility["meanCosine"]<compatibility["requiredMeanCosine"]:
        raise ValidationError("Compatibility mean cosine below gate")

    return {
        "schemaVersion":"research-atlas-ra12c5b-independent-overlay-audit-v1",
        "status":"pass",
        "documents":count,
        "uniqueIdentities":len(identities),
        "uniqueVectorSha256":len(vector_hashes),
        "duplicateVectorSha256":count-len(vector_hashes),
        "textTiers":dict(sorted(text_tier_counts.items())),
        "minimumV4CompatibilityCosine":compatibility["minimumCosine"],
        "meanV4CompatibilityCosine":compatibility["meanCosine"],
        "publishableAbstractBodies":0,
        "productionEnabled":False,
        "publishedToHf":False,
    }


def main()->int:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--overlay",required=True,type=Path)
    p.add_argument("--candidates",required=True,type=Path)
    p.add_argument("--report",required=True,type=Path)
    args=p.parse_args()
    try:
        result=verify(args.overlay,args.candidates)
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(json.dumps(result,sort_keys=True,indent=2)+"\n",encoding="utf-8")
        print(json.dumps(result,sort_keys=True))
        return 0
    except (ValidationError,OSError,ValueError,KeyError,TypeError,json.JSONDecodeError) as exc:
        print(f"RA12-C5-B validation ERROR: {exc}",file=sys.stderr)
        return 1


if __name__=="__main__":
    raise SystemExit(main())

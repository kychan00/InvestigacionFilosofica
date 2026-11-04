#!/usr/bin/env python3
"""Build a reference-only curated Philosophy discovery index.

This index is deliberately separate from canonical Humanities admission:
it preserves each thesis's real program and never rewrites Program Authority.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import urllib.parse
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / "scripts/thesis/config/philosophy-curated-content-v1.json"
FORBIDDEN = (".pdf", "/bitstream", "/download")
ALLOWED_STATUS = {"include", "review"}
ALLOWED_BASIS = {
    "program-core",
    "program-core-candidate",
    "philosophical-content",
    "curated-manual-classification",
}
ALLOWED_CLASSIFICATION_SOURCE = {"human-curation", "secondary-discovery"}


def safe_url(url: str | None) -> bool:
    if not url:
        return False
    value = urllib.parse.unquote(url).casefold()
    return value.startswith("https://") and not any(token in value for token in FORBIDDEN)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def stable_id(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:20]


def validate_record(record: dict[str, Any]) -> None:
    required = (
        "id",
        "status",
        "inclusionBasis",
        "classificationSource",
        "provider",
        "providerRecordId",
        "recordUrl",
        "title",
        "authors",
        "actualProgram",
        "institution",
        "thesisType",
        "philosophyEvidence",
        "validationTier",
    )
    missing = [key for key in required if key not in record or record[key] in (None, "", [])]
    if missing:
        raise ValueError(f"Curated Philosophy record missing fields {missing}: {record.get('id')}")

    if record["status"] not in ALLOWED_STATUS:
        raise ValueError(f"Unsupported curated status: {record['status']}")
    if record["inclusionBasis"] not in ALLOWED_BASIS:
        raise ValueError(f"Unsupported inclusion basis: {record['inclusionBasis']}")
    if record["classificationSource"] not in ALLOWED_CLASSIFICATION_SOURCE:
        raise ValueError(
            f"Unsupported classification source: {record['classificationSource']}"
        )
    if record["status"] == "include" and record["classificationSource"] != "human-curation":
        raise ValueError("INCLUDE in curated Philosophy view requires explicit human curation")
    if not safe_url(record["recordUrl"]):
        raise ValueError(f"Unsafe curated record URL: {record['recordUrl']}")
    for url in record.get("evidenceUrls") or []:
        if not safe_url(url):
            raise ValueError(f"Unsafe curated evidence URL: {url}")
    if record["institution"] != "Universidad de Guadalajara":
        raise ValueError("Curated Philosophy V1 is limited to UdeG theses")
    if not isinstance(record["authors"], list) or not all(
        isinstance(value, str) and value.strip() for value in record["authors"]
    ):
        raise ValueError(f"Invalid authors: {record['id']}")


def build_index(config: dict[str, Any]) -> dict[str, Any]:
    if config.get("schemaVersion") != "thesis-philosophy-curated-content-v1":
        raise ValueError("Unsupported curated Philosophy schema")
    rules = config.get("rules") or {}
    if rules.get("canonicalAdmissionMutation") is not False:
        raise ValueError("Curated Philosophy view must never mutate canonical admission")
    if rules.get("preserveActualProgram") is not True:
        raise ValueError("Curated Philosophy view must preserve actual program")
    if rules.get("referenceOnly") is not True:
        raise ValueError("Curated Philosophy view must be reference-only")

    records = list(config.get("records") or [])
    ids: set[str] = set()
    provider_keys: set[tuple[str, str]] = set()
    for record in records:
        validate_record(record)
        if record["id"] in ids:
            raise ValueError(f"Duplicate curated Philosophy id: {record['id']}")
        ids.add(record["id"])
        provider_key = (record["provider"], record["providerRecordId"])
        if provider_key in provider_keys:
            raise ValueError(f"Duplicate curated provider record: {provider_key}")
        provider_keys.add(provider_key)

    records.sort(
        key=lambda row: (
            0 if row["status"] == "include" else 1,
            str(row.get("year") or "9999"),
            row["title"].casefold(),
        )
    )
    return {
        "schemaVersion": "thesis-philosophy-curated-index-v1",
        "revision": config["revision"],
        "publicationState": "projection-not-release",
        "referenceOnly": True,
        "canonicalAdmissionMutation": False,
        "purpose": config["purpose"],
        "metrics": {
            "records": len(records),
            "byStatus": dict(Counter(row["status"] for row in records)),
            "byInclusionBasis": dict(
                Counter(row["inclusionBasis"] for row in records)
            ),
            "byValidationTier": dict(
                Counter(row["validationTier"] for row in records)
            ),
        },
        "records": records,
        "integrity": {
            "recordSetSha256": "sha256:"
            + hashlib.sha256(
                json.dumps(
                    records,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode("utf-8")
            ).hexdigest(),
            "decisionModel": "explicit-human-curation-no-semantic-auto-admission",
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("artifacts/philosophy-v1/curated/philosophy-curated-index.json"),
    )
    args = parser.parse_args()

    index = build_index(read_json(args.config))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(index, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(index["metrics"], ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

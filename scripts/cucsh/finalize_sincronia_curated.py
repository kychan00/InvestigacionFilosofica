#!/usr/bin/env python3
"""Apply the last two source-verified Sincronía metadata cleanups.

No network access. The patch is intentionally frozen to exact record IDs and
previous values so it fails closed if the dataset changes unexpectedly.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

MATEO_ID = "cucsh:sincronia-legacy:759c7e05d547a0bf70b2"
GRANILLO_ID = "cucsh:sincronia-legacy:cd448284ffc7d9036889"

MATEO_PREVIOUS = "P�rez, Miguel �ngel Mateo"
MATEO_TITLE = (
    "Estructura mundial de la pobreza. Visiones, indicadores y políticas "
    "tras diez años de desarrollo humano"
)
MATEO_AUTHOR = "Miguel Ángel Mateo Pérez"
MATEO_EVIDENCE = (
    "https://www.academia.edu/7169136/"
    "Per_al_mesurament_de_la_desigualtat_la_pobresa_i_lexclusi%C3%B3_"
    "limitacions_propostes_t%C3%A8cniques_i_alternatives"
)

GRANILLO_PREVIOUS = "Lilia Granillo Vázquez ,"
GRANILLO_AUTHOR = "Lilia Granillo Vázquez"


def apply_patch(dataset, audit_run_id=43140342324):
    before_ids = [row.get("id") for row in dataset["records"]]
    changed = []

    for row in dataset["records"]:
        if row.get("id") == MATEO_ID:
            if row.get("title") != MATEO_PREVIOUS:
                raise ValueError("Unexpected Mateo title baseline")
            if row.get("authors"):
                raise ValueError("Mateo author baseline is no longer empty")
            status = row.get("legacyAccessStatus") or {}
            if status.get("status") != "original-page-unavailable":
                raise ValueError("Mateo original-page status must remain unavailable")

            row["title"] = MATEO_TITLE
            row["titleVariants"] = [MATEO_TITLE]
            row["authors"] = [{
                "name": MATEO_AUTHOR,
                "sourceName": MATEO_AUTHOR,
            }]
            row["legacyTitleEncodingEvidence"] = {
                "kind": "independent-bibliographic-title-author",
                "sourceUrl": MATEO_EVIDENCE,
                "auditRunId": audit_run_id,
                "previousTitle": MATEO_PREVIOUS,
                "score": 1.0,
            }
            row["legacyAuthorEvidence"] = {
                "kind": "independent-bibliographic-title-author",
                "sourceUrl": MATEO_EVIDENCE,
                "auditRunId": audit_run_id,
                "verifiedAuthor": MATEO_AUTHOR,
                "fieldOrContext": (
                    "independent bibliographic citation + historical URL"
                ),
            }
            changed.append(MATEO_ID)

        elif row.get("id") == GRANILLO_ID:
            authors = row.get("authors") or []
            if (
                len(authors) != 1
                or authors[0].get("name") != GRANILLO_PREVIOUS
            ):
                raise ValueError("Unexpected Granillo author baseline")
            authors[0]["name"] = GRANILLO_AUTHOR
            authors[0]["sourceName"] = GRANILLO_AUTHOR
            evidence = row.get("legacyAuthorEvidence") or {}
            evidence["verifiedAuthor"] = GRANILLO_AUTHOR
            evidence["normalization"] = "trimmed stray trailing punctuation"
            row["legacyAuthorEvidence"] = evidence
            changed.append(GRANILLO_ID)

    if set(changed) != {MATEO_ID, GRANILLO_ID}:
        raise ValueError("Expected exactly the two frozen curated records")

    after_ids = [row.get("id") for row in dataset["records"]]
    if before_ids != after_ids:
        raise ValueError("Record order or identifiers changed")

    return dataset, changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    data = json.loads(args.input.read_text(encoding="utf-8"))
    data, changed = apply_patch(data)
    args.output.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_CURATED_FINAL", json.dumps({
        "changed": changed,
        "records": len(data["records"]),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

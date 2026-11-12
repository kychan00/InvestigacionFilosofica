#!/usr/bin/env python3
"""Eight externally corroborated Sincronía author bylines; no network or guessing.

Only the original authors field and bibliographic evidence field may change.
The source document is not necessarily a working URL to the original article.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

VERIFIED = [
    {
        "id": "cucsh:sincronia-legacy:27dae399fcaea20388c8",
        "issue": 1,
        "title": "Etymologies of Humor",
        "authors": [
            "Stephen W. Gilbert"
        ],
        "source": "https://bibliotekanauki.pl/articles/953985.pdf",
        "note": "Independent scholarly reference reproduces the original Sincronía article URL and expanded subtitle."
    },
    {
        "id": "cucsh:sincronia-legacy:0d03b7013ac3ec69cf19",
        "issue": 2,
        "title": "The US Invasion of the Dominican Republic: 1965",
        "authors": [
            "Salvador E. Gomez"
        ],
        "source": "https://www.ibidem.eu/out/media/vlb_9783838278827_2.pdf",
        "note": "Scholarly reference identifies S. E. Gomez and the exact Sincronía title; independent citation expands the first name."
    },
    {
        "id": "cucsh:sincronia-legacy:726d4fe32b7a37df5e61",
        "issue": 2,
        "title": "Another Fifty Years of the Corrido: A Reassessment",
        "authors": [
            "James Nicolopulos"
        ],
        "source": "https://forum.lasaweb.org/cmsb/uploads/lasaforum-vol28-issue1.pdf",
        "note": "LASA 1997 programme identifies full author and title; additional published references identify Sincronía republication."
    },
    {
        "id": "cucsh:sincronia-legacy:ad43534fc4d05afb5df6",
        "issue": 3,
        "title": "National Bodies: Woman as Nation in Latin American Narrative",
        "authors": [
            "Kristin E. Pitt"
        ],
        "source": "https://getd.libs.uga.edu/pdfs/prats-rodriguez_ana_m_200405_ma.pdf",
        "note": "University dissertation citation identifies Kristin E. Pitt and the exact original Sincronía URL."
    },
    {
        "id": "cucsh:sincronia-legacy:96cc3d8364b60e0fb6a5",
        "issue": 2,
        "title": "Guillermo Gómez-Peña: Dragging Representation",
        "authors": [
            "Robert Neustadt"
        ],
        "source": "https://bibliotecavirtual.clacso.org.ar/ar/libros/lasa97/neustadt.pdf",
        "note": "Full-text original conference paper names author and title; legacy Sincronía page slug matches surname."
    },
    {
        "id": "cucsh:sincronia-legacy:1d505f6f383808dcf98d",
        "issue": 5,
        "title": "The A,B,C's of Alienation and Re-Integration: Merle Hodge's Crick Crack, Monkey",
        "authors": [
            "William A. Clemente"
        ],
        "source": "https://www.nscs.edu/_resources/e30d%3Apvox1i-1fw/files/76602851z6c60c753/_fn/Board_Materials_April_19_20_2018.pdf",
        "note": "Official emeritus curriculum vitae of Bill Clemente lists exact Sincronía work; original publication date differs between sources and is preserved unchanged."
    },
    {
        "id": "cucsh:sincronia-legacy:f37dd7deec0e83c2c6fd",
        "issue": 2,
        "title": "La danza inmóvil : un prototipo de literatura postmodernista",
        "authors": [
            "Melvy Portocarrero"
        ],
        "source": "https://bibliotecavirtual.clacso.org.ar/ar/libros/lasa97/portocarrero.pdf",
        "note": "Original full text lists Melvy Portocarrero; only author updated, original legacy title punctuation retained."
    },
    {
        "id": "cucsh:sincronia-legacy:8698e05dd22391c46f61",
        "issue": 3,
        "title": "Facing Political Reality in Mexico",
        "authors": [
            "Andrew Reding"
        ],
        "source": "https://www.researchgate.net/publication/232977507_Facing_political_reality_in_Mexico",
        "note": "Author-uploaded published paper identifies Andrew Reding; original Sincronía URL has reding.html and title matches."
    }
]


def apply_evidence_eight(dataset):
    rows = dataset["records"]
    before_ids = [row["id"] for row in rows]
    expected = {row["id"]: row for row in VERIFIED}
    if len(expected) != 8 or len(rows) != 1845:
        raise ValueError("Unexpected frozen corpus or mapping count")
    sin = [row for row in rows if row.get("journal") == "Sincronía"]
    if len(sin) != 1454 or sum(not row.get("authors") for row in sin) != 123:
        raise ValueError("Unexpected Sincronía count or pending-author baseline")
    changed = []
    for row in rows:
        item = expected.get(row["id"])
        if item is None:
            continue
        if (row.get("journal") != "Sincronía"
                or row.get("issueNumber") != item["issue"]
                or row.get("title") != item["title"]
                or row.get("authors")
                or row.get("legacyAuthorEvidence")
                or not row.get("legacyOriginal")):
            raise ValueError("Frozen author baseline mismatch: " + item["id"])
        row["authors"] = [
            {"name": author, "sourceName": author}
            for author in item["authors"]
        ]
        row["legacyAuthorEvidence"] = {
            "kind": "independent-source-exact-work-attribution",
            "sourceUrl": item["source"],
            "verifiedAuthors": list(item["authors"]),
            "matchedTitle": item["title"],
            "matchedIssueNumber": item["issue"],
            "evidenceNote": item["note"],
            "accessCaveat": (
                "Bibliographic evidence only. The legacy article URL remains "
                "unavailable or archived-only, as recorded separately."
            ),
        }
        changed.append(item["id"])
    if set(changed) != set(expected) or [row["id"] for row in rows] != before_ids:
        raise ValueError("Eight expected records not changed uniquely")
    if sum(not row.get("authors") for row in sin) != 115:
        raise ValueError("Missing-author count must become 115")
    return dataset, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    result, changed = apply_evidence_eight(data)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_EIGHT_EXTERNAL_AUTHOR_MATCHES",
          json.dumps({"changed": changed, "records": len(result["records"]),
                      "pendingAuthors": 115}, ensure_ascii=False))


if __name__ == "__main__":
    main()

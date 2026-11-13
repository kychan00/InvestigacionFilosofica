#!/usr/bin/env python3
"""Restore a single author supported by an exact historical URL citation."""
import argparse
import json
from pathlib import Path

RID = "cucsh:sincronia-legacy:e60046233994aa2ee497"
URL = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/revueltas.htm"
AUTHOR = "Yoon Bong Seo"
EVIDENCE = {
    "kind": "university-masters-thesis-bibliography-exact-historical-url-and-byline",
    "sourceUrl": "https://uvadoc.uva.es/bitstream/handle/10324/3560/TFM-F-45.pdf?sequence=1",
    "sourceInstitution": "Universidad de Valladolid, Facultad de Filosofía y Letras",
    "sourceAuthor": "Violeta Cárdenas Hernández",
    "sourceYear": 2013,
    "sourcePage": 79,
    "sourceBylineAsPrinted": "Bong Seo, Yoon",
    "sourceBibliographicTitle": "Muerte y conciencia social en El luto humano, de José Revueltas",
    "sourcePublicationYear": 2000,
    "sourceHistoricalUrl": URL,
    "urlMatchLevel": "exact-historical-url-plus-byline-and-work-title",
    "publicationVersionCaveat": (
        "The Universidad de Valladolid 2013 master's thesis bibliography, p. 79, "
        "cites Bong Seo, Yoon (2000) with the exact historical Sincronia "
        "REVUELTAS.htm URL. The frozen issue-16 index uses the label "
        "'Yoon Bong Seo', not the article's bibliographic title. "
        "Preserve the original index title, issue, year and URL. "
        "The bibliography establishes historical attribution, not current "
        "URL availability or textual identity of other copies."
    ),
}

def restore(data):
    rows = data["records"]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454:
        raise ValueError("Frozen corpus size changed")
    if sum(not r.get("authors") for r in sin) != 52:
        raise ValueError("Expected 52 authorless records before restoration")
    if len({r.get("id") for r in rows}) != len(rows):
        raise ValueError("Duplicate corpus ID")
    matches = [r for r in rows if r.get("id") == RID]
    if len(matches) != 1:
        raise ValueError("Target record absent or duplicated")
    row = matches[0]
    if (row.get("journal") != "Sincronía" or
        row.get("title") != "Yoon Bong Seo" or
        row.get("issueNumber") != 16 or row.get("year") != 2000 or
        (row.get("urls") or {}).get("canonical", "").lower() != URL.lower() or
        row.get("authors") or row.get("legacyAuthorEvidence") or
        not row.get("legacyOriginal") or
        not (row.get("legacyAccessStatus") or {}).get("status")):
        raise ValueError("Historical record identity or source state changed")
    row["authors"] = [{"name": AUTHOR, "sourceName": AUTHOR}]
    row["legacyAuthorEvidence"] = {
        **EVIDENCE, "verifiedAuthor": AUTHOR,
        "verifiedTitle": row["title"], "sourceArticleUrl": URL,
        "matchedIndexedIssue": 16, "matchedIndexedYear": 2000,
        "originalAvailabilityPreserved": True,
    }
    if sum(not r.get("authors") for r in sin) != 51:
        raise ValueError("Expected 51 authorless records after restoration")
    return data

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    d = json.loads(a.input.read_text(encoding="utf-8"))
    restore(d)
    a.output.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("SINCRONIA_YOON_EXACT_URL_VERIFIED", RID)

if __name__ == "__main__":
    main()

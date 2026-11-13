#!/usr/bin/env python3
"""Conservative restoration of three documented Sincronía historical bylines.

The sources verify authorship, not necessarily edition equivalence or live
availability of historical Sincronía original URLs. No original record field
is modified except authors and explicitly qualified legacyAuthorEvidence.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SOURCES = {
    "cucsh:sincronia-legacy:85d4f3d2eb35e3a0212e": {
        "title": "Posmodernidad y la lógica cultural del capitalismo tardío",
        "author": "Gladys Adamson",
        "issue": 5,
        "year": 1998,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/Adamson.htm",
        "status": "original-page-unavailable",
        "evidence": {
            "kind": "academic-journal-exact-original-url-plus-original-author-edition",
            "sourceUrl": "https://biblat.unam.mx/hevila/Politicayestrategia/2005/no99/8.pdf",
            "sourcePublisher": "Academia Nacional de Estudios Políticos y Estratégicos",
            "sourcePublicationYear": 2005,
            "sourcePrintedPage": 121,
            "sourceNote": 2,
            "sourceTitleVariant": "Postmodernidad y la lógica cultural del capitalismo tardío",
            "sourceCitedOriginalUrl": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/Adamson.htm",
            "supportingSourceUrl": "https://revistas.ucatolicaluisamigo.edu.co/poiesis/article/view/1094",
            "supportingPublisher": "Revista Poiésis",
            "supportingPublicationYearAsIndexed": 2001,
            "additionalPublicationYearInBibliographies": 1997,
            "urlMatchLevel": "independent-academic-exact-original-url-citation",
            "publicationVersionCaveat": (
                "The original Sincronía index places this title in issue 5 "
                "(1998). A Chilean academic publication cites the exact "
                "/CUCSH/Sincronia/Adamson.htm URL and author; other "
                "bibliographies give 1997. The author's same-title text "
                "also appears in Poiésis issue 2 (2001), its online citation "
                "currently displays 2014. Treat these as distinct source "
                "dates; do not replace original issue/year or assume live access."
            ),
        },
    },
    "cucsh:sincronia-legacy:41866b9efbd00a2e1122": {
        "title": "Dependência e desenvolvimento na América Latina: 30 anos depois",
        "author": "João Ignácio Pires Lucas",
        "issue": 11,
        "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/pires.htm",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "researcher-lattes-bibliography-exact-title-journal-season",
            "sourceUrl": "https://www.escavador.com/sobre/4239136/joao-ignacio-pires-lucas",
            "sourceDescription": "Brazilian Lattes-derived researcher publication list",
            "sourceArticleCitation": (
                "LUCAS, J. I. P. Dependência e desenvolvimento na América "
                "Latina: 30 anos depois. Sincronía (Guadalajara), "
                "México, verano, 1999"
            ),
            "sourcePublicationSeason": "verano de 1999",
            "supportingSourceUrl": "https://www.moebio.uchile.cl/07/pires.html",
            "supportingSourceRole": (
                "University of Chile 2000 separate related publication "
                "confirms the researcher's full byline, not the original URL"
            ),
            "relatedPublicationYear": 1998,
            "urlMatchLevel": "researcher-bibliography-exact-title-journal-season-no-original-url",
            "publicationVersionCaveat": (
                "The researcher bibliography cites this precise title "
                "published in Sincronía in summer 1999; the same title "
                "appeared in Coletânea Cultura e Saber in 1998. "
                "Do not conflate versions or infer original URL validity. "
                "Preserve original 1999 issue 11 record and archived-only status."
            ),
        },
    },
    "cucsh:sincronia-legacy:52e1171a03b2379749fe": {
        "title": "Habermas' Crisis of Legitimation: Guatemala as a Case of Study",
        "author": "Giovanni Efraín Reyes Ortiz",
        "issue": 9,
        "year": 1999,
        "url": "http://fuentes.csh.udg.mx/CUCSH/Sincronia/reyes2.htm",
        "status": "original-page-archived-only",
        "evidence": {
            "kind": "independent-2002-fulltext-signed-exact-title",
            "sourceUrl": "https://www.gongfa.com/habeimasihefaxingweidimala.htm",
            "sourceTitle": "Habermas' Crisis of Legitimation: Guatemala as a Case of Study",
            "sourceByline": "Giovanni E. Reyes",
            "sourceAffiliation": "University of Pittsburgh",
            "supportingSourceUrl": "https://www.gongfa.com/0204.htm",
            "supportingSourceDate": "2002-04-23",
            "authorNameExpansionSource": (
                "https://research-hub.urosario.edu.co/"
                "display/giovanni-efrain-reyes-ortiz"
            ),
            "urlMatchLevel": "independent-signed-exact-title-no-original-url-proof",
            "publicationVersionCaveat": (
                "A historic April 2002 web index and preserved full text "
                "attribute the exact work to Giovanni E. Reyes. His expanded "
                "identity is Giovanni Efraín Reyes Ortiz. The Sincronía index "
                "places this distinctive title in issue 9 (1999), but "
                "external evidence does not show its /reyes2.htm URL. "
                "Preserve original journal date, URL and archived-only status."
            ),
        },
    },
}


def restore_three(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(ids) != len(set(ids)):
        raise ValueError("Unexpected frozen CUCSH/Sincronía records or ID count")
    if sum(not r.get("authors") for r in sin) != 63:
        raise ValueError("Expected exactly 63 unresolved Sincronía authors")
    changed = []
    for row in rows:
        rid = row.get("id")
        if rid not in SOURCES:
            continue
        f = SOURCES[rid]
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != f["issue"]
            or row.get("year") != f["year"]
            or row.get("title") != f["title"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or not row.get("legacyOriginal")
            or (row.get("urls") or {}).get("canonical") != f["url"]
            or (row.get("legacyAccessStatus") or {}).get("status") != f["status"]
        ):
            raise ValueError("Frozen historical work mismatch: " + rid)
        row["authors"] = [{"name": f["author"], "sourceName": f["author"]}]
        row["legacyAuthorEvidence"] = {
            **f["evidence"],
            "verifiedAuthor": f["author"],
            "verifiedTitle": f["title"],
            "sourceArticleUrl": f["url"],
            "matchedIndexedIssue": f["issue"],
            "matchedIndexedYear": f["year"],
            "originalAvailabilityPreserved": True,
        }
        changed.append(rid)
    if len(changed) != 3 or set(changed) != set(SOURCES):
        raise ValueError("Expected precisely three matched original work IDs")
    if ids != [r.get("id") for r in rows]:
        raise ValueError("Stable record ID ordering has changed")
    if sum(not r.get("authors") for r in sin) != 60:
        raise ValueError("Expected 60 outstanding Sincronía authorless records")
    return data, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    updated, changed = restore_three(data)
    args.output.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("SINCRONIA_THREE_NEW_CITED", json.dumps({
        "changed": changed, "records": len(updated["records"]),
        "remainingAuthorless": 60,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

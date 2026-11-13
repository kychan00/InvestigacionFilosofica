#!/usr/bin/env python3
"""Five evidence-locked issue 46/47 Sincronía repairs, anchored to Dialnet.

Three verified title restorations and five author attributions. Two existing
historical title strings are preserved; differing source titles are recorded
as bibliographic provenance instead of being silently substituted.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

VERIFIED = [
  {
    "id": "cucsh:sincronia-legacy:15f593f7bde72d33a081",
    "issue": 46,
    "year": 2008,
    "oldTitle": "González Salazar, Antonio; Juárez, Armando y Valdivia Órnelas, Luís,",
    "newTitle": "Análisis del balance hídrico y su influencia en el surgimiento de grietas en el Valle de Tesistán",
    "authors": [
      "Antonio González Salazar",
      "Armando Juárez Guaní",
      "Lluís Valdivia Orleans"
    ],
    "suffix": "/gonzalezspring08.htm",
    "source": "https://dialnet.unirioja.es/servlet/articulo?codigo=2858720",
    "sourceTitle": "Análisis del balance hídrico y su influencia en el surgimiento de grietas en el Valle de Tesistán",
    "note": "El índice original tiene una etiqueta de autores con variantes de apellidos. Se conservan textualmente esas variantes y se adoptan los autores que publica el sumario bibliográfico de Dialnet para la misma edición."
  },
  {
    "id": "cucsh:sincronia-legacy:8032a652020cefdf8953",
    "issue": 46,
    "year": 2008,
    "oldTitle": "Korstanje, Maximiliano",
    "newTitle": "Observaciones sobre la gastronomía en Roma Imperial: un enfoque interdisciplinario",
    "authors": [
      "Maximiliano Emanuel Korstanje"
    ],
    "suffix": "/maximilianospring08.htm",
    "source": "https://dialnet.unirioja.es/servlet/articulo?codigo=2858714",
    "sourceTitle": "Observaciones sobre la gastronomía en Roma Imperial: un enfoque interdisciplinario",
    "note": "El sumario de Dialnet del número 46 contiene esta única contribución atribuida a Maximiliano Korstanje."
  },
  {
    "id": "cucsh:sincronia-legacy:28a0dbaf40e37d406a5a",
    "issue": 47,
    "year": 2008,
    "oldTitle": "Deconstructing Employment Policy in America: Equal Pay or Affirmative Action",
    "newTitle": None,
    "authors": [
      "Jason L. Powell",
      "Ian Cook"
    ],
    "suffix": "/powellsummer08.htm",
    "source": "https://dialnet.unirioja.es/servlet/articulo?codigo=3296006",
    "sourceTitle": "Deconstructing Employment Policy in America: Equal Pay or Affirmative Action",
    "note": "Título y dos autores coinciden exactamente con el registro bibliográfico del número 47."
  },
  {
    "id": "cucsh:sincronia-legacy:c7a8809b261362f79466",
    "issue": 47,
    "year": 2008,
    "oldTitle": "Desarrollo humano y calidad de vida",
    "newTitle": "Ciencia, Desarrollo Humano y calidad de vida",
    "authors": [
      "Rocío Calderón García"
    ],
    "suffix": "/calderonsummer08.htm",
    "source": "https://dialnet.unirioja.es/servlet/articulo?codigo=3296016",
    "sourceTitle": "Ciencia, Desarrollo Humano y calidad de vida",
    "note": "El sumario de Dialnet incluye 'Ciencia' al comienzo del título, ausente en el índice local anterior."
  },
  {
    "id": "cucsh:sincronia-legacy:e4386de4eb370de99a23",
    "issue": 47,
    "year": 2008,
    "oldTitle": "Cayo Seutonio and Roman Leisure: An Historical Perspective for a modern problem",
    "newTitle": None,
    "authors": [
      "Maximiliano Emanuel Korstanje"
    ],
    "suffix": "/korstanjesummer2008b.htm",
    "source": "https://dialnet.unirioja.es/servlet/articulo?codigo=3296009",
    "sourceTitle": "Cayo Suetonio and roman leisure: an historical perspective for an modern problem",
    "note": "Dialnet registra 'Suetonio', mientras la entrada histórica usa 'Seutonio'; el título antiguo se conserva literalmente hasta comprobar el original."
  }
]

def repair_issue46_47(data):
    rows = data["records"]
    ids = [r.get("id") for r in rows]
    sin = [r for r in rows if r.get("journal") == "Sincronía"]
    if len(rows) != 1845 or len(sin) != 1454 or len(set(ids)) != len(ids):
        raise ValueError("Unexpected CUCSH Sincronía corpus or duplicate IDs")
    if sum(not r.get("authors") for r in sin) != 96:
        raise ValueError("Expected exactly 96 records without Sincronía bylines")
    frozen = {entry["id"]: entry for entry in VERIFIED}
    if len(frozen) != 5 or len(VERIFIED) != 5:
        raise ValueError("Exactly five unique Dialnet mappings required")
    updated = []
    for row in rows:
        entry = frozen.get(row.get("id"))
        if entry is None:
            continue
        url = (row.get("urls") or {}).get("canonical") or ""
        if (
            row.get("journal") != "Sincronía"
            or row.get("issueNumber") != entry["issue"]
            or row.get("year") != entry["year"]
            or row.get("title") != entry["oldTitle"]
            or row.get("authors")
            or row.get("legacyAuthorEvidence")
            or row.get("legacyIndexMislabelEvidence")
            or not row.get("legacyOriginal")
            or not url.lower().endswith(entry["suffix"].lower())
        ):
            raise ValueError("Historical Dialnet identity mismatch: "+entry["id"])
        if entry["newTitle"] is not None:
            row["title"] = entry["newTitle"]
            row["titleVariants"] = [entry["newTitle"]]
            row["legacyIndexMislabelEvidence"] = {
                "kind": "dialnet-exact-issue-article-identity-restoration",
                "sourceUrl": entry["source"],
                "previousTitle": entry["oldTitle"],
                "verifiedTitle": entry["newTitle"],
                "sourceArticleUrl": url,
                "sourceOriginalTitle": entry["sourceTitle"],
                "matchedIssueNumber": entry["issue"],
                "matchedYear": entry["year"],
                "originalAvailabilityPreserved": True,
                "sourceNote": entry["note"],
            }
        row["authors"] = [
            {"name": name, "sourceName": name}
            for name in entry["authors"]
        ]
        row["legacyAuthorEvidence"] = {
            "kind": "dialnet-exact-issue-article-bibliographic-byline",
            "sourceUrl": entry["source"],
            "verifiedAuthors": entry["authors"],
            "originalIndexedTitle": entry["oldTitle"],
            "sourceArticleTitle": entry["sourceTitle"],
            "matchedIssueNumber": entry["issue"],
            "matchedYear": entry["year"],
            "originalArticleUrlPreserved": url,
            "originalAvailabilityPreserved": True,
            "sourceNote": entry["note"],
        }
        updated.append(entry["id"])
    if set(updated) != set(frozen) or ids != [r.get("id") for r in rows]:
        raise ValueError("Exactly five prior source identifiers must change")
    if sum(not r.get("authors") for r in sin) != 91:
        raise ValueError("Expected 91 remaining without author")
    return data, updated

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    result, changed = repair_issue46_47(data)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n",
                           encoding="utf-8")
    print("SINCRONIA_DIALNET_46_47_REPAIR",json.dumps({
        "changed":changed,"total":len(result["records"]),
        "remainingMissingAuthors":91},ensure_ascii=False))

if __name__ == "__main__":
    main()

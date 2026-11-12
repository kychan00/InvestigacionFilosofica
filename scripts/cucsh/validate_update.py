#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re

from collections import Counter
from pathlib import Path


PROVIDER = "CUCSH Filosofía"

REQUIRED_JOURNALS = {
    "Protrepsis",
    "Quadripartita Ratio",
}


ALLOWED_JOURNALS = {
    *REQUIRED_JOURNALS,
    "Sincronía",
}


def fail(message):
    raise SystemExit(
        "CUCSH UPDATE VALIDATION: FAIL\n"
        + str(message)
    )


def load_json(path):
    try:
        return json.loads(
            path.read_text(
                encoding="utf-8"
            )
        )
    except Exception as exc:
        fail(
            f"cannot read {path}: {exc}"
        )


def record_key(record):
    return (
        record.get("id")
        or record.get("sourceId")
    )


def duplicates(values):
    counts = Counter(
        value
        for value in values
        if value
    )

    return sorted(
        value
        for value, count
        in counts.items()
        if count > 1
    )


def validate_snapshot(
    data,
    label,
):
    if (
        data.get("schemaVersion")
        != 1
    ):
        fail(
            f"{label}: "
            "invalid schemaVersion"
        )


    if (
        data.get("provider")
        != PROVIDER
    ):
        fail(
            f"{label}: "
            "invalid provider"
        )


    records = data.get(
        "records"
    )


    if not isinstance(
        records,
        list,
    ):
        fail(
            f"{label}: "
            "records is not a list"
        )


    if not records:
        fail(
            f"{label}: "
            "empty corpus"
        )


    ids = [
        record_key(record)
        for record in records
    ]


    if any(
        not value
        for value in ids
    ):
        fail(
            f"{label}: "
            "record without stable id"
        )


    duplicate_ids = duplicates(
        ids
    )

    if duplicate_ids:
        fail(
            f"{label}: duplicate ids: "
            f"{duplicate_ids[:10]}"
        )


    dois = [
        record.get("doi")
        for record in records
        if record.get("doi")
    ]

    duplicate_dois = duplicates(
        dois
    )

    if duplicate_dois:
        fail(
            f"{label}: duplicate DOI: "
            f"{duplicate_dois[:10]}"
        )


    urls = [
        record.get(
            "urls",
            {}
        ).get(
            "canonical"
        )
        for record in records
        if record.get(
            "urls",
            {}
        ).get(
            "canonical"
        )
    ]

    duplicate_urls = duplicates(
        urls
    )

    if duplicate_urls:
        fail(
            f"{label}: duplicate URLs: "
            f"{duplicate_urls[:10]}"
        )


    journals = {
        record.get("journal")
        for record in records
    }


    if not journals.issubset(
        ALLOWED_JOURNALS
    ):
        fail(
            f"{label}: "
            "unexpected journals: "
            f"{sorted(journals)}"
        )


    missing_required = (
        REQUIRED_JOURNALS
        - journals
    )

    if missing_required:
        fail(
            f"{label}: "
            "missing required journals: "
            f"{sorted(missing_required)}"
        )


    for record in records:
        key = record_key(
            record
        )


        for field in (
            "title",
            "year",
            "journal",
        ):
            if not record.get(
                field
            ):
                fail(
                    f"{label}: "
                    f"missing {field} "
                    f"in {key}"
                )


        if (
            not record.get(
                "authors"
            )
            and not record.get(
                "legacyOriginal"
            )
        ):
            fail(
                f"{label}: "
                "missing authors "
                f"in {key}"
            )


        if record.get(
            "legacyOriginal"
        ):
            if (
                record.get(
                    "journal"
                )
                != "Sincronía"
            ):
                fail(
                    f"{label}: "
                    "legacy record outside "
                    f"Sincronía: {key}"
                )

            issue_number = (
                record.get(
                    "issueNumber"
                )
            )

            if (
                not isinstance(
                    issue_number,
                    int,
                )
                or not (
                    1 <=
                    issue_number <=
                    84
                )
            ):
                fail(
                    f"{label}: "
                    "invalid legacy "
                    f"issue number in {key}"
                )


        doi = record.get(
            "doi"
        )

        if (
            doi
            and doi.endswith(
                (
                    ".",
                    ",",
                    ";",
                    ":",
                )
            )
        ):
            fail(
                f"{label}: "
                "DOI with trailing "
                f"punctuation: {doi}"
            )


        title = str(
            record.get(
                "title"
            )
            or ""
        ).strip()


        if (
            title.casefold()
            == "editorial"
        ):
            fail(
                f"{label}: "
                "Editorial remained "
                f"in corpus: {key}"
            )


        searchable = json.dumps(
            {
                "abstract":
                    record.get(
                        "abstract"
                    ),

                "abstractVariants":
                    record.get(
                        "abstractVariants",
                        [],
                    ),
            },
            ensure_ascii=False,
        )


        if re.search(
            r"temperie.*"
            r"secci[oó]n\s+literaria\s+"
            r"no\s+arbitrada",
            searchable,
            re.IGNORECASE,
        ):
            fail(
                f"{label}: "
                "non-peer-reviewed "
                f"Temperie remained: {key}"
            )


    return records


# Minimum OBSERVED historical records, not a claim of exhaustive
# completeness. Numbers 1-48 and 50-51 come from the 2026-11-11
# legacy-v3 GitHub Actions evidence (run 42961992150).
# Number 44: audit 42975312757 confirmed 10 Dialnet articles and
# release 42975808247 safely added 8 records without deleting the 2 prior.
# Number 49's 21 titles are sourced from Dialnet exemplar 251060.
# Numbers 52-60 are from targeted successful Dialnet audit run
# 42971659878, de-duplicated by Dialnet article code across issues.
# Counts prevent a later network hiccup from silently publishing fewer
# records than were already found. Full article-level provenance is
# still required before calling the entire corpus complete.
SINCRONIA_HISTORICAL_OBSERVED_MINIMUM = {
    1: 14,
    2: 8,
    3: 4,
    4: 8,
    5: 10,
    6: 3,
    7: 7,
    8: 3,
    9: 6,
    10: 7,
    11: 5,
    12: 8,
    13: 8,
    14: 8,
    15: 7,
    16: 13,
    17: 13,
    18: 10,
    19: 18,
    20: 16,
    21: 26,
    22: 30,
    23: 9,
    24: 14,
    25: 17,
    26: 12,
    27: 11,
    28: 15,
    29: 2,
    30: 6,
    31: 3,
    32: 11,
    33: 2,
    34: 4,
    35: 8,
    36: 6,
    37: 9,
    38: 5,
    39: 6,
    40: 9,
    41: 13,
    42: 7,
    43: 7,
    44: 10,
    45: 10,
    46: 19,
    47: 14,
    48: 10,
    49: 21,
    50: 10,
    51: 9,
    52: 9,
    53: 8,
    54: 12,
    55: 4,
    56: 9,
    57: 11,
    58: 9,
    59: 6,
    60: 19,
}


def safe_two_bibliography_titles(before, after):
    """Exactly two independent historic bibliography-matched title repairs."""
    approved = {
        "cucsh:sincronia-legacy:940caceb0d1f820da9a5": (
            "Soler Diaz, Maria Antonieta",
            "Prospectiva de la educación en México",
            "María Antonieta Soler Díaz",
            "https://posgrado.colef.mx/wp-content/uploads/2011/04/TESIS-Morales-Nev%C3%A1rez-Ana-Mar%C3%ADa.pdf",
        ),
        "cucsh:sincronia-legacy:b6e314746adecc6757dd": (
            "Mejía , Guadalupe,",
            "Texto y música en Jalisco",
            "Guadalupe Mejía",
            "https://www.academia.edu/9657868/The_Frontier_of_Progress_and_Repression_1950s_American_Suburbia_in_Todd_Hayness_Far_From_Heaven",
        ),
    }
    item = approved.get(before.get("id"))
    if not item or before.get("id") != after.get("id"):
        return False
    former, title, author, source = item
    evidence = after.get("legacyIndexMislabelEvidence")
    byline = after.get("legacyAuthorEvidence")
    original = (before.get("urls") or {}).get("canonical")
    if (
        before.get("journal") != "Sincronía"
        or after.get("journal") != "Sincronía"
        or before.get("title") != former
        or after.get("title") != title
        or after.get("titleVariants") != [title]
        or before.get("authors")
        or before.get("legacyAuthorEvidence")
        or before.get("legacyIndexMislabelEvidence")
        or not isinstance(evidence, dict)
        or not isinstance(byline, dict)
        or evidence.get("kind") != "original-index-author-name-replaced-by-cited-work-title"
        or evidence.get("sourceUrl") != source
        or evidence.get("sourceArticleUrl") != original
        or evidence.get("previousTitle") != former
        or evidence.get("verifiedTitle") != title
        or evidence.get("verifiedAuthors") != [author]
        or evidence.get("matchedYear") != before.get("year")
        or evidence.get("matchedIssueNumber") != before.get("issueNumber")
        or evidence.get("originalAvailabilityPreserved") is not True
        or byline.get("kind") != "independent-exact-title-original-url-citation"
        or byline.get("sourceUrl") != source
        or byline.get("verifiedTitle") != title
        or byline.get("verifiedAuthors") != [author]
        or byline.get("matchedIssueNumber") != before.get("issueNumber")
        or byline.get("originalAvailabilityPreserved") is not True
        or [a.get("name") for a in (after.get("authors") or [])] != [author]
    ):
        return False
    permitted = {
        "title", "titleVariants", "authors",
        "legacyAuthorEvidence", "legacyIndexMislabelEvidence",
    }
    return all(
        before.get(field) == after.get(field)
        for field in set(before) | set(after)
        if field not in permitted
    )


def safe_four_verified_early_titles_batch_two(before, after):
    """Only permit exactly documented 2000–2001 Sincronía label repairs.

    A frozen allowlist is independent of the remediation script. Previously
    verified metadata and archival availability must remain untouched.
    """
    approved = {
        "cucsh:sincronia-legacy:1efffea46e9b286d444c": (
            "Reyes, Giovanni",
            "The International Monetary Fund: Main Characteristics, Conditionality and Macroeconomic Adjustment",
            "Giovanni E. Reyes",
            "https://cdi.mecon.gob.ar/bases/docelec/dp2556.pdf",
        ),
        "cucsh:sincronia-legacy:cb9d04769f12b6216000": (
            "Macías Rodríguez , Claudia",
            "Presencia de la fiesta en El Llano en llamas de Juan Rulfo",
            "Claudia Macías Rodríguez",
            "https://revistas.ucm.es/index.php/ALHI/article/view/62734",
        ),
        "cucsh:sincronia-legacy:b3b56216992bd5336973": (
            "Vidaurre Arenas, Carmen V.",
            "Una historieta mexicana",
            "Carmen V. Vidaurre Arenas",
            "https://publications.iai.spk-berlin.de/servlets/MCRFileNodeServlet/Document_derivate_00002942/Carrillo%20Zeiter_Mueller_Comic.pdf",
        ),
        "cucsh:sincronia-legacy:c69e9245b6317699440e": (
            "Reyes, Giovanni E.",
            "Theory of globalization: fundamental Basis",
            "Giovanni E. Reyes",
            "https://repository.urosario.edu.co/items/c3ec783f-517d-456b-b90b-50303f4e1bf2/full",
        ),
    }
    item = approved.get(before.get("id"))
    if not item or before.get("id") != after.get("id"):
        return False
    former, title, author, source = item
    evidence = after.get("legacyIndexMislabelEvidence")
    byline = after.get("legacyAuthorEvidence")
    original = (before.get("urls") or {}).get("canonical")
    if (
        before.get("journal") != "Sincronía"
        or after.get("journal") != "Sincronía"
        or before.get("title") != former
        or after.get("title") != title
        or after.get("titleVariants") != [title]
        or before.get("authors")
        or before.get("legacyAuthorEvidence")
        or before.get("legacyIndexMislabelEvidence")
        or not isinstance(evidence, dict)
        or not isinstance(byline, dict)
        or evidence.get("kind") != "original-index-author-name-instead-of-article-title"
        or evidence.get("sourceUrl") != source
        or evidence.get("sourceArticleUrl") != original
        or evidence.get("previousTitle") != former
        or evidence.get("verifiedTitle") != title
        or evidence.get("verifiedAuthors") != [author]
        or evidence.get("matchedYear") != before.get("year")
        or evidence.get("matchedIssueNumber") != before.get("issueNumber")
        or evidence.get("originalAvailabilityPreserved") is not True
        or byline.get("kind") != "independent-title-author-url-bibliography"
        or byline.get("sourceUrl") != source
        or byline.get("verifiedTitle") != title
        or byline.get("verifiedAuthors") != [author]
        or byline.get("matchedIssueNumber") != before.get("issueNumber")
        or byline.get("originalAvailabilityPreserved") is not True
        or [a.get("name") for a in (after.get("authors") or [])] != [author]
    ):
        return False
    permitted = {
        "title", "titleVariants", "authors",
        "legacyAuthorEvidence", "legacyIndexMislabelEvidence",
    }
    return all(
        before.get(field) == after.get(field)
        for field in set(before) | set(after)
        if field not in permitted
    )


def safe_five_verified_index_title_reconstruction(before, after):
    """Permit only five independently sourced repairs of author-name index labels.

    This is intentionally an immutable exact-ID allowlist. Other existing
    author/title provenance remains protected, including earlier byte fixes.
    """
    approved = {
        "cucsh:sincronia-legacy:49b5784a8ae06fa454b2": (
            "Gilbert, Stephen W.",
            "Metáforas conceptuales y la teoría de «mezclaje»",
            "Stephen W. Gilbert",
            "https://www.academia.edu/30627352/Los_espacios_mentales_en_pr%C3%A1ctica",
        ),
        "cucsh:sincronia-legacy:4f37b04c2e8bb672fe93": (
            "Rodríguez Alonso, Jesús A.,",
            "Relación Individuo-Sociedad en Foucault y Habermas",
            "Jesús Alberto Rodríguez Alonso",
            "https://www.researchgate.net/publication/275892003_Relacion_Individuo-Sociedad_en_Foucault_y_Habermas",
        ),
        "cucsh:sincronia-legacy:7b1169fc953bb5bbcde5": (
            "Bong Seo, Yoon",
            "Juan Rulfo, escritor y fotógrafo: dos artes en conjunción",
            "Seo Yoon Bong",
            "https://tesiunamdocumentos.dgb.unam.mx/ptb2010/mayo/0657883/0657883_A12.pdf",
        ),
        "cucsh:sincronia-legacy:c177a81b39d937c10913": (
            "Schmidhuber, Guillermo",
            "Sor Juana Inés de la Cruz, dramaturga",
            "Guillermo Schmidhuber",
            "https://alternativas.me/wp-content/uploads/Alternativas-en-Psicologia-42-Numero-especial.pdf",
        ),
        "cucsh:sincronia-legacy:8681f9c51943f77086d0": (
            "Alvarado Borgoño, Miguel",
            "La estrategia narrativa de una utopía abierta. La obra 'Facundo' de Faustino Sarmiento",
            "Miguel Alvarado Borgoño",
            "https://revistas.udec.cl/index.php/rtr/article/download/22007/19529",
        ),
    }
    case = approved.get(before.get("id"))
    if not case or before.get("id") != after.get("id"):
        return False
    former, title, author, source = case
    evidence = after.get("legacyIndexMislabelEvidence")
    author_evidence = after.get("legacyAuthorEvidence")
    original = (before.get("urls") or {}).get("canonical")
    if (
        before.get("journal") != "Sincronía"
        or after.get("journal") != "Sincronía"
        or before.get("title") != former
        or after.get("title") != title
        or after.get("titleVariants") != [title]
        or before.get("authors")
        or before.get("legacyIndexMislabelEvidence")
        or before.get("legacyAuthorEvidence")
        or not isinstance(evidence, dict)
        or not isinstance(author_evidence, dict)
        or evidence.get("kind") != "original-issue-index-used-author-name-instead-of-title"
        or evidence.get("sourceUrl") != source
        or evidence.get("previousTitle") != former
        or evidence.get("verifiedTitle") != title
        or evidence.get("verifiedAuthors") != [author]
        or evidence.get("sourceArticleUrl") != original
        or evidence.get("matchedIssueNumber") != before.get("issueNumber")
        or evidence.get("originalAvailabilityPreserved") is not True
        or author_evidence.get("sourceUrl") != source
        or author_evidence.get("verifiedTitle") != title
        or author_evidence.get("verifiedAuthors") != [author]
        or author_evidence.get("matchedIssueNumber") != before.get("issueNumber")
        or author_evidence.get("originalAvailabilityPreserved") is not True
        or [a.get("name") for a in (after.get("authors") or [])] != [author]
    ):
        return False
    permitted = {
        "title", "titleVariants", "authors",
        "legacyAuthorEvidence", "legacyIndexMislabelEvidence",
    }
    return all(
        before.get(field) == after.get(field)
        for field in set(before) | set(after)
        if field not in permitted
    )


def safe_issue17_index_label_reconstruction(before, after):
    """Permit a source-proven issue-17 correction of an *author index label*.

    Earlier title-encoding provenance describes restored bytes in the index,
    not a source-verified article title. It must remain unchanged when we
    replace the index label with the one-to-one Dialnet article title.
    """
    prior = before.get("legacyTitleEncodingEvidence")
    migration = after.get("legacyIndexMislabelEvidence")
    if not isinstance(prior, dict) or not isinstance(migration, dict):
        return False
    if (
        before.get("journal") != "Sincronía"
        or after.get("journal") != "Sincronía"
        or before.get("issueNumber") != 17
        or after.get("issueNumber") != 17
        or prior.get("kind") != "original-issue-index-article-url-and-title"
        or prior.get("auditRunId") != 43032349081
        or prior.get("sourceIndexUrl") !=
           (before.get("urls") or {}).get("canonical")
        or prior != after.get("legacyTitleEncodingEvidence")
        or before.get("legacyIndexMislabelEvidence")
        or migration.get("kind") !=
           "original-issue-index-used-author-names-instead-of-title"
        or migration.get("sourceIssueUrl") !=
           "https://dialnet.unirioja.es/ejemplar/547854"
        or migration.get("previousTitle") != before.get("title")
        or not migration.get("priorIndexEncodingEvidencePreserved")
        or not isinstance(migration.get("auditRunId"), int)
        or migration["auditRunId"] <= 0
        or not isinstance(migration.get("score"), (int, float))
        or migration["score"] < 0.8
    ):
        return False

    article_id = migration.get("dialnetArticleId") or ""
    if not isinstance(article_id, str) or not article_id.startswith("dialnet:"):
        return False
    code = article_id.removeprefix("dialnet:")
    if (
        not code.isdecimal()
        or migration.get("sourceUrl") !=
           f"https://dialnet.unirioja.es/servlet/articulo?codigo={code}"
        or not isinstance(after.get("title"), str)
        or len(after["title"]) < 12
        or "\ufffd" in after["title"]
        or after["title"] == before.get("title")
        or after.get("titleVariants") != [after["title"]]
    ):
        return False

    permitted = {
        "title", "titleVariants", "authors", "legacyAuthorEvidence",
        "legacyIndexMislabelEvidence",
    }
    for key in set(before) | set(after):
        if key not in permitted and before.get(key) != after.get(key):
            return False
    if before.get("authors") and before["authors"] != after.get("authors"):
        return False
    if not after.get("authors"):
        return False
    return True


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--before",
        type=Path,
        required=True,
    )

    parser.add_argument(
        "--after",
        type=Path,
        required=True,
    )

    parser.add_argument(
        "--allow-incomplete-sincronia",
        action="store_true",
        help=(
            "Discovery mode: report missing Sincronía "
            "issues without failing coverage validation. "
            "All structural and destructive-update checks "
            "remain strict."
        ),
    )

    args = parser.parse_args()


    before = validate_snapshot(
        load_json(
            args.before
        ),
        "BEFORE",
    )

    after = validate_snapshot(
        load_json(
            args.after
        ),
        "AFTER",
    )


    if not any(
        record.get("journal")
        == "Sincronía"
        for record in after
    ):
        fail(
            "AFTER: Sincronía is missing "
            "from the harvested corpus"
        )


    sincronia_issue_numbers = {
        record.get(
            "issueNumber"
        )
        for record in after
        if (
            record.get(
                "journal"
            )
            == "Sincronía"
            and isinstance(
                record.get(
                    "issueNumber"
                ),
                int,
            )
        )
    }

    expected_sincronia_issues = set(
        range(
            1,
            91,
        )
    )

    missing_sincronia_issues = sorted(
        expected_sincronia_issues
        - sincronia_issue_numbers
    )

    if missing_sincronia_issues:
        if args.allow_incomplete_sincronia:
            print(
                "CUCSH UPDATE VALIDATION: "
                "DISCOVERY WARNING"
            )
            print(
                "AFTER: incomplete Sincronía "
                "issue coverage; missing "
                f"{missing_sincronia_issues}"
            )
        else:
            fail(
                "AFTER: incomplete Sincronía "
                "issue coverage; missing "
                f"{missing_sincronia_issues}"
            )



    # Issue presence alone is insufficient: one record per issue would
    # pass the issue-number gate while discarding hundreds of articles.
    historical_counts = Counter(
        record.get("issueNumber")
        for record in after
        if record.get("journal") == "Sincronía"
        and isinstance(record.get("issueNumber"), int)
        and 1 <= record["issueNumber"] <= 60
    )
    below_observed_baseline = {
        issue: {
            "found": historical_counts[issue],
            "minimum": floor,
        }
        for issue, floor in SINCRONIA_HISTORICAL_OBSERVED_MINIMUM.items()
        if historical_counts[issue] < floor
    }
    if below_observed_baseline:
        message = (
            "AFTER: Sincronía historical article counts fell below "
            "previously observed evidence: "
            f"{below_observed_baseline}"
        )
        if args.allow_incomplete_sincronia:
            print("CUCSH UPDATE VALIDATION: DISCOVERY WARNING")
            print(message)
        else:
            fail(message)


    before_by_id = {
        record_key(record):
            record
        for record in before
    }

    after_by_id = {
        record_key(record):
            record
        for record in after
    }


    removed = sorted(
        set(before_by_id)
        - set(after_by_id)
    )

    added = sorted(
        set(after_by_id)
        - set(before_by_id)
    )

    common = (
        set(before_by_id)
        & set(after_by_id)
    )


    changed = sorted(
        key
        for key in common
        if (
            before_by_id[key]
            != after_by_id[key]
        )
    )


    if removed:
        print(
            "===== REMOVED RECORDS ====="
        )

        for key in removed[:25]:
            record = (
                before_by_id[key]
            )

            print(
                "-",
                key,
                "|",
                record.get(
                    "title"
                ),
            )

        fail(
            "refusing destructive "
            "update: "
            f"{len(removed)} "
            "previous records disappeared"
        )


    # A source hiccup must not silently erase an author already verified
    # and committed. This applies equally to strict and discovery mode.
    lost_authors = [
        key for key in sorted(common)
        if before_by_id[key].get("journal") == "Sincronía"
        and before_by_id[key].get("authors")
        and not after_by_id[key].get("authors")
    ]
    if lost_authors:
        fail(
            "AFTER: previously verified Sincronía authors disappeared "
            f"from {len(lost_authors)} records: {lost_authors[:15]}"
        )


    verified_title_regressions = [
        key for key in sorted(common)
        if before_by_id[key].get("journal") == "Sincronía"
        and before_by_id[key].get("legacyTitleEncodingEvidence")
        and (
            before_by_id[key].get("title") != after_by_id[key].get("title")
            or before_by_id[key].get("legacyTitleEncodingEvidence") !=
               after_by_id[key].get("legacyTitleEncodingEvidence")
        )
        and not safe_issue17_index_label_reconstruction(
            before_by_id[key], after_by_id[key]
        )
        and not safe_five_verified_index_title_reconstruction(
            before_by_id[key], after_by_id[key]
        )
        and not safe_four_verified_early_titles_batch_two(
            before_by_id[key], after_by_id[key]
        )
        and not safe_two_bibliography_titles(
            before_by_id[key], after_by_id[key]
        )
    ]
    if verified_title_regressions:
        fail(
            "AFTER: verified Sincronía title repairs changed or lost provenance: "
            f"{verified_title_regressions[:15]}"
        )

    verified_author_regressions = [
        key for key in sorted(common)
        if before_by_id[key].get("journal") == "Sincronía"
        and before_by_id[key].get("legacyAuthorEvidence")
        and (
            before_by_id[key].get("authors") != after_by_id[key].get("authors")
            or before_by_id[key].get("legacyAuthorEvidence") !=
               after_by_id[key].get("legacyAuthorEvidence")
        )
    ]
    if verified_author_regressions:
        fail(
            "AFTER: verified Sincronía author provenance changed or disappeared: "
            f"{verified_author_regressions[:15]}"
        )

    newly_damaged_titles = [
        key for key in sorted(common)
        if before_by_id[key].get("journal") == "Sincronía"
        and "\ufffd" not in str(before_by_id[key].get("title") or "")
        and "\ufffd" in str(after_by_id[key].get("title") or "")
    ]
    if newly_damaged_titles:
        fail(
            "AFTER: Sincronía titles acquired replacement characters: "
            f"{newly_damaged_titles[:15]}"
        )


    before_counts = Counter(
        record["journal"]
        for record in before
    )

    after_counts = Counter(
        record["journal"]
        for record in after
    )


    print(
        "===== CUCSH UPDATE VALIDATION ====="
    )

    print(
        "before =",
        len(before),
    )

    print(
        "after  =",
        len(after),
    )

    print(
        "added  =",
        len(added),
    )

    print(
        "changed metadata =",
        len(changed),
    )

    print(
        "removed =",
        len(removed),
    )


    print()
    print(
        "===== JOURNALS ====="
    )

    for journal in sorted(
        ALLOWED_JOURNALS
    ):
        print(
            f"{journal}: "
            f"{before_counts[journal]} "
            f"-> "
            f"{after_counts[journal]}"
        )


    if added:
        print()
        print(
            "===== NEW RECORDS ====="
        )

        for key in added[:50]:
            record = (
                after_by_id[key]
            )

            print(
                "-",
                record["journal"],
                record["year"],
                "|",
                record["title"],
                "|",
                record.get("doi"),
            )


    if changed:
        print()
        print(
            "===== UPDATED METADATA ====="
        )

        for key in changed[:25]:
            record = (
                after_by_id[key]
            )

            print(
                "-",
                record["journal"],
                "|",
                record["title"],
            )


    print()
    print(
        "CUCSH UPDATE VALIDATION: PASS"
    )


if __name__ == "__main__":
    main()

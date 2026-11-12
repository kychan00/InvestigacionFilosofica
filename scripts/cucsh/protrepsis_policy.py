#!/usr/bin/env python3

from __future__ import annotations

import re


PROTREPSIS_DOI_RE = re.compile(
    r"^10\.32870/prot\.i(?P<issue>\d+(?:-\d+)?)\.(?P<article>\d+)$",
    re.IGNORECASE,
)

# Reconstructed from the original issue tables of contents.
# These records belong to TEMPERIE, explicitly identified by
# Protrepsis as a non-peer-reviewed literary section.
TEMPERIE_ARTICLE_IDS = {
    "1": {13, 14, 15, 16, 17, 18},
    "2": {24, 25, 26, 27, 28, 29},
    "3": {43, 44, 45, 46, 47, 48},
    "4": {61, 62, 63, 64, 65},
    "5": {82, 83, 85, 87, 88, 89},
    "6": {99, 101, 102, 103, 104, 106},
    "7-8": {113, 114, 115, 116, 117},
    "9-10": {119, 121, 122, 123, 124, 125},
    "13": {157, 158, 159, 160},
    "14": {179, 180, 181, 182, 183},
}


def normalize_protrepsis_doi(value):
    doi = str(value or "").strip().lower()

    doi = re.sub(
        r"^https?://(?:dx\.)?doi\.org/",
        "",
        doi,
        flags=re.IGNORECASE,
    )

    return doi.rstrip(".,;:)]}")


def protrepsis_issue_article(value):
    match = PROTREPSIS_DOI_RE.fullmatch(
        normalize_protrepsis_doi(value)
    )

    if not match:
        return None

    return (
        match.group("issue"),
        int(match.group("article")),
    )


def is_temperie_doi(value):
    parsed = protrepsis_issue_article(value)

    if not parsed:
        return False

    issue, article = parsed

    return article in TEMPERIE_ARTICLE_IDS.get(
        issue,
        set(),
    )


def is_temperie_record(record):
    if not isinstance(record, dict):
        return False

    if record.get("journal") != "Protrepsis":
        return False

    return is_temperie_doi(
        record.get("doi")
    )

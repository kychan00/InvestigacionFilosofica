#!/usr/bin/env python3
"""Verified editorial chronology for Quadripartita Ratio (CUCSH/UdeG).

The OJS issue archive provides the editorial year; an OAI dc:date is a
publication date, which can differ from the year printed on the issue.
A DOI issue token is a useful hint but is not authoritative where the
article's OJS page explicitly assigns another issue (article 185).
Source: https://quadripartitaratio.cucsh.udg.mx/index.php/QR/issue/archive
Exception: https://quadripartitaratio.cucsh.udg.mx/index.php/QR/article/view/185
"""

from __future__ import annotations

import re

ISSUE_ARCHIVE_URL = (
    "https://quadripartitaratio.cucsh.udg.mx/index.php/QR/issue/archive"
)
DOI_RE = re.compile(
    r"^10\.32870/qr\.v\d+i(?P<issue>\d+)\.(?P<article>\d+)$",
    re.IGNORECASE,
)
ARTICLE_URL_RE = re.compile(r"/article/view/(?P<article>\d+)(?:/|$)")

# Explicitly checked against the 21 issue headings in the official archive.
ISSUE_YEARS = {
    1: 2016, 2: 2016,
    3: 2017, 4: 2017,
    5: 2018, 6: 2018,
    7: 2019, 8: 2019,
    9: 2020, 10: 2020,
    11: 2021, 12: 2021,
    13: 2022, 14: 2022,
    15: 2023, 16: 2023,
    17: 2024, 18: 2024,
    19: 2025, 20: 2025,
    21: 2026,
}

# DOI v10i20.185 remains unchanged. OJS lists article 185 under
# Núm. 21 (2026), not Núm. 20: DO NOT rewrite the permanent DOI.
ARTICLE_ISSUE_OVERRIDES = {185: 21}


def editorial_metadata(record: dict) -> dict:
    """Enrich a Quadripartita record without inventing dates or abstracts.

    Preserve the original OAI publication date in both `date` and
    `publicationDate`; set `year`/ `issueYear` to the issue's printed
    editorial year for chronology, filtering, and publication citations.
    Unknown/ambiguous identities are unchanged (fail closed).
    """
    output = dict(record)
    if output.get("journal") != "Quadripartita Ratio":
        return output

    doi = str(output.get("doi") or "").strip().lower()
    doi = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", doi)
    match = DOI_RE.fullmatch(doi)
    if not match:
        return output

    issue = int(match.group("issue"))
    article = int(match.group("article"))
    canonical = str((output.get("urls") or {}).get("canonical") or "")
    url_match = ARTICLE_URL_RE.search(canonical)
    if not url_match or int(url_match.group("article")) != article:
        return output

    if article in ARTICLE_ISSUE_OVERRIDES:
        issue = ARTICLE_ISSUE_OVERRIDES[article]
    issue_year = ISSUE_YEARS.get(issue)
    if not issue_year:
        return output

    publication_date = output.get("publicationDate") or output.get("date")
    publication_year = None
    if publication_date:
        date_match = re.search(r"\b(19|20)\d{2}\b", str(publication_date))
        if date_match:
            publication_year = int(date_match.group(0))

    output["issue"] = str(issue)
    output["issueLabel"] = str(issue)
    output["issueNumbers"] = [issue]
    output["issueNumber"] = issue
    output["issueYear"] = issue_year
    output["year"] = issue_year
    output["editorialSource"] = (
        "https://quadripartitaratio.cucsh.udg.mx/index.php/QR/article/view/185"
        if article == 185 else ISSUE_ARCHIVE_URL
    )
    if publication_date:
        output["publicationDate"] = publication_date
    if publication_year is not None:
        output["publicationYear"] = publication_year

    return output

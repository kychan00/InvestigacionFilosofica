#!/usr/bin/env python3

from __future__ import annotations

import argparse
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from pathlib import Path


ISSN = "2007-9273"
JOURNAL = "Protrepsis"
PROVIDER = "CUCSH Filosofía"
CROSSREF_ENDPOINT = (
    "https://api.crossref.org/journals/"
    + ISSN
    + "/works"
)
DOI_RE = re.compile(
    r"^10\.32870/prot\.i(?P<issue>\d+(?:-\d+)?)\.(?P<article>\d+)$",
    re.IGNORECASE,
)
TAG_RE = re.compile(r"<[^>]*>")
SPACE_RE = re.compile(r"\s+")


def request_bytes(url: str, timeout: int = 35) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "InvestigacionFilosofica/"
                "ProtrepsisHistoricalHarvester-1.0"
            ),
            "Accept": "application/json,text/html,*/*;q=0.8",
        },
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def request_json(url: str):
    return json.loads(
        request_bytes(url).decode("utf-8")
    )


def clean_text(value):
    if value is None:
        return None

    text = html.unescape(str(value))
    text = TAG_RE.sub(" ", text)
    text = SPACE_RE.sub(" ", text).strip()
    return text or None


def issue_parts(label: str):
    return [
        int(part)
        for part in str(label).split("-")
        if part.isdigit()
    ]


def historical_issue_from_doi(doi: str):
    normalized = str(doi or "").strip().lower()
    match = DOI_RE.fullmatch(normalized)

    if not match:
        return None

    label = match.group("issue")
    numbers = issue_parts(label)

    if not numbers or max(numbers) > 14:
        return None

    return {
        "label": label,
        "numbers": numbers,
        "articleId": int(match.group("article")),
    }


def date_parts(item):
    for key in (
        "published-print",
        "published-online",
        "published",
        "issued",
        "created",
    ):
        parts = (
            item.get(key, {})
            .get("date-parts", [])
        )

        if parts and parts[0]:
            values = [
                int(value)
                for value in parts[0]
                if value is not None
            ]

            if values:
                return values

    return []


def iso_date(parts):
    if not parts:
        return None

    year = parts[0]

    if len(parts) >= 3:
        return f"{year:04d}-{parts[1]:02d}-{parts[2]:02d}"

    if len(parts) >= 2:
        return f"{year:04d}-{parts[1]:02d}"

    return str(year)


def normalize_author(author):
    literal = clean_text(author.get("name"))

    if literal:
        return {
            "name": literal,
            "sourceName": literal,
        }

    given = clean_text(author.get("given"))
    family = clean_text(author.get("family"))
    name = " ".join(
        part
        for part in (given, family)
        if part
    ).strip()

    if not name:
        return None

    source = ", ".join(
        part
        for part in (family, given)
        if part
    ).strip()

    return {
        "name": name,
        "sourceName": source or name,
    }


def guess_language(item, title, abstract):
    language = clean_text(item.get("language"))

    if language:
        value = language.lower()

        if value in {"spa", "es"}:
            return "es"

        if value in {"eng", "en"}:
            return "en"

        return value

    text = " ".join(
        value
        for value in (title, abstract)
        if value
    ).lower()

    spanish = sum(
        text.count(token)
        for token in (
            " de ",
            " la ",
            " el ",
            " que ",
            " para ",
            " filosofía",
            " ética",
        )
    )

    english = sum(
        text.count(token)
        for token in (
            " the ",
            " of ",
            " and ",
            " philosophy",
            " ethics",
        )
    )

    return "en" if english > spanish else "es"


def primary_url(item, doi):
    resource = (
        item.get("resource", {})
        .get("primary", {})
        .get("URL")
    )

    candidates = [
        clean_text(resource),
        *[
            clean_text(link.get("URL"))
            for link in item.get("link", [])
            if isinstance(link, dict)
        ],
    ]

    for candidate in candidates:
        if (
            candidate
            and "doi.org/" not in candidate.lower()
        ):
            return candidate

    resolver = "https://doi.org/" + doi

    try:
        request = urllib.request.Request(
            resolver,
            headers={
                "User-Agent": (
                    "InvestigacionFilosofica/"
                    "ProtrepsisHistoricalHarvester-1.0"
                )
            },
            method="HEAD",
        )

        with urllib.request.urlopen(
            request,
            timeout=15,
        ) as response:
            resolved = response.geturl()

        if (
            resolved
            and "doi.org/" not in resolved.lower()
        ):
            return resolved

    except Exception:
        pass

    return resolver


def pdf_url(item):
    for link in item.get("link", []):
        if not isinstance(link, dict):
            continue

        url = clean_text(link.get("URL"))
        content_type = (
            clean_text(link.get("content-type"))
            or ""
        ).lower()

        if not url:
            continue

        if (
            "pdf" in content_type
            or url.lower().endswith(".pdf")
            or "/article/download/" in url
        ):
            return url

    return None


def normalize_item(item):
    doi = (
        clean_text(item.get("DOI"))
        or ""
    ).lower()

    issue = historical_issue_from_doi(doi)

    if not issue:
        return None

    titles = [
        clean_text(value)
        for value in item.get("title", [])
    ]
    titles = [
        value
        for value in titles
        if value
    ]

    if not titles:
        return None

    title = titles[0]

    if title.casefold() == "editorial":
        return None

    authors = []

    for value in item.get("author", []):
        normalized = normalize_author(value)

        if normalized:
            authors.append(normalized)

    if not authors:
        return None

    parts = date_parts(item)
    year = parts[0] if parts else None

    if not year:
        return None

    abstract = clean_text(item.get("abstract"))
    subjects = [
        value
        for value in (
            clean_text(subject)
            for subject in item.get("subject", [])
        )
        if value
    ]

    page = clean_text(item.get("page"))
    issue_label = issue["label"].replace("-", "–")
    source_label = (
        f"Protrepsis, Núm. {issue_label}"
        + (f", pp. {page}" if page else "")
    )

    canonical = primary_url(item, doi)
    pdf = pdf_url(item)

    relations = []

    if pdf and pdf != canonical:
        relations.append(pdf)

    license_urls = [
        clean_text(value.get("URL"))
        for value in item.get("license", [])
        if isinstance(value, dict)
    ]

    rights = [
        value
        for value in license_urls
        if value
    ]

    return {
        "id": (
            "cucsh:protrepsis:historical:"
            + doi
        ),
        "sourceId": (
            "crossref:"
            + doi
        ),
        "oaiDatestamp": None,
        "journal": JOURNAL,
        "title": title,
        "titleVariants": titles,
        "authors": authors,
        "date": iso_date(parts),
        "year": year,
        "type": (
            clean_text(item.get("type"))
            or "journal-article"
        ),
        "language": guess_language(
            item,
            title,
            abstract,
        ),
        "languages": [],
        "doi": doi,
        "publisher": (
            clean_text(item.get("publisher"))
            or "Universidad de Guadalajara"
        ),
        "abstract": abstract,
        "abstractVariants": (
            [abstract]
            if abstract
            else []
        ),
        "subjects": subjects,
        "bibliographicSources": [
            source_label,
        ],
        "rights": rights,
        "issue": issue["label"],
        "issueLabel": issue_label,
        "issueNumbers": issue["numbers"],
        "issueNumber": (
            issue["numbers"][0]
            if len(issue["numbers"]) == 1
            else None
        ),
        "historicalSource": "Crossref",
        "urls": {
            "canonical": canonical,
            "doi": "https://doi.org/" + doi,
            "relations": relations,
        },
    }


def crossref_items():
    query = urllib.parse.urlencode({
        "filter": (
            "from-pub-date:2011-01-01,"
            "until-pub-date:2018-12-31"
        ),
        "rows": 1000,
    })

    data = request_json(
        CROSSREF_ENDPOINT
        + "?"
        + query
    )

    message = data.get("message", {})

    return message.get("items", [])


def build_dataset():
    rows = []

    for item in crossref_items():
        record = normalize_item(item)

        if record:
            rows.append(record)

        time.sleep(0.02)

    deduped = {}
    for record in rows:
        deduped[record["doi"]] = record

    records = sorted(
        deduped.values(),
        key=lambda record: (
            max(record.get("issueNumbers") or [0]),
            record.get("year") or 0,
            record.get("doi") or "",
        ),
    )

    issues = {}
    for record in records:
        label = record["issueLabel"]
        issues[label] = issues.get(label, 0) + 1

    return {
        "schemaVersion": 1,
        "provider": PROVIDER,
        "journal": JOURNAL,
        "coverage": {
            "issueRange": "1–14",
            "source": "Crossref + DOI resolver/OJS",
            "issues": issues,
        },
        "records": records,
    }


def validate(dataset):
    records = dataset.get("records", [])

    if not records:
        raise RuntimeError(
            "historical Protrepsis corpus is empty"
        )

    dois = [
        record.get("doi")
        for record in records
    ]

    if len(dois) != len(set(dois)):
        raise RuntimeError(
            "duplicate historical DOI"
        )

    issue_numbers = {
        number
        for record in records
        for number in (
            record.get("issueNumbers")
            or []
        )
    }

    required = set(range(1, 15))
    missing = sorted(required - issue_numbers)

    # Los números 7-8, 9-10 y 11-12 son dobles,
    # pero deben cubrir ambos números nominales.
    if missing:
        raise RuntimeError(
            "historical issue coverage missing: "
            + ", ".join(map(str, missing))
        )

    for record in records:
        if not record.get("title"):
            raise RuntimeError(
                "record without title"
            )

        if not record.get("authors"):
            raise RuntimeError(
                "record without authors: "
                + str(record.get("doi"))
            )

        if not record.get("year"):
            raise RuntimeError(
                "record without year: "
                + str(record.get("doi"))
            )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
    )
    args = parser.parse_args()

    dataset = build_dataset()
    validate(dataset)

    args.output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )
    args.output.write_text(
        json.dumps(
            dataset,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        "PROTREPSIS HISTORICAL =",
        len(dataset["records"]),
    )

    for issue, count in (
        dataset["coverage"]["issues"].items()
    ):
        print(
            f"  issue[{issue}]={count}"
        )


if __name__ == "__main__":
    main()

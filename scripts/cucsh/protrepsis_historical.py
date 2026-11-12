#!/usr/bin/env python3

from __future__ import annotations

import argparse
import html
import json
import re
import time
import urllib.parse
import urllib.request

from pathlib import Path


JOURNAL = "Protrepsis"
PROVIDER = "CUCSH Filosofía"
OPENALEX_SOURCE_ID = "S4210214317"
OPENALEX_ENDPOINT = "https://api.openalex.org/works"
DOI_RE = re.compile(
    r"^10\.32870/prot\.i(?P<issue>\d+(?:-\d+)?)\.(?P<article>\d+)$",
    re.IGNORECASE,
)
TAG_RE = re.compile(r"<[^>]*>")
SPACE_RE = re.compile(r"\s+")
TEMPERIE_RE = re.compile(
    r"temperie.*secci[oó]n\s+literaria\s+no\s+arbitrada",
    re.IGNORECASE,
)

# La versión histórica de OpenAlex no conserva de forma
# consistente la sección editorial de OJS. Estos IDs se
# reconstruyen de los índices de cada número y corresponden
# a V. TEMPERIE, la sección literaria no arbitrada que el
# cosechador OAI moderno ya excluye por política.
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


def request_json(url: str, timeout: int = 35):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "InvestigacionFilosofica/"
                "ProtrepsisHistoricalHarvester-2.0"
            ),
            "Accept": "application/json",
        },
    )

    with urllib.request.urlopen(
        request,
        timeout=timeout,
    ) as response:
        return json.loads(
            response.read().decode("utf-8")
        )


def clean_text(value):
    if value is None:
        return None

    text = html.unescape(str(value))
    text = TAG_RE.sub(" ", text)
    text = SPACE_RE.sub(" ", text).strip()
    return text or None


def normalize_doi(value):
    doi = (
        clean_text(value)
        or ""
    ).strip().lower()

    doi = re.sub(
        r"^https?://(?:dx\.)?doi\.org/",
        "",
        doi,
        flags=re.IGNORECASE,
    )

    return doi.rstrip(".,;:)]}")


def issue_parts(label: str):
    return [
        int(part)
        for part in str(label).split("-")
        if part.isdigit()
    ]


def historical_issue_from_doi(doi: str):
    match = DOI_RE.fullmatch(
        normalize_doi(doi)
    )

    if not match:
        return None

    label = match.group("issue")
    numbers = issue_parts(label)

    if (
        not numbers
        or min(numbers) < 1
        or max(numbers) > 14
    ):
        return None

    return {
        "label": label,
        "numbers": numbers,
        "articleId": int(
            match.group("article")
        ),
    }


def abstract_from_inverted_index(index):
    if not isinstance(index, dict) or not index:
        return None

    tokens = []

    for token, positions in index.items():
        for position in positions or []:
            if isinstance(position, int):
                tokens.append(
                    (position, token)
                )

    if not tokens:
        return None

    tokens.sort(
        key=lambda pair: pair[0]
    )

    return clean_text(
        " ".join(
            token
            for _, token in tokens
        )
    )


def normalize_author(authorship):
    author = (
        authorship.get("author")
        or {}
    )

    name = clean_text(
        author.get("display_name")
    )

    if not name:
        return None

    result = {
        "name": name,
        "sourceName": name,
    }

    orcid = clean_text(
        author.get("orcid")
    )

    if orcid:
        result["orcid"] = orcid

    return result


def first_location_url(work):
    candidates = []

    primary = (
        work.get("primary_location")
        or {}
    )

    for key in (
        "landing_page_url",
        "pdf_url",
    ):
        value = clean_text(
            primary.get(key)
        )

        if value:
            candidates.append(value)

    open_access = (
        work.get("open_access")
        or {}
    )

    oa_url = clean_text(
        open_access.get("oa_url")
    )

    if oa_url:
        candidates.append(oa_url)

    for location in (
        work.get("locations")
        or []
    ):
        if not isinstance(location, dict):
            continue

        for key in (
            "landing_page_url",
            "pdf_url",
        ):
            value = clean_text(
                location.get(key)
            )

            if value:
                candidates.append(value)

    for value in candidates:
        if (
            "/article/view/" in value
            and "doi.org/" not in value.lower()
        ):
            return value

    for value in candidates:
        if "doi.org/" not in value.lower():
            return value

    return None


def relation_urls(work, canonical):
    output = []

    def add(value):
        clean = clean_text(value)

        if (
            not clean
            or clean == canonical
            or clean in output
        ):
            return

        if clean.startswith(
            ("http://", "https://")
        ):
            output.append(clean)

    primary = (
        work.get("primary_location")
        or {}
    )

    add(primary.get("pdf_url"))

    for location in (
        work.get("locations")
        or []
    ):
        if not isinstance(location, dict):
            continue

        add(
            location.get(
                "landing_page_url"
            )
        )
        add(
            location.get(
                "pdf_url"
            )
        )

    return output[:8]


def subjects_from_work(work):
    output = []

    for keyword in (
        work.get("keywords")
        or []
    ):
        if not isinstance(keyword, dict):
            continue

        value = clean_text(
            keyword.get("display_name")
        )

        if value and value not in output:
            output.append(value)

    for topic in (
        work.get("topics")
        or []
    ):
        if not isinstance(topic, dict):
            continue

        value = clean_text(
            topic.get("display_name")
        )

        if value and value not in output:
            output.append(value)

    return output[:12]


def source_is_protrepsis(location):
    source = (
        (location or {}).get("source")
        or {}
    )

    source_id = clean_text(
        source.get("id")
    )

    if (
        source_id
        and source_id.rstrip("/").endswith(
            "/" + OPENALEX_SOURCE_ID
        )
    ):
        return True

    return (
        clean_text(
            source.get("display_name")
        )
        == JOURNAL
    )


def normalize_work(work):
    doi = normalize_doi(
        work.get("doi")
    )

    issue = (
        historical_issue_from_doi(
            doi
        )
    )

    if not issue:
        return None

    if (
        issue["articleId"]
        in TEMPERIE_ARTICLE_IDS.get(
            issue["label"],
            set(),
        )
    ):
        return None

    title = clean_text(
        work.get("title")
        or work.get("display_name")
    )

    if not title:
        return None

    if title.casefold() == "editorial":
        return None

    abstract = (
        abstract_from_inverted_index(
            work.get(
                "abstract_inverted_index"
            )
        )
    )

    searchable = " ".join(
        value
        for value in (
            title,
            abstract,
        )
        if value
    )

    if TEMPERIE_RE.search(searchable):
        return None

    authors = []

    for authorship in (
        work.get("authorships")
        or []
    ):
        if not isinstance(
            authorship,
            dict,
        ):
            continue

        author = normalize_author(
            authorship
        )

        if author:
            authors.append(author)

    if not authors:
        return None

    year = work.get(
        "publication_year"
    )

    if not isinstance(year, int):
        return None

    publication_date = clean_text(
        work.get("publication_date")
    )

    language = (
        clean_text(
            work.get("language")
        )
        or "es"
    ).lower()

    biblio = (
        work.get("biblio")
        or {}
    )

    pages = []

    first_page = clean_text(
        biblio.get("first_page")
    )
    last_page = clean_text(
        biblio.get("last_page")
    )

    if first_page:
        pages.append(first_page)

    if (
        last_page
        and last_page != first_page
    ):
        pages.append(last_page)

    issue_label = (
        issue["label"]
        .replace("-", "–")
    )

    source_label = (
        f"Protrepsis, Núm. "
        f"{issue_label}"
    )

    if pages:
        source_label += (
            ", pp. "
            + "–".join(pages)
        )

    canonical = (
        first_location_url(work)
        or (
            "https://doi.org/"
            + doi
        )
    )

    source_record = (
        work.get("primary_location")
        or {}
    )

    if not source_is_protrepsis(
        source_record
    ):
        for location in (
            work.get("locations")
            or []
        ):
            if source_is_protrepsis(
                location
            ):
                source_record = location
                break

    openalex_id = clean_text(
        work.get("id")
    )

    return {
        "id": (
            "cucsh:protrepsis:"
            "historical:"
            + doi
        ),
        "sourceId": (
            "openalex:"
            + (
                openalex_id.rsplit(
                    "/",
                    1,
                )[-1]
                if openalex_id
                else doi
            )
        ),
        "oaiDatestamp": None,
        "journal": JOURNAL,
        "title": title,
        "titleVariants": [title],
        "authors": authors,
        "date": publication_date,
        "year": year,
        "type": "journal-article",
        "language": language,
        "languages": [language],
        "doi": doi,
        "publisher": (
            clean_text(
                (
                    source_record.get(
                        "source"
                    )
                    or {}
                ).get(
                    "host_organization_name"
                )
            )
            or "Universidad de Guadalajara"
        ),
        "abstract": abstract,
        "abstractVariants": (
            [abstract]
            if abstract
            else []
        ),
        "subjects": (
            subjects_from_work(work)
        ),
        "bibliographicSources": [
            source_label,
        ],
        "rights": (
            [
                clean_text(
                    (
                        work.get(
                            "primary_location"
                        )
                        or {}
                    ).get("license")
                )
            ]
            if clean_text(
                (
                    work.get(
                        "primary_location"
                    )
                    or {}
                ).get("license")
            )
            else []
        ),
        "issue": issue["label"],
        "issueLabel": issue_label,
        "issueNumbers": issue["numbers"],
        "issueNumber": (
            issue["numbers"][0]
            if len(
                issue["numbers"]
            ) == 1
            else None
        ),
        "historicalSource": "OpenAlex",
        "openAlexId": openalex_id,
        "urls": {
            "canonical": canonical,
            "doi": (
                "https://doi.org/"
                + doi
            ),
            "relations": (
                relation_urls(
                    work,
                    canonical,
                )
            ),
        },
    }


def openalex_pages():
    query = urllib.parse.urlencode({
        "filter": (
            "primary_location.source.id:"
            + OPENALEX_SOURCE_ID
            + ",from_publication_date:"
            "2011-01-01"
            + ",to_publication_date:"
            "2018-10-31"
        ),
        "per-page": 200,
        "page": 1,
    })

    data = request_json(
        OPENALEX_ENDPOINT
        + "?"
        + query
    )

    results = data.get(
        "results",
        []
    )

    total = int(
        data.get(
            "meta",
            {},
        ).get(
            "count",
            len(results),
        )
        or 0
    )

    print(
        "OpenAlex historical "
        f"received={len(results)} "
        f"total={total}"
    )

    if total > len(results):
        raise RuntimeError(
            "historical OpenAlex result "
            f"exceeds one page: {total}"
        )

    yield from results


def build_dataset():
    deduped = {}

    for work in openalex_pages():
        record = normalize_work(work)

        if not record:
            continue

        deduped[
            record["doi"]
        ] = record

    records = sorted(
        deduped.values(),
        key=lambda record: (
            max(
                record.get(
                    "issueNumbers"
                )
                or [0]
            ),
            record.get("year")
            or 0,
            record.get("doi")
            or "",
        ),
    )

    issues = {}

    for record in records:
        label = record["issueLabel"]
        issues[label] = (
            issues.get(label, 0)
            + 1
        )

    return {
        "schemaVersion": 1,
        "provider": PROVIDER,
        "journal": JOURNAL,
        "coverage": {
            "issueRange": "1–14",
            "source": (
                "OpenAlex + "
                "Protrepsis/OJS URLs"
            ),
            "openAlexSourceId":
                OPENALEX_SOURCE_ID,
            "issues": issues,
        },
        "records": records,
    }


def validate(dataset):
    records = dataset.get(
        "records",
        []
    )

    if not records:
        raise RuntimeError(
            "historical Protrepsis "
            "corpus is empty"
        )

    if len(records) < 70:
        raise RuntimeError(
            "historical Protrepsis "
            "corpus unexpectedly small: "
            + str(len(records))
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
            record.get(
                "issueNumbers"
            )
            or []
        )
    }

    required = set(
        range(1, 15)
    )

    missing = sorted(
        required
        - issue_numbers
    )

    if missing:
        raise RuntimeError(
            "historical issue coverage "
            "missing: "
            + ", ".join(
                map(str, missing)
            )
        )

    if not any(
        record.get("doi")
        == "10.32870/prot.i1.11"
        for record in records
    ):
        raise RuntimeError(
            "known issue 1 anchor "
            "10.32870/prot.i1.11 missing"
        )

    if not any(
        record.get("doi")
        == "10.32870/prot.i3.42"
        for record in records
    ):
        raise RuntimeError(
            "known issue 3 anchor "
            "10.32870/prot.i3.42 missing"
        )

    if not any(
        "9-10" in (
            record.get("issue")
            or ""
        )
        for record in records
    ):
        raise RuntimeError(
            "combined issue 9-10 missing"
        )

    for record in records:
        issue = (
            historical_issue_from_doi(
                record.get("doi")
            )
        )

        if (
            issue
            and issue["articleId"]
            in TEMPERIE_ARTICLE_IDS.get(
                issue["label"],
                set(),
            )
        ):
            raise RuntimeError(
                "Temperie record remained: "
                + str(record.get("doi"))
            )

        for field in (
            "title",
            "authors",
            "year",
            "doi",
        ):
            if not record.get(field):
                raise RuntimeError(
                    "historical record "
                    f"missing {field}: "
                    + str(
                        record.get("id")
                    )
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
        dataset["coverage"]
        ["issues"].items()
    ):
        print(
            f"  issue[{issue}]={count}"
        )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from html.parser import HTMLParser
from collections import Counter
from pathlib import Path

try:
    from scripts.cucsh.sincronia_legacy import (
        harvest_legacy_records,
    )
except ModuleNotFoundError:
    from sincronia_legacy import (
        harvest_legacy_records,
    )


OAI = "http://www.openarchives.org/OAI/2.0/"
DC = "http://purl.org/dc/elements/1.1/"

PROVIDER = "CUCSH Filosofía"

ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

DEFAULT_OUTPUT = (
    ROOT
    / "src"
    / "data"
    / "cucsh-filosofia.json"
)


SOURCES = [
    {
        "id": "quadripartita-ratio",
        "journal": "Quadripartita Ratio",
        "endpoints": [
            (
                "https://quadripartitaratio.cucsh.udg.mx/"
                "index.php/QR/oai"
            ),
        ],
    },
    {
        "id": "protrepsis",
        "journal": "Protrepsis",
        "endpoints": [
            (
                "https://protrepsis.cucsh.udg.mx/"
                "index.php/prot/oai"
            ),
            (
                "http://protrepsis.cucsh.udg.mx/"
                "index.php/prot/oai"
            ),
        ],
    },
    {
        "id": "sincronia",
        "journal": "Sincronía",
        "endpoints": [
            (
                "https://revistasincronia.cucsh.udg.mx/"
                "index.php/sincronia/oai"
            ),
        ],
        "issueArchive": (
            "https://revistasincronia.cucsh.udg.mx/"
            "index.php/sincronia/issue/archive"
        ),
        "enrichIssueMetadata": True,
        "legacyArchives": [
            (
                "https://sincronia.cucsh.udg.mx/"
                "num_anteriores.html"
            ),
            (
                "http://sincronia.cucsh.udg.mx/"
                "num_anteriores.html"
            ),
            (
                "https://fuentes.csh.udg.mx/"
                "CUCSH/Sincronia/"
                "num_anteriores.html"
            ),
            (
                "http://fuentes.csh.udg.mx/"
                "CUCSH/Sincronia/"
                "num_anteriores.html"
            ),
            (
                "https://www.cucsh.udg.mx/"
                "CUCSH/Sincronia/"
                "num_anteriores.html"
            ),
            (
                "http://www.cucsh.udg.mx/"
                "CUCSH/Sincronia/"
                "num_anteriores.html"
            ),
        ],
        "legacyMaxIssue": 84,
    },
]


LANGUAGE_MAP = {
    "spa": "es",
    "es": "es",
    "eng": "en",
    "en": "en",
    "fra": "fr",
    "fre": "fr",
    "fr": "fr",
    "deu": "de",
    "ger": "de",
    "de": "de",
    "ita": "it",
    "it": "it",
    "por": "pt",
    "pt": "pt",
}


SPANISH_HINTS = {
    "el",
    "la",
    "los",
    "las",
    "un",
    "una",
    "unos",
    "unas",
    "de",
    "del",
    "que",
    "para",
    "por",
    "con",
    "como",
    "en",
    "y",
    "filosofia",
    "filosofía",
    "argumentacion",
    "argumentación",
}


ENGLISH_HINTS = {
    "the",
    "a",
    "an",
    "of",
    "and",
    "to",
    "in",
    "for",
    "with",
    "from",
    "on",
    "philosophy",
    "argumentation",
}


ADMIN_DESCRIPTION_DATE_RE = re.compile(
    r"(?:"
    r"reception|received|accepted|"
    r"recepci[oó]n|aceptaci[oó]n"
    r")"
    r"\s*:\s*"
    r"(?:"
    r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]+"
    r"\s+\d{1,2},\s+\d{4}"
    r"|"
    r"\d{1,2}\s+de\s+"
    r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]+"
    r"\s+de\s+\d{4}"
    r"|"
    r"\d{4}-\d{2}-\d{2}"
    r")",
    re.IGNORECASE,
)


DOI_RE = re.compile(
    r"(10\.\d{4,9}/[^\s<>\"']+)",
    re.IGNORECASE,
)


EDITORIAL_TITLE_RE = re.compile(
    r"^editorial$",
    re.IGNORECASE,
)


SINCRONIA_NON_ARTICLE_TITLE_RE = re.compile(
    (
        r"^(?:"
        r"cintillo\s+legal(?:\s+del.*)?"
        r"|"
        r"n[uú]mero(?:\s+\d+)?\s+completo"
        r")$"
    ),
    re.IGNORECASE,
)


TEMPERIE_RE = re.compile(
    r"temperie.*"
    r"secci[oó]n\s+literaria\s+"
    r"no\s+arbitrada",
    re.IGNORECASE,
)


TAG_RE = re.compile(
    r"<[^>]*>"
)


WHITESPACE_RE = re.compile(
    r"\s+"
)


def request_bytes(
    url: str,
    timeout: int = 30,
) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent":
                (
                    "InvestigacionFilosofica/"
                    "CUCSHMetadataHarvester-0.1"
                ),
            "Accept":
                (
                    "application/xml,text/xml,"
                    "application/xhtml+xml,"
                    "text/html;q=0.8,*/*;q=0.5"
                ),
        },
    )

    with urllib.request.urlopen(
        request,
        timeout=timeout,
    ) as response:
        return response.read()


def clean_text(
    value,
) -> str | None:
    if value is None:
        return None

    text = str(value)

    for _ in range(3):
        decoded = html.unescape(text)

        if decoded == text:
            break

        text = decoded

    text = TAG_RE.sub(
        " ",
        text,
    )

    text = text.replace(
        "\xa0",
        " ",
    )

    text = WHITESPACE_RE.sub(
        " ",
        text,
    ).strip()

    text = re.sub(
        r"\s+([,.;:!?])",
        r"\1",
        text,
    )

    return text or None


def unique_strings(
    values,
):
    output = []
    seen = set()

    for value in values or []:
        clean = clean_text(value)

        if not clean:
            continue

        key = clean.casefold()

        if key in seen:
            continue

        seen.add(key)
        output.append(clean)

    return output


def normalize_language(
    value,
):
    clean = (
        clean_text(value)
        or ""
    ).lower()

    return (
        LANGUAGE_MAP.get(clean)
        or clean
        or None
    )


def text_tokens(
    value,
):
    normalized = (
        clean_text(value)
        or ""
    )

    normalized = (
        normalized
        .casefold()
    )

    normalized = re.sub(
        r"[^\wáéíóúüñ]+",
        " ",
        normalized,
        flags=re.UNICODE,
    )

    return {
        token
        for token in normalized.split()
        if token
    }


def language_score(
    value,
    language,
):
    text = (
        clean_text(value)
        or ""
    )

    tokens = text_tokens(text)

    if language == "es":
        score = len(
            tokens
            & SPANISH_HINTS
        ) * 2

        score += len(
            re.findall(
                r"[áéíóúüñ¿¡]",
                text.casefold(),
            )
        )

        return score

    if language == "en":
        return len(
            tokens
            & ENGLISH_HINTS
        ) * 2

    return 0


def choose_variant(
    values,
    preferred_language="es",
):
    candidates = unique_strings(
        values
    )

    if not candidates:
        return None

    if len(candidates) == 1:
        return candidates[0]

    ranked = sorted(
        enumerate(candidates),
        key=lambda pair: (
            language_score(
                pair[1],
                preferred_language,
            ),
            len(pair[1]),
            pair[0],
        ),
        reverse=True,
    )

    best = ranked[0][1]

    if (
        language_score(
            best,
            preferred_language,
        ) > 0
    ):
        return best

    return candidates[0]


def exclusion_reason(
    title,
    descriptions,
):
    clean_title = (
        clean_text(title)
        or ""
    )

    if EDITORIAL_TITLE_RE.fullmatch(
        clean_title
    ):
        return "front-matter-editorial"

    for value in descriptions or []:
        clean = (
            clean_text(value)
            or ""
        )

        if TEMPERIE_RE.search(
            clean
        ):
            return (
                "non-peer-reviewed-literary"
            )

    return None


def normalize_creator(
    value,
):
    original = (
        clean_text(value)
        or ""
    )

    if not original:
        return None

    if original.count(",") == 1:
        family, given = [
            part.strip()
            for part in original.split(
                ",",
                1,
            )
        ]

        if family and given:
            return {
                "name":
                    f"{given} {family}",
                "sourceName":
                    original,
            }

    return {
        "name": original,
        "sourceName": original,
    }


def normalize_doi(
    values,
):
    for raw in values or []:
        value = (
            clean_text(raw)
            or ""
        )

        value = re.sub(
            r"^https?://(?:dx\.)?doi\.org/",
            "",
            value,
            flags=re.IGNORECASE,
        )

        match = DOI_RE.search(
            value
        )

        if not match:
            continue

        doi = match.group(1)

        doi = doi.rstrip(
            ".,;:)]}"
        )

        return doi.lower()

    return None


def canonical_article_url(
    values,
):
    urls = []

    for value in values or []:
        clean = (
            clean_text(value)
            or ""
        )

        if re.match(
            r"^https?://",
            clean,
            flags=re.IGNORECASE,
        ):
            urls.append(clean)

    for url in urls:
        if "/article/view/" in url:
            return url

    return (
        urls[0]
        if urls
        else None
    )


def relation_urls(
    values,
):
    output = []

    for value in values or []:
        clean = (
            clean_text(value)
            or ""
        )

        if not re.match(
            r"^https?://",
            clean,
            flags=re.IGNORECASE,
        ):
            continue

        if clean not in output:
            output.append(clean)

    return output


ARTICLE_VIEW_RE = re.compile(
    r"/article/view/(\d+)",
    re.IGNORECASE,
)


ISSUE_VIEW_RE = re.compile(
    r"/issue/view/(\d+)",
    re.IGNORECASE,
)


SINCRONIA_ISSUE_NUMBER_RE = re.compile(
    r"(?:n[uú]m\.?|n[uú]mero)\s*(\d{1,3})",
    re.IGNORECASE,
)


def article_id_from_url(
    value,
):
    clean = (
        clean_text(value)
        or ""
    )

    match = ARTICLE_VIEW_RE.search(
        clean
    )

    return (
        match.group(1)
        if match
        else None
    )


class SincroniaArchiveParser(
    HTMLParser,
):
    def __init__(
        self,
        base_url,
    ):
        super().__init__(
            convert_charrefs=True
        )

        self.base_url = base_url
        self.issue_urls = []
        self._seen = set()

    def handle_starttag(
        self,
        tag,
        attrs,
    ):
        if tag.casefold() != "a":
            return

        href = dict(attrs).get(
            "href"
        )

        if not href:
            return

        url = urllib.parse.urljoin(
            self.base_url,
            href,
        )

        if not ISSUE_VIEW_RE.search(
            url
        ):
            return

        if url in self._seen:
            return

        self._seen.add(url)
        self.issue_urls.append(url)


class SincroniaIssueParser(
    HTMLParser,
):
    def __init__(
        self,
        base_url,
    ):
        super().__init__(
            convert_charrefs=True
        )

        self.base_url = base_url
        self.issue_title = None
        self.issue_year = None
        self.issue_number = None
        self.current_section = None
        self.articles = {}

        self._in_h1 = False
        self._h1_parts = []

        self._in_h2 = False
        self._h2_parts = []

    def handle_starttag(
        self,
        tag,
        attrs,
    ):
        tag = tag.casefold()

        if tag == "h1":
            self._in_h1 = True
            self._h1_parts = []
            return

        if tag == "h2":
            self._in_h2 = True
            self._h2_parts = []
            return

        if tag != "a":
            return

        href = dict(attrs).get(
            "href"
        )

        if not href:
            return

        url = urllib.parse.urljoin(
            self.base_url,
            href,
        )

        article_id = article_id_from_url(
            url
        )

        if not article_id:
            return

        self.articles.setdefault(
            article_id,
            {
                "issueTitle":
                    self.issue_title,

                "year":
                    self.issue_year,

                "issueNumber":
                    self.issue_number,

                "section":
                    self.current_section,
            },
        )

    def handle_data(
        self,
        data,
    ):
        if self._in_h1:
            self._h1_parts.append(
                data
            )

        if self._in_h2:
            self._h2_parts.append(
                data
            )

    def handle_endtag(
        self,
        tag,
    ):
        tag = tag.casefold()

        if (
            tag == "h1"
            and self._in_h1
        ):
            self.issue_title = clean_text(
                " ".join(
                    self._h1_parts
                )
            )

            year_match = re.search(
                r"\b(19|20)\d{2}\b",
                self.issue_title or "",
            )

            self.issue_year = (
                int(year_match.group(0))
                if year_match
                else None
            )

            issue_number_match = (
                SINCRONIA_ISSUE_NUMBER_RE
                .search(
                    self.issue_title
                    or ""
                )
            )

            self.issue_number = (
                int(
                    issue_number_match
                    .group(1)
                )
                if issue_number_match
                else None
            )

            self._in_h1 = False
            self._h1_parts = []
            return

        if (
            tag == "h2"
            and self._in_h2
        ):
            self.current_section = (
                clean_text(
                    " ".join(
                        self._h2_parts
                    )
                )
            )

            self._in_h2 = False
            self._h2_parts = []


def harvest_issue_metadata(
    source,
):
    if not source.get(
        "enrichIssueMetadata"
    ):
        return {}

    archive_url = source.get(
        "issueArchive"
    )

    if not archive_url:
        return {}

    issue_urls = []
    seen = set()

    for page in range(
        1,
        25,
    ):
        page_url = (
            archive_url
            if page == 1
            else (
                archive_url.rstrip("/")
                + f"/{page}"
            )
        )

        data = request_bytes(
            page_url,
            timeout=30,
        )

        parser = SincroniaArchiveParser(
            page_url
        )

        parser.feed(
            data.decode(
                "utf-8",
                errors="replace",
            )
        )

        new_urls = [
            url
            for url in parser.issue_urls
            if url not in seen
        ]

        if not new_urls:
            break

        for url in new_urls:
            seen.add(url)
            issue_urls.append(url)

        time.sleep(
            0.10
        )

    if not issue_urls:
        raise RuntimeError(
            "Sincronía issue archive is empty"
        )

    metadata = {}

    for index, issue_url in enumerate(
        issue_urls,
        start=1,
    ):
        data = request_bytes(
            issue_url,
            timeout=30,
        )

        parser = SincroniaIssueParser(
            issue_url
        )

        parser.feed(
            data.decode(
                "utf-8",
                errors="replace",
            )
        )

        for article_id, values in (
            parser.articles.items()
        ):
            enriched = dict(
                values
            )

            if not enriched.get(
                "issueTitle"
            ):
                enriched[
                    "issueTitle"
                ] = parser.issue_title

            if not enriched.get(
                "year"
            ):
                enriched[
                    "year"
                ] = parser.issue_year

            if not enriched.get(
                "issueNumber"
            ):
                enriched[
                    "issueNumber"
                ] = parser.issue_number

            metadata[
                article_id
            ] = enriched

        print(
            f"issue-scan={index}/"
            f"{len(issue_urls)} "
            f"articles={len(metadata)}"
        )

        time.sleep(
            0.10
        )

    if not metadata:
        raise RuntimeError(
            (
                "Sincronía issue metadata "
                "could not be resolved"
            )
        )

    return metadata


def description_candidates(
    values,
):
    output = []

    for value in values or []:
        clean = clean_text(
            value
        )

        if not clean:
            continue

        # OJS puede colocar dentro del mismo
        # dc:description las fechas de recepción
        # y aceptación antes del abstract.
        # Quitamos sólo esos metadatos y
        # preservamos el contenido académico.
        clean = (
            ADMIN_DESCRIPTION_DATE_RE
            .sub(
                " ",
                clean,
            )
        )

        clean = WHITESPACE_RE.sub(
            " ",
            clean,
        ).strip()

        clean = re.sub(
            r"\\s+([,.;:!?])",
            r"\\1",
            clean,
        )

        # Descarta residuos administrativos
        # demasiado breves para ser un abstract.
        if len(clean) < 80:
            continue

        if clean not in output:
            output.append(clean)

    return output


def extract_year(
    values,
):
    for value in values or []:
        clean = (
            clean_text(value)
            or ""
        )

        match = re.search(
            r"\b(19|20)\d{2}\b",
            clean,
        )

        if match:
            return int(
                match.group(0)
            )

    return None


def normalized_date(
    values,
):
    for value in values or []:
        clean = clean_text(
            value
        )

        if clean:
            return clean

    return None


def choose_record_language(
    languages,
    title,
    abstract,
):
    normalized = [
        normalize_language(value)
        for value in languages or []
    ]

    normalized = [
        value
        for value in normalized
        if value
    ]

    if (
        language_score(
            title,
            "es",
        ) >
        language_score(
            title,
            "en",
        )
    ):
        return "es"

    if (
        abstract
        and
        language_score(
            abstract,
            "es",
        ) >
        language_score(
            abstract,
            "en",
        )
    ):
        return "es"

    if len(normalized) == 1:
        return normalized[0]

    if "es" in normalized:
        return "es"

    return (
        normalized[0]
        if normalized
        else None
    )


def choose_endpoint(
    source,
):
    errors = []

    for endpoint in source[
        "endpoints"
    ]:
        url = (
            endpoint
            + "?"
            + urllib.parse.urlencode({
                "verb": "Identify",
            })
        )

        try:
            data = request_bytes(
                url,
                timeout=12,
            )

            root = ET.fromstring(
                data
            )

            if not root.tag.endswith(
                "OAI-PMH"
            ):
                raise RuntimeError(
                    "response is not OAI-PMH"
                )

            return (
                endpoint,
                errors,
            )

        except Exception as exc:
            errors.append(
                (
                    endpoint,
                    repr(exc),
                )
            )

    raise RuntimeError(
        (
            "No usable OAI endpoint "
            f"for {source['journal']}: "
            f"{errors}"
        )
    )


def parse_oai_record(
    element,
    source,
):
    header = element.find(
        f"{{{OAI}}}header"
    )

    if header is None:
        return None

    if (
        header.get("status")
        == "deleted"
    ):
        return None

    identifier_el = header.find(
        f"{{{OAI}}}identifier"
    )

    datestamp_el = header.find(
        f"{{{OAI}}}datestamp"
    )

    source_id = (
        clean_text(
            identifier_el.text
        )
        if (
            identifier_el is not None
            and identifier_el.text
        )
        else None
    )

    oai_datestamp = (
        clean_text(
            datestamp_el.text
        )
        if (
            datestamp_el is not None
            and datestamp_el.text
        )
        else None
    )

    metadata_el = element.find(
        f"{{{OAI}}}metadata"
    )

    if metadata_el is None:
        return None

    metadata = {}

    for child in metadata_el.iter():
        if not child.tag.startswith(
            "{" + DC + "}"
        ):
            continue

        field = child.tag.split(
            "}",
            1,
        )[1]

        value = (
            child.text
            or ""
        ).strip()

        if not value:
            continue

        metadata.setdefault(
            field,
            [],
        ).append(value)

    titles = unique_strings(
        metadata.get(
            "title",
            [],
        )
    )

    title = choose_variant(
        titles,
        "es",
    )

    if not title:
        return None

    if (
        source.get("id")
        == "sincronia"
        and SINCRONIA_NON_ARTICLE_TITLE_RE
        .fullmatch(
            clean_text(title)
            or ""
        )
    ):
        excluded = (
            "sincronia-non-article-front-matter"
        )
    elif (
        source.get("id")
        == "sincronia"
    ):
        excluded = None
    else:
        excluded = exclusion_reason(
            title,
            metadata.get(
                "description",
                [],
            ),
        )

    if excluded:
        return {
            "_excluded": True,

            "reason":
                excluded,

            "journal":
                source["journal"],

            "title":
                title,

            "sourceId":
                source_id,
        }

    descriptions = (
        description_candidates(
            metadata.get(
                "description",
                [],
            )
        )
    )

    abstract = choose_variant(
        descriptions,
        "es",
    )

    creators = []

    for creator in metadata.get(
        "creator",
        [],
    ):
        normalized = (
            normalize_creator(
                creator
            )
        )

        if normalized:
            creators.append(
                normalized
            )

    doi = normalize_doi(
        metadata.get(
            "identifier",
            [],
        )
    )

    canonical = (
        canonical_article_url(
            metadata.get(
                "identifier",
                [],
            )
        )
    )

    relations = relation_urls(
        metadata.get(
            "relation",
            [],
        )
    )

    languages = []

    for value in metadata.get(
        "language",
        [],
    ):
        language = (
            normalize_language(
                value
            )
        )

        if (
            language
            and language not in languages
        ):
            languages.append(
                language
            )

    language = (
        choose_record_language(
            languages,
            title,
            abstract,
        )
    )

    date = normalized_date(
        metadata.get(
            "date",
            [],
        )
    )

    year = extract_year(
        metadata.get(
            "date",
            [],
        )
    )

    subjects = unique_strings(
        metadata.get(
            "subject",
            [],
        )
    )

    sources = unique_strings(
        metadata.get(
            "source",
            [],
        )
    )

    publishers = unique_strings(
        metadata.get(
            "publisher",
            [],
        )
    )

    rights = unique_strings(
        metadata.get(
            "rights",
            [],
        )
    )

    return {
        "id":
            (
                f"cucsh:{source['id']}:"
                f"{source_id}"
            ),

        "sourceId":
            source_id,

        "oaiDatestamp":
            oai_datestamp,

        "journal":
            source["journal"],

        "title":
            title,

        "titleVariants":
            titles,

        "authors":
            creators,

        "date":
            date,

        "year":
            year,

        "type":
            "journal-article",

        "language":
            language,

        "languages":
            languages,

        "doi":
            doi,

        "publisher":
            (
                publishers[0]
                if publishers
                else None
            ),

        "abstract":
            abstract,

        "abstractVariants":
            descriptions,

        "subjects":
            subjects,

        "bibliographicSources":
            sources,

        "rights":
            rights,

        "urls": {
            "canonical":
                canonical,

            "doi":
                (
                    f"https://doi.org/{doi}"
                    if doi
                    else None
                ),

            "relations":
                relations,
        },
    }


def sincronia_title_key(
    value,
):
    normalized = (
        clean_text(value)
        or ""
    ).casefold()

    normalized = re.sub(
        r"[^a-z0-9áéíóúüñ]+",
        " ",
        normalized,
        flags=re.UNICODE,
    )

    return WHITESPACE_RE.sub(
        " ",
        normalized,
    ).strip()


def sincronia_issue_title_key(
    record,
):
    issue_number = (
        record.get(
            "issueNumber"
        )
    )

    title = sincronia_title_key(
        record.get(
            "title"
        )
    )

    if (
        not isinstance(
            issue_number,
            int,
        )
        or not title
    ):
        return None

    return (
        issue_number,
        title,
    )


def harvest_source(
    source,
):
    endpoint, failures = (
        choose_endpoint(
            source
        )
    )

    print()
    print(
        "=" * 72
    )

    print(
        source["journal"]
    )

    print(
        "=" * 72
    )

    print(
        "endpoint =",
        endpoint,
    )

    for failed_endpoint, error in failures:
        print(
            "fallback:",
            failed_endpoint,
            "->",
            error,
        )

    issue_metadata = (
        harvest_issue_metadata(
            source
        )
    )

    token = None
    page = 0
    active_records = []
    deleted = 0

    excluded_reasons = Counter()

    while True:
        page += 1

        if token:
            params = {
                "verb":
                    "ListRecords",

                "resumptionToken":
                    token,
            }

        else:
            params = {
                "verb":
                    "ListRecords",

                "metadataPrefix":
                    "oai_dc",
            }

        url = (
            endpoint
            + "?"
            + urllib.parse.urlencode(
                params
            )
        )

        data = request_bytes(
            url,
            timeout=35,
        )

        root = ET.fromstring(
            data
        )

        error = root.find(
            f"{{{OAI}}}error"
        )

        if error is not None:
            raise RuntimeError(
                (
                    f"OAI {error.get('code')}: "
                    f"{clean_text(error.text)}"
                )
            )

        elements = root.findall(
            f".//{{{OAI}}}record"
        )

        for element in elements:
            header = element.find(
                f"{{{OAI}}}header"
            )

            if (
                header is not None
                and header.get(
                    "status"
                ) == "deleted"
            ):
                deleted += 1
                continue

            record = parse_oai_record(
                element,
                source,
            )

            if not record:
                continue

            if record.get(
                "_excluded"
            ):
                excluded_reasons[
                    record["reason"]
                ] += 1

                continue

            if issue_metadata:
                article_id = (
                    article_id_from_url(
                        record.get(
                            "urls",
                            {},
                        ).get(
                            "canonical"
                        )
                    )
                )

                values = (
                    issue_metadata.get(
                        article_id
                    )
                    if article_id
                    else None
                )

                if values:
                    issue_year = (
                        values.get(
                            "year"
                        )
                    )

                    if issue_year:
                        record["year"] = (
                            issue_year
                        )

                    record["issueTitle"] = (
                        values.get(
                            "issueTitle"
                        )
                    )

                    record["issueNumber"] = (
                        values.get(
                            "issueNumber"
                        )
                    )

                    record["section"] = (
                        values.get(
                            "section"
                        )
                    )

            active_records.append(
                record
            )

        token_el = root.find(
            (
                f".//{{{OAI}}}"
                "resumptionToken"
            )
        )

        token = (
            (token_el.text or "")
            .strip()
            if token_el is not None
            else ""
        )

        print(
            f"page={page} "
            f"received={len(elements)} "
            f"active={len(active_records)} "
            f"excluded={sum(excluded_reasons.values())} "
            f"deleted={deleted} "
            f"continuation="
            f"{'yes' if token else 'no'}"
        )

        if not token:
            break

        time.sleep(
            0.25
        )

    legacy_archives = (
        source.get(
            "legacyArchives"
        )
        or []
    )

    if legacy_archives:
        legacy_records = (
            harvest_legacy_records(
                legacy_archives,
                max_issue=source.get(
                    "legacyMaxIssue",
                    51,
                ),
            )
        )

        existing_urls = {
            record.get(
                "urls",
                {},
            ).get(
                "canonical"
            )
            for record in active_records
            if record.get(
                "urls",
                {},
            ).get(
                "canonical"
            )
        }

        existing_ids = {
            record.get("id")
            for record in active_records
            if record.get("id")
        }

        existing_issue_titles = {
            key
            for record in active_records
            if (
                key := (
                    sincronia_issue_title_key(
                        record
                    )
                )
            )
        }

        legacy_added = 0

        for record in legacy_records:
            canonical = (
                record.get(
                    "urls",
                    {},
                ).get(
                    "canonical"
                )
            )

            issue_title_key = (
                sincronia_issue_title_key(
                    record
                )
            )

            if (
                record.get("id")
                in existing_ids
                or (
                    canonical
                    and canonical
                    in existing_urls
                )
                or (
                    issue_title_key
                    and issue_title_key
                    in existing_issue_titles
                )
            ):
                continue

            active_records.append(
                record
            )

            existing_ids.add(
                record.get("id")
            )

            if canonical:
                existing_urls.add(
                    canonical
                )

            if issue_title_key:
                existing_issue_titles.add(
                    issue_title_key
                )

            legacy_added += 1

        print(
            (
                "legacy-total="
                f"{len(legacy_records)} "
                "legacy-added="
                f"{legacy_added}"
            )
        )

    return (
        active_records,
        deleted,
        dict(excluded_reasons),
    )


def load_previous(
    output_path,
):
    if not output_path.exists():
        return None

    try:
        return json.loads(
            output_path.read_text(
                encoding="utf-8"
            )
        )

    except Exception:
        return None


def previous_records_for(
    previous,
    journal,
):
    if not previous:
        return []

    return [
        record
        for record in previous.get(
            "records",
            []
        )
        if record.get(
            "journal"
        ) == journal
    ]


def build_dataset(
    output_path,
):
    previous = load_previous(
        output_path
    )

    all_records = []
    source_summaries = []

    for source in SOURCES:
        try:
            (
                records,
                deleted,
                excluded,
            ) = harvest_source(
                source
            )

            status = "harvested"

        except Exception as exc:
            preserved = (
                previous_records_for(
                    previous,
                    source["journal"],
                )
            )

            if not preserved:
                raise

            records = preserved
            deleted = None
            excluded = {}
            status = "preserved"

            print(
                file=sys.stderr
            )

            print(
                (
                    "WARNING: harvest failed "
                    f"for {source['journal']}; "
                    "preserving previous snapshot"
                ),
                file=sys.stderr,
            )

            print(
                repr(exc),
                file=sys.stderr,
            )

        all_records.extend(
            records
        )

        source_summaries.append({
            "id":
                source["id"],

            "journal":
                source["journal"],

            "status":
                status,

            "active":
                len(records),

            "deleted":
                deleted,

            "excluded":
                excluded,

            "excludedTotal":
                sum(
                    excluded.values()
                ),

            "withDoi":
                sum(
                    1
                    for record in records
                    if record.get("doi")
                ),

            "withAbstract":
                sum(
                    1
                    for record in records
                    if record.get(
                        "abstract"
                    )
                ),
        })

    all_records.sort(
        key=lambda record: (
            record.get(
                "journal"
            )
            or "",

            record.get(
                "year"
            )
            or 0,

            record.get(
                "doi"
            )
            or "",

            record.get(
                "sourceId"
            )
            or "",
        )
    )

    dataset = {
        "schemaVersion":
            1,

        "provider":
            PROVIDER,

        "records":
            all_records,
    }

    return (
        dataset,
        source_summaries,
    )


def serialize_dataset(
    dataset,
):
    return (
        json.dumps(
            dataset,
            ensure_ascii=False,
            indent=2,
            sort_keys=False,
        )
        + "\n"
    )


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
    )

    parser.add_argument(
        "--check",
        action="store_true",
        help=(
            "Harvest and report whether "
            "the snapshot would change."
        ),
    )

    args = parser.parse_args()

    output_path = (
        args.output.resolve()
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    previous_text = (
        output_path.read_text(
            encoding="utf-8"
        )
        if output_path.exists()
        else None
    )

    dataset, summaries = (
        build_dataset(
            output_path
        )
    )

    new_text = serialize_dataset(
        dataset
    )

    print()
    print(
        "=" * 72
    )

    print(
        "CUCSH FILOSOFÍA SUMMARY"
    )

    print(
        "=" * 72
    )

    for summary in summaries:
        print(
            f"{summary['journal']}: "
            f"status={summary['status']} "
            f"active={summary['active']} "
            f"doi={summary['withDoi']} "
            f"abstract={summary['withAbstract']} "
            f"excluded={summary['excludedTotal']} "
            f"deleted={summary['deleted']}"
        )

        for reason, count in sorted(
            summary["excluded"].items()
        ):
            print(
                f"  excluded[{reason}]={count}"
            )

    print()
    print(
        "TOTAL =",
        len(
            dataset["records"]
        ),
    )

    changed = (
        previous_text != new_text
    )

    print(
        "SNAPSHOT =",
        (
            "CHANGED"
            if changed
            else "UNCHANGED"
        ),
    )

    if args.check:
        return 1 if changed else 0

    if changed:
        output_path.write_text(
            new_text,
            encoding="utf-8",
        )

        print(
            "WROTE =",
            output_path,
        )

    else:
        print(
            "NO WRITE NEEDED"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(
        main()
    )

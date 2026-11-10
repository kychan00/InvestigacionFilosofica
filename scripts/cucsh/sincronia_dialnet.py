#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import html
import re
import urllib.parse
import urllib.request

from html.parser import HTMLParser


JOURNAL_URL = (
    "https://dialnet.unirioja.es/"
    "servlet/revista?codigo=2487"
)

ISSUE_URL_RE = re.compile(
    r"/ejemplar/(\d+)",
    re.IGNORECASE,
)

ARTICLE_URL_RE = re.compile(
    r"/servlet/articulo\?codigo=(\d+)$",
    re.IGNORECASE,
)

AUTHOR_URL_RE = re.compile(
    r"/servlet/autor\?codigo=(\d+)",
    re.IGNORECASE,
)

ISSUE_HEADER_RE = re.compile(
    r"Año\s+(\d{4})\s*,\s*"
    r"Número\s+(\d+)",
    re.IGNORECASE,
)

WHITESPACE_RE = re.compile(
    r"\s+"
)


def clean_text(
    value,
):
    if value is None:
        return None

    text = html.unescape(
        str(value)
    )

    text = text.replace(
        "\xa0",
        " ",
    )

    text = WHITESPACE_RE.sub(
        " ",
        text,
    ).strip()

    return text or None


def request_bytes(
    url,
    timeout=12,
):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent":
                (
                    "InvestigacionFilosofica/"
                    "SincroniaDialnetHarvester-0.1"
                ),
            "Accept":
                (
                    "text/html,application/xhtml+xml,"
                    "*/*;q=0.5"
                ),
        },
    )

    with urllib.request.urlopen(
        request,
        timeout=timeout,
    ) as response:
        return response.read()


class LinkCollector(
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
        self.links = []

        self._href = None
        self._parts = []

    def handle_starttag(
        self,
        tag,
        attrs,
    ):
        if tag.casefold() != "a":
            return

        self._href = dict(
            attrs
        ).get("href")

        self._parts = []

    def handle_data(
        self,
        data,
    ):
        if self._href is not None:
            self._parts.append(
                data
            )

    def handle_endtag(
        self,
        tag,
    ):
        if (
            tag.casefold() != "a"
            or self._href is None
        ):
            return

        url = urllib.parse.urljoin(
            self.base_url,
            self._href,
        )

        self.links.append({
            "url":
                url,

            "text":
                clean_text(
                    " ".join(
                        self._parts
                    )
                ),
        })

        self._href = None
        self._parts = []


class TextCollector(
    HTMLParser,
):
    def __init__(
        self,
    ):
        super().__init__(
            convert_charrefs=True
        )

        self.parts = []

    def handle_data(
        self,
        data,
    ):
        clean = clean_text(
            data
        )

        if clean:
            self.parts.append(
                clean
            )

    def text(
        self,
    ):
        return clean_text(
            " ".join(
                self.parts
            )
        ) or ""


def parse_links(
    data,
    base_url,
):
    parser = LinkCollector(
        base_url
    )

    parser.feed(
        data.decode(
            "utf-8",
            errors="replace",
        )
    )

    parser.close()

    return parser.links


def parse_text(
    data,
):
    parser = TextCollector()

    parser.feed(
        data.decode(
            "utf-8",
            errors="replace",
        )
    )

    parser.close()

    return parser.text()


def journal_issue_urls(
    data,
):
    output = []
    seen = set()

    for link in parse_links(
        data,
        JOURNAL_URL,
    ):
        path = urllib.parse.urlparse(
            link["url"]
        ).path

        if not ISSUE_URL_RE.search(
            path
        ):
            continue

        url = (
            link["url"]
            .split(
                "#",
                1,
            )[0]
        )

        if url in seen:
            continue

        seen.add(url)
        output.append(url)

    return output


def issue_identity(
    data,
):
    text = parse_text(
        data
    )

    match = ISSUE_HEADER_RE.search(
        text
    )

    if not match:
        return None

    return {
        "year":
            int(
                match.group(1)
            ),

        "number":
            int(
                match.group(2)
            ),
    }


def issue_articles(
    data,
    issue_url,
):
    links = parse_links(
        data,
        issue_url,
    )

    articles = []

    current = None

    for link in links:
        parsed = urllib.parse.urlparse(
            link["url"]
        )

        normalized = urllib.parse.urlunparse(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                "",
                parsed.query,
                "",
            )
        )

        article_match = (
            ARTICLE_URL_RE.search(
                parsed.path
                + (
                    "?"
                    + parsed.query
                    if parsed.query
                    else ""
                )
            )
        )

        if article_match:
            title = clean_text(
                link.get(
                    "text"
                )
            )

            if (
                not title
                or title.casefold()
                in {
                    "resumen",
                    "texto completo",
                }
            ):
                continue

            current = {
                "code":
                    article_match.group(1),

                "url":
                    normalized,

                "title":
                    title,

                "authors":
                    [],
            }

            articles.append(
                current
            )

            continue

        if current is None:
            continue

        if AUTHOR_URL_RE.search(
            parsed.path
            + (
                "?"
                + parsed.query
                if parsed.query
                else ""
            )
        ):
            author = clean_text(
                link.get(
                    "text"
                )
            )

            if (
                author
                and author not in
                current[
                    "authors"
                ]
            ):
                current[
                    "authors"
                ].append(
                    author
                )

    return articles


def stable_id(
    code,
):
    return (
        "cucsh:sincronia-dialnet:"
        + str(code)
    )


def build_record(
    article,
    issue,
):
    authors = [
        {
            "name":
                name,

            "sourceName":
                name,
        }
        for name in (
            article.get(
                "authors"
            )
            or []
        )
        if name
    ]

    year = issue[
        "year"
    ]

    number = issue[
        "number"
    ]

    return {
        "id":
            stable_id(
                article["code"]
            ),

        "sourceId":
            (
                "dialnet:"
                + article["code"]
            ),

        "oaiDatestamp":
            None,

        "journal":
            "Sincronía",

        "title":
            article["title"],

        "titleVariants":
            [
                article["title"]
            ],

        "authors":
            authors,

        "date":
            str(year),

        "year":
            year,

        "type":
            "journal-article",

        "language":
            None,

        "languages":
            [],

        "doi":
            None,

        "publisher":
            (
                "Universidad de Guadalajara"
            ),

        "abstract":
            None,

        "abstractVariants":
            [],

        "subjects":
            [],

        "bibliographicSources":
            [
                "Sincronía",
                "Dialnet",
            ],

        "rights":
            [],

        "issueNumber":
            number,

        "issueTitle":
            (
                f"Sincronía Núm. "
                f"{number}"
            ),

        "legacyOriginal":
            True,

        "legacyMetadataSource":
            "Dialnet",

        "urls": {
            "canonical":
                article["url"],

            "doi":
                None,

            "relations":
                [],
        },
    }


def harvest_dialnet_records(
    max_issue=51,
):
    data = request_bytes(
        JOURNAL_URL,
        timeout=12,
    )

    issue_urls = (
        journal_issue_urls(
            data
        )
    )

    if not issue_urls:
        raise RuntimeError(
            (
                "Dialnet did not expose "
                "Sincronía issue URLs"
            )
        )

    records = []
    seen_codes = set()
    covered_issues = set()

    for issue_url in issue_urls:
        try:
            issue_data = (
                request_bytes(
                    issue_url,
                    timeout=12,
                )
            )

        except Exception:
            continue

        issue = issue_identity(
            issue_data
        )

        if not issue:
            continue

        number = issue[
            "number"
        ]

        if (
            number < 1
            or number > max_issue
        ):
            continue

        articles = issue_articles(
            issue_data,
            issue_url,
        )

        if not articles:
            continue

        covered_issues.add(
            number
        )

        for article in articles:
            code = article[
                "code"
            ]

            if code in seen_codes:
                continue

            seen_codes.add(
                code
            )

            records.append(
                build_record(
                    article,
                    issue,
                )
            )

        print(
            (
                "dialnet-issue="
                f"{number} "
                f"year={issue['year']} "
                f"articles={len(articles)} "
                f"records={len(records)}"
            )
        )

    if not records:
        raise RuntimeError(
            (
                "Dialnet did not yield "
                "historical Sincronía records"
            )
        )

    return (
        records,
        sorted(
            covered_issues
        ),
    )

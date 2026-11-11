#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import html
import http.cookiejar
import re
import time
import urllib.parse
import urllib.request

from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser


JOURNAL_URL = (
    "https://dialnet.unirioja.es/"
    "servlet/revista?codigo=2487"
)


# Stable Dialnet exemplar identifiers exposed by the journal index.
# Sincronía's issues 1-16 and 18 are not catalogued there; the
# original journal archive remains authoritative for those numbers.
KNOWN_ISSUE_URLS = {
    17: "https://dialnet.unirioja.es/ejemplar/547854",
    19: "https://dialnet.unirioja.es/ejemplar/547094",
    20: "https://dialnet.unirioja.es/ejemplar/546892",
    21: "https://dialnet.unirioja.es/ejemplar/294174",
    22: "https://dialnet.unirioja.es/ejemplar/253504",
    23: "https://dialnet.unirioja.es/ejemplar/253500",
    24: "https://dialnet.unirioja.es/ejemplar/253439",
    25: "https://dialnet.unirioja.es/ejemplar/60678",
    26: "https://dialnet.unirioja.es/ejemplar/70493",
    27: "https://dialnet.unirioja.es/ejemplar/78940",
    28: "https://dialnet.unirioja.es/ejemplar/85672",
    29: "https://dialnet.unirioja.es/ejemplar/94035",
    30: "https://dialnet.unirioja.es/ejemplar/98510",
    31: "https://dialnet.unirioja.es/ejemplar/98515",
    32: "https://dialnet.unirioja.es/ejemplar/119795",
    33: "https://dialnet.unirioja.es/ejemplar/119796",
    34: "https://dialnet.unirioja.es/ejemplar/119797",
    35: "https://dialnet.unirioja.es/ejemplar/137355",
    36: "https://dialnet.unirioja.es/ejemplar/178749",
    37: "https://dialnet.unirioja.es/ejemplar/178782",
    38: "https://dialnet.unirioja.es/ejemplar/144465",
    39: "https://dialnet.unirioja.es/ejemplar/157682",
    40: "https://dialnet.unirioja.es/ejemplar/157683",
    41: "https://dialnet.unirioja.es/ejemplar/157686",
    42: "https://dialnet.unirioja.es/ejemplar/178736",
    43: "https://dialnet.unirioja.es/ejemplar/178733",
    44: "https://dialnet.unirioja.es/ejemplar/547426",
    45: "https://dialnet.unirioja.es/ejemplar/547233",
    46: "https://dialnet.unirioja.es/ejemplar/187570",
    47: "https://dialnet.unirioja.es/ejemplar/251022",
    48: "https://dialnet.unirioja.es/ejemplar/251053",
    49: "https://dialnet.unirioja.es/ejemplar/251060",
    50: "https://dialnet.unirioja.es/ejemplar/251077",
    51: "https://dialnet.unirioja.es/ejemplar/251120",
}


DIALNET_COOKIE_JAR = (
    http.cookiejar.CookieJar()
)

DIALNET_OPENER = (
    urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(
            DIALNET_COOKIE_JAR
        )
    )
)

ISSUE_URL_RE = re.compile(
    r"/ejemplar/(\d+)",
    re.IGNORECASE,
)

ARTICLE_URL_RE = re.compile(
    r"/servlet/articulo\?[^#]*?"
    r"codigo=(\d+)",
    re.IGNORECASE,
)

AUTHOR_URL_RE = re.compile(
    r"/servlet/autor\?[^#]*?"
    r"codigo=(\d+)",
    re.IGNORECASE,
)

ISSUE_HEADER_RE = re.compile(
    r"Año\s+(\d{4})\s*,\s*"
    r"(?:Número|N[º°o]\.?)\s*(\d+)",
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
    attempts=4,
):
    last_error = None

    for attempt in range(
        1,
        attempts + 1,
    ):
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent":
                    (
                        "Mozilla/5.0 "
                        "(X11; Linux x86_64) "
                        "AppleWebKit/537.36 "
                        "(KHTML, like Gecko) "
                        "Chrome/154.0 Safari/537.36 "
                        "InvestigacionFilosofica/"
                        "SincroniaDialnetHarvester-0.2"
                    ),
                "Accept":
                    (
                        "text/html,application/xhtml+xml,"
                        "application/xml;q=0.9,*/*;q=0.8"
                    ),
                "Accept-Language":
                    "es-MX,es;q=0.9,en;q=0.7",

                "Referer":
                    JOURNAL_URL,

                "Cache-Control":
                    "no-cache",
            },
        )

        try:
            with DIALNET_OPENER.open(
                request,
                timeout=timeout,
            ) as response:
                return response.read()

        except Exception as exc:
            last_error = exc

            if attempt >= attempts:
                break

            time.sleep(
                1.25 * attempt
            )

    raise last_error


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
    max_issue=None,
    target_issues=None,
):
    target_issues = (
        set(target_issues)
        if target_issues is not None
        else None
    )
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

        number_hint = None

        text = (
            clean_text(
                link.get("text")
            )
            or ""
        )

        number_match = re.fullmatch(
            r"\D*(\d{1,3})\D*",
            text,
        )

        if number_match:
            number_hint = int(
                number_match.group(1)
            )

        if (
            max_issue is not None
            and number_hint is not None
            and number_hint > max_issue
        ):
            continue

        if (
            target_issues is not None
            and number_hint is not None
            and number_hint not in target_issues
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


def fetch_issue_payload(
    issue_url,
    max_issue,
):
    # Dialnet responde 503 cuando se le abren
    # muchos ejemplares históricos de golpe.
    # Un ritmo corto y secuencial mantiene la
    # sesión viva sin martillar el servicio.
    time.sleep(
        0.35
    )

    try:
        issue_data = request_bytes(
            issue_url,
            timeout=12,
        )

    except Exception as exc:
        return {
            "error":
                (
                    "fetch:"
                    + repr(exc)
                ),

            "url":
                issue_url,
        }

    issue = issue_identity(
        issue_data
    )

    if not issue:
        return {
            "error":
                "identity",

            "url":
                issue_url,

            "bytes":
                len(issue_data),
        }

    number = issue[
        "number"
    ]

    if (
        number < 1
        or number > max_issue
    ):
        return None

    articles = issue_articles(
        issue_data,
        issue_url,
    )

    if not articles:
        return {
            "error":
                "articles",

            "url":
                issue_url,

            "issue":
                issue,

            "bytes":
                len(issue_data),
        }

    return (
        issue,
        articles,
    )


def harvest_dialnet_records(
    max_issue=84,
    target_issues=None,
):
    targets = (
        {
            int(issue_number)
            for issue_number in target_issues
            if (
                isinstance(
                    issue_number,
                    int,
                )
                and 1 <= issue_number <= max_issue
            )
        }
        if target_issues is not None
        else None
    )

    if targets is not None:
        issue_urls = [
            KNOWN_ISSUE_URLS[
                issue_number
            ]
            for issue_number in sorted(
                targets
            )
            if issue_number in (
                KNOWN_ISSUE_URLS
            )
        ]

        print(
            (
                "dialnet-targeted "
                f"requested={sorted(targets)} "
                f"known={len(issue_urls)}"
            )
        )

    else:
        data = request_bytes(
            JOURNAL_URL,
            timeout=12,
        )

        issue_urls = (
            journal_issue_urls(
                data,
                max_issue=max_issue,
            )
        )

        print(
            (
                "dialnet-journal "
                f"bytes={len(data)} "
                f"issues={len(issue_urls)}"
            )
        )

    if not issue_urls:
        return (
            [],
            [],
        )

    payloads = []
    failures = []

    with ThreadPoolExecutor(
        max_workers=1,
    ) as executor:
        futures = {
            executor.submit(
                fetch_issue_payload,
                issue_url,
                max_issue,
            ):
                issue_url
            for issue_url in issue_urls
        }

        for future in as_completed(
            futures
        ):
            try:
                payload = future.result()

            except Exception:
                payload = None

            if isinstance(
                payload,
                dict,
            ) and payload.get(
                "error"
            ):
                failures.append(
                    payload
                )

            elif payload:
                payloads.append(
                    payload
                )

    if failures:
        # A 503 from Dialnet is often transient. The first pass already
        # uses bounded retries; after the rest of the batch has
        # finished, give only failed exemplars one cool-down retry.
        retry_failures = list(
            failures
        )
        failures = []

        time.sleep(5.0)

        for failure in retry_failures:
            issue_url = failure.get(
                "url"
            )

            if not issue_url:
                failures.append(
                    failure
                )
                continue

            payload = fetch_issue_payload(
                issue_url,
                max_issue,
            )

            if isinstance(
                payload,
                dict,
            ) and payload.get(
                "error"
            ):
                failures.append(
                    payload
                )
            elif payload:
                payloads.append(
                    payload
                )

    payloads.sort(
        key=lambda item: (
            item[0][
                "number"
            ],
            item[0][
                "year"
            ],
        )
    )

    if failures:
        print(
            (
                "dialnet-failures="
                f"{len(failures)}"
            )
        )

        for failure in failures[:8]:
            print(
                (
                    "  dialnet-failure "
                    f"url={failure.get('url')} "
                    f"error={failure.get('error')} "
                    f"bytes={failure.get('bytes')} "
                    f"issue={failure.get('issue')}"
                )
            )

    records = []
    seen_codes = set()
    covered_issues = set()

    for issue, articles in payloads:
        number = issue[
            "number"
        ]

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

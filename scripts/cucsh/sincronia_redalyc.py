#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import html
import re
import time
import urllib.parse
import urllib.request

from html.parser import HTMLParser


JOURNAL_ID = "5138"
JOURNAL_URL = (
    "https://www.redalyc.org/"
    "revista.oa?id=5138"
)

# Redalyc's preserved Sincronía collections are contiguous for the
# historical block visible in its archive:
# 2005: 34-37, 2006: 38-41, 2007: 42-45.
# Toc_77270 = issue 37 and Toc_77274 = issue 41, therefore the
# collection id is issue + 77233 throughout this preserved block.
COLLECTION_OFFSET = 77233
SUPPORTED_ISSUES = set(
    range(
        34,
        46,
    )
)

ARTICLE_RE = re.compile(
    r"(?:articulo\.oa\?id=|/journal/5138/)"
    r"(5138\d{8})",
    re.IGNORECASE,
)

YEAR_RE = re.compile(
    r"\b(2005|2006|2007)\b"
)

ISSUE_RE = re.compile(
    r"(?:n[uú]m(?:ero)?\.?|no\.?)\s*"
    r"(3[4-9]|4[0-5])",
    re.IGNORECASE,
)

WHITESPACE_RE = re.compile(
    r"\s+"
)


def clean_text(value):
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
    timeout=15,
    attempts=3,
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
                        "SincroniaRedalycHarvester-0.1"
                    ),
                "Accept":
                    (
                        "text/html,application/xhtml+xml,"
                        "application/xml;q=0.9,*/*;q=0.7"
                    ),
                "Accept-Language":
                    "es-MX,es;q=0.9,en;q=0.7",
            },
        )

        try:
            with urllib.request.urlopen(
                request,
                timeout=timeout,
            ) as response:
                return response.read()

        except Exception as exc:
            last_error = exc

            if attempt >= attempts:
                break

            time.sleep(
                0.8 * attempt
            )

    raise last_error


class PageParser(HTMLParser):
    def __init__(self, base_url):
        super().__init__(
            convert_charrefs=True
        )

        self.base_url = base_url
        self.links = []
        self.meta = {}
        self.text_parts = []

    def handle_starttag(
        self,
        tag,
        attrs,
    ):
        tag = tag.casefold()

        values = {
            str(key).casefold():
                value
            for key, value in attrs
        }

        if tag == "a":
            href = values.get(
                "href"
            )

            if href:
                self.links.append(
                    urllib.parse.urljoin(
                        self.base_url,
                        href,
                    )
                )

        if tag == "meta":
            key = (
                values.get("name")
                or values.get("property")
            )

            content = values.get(
                "content"
            )

            if key and content:
                normalized_key = (
                    str(key).casefold()
                )

                self.meta.setdefault(
                    normalized_key,
                    [],
                ).append(
                    clean_text(
                        content
                    )
                )

    def handle_data(
        self,
        data,
    ):
        clean = clean_text(
            data
        )

        if clean:
            self.text_parts.append(
                clean
            )

    def text(self):
        return clean_text(
            " ".join(
                self.text_parts
            )
        ) or ""


def parse_page(
    data,
    base_url,
):
    parser = PageParser(
        base_url
    )

    parser.feed(
        data.decode(
            "utf-8",
            errors="replace",
        )
    )

    parser.close()

    return parser


def collection_id(
    issue_number,
):
    if issue_number not in (
        SUPPORTED_ISSUES
    ):
        raise ValueError(
            (
                "unsupported Redalyc "
                f"Sincronía issue: "
                f"{issue_number}"
            )
        )

    return (
        COLLECTION_OFFSET
        + issue_number
    )


def issue_url(
    issue_number,
):
    return (
        "https://www.redalyc.org/"
        "revista.oa?"
        + urllib.parse.urlencode({
            "id":
                JOURNAL_ID,
            "numero":
                collection_id(
                    issue_number
                ),
        })
    )


def canonical_article_url(
    article_id,
):
    return (
        "https://www.redalyc.org/"
        "articulo.oa?id="
        + str(article_id)
    )


def article_ids_from_issue_page(
    data,
    base_url,
    issue_number,
):
    parser = parse_page(
        data,
        base_url,
    )

    prefix = (
        JOURNAL_ID
        + str(
            collection_id(
                issue_number
            )
        )
    )

    output = []
    seen = set()

    for url in parser.links:
        match = ARTICLE_RE.search(
            url
        )

        if not match:
            continue

        article_id = match.group(1)

        if not article_id.startswith(
            prefix
        ):
            continue

        if article_id in seen:
            continue

        seen.add(
            article_id
        )

        output.append(
            article_id
        )

    return output


def first_meta(
    parser,
    *keys,
):
    for key in keys:
        values = parser.meta.get(
            key.casefold(),
            [],
        )

        for value in values:
            clean = clean_text(
                value
            )

            if clean:
                return clean

    return None


def meta_values(
    parser,
    *keys,
):
    output = []

    for key in keys:
        for value in parser.meta.get(
            key.casefold(),
            [],
        ):
            clean = clean_text(
                value
            )

            if (
                clean
                and clean not in output
            ):
                output.append(
                    clean
                )

    return output


def issue_year(
    issue_number,
):
    if 34 <= issue_number <= 37:
        return 2005

    if 38 <= issue_number <= 41:
        return 2006

    if 42 <= issue_number <= 45:
        return 2007

    return None


def parse_article_record(
    article_id,
    data,
    issue_number,
):
    url = canonical_article_url(
        article_id
    )

    parser = parse_page(
        data,
        url,
    )

    title = first_meta(
        parser,
        "citation_title",
        "dc.title",
        "og:title",
        "title",
    )

    if (
        not title
        or title.casefold()
        in {
            "redalyc",
            "sincronía",
            "sincronia",
        }
    ):
        return None

    visible = parser.text()

    page_issue = first_meta(
        parser,
        "citation_issue",
        "prism.number",
    )

    if page_issue:
        match = re.search(
            r"\d{1,3}",
            page_issue,
        )

        if (
            match
            and int(
                match.group(0)
            ) != issue_number
        ):
            return None

    else:
        visible_issue = (
            ISSUE_RE.search(
                visible
            )
        )

        if (
            visible_issue
            and int(
                visible_issue.group(1)
            ) != issue_number
        ):
            return None

    authors = meta_values(
        parser,
        "citation_author",
        "dc.creator",
        "author",
    )

    normalized_authors = []

    for author in authors:
        for value in re.split(
            r"\s*[;|]\s*",
            author,
        ):
            clean = clean_text(
                value
            )

            if (
                clean
                and clean not in
                normalized_authors
            ):
                normalized_authors.append(
                    clean
                )

    year = issue_year(
        issue_number
    )

    date_text = first_meta(
        parser,
        "citation_publication_date",
        "dc.date",
        "prism.publicationdate",
    )

    if date_text:
        match = YEAR_RE.search(
            date_text
        )

        if match:
            year = int(
                match.group(1)
            )

    abstract = first_meta(
        parser,
        "description",
        "dc.description",
        "og:description",
    )

    if (
        abstract
        and len(abstract) < 80
    ):
        abstract = None

    record_id = (
        "cucsh:sincronia-redalyc:"
        + str(article_id)
    )

    return {
        "id":
            record_id,
        "sourceId":
            (
                "redalyc:"
                + str(article_id)
            ),
        "oaiDatestamp":
            None,
        "journal":
            "Sincronía",
        "title":
            title,
        "titleVariants": [
            title,
        ],
        "authors": [
            {
                "name":
                    author,
                "sourceName":
                    author,
            }
            for author in
            normalized_authors
        ],
        "date":
            (
                str(year)
                if year
                else None
            ),
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
            "Universidad de Guadalajara",
        "abstract":
            abstract,
        "abstractVariants":
            (
                [abstract]
                if abstract
                else []
            ),
        "subjects":
            [],
        "bibliographicSources": [
            "Sincronía",
            "Redalyc",
        ],
        "rights":
            [],
        "issueNumber":
            issue_number,
        "issueTitle":
            (
                f"Sincronía Núm. "
                f"{issue_number}"
            ),
        "legacyOriginal":
            True,
        "legacyMetadataSource":
            "Redalyc",
        "urls": {
            "canonical":
                url,
            "doi":
                None,
            "relations":
                [],
        },
    }


def probe_article_ids(
    issue_number,
    max_sequence=30,
):
    prefix = (
        JOURNAL_ID
        + str(
            collection_id(
                issue_number
            )
        )
    )

    output = []
    misses = 0
    found_any = False

    for sequence in range(
        1,
        max_sequence + 1,
    ):
        article_id = (
            prefix
            + f"{sequence:03d}"
        )

        url = canonical_article_url(
            article_id
        )

        try:
            data = request_bytes(
                url,
                timeout=10,
                attempts=2,
            )

        except Exception:
            misses += 1

            if (
                found_any
                and misses >= 3
            ):
                break

            continue

        record = parse_article_record(
            article_id,
            data,
            issue_number,
        )

        if not record:
            misses += 1

            if (
                found_any
                and misses >= 3
            ):
                break

            continue

        found_any = True
        misses = 0
        output.append(
            (
                article_id,
                data,
            )
        )

        time.sleep(
            0.08
        )

    return output


def harvest_redalyc_issue(
    issue_number,
):
    url = issue_url(
        issue_number
    )

    article_ids = []

    try:
        issue_data = request_bytes(
            url,
            timeout=15,
            attempts=2,
        )

        article_ids = (
            article_ids_from_issue_page(
                issue_data,
                url,
                issue_number,
            )
        )

    except Exception:
        article_ids = []

    payloads = []

    if article_ids:
        for article_id in article_ids:
            article_url = (
                canonical_article_url(
                    article_id
                )
            )

            try:
                data = request_bytes(
                    article_url,
                    timeout=10,
                    attempts=2,
                )

            except Exception:
                continue

            payloads.append(
                (
                    article_id,
                    data,
                )
            )

            time.sleep(
                0.08
            )

    else:
        payloads = probe_article_ids(
            issue_number
        )

    records = []

    for article_id, data in payloads:
        record = parse_article_record(
            article_id,
            data,
            issue_number,
        )

        if record:
            records.append(
                record
            )

    return records


def harvest_redalyc_records(
    target_issues,
):
    targets = sorted(
        set(target_issues)
        & SUPPORTED_ISSUES
    )

    records = []
    covered = []

    for issue_number in targets:
        try:
            issue_records = (
                harvest_redalyc_issue(
                    issue_number
                )
            )

        except Exception as exc:
            print(
                (
                    "redalyc-failure "
                    f"issue={issue_number} "
                    f"error={exc!r}"
                )
            )
            continue

        if not issue_records:
            print(
                (
                    "redalyc-empty "
                    f"issue={issue_number}"
                )
            )
            continue

        records.extend(
            issue_records
        )

        covered.append(
            issue_number
        )

        print(
            (
                "redalyc-issue="
                f"{issue_number} "
                f"year={issue_year(issue_number)} "
                f"articles={len(issue_records)} "
                f"records={len(records)}"
            )
        )

    return (
        records,
        covered,
    )

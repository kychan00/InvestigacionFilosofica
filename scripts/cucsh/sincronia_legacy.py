#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.parse
import urllib.request

from html.parser import HTMLParser

try:
    from scripts.cucsh.sincronia_dialnet import (
        harvest_dialnet_records,
    )
except ModuleNotFoundError:
    from sincronia_dialnet import (
        harvest_dialnet_records,
    )



LEGACY_HOSTS = {
    "sincronia.cucsh.udg.mx",
    "fuentes.csh.udg.mx",
    "www.cucsh.udg.mx",
    "cucsh.udg.mx",
}

WHITESPACE_RE = re.compile(
    r"\s+"
)

TAG_RE = re.compile(
    r"<[^>]*>"
)

YEAR_RE = re.compile(
    r"\b(199[6-9]|200\d|201[0-2])\b"
)

ISSUE_RE = re.compile(
    r"(?:n[uú]m(?:ero)?\.?|no\.?)\s*"
    r"(\d{1,2})",
    re.IGNORECASE,
)

GENERIC_LINK_TEXT = {
    "artículo",
    "articulo",
    "texto",
    "ver",
    "html",
    "pdf",
    "leer",
    "continuar",
}

EARLY_ISSUE_FILENAMES = {
    1: ("winter97.htm", 1996),
    2: ("spring97.htm", 1997),
    3: ("summer97.htm", 1997),
    4: ("fall97.htm", 1997),
    5: ("winter98.htm", 1998),
    6: ("spring98.htm", 1998),
    7: ("summer98.htm", 1998),
    8: ("fall98.htm", 1998),
    9: ("winter99.htm", 1999),
    10: ("spring99.htm", 1999),
    11: ("summer99.htm", 1999),
    12: ("fall99.htm", 1999),
    13: ("winter00.htm", 2000),
    14: ("spring00.htm", 2000),
    15: ("summer00.htm", 2000),
    16: ("fall00.htm", 2000),
    17: ("winter01.htm", 2000),
    18: ("spring01.htm", 2001),
    19: ("summer01.htm", 2001),
    20: ("fall01.htm", 2001),
    21: ("winter02.htm", 2001),
}


EARLY_ISSUE_STEMS = {
    filename.rsplit(
        ".",
        1,
    )[0].casefold()
    for filename, _year
    in EARLY_ISSUE_FILENAMES.values()
}


EARLY_ISSUE_BASES = [
    (
        "http://fuentes.csh.udg.mx/"
        "CUCSH/Sincronia/"
    ),
    (
        "http://www.cucsh.udg.mx/"
        "CUCSH/Sincronia/"
    ),
]


NAVIGATION_NAMES = {
    "index",
    "indice",
    "inicio",
    "home",
    "principal",
    "menu",
    "menú",
    "directorio",
    "contacto",
    "normas",
    "links",
    "enlaces",
    "num_anteriores",
    "anteriores",
}


def clean_text(
    value,
):
    if value is None:
        return None

    text = str(value)

    for _ in range(3):
        decoded = html.unescape(
            text
        )

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

    return text or None


def request_bytes(
    url,
    timeout=35,
):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent":
                (
                    "InvestigacionFilosofica/"
                    "SincroniaLegacyHarvester-0.1"
                ),
            "Accept":
                (
                    "text/html,application/xhtml+xml,"
                    "application/pdf;q=0.8,*/*;q=0.5"
                ),
        },
    )

    with urllib.request.urlopen(
        request,
        timeout=timeout,
    ) as response:
        return response.read()


def normalize_url(
    base_url,
    href,
):
    if not href:
        return None

    url = urllib.parse.urljoin(
        base_url,
        href,
    )

    parsed = urllib.parse.urlparse(
        url
    )

    if (
        parsed.scheme not in {
            "http",
            "https",
        }
        or parsed.netloc.casefold()
        not in LEGACY_HOSTS
    ):
        return None

    path = re.sub(
        r"/+",
        "/",
        parsed.path,
    )

    return urllib.parse.urlunparse(
        (
            parsed.scheme,
            parsed.netloc.casefold(),
            path,
            "",
            parsed.query,
            "",
        )
    )


def file_stem(
    url,
):
    path = urllib.parse.urlparse(
        url
    ).path

    name = path.rsplit(
        "/",
        1,
    )[-1]

    return name.rsplit(
        ".",
        1,
    )[0].casefold()


def is_html_url(
    url,
):
    path = urllib.parse.urlparse(
        url
    ).path.casefold()

    return path.endswith(
        (
            ".htm",
            ".html",
        )
    )


def is_pdf_url(
    url,
):
    return (
        urllib.parse.urlparse(
            url
        ).path.casefold()
        .endswith(".pdf")
    )


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

        url = normalize_url(
            self.base_url,
            self._href,
        )

        if url:
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


class DocumentParser(
    HTMLParser,
):
    BLOCK_TAGS = {
        "article",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "li",
        "p",
        "section",
        "td",
        "th",
        "title",
    }

    def __init__(
        self,
    ):
        super().__init__(
            convert_charrefs=True
        )

        self.meta = {}
        self.lines = []
        self.headings = []
        self.title = None

        self._tag_stack = []
        self._buffer = []
        self._skip_depth = 0

    def handle_starttag(
        self,
        tag,
        attrs,
    ):
        tag = tag.casefold()

        if tag in {
            "script",
            "style",
        }:
            self._skip_depth += 1
            return

        if tag == "meta":
            values = {
                str(key).casefold():
                    value
                for key, value in attrs
            }

            key = (
                values.get("name")
                or values.get("property")
            )

            content = values.get(
                "content"
            )

            if key and content:
                self.meta[
                    key.casefold()
                ] = clean_text(
                    content
                )

            return

        if tag in self.BLOCK_TAGS:
            self._flush()
            self._tag_stack.append(
                tag
            )

    def handle_endtag(
        self,
        tag,
    ):
        tag = tag.casefold()

        if tag in {
            "script",
            "style",
        }:
            self._skip_depth = max(
                0,
                self._skip_depth - 1,
            )
            return

        if tag in self.BLOCK_TAGS:
            text = self._flush()

            if (
                text
                and tag == "title"
                and not self.title
            ):
                self.title = text

            if (
                text
                and tag in {
                    "h1",
                    "h2",
                    "h3",
                    "h4",
                }
            ):
                self.headings.append(
                    text
                )

            if self._tag_stack:
                self._tag_stack.pop()

    def handle_data(
        self,
        data,
    ):
        if self._skip_depth:
            return

        clean = clean_text(
            data
        )

        if clean:
            self._buffer.append(
                clean
            )

    def close(
        self,
    ):
        super().close()
        self._flush()

    def _flush(
        self,
    ):
        text = clean_text(
            " ".join(
                self._buffer
            )
        )

        self._buffer = []

        if text:
            self.lines.append(
                text
            )

        return text


def parse_html(
    data,
):
    parser = DocumentParser()

    parser.feed(
        data.decode(
            "utf-8",
            errors="replace",
        )
    )

    parser.close()

    return parser


def collect_links(
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

    output = []
    seen = set()

    for link in parser.links:
        url = link["url"]

        if url in seen:
            continue

        seen.add(url)
        output.append(link)

    return output


def infer_issue_number(
    text,
    url,
):
    clean = clean_text(
        text
    ) or ""

    match = ISSUE_RE.search(
        clean
    )

    if match:
        return int(
            match.group(1)
        )

    if clean.isdigit():
        number = int(clean)

        if 1 <= number <= 99:
            return number

    stem = file_stem(
        url
    )

    match = re.search(
        r"(?:num|no|n)[_-]?(\d{1,2})",
        stem,
        re.IGNORECASE,
    )

    if match:
        return int(
            match.group(1)
        )

    return None


def infer_year(
    parser,
    url,
):
    candidates = [
        parser.title,
        *parser.headings[:8],
        *parser.lines[:30],
        file_stem(url),
    ]

    for value in candidates:
        clean = clean_text(
            value
        ) or ""

        match = YEAR_RE.search(
            clean
        )

        if match:
            return int(
                match.group(1)
            )

    stem = file_stem(
        url
    )

    match = re.search(
        r"(\d{2})$",
        stem,
    )

    if match:
        short = int(
            match.group(1)
        )

        if 96 <= short <= 99:
            return 1900 + short

        if 0 <= short <= 12:
            return 2000 + short

    return None


def infer_issue_number_from_page(
    parser,
    fallback,
):
    for value in [
        parser.title,
        *parser.headings[:8],
        *parser.lines[:35],
    ]:
        match = ISSUE_RE.search(
            clean_text(value)
            or ""
        )

        if match:
            return int(
                match.group(1)
            )

    return fallback


def plausible_article_link(
    link,
    issue_urls,
):
    url = link["url"]

    if url in issue_urls:
        return False

    stem = file_stem(
        url
    )

    if stem in NAVIGATION_NAMES:
        return False

    if (
        stem.startswith(
            "num_anteriores"
        )
        or stem.startswith(
            "index"
        )
        or stem in EARLY_ISSUE_STEMS
    ):
        return False

    return (
        is_html_url(url)
        or is_pdf_url(url)
    )


def choose_title(
    link_text,
    parser,
):
    clean_link = clean_text(
        link_text
    )

    if (
        clean_link
        and len(clean_link) >= 12
        and clean_link.casefold()
        not in GENERIC_LINK_TEXT
    ):
        return clean_link

    for candidate in [
        *parser.headings,
        parser.meta.get(
            "citation_title"
        ),
        parser.meta.get(
            "dc.title"
        ),
        parser.title,
    ]:
        clean = clean_text(
            candidate
        )

        if (
            clean
            and len(clean) >= 12
            and clean.casefold()
            not in {
                "sincronía",
                "sincronia",
            }
            and not clean.isdigit()
        ):
            return clean

    return clean_link


def plausible_author_line(
    value,
):
    clean = clean_text(
        value
    )

    if not clean:
        return False

    lowered = clean.casefold()

    forbidden = (
        "abstract",
        "departamento",
        "facultad",
        "instituto",
        "issn",
        "palabras clave",
        "revista",
        "resumen",
        "sincronía",
        "sincronia",
        "universidad",
        "http",
        "www.",
        "@",
    )

    if any(
        token in lowered
        for token in forbidden
    ):
        return False

    words = clean.split()

    if not (
        2 <= len(words) <= 8
    ):
        return False

    if len(clean) > 100:
        return False

    return not clean.endswith(
        (
            ".",
            ":",
            ";",
        )
    )


def extract_authors(
    parser,
    title,
):
    meta_author = (
        parser.meta.get(
            "citation_author"
        )
        or parser.meta.get(
            "author"
        )
        or parser.meta.get(
            "dc.creator"
        )
    )

    if meta_author:
        return [
            {
                "name":
                    clean_text(
                        meta_author
                    ),

                "sourceName":
                    clean_text(
                        meta_author
                    ),
            }
        ]

    title_key = (
        clean_text(title)
        or ""
    ).casefold()

    for index, line in enumerate(
        parser.lines
    ):
        if (
            title_key
            and title_key
            not in line.casefold()
        ):
            continue

        candidates = []

        for candidate in (
            parser.lines[
                index + 1:
                index + 6
            ]
        ):
            if candidate.casefold() in {
                "resumen",
                "abstract",
            }:
                break

            if plausible_author_line(
                candidate
            ):
                candidates.append(
                    candidate
                )

            if len(candidates) >= 2:
                break

        if candidates:
            return [
                {
                    "name":
                        candidate,

                    "sourceName":
                        candidate,
                }
                for candidate in candidates
            ]

    return []


def extract_abstract(
    parser,
):
    lines = parser.lines

    for index, line in enumerate(
        lines
    ):
        lowered = (
            clean_text(line)
            or ""
        ).casefold()

        if not (
            lowered == "resumen"
            or lowered.startswith(
                "resumen:"
            )
        ):
            continue

        fragments = []

        inline = re.sub(
            r"^resumen\s*:\s*",
            "",
            line,
            flags=re.IGNORECASE,
        ).strip()

        if inline:
            fragments.append(
                inline
            )

        for candidate in (
            lines[
                index + 1:
                index + 12
            ]
        ):
            candidate_lower = (
                candidate.casefold()
            )

            if (
                candidate_lower
                .startswith(
                    "palabras clave"
                )
                or candidate_lower
                == "abstract"
                or candidate_lower
                .startswith(
                    "abstract:"
                )
            ):
                break

            fragments.append(
                candidate
            )

        abstract = clean_text(
            " ".join(
                fragments
            )
        )

        if (
            abstract
            and len(abstract) >= 80
        ):
            return abstract[:6000]

    return None


def extract_subjects(
    parser,
):
    for index, line in enumerate(
        parser.lines
    ):
        lowered = line.casefold()

        if not lowered.startswith(
            "palabras clave"
        ):
            continue

        value = re.sub(
            r"^palabras\s+clave\s*:\s*",
            "",
            line,
            flags=re.IGNORECASE,
        ).strip()

        if not value and (
            index + 1 < len(
                parser.lines
            )
        ):
            value = parser.lines[
                index + 1
            ]

        values = [
            clean_text(item)
            for item in re.split(
                r"[,;]",
                value,
            )
        ]

        return [
            item
            for item in values
            if item
        ][:20]

    return []


def stable_id(
    url,
):
    digest = hashlib.sha1(
        url.encode(
            "utf-8"
        )
    ).hexdigest()[:20]

    return (
        "cucsh:sincronia-legacy:"
        + digest
    )


def build_legacy_record(
    article_link,
    issue,
    prefer_wayback=False,
):
    url = article_link["url"]

    parser = DocumentParser()

    if (
        is_html_url(
            url
        )
        and not prefer_wayback
    ):
        data, _ = request_legacy_bytes(
            url,
            prefer_wayback=False,
        )

        parser = parse_html(
            data
        )

    title = choose_title(
        article_link.get(
            "text"
        ),
        parser,
    )

    if not title:
        return None

    authors = extract_authors(
        parser,
        title,
    )

    abstract = extract_abstract(
        parser
    )

    subjects = extract_subjects(
        parser
    )

    record_id = stable_id(
        url
    )

    return {
        "id":
            record_id,

        "sourceId":
            (
                "legacy:"
                + record_id.rsplit(
                    ":",
                    1,
                )[-1]
            ),

        "oaiDatestamp":
            None,

        "journal":
            "Sincronía",

        "title":
            title,

        "titleVariants":
            [
                title
            ],

        "authors":
            authors,

        "date":
            (
                str(
                    issue["year"]
                )
                if issue.get(
                    "year"
                )
                else None
            ),

        "year":
            issue.get(
                "year"
            ),

        "type":
            "journal-article",

        "language":
            "es",

        "languages":
            [
                "es"
            ],

        "doi":
            None,

        "publisher":
            (
                "Universidad de Guadalajara"
            ),

        "abstract":
            abstract,

        "abstractVariants":
            (
                [abstract]
                if abstract
                else []
            ),

        "subjects":
            subjects,

        "bibliographicSources":
            [
                "Sincronía",
                (
                    "Plataforma original"
                ),
            ],

        "rights":
            [],

        "issueNumber":
            issue.get(
                "number"
            ),

        "issueTitle":
            issue.get(
                "title"
            ),

        "legacyOriginal":
            True,

        "urls": {
            "canonical":
                url,

            "doi":
                None,

            "relations":
                [],
        },
    }


def wayback_snapshot_url(
    url,
):
    api_url = (
        "https://archive.org/"
        "wayback/available?"
        + urllib.parse.urlencode({
            "url":
                url,
        })
    )

    data = request_bytes(
        api_url,
        timeout=25,
    )

    payload = json.loads(
        data.decode(
            "utf-8",
            errors="replace",
        )
    )

    closest = (
        payload.get(
            "archived_snapshots",
            {},
        ).get(
            "closest",
            {},
        )
    )

    if not closest.get(
        "available"
    ):
        return None

    snapshot_url = (
        closest.get(
            "url"
        )
    )

    if not snapshot_url:
        return None

    snapshot_url = re.sub(
        r"^http://",
        "https://",
        snapshot_url,
        flags=re.IGNORECASE,
    )

    snapshot_url = re.sub(
        r"/web/(\d{14})/",
        r"/web/\1id_/",
        snapshot_url,
        count=1,
    )

    return snapshot_url


def request_legacy_bytes(
    url,
    prefer_wayback=False,
    allow_live_fallback=True,
):
    errors = []

    if not prefer_wayback:
        try:
            return (
                request_bytes(
                    url,
                    timeout=4,
                ),
                False,
            )

        except Exception as exc:
            errors.append(
                (
                    "live",
                    repr(exc),
                )
            )

    try:
        snapshot_url = (
            wayback_snapshot_url(
                url
            )
        )

        if snapshot_url:
            return (
                request_bytes(
                    snapshot_url,
                    timeout=10,
                ),
                True,
            )

    except Exception as exc:
        errors.append(
            (
                "wayback",
                repr(exc),
            )
        )

    if (
        prefer_wayback
        and allow_live_fallback
    ):
        try:
            return (
                request_bytes(
                    url,
                    timeout=4,
                ),
                False,
            )

        except Exception as exc:
            errors.append(
                (
                    "live-fallback",
                    repr(exc),
                )
            )

    raise RuntimeError(
        (
            "legacy URL unavailable: "
            f"{url} -> {errors}"
        )
    )


def harvest_direct_early_issues(
    max_issue=21,
):
    records = []
    covered_issues = set()
    seen_article_urls = set()

    for issue_number, (
        filename,
        fallback_year,
    ) in EARLY_ISSUE_FILENAMES.items():
        if issue_number > max_issue:
            continue

        issue_data = None
        issue_url = None
        used_wayback = False

        for base_url in EARLY_ISSUE_BASES:
            candidate = urllib.parse.urljoin(
                base_url,
                filename,
            )

            try:
                (
                    issue_data,
                    used_wayback,
                ) = request_legacy_bytes(
                    candidate,
                    prefer_wayback=True,
                    allow_live_fallback=False,
                )

                issue_url = candidate
                break

            except Exception:
                continue

        if (
            issue_data is None
            or issue_url is None
        ):
            continue

        parser = parse_html(
            issue_data
        )

        year = (
            infer_year(
                parser,
                issue_url,
            )
            or fallback_year
        )

        links = [
            link
            for link in collect_links(
                issue_data,
                issue_url,
            )
            if plausible_article_link(
                link,
                set(),
            )
        ]

        issue = {
            "url":
                issue_url,

            "number":
                issue_number,

            "year":
                year,

            "title":
                (
                    parser.title
                    or (
                        f"Sincronía Núm. "
                        f"{issue_number}"
                    )
                ),

            "links":
                links,
        }

        issue_added = 0

        for link in links:
            url = link["url"]

            if url in seen_article_urls:
                continue

            try:
                record = build_legacy_record(
                    link,
                    issue,
                    prefer_wayback=(
                        used_wayback
                    ),
                )

            except Exception:
                continue

            if not record:
                continue

            seen_article_urls.add(
                url
            )

            records.append(
                record
            )

            issue_added += 1

        if issue_added:
            covered_issues.add(
                issue_number
            )

            print(
                (
                    "legacy-direct-issue="
                    f"{issue_number} "
                    f"year={year} "
                    f"articles={issue_added}"
                )
            )

    return (
        records,
        sorted(
            covered_issues
        ),
    )


def historical_record_key(
    record,
):
    title = (
        clean_text(
            record.get(
                "title"
            )
        )
        or ""
    ).casefold()

    title = re.sub(
        r"[^a-z0-9áéíóúüñ]+",
        " ",
        title,
        flags=re.UNICODE,
    )

    title = WHITESPACE_RE.sub(
        " ",
        title,
    ).strip()

    return (
        record.get(
            "issueNumber"
        ),
        title,
    )


def merge_historical_records(
    *groups,
):
    output = []
    seen_ids = set()
    seen_urls = set()
    seen_keys = set()

    for group in groups:
        for record in group or []:
            record_id = (
                record.get("id")
            )

            canonical = (
                record.get(
                    "urls",
                    {},
                ).get(
                    "canonical"
                )
            )

            key = historical_record_key(
                record
            )

            if (
                record_id
                and record_id in seen_ids
            ):
                continue

            if (
                canonical
                and canonical in seen_urls
            ):
                continue

            if (
                key[0]
                and key[1]
                and key in seen_keys
            ):
                continue

            output.append(
                record
            )

            if record_id:
                seen_ids.add(
                    record_id
                )

            if canonical:
                seen_urls.add(
                    canonical
                )

            if key[0] and key[1]:
                seen_keys.add(
                    key
                )

    return output


def fetch_first_available(
    urls,
):
    errors = []

    for url in urls:
        try:
            data, used_wayback = (
                request_legacy_bytes(
                    url
                )
            )

            return (
                url,
                data,
                used_wayback,
            )

        except Exception as exc:
            errors.append(
                (
                    url,
                    repr(exc),
                )
            )

    raise RuntimeError(
        (
            "Sincronía legacy archive "
            f"is unavailable: {errors}"
        )
    )


def harvest_legacy_records(
    archive_urls,
    max_issue=51,
):
    try:
        (
            archive_url,
            data,
            archive_from_wayback,
        ) = fetch_first_available(
            archive_urls
        )

    except Exception as original_error:
        (
            direct_records,
            direct_issues,
        ) = harvest_direct_early_issues(
            max_issue=min(
                max_issue,
                21,
            )
        )

        try:
            (
                dialnet_records,
                dialnet_issues,
            ) = harvest_dialnet_records(
                max_issue=max_issue
            )

        except Exception as dialnet_error:
            if not direct_records:
                raise RuntimeError(
                    (
                        "Sincronía historical recovery "
                        "failed in original archive, "
                        "Wayback direct issues and "
                        "Dialnet. "
                        f"original={original_error!r}; "
                        f"dialnet={dialnet_error!r}"
                    )
                ) from dialnet_error

            dialnet_records = []
            dialnet_issues = []

        combined = merge_historical_records(
            direct_records,
            dialnet_records,
        )

        covered_issues = sorted(
            set(
                direct_issues
            )
            | set(
                dialnet_issues
            )
        )

        print(
            (
                "legacy-fallback=direct+dialnet "
                f"issues={covered_issues} "
                f"records={len(combined)}"
            )
        )

        return combined

    links = collect_links(
        data,
        archive_url,
    )

    candidates = []

    for link in links:
        url = link["url"]

        if not is_html_url(
            url
        ):
            continue

        stem = file_stem(
            url
        )

        if (
            stem in NAVIGATION_NAMES
            or stem.startswith(
                "num_anteriores"
            )
        ):
            continue

        candidates.append(
            link
        )

    issue_rows = []
    seen_issue_urls = set()

    for candidate in candidates:
        url = candidate["url"]

        if url in seen_issue_urls:
            continue

        try:
            issue_data, _ = (
                request_legacy_bytes(
                    url,
                    prefer_wayback=(
                        archive_from_wayback
                    ),
                )
            )

        except Exception:
            continue

        parser = parse_html(
            issue_data
        )

        fallback_number = (
            infer_issue_number(
                candidate.get(
                    "text"
                ),
                url,
            )
        )

        issue_number = (
            infer_issue_number_from_page(
                parser,
                fallback_number,
            )
        )

        if (
            issue_number is None
            or issue_number < 1
            or issue_number > max_issue
        ):
            continue

        year = infer_year(
            parser,
            url,
        )

        if not year:
            continue

        issue_links = [
            link
            for link in collect_links(
                issue_data,
                url,
            )
            if plausible_article_link(
                link,
                set(),
            )
        ]

        if len(issue_links) < 1:
            continue

        seen_issue_urls.add(
            url
        )

        issue_rows.append({
            "url":
                url,

            "number":
                issue_number,

            "year":
                year,

            "title":
                (
                    parser.title
                    or (
                        f"Sincronía "
                        f"Núm. {issue_number}"
                    )
                ),

            "links":
                issue_links,
        })

    if not issue_rows:
        raise RuntimeError(
            (
                "Sincronía legacy archive "
                "did not yield issues 1-51"
            )
        )

    issue_urls = {
        issue["url"]
        for issue in issue_rows
    }

    records = []
    seen_article_urls = set()

    for issue in sorted(
        issue_rows,
        key=lambda item: (
            item["number"],
            item["year"],
        ),
    ):
        for link in issue["links"]:
            if not plausible_article_link(
                link,
                issue_urls,
            ):
                continue

            url = link["url"]

            if url in seen_article_urls:
                continue

            try:
                record = build_legacy_record(
                    link,
                    issue,
                    prefer_wayback=(
                        archive_from_wayback
                    ),
                )

            except Exception:
                continue

            if not record:
                continue

            seen_article_urls.add(
                url
            )

            records.append(
                record
            )

        print(
            (
                "legacy-issue="
                f"{issue['number']} "
                f"year={issue['year']} "
                f"records={len(records)}"
            )
        )

    if not records:
        raise RuntimeError(
            (
                "Sincronía legacy archive "
                "did not yield article records"
            )
        )

    return records

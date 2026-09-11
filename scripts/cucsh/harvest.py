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

from collections import Counter
from pathlib import Path


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

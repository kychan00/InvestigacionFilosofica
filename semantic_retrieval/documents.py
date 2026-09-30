from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections.abc import Iterable, Mapping
from typing import Any

from .models import Document


def _text(value: Any) -> str | None:
    if value is None:
        return None
    output = " ".join(str(value).split()).strip()
    return output or None


def _string_list(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        candidates: Iterable[Any] = re.split(r"[,;|]", value)
    elif isinstance(value, Mapping):
        candidates = value.values()
    elif isinstance(value, Iterable):
        candidates = value
    else:
        candidates = (value,)

    output: list[str] = []
    seen: set[str] = set()
    for item in candidates:
        if isinstance(item, Mapping):
            item = item.get("name") or item.get("display_name") or item.get("id")
        normalized = _text(item)
        if not normalized:
            continue
        key = normalized.casefold()
        if key not in seen:
            seen.add(key)
            output.append(normalized)
    return tuple(output)


def _integer(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Mapping):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, Iterable) and not isinstance(value, (str, bytes)):
        return [_jsonable(item) for item in value]
    if hasattr(value, "item"):
        return _jsonable(value.item())
    return str(value)


def normalize_document(record: Mapping[str, Any]) -> Document:
    work_id = record.get("work_id")
    explicit_id = _text(record.get("id"))
    openalex_id = _text(record.get("openalex_id"))

    if work_id is not None:
        numeric = str(work_id).removeprefix("https://openalex.org/").removeprefix("W")
        openalex_id = openalex_id or f"W{numeric}"
        document_id = explicit_id or f"openalex-{openalex_id}"
    elif explicit_id:
        document_id = explicit_id
    else:
        raise ValueError("Document record has no id, work_id or openalex_id")

    title = _text(record.get("title")) or ""
    authors = _string_list(record.get("authors") or record.get("authorships"))
    topics = _string_list(record.get("topics"))
    keywords = _string_list(record.get("keywords"))

    ontology_keyword = _text(record.get("ontology_keyword_id"))
    if ontology_keyword and ontology_keyword.casefold() not in {
        item.casefold() for item in keywords
    }:
        keywords = (*keywords, ontology_keyword)

    doi = _text(record.get("doi"))
    if doi:
        doi = doi.removeprefix("https://doi.org/").removeprefix("http://doi.org/")

    canonical_url = _text(record.get("url"))
    if not canonical_url and openalex_id:
        canonical_url = f"https://openalex.org/{openalex_id}"

    return Document(
        id=document_id,
        title=title,
        abstract=_text(record.get("abstract")),
        authors=authors,
        year=_integer(record.get("year") or record.get("publication_year")),
        topics=topics,
        keywords=keywords,
        journal=_text(record.get("journal") or record.get("source_name")),
        language=_text(record.get("language")),
        doi=doi,
        source=_text(record.get("source")) or "OpenAlex Philosophy",
        publication_type=_text(record.get("publication_type") or record.get("type")),
        openalex_id=openalex_id,
        crossref_id=_text(record.get("crossref_id")),
        url=canonical_url,
        original=_jsonable(dict(record)),
    )


def build_document_text(document: Document, max_characters: int = 24_000) -> str:
    fields = (
        ("Title", document.title),
        ("Abstract", document.abstract),
        ("Authors", "; ".join(document.authors) if document.authors else None),
        ("Topics", "; ".join(document.topics) if document.topics else None),
        ("Keywords", "; ".join(document.keywords) if document.keywords else None),
    )
    blocks = [f"{label}:\n{value}" for label, value in fields if value]
    return "\n\n".join(blocks)[:max_characters]


def content_hash(document: Document, max_characters: int = 24_000) -> str:
    payload = {
        "id": document.id,
        "document_text": build_document_text(document, max_characters),
        "metadata": {
            "year": document.year,
            "journal": document.journal,
            "language": document.language,
            "doi": document.doi,
            "source": document.source,
            "publication_type": document.publication_type,
            "openalex_id": document.openalex_id,
            "crossref_id": document.crossref_id,
            "url": document.url,
        },
    }
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def normalize_query(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(
        character for character in normalized if not unicodedata.combining(character)
    )
    return " ".join(without_marks.casefold().split())

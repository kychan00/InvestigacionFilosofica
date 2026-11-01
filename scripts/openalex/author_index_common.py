import hashlib
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import quote


OPENALEX_SNAPSHOT_REPO = "Mearman/OpenAlex"
OPENALEX_SNAPSHOT_REVISION = (
    "ef02effac13bfbd0991612f444cebcef8a882453"
)

PHILOSOPHY_REPO = "CristianPelayo/openalex-philosophy"
PHILOSOPHY_REVISION = (
    "5a4a195085de54bf607a6c4397092ffb32716dcc"
)

PHILOSOPHY_SEARCH_PATH = (
    "v3.2/philosophy-corpus-v3-2-search.parquet"
)

AUTHORSHIP_PATH = "data/works/authorships"
AUTHOR_PATH = "data/authors/main"

INDEX_VERSION = "author-index-v2"
BUCKET_COUNT = 1024


HONORIFICS = {
    "dr", "dra", "doctor", "doctora", "prof",
    "profesor", "profesora", "lic", "licenciado",
    "licenciada", "mtro", "mtra", "maestro",
    "maestra", "phd",
}


NAME_PARTICLES = {
    "al",
    "da",
    "de",
    "del",
    "der",
    "di",
    "dos",
    "du",
    "la",
    "le",
    "van",
    "von",
    "y",
}


def hf_file_url(repo_id, revision, path):
    encoded = quote(path, safe="/=")

    return (
        "https://huggingface.co/datasets/"
        f"{repo_id}/resolve/{revision}/{encoded}"
    )


def normalize_name(value):
    text = unicodedata.normalize(
        "NFKD",
        str(value or ""),
    )

    text = "".join(
        character
        for character in text
        if not unicodedata.combining(character)
    ).casefold()

    text = re.sub(
        r"[^\w\s-]+",
        " ",
        text,
        flags=re.UNICODE,
    )

    text = text.replace("_", " ")
    text = text.replace("-", " ")

    normalized = re.sub(
        r"\s+",
        " ",
        text,
    ).strip()
    tokens = normalized.split()

    # Titles are not identity evidence: "Dra Dinora Hernández"
    # should be indexed under "Dinora Hernández".
    while len(tokens) > 1 and tokens[0] in HONORIFICS:
        tokens.pop(0)

    return " ".join(tokens)


def name_tokens(value):
    return [
        token
        for token in normalize_name(value).split()
        if token
    ]


def token_signature(value):
    return " ".join(
        sorted(
            set(
                name_tokens(value)
            )
        )
    )


def alias_signatures(value):
    tokens = name_tokens(value)

    if not tokens:
        return []

    aliases = {
        (
            token_signature(" ".join(tokens)),
            "full",
        )
    }

    meaningful = [
        token
        for token in tokens
        if (
            len(token) >= 2
            and token not in NAME_PARTICLES
        )
    ]

    if meaningful:
        aliases.add((
            meaningful[-1],
            "surname",
        ))

    if len(tokens) >= 3:
        # A Spanish author's second family name may be absent from
        # citations. This is a *candidate* alias, not proof of identity.
        aliases.add((
            token_signature(
                f"{tokens[0]} {tokens[1]}"
            ),
            "given-first-family",
        ))

    if len(tokens) >= 2:
        aliases.add((
            token_signature(
                " ".join(tokens[-2:])
            ),
            "suffix",
        ))

        aliases.add((
            token_signature(
                f"{tokens[0][0]} {tokens[-1]}"
            ),
            "initial",
        ))

    return sorted(aliases)


def fnv1a_32(value):
    result = 0x811C9DC5

    for byte in str(value).encode("utf-8"):
        result ^= byte
        result = (
            result * 0x01000193
        ) & 0xFFFFFFFF

    return result


def bucket_for(value, bucket_count=BUCKET_COUNT):
    return fnv1a_32(value) % bucket_count


def sha256_file(path):
    digest = hashlib.sha256()

    with Path(path).open("rb") as stream:
        for chunk in iter(
            lambda: stream.read(1024 * 1024),
            b"",
        ):
            digest.update(chunk)

    return digest.hexdigest()


def write_json(path, payload):
    destination = Path(path)
    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    destination.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        ) + "\n",
        encoding="utf-8",
    )

import json
import re
from pathlib import Path


SOURCE = Path(
    "artifacts/openalex/"
    "philosophy-topic-candidates.json"
)

OUTPUT_DIR = Path(
    "artifacts/openalex"
)

PHILOSOPHY_SUBFIELD_ID = 1211


# Topic generado por OpenAlex con mezcla
# semántica claramente contaminada.
EXPLICIT_EXCLUDE_IDS = {
    14371,  # Hume's philosophy and hair distribution
}


TECHNICAL_LOGIC_SUBFIELDS = {
    "Artificial Intelligence",
    "Computational Theory and Mathematics",
}


DIRECT_PATTERNS = [
    r"\bphilosoph",
    r"\bphenomenolog",
    r"\bepistemolog",
    r"\bhermeneut",
    r"\bexistential",
    r"\bmetaphys",
    r"\bontology\b",
    r"\bontological\b",
    r"\bfree will\b",
    r"\bcritical theory\b",
    r"\baesthetic",
    r"\bpragmat",
    r"\bdecolonial",
    r"\bposthumanist",
    r"\bfoucault\b",
    r"\bmarxism\b",
    r"\bgramsc",
    r"\bwhitehead\b",
    r"\bpsychoanalysis\b",
]


ADJACENT_PATTERNS = [
    r"\bethics?\b",
    r"\bbioethic",
    r"\bjurisprudence\b",
    r"\bpolitical theory\b",
    r"\blaw\b",
]


def matches_any(
    text,
    patterns
):
    return any(
        re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )
        for pattern in patterns
    )


def classify(item):

    topic_id = int(
        item["topic_id"]
    )

    name = str(
        item.get(
            "display_name",
            ""
        )
    )

    subfield_id = item.get(
        "subfield_id"
    )

    subfield_name = str(
        item.get(
            "subfield_name",
            ""
        )
        or ""
    )


    if (
        subfield_id ==
        PHILOSOPHY_SUBFIELD_ID
    ):
        return (
            "core",
            "OpenAlex subfield Philosophy"
        )


    if (
        topic_id in
        EXPLICIT_EXCLUDE_IDS
    ):
        return (
            "exclude",
            "topic contaminado"
        )


    if (
        re.search(
            r"\blogic\b",
            name,
            flags=re.IGNORECASE,
        )
        and
        subfield_name in
        TECHNICAL_LOGIC_SUBFIELDS
        and
        not matches_any(
            name,
            [
                r"\bphilosoph",
                r"\bepistemolog",
                r"\bfree will\b",
                r"\bcritical theory\b",
            ]
        )
    ):
        return (
            "exclude",
            "lógica técnica no filosófica"
        )


    if matches_any(
        name,
        DIRECT_PATTERNS
    ):
        return (
            "extended",
            "señal filosófica directa"
        )


    if matches_any(
        name,
        ADJACENT_PATTERNS
    ):
        return (
            "adjacent",
            "filosofía aplicada o campo vecino"
        )


    return (
        "review",
        "requiere revisión"
    )


data = json.loads(
    SOURCE.read_text(
        encoding="utf-8"
    )
)


tiers = {
    "core": [],
    "extended": [],
    "adjacent": [],
    "exclude": [],
    "review": [],
}


for item in data[
    "candidates"
]:

    tier, reason = classify(
        item
    )

    copy = dict(item)

    copy[
        "curation_tier"
    ] = tier

    copy[
        "curation_reason"
    ] = reason

    tiers[tier].append(
        copy
    )


for values in tiers.values():

    values.sort(
        key=lambda item: (
            -int(
                item.get(
                    "score",
                    0
                )
            ),
            -int(
                item.get(
                    "works_count",
                    0
                )
            ),
            item.get(
                "display_name",
                ""
            ),
        )
    )


main_topics = (
    tiers["core"]
    +
    tiers["extended"]
)


result = {
    "philosophy_subfield_id":
        PHILOSOPHY_SUBFIELD_ID,

    "counts": {
        key: len(value)
        for key, value
        in tiers.items()
    },

    "main_count":
        len(main_topics),

    "tiers":
        tiers,
}


json_path = (
    OUTPUT_DIR /
    "philosophy-topics-curated.json"
)

json_path.write_text(
    json.dumps(
        result,
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)


def write_ids(
    filename,
    items
):
    path = (
        OUTPUT_DIR /
        filename
    )

    path.write_text(
        "\n".join(
            str(
                item["topic_id"]
            )
            for item in items
        )
        + "\n",
        encoding="utf-8",
    )

    return path


main_ids_path = write_ids(
    "philosophy-topic-ids-main.txt",
    main_topics,
)

adjacent_ids_path = write_ids(
    "philosophy-topic-ids-adjacent.txt",
    tiers["adjacent"],
)

excluded_ids_path = write_ids(
    "philosophy-topic-ids-excluded.txt",
    tiers["exclude"],
)


print("=" * 76)
print("CURACIÓN OPENALEX FILOSOFÍA")
print("=" * 76)

for name in [
    "core",
    "extended",
    "adjacent",
    "exclude",
    "review",
]:
    print(
        f"{name.upper():10}: "
        f"{len(tiers[name]):3}"
    )


print()
print(
    "ÍNDICE PRINCIPAL:",
    len(main_topics)
)


for tier_name in [
    "core",
    "extended",
    "adjacent",
    "exclude",
    "review",
]:

    print()
    print("=" * 76)
    print(
        tier_name.upper()
    )
    print("=" * 76)

    for item in tiers[
        tier_name
    ]:

        print(
            f"{item['topic_id']:6}  "
            f"{item['score']:3}  "
            f"{item['display_name']}  "
            f"[{item.get('subfield_name') or '—'}]"
        )


print()
print("=" * 76)
print("ARCHIVOS")
print("=" * 76)

print(json_path)
print(main_ids_path)
print(adjacent_ids_path)
print(excluded_ids_path)

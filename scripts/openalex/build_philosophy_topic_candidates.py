import json
import re
from pathlib import Path
from urllib.parse import quote

import duckdb

from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile


REPO_ID = "Mearman/OpenAlex"

PHILOSOPHY_SUBFIELD_ID = 1211


# ---------------------------------------------------------
# Señales filosóficas fuertes que complementan
# nuestro philosophy-map.json.
# ---------------------------------------------------------

CURATED_SIGNALS = {
    "philosophy",
    "philosophical",
    "philosopher",

    "metaphysics",
    "metaphysical",
    "ontology",
    "ontological",

    "epistemology",
    "epistemological",
    "theory of knowledge",

    "ethics",
    "ethical",
    "moral philosophy",

    "political philosophy",
    "political theory",

    "philosophy of mind",
    "mind body",
    "consciousness",
    "free will",

    "philosophy of science",
    "philosophy of language",

    "logic",
    "philosophical logic",

    "aesthetics",
    "philosophy of art",

    "phenomenology",
    "phenomenological",

    "existentialism",
    "existential",

    "hermeneutics",
    "hermeneutic",

    "pragmatism",
    "analytic philosophy",
    "continental philosophy",

    "critical theory",
    "marxism",

    "stoicism",
    "stoic",
    "scholasticism",
    "scholastic",

    "philosophy of religion",
    "philosophy of law",
    "jurisprudence",
    "philosophy of technology",

    "kant",
    "kantian",
    "hegel",
    "hegelian",
    "nietzsche",
    "nietzschean",
    "heidegger",
    "heideggerian",
    "husserl",
    "husserlian",
    "wittgenstein",
    "wittgensteinian",
    "rawls",
    "aristotle",
    "aristotelian",
    "plato",
    "platonic",
    "descartes",
    "cartesian",
    "hume",
    "popper",

    "kierkegaard",
    "sartre",
    "beauvoir",
    "foucault",
    "derrida",
    "deleuze",
    "levinas",
    "habermas",
    "adorno",
    "benjamin",
    "marx",
    "spinoza",
    "leibniz",
    "locke",
    "rousseau",
    "hobbes",
    "aquinas",
    "augustine",
    "augustinian",
}


# Términos demasiado generales para decidir
# por sí solos que un topic es filosófico.
WEAK_TERMS = {
    "being",
    "existence",
    "language",
    "knowledge",
    "truth",
    "justice",
    "freedom",
    "autonomy",
    "virtue",
    "causality",
    "duty",
    "religion",
    "technology",
    "moral",
}


api = HfApi()

con = duckdb.connect()

con.execute("INSTALL httpfs")
con.execute("LOAD httpfs")


def normalize(value):
    value = str(
        value or ""
    ).lower()

    value = re.sub(
        r"\s+",
        " ",
        value
    )

    return value.strip()


def urls_for(path):

    entries = api.list_repo_tree(
        repo_id=REPO_ID,
        repo_type="dataset",
        path_in_repo=path,
        recursive=True,
        expand=False,
        revision="main",
        token=False,
    )

    files = [
        entry
        for entry in entries
        if isinstance(
            entry,
            RepoFile
        )
        and entry.path.endswith(
            ".parquet"
        )
    ]

    if not files:
        raise RuntimeError(
            f"No Parquet en {path}"
        )

    return [
        (
            "https://huggingface.co/datasets/"
            "Mearman/OpenAlex/resolve/main/"
            +
            quote(
                entry.path,
                safe="/="
            )
        )
        for entry in files
    ]


def parquet_relation(path):

    urls = urls_for(path)

    quoted = ", ".join(
        "'" +
        url.replace(
            "'",
            "''"
        ) +
        "'"
        for url in urls
    )

    return (
        f"read_parquet([{quoted}])"
    )


# ---------------------------------------------------------
# Cargar nuestro mapa filosófico.
# ---------------------------------------------------------

map_path = Path(
    "src/data/philosophy-map.json"
)

philosophy_map = json.loads(
    map_path.read_text(
        encoding="utf-8"
    )
)


signals = set(
    CURATED_SIGNALS
)


def add_signal(value):

    value = normalize(
        value
    )

    if (
        value
        and
        len(value) >= 4
        and
        value not in WEAK_TERMS
    ):
        signals.add(
            value
        )


for area in philosophy_map.get(
    "areas",
    []
):
    add_signal(
        area.get("name_en")
    )

    for alias in area.get(
        "aliases_en",
        []
    ):
        add_signal(alias)


for concept in philosophy_map.get(
    "concepts",
    []
):
    add_signal(
        concept.get("name_en")
    )

    for alias in concept.get(
        "aliases_en",
        []
    ):
        add_signal(alias)


for philosopher in philosophy_map.get(
    "philosophers",
    []
):
    add_signal(
        philosopher.get("name")
    )

    for alias in philosopher.get(
        "aliases",
        []
    ):
        add_signal(alias)


for tradition in philosophy_map.get(
    "traditions",
    []
):
    add_signal(
        tradition.get("name_en")
    )


# ---------------------------------------------------------
# Tablas pequeñas de taxonomy.
# ---------------------------------------------------------

topics_main = parquet_relation(
    "data/topics/main"
)

topics_subfields = parquet_relation(
    "data/topics/subfields"
)

subfields_main = parquet_relation(
    "data/subfields/main"
)


rows = con.execute(
    f"""
    SELECT
        t.topic_id,
        t.display_name,
        t.description,
        t.works_count,
        t.cited_by_count,
        ts.subfield_id,
        s.display_name
            AS subfield_name
    FROM {topics_main} t
    LEFT JOIN {topics_subfields} ts
        ON ts.topic_id =
           t.topic_id
    LEFT JOIN {subfields_main} s
        ON s.subfield_id =
           ts.subfield_id
    """
).fetchall()


# ---------------------------------------------------------
# Scoring.
#
# Importante:
# estar en subfield Philosophy ayuda,
# pero NO garantiza inclusión.
# ---------------------------------------------------------

candidates = []


for row in rows:

    (
        topic_id,
        name,
        description,
        works_count,
        cited_by_count,
        subfield_id,
        subfield_name,
    ) = row


    name_norm = normalize(name)
    description_norm = normalize(
        description
    )


    score = 0
    reasons = []


    if (
        subfield_id ==
        PHILOSOPHY_SUBFIELD_ID
    ):
        score += 4

        reasons.append(
            "subfield:Philosophy"
        )


    matched = []


    for signal in signals:

        if signal in name_norm:

            score += 8

            matched.append(
                signal
            )

        elif signal in description_norm:

            score += 1


    # "philosoph" en el nombre es una
    # señal particularmente fuerte.
    if "philosoph" in name_norm:

        score += 12

        reasons.append(
            "name:philosoph*"
        )


    # Temas filosóficos muy distintivos.
    distinctive = {
        "hermeneut",
        "epistemolog",
        "metaphys",
        "ontolog",
        "phenomenolog",
        "existential",
        "aesthetic",
        "pragmat",
        "critical theory",
        "free will",
    }


    for term in distinctive:

        if term in name_norm:

            score += 10

            reasons.append(
                f"name:{term}"
            )


    if matched:

        reasons.append(
            "signals:" +
            ",".join(
                sorted(
                    set(matched)
                )[:8]
            )
        )


    # Sólo guardamos candidatos con
    # evidencia filosófica real.
    if score >= 8:

        candidates.append({
            "topic_id":
                int(topic_id),

            "display_name":
                name,

            "subfield_id":
                int(subfield_id)
                if subfield_id
                is not None
                else None,

            "subfield_name":
                subfield_name,

            "works_count":
                int(
                    works_count or 0
                ),

            "cited_by_count":
                int(
                    cited_by_count or 0
                ),

            "score":
                score,

            "reasons":
                reasons,
        })


candidates.sort(
    key=lambda item: (
        -item["score"],
        -item["works_count"],
        item["display_name"],
    )
)


core = [
    item
    for item in candidates
    if item["subfield_id"]
    == PHILOSOPHY_SUBFIELD_ID
]


external = [
    item
    for item in candidates
    if item["subfield_id"]
    != PHILOSOPHY_SUBFIELD_ID
]


print("=" * 78)
print("OPENALEX PHILOSOPHY TOPIC CANDIDATES")
print("=" * 78)

print(
    f"Señales utilizadas: "
    f"{len(signals):,}"
)

print(
    f"Candidatos totales: "
    f"{len(candidates):,}"
)

print(
    f"Dentro de Philosophy: "
    f"{len(core):,}"
)

print(
    f"Fuera de Philosophy: "
    f"{len(external):,}"
)


print()
print("=" * 78)
print("NÚCLEO — SUBFIELD PHILOSOPHY")
print("=" * 78)


for item in core:

    print(
        f"{item['topic_id']:6}  "
        f"{item['score']:3}  "
        f"{item['works_count']:10,}  "
        f"{item['display_name']}"
    )


print()
print("=" * 78)
print("EXTENSIÓN FILOSÓFICA — OTROS SUBFIELDS")
print("=" * 78)


for item in external[:150]:

    print(
        f"{item['topic_id']:6}  "
        f"{item['score']:3}  "
        f"{item['works_count']:10,}  "
        f"{item['display_name']}  "
        f"[{item['subfield_name']}]"
    )


output_dir = Path(
    "artifacts/openalex"
)

output_dir.mkdir(
    parents=True,
    exist_ok=True
)


json_path = (
    output_dir /
    "philosophy-topic-candidates.json"
)


json_path.write_text(
    json.dumps(
        {
            "philosophy_subfield_id":
                PHILOSOPHY_SUBFIELD_ID,

            "candidate_count":
                len(candidates),

            "core_count":
                len(core),

            "external_count":
                len(external),

            "candidates":
                candidates,
        },
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)


tsv_path = (
    output_dir /
    "philosophy-topic-candidates.tsv"
)


with tsv_path.open(
    "w",
    encoding="utf-8"
) as handle:

    handle.write(
        "topic_id\t"
        "score\t"
        "works_count\t"
        "subfield_id\t"
        "subfield_name\t"
        "display_name\t"
        "reasons\n"
    )

    for item in candidates:

        handle.write(
            "\t".join([
                str(
                    item["topic_id"]
                ),

                str(
                    item["score"]
                ),

                str(
                    item["works_count"]
                ),

                str(
                    item["subfield_id"]
                    or ""
                ),

                str(
                    item["subfield_name"]
                    or ""
                ).replace(
                    "\t",
                    " "
                ),

                str(
                    item["display_name"]
                ).replace(
                    "\t",
                    " "
                ),

                ";".join(
                    item["reasons"]
                ),
            ])
            + "\n"
        )


print()
print("=" * 78)
print("ARCHIVOS")
print("=" * 78)

print(json_path)
print(tsv_path)

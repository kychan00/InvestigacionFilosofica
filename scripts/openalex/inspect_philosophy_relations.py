from urllib.parse import quote

import duckdb

from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile


REPO_ID = "Mearman/OpenAlex"

SUBFIELDS = {
    1211: "Philosophy",
    1207: "History and Philosophy of Science",
    2910: "Issues, ethics and legal aspects",
}


api = HfApi()

con = duckdb.connect()

con.execute(
    "INSTALL httpfs"
)

con.execute(
    "LOAD httpfs"
)

con.execute(
    "SET threads = 4"
)

con.execute(
    "SET preserve_insertion_order = false"
)


def discover(path):

    entries = list(
        api.list_repo_tree(
            repo_id=REPO_ID,
            repo_type="dataset",
            path_in_repo=path,
            recursive=True,
            expand=False,
            revision="main",
            token=False,
        )
    )

    return [
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


def remote_url(entry):

    return (
        "https://huggingface.co/"
        "datasets/Mearman/OpenAlex/"
        "resolve/main/"
        +
        quote(
            entry.path,
            safe="/="
        )
    )


def relation(files):

    urls = [
        remote_url(file)
        for file in files
    ]

    joined = ", ".join(
        "'"
        +
        url.replace(
            "'",
            "''"
        )
        +
        "'"
        for url in urls
    )

    return (
        "read_parquet(["
        +
        joined
        +
        "])"
    )


def spread_sample(
    files,
    count=20
):

    files = sorted(
        files,
        key=lambda file:
            file.path
    )

    if len(files) <= count:
        return files

    result = []

    for i in range(count):

        index = round(
            i
            *
            (
                len(files) - 1
            )
            /
            (
                count - 1
            )
        )

        result.append(
            files[index]
        )

    return result


def print_schema(
    name,
    files
):

    print()
    print("=" * 78)
    print(name)
    print("=" * 78)

    total = sum(
        int(
            file.size or 0
        )
        for file in files
    )

    print(
        f"Shards: {len(files):,}"
    )

    print(
        f"Tamaño: "
        f"{total / 1024**3:.2f} GiB"
    )


    largest = max(
        files,
        key=lambda file:
            int(
                file.size or 0
            )
    )

    rel = relation(
        [largest]
    )


    print()
    print(
        "Shard inspeccionado:"
    )

    print(
        largest.path
    )

    print()
    print("ESQUEMA")
    print("-" * 78)


    rows = con.execute(
        f"""
        DESCRIBE
        SELECT *
        FROM {rel}
        """
    ).fetchall()


    for row in rows:

        print(
            f"{row[0]:35} "
            f"{row[1]}"
        )


# =========================================================
# 1. WORKS/TOPICS
# =========================================================

work_topic_files = discover(
    "data/works/topics"
)

print_schema(
    "WORKS / TOPICS",
    work_topic_files
)


sample_topics = spread_sample(
    work_topic_files,
    20
)

sample_topic_relation = relation(
    sample_topics
)


print()
print("=" * 78)
print("¿TOPIC_ID ES REALMENTE SUBFIELD_ID?")
print("=" * 78)


rows = con.execute(
    f"""
    SELECT
        topic_id,
        count(*) AS rows,
        count(
            DISTINCT work_id
        ) AS works,
        avg(score) AS avg_score,
        max(score) AS max_score

    FROM {sample_topic_relation}

    WHERE
        topic_id IN (
            1211,
            1207,
            2910
        )

    GROUP BY
        topic_id

    ORDER BY
        works DESC
    """
).fetchall()


if not rows:

    print(
        "❌ Ninguno de los tres "
        "subfield IDs apareció."
    )

else:

    for row in rows:

        topic_id = int(
            row[0]
        )

        print()

        print(
            f"{topic_id} — "
            f"{SUBFIELDS.get(topic_id)}"
        )

        print(
            f"  relaciones: "
            f"{row[1]:,}"
        )

        print(
            f"  works únicos: "
            f"{row[2]:,}"
        )

        print(
            f"  score medio: "
            f"{row[3]:.4f}"
        )

        print(
            f"  score máximo: "
            f"{row[4]:.4f}"
        )


print()
print(
    "10 ejemplos con 1211:"
)


examples = con.execute(
    f"""
    SELECT
        work_id,
        topic_id,
        score

    FROM {sample_topic_relation}

    WHERE
        topic_id = 1211

    LIMIT 10
    """
).fetchall()


for row in examples:
    print(row)


# =========================================================
# 2. CONCEPTS / MAIN
# =========================================================

concept_files = discover(
    "data/concepts/main"
)

print_schema(
    "CONCEPTS / MAIN",
    concept_files
)


concept_relation = relation(
    concept_files
)


print()
print("=" * 78)
print("CONCEPTOS FILOSÓFICOS")
print("=" * 78)


concepts = con.execute(
    f"""
    SELECT
        concept_id,
        display_name,
        level,
        works_count,
        cited_by_count

    FROM {concept_relation}

    WHERE
        lower(display_name)
            LIKE '%philosoph%'

        OR lower(display_name)
            IN (
                'metaphysics',
                'epistemology',
                'ethics',
                'aesthetics',
                'phenomenology',
                'existentialism',
                'logic',
                'ontology',
                'political philosophy'
            )

    ORDER BY
        level,
        works_count DESC

    LIMIT 100
    """
).fetchall()


for row in concepts:

    print(
        f"{row[0]:12}  "
        f"level={str(row[2]):4}  "
        f"works={int(row[3] or 0):10,}  "
        f"{row[1]}"
    )


philosophy = con.execute(
    f"""
    SELECT
        concept_id,
        display_name,
        level,
        works_count

    FROM {concept_relation}

    WHERE
        lower(display_name)
        = 'philosophy'

    ORDER BY
        level

    LIMIT 1
    """
).fetchone()


# =========================================================
# 3. WORKS / CONCEPTS
# =========================================================

work_concept_files = discover(
    "data/works/concepts"
)

print_schema(
    "WORKS / CONCEPTS",
    work_concept_files
)


if philosophy:

    philosophy_id = int(
        philosophy[0]
    )


    print()
    print("=" * 78)
    print("PHILOSOPHY CONCEPT")
    print("=" * 78)

    print(
        "concept_id:",
        philosophy_id
    )

    print(
        "display_name:",
        philosophy[1]
    )

    print(
        "level:",
        philosophy[2]
    )

    print(
        "works_count:",
        f"{int(philosophy[3] or 0):,}"
    )


    sample_concepts = spread_sample(
        work_concept_files,
        20
    )

    sample_concept_relation = relation(
        sample_concepts
    )


    schema = con.execute(
        f"""
        DESCRIBE
        SELECT *
        FROM {sample_concept_relation}
        """
    ).fetchall()


    columns = {
        row[0]
        for row in schema
    }


    if {
        "work_id",
        "concept_id"
    }.issubset(
        columns
    ):

        score_select = (
            "avg(score), max(score)"
            if "score" in columns
            else "NULL, NULL"
        )


        stats = con.execute(
            f"""
            SELECT
                count(*) AS rows,

                count(
                    DISTINCT work_id
                ) AS works,

                {score_select}

            FROM {sample_concept_relation}

            WHERE
                concept_id = ?
            """,
            [
                philosophy_id
            ]
        ).fetchone()


        print()
        print(
            "MUESTRA DISTRIBUIDA "
            "WORKS/CONCEPTS"
        )

        print(
            "Relaciones Philosophy:",
            f"{stats[0]:,}"
        )

        print(
            "Works únicos:",
            f"{stats[1]:,}"
        )

        if (
            stats[2]
            is not None
        ):

            print(
                "Score medio:",
                f"{stats[2]:.4f}"
            )

            print(
                "Score máximo:",
                f"{stats[3]:.4f}"
            )


    else:

        print()
        print(
            "⚠️ works/concepts no tiene "
            "work_id + concept_id como "
            "esperábamos."
        )

else:

    print()
    print(
        "❌ No encontré el concepto "
        "exacto Philosophy."
    )


print()
print("=" * 78)
print("FIN DEL DIAGNÓSTICO")
print("=" * 78)

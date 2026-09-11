import ast
import time
from pathlib import Path
from urllib.parse import quote

import duckdb

from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile


REPO_ID = "Mearman/OpenAlex"
SAMPLE_SHARDS = 20

SOURCE_SCRIPT = Path(
    "scripts/openalex/sample_philosophy_concept_records.py"
)

OUTPUT = Path(
    "artifacts/openalex/"
    "philosophy-subfield-corroboration.parquet"
)


PHILOSOPHY_SUBFIELD = 1211

HPS_SUBFIELD = 1207

ETHICS_LEGAL_SUBFIELD = 2910


# ============================================================
# Leer conceptos ancla actuales
# ============================================================

tree = ast.parse(
    SOURCE_SCRIPT.read_text(
        encoding="utf-8"
    )
)

sets = {}

for node in tree.body:

    if not isinstance(
        node,
        ast.Assign
    ):
        continue

    for target in node.targets:

        if (
            isinstance(
                target,
                ast.Name
            )
            and target.id in {
                "STRONG_NAMES",
                "BROAD_NAMES",
            }
        ):

            sets[target.id] = (
                ast.literal_eval(
                    node.value
                )
            )


strong_names = (
    sets["STRONG_NAMES"]
    -
    sets["BROAD_NAMES"]
)


# ============================================================
# Infraestructura
# ============================================================

api = HfApi()

con = duckdb.connect(
    "/tmp/openalex-subfield-corroboration.duckdb"
)

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

for sql in [
    "SET http_retries = 3",
    "SET http_timeout = 60000",
]:

    try:
        con.execute(sql)

    except Exception:
        pass


def discover(path):

    return [
        entry
        for entry
        in api.list_repo_tree(
            repo_id=REPO_ID,
            repo_type="dataset",
            path_in_repo=path,
            recursive=True,
            expand=False,
            revision="main",
            token=False,
        )
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


def relation(entry):

    value = remote_url(
        entry
    ).replace(
        "'",
        "''"
    )

    return (
        f"read_parquet('{value}')"
    )


def relation_many(entries):

    values = ", ".join(
        "'"
        +
        remote_url(
            entry
        ).replace(
            "'",
            "''"
        )
        +
        "'"

        for entry in entries
    )

    return (
        f"read_parquet([{values}])"
    )


def basename(entry):

    return Path(
        entry.path
    ).name


def spread(values, count):

    values = sorted(
        values
    )

    if len(values) <= count:
        return values

    indexes = []

    for i in range(count):

        index = round(
            i
            *
            (
                len(values) - 1
            )
            /
            (
                count - 1
            )
        )

        if index not in indexes:
            indexes.append(
                index
            )

    return [
        values[index]
        for index in indexes
    ]


# ============================================================
# Resolver concept IDs
# ============================================================

concept_main_files = discover(
    "data/concepts/main"
)

concept_main = relation_many(
    concept_main_files
)


names_sql = ", ".join(
    "'"
    +
    name.replace(
        "'",
        "''"
    )
    +
    "'"

    for name in sorted(
        strong_names
    )
)


concept_rows = con.execute(
    f"""
    SELECT
        concept_id,
        display_name

    FROM {concept_main}

    WHERE
        lower(display_name)
        IN ({names_sql})
    """
).fetchall()


concept_names = {
    int(concept_id):
        display_name

    for concept_id, display_name
    in concept_rows
}


concept_ids_sql = ", ".join(
    str(value)

    for value in sorted(
        concept_names
    )
)


philosophy_row = con.execute(
    f"""
    SELECT
        concept_id

    FROM {concept_main}

    WHERE
        lower(display_name)
        = 'philosophy'

    LIMIT 1
    """
).fetchone()


if not philosophy_row:

    raise SystemExit(
        "❌ No encontré Philosophy"
    )


generic_philosophy_id = int(
    philosophy_row[0]
)


print("=" * 78)
print("OPENALEX PHILOSOPHY SUBFIELD CORROBORATION")
print("=" * 78)

print(
    "Conceptos ancla:",
    len(concept_names)
)

print(
    "Philosophy concept:",
    generic_philosophy_id
)

print(
    "Philosophy subfield:",
    PHILOSOPHY_SUBFIELD
)

print(
    "HPS subfield:",
    HPS_SUBFIELD
)

print(
    "Ethics/legal subfield:",
    ETHICS_LEGAL_SUBFIELD
)


# ============================================================
# Alinear concepts + topics + main
# ============================================================

concept_files = discover(
    "data/works/concepts"
)

topic_files = discover(
    "data/works/topics"
)

main_files = discover(
    "data/works/main"
)


concept_by_key = {
    basename(entry):
        entry

    for entry in concept_files
}


topic_by_key = {
    basename(entry):
        entry

    for entry in topic_files
}


main_by_key = {
    basename(entry):
        entry

    for entry in main_files
}


aligned = sorted(
    set(concept_by_key)
    &
    set(topic_by_key)
    &
    set(main_by_key)
)


selected = spread(
    aligned,
    SAMPLE_SHARDS
)


print()
print("=" * 78)
print("SHARDS")
print("=" * 78)

print(
    "concepts:",
    f"{len(concept_files):,}"
)

print(
    "topics:",
    f"{len(topic_files):,}"
)

print(
    "main:",
    f"{len(main_files):,}"
)

print(
    "alineados:",
    f"{len(aligned):,}"
)

print(
    "seleccionados:",
    len(selected)
)


# ============================================================
# Resultado
# ============================================================

con.execute(
    """
    CREATE TABLE corroboration (
        work_id BIGINT,

        primary_concept_id BIGINT,
        concept_score DOUBLE,
        philosophy_concept_count BIGINT,

        generic_philosophy_score DOUBLE,

        philosophy_topic_count BIGINT,
        philosophy_topic_max_score DOUBLE,

        hps_topic_count BIGINT,
        hps_topic_max_score DOUBLE,

        ethics_legal_topic_count BIGINT,
        ethics_legal_topic_max_score DOUBLE,

        title VARCHAR,
        publication_year BIGINT,
        language VARCHAR,
        type VARCHAR
    )
    """
)


start = time.time()


for number, shard_key in enumerate(
    selected,
    start=1
):

    concepts = relation(
        concept_by_key[
            shard_key
        ]
    )

    topics = relation(
        topic_by_key[
            shard_key
        ]
    )

    main = relation(
        main_by_key[
            shard_key
        ]
    )


    con.execute(
        "DROP TABLE IF EXISTS "
        "shard_candidates"
    )


    # --------------------------------------------------------
    # Conceptos específicos
    # --------------------------------------------------------

    con.execute(
        f"""
        CREATE TEMP TABLE
        shard_candidates AS

        WITH hits AS (

            SELECT
                work_id,
                concept_id,
                score

            FROM {concepts}

            WHERE
                concept_id IN (
                    {concept_ids_sql}
                )
        ),

        aggregated AS (

            SELECT
                work_id,

                arg_max(
                    concept_id,
                    score
                )
                    AS primary_concept_id,

                max(score)
                    AS concept_score,

                count(
                    DISTINCT concept_id
                )
                    AS philosophy_concept_count

            FROM hits

            GROUP BY
                work_id
        )

        SELECT
            a.work_id,
            a.primary_concept_id,
            a.concept_score,
            a.philosophy_concept_count,

            coalesce(
                m.title,
                m.display_name
            )
                AS title,

            m.publication_year,
            m.language,
            m.type

        FROM aggregated a

        JOIN {main} m
            ON m.work_id =
               a.work_id

        WHERE
            coalesce(
                m.is_retracted,
                false
            ) = false
        """
    )


    # --------------------------------------------------------
    # Concepto genérico Philosophy
    # --------------------------------------------------------

    con.execute(
        "DROP TABLE IF EXISTS "
        "shard_generic"
    )


    con.execute(
        f"""
        CREATE TEMP TABLE
        shard_generic AS

        SELECT
            wc.work_id,

            max(
                wc.score
            )
                AS generic_philosophy_score

        FROM {concepts} wc

        JOIN shard_candidates c
            ON c.work_id =
               wc.work_id

        WHERE
            wc.concept_id =
            {generic_philosophy_id}

        GROUP BY
            wc.work_id
        """
    )


    # --------------------------------------------------------
    # works/topics en este mirror contiene subfield IDs.
    #
    # Contamos presencia y score máximo para:
    #   1211 Philosophy
    #   1207 History and Philosophy of Science
    #   2910 Issues, ethics and legal aspects
    # --------------------------------------------------------

    con.execute(
        "DROP TABLE IF EXISTS "
        "shard_topics"
    )


    con.execute(
        f"""
        CREATE TEMP TABLE
        shard_topics AS

        SELECT
            wt.work_id,

            count(*)
                FILTER (
                    WHERE
                        wt.topic_id =
                        {PHILOSOPHY_SUBFIELD}
                )
                AS philosophy_topic_count,

            max(
                wt.score
            )
                FILTER (
                    WHERE
                        wt.topic_id =
                        {PHILOSOPHY_SUBFIELD}
                )
                AS philosophy_topic_max_score,


            count(*)
                FILTER (
                    WHERE
                        wt.topic_id =
                        {HPS_SUBFIELD}
                )
                AS hps_topic_count,

            max(
                wt.score
            )
                FILTER (
                    WHERE
                        wt.topic_id =
                        {HPS_SUBFIELD}
                )
                AS hps_topic_max_score,


            count(*)
                FILTER (
                    WHERE
                        wt.topic_id =
                        {ETHICS_LEGAL_SUBFIELD}
                )
                AS ethics_legal_topic_count,

            max(
                wt.score
            )
                FILTER (
                    WHERE
                        wt.topic_id =
                        {ETHICS_LEGAL_SUBFIELD}
                )
                AS ethics_legal_topic_max_score

        FROM {topics} wt

        JOIN shard_candidates c
            ON c.work_id =
               wt.work_id

        WHERE
            wt.topic_id IN (
                {PHILOSOPHY_SUBFIELD},
                {HPS_SUBFIELD},
                {ETHICS_LEGAL_SUBFIELD}
            )

        GROUP BY
            wt.work_id
        """
    )


    con.execute(
        """
        INSERT INTO corroboration

        SELECT
            c.work_id,

            c.primary_concept_id,
            c.concept_score,
            c.philosophy_concept_count,

            g.generic_philosophy_score,

            coalesce(
                t.philosophy_topic_count,
                0
            ),

            t.philosophy_topic_max_score,

            coalesce(
                t.hps_topic_count,
                0
            ),

            t.hps_topic_max_score,

            coalesce(
                t.ethics_legal_topic_count,
                0
            ),

            t.ethics_legal_topic_max_score,

            c.title,
            c.publication_year,
            c.language,
            c.type

        FROM shard_candidates c

        LEFT JOIN shard_generic g
            ON g.work_id =
               c.work_id

        LEFT JOIN shard_topics t
            ON t.work_id =
               c.work_id
        """
    )


    shard_count = con.execute(
        """
        SELECT count(*)
        FROM shard_candidates
        """
    ).fetchone()[0]


    total = con.execute(
        """
        SELECT count(*)
        FROM corroboration
        """
    ).fetchone()[0]


    print(
        f"[{number:2}/{len(selected):2}] "
        f"candidatos={shard_count:,} "
        f"total={total:,} "
        f"tiempo={time.time() - start:.1f}s"
    )


# ============================================================
# Resumen
# ============================================================

total = con.execute(
    """
    SELECT count(*)
    FROM corroboration
    """
).fetchone()[0]


print()
print("=" * 78)
print("CORROBORACIÓN POR SUBFIELD")
print("=" * 78)


summary = con.execute(
    """
    SELECT

        count(*)
            FILTER (
                WHERE
                    philosophy_topic_count > 0
            ),

        count(*)
            FILTER (
                WHERE
                    hps_topic_count > 0
            ),

        count(*)
            FILTER (
                WHERE
                    ethics_legal_topic_count > 0
            ),

        count(*)
            FILTER (
                WHERE
                    philosophy_topic_count > 0
                    OR hps_topic_count > 0
                    OR ethics_legal_topic_count > 0
            ),

        count(*)
            FILTER (
                WHERE
                    philosophy_topic_count = 0
                    AND hps_topic_count = 0
                    AND ethics_legal_topic_count = 0
            )

    FROM corroboration
    """
).fetchone()


labels = [
    (
        "Con Philosophy 1211",
        summary[0],
    ),
    (
        "Con HPS 1207",
        summary[1],
    ),
    (
        "Con ethics/legal 2910",
        summary[2],
    ),
    (
        "Con alguna corroboración",
        summary[3],
    ),
    (
        "Sin corroboración",
        summary[4],
    ),
]


for label, count in labels:

    print(
        f"{label:28} "
        f"{count:8,}  "
        f"{count / max(total, 1) * 100:5.1f}%"
    )


# ============================================================
# Combinaciones útiles
# ============================================================

print()
print("=" * 78)
print("COMBINACIONES")
print("=" * 78)


combinations = con.execute(
    """
    SELECT

        CASE

            WHEN
                philosophy_topic_count > 0
                AND
                generic_philosophy_score
                >= 0.30

                THEN
                '1211 + Philosophy>=.30'

            WHEN
                philosophy_topic_count > 0

                THEN
                '1211 solamente'

            WHEN
                (
                    hps_topic_count > 0
                    OR
                    ethics_legal_topic_count > 0
                )
                AND
                generic_philosophy_score
                >= 0.30

                THEN
                'adjacent + Philosophy>=.30'

            WHEN
                hps_topic_count > 0
                OR
                ethics_legal_topic_count > 0

                THEN
                'adjacent solamente'

            WHEN
                generic_philosophy_score
                >= 0.30

                THEN
                'Philosophy>=.30 solamente'

            ELSE
                'sin señal adicional'

        END AS bucket,

        count(*)
            AS n

    FROM corroboration

    GROUP BY
        bucket

    ORDER BY
        n DESC
    """
).fetchall()


for bucket, count in combinations:

    print(
        f"{bucket:30} "
        f"{count:8,}  "
        f"{count / max(total, 1) * 100:5.1f}%"
    )


# ============================================================
# Estadísticas por concepto
# ============================================================

print()
print("=" * 78)
print("TOP CONCEPTOS + SUBFIELD 1211")
print("=" * 78)


by_concept = con.execute(
    """
    SELECT
        primary_concept_id,

        count(*)
            AS total,

        count(*)
            FILTER (
                WHERE
                    philosophy_topic_count > 0
            )
            AS with_1211,

        count(*)
            FILTER (
                WHERE
                    generic_philosophy_score
                    >= 0.30
            )
            AS with_generic,

        avg(
            concept_score
        )
            AS mean_score

    FROM corroboration

    GROUP BY
        primary_concept_id

    ORDER BY
        total DESC

    LIMIT 35
    """
).fetchall()


for row in by_concept:

    concept_id = int(
        row[0]
    )

    total_concept = int(
        row[1]
    )

    with_1211 = int(
        row[2]
    )

    with_generic = int(
        row[3]
    )

    print(
        f"{concept_names.get(concept_id, '?')[:34]:34} "
        f"n={total_concept:5,}  "
        f"1211={with_1211:5,} "
        f"({with_1211 / max(total_concept, 1) * 100:5.1f}%)  "
        f"generic={with_generic:5,} "
        f"mean={row[4]:.3f}"
    )


# ============================================================
# Ejemplos
# ============================================================

ambiguous_names = {
    "Phenomenology (philosophy)",
    "Existentialism",
    "Philosophy of medicine",
    "Philosophy of biology",
    "Philosophy of computer science",
    "Philosophy of technology",
    "Environmental philosophy",
    "Applied philosophy",
    "Social philosophy",
}


ambiguous_ids = [
    concept_id

    for concept_id, name
    in concept_names.items()

    if name in ambiguous_names
]


ambiguous_sql = (
    ", ".join(
        str(value)
        for value in ambiguous_ids
    )
    or "-1"
)


def show_examples(
    where_sql,
    label,
    limit=25,
):

    print()
    print("=" * 78)
    print(label)
    print("=" * 78)


    rows = con.execute(
        f"""
        SELECT
            concept_score,
            philosophy_concept_count,

            primary_concept_id,

            generic_philosophy_score,

            philosophy_topic_count,
            philosophy_topic_max_score,

            hps_topic_count,
            ethics_legal_topic_count,

            publication_year,
            language,
            title

        FROM corroboration

        WHERE
            {where_sql}

        ORDER BY
            hash(work_id)

        LIMIT {limit}
        """
    ).fetchall()


    for row in rows:

        concept = concept_names.get(
            int(row[2]),
            "?"
        )

        generic = (
            "—"
            if row[3] is None
            else f"{row[3]:.3f}"
        )

        topic_score = (
            "—"
            if row[5] is None
            else f"{row[5]:.3f}"
        )

        title = " ".join(
            str(
                row[10]
                or "(sin título)"
            ).split()
        )


        print()

        print(
            f"concept={row[0]:.3f}  "
            f"n={row[1]}  "
            f"generic={generic}"
        )

        print(
            f"1211={row[4]} "
            f"score={topic_score}  "
            f"1207={row[6]}  "
            f"2910={row[7]}"
        )

        print(
            "ANCLA:",
            concept
        )

        print(
            "TÍTULO:",
            title[:190]
        )


show_examples(
    f"""
    primary_concept_id IN (
        {ambiguous_sql}
    )

    AND
        concept_score >= 0.50

    AND
        philosophy_topic_count > 0
    """,
    "AMBIGUOS ALTOS + SUBFIELD 1211"
)


show_examples(
    f"""
    primary_concept_id IN (
        {ambiguous_sql}
    )

    AND
        concept_score >= 0.50

    AND
        philosophy_topic_count = 0
    """,
    "AMBIGUOS ALTOS SIN SUBFIELD 1211"
)


show_examples(
    """
    concept_score < 0.30

    AND
        philosophy_topic_count > 0
    """,
    "SCORE BAJO + SUBFIELD 1211"
)


show_examples(
    """
    philosophy_topic_count = 0

    AND
        hps_topic_count = 0

    AND
        ethics_legal_topic_count = 0

    AND
        generic_philosophy_score >= 0.50
    """,
    "SIN SUBFIELD PERO PHILOSOPHY GENÉRICO ALTO"
)


# ============================================================
# Guardar
# ============================================================

OUTPUT.parent.mkdir(
    parents=True,
    exist_ok=True
)


safe_output = str(
    OUTPUT
).replace(
    "'",
    "''"
)


con.execute(
    f"""
    COPY (
        SELECT *
        FROM corroboration
    )

    TO '{safe_output}'
    (
        FORMAT PARQUET,
        COMPRESSION ZSTD
    )
    """
)


print()
print("=" * 78)
print("ARCHIVO")
print("=" * 78)

print(
    OUTPUT,
    f"{OUTPUT.stat().st_size / 1024**2:.2f} MiB"
)

print()
print("=" * 78)
print("FIN")
print("=" * 78)

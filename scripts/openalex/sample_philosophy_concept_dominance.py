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
    "philosophy-concept-dominance.parquet"
)


# ============================================================
# Recuperar nuestros conjuntos actuales sin ejecutar el script
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
            and target.id
            in {
                "STRONG_NAMES",
                "BROAD_NAMES",
            }
        ):

            sets[target.id] = (
                ast.literal_eval(
                    node.value
                )
            )


broad_names = sets[
    "BROAD_NAMES"
]

strong_names = (
    sets["STRONG_NAMES"]
    -
    broad_names
)


# ============================================================
# DuckDB + Hugging Face
# ============================================================

api = HfApi()

con = duckdb.connect(
    "/tmp/openalex-philosophy-dominance.duckdb"
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
# Concept dictionary
# ============================================================

concept_main_files = discover(
    "data/concepts/main"
)

concept_main = relation_many(
    concept_main_files
)


strong_sql = ", ".join(
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
        IN ({strong_sql})
    """
).fetchall()


concept_names = {
    int(concept_id):
        display_name

    for concept_id, display_name
    in concept_rows
}


concept_ids = sorted(
    concept_names
)


concept_ids_sql = ", ".join(
    str(value)
    for value in concept_ids
)


broad_sql = ", ".join(
    "'"
    +
    name.replace(
        "'",
        "''"
    )
    +
    "'"

    for name in sorted(
        broad_names
    )
)


broad_rows = con.execute(
    f"""
    SELECT
        concept_id,
        display_name

    FROM {concept_main}

    WHERE
        lower(display_name)
        IN ({broad_sql})
    """
).fetchall()


broad_ids = sorted(
    int(concept_id)

    for concept_id, _
    in broad_rows
)


broad_ids_sql = (
    ", ".join(
        str(value)
        for value in broad_ids
    )
    or "-1"
)


philosophy_row = con.execute(
    f"""
    SELECT
        concept_id,
        display_name

    FROM {concept_main}

    WHERE
        lower(display_name)
        = 'philosophy'

    LIMIT 1
    """
).fetchone()


if not philosophy_row:

    raise SystemExit(
        "❌ No encontré el concepto Philosophy"
    )


generic_philosophy_id = int(
    philosophy_row[0]
)


print("=" * 78)
print("OPENALEX PHILOSOPHY CONCEPT DOMINANCE")
print("=" * 78)

print(
    "Conceptos ancla:",
    len(concept_ids)
)

print(
    "Conceptos amplios:",
    len(broad_ids)
)

print(
    "Concepto genérico Philosophy:",
    generic_philosophy_id
)


# ============================================================
# Shards
# ============================================================

concept_files = discover(
    "data/works/concepts"
)

main_files = discover(
    "data/works/main"
)


concept_by_key = {
    basename(entry):
        entry

    for entry in concept_files
}

main_by_key = {
    basename(entry):
        entry

    for entry in main_files
}


aligned = sorted(
    set(concept_by_key)
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
    "works/concepts:",
    f"{len(concept_files):,}"
)

print(
    "works/main:",
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
# Tabla final
# ============================================================

con.execute(
    """
    CREATE TABLE dominance (
        work_id BIGINT,

        primary_concept_id BIGINT,
        philosophy_score DOUBLE,
        philosophy_concept_count BIGINT,

        philosophy_rank BIGINT,

        generic_philosophy_score DOUBLE,
        broad_philosophy_score DOUBLE,

        top_overall_concept_id BIGINT,
        top_overall_score DOUBLE,

        top_competitor_concept_id BIGINT,
        top_competitor_score DOUBLE,

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
    # Primero identificar candidatos filosóficos
    # --------------------------------------------------------

    con.execute(
        f"""
        CREATE TEMP TABLE
        shard_candidates AS

        WITH phil_hits AS (

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

        phil AS (

            SELECT
                work_id,

                arg_max(
                    concept_id,
                    score
                )
                    AS primary_concept_id,

                max(score)
                    AS philosophy_score,

                count(
                    DISTINCT concept_id
                )
                    AS philosophy_concept_count

            FROM phil_hits

            GROUP BY
                work_id
        )

        SELECT
            p.work_id,
            p.primary_concept_id,
            p.philosophy_score,
            p.philosophy_concept_count,

            coalesce(
                m.title,
                m.display_name
            )
                AS title,

            m.publication_year,
            m.language,
            m.type

        FROM phil p

        JOIN {main} m
            ON m.work_id =
               p.work_id

        WHERE
            coalesce(
                m.is_retracted,
                false
            ) = false
        """
    )


    # --------------------------------------------------------
    # Volver a TODOS los conceptos de esos candidatos.
    #
    # philosophy_rank = cuántos conceptos tienen score mayor
    # que nuestra mejor señal filosófica + 1.
    # --------------------------------------------------------

    con.execute(
        f"""
        INSERT INTO dominance

        SELECT
            c.work_id,

            c.primary_concept_id,
            c.philosophy_score,
            c.philosophy_concept_count,

            1
            +
            sum(
                CASE

                    WHEN
                        wc.score
                        >
                        c.philosophy_score

                    THEN 1

                    ELSE 0

                END
            )
                AS philosophy_rank,


            max(
                CASE

                    WHEN
                        wc.concept_id
                        =
                        {generic_philosophy_id}

                    THEN wc.score

                    ELSE NULL

                END
            )
                AS generic_philosophy_score,


            max(
                CASE

                    WHEN
                        wc.concept_id
                        IN (
                            {broad_ids_sql}
                        )

                    THEN wc.score

                    ELSE NULL

                END
            )
                AS broad_philosophy_score,


            arg_max(
                wc.concept_id,
                wc.score
            )
                AS top_overall_concept_id,


            max(
                wc.score
            )
                AS top_overall_score,


            arg_max(
                wc.concept_id,
                wc.score
            )
                FILTER (
                    WHERE

                        wc.concept_id
                        NOT IN (
                            {concept_ids_sql}
                        )

                        AND
                        wc.concept_id
                        NOT IN (
                            {broad_ids_sql}
                        )

                        AND
                        wc.concept_id
                        <>
                        {generic_philosophy_id}
                )
                AS top_competitor_concept_id,


            max(
                wc.score
            )
                FILTER (
                    WHERE

                        wc.concept_id
                        NOT IN (
                            {concept_ids_sql}
                        )

                        AND
                        wc.concept_id
                        NOT IN (
                            {broad_ids_sql}
                        )

                        AND
                        wc.concept_id
                        <>
                        {generic_philosophy_id}
                )
                AS top_competitor_score,


            c.title,
            c.publication_year,
            c.language,
            c.type

        FROM shard_candidates c

        JOIN {concepts} wc
            ON wc.work_id =
               c.work_id

        GROUP BY
            c.work_id,
            c.primary_concept_id,
            c.philosophy_score,
            c.philosophy_concept_count,
            c.title,
            c.publication_year,
            c.language,
            c.type
        """
    )


    total = con.execute(
        """
        SELECT count(*)
        FROM dominance
        """
    ).fetchone()[0]


    shard_count = con.execute(
        """
        SELECT count(*)
        FROM shard_candidates
        """
    ).fetchone()[0]


    print(
        f"[{number:2}/{len(selected):2}] "
        f"candidatos={shard_count:,} "
        f"total={total:,} "
        f"tiempo={time.time() - start:.1f}s"
    )


# ============================================================
# Tabla pequeña de nombres para diagnóstico
# ============================================================

con.execute(
    f"""
    CREATE TEMP TABLE concept_labels AS

    SELECT
        concept_id,
        display_name

    FROM {concept_main}
    """
)


total = con.execute(
    """
    SELECT count(*)
    FROM dominance
    """
).fetchone()[0]


# ============================================================
# Distribución del rank
# ============================================================

print()
print("=" * 78)
print("DISTRIBUCIÓN DE RANK FILOSÓFICO")
print("=" * 78)


rank_rows = con.execute(
    """
    SELECT

        CASE
            WHEN philosophy_rank = 1
                THEN 'rank 1'

            WHEN philosophy_rank = 2
                THEN 'rank 2'

            WHEN philosophy_rank = 3
                THEN 'rank 3'

            WHEN philosophy_rank
                BETWEEN 4 AND 5
                THEN 'rank 4-5'

            WHEN philosophy_rank
                BETWEEN 6 AND 10
                THEN 'rank 6-10'

            ELSE 'rank >10'
        END
            AS bucket,

        count(*)
            AS n

    FROM dominance

    GROUP BY
        bucket

    ORDER BY

        CASE bucket
            WHEN 'rank 1' THEN 1
            WHEN 'rank 2' THEN 2
            WHEN 'rank 3' THEN 3
            WHEN 'rank 4-5' THEN 4
            WHEN 'rank 6-10' THEN 5
            ELSE 6
        END
    """
).fetchall()


for bucket, count in rank_rows:

    print(
        f"{bucket:12} "
        f"{count:9,}  "
        f"{count / max(total, 1) * 100:5.1f}%"
    )


# ============================================================
# Concepto genérico Philosophy como apoyo
# ============================================================

print()
print("=" * 78)
print("GENERIC PHILOSOPHY")
print("=" * 78)


generic_rows = con.execute(
    """
    SELECT

        count(*)
            FILTER (
                WHERE
                    generic_philosophy_score
                    IS NOT NULL
            ),

        count(*)
            FILTER (
                WHERE
                    generic_philosophy_score
                    >= 0.50
            ),

        count(*)
            FILTER (
                WHERE
                    generic_philosophy_score
                    >= 0.30
            )

    FROM dominance
    """
).fetchone()


print(
    "Con Philosophy:",
    f"{generic_rows[0]:,}"
)

print(
    "Philosophy >=0.50:",
    f"{generic_rows[1]:,}"
)

print(
    "Philosophy >=0.30:",
    f"{generic_rows[2]:,}"
)


# ============================================================
# Muestras
# ============================================================

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
            d.philosophy_score,
            d.philosophy_concept_count,
            d.philosophy_rank,

            d.generic_philosophy_score,
            d.broad_philosophy_score,

            d.primary_concept_id,

            d.top_competitor_score,
            cl.display_name,

            d.publication_year,
            d.language,
            d.title

        FROM dominance d

        LEFT JOIN concept_labels cl
            ON cl.concept_id =
               d.top_competitor_concept_id

        WHERE
            {where_sql}

        ORDER BY
            hash(d.work_id)

        LIMIT {limit}
        """
    ).fetchall()


    for row in rows:

        concept = concept_names.get(
            int(row[5]),
            "?"
        )

        title = " ".join(
            str(
                row[10]
                or "(sin título)"
            ).split()
        )

        generic = (
            "—"
            if row[3] is None
            else f"{row[3]:.3f}"
        )

        broad = (
            "—"
            if row[4] is None
            else f"{row[4]:.3f}"
        )

        competitor_score = (
            "—"
            if row[6] is None
            else f"{row[6]:.3f}"
        )

        competitor_name = (
            row[7]
            or "—"
        )


        print()

        print(
            f"phil={row[0]:.3f}  "
            f"n={row[1]}  "
            f"rank={row[2]}  "
            f"generic={generic}  "
            f"broad={broad}"
        )

        print(
            "ANCLA:",
            concept
        )

        print(
            "COMPETIDOR:",
            competitor_score,
            competitor_name
        )

        print(
            "TÍTULO:",
            title[:180]
        )


# Fenomenología, existencialismo y filosofías aplicadas:
# aquí esperamos ver claramente dominios competidores.

show_examples(
    """
    primary_concept_id IN (
        84269361,
        127882523,
        121242521,
        180182882
    )
    AND philosophy_score >= 0.50
    """,
    "AMBIGUOS CON SCORE ALTO"
)


# Casos que el score solo habría castigado,
# pero donde filosofía puede ser uno de los conceptos dominantes.

show_examples(
    """
    philosophy_rank <= 2
    AND philosophy_score < 0.30
    """,
    "SCORE BAJO PERO RANK 1-2"
)


# Casos peligrosos:
# score filosófico aparentemente alto,
# pero muchos conceptos lo superan.

show_examples(
    """
    philosophy_rank >= 6
    AND philosophy_score >= 0.50
    """,
    "SCORE ALTO PERO RANK >=6"
)


# Ver si el concepto genérico Philosophy sirve
# como corroboración independiente.

show_examples(
    """
    generic_philosophy_score >= 0.30
    AND philosophy_score < 0.50
    """,
    "PHILOSOPHY GENÉRICO COMO APOYO"
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
        FROM dominance
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

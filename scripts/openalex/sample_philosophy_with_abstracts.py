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


# ============================================================
# Leer STRONG_NAMES y BROAD_NAMES sin ejecutar el script
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


print("=" * 78)
print("OPENALEX PHILOSOPHY + ABSTRACT AUDIT")
print("=" * 78)

print(
    "Conceptos ancla:",
    len(strong_names)
)


# ============================================================
# DuckDB + Hugging Face
# ============================================================

api = HfApi()

con = duckdb.connect(
    "/tmp/openalex-philosophy-abstract-audit.duckdb"
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
        for entry in api.list_repo_tree(
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


def basename(entry):

    return Path(
        entry.path
    ).name


def url(entry):

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

    value = url(
        entry
    ).replace(
        "'",
        "''"
    )

    return (
        f"read_parquet('{value}')"
    )


def relation_many(entries):

    urls = [
        url(entry)
        for entry in entries
    ]

    values = ", ".join(
        "'"
        +
        value.replace(
            "'",
            "''"
        )
        +
        "'"
        for value in urls
    )

    return (
        f"read_parquet([{values}])"
    )


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


print(
    "Conceptos resueltos:",
    len(concept_names)
)


# ============================================================
# Alinear tres familias de shards
# ============================================================

concept_files = discover(
    "data/works/concepts"
)

main_files = discover(
    "data/works/main"
)

abstract_files = discover(
    "data/works/abstracts"
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

abstract_by_key = {
    basename(entry):
        entry
    for entry in abstract_files
}


aligned = sorted(
    set(concept_by_key)
    &
    set(main_by_key)
    &
    set(abstract_by_key)
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
    "main:",
    f"{len(main_files):,}"
)

print(
    "abstracts:",
    f"{len(abstract_files):,}"
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
# Resultados
# ============================================================

con.execute(
    """
    CREATE TABLE audit (
        work_id BIGINT,

        primary_concept_id BIGINT,
        concept_score DOUBLE,
        philosophy_concept_count BIGINT,

        title VARCHAR,
        publication_year BIGINT,
        language VARCHAR,
        type VARCHAR,

        abstract VARCHAR
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

    abstracts = relation(
        abstract_by_key[
            shard_key
        ]
    )


    # --------------------------------------------------------
    # Crear candidatos del shard localmente.
    # Esto es pequeño después del filtro conceptual.
    # --------------------------------------------------------

    con.execute(
        "DROP TABLE IF EXISTS shard_candidates"
    )


    con.execute(
        f"""
        CREATE TEMP TABLE shard_candidates AS

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


    candidate_count = con.execute(
        """
        SELECT count(*)
        FROM shard_candidates
        """
    ).fetchone()[0]


    if candidate_count == 0:

        print(
            f"[{number:2}/{len(selected):2}] "
            "candidatos=0"
        )

        continue


    # --------------------------------------------------------
    # Reconstruir sólo abstracts de candidatos.
    #
    # Cada palabra viene acompañada de todas sus posiciones.
    # UNNEST convierte esas posiciones en tokens ordenables.
    # --------------------------------------------------------

    con.execute(
        "DROP TABLE IF EXISTS shard_abstracts"
    )


    con.execute(
        f"""
        CREATE TEMP TABLE shard_abstracts AS

        WITH candidate_words AS (

            SELECT
                a.work_id,
                a.word,
                pos

            FROM {abstracts} a

            JOIN shard_candidates c
                ON c.work_id =
                   a.work_id

            CROSS JOIN
                UNNEST(
                    a.positions
                ) AS p(pos)
        )

        SELECT
            work_id,

            string_agg(
                word,
                ' '
                ORDER BY pos
            )
                AS abstract

        FROM candidate_words

        GROUP BY
            work_id
        """
    )


    con.execute(
        """
        INSERT INTO audit

        SELECT
            c.work_id,

            c.primary_concept_id,
            c.concept_score,
            c.philosophy_concept_count,

            c.title,
            c.publication_year,
            c.language,
            c.type,

            a.abstract

        FROM shard_candidates c

        LEFT JOIN shard_abstracts a
            ON a.work_id =
               c.work_id
        """
    )


    abstract_count = con.execute(
        """
        SELECT count(*)
        FROM shard_abstracts
        """
    ).fetchone()[0]


    total = con.execute(
        """
        SELECT count(*)
        FROM audit
        """
    ).fetchone()[0]


    print(
        f"[{number:2}/{len(selected):2}] "
        f"candidatos={candidate_count:,} "
        f"abstracts={abstract_count:,} "
        f"total={total:,} "
        f"tiempo={time.time() - start:.1f}s"
    )


# ============================================================
# Estadísticas de cobertura
# ============================================================

total = con.execute(
    """
    SELECT count(*)
    FROM audit
    """
).fetchone()[0]


with_abstract = con.execute(
    """
    SELECT count(*)
    FROM audit
    WHERE
        abstract IS NOT NULL
        AND length(
            trim(abstract)
        ) > 0
    """
).fetchone()[0]


print()
print("=" * 78)
print("COBERTURA ABSTRACT")
print("=" * 78)

print(
    "Candidatos:",
    f"{total:,}"
)

print(
    "Con abstract:",
    f"{with_abstract:,}"
)

print(
    "Cobertura:",
    (
        f"{with_abstract / total * 100:.1f}%"
        if total
        else "0.0%"
    )
)

print(
    "Tiempo:",
    f"{time.time() - start:.1f}s"
)


# ============================================================
# Casos ambiguos
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


ambiguous_sql = ", ".join(
    str(value)

    for value in ambiguous_ids
) or "-1"


def show_examples(
    where_sql,
    label,
    limit=20,
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

            publication_year,
            language,

            title,
            abstract

        FROM audit

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

        title = " ".join(
            str(
                row[5]
                or "(sin título)"
            ).split()
        )

        abstract = " ".join(
            str(
                row[6]
                or "(sin abstract)"
            ).split()
        )


        print()

        print(
            f"{row[0]:.3f}  "
            f"n={row[1]}  "
            f"{str(row[3] or '----')}  "
            f"{str(row[4] or '--')}  "
            f"{concept}"
        )

        print(
            "TÍTULO:",
            title[:180]
        )

        print(
            "ABSTRACT:",
            abstract[:500]
        )


show_examples(
    f"""
    primary_concept_id IN (
        {ambiguous_sql}
    )
    AND concept_score >= 0.50
    """,
    "AMBIGUOS — SCORE ALTO"
)


show_examples(
    """
    philosophy_concept_count >= 2
    AND concept_score >= 0.30
    """,
    "MULTI-CONCEPTO"
)


show_examples(
    """
    concept_score < 0.30
    AND abstract IS NOT NULL
    """,
    "SCORE BAJO CON ABSTRACT"
)


# ============================================================
# Guardar auditoría
# ============================================================

output = Path(
    "artifacts/openalex/"
    "philosophy-abstract-audit.parquet"
)

output.parent.mkdir(
    parents=True,
    exist_ok=True
)


safe_output = str(
    output
).replace(
    "'",
    "''"
)


con.execute(
    f"""
    COPY (
        SELECT *
        FROM audit
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
    output,
    f"{output.stat().st_size / 1024**2:.2f} MiB"
)

print()
print("=" * 78)
print("FIN")
print("=" * 78)

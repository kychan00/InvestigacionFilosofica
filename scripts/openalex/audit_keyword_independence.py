import ast
import re
import time
import unicodedata
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
    "philosophy-keyword-independence.parquet"
)


# ============================================================
# Ontología actual
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
# Utilidades
# ============================================================

def keyword_slug(name):

    # OpenAlex usa slugs del estilo:
    #
    # Philosophy of medicine
    # -> philosophy-of-medicine
    #
    # Phenomenology (philosophy)
    # -> phenomenology
    #
    # Functionalism (philosophy of mind)
    # -> functionalism

    value = unicodedata.normalize(
        "NFKD",
        name
    )

    value = (
        value.encode(
            "ascii",
            "ignore"
        )
        .decode(
            "ascii"
        )
        .lower()
    )

    value = re.sub(
        r"\s*\([^)]*\)\s*",
        " ",
        value
    )

    value = value.replace(
        "&",
        " and "
    )

    value = re.sub(
        r"[^a-z0-9]+",
        "-",
        value
    )

    return value.strip(
        "-"
    )


api = HfApi()

con = duckdb.connect(
    "/tmp/openalex-keyword-independence.duckdb"
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
# Resolver conceptos
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


anchor_slugs = {
    concept_id:
        keyword_slug(name)

    for concept_id, name
    in concept_names.items()
}


print("=" * 78)
print("OPENALEX KEYWORD INDEPENDENCE AUDIT")
print("=" * 78)

print(
    "Conceptos:",
    len(concept_names)
)


print()
print("ANCHOR SLUGS")
print("-" * 78)

for concept_id in sorted(
    concept_names
):

    print(
        f"{concept_id:12}  "
        f"{concept_names[concept_id]:38} "
        f"-> {anchor_slugs[concept_id]}"
    )


# Tabla de lookup para DuckDB.

con.execute(
    """
    CREATE TEMP TABLE concept_lookup (
        concept_id BIGINT,
        concept_name VARCHAR,
        anchor_slug VARCHAR
    )
    """
)


con.executemany(
    """
    INSERT INTO concept_lookup
    VALUES (?, ?, ?)
    """,
    [
        (
            concept_id,
            concept_names[
                concept_id
            ],
            anchor_slugs[
                concept_id
            ],
        )

        for concept_id
        in sorted(
            concept_names
        )
    ]
)


# ============================================================
# Shards
# ============================================================

concept_files = discover(
    "data/works/concepts"
)

keyword_files = discover(
    "data/works/keywords"
)

main_files = discover(
    "data/works/main"
)


concept_by_key = {
    basename(entry):
        entry

    for entry in concept_files
}


keyword_by_key = {
    basename(entry):
        entry

    for entry in keyword_files
}


main_by_key = {
    basename(entry):
        entry

    for entry in main_files
}


aligned = sorted(
    set(concept_by_key)
    &
    set(keyword_by_key)
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
    CREATE TABLE audit (
        work_id BIGINT,

        primary_concept_id BIGINT,
        concept_score DOUBLE,
        philosophy_concept_count BIGINT,

        anchor_slug VARCHAR,
        anchor_keyword_score DOUBLE,

        generic_philosophy_score DOUBLE,

        secondary_philosophy_score DOUBLE,
        secondary_philosophy_count BIGINT,

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

    keywords = relation(
        keyword_by_key[
            shard_key
        ]
    )

    main = relation(
        main_by_key[
            shard_key
        ]
    )


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

            l.anchor_slug,

            coalesce(
                m.title,
                m.display_name
            )
                AS title,

            m.publication_year,
            m.language,
            m.type

        FROM aggregated a

        JOIN concept_lookup l
            ON l.concept_id =
               a.primary_concept_id

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


    con.execute(
        "DROP TABLE IF EXISTS shard_keyword_stats"
    )


    con.execute(
        f"""
        CREATE TEMP TABLE shard_keyword_stats AS

        SELECT
            c.work_id,


            max(k.score)
                FILTER (
                    WHERE
                        k.keyword_id =
                        c.anchor_slug
                )
                AS anchor_keyword_score,


            max(k.score)
                FILTER (
                    WHERE
                        k.keyword_id =
                        'philosophy'
                )
                AS generic_philosophy_score,


            max(k.score)
                FILTER (
                    WHERE
                        k.keyword_id LIKE
                        '%philosoph%'

                        AND
                        k.keyword_id <>
                        c.anchor_slug

                        AND
                        k.keyword_id <>
                        'philosophy'
                )
                AS secondary_philosophy_score,


            count(*)
                FILTER (
                    WHERE
                        k.keyword_id LIKE
                        '%philosoph%'

                        AND
                        k.keyword_id <>
                        c.anchor_slug

                        AND
                        k.keyword_id <>
                        'philosophy'
                )
                AS secondary_philosophy_count


        FROM shard_candidates c

        LEFT JOIN {keywords} k
            ON k.work_id =
               c.work_id

        GROUP BY
            c.work_id
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

            c.anchor_slug,

            k.anchor_keyword_score,
            k.generic_philosophy_score,

            k.secondary_philosophy_score,

            coalesce(
                k.secondary_philosophy_count,
                0
            ),

            c.title,
            c.publication_year,
            c.language,
            c.type

        FROM shard_candidates c

        LEFT JOIN shard_keyword_stats k
            ON k.work_id =
               c.work_id
        """
    )


    total = con.execute(
        """
        SELECT count(*)
        FROM audit
        """
    ).fetchone()[0]


    print(
        f"[{number:2}/{len(selected):2}] "
        f"total={total:,} "
        f"tiempo={time.time() - start:.1f}s"
    )


# ============================================================
# Dependencia
# ============================================================

total = con.execute(
    """
    SELECT count(*)
    FROM audit
    """
).fetchone()[0]


stats = con.execute(
    """
    SELECT

        count(*)
            FILTER (
                WHERE
                    anchor_keyword_score
                    IS NOT NULL
            ),

        count(*)
            FILTER (
                WHERE
                    anchor_keyword_score
                    IS NOT NULL

                    AND abs(
                        anchor_keyword_score
                        -
                        concept_score
                    ) < 0.000001
            ),

        count(*)
            FILTER (
                WHERE
                    anchor_keyword_score
                    IS NOT NULL

                    AND abs(
                        anchor_keyword_score
                        -
                        concept_score
                    ) < 0.001
            ),

        count(*)
            FILTER (
                WHERE
                    anchor_keyword_score
                    IS NOT NULL

                    AND abs(
                        anchor_keyword_score
                        -
                        concept_score
                    ) < 0.01
            ),

        count(*)
            FILTER (
                WHERE
                    generic_philosophy_score
                    IS NOT NULL
            ),

        count(*)
            FILTER (
                WHERE
                    secondary_philosophy_score
                    IS NOT NULL
            ),

        count(*)
            FILTER (
                WHERE
                    generic_philosophy_score
                    IS NOT NULL

                    OR
                    secondary_philosophy_score
                    IS NOT NULL
            )

    FROM audit
    """
).fetchone()


print()
print("=" * 78)
print("DEPENDENCIA CONCEPT → KEYWORD")
print("=" * 78)


labels = [
    (
        "Con keyword del ancla",
        stats[0],
    ),
    (
        "Score idéntico <1e-6",
        stats[1],
    ),
    (
        "Score casi idéntico <.001",
        stats[2],
    ),
    (
        "Score parecido <.01",
        stats[3],
    ),
    (
        "Con keyword Philosophy",
        stats[4],
    ),
    (
        "Con otra keyword *philosoph*",
        stats[5],
    ),
    (
        "Con corroboración independiente",
        stats[6],
    ),
]


for label, count in labels:

    print(
        f"{label:34} "
        f"{int(count):8,}  "
        f"{int(count) / max(total, 1) * 100:5.1f}%"
    )


# ============================================================
# Por concepto
# ============================================================

print()
print("=" * 78)
print("DEPENDENCIA POR CONCEPTO")
print("=" * 78)


rows = con.execute(
    """
    SELECT
        primary_concept_id,

        count(*) AS n,

        count(*)
            FILTER (
                WHERE
                    anchor_keyword_score
                    IS NOT NULL
            )
            AS anchor_present,

        count(*)
            FILTER (
                WHERE
                    anchor_keyword_score
                    IS NOT NULL

                    AND abs(
                        anchor_keyword_score
                        -
                        concept_score
                    ) < 0.001
            )
            AS same_score,

        count(*)
            FILTER (
                WHERE
                    generic_philosophy_score
                    IS NOT NULL
            )
            AS generic,

        count(*)
            FILTER (
                WHERE
                    secondary_philosophy_score
                    IS NOT NULL
            )
            AS secondary

    FROM audit

    GROUP BY
        primary_concept_id

    ORDER BY
        n DESC

    LIMIT 40
    """
).fetchall()


for row in rows:

    concept_id = int(
        row[0]
    )

    n = int(
        row[1]
    )

    print(
        f"{concept_names.get(concept_id, '?')[:34]:34} "
        f"n={n:5,}  "
        f"anchor={int(row[2]):5,} "
        f"same={int(row[3]):5,} "
        f"generic={int(row[4]):5,} "
        f"secondary={int(row[5]):5,}"
    )


# ============================================================
# Casos donde V1 habría creído tener una segunda señal,
# pero sólo está viendo nuevamente el ancla.
# ============================================================

print()
print("=" * 78)
print("ANCLA DUPLICADA SIN CORROBORACIÓN INDEPENDIENTE")
print("=" * 78)


rows = con.execute(
    """
    SELECT
        primary_concept_id,
        concept_score,
        anchor_keyword_score,

        philosophy_concept_count,

        publication_year,
        language,
        title

    FROM audit

    WHERE
        anchor_keyword_score
        IS NOT NULL

        AND abs(
            anchor_keyword_score
            -
            concept_score
        ) < 0.001

        AND
            generic_philosophy_score
            IS NULL

        AND
            secondary_philosophy_score
            IS NULL

    ORDER BY
        hash(work_id)

    LIMIT 40
    """
).fetchall()


for row in rows:

    concept = concept_names.get(
        int(row[0]),
        "?"
    )

    title = " ".join(
        str(
            row[6]
            or "(sin título)"
        ).split()
    )

    print()

    print(
        f"concept={row[1]:.3f} "
        f"keyword={row[2]:.3f} "
        f"n={row[3]}"
    )

    print(
        "ANCLA:",
        concept
    )

    print(
        "TÍTULO:",
        title[:190]
    )


# ============================================================
# Casos con corroboración verdaderamente distinta
# ============================================================

print()
print("=" * 78)
print("CORROBORACIÓN INDEPENDIENTE")
print("=" * 78)


rows = con.execute(
    """
    SELECT
        primary_concept_id,
        concept_score,

        generic_philosophy_score,
        secondary_philosophy_score,

        philosophy_concept_count,

        publication_year,
        language,
        title

    FROM audit

    WHERE
        generic_philosophy_score
        IS NOT NULL

        OR
        secondary_philosophy_score
        IS NOT NULL

    ORDER BY
        hash(work_id)

    LIMIT 40
    """
).fetchall()


for row in rows:

    concept = concept_names.get(
        int(row[0]),
        "?"
    )

    generic = (
        "—"
        if row[2] is None
        else f"{row[2]:.3f}"
    )

    secondary = (
        "—"
        if row[3] is None
        else f"{row[3]:.3f}"
    )

    title = " ".join(
        str(
            row[7]
            or "(sin título)"
        ).split()
    )

    print()

    print(
        f"concept={row[1]:.3f} "
        f"generic={generic} "
        f"secondary={secondary} "
        f"n={row[4]}"
    )

    print(
        "ANCLA:",
        concept
    )

    print(
        "TÍTULO:",
        title[:190]
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
    OUTPUT,
    f"{OUTPUT.stat().st_size / 1024**2:.2f} MiB"
)

print()
print("=" * 78)
print("FIN")
print("=" * 78)

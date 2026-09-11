import json
import time
from pathlib import Path
from urllib.parse import quote

import duckdb

from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile


REPO_ID = "Mearman/OpenAlex"

SAMPLE_SHARDS = 50

SUBFIELDS = {
    1211: {
        "tier": "core",
        "name": "Philosophy",
    },
    1207: {
        "tier": "extended",
        "name": "History and Philosophy of Science",
    },
    2910: {
        "tier": "adjacent",
        "name": "Issues, ethics and legal aspects",
    },
}


OUTPUT_DIR = Path(
    "artifacts/openalex"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


api = HfApi()

con = duckdb.connect(
    "/tmp/openalex-philosophy-record-sample.duckdb"
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


for setting in [
    "SET http_retries = 3",
    "SET http_timeout = 60000",
]:
    try:
        con.execute(setting)
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

    url = remote_url(entry)

    safe = url.replace(
        "'",
        "''"
    )

    return (
        f"read_parquet('{safe}')"
    )


def key(entry):

    return Path(
        entry.path
    ).name


def spread(values, count):

    values = sorted(values)

    if len(values) <= count:
        return values

    if count == 1:
        return [
            values[
                len(values) // 2
            ]
        ]

    indices = []

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

        if index not in indices:
            indices.append(index)

    return [
        values[index]
        for index in indices
    ]


topic_files = discover(
    "data/works/topics"
)

main_files = discover(
    "data/works/main"
)


topics_by_key = {
    key(entry): entry
    for entry in topic_files
}

main_by_key = {
    key(entry): entry
    for entry in main_files
}


aligned = sorted(
    set(topics_by_key)
    &
    set(main_by_key)
)


print("=" * 78)
print("OPENALEX PHILOSOPHY RECORD SAMPLE")
print("=" * 78)

print(
    "works/topics shards:",
    f"{len(topic_files):,}"
)

print(
    "works/main shards:",
    f"{len(main_files):,}"
)

print(
    "shards alineados:",
    f"{len(aligned):,}"
)


if not aligned:
    raise SystemExit(
        "❌ No encontré shards alineados"
    )


selected = spread(
    aligned,
    SAMPLE_SHARDS
)


print(
    "shards seleccionados:",
    len(selected)
)

print()
print(
    "Primero:",
    selected[0]
)

print(
    "Último:",
    selected[-1]
)


con.execute(
    """
    CREATE TABLE records (
        work_id BIGINT,

        tier VARCHAR,
        subfield_id BIGINT,
        subfield_name VARCHAR,
        subfield_score DOUBLE,

        title VARCHAR,
        display_name VARCHAR,

        publication_year BIGINT,
        publication_date VARCHAR,

        language VARCHAR,
        type VARCHAR,

        doi VARCHAR,

        cited_by_count BIGINT,

        open_access_is_oa BOOLEAN,
        open_access_oa_status VARCHAR,
        open_access_oa_url VARCHAR,

        has_fulltext BOOLEAN,
        has_content_pdf BOOLEAN,

        updated_date VARCHAR
    )
    """
)


start_time = time.time()


for number, shard_key in enumerate(
    selected,
    start=1
):

    topic_entry = topics_by_key[
        shard_key
    ]

    main_entry = main_by_key[
        shard_key
    ]

    topics = relation(
        topic_entry
    )

    main = relation(
        main_entry
    )


    con.execute(
        f"""
        INSERT INTO records

        WITH scores AS (

            SELECT
                work_id,

                max(score)
                    FILTER (
                        WHERE topic_id = 1211
                    )
                    AS philosophy_score,

                max(score)
                    FILTER (
                        WHERE topic_id = 1207
                    )
                    AS history_science_score,

                max(score)
                    FILTER (
                        WHERE topic_id = 2910
                    )
                    AS ethics_legal_score

            FROM {topics}

            WHERE
                topic_id IN (
                    1211,
                    1207,
                    2910
                )

            GROUP BY
                work_id
        ),

        classified AS (

            SELECT
                work_id,

                CASE
                    WHEN philosophy_score
                        IS NOT NULL
                        THEN 'core'

                    WHEN history_science_score
                        IS NOT NULL
                        THEN 'extended'

                    ELSE 'adjacent'
                END
                    AS tier,

                CASE
                    WHEN philosophy_score
                        IS NOT NULL
                        THEN 1211

                    WHEN history_science_score
                        IS NOT NULL
                        THEN 1207

                    ELSE 2910
                END
                    AS subfield_id,

                CASE
                    WHEN philosophy_score
                        IS NOT NULL
                        THEN 'Philosophy'

                    WHEN history_science_score
                        IS NOT NULL
                        THEN
                        'History and Philosophy of Science'

                    ELSE
                        'Issues, ethics and legal aspects'
                END
                    AS subfield_name,

                CASE
                    WHEN philosophy_score
                        IS NOT NULL
                        THEN philosophy_score

                    WHEN history_science_score
                        IS NOT NULL
                        THEN history_science_score

                    ELSE ethics_legal_score
                END
                    AS subfield_score

            FROM scores
        )

        SELECT
            c.work_id,

            c.tier,
            c.subfield_id,
            c.subfield_name,
            c.subfield_score,

            m.title,
            m.display_name,

            m.publication_year,
            m.publication_date,

            m.language,
            m.type,

            m.doi,

            m.cited_by_count,

            m.open_access_is_oa,
            m.open_access_oa_status,
            m.open_access_oa_url,

            m.has_fulltext,
            m.has_content_pdf,

            m.updated_date

        FROM classified c

        JOIN {main} m
            ON m.work_id =
               c.work_id

        WHERE
            coalesce(
                m.is_retracted,
                false
            ) = false
        """
    )


    if (
        number == 1
        or number % 10 == 0
        or number == len(selected)
    ):

        count = con.execute(
            """
            SELECT count(*)
            FROM records
            """
        ).fetchone()[0]

        elapsed = (
            time.time()
            -
            start_time
        )

        print(
            f"[{number:3}/{len(selected):3}] "
            f"records={count:,} "
            f"tiempo={elapsed:.1f}s"
        )


# ---------------------------------------------------------
# RESUMEN
# ---------------------------------------------------------

total = con.execute(
    """
    SELECT count(*)
    FROM records
    """
).fetchone()[0]


unique_works = con.execute(
    """
    SELECT count(
        DISTINCT work_id
    )
    FROM records
    """
).fetchone()[0]


print()
print("=" * 78)
print("RESULTADO GLOBAL")
print("=" * 78)

print(
    "Registros:",
    f"{total:,}"
)

print(
    "Works únicos:",
    f"{unique_works:,}"
)

print(
    "Tiempo:",
    f"{time.time() - start_time:.2f}s"
)


print()
print("=" * 78)
print("POR TIER")
print("=" * 78)


tier_rows = con.execute(
    """
    SELECT
        tier,

        count(*)
            AS works,

        avg(subfield_score)
            AS avg_score,

        median(subfield_score)
            AS median_score,

        avg(
            CASE
                WHEN open_access_is_oa
                THEN 1.0
                ELSE 0.0
            END
        )
            AS oa_ratio

    FROM records

    GROUP BY tier

    ORDER BY
        CASE tier
            WHEN 'core'
                THEN 1
            WHEN 'extended'
                THEN 2
            ELSE 3
        END
    """
).fetchall()


for row in tier_rows:

    print(
        f"{row[0]:10} "
        f"works={row[1]:9,}  "
        f"mean={row[2]:.3f}  "
        f"median={row[3]:.3f}  "
        f"OA={row[4] * 100:5.1f}%"
    )


# ---------------------------------------------------------
# DISTRIBUCIÓN POR SCORE
# ---------------------------------------------------------

print()
print("=" * 78)
print("DISTRIBUCIÓN DE SCORE")
print("=" * 78)


bins = [
    (0.90, 1.01, "0.90–1.00"),
    (0.75, 0.90, "0.75–0.90"),
    (0.60, 0.75, "0.60–0.75"),
    (0.45, 0.60, "0.45–0.60"),
    (0.30, 0.45, "0.30–0.45"),
    (0.00, 0.30, "<0.30"),
]


for tier in [
    "core",
    "extended",
    "adjacent",
]:

    print()
    print(tier.upper())

    for lower, upper, label in bins:

        count = con.execute(
            """
            SELECT count(*)
            FROM records
            WHERE
                tier = ?
                AND subfield_score >= ?
                AND subfield_score < ?
            """,
            [
                tier,
                lower,
                upper,
            ]
        ).fetchone()[0]

        print(
            f"  {label:10} "
            f"{count:9,}"
        )


# ---------------------------------------------------------
# TIPOS E IDIOMAS
# ---------------------------------------------------------

print()
print("=" * 78)
print("TIPOS PRINCIPALES")
print("=" * 78)


for row in con.execute(
    """
    SELECT
        type,
        count(*) AS n

    FROM records

    GROUP BY type

    ORDER BY n DESC

    LIMIT 15
    """
).fetchall():

    print(
        f"{str(row[0]):25} "
        f"{row[1]:9,}"
    )


print()
print("=" * 78)
print("IDIOMAS PRINCIPALES")
print("=" * 78)


for row in con.execute(
    """
    SELECT
        language,
        count(*) AS n

    FROM records

    GROUP BY language

    ORDER BY n DESC

    LIMIT 15
    """
).fetchall():

    print(
        f"{str(row[0]):10} "
        f"{row[1]:9,}"
    )


# ---------------------------------------------------------
# MUESTRAS PARA JUZGAR PRECISIÓN
# ---------------------------------------------------------

def show_examples(
    tier,
    lower,
    upper,
    label,
    limit=12,
):

    print()
    print(
        f"{tier.upper()} — {label}"
    )

    print("-" * 78)

    rows = con.execute(
        """
        SELECT
            subfield_score,
            publication_year,
            language,
            type,
            coalesce(
                title,
                display_name
            )

        FROM records

        WHERE
            tier = ?
            AND subfield_score >= ?
            AND subfield_score < ?

        ORDER BY
            work_id

        LIMIT ?
        """,
        [
            tier,
            lower,
            upper,
            limit,
        ]
    ).fetchall()


    for row in rows:

        title = (
            row[4]
            or "(sin título)"
        )

        title = " ".join(
            str(title).split()
        )

        print(
            f"{row[0]:.3f}  "
            f"{str(row[1] or '----'):4}  "
            f"{str(row[2] or '--'):3}  "
            f"{str(row[3] or '—'):14}  "
            f"{title[:130]}"
        )


for tier in [
    "core",
    "extended",
    "adjacent",
]:

    show_examples(
        tier,
        0.75,
        1.01,
        "ALTO ≥ 0.75",
    )

    show_examples(
        tier,
        0.40,
        0.55,
        "MEDIO 0.40–0.55",
    )

    show_examples(
        tier,
        0.00,
        0.25,
        "BAJO < 0.25",
    )


# ---------------------------------------------------------
# ARTEFACTOS
# ---------------------------------------------------------

parquet_path = (
    OUTPUT_DIR /
    "philosophy-record-sample.parquet"
)

summary_path = (
    OUTPUT_DIR /
    "philosophy-record-sample-summary.json"
)


safe_parquet = str(
    parquet_path
).replace(
    "'",
    "''"
)


con.execute(
    f"""
    COPY (
        SELECT *
        FROM records
        ORDER BY
            tier,
            subfield_score DESC,
            work_id
    )
    TO '{safe_parquet}'
    (
        FORMAT PARQUET,
        COMPRESSION ZSTD
    )
    """
)


summary = {
    "sample_shards":
        len(selected),

    "aligned_shards":
        len(aligned),

    "records":
        total,

    "unique_works":
        unique_works,

    "elapsed_seconds":
        round(
            time.time()
            -
            start_time,
            2
        ),

    "tiers": {
        row[0]: {
            "works":
                row[1],

            "average_score":
                row[2],

            "median_score":
                row[3],

            "open_access_ratio":
                row[4],
        }
        for row in tier_rows
    },
}


summary_path.write_text(
    json.dumps(
        summary,
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)


print()
print("=" * 78)
print("ARCHIVOS")
print("=" * 78)

print(
    parquet_path,
    f"({parquet_path.stat().st_size / 1024**2:.2f} MiB)"
)

print(
    summary_path
)

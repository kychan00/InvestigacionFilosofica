import json
import os
import time
from pathlib import Path
from urllib.parse import quote

import duckdb

from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile


REPO_ID = "Mearman/OpenAlex"

TOPIC_IDS_PATH = Path(
    "artifacts/openalex/"
    "philosophy-topic-ids-main.txt"
)

CURATED_PATH = Path(
    "artifacts/openalex/"
    "philosophy-topics-curated.json"
)

OUTPUT_DIR = Path(
    "artifacts/openalex"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


MAX_SHARDS = int(
    os.environ.get(
        "OPENALEX_MAX_SHARDS",
        "0"
    )
)

BATCH_SIZE = int(
    os.environ.get(
        "OPENALEX_BATCH_SIZE",
        "25"
    )
)


if not TOPIC_IDS_PATH.exists():
    raise SystemExit(
        "❌ Falta philosophy-topic-ids-main.txt"
    )


topic_ids = sorted({
    int(line.strip())
    for line in TOPIC_IDS_PATH
        .read_text(
            encoding="utf-8"
        )
        .splitlines()
    if line.strip()
})


if not topic_ids:
    raise SystemExit(
        "❌ Lista de topic_id vacía"
    )


print("=" * 78)
print("EXTRACCIÓN DE WORK_ID FILOSÓFICOS")
print("=" * 78)

print(
    f"Topics principales: {len(topic_ids):,}"
)


api = HfApi()


entries = list(
    api.list_repo_tree(
        repo_id=REPO_ID,
        repo_type="dataset",
        path_in_repo="data/works/topics",
        recursive=True,
        expand=False,
        revision="main",
        token=False,
    )
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


total_shards = len(files)


if not files:
    raise SystemExit(
        "❌ No encontré works/topics"
    )


if MAX_SHARDS > 0:

    # Para la prueba elegimos los shards
    # más grandes: es una prueba más exigente
    # y más representativa que tomar los primeros.
    files = sorted(
        files,
        key=lambda entry:
            int(
                entry.size or 0
            ),
        reverse=True,
    )[:MAX_SHARDS]

    mode = "sample"

else:

    files = sorted(
        files,
        key=lambda entry:
            entry.path
    )

    mode = "full"


selected_bytes = sum(
    int(
        entry.size or 0
    )
    for entry in files
)


print(
    f"Modo: {mode}"
)

print(
    f"Shards disponibles: "
    f"{total_shards:,}"
)

print(
    f"Shards seleccionados: "
    f"{len(files):,}"
)

print(
    f"Datos físicos seleccionados: "
    f"{selected_bytes / 1024**3:.2f} GiB"
)


database_path = (
    "/tmp/"
    "openalex-philosophy-workids.duckdb"
)


con = duckdb.connect(
    database_path
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
        con.execute(
            setting
        )
    except Exception:
        pass


con.execute(
    """
    CREATE TABLE matches (
        work_id BIGINT,
        topic_id BIGINT,
        score DOUBLE
    )
    """
)


topic_sql = ", ".join(
    str(topic_id)
    for topic_id in topic_ids
)


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


def relation_for(entries):

    urls = [
        remote_url(entry)
        for entry in entries
    ]

    sql_urls = ", ".join(
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
        + sql_urls
        + "])"
    )


def insert_entries(entries):

    relation = relation_for(
        entries
    )

    con.execute(
        "BEGIN"
    )

    try:

        con.execute(
            f"""
            INSERT INTO matches
            SELECT
                work_id,
                topic_id,
                score
            FROM {relation}
            WHERE
                topic_id IN (
                    {topic_sql}
                )
            """
        )

        con.execute(
            "COMMIT"
        )

    except Exception:

        con.execute(
            "ROLLBACK"
        )

        raise


start_time = time.time()

failed = []


for start in range(
    0,
    len(files),
    BATCH_SIZE
):

    batch = files[
        start:
        start + BATCH_SIZE
    ]


    try:

        insert_entries(
            batch
        )

    except Exception as batch_error:

        print()
        print(
            "⚠️ Batch falló; "
            "reintentando shard por shard"
        )

        print(
            str(batch_error)[:500]
        )


        for entry in batch:

            success = False

            for attempt in range(
                1,
                4
            ):

                try:

                    insert_entries(
                        [entry]
                    )

                    success = True
                    break

                except Exception as error:

                    print(
                        f"  intento {attempt}/3 "
                        f"falló: {entry.path}"
                    )

                    print(
                        "  "
                        +
                        str(error)[:300]
                    )

                    time.sleep(
                        attempt * 2
                    )


            if not success:
                failed.append(
                    entry.path
                )


    processed = min(
        start + BATCH_SIZE,
        len(files)
    )

    matches = con.execute(
        """
        SELECT count(*)
        FROM matches
        """
    ).fetchone()[0]

    elapsed = (
        time.time()
        -
        start_time
    )


    print(
        f"[{processed:4}/{len(files):4}] "
        f"matches={matches:,} "
        f"tiempo={elapsed:.1f}s"
    )


if failed:

    print()
    print(
        "❌ Shards que no pudieron leerse:"
    )

    for path in failed:
        print(path)

    raise SystemExit(
        f"Fallaron {len(failed)} shards"
    )


print()
print(
    "Deduplicando work-topic..."
)


con.execute(
    """
    CREATE TABLE unique_matches AS
    SELECT
        work_id,
        topic_id,
        max(score)
            AS score
    FROM matches
    GROUP BY
        work_id,
        topic_id
    """
)


raw_matches = con.execute(
    """
    SELECT count(*)
    FROM matches
    """
).fetchone()[0]


unique_pairs = con.execute(
    """
    SELECT count(*)
    FROM unique_matches
    """
).fetchone()[0]


unique_works = con.execute(
    """
    SELECT
        count(
            DISTINCT work_id
        )
    FROM unique_matches
    """
).fetchone()[0]


output_parquet = (
    OUTPUT_DIR /
    "philosophy-work-ids.parquet"
)


safe_output = str(
    output_parquet
).replace(
    "'",
    "''"
)


con.execute(
    f"""
    COPY (
        SELECT
            work_id,

            count(*)
                AS philosophy_topic_count,

            arg_max(
                topic_id,
                score
            )
                AS primary_topic_id,

            max(score)
                AS max_topic_score,

            list(
                topic_id
                ORDER BY score DESC
            )
                AS topic_ids

        FROM unique_matches

        GROUP BY
            work_id

        ORDER BY
            work_id
    )
    TO '{safe_output}'
    (
        FORMAT PARQUET,
        COMPRESSION ZSTD
    )
    """
)


top_topics = con.execute(
    """
    SELECT
        topic_id,
        count(
            DISTINCT work_id
        ) AS works
    FROM unique_matches
    GROUP BY topic_id
    ORDER BY works DESC
    LIMIT 30
    """
).fetchall()


name_by_id = {}


if CURATED_PATH.exists():

    curated = json.loads(
        CURATED_PATH.read_text(
            encoding="utf-8"
        )
    )

    for tier in curated.get(
        "tiers",
        {}
    ).values():

        for item in tier:

            name_by_id[
                int(
                    item["topic_id"]
                )
            ] = item.get(
                "display_name"
            )


summary = {
    "mode":
        mode,

    "topics":
        len(topic_ids),

    "total_shards":
        total_shards,

    "processed_shards":
        len(files),

    "selected_bytes":
        selected_bytes,

    "raw_matches":
        raw_matches,

    "unique_work_topic_pairs":
        unique_pairs,

    "unique_works":
        unique_works,

    "elapsed_seconds":
        round(
            time.time()
            -
            start_time,
            2
        ),

    "complete":
        MAX_SHARDS == 0,

    "top_topics": [
        {
            "topic_id":
                int(topic_id),

            "display_name":
                name_by_id.get(
                    int(topic_id)
                ),

            "unique_works":
                int(count),
        }
        for topic_id, count
        in top_topics
    ],
}


summary_path = (
    OUTPUT_DIR /
    "philosophy-work-ids-summary.json"
)


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
print("RESULTADO")
print("=" * 78)

print(
    f"Matches crudos: "
    f"{raw_matches:,}"
)

print(
    f"Work-topic únicos: "
    f"{unique_pairs:,}"
)

print(
    f"WORKS FILOSÓFICOS ÚNICOS: "
    f"{unique_works:,}"
)

print(
    f"Tiempo: "
    f"{summary['elapsed_seconds']:.2f}s"
)

print(
    f"Parquet: "
    f"{output_parquet.stat().st_size / 1024**2:.2f} MiB"
)


print()
print("TOP TOPICS")
print("-" * 78)


for item in summary[
    "top_topics"
]:

    print(
        f"{item['topic_id']:6}  "
        f"{item['unique_works']:10,}  "
        f"{item['display_name'] or '—'}"
    )


print()
print(
    "✓",
    output_parquet
)

print(
    "✓",
    summary_path
)

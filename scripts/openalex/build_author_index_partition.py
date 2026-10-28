import json
import os
import time
from pathlib import Path

import duckdb
from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile

from author_index_common import (
    AUTHORSHIP_PATH,
    OPENALEX_SNAPSHOT_REPO,
    OPENALEX_SNAPSHOT_REVISION,
    PHILOSOPHY_REPO,
    PHILOSOPHY_REVISION,
    PHILOSOPHY_SEARCH_PATH,
    hf_file_url,
    write_json,
)


PART = int(
    os.environ.get(
        "AUTHOR_INDEX_PART",
        "0",
    )
)

PARTS = int(
    os.environ.get(
        "AUTHOR_INDEX_PARTS",
        "12",
    )
)

OUTPUT_DIRECTORY = Path(
    "artifacts/author-index-v1/parts"
)

OUTPUT_PARQUET = (
    OUTPUT_DIRECTORY /
    f"author-works-{PART:02d}.parquet"
)

OUTPUT_METADATA = (
    OUTPUT_DIRECTORY /
    f"author-works-{PART:02d}.metadata.json"
)

CHUNK_SIZE = 12


def discover_authorship_files():
    api = HfApi()

    entries = api.list_repo_tree(
        repo_id=OPENALEX_SNAPSHOT_REPO,
        repo_type="dataset",
        path_in_repo=AUTHORSHIP_PATH,
        recursive=True,
        expand=False,
        revision=OPENALEX_SNAPSHOT_REVISION,
        token=False,
    )

    return sorted(
        entry.path
        for entry in entries
        if (
            isinstance(entry, RepoFile)
            and entry.path.endswith(
                ".parquet"
            )
        )
    )


def configure(connection):
    connection.execute(
        "INSTALL httpfs"
    )

    connection.execute(
        "LOAD httpfs"
    )

    connection.execute(
        "SET http_retries = 8"
    )

    connection.execute(
        "SET http_timeout = 120000"
    )

    connection.execute(
        "SET preserve_insertion_order = false"
    )


def main():
    if PART < 0 or PART >= PARTS:
        raise ValueError(
            f"Invalid partition {PART}/{PARTS}"
        )

    started = time.time()

    files = discover_authorship_files()
    selected = [
        path
        for index, path in enumerate(files)
        if index % PARTS == PART
    ]

    if not selected:
        raise RuntimeError(
            "No authorship shards selected"
        )

    OUTPUT_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    connection = duckdb.connect()
    configure(connection)

    corpus_url = hf_file_url(
        PHILOSOPHY_REPO,
        PHILOSOPHY_REVISION,
        PHILOSOPHY_SEARCH_PATH,
    )

    connection.execute(
        """
        CREATE TEMP TABLE corpus_ids AS
        SELECT DISTINCT
          CAST(work_id AS BIGINT) AS work_id
        FROM read_parquet(?)
        """,
        [corpus_url],
    )

    corpus_rows = connection.execute(
        "SELECT count(*) FROM corpus_ids"
    ).fetchone()[0]

    connection.execute(
        """
        CREATE TEMP TABLE matched (
          work_id BIGINT,
          author_id BIGINT,
          author_position VARCHAR,
          is_corresponding BOOLEAN
        )
        """
    )

    for offset in range(
        0,
        len(selected),
        CHUNK_SIZE,
    ):
        chunk = selected[
            offset:offset + CHUNK_SIZE
        ]

        urls = [
            hf_file_url(
                OPENALEX_SNAPSHOT_REPO,
                OPENALEX_SNAPSHOT_REVISION,
                path,
            )
            for path in chunk
        ]

        connection.execute(
            """
            INSERT INTO matched
            SELECT
              CAST(a.work_id AS BIGINT),
              CAST(a.authorship_id AS BIGINT),
              a.author_position,
              coalesce(
                a.is_corresponding,
                false
              )
            FROM read_parquet(?) AS a
            INNER JOIN corpus_ids AS c
              ON c.work_id = a.work_id
            WHERE a.authorship_id IS NOT NULL
            """,
            [urls],
        )

        print(
            json.dumps({
                "event": "chunk_complete",
                "part": PART,
                "files_complete": min(
                    offset + CHUNK_SIZE,
                    len(selected),
                ),
                "files_total": len(selected),
            }),
            flush=True,
        )

    safe_output = str(
        OUTPUT_PARQUET
    ).replace("'", "''")

    connection.execute(
        f"""
        COPY (
          SELECT DISTINCT
            work_id,
            author_id,
            author_position,
            is_corresponding
          FROM matched
          ORDER BY
            work_id,
            author_id
        )
        TO '{safe_output}' (
          FORMAT PARQUET,
          COMPRESSION ZSTD
        )
        """
    )

    matched_rows = connection.execute(
        "SELECT count(*) FROM matched"
    ).fetchone()[0]

    metadata = {
        "schema_version": (
            "author-index-partition-v1"
        ),
        "partition": PART,
        "partitions": PARTS,
        "source": {
            "repo": OPENALEX_SNAPSHOT_REPO,
            "revision": (
                OPENALEX_SNAPSHOT_REVISION
            ),
            "path": AUTHORSHIP_PATH,
            "files_total": len(files),
            "files_selected": len(selected),
        },
        "corpus": {
            "repo": PHILOSOPHY_REPO,
            "revision": PHILOSOPHY_REVISION,
            "path": PHILOSOPHY_SEARCH_PATH,
            "rows": corpus_rows,
        },
        "output": {
            "path": str(OUTPUT_PARQUET),
            "rows_before_distinct": (
                matched_rows
            ),
            "size_bytes": (
                OUTPUT_PARQUET.stat().st_size
            ),
        },
        "elapsed_seconds": round(
            time.time() - started,
            3,
        ),
    }

    write_json(
        OUTPUT_METADATA,
        metadata,
    )

    print(
        json.dumps(
            metadata,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()

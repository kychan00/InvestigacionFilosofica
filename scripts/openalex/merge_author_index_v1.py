import json
import time
from collections import OrderedDict
from pathlib import Path

import duckdb
from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile

from author_index_common import (
    AUTHOR_PATH,
    BUCKET_COUNT,
    INDEX_VERSION,
    OPENALEX_SNAPSHOT_REPO,
    OPENALEX_SNAPSHOT_REVISION,
    PHILOSOPHY_REPO,
    PHILOSOPHY_REVISION,
    PHILOSOPHY_SEARCH_PATH,
    alias_signatures,
    bucket_for,
    hf_file_url,
    sha256_file,
    write_json,
)


PART_DIRECTORY = Path(
    "artifacts/author-index-v1/parts"
)

OUTPUT_ROOT = Path(
    "artifacts/author-index-v1/site"
) / INDEX_VERSION

ALIAS_DIRECTORY = OUTPUT_ROOT / "aliases"
WORK_DIRECTORY = OUTPUT_ROOT / "works"

AUTHOR_CHUNK_SIZE = 12


class JsonlBucketWriter:
    def __init__(
        self,
        directory,
        max_open=64,
    ):
        self.directory = Path(directory)
        self.directory.mkdir(
            parents=True,
            exist_ok=True,
        )
        self.max_open = max_open
        self.handles = OrderedDict()
        self.rows = 0

    def _handle(self, bucket):
        if bucket in self.handles:
            handle = self.handles.pop(
                bucket
            )
            self.handles[bucket] = handle
            return handle

        if len(self.handles) >= self.max_open:
            _, oldest = self.handles.popitem(
                last=False
            )
            oldest.close()

        path = (
            self.directory /
            f"{bucket:04d}.jsonl"
        )

        handle = path.open(
            "a",
            encoding="utf-8",
        )

        self.handles[bucket] = handle
        return handle

    def write(self, bucket, payload):
        handle = self._handle(bucket)
        handle.write(
            json.dumps(
                payload,
                ensure_ascii=False,
                separators=(",", ":"),
            ) + "\n"
        )
        self.rows += 1

    def close(self):
        for handle in self.handles.values():
            handle.close()

        self.handles.clear()


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


def discover_author_files():
    api = HfApi()

    entries = api.list_repo_tree(
        repo_id=OPENALEX_SNAPSHOT_REPO,
        repo_type="dataset",
        path_in_repo=AUTHOR_PATH,
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


def build_alias_buckets(connection):
    writer = JsonlBucketWriter(
        ALIAS_DIRECTORY
    )

    cursor = connection.execute(
        """
        SELECT
          author_id,
          display_name,
          orcid,
          corpus_works_count,
          works_count,
          cited_by_count
        FROM author_profiles
        ORDER BY author_id
        """
    )

    while True:
        rows = cursor.fetchmany(5000)

        if not rows:
            break

        for (
            author_id,
            display_name,
            orcid,
            corpus_works_count,
            works_count,
            cited_by_count,
        ) in rows:
            for signature, kind in (
                alias_signatures(
                    display_name
                )
            ):
                writer.write(
                    bucket_for(signature),
                    {
                        "s": signature,
                        "id": int(author_id),
                        "n": display_name,
                        "o": orcid,
                        "cw": int(
                            corpus_works_count
                            or 0
                        ),
                        "w": int(
                            works_count
                            or 0
                        ),
                        "c": int(
                            cited_by_count
                            or 0
                        ),
                        "k": kind,
                    },
                )

    writer.close()
    return writer.rows


def build_work_buckets(connection):
    writer = JsonlBucketWriter(
        WORK_DIRECTORY
    )

    cursor = connection.execute(
        """
        SELECT
          aw.author_id,
          aw.work_id,
          aw.author_position,
          aw.is_corresponding,
          c.title,
          c.publication_year,
          c.language,
          c.type
        FROM author_works AS aw
        INNER JOIN corpus AS c
          ON c.work_id = aw.work_id
        INNER JOIN author_profiles AS p
          ON p.author_id = aw.author_id
        ORDER BY
          aw.author_id,
          c.publication_year DESC NULLS LAST,
          aw.work_id
        """
    )

    while True:
        rows = cursor.fetchmany(5000)

        if not rows:
            break

        for (
            author_id,
            work_id,
            position,
            corresponding,
            title,
            year,
            language,
            work_type,
        ) in rows:
            writer.write(
                bucket_for(str(author_id)),
                {
                    "id": int(author_id),
                    "wid": int(work_id),
                    "p": position,
                    "r": bool(corresponding),
                    "t": title,
                    "y": (
                        int(year)
                        if year is not None
                        else None
                    ),
                    "l": language,
                    "ty": work_type,
                },
            )

    writer.close()
    return writer.rows


def file_inventory(directory):
    return [
        {
            "path": str(
                path.relative_to(
                    OUTPUT_ROOT
                )
            ),
            "size_bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        for path in sorted(
            Path(directory).glob(
                "*.jsonl"
            )
        )
    ]


def main():
    started = time.time()

    parts = sorted(
        PART_DIRECTORY.glob(
            "author-works-*.parquet"
        )
    )

    if not parts:
        raise RuntimeError(
            "No author-work partitions found"
        )

    OUTPUT_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )

    connection = duckdb.connect()
    configure(connection)

    connection.execute(
        """
        CREATE TEMP TABLE author_works AS
        SELECT DISTINCT
          CAST(work_id AS BIGINT) AS work_id,
          CAST(author_id AS BIGINT) AS author_id,
          author_position,
          is_corresponding
        FROM read_parquet(?)
        """,
        [[str(path) for path in parts]],
    )

    connection.execute(
        """
        CREATE TEMP TABLE author_ids AS
        SELECT
          author_id,
          count(DISTINCT work_id) AS
            corpus_works_count
        FROM author_works
        GROUP BY author_id
        """
    )

    corpus_url = hf_file_url(
        PHILOSOPHY_REPO,
        PHILOSOPHY_REVISION,
        PHILOSOPHY_SEARCH_PATH,
    )

    connection.execute(
        """
        CREATE TEMP TABLE corpus AS
        SELECT DISTINCT
          CAST(work_id AS BIGINT) AS work_id,
          title,
          publication_year,
          language,
          type
        FROM read_parquet(?)
        """,
        [corpus_url],
    )

    connection.execute(
        """
        CREATE TEMP TABLE author_candidates (
          author_id BIGINT,
          display_name VARCHAR,
          orcid VARCHAR,
          works_count BIGINT,
          cited_by_count BIGINT,
          updated_date VARCHAR
        )
        """
    )

    author_files = discover_author_files()

    for offset in range(
        0,
        len(author_files),
        AUTHOR_CHUNK_SIZE,
    ):
        chunk = author_files[
            offset:offset + AUTHOR_CHUNK_SIZE
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
            INSERT INTO author_candidates
            SELECT
              CAST(a.author_id AS BIGINT),
              a.display_name,
              a.orcid,
              a.works_count,
              a.cited_by_count,
              a.updated_date
            FROM read_parquet(?) AS a
            INNER JOIN author_ids AS wanted
              ON wanted.author_id = a.author_id
            WHERE
              a.display_name IS NOT NULL
              AND trim(a.display_name) <> ''
            """,
            [urls],
        )

        print(
            json.dumps({
                "event": "authors_chunk_complete",
                "files_complete": min(
                    offset + AUTHOR_CHUNK_SIZE,
                    len(author_files),
                ),
                "files_total": len(author_files),
            }),
            flush=True,
        )

    connection.execute(
        """
        CREATE TEMP TABLE author_profiles AS
        SELECT
          ranked.author_id,
          ranked.display_name,
          ranked.orcid,
          ranked.works_count,
          ranked.cited_by_count,
          ids.corpus_works_count
        FROM (
          SELECT
            *,
            row_number() OVER (
              PARTITION BY author_id
              ORDER BY updated_date DESC
            ) AS author_version
          FROM author_candidates
        ) AS ranked
        INNER JOIN author_ids AS ids
          ON ids.author_id = ranked.author_id
        WHERE ranked.author_version = 1
        """
    )

    alias_rows = build_alias_buckets(
        connection
    )

    work_rows = build_work_buckets(
        connection
    )

    counts = connection.execute(
        """
        SELECT
          (SELECT count(*) FROM corpus),
          (
            SELECT count(DISTINCT work_id)
            FROM author_works
          ),
          (SELECT count(*) FROM author_works),
          (SELECT count(*) FROM author_ids),
          (SELECT count(*) FROM author_profiles)
        """
    ).fetchone()

    aliases = file_inventory(
        ALIAS_DIRECTORY
    )
    works = file_inventory(
        WORK_DIRECTORY
    )

    manifest = {
        "schema_version": (
            "remote-author-index-manifest-v1"
        ),
        "version": INDEX_VERSION,
        "bucket_count": BUCKET_COUNT,
        "hash": "fnv1a-32",
        "normalization": (
            "unicode-nfkd-casefold-"
            "token-signature-v1"
        ),
        "source": {
            "snapshot_repo": (
                OPENALEX_SNAPSHOT_REPO
            ),
            "snapshot_revision": (
                OPENALEX_SNAPSHOT_REVISION
            ),
            "philosophy_repo": (
                PHILOSOPHY_REPO
            ),
            "philosophy_revision": (
                PHILOSOPHY_REVISION
            ),
            "philosophy_path": (
                PHILOSOPHY_SEARCH_PATH
            ),
        },
        "counts": {
            "corpus_works": counts[0],
            "works_with_authorship": counts[1],
            "author_work_rows": counts[2],
            "distinct_author_ids": counts[3],
            "resolved_authors": counts[4],
            "alias_rows": alias_rows,
            "work_rows_published": work_rows,
        },
        "coverage": {
            "works_with_authorship_ratio": (
                round(
                    counts[1] / counts[0],
                    8,
                )
                if counts[0]
                else 0
            ),
            "authors_resolved_ratio": (
                round(
                    counts[4] / counts[3],
                    8,
                )
                if counts[3]
                else 0
            ),
        },
        "files": {
            "aliases": aliases,
            "works": works,
        },
        "elapsed_seconds": round(
            time.time() - started,
            3,
        ),
    }

    write_json(
        OUTPUT_ROOT / "manifest.json",
        manifest,
    )

    write_json(
        OUTPUT_ROOT / "sample-kant.json",
        {
            "authors": [
                {
                    "author_id": row[0],
                    "display_name": row[1],
                    "orcid": row[2],
                    "corpus_works_count": row[3],
                }
                for row in connection.execute(
                    """
                    SELECT
                      author_id,
                      display_name,
                      orcid,
                      corpus_works_count
                    FROM author_profiles
                    WHERE lower(display_name)
                      LIKE '%kant%'
                    ORDER BY
                      corpus_works_count DESC,
                      author_id
                    LIMIT 20
                    """
                ).fetchall()
            ]
        },
    )

    print(
        json.dumps(
            manifest,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()

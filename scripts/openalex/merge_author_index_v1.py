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
WORK_AUTHOR_DIRECTORY = (
    OUTPUT_ROOT / "work-authors"
)

AUTHOR_CHUNK_SIZE = 12
REMOTE_RETRY_ATTEMPTS = 4
REMOTE_RETRY_DELAY_SECONDS = 75


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


def execute_remote_with_backoff(
    connection,
    statement,
    parameters,
    *,
    label,
    attempts=REMOTE_RETRY_ATTEMPTS,
    delay_seconds=REMOTE_RETRY_DELAY_SECONDS,
    sleeper=time.sleep,
):
    for attempt in range(1, attempts + 1):
        try:
            return connection.execute(
                statement,
                parameters,
            )
        except Exception as error:
            message = str(error)
            rate_limited = (
                "HTTP 429" in message
                or "Too Many Requests" in message
            )

            if (
                not rate_limited
                or attempt >= attempts
            ):
                raise

            print(
                json.dumps({
                    "event": "remote_rate_limit_backoff",
                    "label": label,
                    "attempt": attempt,
                    "attempts": attempts,
                    "delay_seconds": delay_seconds,
                }),
                flush=True,
            )

            sleeper(delay_seconds)


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


def build_work_buckets(
    connection,
    directory=WORK_DIRECTORY,
):
    writer = JsonlBucketWriter(
        directory
    )

    cursor = connection.execute(
        """
        SELECT
          aw.author_id,
          aw.work_id,
          aw.author_position,
          aw.is_corresponding,
          authors_by_work.coauthor_count,
          c.title,
          c.publication_year,
          c.language,
          c.type
        FROM author_works AS aw
        INNER JOIN (
          SELECT work_id,
            count(DISTINCT author_id) - 1 AS coauthor_count
          FROM author_works
          GROUP BY work_id
        ) AS authors_by_work
          ON authors_by_work.work_id = aw.work_id
        INNER JOIN corpus AS c
          ON c.work_id = aw.work_id
        INNER JOIN author_profiles AS p
          ON p.author_id = aw.author_id
        WHERE
          c.title IS NOT NULL
          AND trim(c.title) <> ''
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
            coauthor_count,
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
                    "co": int(coauthor_count or 0),
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


def build_work_author_buckets(
    connection,
    directory=WORK_AUTHOR_DIRECTORY,
):
    writer = JsonlBucketWriter(
        directory
    )

    cursor = connection.execute(
        """
        SELECT
          aw.work_id,
          aw.author_id,
          p.display_name,
          p.orcid,
          aw.author_position,
          aw.is_corresponding
        FROM author_works AS aw
        INNER JOIN author_profiles AS p
          ON p.author_id = aw.author_id
        ORDER BY
          aw.work_id,
          CASE aw.author_position
            WHEN 'first' THEN 0
            WHEN 'middle' THEN 1
            WHEN 'last' THEN 2
            ELSE 3
          END,
          aw.author_id
        """
    )

    current_work = None
    authors = []

    def flush():
        if current_work is None:
            return

        writer.write(
            bucket_for(str(current_work)),
            {
                "wid": int(current_work),
                "a": authors,
            },
        )

    while True:
        rows = cursor.fetchmany(5000)

        if not rows:
            break

        for (
            work_id,
            author_id,
            display_name,
            orcid,
            position,
            corresponding,
        ) in rows:
            if (
                current_work is not None
                and work_id != current_work
            ):
                flush()
                authors = []

            current_work = work_id
            authors.append({
                "id": int(author_id),
                "n": display_name,
                "o": orcid,
                "p": position,
                "r": bool(corresponding),
            })

    flush()
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

        execute_remote_with_backoff(
            connection,
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
            label=(
                "authors "
                f"{offset + 1}-"
                f"{min(offset + AUTHOR_CHUNK_SIZE, len(author_files))}"
            ),
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

    work_author_rows = (
        build_work_author_buckets(
            connection
        )
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
          (SELECT count(*) FROM author_profiles),
          (
            SELECT count(*)
            FROM author_works AS aw
            INNER JOIN author_profiles AS p
              ON p.author_id = aw.author_id
          ),
          (
            SELECT count(*)
            FROM author_works AS aw
            INNER JOIN corpus AS c
              ON c.work_id = aw.work_id
            INNER JOIN author_profiles AS p
              ON p.author_id = aw.author_id
            WHERE
              c.title IS NULL
              OR trim(c.title) = ''
          )
        """
    ).fetchone()

    aliases = file_inventory(
        ALIAS_DIRECTORY
    )
    works = file_inventory(
        WORK_DIRECTORY
    )
    work_authors = file_inventory(
        WORK_AUTHOR_DIRECTORY
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
            "resolved_author_work_rows": counts[5],
            "untitled_author_work_rows_excluded": (
                counts[6]
            ),
            "alias_rows": alias_rows,
            "work_rows_published": work_rows,
            "work_author_rows_published": (
                work_author_rows
            ),
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
            "work_authors": work_authors,
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

import json
import sys
import tempfile
import unittest
from pathlib import Path

import duckdb


OPENALEX_SCRIPTS = (
    Path(__file__).parents[1]
    / "scripts"
    / "openalex"
)

sys.path.insert(
    0,
    str(OPENALEX_SCRIPTS),
)

from merge_author_index_v1 import (  # noqa: E402
    build_work_author_buckets,
    build_work_buckets,
    execute_remote_with_backoff,
)


class AuthorIndexMergeTest(unittest.TestCase):
    def test_retries_hugging_face_rate_limit(self):
        class TemporaryRateLimit:
            def __init__(self):
                self.calls = 0

            def execute(self, statement, parameters):
                self.calls += 1

                if self.calls < 3:
                    raise RuntimeError(
                        "HTTP 429 Too Many Requests"
                    )

                return "ok"

        connection = TemporaryRateLimit()
        sleeps = []

        result = execute_remote_with_backoff(
            connection,
            "SELECT 1",
            [],
            label="synthetic",
            delay_seconds=0,
            sleeper=sleeps.append,
        )

        self.assertEqual(result, "ok")
        self.assertEqual(connection.calls, 3)
        self.assertEqual(sleeps, [0, 0])

    def test_excludes_untitled_work_rows(self):
        connection = duckdb.connect()

        connection.execute(
            """
            CREATE TABLE author_works (
              author_id BIGINT,
              work_id BIGINT,
              author_position VARCHAR,
              is_corresponding BOOLEAN
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE corpus (
              work_id BIGINT,
              title VARCHAR,
              publication_year INTEGER,
              language VARCHAR,
              type VARCHAR
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE author_profiles (
              author_id BIGINT
            )
            """
        )

        connection.execute(
            "INSERT INTO author_profiles VALUES (7)"
        )

        connection.execute(
            """
            INSERT INTO author_works VALUES
              (7, 10, 'first', true),
              (7, 11, 'first', false),
              (7, 12, 'first', false)
            """
        )

        connection.execute(
            """
            INSERT INTO corpus VALUES
              (10, 'A titled work', 2024, 'en', 'article'),
              (11, NULL, 2023, 'en', 'article'),
              (12, '   ', 2022, 'en', 'article')
            """
        )

        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            rows = build_work_buckets(
                connection,
                directory,
            )

            payloads = []

            for path in directory.glob("*.jsonl"):
                payloads.extend(
                    json.loads(line)
                    for line in path.read_text(
                        encoding="utf-8"
                    ).splitlines()
                )

        self.assertEqual(rows, 1)
        self.assertEqual(
            payloads[0]["t"],
            "A titled work",
        )

    def test_builds_inverse_work_author_buckets(self):
        connection = duckdb.connect()

        connection.execute(
            """
            CREATE TABLE author_works (
              work_id BIGINT,
              author_id BIGINT,
              author_position VARCHAR,
              is_corresponding BOOLEAN
            );

            CREATE TABLE author_profiles (
              author_id BIGINT,
              display_name VARCHAR,
              orcid VARCHAR
            );

            INSERT INTO author_works VALUES
              (99, 7, 'last', false),
              (99, 3, 'first', true);

            INSERT INTO author_profiles VALUES
              (3, 'First Author', 'https://orcid.org/0000-0001'),
              (7, 'Last Author', NULL);
            """
        )

        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            rows = build_work_author_buckets(
                connection,
                directory,
            )

            payloads = []

            for path in directory.glob("*.jsonl"):
                payloads.extend(
                    json.loads(line)
                    for line in path.read_text(
                        encoding="utf-8"
                    ).splitlines()
                )

        self.assertEqual(rows, 1)
        self.assertEqual(payloads[0]["wid"], 99)
        self.assertEqual(
            [author["n"] for author in payloads[0]["a"]],
            ["First Author", "Last Author"],
        )
        self.assertTrue(payloads[0]["a"][0]["r"])


if __name__ == "__main__":
    unittest.main()

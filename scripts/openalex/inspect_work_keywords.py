from pathlib import Path
from urllib.parse import quote

import duckdb

from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile


REPO_ID = "Mearman/OpenAlex"
PATH = "data/works/keywords"


api = HfApi()


files = [
    entry
    for entry in api.list_repo_tree(
        repo_id=REPO_ID,
        repo_type="dataset",
        path_in_repo=PATH,
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


print("=" * 78)
print("OPENALEX WORK KEYWORDS")
print("=" * 78)

print(
    "Shards:",
    f"{len(files):,}"
)


total_bytes = sum(
    int(
        entry.size
        or 0
    )
    for entry in files
)


print(
    "Tamaño total:",
    f"{total_bytes / 1024**3:.2f} GiB"
)


if not files:

    raise SystemExit(
        "❌ No encontré shards"
    )


largest = max(
    files,
    key=lambda entry:
        int(
            entry.size
            or 0
        )
)


smallest = min(
    files,
    key=lambda entry:
        int(
            entry.size
            or 0
        )
)


def basename(entry):

    return Path(
        entry.path
    ).name


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


print()
print(
    "Shard menor:",
    basename(
        smallest
    ),
    f"{int(smallest.size or 0) / 1024**2:.2f} MiB"
)

print(
    "Shard mayor:",
    basename(
        largest
    ),
    f"{int(largest.size or 0) / 1024**2:.2f} MiB"
)


# Usamos el mayor para comprobar que el esquema
# sea representativo de las particiones modernas.

target = largest


url = remote_url(
    target
).replace(
    "'",
    "''"
)


relation = (
    f"read_parquet('{url}')"
)


con = duckdb.connect()

con.execute(
    "INSTALL httpfs"
)

con.execute(
    "LOAD httpfs"
)

con.execute(
    "SET threads = 4"
)


print()
print("=" * 78)
print("ESQUEMA")
print("=" * 78)


schema = con.execute(
    f"""
    DESCRIBE

    SELECT *
    FROM {relation}
    """
).fetchall()


for row in schema:

    print(
        f"{row[0]:35} "
        f"{row[1]}"
    )


columns = {
    str(row[0])
    for row in schema
}


print()
print("=" * 78)
print("MUESTRA")
print("=" * 78)


rows = con.execute(
    f"""
    SELECT *
    FROM {relation}

    LIMIT 30
    """
).fetchall()


for row in rows:

    print(row)


print()
print("=" * 78)
print("ESTADÍSTICAS")
print("=" * 78)


row_count = con.execute(
    f"""
    SELECT count(*)
    FROM {relation}
    """
).fetchone()[0]


print(
    "Relaciones:",
    f"{row_count:,}"
)


if "work_id" in columns:

    unique_works = con.execute(
        f"""
        SELECT
            count(
                DISTINCT work_id
            )

        FROM {relation}
        """
    ).fetchone()[0]

    print(
        "Works únicos:",
        f"{unique_works:,}"
    )


if "keyword_id" in columns:

    unique_keywords = con.execute(
        f"""
        SELECT
            count(
                DISTINCT keyword_id
            )

        FROM {relation}
        """
    ).fetchone()[0]

    print(
        "Keywords únicas:",
        f"{unique_keywords:,}"
    )


    print()
    print("=" * 78)
    print("TOP KEYWORDS DEL SHARD")
    print("=" * 78)


    top_keywords = con.execute(
        f"""
        SELECT
            keyword_id,
            count(*) AS n,

            avg(score)
                AS mean_score,

            max(score)
                AS max_score

        FROM {relation}

        GROUP BY
            keyword_id

        ORDER BY
            n DESC

        LIMIT 50
        """
    ).fetchall()


    for row in top_keywords:

        print(
            f"{str(row[0]):55} "
            f"n={int(row[1]):8,} "
            f"mean={float(row[2] or 0):.3f} "
            f"max={float(row[3] or 0):.3f}"
        )


    print()
    print("=" * 78)
    print("KEYWORDS DE WORKS INDIVIDUALES")
    print("=" * 78)


    works = con.execute(
        f"""
        SELECT work_id

        FROM {relation}

        GROUP BY
            work_id

        HAVING
            count(*) >= 5

        ORDER BY
            hash(work_id)

        LIMIT 10
        """
    ).fetchall()


    for work_row in works:

        work_id = int(
            work_row[0]
        )


        print()
        print(
            "WORK",
            work_id
        )


        keyword_rows = con.execute(
            f"""
            SELECT
                keyword_id,
                score

            FROM {relation}

            WHERE
                work_id = ?

            ORDER BY
                score DESC,
                keyword_id

            LIMIT 20
            """,
            [
                work_id
            ]
        ).fetchall()


        for keyword_id, score in keyword_rows:

            print(
                " ",
                f"{float(score or 0):.3f}",
                keyword_id
            )


print()
print("=" * 78)
print("FIN")
print("=" * 78)

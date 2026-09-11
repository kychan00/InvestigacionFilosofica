from urllib.parse import quote

import duckdb

from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile


REPO_ID = "Mearman/OpenAlex"

api = HfApi()


print("=" * 78)
print("RELACIONES DE WORKS")
print("=" * 78)


entries = list(
    api.list_repo_tree(
        repo_id=REPO_ID,
        repo_type="dataset",
        path_in_repo="data/works",
        recursive=False,
        expand=False,
        revision="main",
        token=False,
    )
)


for entry in entries:

    path = getattr(
        entry,
        "path",
        ""
    )

    print(
        type(entry).__name__,
        path
    )


candidate_paths = []

for entry in entries:

    path = getattr(
        entry,
        "path",
        ""
    )

    basename = (
        path.rstrip("/")
        .rsplit("/", 1)[-1]
        .lower()
    )

    if "abstract" in basename:

        candidate_paths.append(
            path
        )


print()
print("=" * 78)
print("CANDIDATOS ABSTRACT")
print("=" * 78)


if not candidate_paths:

    print(
        "❌ No encontré carpeta con "
        "'abstract' en data/works"
    )

    raise SystemExit(1)


for path in candidate_paths:
    print(path)


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


for path in candidate_paths:

    files = [
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


    print()
    print("=" * 78)
    print(path.upper())
    print("=" * 78)

    print(
        "Shards:",
        f"{len(files):,}"
    )


    total_bytes = sum(
        int(
            entry.size or 0
        )
        for entry in files
    )


    print(
        "Tamaño:",
        f"{total_bytes / 1024**3:.2f} GiB"
    )


    if not files:
        continue


    largest = max(
        files,
        key=lambda entry:
            int(
                entry.size or 0
            )
    )


    print()
    print(
        "Shard:",
        largest.path
    )


    url = remote_url(
        largest
    ).replace(
        "'",
        "''"
    )


    relation = (
        f"read_parquet('{url}')"
    )


    print()
    print("ESQUEMA")
    print("-" * 78)


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


    print()
    print("MUESTRA")
    print("-" * 78)


    rows = con.execute(
        f"""
        SELECT *
        FROM {relation}
        LIMIT 10
        """
    ).fetchall()


    for row in rows:

        print(row)


    columns = {
        row[0]
        for row in schema
    }


    if "work_id" in columns:

        unique_query = f"""
        SELECT
            count(
                DISTINCT work_id
            )
        FROM {relation}
        """

        unique_works = con.execute(
            unique_query
        ).fetchone()[0]

        print()
        print(
            "Works únicos en shard:",
            f"{unique_works:,}"
        )


print()
print("=" * 78)
print("FIN")
print("=" * 78)

from urllib.parse import quote

import duckdb

from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile


REPO_ID = "Mearman/OpenAlex"

TABLES = {
    "works/topics": [
        "data/works/topics",
        "data/works/work_topics",
    ],

    "works/authorships": [
        "data/works/authorships",
        "data/works/work_authorships",
    ],

    "topics/main": [
        "data/topics/main",
    ],

    "authors/main": [
        "data/authors/main",
    ],
}


api = HfApi()

con = duckdb.connect()

con.execute(
    "INSTALL httpfs"
)

con.execute(
    "LOAD httpfs"
)


def discover(label, candidates):

    for path in candidates:

        print()
        print(
            f"Probando {label}: {path}"
        )

        try:
            entries = list(
                api.list_repo_tree(
                    repo_id=REPO_ID,
                    repo_type="dataset",
                    path_in_repo=path,
                    recursive=True,
                    expand=False,
                    revision="main",
                    token=False,
                )
            )

        except Exception as exc:
            print(
                f"  ✗ {type(exc).__name__}"
            )
            continue


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


        if files:
            return (
                path,
                files
            )


    return (
        None,
        []
    )


for label, candidates in TABLES.items():

    path, files = discover(
        label,
        candidates
    )


    print()
    print("=" * 72)
    print(label.upper())
    print("=" * 72)


    if not files:
        print(
            "❌ No encontramos Parquet"
        )
        continue


    total = sum(
        int(
            file.size or 0
        )
        for file in files
    )


    print(
        f"Ruta: {path}"
    )

    print(
        f"Shards: {len(files):,}"
    )

    print(
        f"Tamaño: "
        f"{total / 1_000_000_000:.2f} GB"
    )

    print(
        f"Tamaño: "
        f"{total / 1024**3:.2f} GiB"
    )


    largest = max(
        files,
        key=lambda file:
            int(
                file.size or 0
            )
    )


    url = (
        "https://huggingface.co/datasets/"
        "Mearman/OpenAlex/resolve/main/"
        +
        quote(
            largest.path,
            safe="/="
        )
    )


    print()
    print(
        "Shard inspeccionado:"
    )

    print(
        largest.path
    )

    print()
    print("ESQUEMA")
    print("-" * 72)


    rows = con.execute(
        """
        DESCRIBE
        SELECT *
        FROM read_parquet(?)
        """,
        [url]
    ).fetchall()


    for row in rows:
        print(
            f"{row[0]:40} {row[1]}"
        )


    print()
    print("MUESTRA")
    print("-" * 72)


    sample = con.execute(
        """
        SELECT *
        FROM read_parquet(?)
        LIMIT 3
        """,
        [url]
    ).fetchall()


    for row in sample:
        print(row)

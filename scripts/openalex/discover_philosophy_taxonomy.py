from pathlib import Path
from urllib.parse import quote

import duckdb

from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile


REPO_ID = "Mearman/OpenAlex"

TABLE_PATHS = {
    "topics_main":
        "data/topics/main",

    "topics_subfields":
        "data/topics/subfields",

    "subfields_main":
        "data/subfields/main",

    "subfields_fields":
        "data/subfields/fields",

    "fields_main":
        "data/fields/main",
}


api = HfApi()

con = duckdb.connect()

con.execute(
    "INSTALL httpfs"
)

con.execute(
    "LOAD httpfs"
)


def parquet_urls(path):

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

    if not files:
        raise RuntimeError(
            f"No encontré Parquet en {path}"
        )

    return [
        (
            "https://huggingface.co/datasets/"
            "Mearman/OpenAlex/resolve/main/"
            + quote(
                entry.path,
                safe="/="
            )
        )
        for entry in files
    ]


def relation(name):

    urls = parquet_urls(
        TABLE_PATHS[name]
    )

    sql_urls = ", ".join(
        "'" +
        url.replace(
            "'",
            "''"
        ) +
        "'"
        for url in urls
    )

    return (
        f"read_parquet([{sql_urls}])"
    )


topics_main = relation(
    "topics_main"
)

topics_subfields = relation(
    "topics_subfields"
)

subfields_main = relation(
    "subfields_main"
)

subfields_fields = relation(
    "subfields_fields"
)

fields_main = relation(
    "fields_main"
)


print("=" * 76)
print("SUBFIELDS QUE CONTIENEN 'PHILOSOPH'")
print("=" * 76)

subfields = con.execute(
    f"""
    SELECT
        subfield_id,
        display_name,
        description,
        works_count,
        cited_by_count
    FROM {subfields_main}
    WHERE
        lower(display_name)
            LIKE '%philosoph%'
        OR
        lower(coalesce(description, ''))
            LIKE '%philosoph%'
    ORDER BY
        works_count DESC
    """
).fetchall()


for row in subfields:
    print(row)


philosophy = con.execute(
    f"""
    SELECT
        subfield_id,
        display_name
    FROM {subfields_main}
    WHERE
        lower(display_name)
        = 'philosophy'
    LIMIT 1
    """
).fetchone()


if not philosophy:
    raise SystemExit(
        "❌ No encontré el subfield Philosophy"
    )


philosophy_id = philosophy[0]


print()
print("=" * 76)
print("SUBFIELD PRINCIPAL")
print("=" * 76)

print(
    "Philosophy subfield_id:",
    philosophy_id
)


print()
print("=" * 76)
print("FIELD DE PHILOSOPHY")
print("=" * 76)

field_rows = con.execute(
    f"""
    SELECT
        f.field_id,
        f.display_name
    FROM {subfields_fields} sf
    JOIN {fields_main} f
        ON f.field_id =
           sf.field_id
    WHERE
        sf.subfield_id = ?
    """,
    [philosophy_id]
).fetchall()


for row in field_rows:
    print(row)


print()
print("=" * 76)
print("TOPICS DEL SUBFIELD PHILOSOPHY")
print("=" * 76)

topics = con.execute(
    f"""
    SELECT
        t.topic_id,
        t.display_name,
        t.works_count,
        t.cited_by_count,
        t.description
    FROM {topics_subfields} ts
    JOIN {topics_main} t
        ON t.topic_id =
           ts.topic_id
    WHERE
        ts.subfield_id = ?
    ORDER BY
        t.works_count DESC,
        t.display_name
    """,
    [philosophy_id]
).fetchall()


print(
    f"Topics Philosophy: {len(topics):,}"
)

print()


for row in topics:
    topic_id = row[0]
    name = row[1]
    works_count = row[2]

    print(
        f"{topic_id:6}  "
        f"{works_count:10,}  "
        f"{name}"
    )


total_works = sum(
    row[2] or 0
    for row in topics
)


print()
print("=" * 76)
print("ESTIMACIÓN")
print("=" * 76)

print(
    "Suma works_count de topics:",
    f"{total_works:,}"
)

print(
    "(No equivale a works únicos;"
    " una obra puede pertenecer"
    " a varios topics.)"
)


output = Path(
    "/tmp/openalex-philosophy-topics.tsv"
)

with output.open(
    "w",
    encoding="utf-8"
) as handle:

    handle.write(
        "topic_id\t"
        "display_name\t"
        "works_count\t"
        "cited_by_count\t"
        "description\n"
    )

    for row in topics:

        clean = [
            str(
                value
                if value is not None
                else ""
            ).replace(
                "\t",
                " "
            ).replace(
                "\n",
                " "
            )
            for value in row
        ]

        handle.write(
            "\t".join(clean)
            + "\n"
        )


print()
print(
    "✓ Guardado:",
    output
)

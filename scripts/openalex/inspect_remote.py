import json
from pathlib import Path
from urllib.parse import quote

import duckdb


manifest = json.loads(
    Path(
        "/tmp/openalex-work-main-files.json"
    ).read_text()
)


if not manifest:
    raise SystemExit(
        "Manifest vacío."
    )


# Elegimos un shard razonablemente grande
# para asegurarnos de que la prueba es real.
candidate = max(
    manifest,
    key=lambda row:
        row["size"]
)


path = candidate["path"]

url = (
    "https://huggingface.co/datasets/"
    "Mearman/OpenAlex/resolve/main/"
    + quote(
        path,
        safe="/="
    )
)


print("=" * 70)
print("SHARD REMOTO")
print("=" * 70)
print(path)
print()
print(
    f"Tamaño físico: "
    f"{candidate['size'] / 1024**2:.2f} MiB"
)
print()


con = duckdb.connect()


con.execute(
    "INSTALL httpfs"
)

con.execute(
    "LOAD httpfs"
)


print("=" * 70)
print("ESQUEMA")
print("=" * 70)

schema = con.execute(
    """
    DESCRIBE
    SELECT *
    FROM read_parquet(?)
    """,
    [url]
).fetchall()


for row in schema:
    print(
        f"{row[0]:35} {row[1]}"
    )


print()
print("=" * 70)
print("MUESTRA MÍNIMA")
print("=" * 70)


# SELECT * sólo para 2 filas.
# Después quitaremos esto y seleccionaremos
# únicamente columnas necesarias.
rows = con.execute(
    """
    SELECT *
    FROM read_parquet(?)
    LIMIT 2
    """,
    [url]
).fetchall()


for row in rows:
    print(row)
    print()

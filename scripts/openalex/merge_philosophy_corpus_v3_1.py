import json
from pathlib import Path

import duckdb


ROOT = Path(
    "artifacts/openalex/full-v3-1"
)

PARTS = ROOT / "parts"

FULL = (
    ROOT /
    "philosophy-corpus-v3-1-full.parquet"
)

COMPACT = (
    ROOT /
    "philosophy-corpus-v3-1-compact.parquet"
)

SEARCH = (
    ROOT /
    "philosophy-corpus-v3-1-search.parquet"
)

SUMMARY = (
    ROOT /
    "philosophy-corpus-v3-1-summary.json"
)


files = sorted(
    PARTS.glob(
        "part-*.parquet"
    )
)


print("=" * 78)
print("MERGE OPENALEX PHILOSOPHY CORPUS V3.1")
print("=" * 78)

print(
    "Particiones encontradas:",
    len(files)
)


if not files:
    raise SystemExit(
        "No se encontraron particiones"
    )


for path in files:
    print(
        " -",
        path.name,
        f"{path.stat().st_size / 1024**2:.2f} MiB"
    )


ROOT.mkdir(
    parents=True,
    exist_ok=True
)


con = duckdb.connect()


quoted = ", ".join(
    "'"
    +
    str(path).replace(
        "'",
        "''"
    )
    +
    "'"

    for path in files
)


con.execute(
    f"""
    CREATE VIEW corpus AS

    SELECT *
    FROM read_parquet(
        [{quoted}],
        union_by_name = true
    )
    """
)


total = con.execute(
    """
    SELECT count(*)
    FROM corpus
    """
).fetchone()[0]


unique_works = con.execute(
    """
    SELECT
        count(
            DISTINCT work_id
        )

    FROM corpus
    """
).fetchone()[0]


duplicates = (
    total
    -
    unique_works
)


print()
print(
    "Filas:",
    f"{total:,}"
)

print(
    "Works únicos:",
    f"{unique_works:,}"
)

print(
    "Duplicados:",
    f"{duplicates:,}"
)


if duplicates:
    raise SystemExit(
        "❌ Hay work_id duplicados entre particiones"
    )


tier_rows = con.execute(
    """
    SELECT
        tier,
        count(*) AS n

    FROM corpus

    GROUP BY tier

    ORDER BY
        CASE tier
            WHEN 'CORE' THEN 1
            WHEN 'PROBABLE' THEN 2
            WHEN 'BORDERLINE' THEN 3
            WHEN 'EXCLUDE' THEN 4
            ELSE 5
        END
    """
).fetchall()


role_rows = con.execute(
    """
    SELECT
        document_role,
        count(*) AS n

    FROM corpus

    GROUP BY
        document_role

    ORDER BY
        n DESC
    """
).fetchall()


print()
print("=" * 78)
print("TIER GLOBAL")
print("=" * 78)

for tier, count in tier_rows:

    print(
        f"{tier:12} "
        f"{int(count):10,} "
        f"{int(count) / max(total, 1) * 100:6.2f}%"
    )


print()
print("=" * 78)
print("ROLES GLOBALES")
print("=" * 78)

for role, count in role_rows:

    print(
        f"{role:22} "
        f"{int(count):10,} "
        f"{int(count) / max(total, 1) * 100:6.2f}%"
    )


# ============================================================
# Corpus completo
# ============================================================

full_sql = str(
    FULL
).replace(
    "'",
    "''"
)


con.execute(
    f"""
    COPY (
        SELECT *
        FROM corpus
    )

    TO '{full_sql}'
    (
        FORMAT PARQUET,
        COMPRESSION ZSTD
    )
    """
)


# ============================================================
# Compacto:
# conserva las señales necesarias para ranking / auditoría,
# pero no arrastra el abstract completo.
# ============================================================

compact_sql = str(
    COMPACT
).replace(
    "'",
    "''"
)


con.execute(
    f"""
    COPY (

        SELECT
            work_id,

            tier,
            tier_reason,

            document_role,
            evidence_score,

            primary_concept_id,
            concept_score,
            philosophy_concept_count,

            generic_philosophy_score,
            secondary_philosophy_score,
            nonduplicate_philosophy_score,

            ontology_keyword_id,
            ontology_keyword_score,
            ontology_keyword_count,

            philosopher_hits,
            explicit_philosophy_text,

            strong_title_hits,
            strong_abstract_hits,

            is_paratext,

            publication_year,
            language,
            type,
            title

        FROM corpus
    )

    TO '{compact_sql}'
    (
        FORMAT PARQUET,
        COMPRESSION ZSTD
    )
    """
)


# ============================================================
# Candidatos utilizables por buscador.
#
# No eliminamos BORDERLINE del corpus general.
# Aquí sólo creamos una versión de alta confianza.
# ============================================================

search_sql = str(
    SEARCH
).replace(
    "'",
    "''"
)


con.execute(
    f"""
    COPY (

        SELECT
            work_id,

            tier,
            document_role,
            evidence_score,

            primary_concept_id,
            concept_score,

            nonduplicate_philosophy_score,

            ontology_keyword_id,
            ontology_keyword_score,

            publication_year,
            language,
            type,
            title

        FROM corpus

        WHERE
            tier IN (
                'CORE',
                'PROBABLE'
            )

            AND
            document_role NOT IN (
                'LOW_QUALITY',
                'PARATEXT'
            )
    )

    TO '{search_sql}'
    (
        FORMAT PARQUET,
        COMPRESSION ZSTD
    )
    """
)


search_count = con.execute(
    """
    SELECT count(*)

    FROM corpus

    WHERE
        tier IN (
            'CORE',
            'PROBABLE'
        )

        AND
        document_role NOT IN (
            'LOW_QUALITY',
            'PARATEXT'
        )
    """
).fetchone()[0]


summary = {
    "total_rows": int(total),
    "unique_works": int(unique_works),
    "duplicates": int(duplicates),
    "search_candidates": int(
        search_count
    ),
    "tiers": {
        str(tier):
            int(count)

        for tier, count
        in tier_rows
    },
    "roles": {
        str(role):
            int(count)

        for role, count
        in role_rows
    },
    "files": {
        "full": {
            "path": str(FULL),
            "bytes": FULL.stat().st_size,
        },
        "compact": {
            "path": str(COMPACT),
            "bytes": COMPACT.stat().st_size,
        },
        "search": {
            "path": str(SEARCH),
            "bytes": SEARCH.stat().st_size,
        },
    },
}


SUMMARY.write_text(
    json.dumps(
        summary,
        ensure_ascii=False,
        indent=2
    )
    + "\n",
    encoding="utf-8"
)


print()
print("=" * 78)
print("ARCHIVOS")
print("=" * 78)

for path in [
    FULL,
    COMPACT,
    SEARCH,
    SUMMARY,
]:

    print(
        path,
        f"{path.stat().st_size / 1024**2:.2f} MiB"
    )


print()
print(
    "Search candidates:",
    f"{search_count:,}"
)

print()
print("=" * 78)
print("FIN")
print("=" * 78)

import io
import json
import runpy
import time
import unicodedata
from contextlib import redirect_stdout
from pathlib import Path


BASE_SCRIPT = Path(
    "scripts/openalex/"
    "sample_philosophy_classifier_v2.py"
)

PHILOSOPHY_MAP = Path(
    "src/data/philosophy-map.json"
)

OUTPUT = Path(
    "artifacts/openalex/"
    "philosophy-v2-context-audit.parquet"
)


print("=" * 78)
print("OPENALEX V2 ABSTRACT + PARATEXT AUDIT")
print("=" * 78)

print()
print("Ejecutando classifier V2 base...")


# ============================================================
# Ejecutar V2 y conservar su conexión DuckDB / tablas.
#
# Su salida normal se oculta porque ya fue auditada.
# Si ocurre una excepción, el traceback sí aparecerá.
# ============================================================

buffer = io.StringIO()

with redirect_stdout(buffer):

    ns = runpy.run_path(
        str(BASE_SCRIPT)
    )


con = ns["con"]

discover = ns["discover"]
relation = ns["relation"]
basename = ns["basename"]

selected = ns["selected"]

main_by_key = ns["main_by_key"]

concept_names = ns["concept_names"]

ambiguous_ids = ns["ambiguous_ids"]


print(
    "✓ V2 listo"
)


# ============================================================
# Ontología local:
# filósofos del philosophy-map.
#
# Sólo se usa para mostrar evidencia textual.
# No excluye nada.
# ============================================================

ontology = json.loads(
    PHILOSOPHY_MAP.read_text(
        encoding="utf-8"
    )
)


def normalize_text(value):

    value = str(
        value
        or ""
    )

    value = unicodedata.normalize(
        "NFKD",
        value
    )

    value = (
        value.encode(
            "ascii",
            "ignore"
        )
        .decode(
            "ascii"
        )
        .lower()
    )

    return " ".join(
        value.split()
    )


philosopher_terms = {}


for philosopher in ontology.get(
    "philosophers",
    []
):

    canonical = philosopher.get(
        "name",
        ""
    )

    terms = {
        canonical,
        *philosopher.get(
            "aliases",
            []
        ),
    }

    for term in terms:

        normalized = normalize_text(
            term
        )

        if normalized:

            philosopher_terms[
                normalized
            ] = canonical


def philosopher_hits(
    title,
    abstract,
):

    text = normalize_text(
        f"{title or ''} "
        f"{abstract or ''}"
    )

    hits = []

    for term, canonical in (
        philosopher_terms.items()
    ):

        if term in text:
            hits.append(
                canonical
            )

    return sorted(
        set(
            hits
        )
    )


# ============================================================
# Abstract shards
# ============================================================

abstract_files = discover(
    "data/works/abstracts"
)


abstract_by_key = {
    basename(entry):
        entry

    for entry in abstract_files
}


selected_with_abstracts = [
    key
    for key in selected
    if key in abstract_by_key
]


print()
print("=" * 78)
print("SHARDS")
print("=" * 78)

print(
    "abstracts:",
    f"{len(abstract_files):,}"
)

print(
    "seleccionados V2:",
    len(selected)
)

print(
    "con abstract shard:",
    len(
        selected_with_abstracts
    )
)


if not selected_with_abstracts:

    raise SystemExit(
        "❌ No hay shards de abstracts alineados"
    )


# ============================================================
# Qué vamos a inspeccionar
#
# 1. TODOS los PROBABLE
# 2. TODOS los BORDERLINE
# 3. CORE sólo si el concepto pertenece al grupo ambiguo
#
# EXCLUDE no necesita abstract para esta auditoría.
# ============================================================

ambiguous_sql = (
    ", ".join(
        str(value)
        for value in sorted(
            ambiguous_ids
        )
    )
    or "-1"
)


con.execute(
    """
    DROP TABLE IF EXISTS
    context_audit
    """
)


con.execute(
    """
    CREATE TABLE context_audit (
        work_id BIGINT,

        tier VARCHAR,
        tier_reason VARCHAR,

        primary_concept_id BIGINT,
        concept_score DOUBLE,
        philosophy_concept_count BIGINT,

        generic_philosophy_score DOUBLE,
        secondary_philosophy_score DOUBLE,
        nonduplicate_philosophy_score DOUBLE,

        is_paratext BOOLEAN,

        title VARCHAR,
        publication_year BIGINT,
        language VARCHAR,
        type VARCHAR,

        abstract VARCHAR
    )
    """
)


start = time.time()


for number, shard_key in enumerate(
    selected_with_abstracts,
    start=1,
):

    main = relation(
        main_by_key[
            shard_key
        ]
    )

    abstracts = relation(
        abstract_by_key[
            shard_key
        ]
    )


    # --------------------------------------------------------
    # Obras de este shard que necesitan contexto.
    # --------------------------------------------------------

    con.execute(
        """
        DROP TABLE IF EXISTS
        shard_targets
        """
    )


    con.execute(
        f"""
        CREATE TEMP TABLE
        shard_targets AS

        SELECT
            c.work_id,

            c.tier,
            c.tier_reason,

            c.primary_concept_id,
            c.concept_score,
            c.philosophy_concept_count,

            c.generic_philosophy_score,
            c.secondary_philosophy_score,
            c.nonduplicate_philosophy_score,

            coalesce(
                m.is_paratext,
                false
            )
                AS is_paratext,

            c.title,
            c.publication_year,
            c.language,
            c.type

        FROM classified_v2 c

        JOIN {main} m
            ON m.work_id =
               c.work_id

        WHERE

            c.tier IN (
                'PROBABLE',
                'BORDERLINE'
            )

            OR
            (
                c.tier = 'CORE'

                AND
                c.primary_concept_id
                IN (
                    {ambiguous_sql}
                )
            )
        """
    )


    target_count = con.execute(
        """
        SELECT count(*)
        FROM shard_targets
        """
    ).fetchone()[0]


    if target_count == 0:

        print(
            f"[{number:2}/"
            f"{len(selected_with_abstracts):2}] "
            "targets=0"
        )

        continue


    # --------------------------------------------------------
    # Reconstruir abstract sólo para los work_id objetivo.
    #
    # works/abstracts:
    # work_id | word | positions[]
    # --------------------------------------------------------

    con.execute(
        """
        DROP TABLE IF EXISTS
        shard_abstracts
        """
    )


    con.execute(
        f"""
        CREATE TEMP TABLE
        shard_abstracts AS

        WITH tokens AS (

            SELECT
                a.work_id,
                a.word,
                pos

            FROM {abstracts} a

            JOIN shard_targets t
                ON t.work_id =
                   a.work_id

            CROSS JOIN
                UNNEST(
                    a.positions
                )
                AS p(pos)
        )

        SELECT
            work_id,

            string_agg(
                word,
                ' '
                ORDER BY pos
            )
                AS abstract

        FROM tokens

        GROUP BY
            work_id
        """
    )


    abstract_count = con.execute(
        """
        SELECT count(*)
        FROM shard_abstracts
        """
    ).fetchone()[0]


    con.execute(
        """
        INSERT INTO context_audit

        SELECT
            t.work_id,

            t.tier,
            t.tier_reason,

            t.primary_concept_id,
            t.concept_score,
            t.philosophy_concept_count,

            t.generic_philosophy_score,
            t.secondary_philosophy_score,
            t.nonduplicate_philosophy_score,

            t.is_paratext,

            t.title,
            t.publication_year,
            t.language,
            t.type,

            a.abstract

        FROM shard_targets t

        LEFT JOIN shard_abstracts a
            ON a.work_id =
               t.work_id
        """
    )


    running_total = con.execute(
        """
        SELECT count(*)
        FROM context_audit
        """
    ).fetchone()[0]


    print(
        f"[{number:2}/"
        f"{len(selected_with_abstracts):2}] "
        f"targets={target_count:,} "
        f"abstracts={abstract_count:,} "
        f"total={running_total:,} "
        f"tiempo={time.time() - start:.1f}s"
    )


# ============================================================
# Cobertura por tier
# ============================================================

print()
print("=" * 78)
print("COBERTURA ABSTRACT POR TIER")
print("=" * 78)


rows = con.execute(
    """
    SELECT
        tier,

        count(*) AS total,

        count(*)
            FILTER (
                WHERE
                    abstract IS NOT NULL

                    AND length(
                        trim(
                            abstract
                        )
                    ) > 0
            )
            AS with_abstract,

        count(*)
            FILTER (
                WHERE
                    is_paratext
            )
            AS paratext,

        count(*)
            FILTER (
                WHERE

                    lower(
                        coalesce(
                            title,
                            ''
                        )
                        ||
                        ' '
                        ||
                        coalesce(
                            abstract,
                            ''
                        )
                    )
                    LIKE
                    '%philosoph%'

                    OR

                    lower(
                        coalesce(
                            title,
                            ''
                        )
                        ||
                        ' '
                        ||
                        coalesce(
                            abstract,
                            ''
                        )
                    )
                    LIKE
                    '%filosof%'
            )
            AS explicit_philosophy_text

    FROM context_audit

    GROUP BY
        tier

    ORDER BY
        CASE tier
            WHEN 'CORE'
                THEN 1
            WHEN 'PROBABLE'
                THEN 2
            WHEN 'BORDERLINE'
                THEN 3
            ELSE 4
        END
    """
).fetchall()


for row in rows:

    tier = row[0]
    total = int(
        row[1]
    )

    with_abstract = int(
        row[2]
    )

    paratext = int(
        row[3]
    )

    explicit = int(
        row[4]
    )

    print()

    print(
        f"{tier:12} "
        f"n={total:6,}"
    )

    print(
        "  abstract:",
        f"{with_abstract:6,}",
        f"({with_abstract / max(total, 1) * 100:5.1f}%)"
    )

    print(
        "  is_paratext:",
        f"{paratext:6,}",
        f"({paratext / max(total, 1) * 100:5.1f}%)"
    )

    print(
        "  texto explícito filosofía:",
        f"{explicit:6,}",
        f"({explicit / max(total, 1) * 100:5.1f}%)"
    )


# ============================================================
# Mostrar casos
# ============================================================

def show_examples(
    where_sql,
    label,
    limit=25,
):

    print()
    print("=" * 78)
    print(label)
    print("=" * 78)


    rows = con.execute(
        f"""
        SELECT
            work_id,

            tier,
            tier_reason,

            primary_concept_id,
            concept_score,
            philosophy_concept_count,

            generic_philosophy_score,
            secondary_philosophy_score,
            nonduplicate_philosophy_score,

            is_paratext,

            title,
            abstract

        FROM context_audit

        WHERE
            {where_sql}

        ORDER BY
            hash(work_id)

        LIMIT {limit}
        """
    ).fetchall()


    for row in rows:

        concept = concept_names.get(
            int(
                row[3]
            ),
            "?"
        )

        generic = (
            "—"
            if row[6] is None
            else f"{row[6]:.3f}"
        )

        secondary = (
            "—"
            if row[7] is None
            else f"{row[7]:.3f}"
        )

        title = " ".join(
            str(
                row[10]
                or "(sin título)"
            ).split()
        )

        abstract = " ".join(
            str(
                row[11]
                or "(sin abstract)"
            ).split()
        )

        philosophers = philosopher_hits(
            title,
            abstract
        )


        print()

        print(
            f"{row[1]}  "
            f"concept={row[4]:.3f}  "
            f"n={row[5]}  "
            f"generic={generic}  "
            f"secondary={secondary}  "
            f"nondup={row[8]:.3f}"
        )

        print(
            "ANCLA:",
            concept
        )

        print(
            "RAZÓN:",
            row[2]
        )

        print(
            "PARATEXT:",
            bool(
                row[9]
            )
        )

        if philosophers:

            print(
                "FILÓSOFOS:",
                ", ".join(
                    philosophers
                )
            )

        print(
            "TÍTULO:",
            title[:220]
        )

        print(
            "ABSTRACT:",
            abstract[:800]
        )


# ------------------------------------------------------------
# 1. ¿is_paratext identifica realmente anuncios/prefacios/etc?
# ------------------------------------------------------------

show_examples(
    """
    is_paratext
    """,
    "PARATEXT FLAGGED",
    limit=35,
)


# ------------------------------------------------------------
# 2. CORE en conceptos donde sabemos que hay ambigüedad.
#    Sirve para comprobar precisión del CORE.
# ------------------------------------------------------------

show_examples(
    """
    tier = 'CORE'

    AND abstract IS NOT NULL
    """,
    "CORE AMBIGUO + ABSTRACT",
    limit=35,
)


# ------------------------------------------------------------
# 3. Incertidumbre sin corroboración de metadatos,
#    pero con abstract disponible.
# ------------------------------------------------------------

show_examples(
    """
    tier IN (
        'PROBABLE',
        'BORDERLINE'
    )

    AND
        nonduplicate_philosophy_score
        < 0.25

    AND
        abstract IS NOT NULL
    """,
    "INCERTIDUMBRE + ABSTRACT",
    limit=45,
)


# ------------------------------------------------------------
# 4. Casos inciertos cuyo título/abstract sí dice
#    explícitamente philosophy / filosofía / philosophie...
# ------------------------------------------------------------

show_examples(
    """
    tier IN (
        'PROBABLE',
        'BORDERLINE'
    )

    AND
        abstract IS NOT NULL

    AND
        (
            lower(
                coalesce(
                    title,
                    ''
                )
                ||
                ' '
                ||
                coalesce(
                    abstract,
                    ''
                )
            )
            LIKE
            '%philosoph%'

            OR

            lower(
                coalesce(
                    title,
                    ''
                )
                ||
                ' '
                ||
                coalesce(
                    abstract,
                    ''
                )
            )
            LIKE
            '%filosof%'
        )
    """,
    "INCERTIDUMBRE + TEXTO FILOSÓFICO EXPLÍCITO",
    limit=45,
)


# ============================================================
# Guardar
# ============================================================

OUTPUT.parent.mkdir(
    parents=True,
    exist_ok=True
)


safe_output = str(
    OUTPUT
).replace(
    "'",
    "''"
)


con.execute(
    f"""
    COPY (
        SELECT *
        FROM context_audit
    )

    TO '{safe_output}'
    (
        FORMAT PARQUET,
        COMPRESSION ZSTD
    )
    """
)


print()
print("=" * 78)
print("ARCHIVO")
print("=" * 78)

print(
    OUTPUT,
    f"{OUTPUT.stat().st_size / 1024**2:.2f} MiB"
)

print()
print(
    "Tiempo contexto:",
    f"{time.time() - start:.1f}s"
)

print()
print("=" * 78)
print("FIN")
print("=" * 78)

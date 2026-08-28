import json
import time
from pathlib import Path
from urllib.parse import quote

import duckdb

from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile


REPO_ID = "Mearman/OpenAlex"
SAMPLE_SHARDS = 50

OUTPUT_DIR = Path(
    "artifacts/openalex"
)
OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ------------------------------------------------------------
# Conceptos de alta especificidad filosófica.
#
# Dejamos fuera deliberadamente:
#   Philosophy
#   Interpretation (philosophy)
#   Quality (philosophy)
#   Class (philosophy)
#   Simple (philosophy)
#   Property (philosophy)
#   Agency (philosophy)
#
# porque son demasiado generales.
# ------------------------------------------------------------

STRONG_NAMES = {
    "epistemology",
    "aesthetics",
    "ontology",
    "phenomenology (philosophy)",
    "metaphysics",
    "philosophy of science",
    "existentialism",
    "contemporary philosophy",
    "history of philosophy",
    "philosophy of religion",
    "moral philosophy",
    "philosophical methodology",
    "applied philosophy",
    "western philosophy",
    "feminist philosophy",
    "functionalism (philosophy of mind)",
    "philosophy of logic",
    "philosophy of history",
    "continental philosophy",
    "history and philosophy of science",
    "philosophical anthropology",
    "ancient philosophy",
    "philosophical theology",
    "practical philosophy",
    "philosophical logic",
    "philosophy of mathematics",
    "medieval philosophy",
    "environmental philosophy",
    "critical philosophy",
    "african philosophy",
    "process philosophy",
    "philosophy of physics",
    "indian philosophy",
    "political philosophy",
    "marxist philosophy",
    "philosophy of language",
    "philosophy of mind",
    "philosophy of law",
    "analytic philosophy",
    "social philosophy",
    "philosophy of medicine",
    "chinese philosophy",
    "philosophy of biology",
    "islamic philosophy",
    "philosophy of technology",
    "philosophy of computer science",
    "experimental philosophy",
    "transcendental philosophy",
    "buddhist philosophy",
    "religious philosophy",
    "ordinary language philosophy",
    "philosophical realism",
    "eastern philosophy",
    "metaphilosophy",
    "jewish philosophy",
    "christian philosophy",
}


# ------------------------------------------------------------
# Conceptos demasiado amplios para actuar como ancla.
#
# Siguen siendo filosóficamente importantes, pero OpenAlex
# los aplica de manera masiva fuera de filosofía.
#
# Los recuperaremos después sólo cuando exista evidencia
# adicional en título, resumen u otros conceptos.
# ------------------------------------------------------------

BROAD_NAMES = {
    "epistemology",
    "aesthetics",
    "ontology",
    "contemporary philosophy",
}

STRONG_NAMES -= BROAD_NAMES


# ------------------------------------------------------------
# Evidencia textual filosófica.
#
# Se usa para recuperar trabajos con concept_score moderado
# cuando el propio título ofrece corroboración independiente.
# ------------------------------------------------------------

PHILOSOPHY_TITLE_TERMS = {
    "philosoph",
    "metaphys",
    "epistem",
    "ontolog",
    "phenomenolog",
    "existential",
    "hermeneut",
    "dialectic",
    "aesthetic",
    "ethic",
    "morality",
    "moral",
    "free will",
    "intentionality",
    "consciousness",
    "being",
    "knowledge",
    "truth",
    "virtue",
    "justice",
    "rationality",
    "subjectivity",
    "objectivity",
    "normativity",
    "pragmatism",
    "utilitarian",
    "deontolog",
    "kant",
    "hegel",
    "heidegger",
    "husserl",
    "nietzsche",
    "wittgenstein",
    "aristotle",
    "plato",
    "socrates",
    "descartes",
    "hume",
    "spinoza",
    "leibniz",
    "locke",
    "rousseau",
    "kierkegaard",
    "sartre",
    "beauvoir",
    "foucault",
    "derrida",
    "deleuze",
    "rawls",
    "habermas",
    "marx",
    "whitehead",
}


AMBIGUOUS_CONCEPT_NAMES = {
    "phenomenology (philosophy)",
    "existentialism",
    "philosophy of medicine",
    "philosophy of biology",
    "philosophy of computer science",
    "philosophy of technology",
    "environmental philosophy",
    "applied philosophy",
    "social philosophy",
}



api = HfApi()

con = duckdb.connect(
    "/tmp/openalex-philosophy-concepts.duckdb"
)

con.execute("INSTALL httpfs")
con.execute("LOAD httpfs")

con.execute("SET threads = 4")
con.execute(
    "SET preserve_insertion_order = false"
)


def discover(path):

    return [
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


def relation(entries):

    if not isinstance(
        entries,
        list
    ):
        entries = [entries]

    urls = [
        remote_url(entry)
        for entry in entries
    ]

    quoted = ", ".join(
        "'"
        +
        url.replace(
            "'",
            "''"
        )
        +
        "'"
        for url in urls
    )

    return (
        "read_parquet(["
        +
        quoted
        +
        "])"
    )


def basename(entry):

    return Path(
        entry.path
    ).name


def spread(values, count):

    values = sorted(values)

    if len(values) <= count:
        return values

    indexes = []

    for i in range(count):

        index = round(
            i
            *
            (
                len(values) - 1
            )
            /
            (
                count - 1
            )
        )

        if index not in indexes:
            indexes.append(index)

    return [
        values[index]
        for index in indexes
    ]


# ------------------------------------------------------------
# 1. Resolver nombres -> concept_id usando concepts/main
# ------------------------------------------------------------

concept_main_files = discover(
    "data/concepts/main"
)

concept_main = relation(
    concept_main_files
)


names_sql = ", ".join(
    "'"
    +
    name.replace(
        "'",
        "''"
    )
    +
    "'"
    for name in sorted(
        STRONG_NAMES
    )
)


concept_rows = con.execute(
    f"""
    SELECT
        concept_id,
        display_name,
        level,
        works_count

    FROM {concept_main}

    WHERE
        lower(display_name)
        IN ({names_sql})

    ORDER BY
        lower(display_name)
    """
).fetchall()


concept_names = {
    int(row[0]):
        row[1]
    for row in concept_rows
}


found_names = {
    str(row[1]).lower()
    for row in concept_rows
}


missing = sorted(
    STRONG_NAMES
    -
    found_names
)


print("=" * 78)
print("CONCEPTOS FILOSÓFICOS ESPECÍFICOS")
print("=" * 78)

print(
    "Solicitados:",
    len(STRONG_NAMES)
)

print(
    "Encontrados:",
    len(concept_rows)
)


for row in concept_rows:

    print(
        f"{int(row[0]):12}  "
        f"level={str(row[2]):3}  "
        f"works={int(row[3] or 0):10,}  "
        f"{row[1]}"
    )


if missing:

    print()
    print("NO ENCONTRADOS")

    for name in missing:
        print(
            " -",
            name
        )


if not concept_rows:

    raise SystemExit(
        "❌ No se resolvieron conceptos"
    )


concept_ids = sorted(
    concept_names
)


concept_ids_sql = ", ".join(
    str(value)
    for value in concept_ids
)


# ------------------------------------------------------------
# 2. Alinear works/concepts y works/main
# ------------------------------------------------------------

work_concept_files = discover(
    "data/works/concepts"
)

work_main_files = discover(
    "data/works/main"
)


concepts_by_key = {
    basename(entry):
        entry
    for entry in work_concept_files
}


main_by_key = {
    basename(entry):
        entry
    for entry in work_main_files
}


aligned = sorted(
    set(concepts_by_key)
    &
    set(main_by_key)
)


selected = spread(
    aligned,
    SAMPLE_SHARDS
)


print()
print("=" * 78)
print("MUESTRA")
print("=" * 78)

print(
    "works/concepts:",
    f"{len(work_concept_files):,}"
)

print(
    "works/main:",
    f"{len(work_main_files):,}"
)

print(
    "alineados:",
    f"{len(aligned):,}"
)

print(
    "seleccionados:",
    len(selected)
)


# ------------------------------------------------------------
# 3. Tabla de resultados
# ------------------------------------------------------------

con.execute(
    """
    CREATE TABLE records (
        work_id BIGINT,

        primary_concept_id BIGINT,
        concept_score DOUBLE,
        philosophy_concept_count BIGINT,

        title VARCHAR,
        publication_year BIGINT,
        language VARCHAR,
        type VARCHAR,
        doi VARCHAR,

        cited_by_count BIGINT,

        open_access_is_oa BOOLEAN,
        open_access_oa_status VARCHAR,
        open_access_oa_url VARCHAR,

        has_fulltext BOOLEAN,
        has_content_pdf BOOLEAN
    )
    """
)


start = time.time()


for number, shard in enumerate(
    selected,
    start=1
):

    concepts = relation(
        concepts_by_key[
            shard
        ]
    )

    main = relation(
        main_by_key[
            shard
        ]
    )


    con.execute(
        f"""
        INSERT INTO records

        WITH hits AS (

            SELECT
                work_id,
                concept_id,
                score

            FROM {concepts}

            WHERE
                concept_id IN (
                    {concept_ids_sql}
                )
        ),

        aggregated AS (

            SELECT
                work_id,

                arg_max(
                    concept_id,
                    score
                )
                    AS primary_concept_id,

                max(score)
                    AS concept_score,

                count(
                    DISTINCT concept_id
                )
                    AS philosophy_concept_count

            FROM hits

            GROUP BY
                work_id
        )

        SELECT
            a.work_id,

            a.primary_concept_id,
            a.concept_score,
            a.philosophy_concept_count,

            coalesce(
                m.title,
                m.display_name
            ),

            m.publication_year,
            m.language,
            m.type,
            m.doi,

            m.cited_by_count,

            m.open_access_is_oa,
            m.open_access_oa_status,
            m.open_access_oa_url,

            m.has_fulltext,
            m.has_content_pdf

        FROM aggregated a

        JOIN {main} m
            ON m.work_id =
               a.work_id

        WHERE
            coalesce(
                m.is_retracted,
                false
            ) = false
        """
    )


    if (
        number == 1
        or number % 10 == 0
        or number == len(selected)
    ):

        total = con.execute(
            """
            SELECT count(*)
            FROM records
            """
        ).fetchone()[0]

        print(
            f"[{number:3}/{len(selected):3}] "
            f"records={total:,} "
            f"tiempo={time.time() - start:.1f}s"
        )


# ------------------------------------------------------------
# 4. Estadísticas
# ------------------------------------------------------------

total = con.execute(
    """
    SELECT count(*)
    FROM records
    """
).fetchone()[0]


print()
print("=" * 78)
print("RESULTADO")
print("=" * 78)

print(
    "Works únicos:",
    f"{total:,}"
)

print(
    "Tiempo:",
    f"{time.time() - start:.2f}s"
)


print()
print("=" * 78)
print("DISTRIBUCIÓN POR SCORE")
print("=" * 78)


bins = [
    (0.70, 1.01, ">=0.70"),
    (0.50, 0.70, "0.50-0.70"),
    (0.30, 0.50, "0.30-0.50"),
    (0.15, 0.30, "0.15-0.30"),
    (0.00, 0.15, "<0.15"),
]


for lower, upper, label in bins:

    count = con.execute(
        """
        SELECT count(*)
        FROM records
        WHERE
            concept_score >= ?
            AND concept_score < ?
        """,
        [
            lower,
            upper,
        ]
    ).fetchone()[0]

    print(
        f"{label:12} "
        f"{count:10,}"
    )


print()
print("=" * 78)
print("TOP CONCEPTOS")
print("=" * 78)


top = con.execute(
    """
    SELECT
        primary_concept_id,
        count(*) AS n

    FROM records

    GROUP BY
        primary_concept_id

    ORDER BY
        n DESC

    LIMIT 30
    """
).fetchall()


for concept_id, count in top:

    print(
        f"{int(concept_id):12}  "
        f"{count:9,}  "
        f"{concept_names.get(int(concept_id), '???')}"
    )


# ------------------------------------------------------------
# 5. Ejemplos por score
# ------------------------------------------------------------

def examples(
    lower,
    upper,
    label
):

    print()
    print("=" * 78)
    print(label)
    print("=" * 78)

    rows = con.execute(
        """
        SELECT
            concept_score,
            philosophy_concept_count,
            primary_concept_id,
            publication_year,
            language,
            type,
            title

        FROM records

        WHERE
            concept_score >= ?
            AND concept_score < ?

        ORDER BY
            hash(work_id)

        LIMIT 20
        """,
        [
            lower,
            upper,
        ]
    ).fetchall()


    for row in rows:

        title = " ".join(
            str(
                row[6]
                or "(sin título)"
            ).split()
        )

        name = concept_names.get(
            int(row[2]),
            "?"
        )

        print(
            f"{row[0]:.3f}  "
            f"n={row[1]}  "
            f"{str(row[3] or '----'):4}  "
            f"{str(row[4] or '--'):3}  "
            f"{name[:32]:32}  "
            f"{title[:110]}"
        )


examples(
    0.70,
    1.01,
    "ALTO >= 0.70"
)

examples(
    0.30,
    0.50,
    "MEDIO 0.30-0.50"
)

examples(
    0.00,
    0.15,
    "BAJO < 0.15"
)


# ------------------------------------------------------------
# 6. Puerta de calidad
# ------------------------------------------------------------

print()
print("=" * 78)
print("PUERTA DE CALIDAD")
print("=" * 78)


title_terms_sql = ", ".join(
    "'%"
    +
    term.replace(
        "'",
        "''"
    )
    +
    "%'"
    for term in sorted(
        PHILOSOPHY_TITLE_TERMS
    )
)


ambiguous_ids = sorted(
    concept_id
    for concept_id, name
    in concept_names.items()
    if name.lower()
    in AMBIGUOUS_CONCEPT_NAMES
)


ambiguous_sql = ", ".join(
    str(value)
    for value in ambiguous_ids
)


if not ambiguous_sql:
    ambiguous_sql = "-1"


title_signal = " OR ".join(
    "lower(coalesce(title, '')) LIKE "
    +
    "'%"
    +
    term.replace(
        "'",
        "''"
    )
    +
    "%'"
    for term in sorted(
        PHILOSOPHY_TITLE_TERMS
    )
)


con.execute(
    f"""
    CREATE TABLE evaluated AS

    SELECT
        *,

        CASE

            -- Conceptos ambiguos necesitan una segunda señal.
            WHEN primary_concept_id IN (
                {ambiguous_sql}
            )
            THEN (
                (
                    concept_score >= 0.50
                    AND philosophy_concept_count >= 2
                )
                OR
                (
                    concept_score >= 0.15
                    AND (
                        {title_signal}
                    )
                )
            )

            -- Conceptos filosóficos específicos:
            -- score alto basta.
            WHEN concept_score >= 0.50
            THEN true

            -- Dos o más señales conceptuales independientes.
            WHEN
                concept_score >= 0.30
                AND philosophy_concept_count >= 2
            THEN true

            -- Score moderado + corroboración textual.
            WHEN
                concept_score >= 0.15
                AND (
                    {title_signal}
                )
            THEN true

            ELSE false
        END
            AS accepted

    FROM records
    """
)


accepted = con.execute(
    """
    SELECT count(*)
    FROM evaluated
    WHERE accepted
    """
).fetchone()[0]


rejected = con.execute(
    """
    SELECT count(*)
    FROM evaluated
    WHERE NOT accepted
    """
).fetchone()[0]


print(
    "Aceptados:",
    f"{accepted:,}"
)

print(
    "Rechazados:",
    f"{rejected:,}"
)

print(
    "Retención:",
    f"{accepted / max(total, 1) * 100:.1f}%"
)


print()
print("ACEPTADOS POR REGLA")
print("-" * 78)


rules = con.execute(
    f"""
    SELECT
        CASE
            WHEN concept_score >= 0.50
                THEN 'score>=0.50'

            WHEN
                concept_score >= 0.30
                AND philosophy_concept_count >= 2
                THEN 'multi-concept'

            WHEN (
                {title_signal}
            )
                THEN 'title-evidence'

            ELSE 'other'
        END AS reason,

        count(*) AS n

    FROM evaluated

    WHERE accepted

    GROUP BY reason

    ORDER BY n DESC
    """
).fetchall()


for reason, count in rules:

    print(
        f"{reason:20} "
        f"{count:9,}"
    )


def show_quality_examples(
    accepted_value,
    label,
    limit=25,
):

    print()
    print("=" * 78)
    print(label)
    print("=" * 78)

    rows = con.execute(
        """
        SELECT
            concept_score,
            philosophy_concept_count,
            primary_concept_id,
            publication_year,
            language,
            title

        FROM evaluated

        WHERE accepted = ?

        ORDER BY
            hash(work_id)

        LIMIT ?
        """,
        [
            accepted_value,
            limit,
        ]
    ).fetchall()


    for row in rows:

        title = " ".join(
            str(
                row[5]
                or "(sin título)"
            ).split()
        )

        concept = concept_names.get(
            int(row[2]),
            "?"
        )

        print(
            f"{row[0]:.3f}  "
            f"n={row[1]}  "
            f"{str(row[3] or '----'):4}  "
            f"{concept[:30]:30}  "
            f"{title[:115]}"
        )


show_quality_examples(
    True,
    "MUESTRA ACEPTADA"
)

show_quality_examples(
    False,
    "MUESTRA RECHAZADA"
)


# ------------------------------------------------------------
# 7. Guardar
# ------------------------------------------------------------

parquet_path = (
    OUTPUT_DIR /
    "philosophy-concept-record-sample.parquet"
)

summary_path = (
    OUTPUT_DIR /
    "philosophy-concept-record-sample-summary.json"
)


safe_path = str(
    parquet_path
).replace(
    "'",
    "''"
)


con.execute(
    f"""
    COPY (
        SELECT *
        EXCLUDE (accepted)
        FROM evaluated
        WHERE accepted

        ORDER BY
            concept_score DESC,
            philosophy_concept_count DESC,
            work_id
    )

    TO '{safe_path}'
    (
        FORMAT PARQUET,
        COMPRESSION ZSTD
    )
    """
)


summary = {
    "sample_shards":
        len(selected),

    "concepts":
        len(concept_ids),

    "records":
        total,

    "seconds":
        round(
            time.time()
            -
            start,
            2
        ),

    "concepts_used":
        concept_names,
}


summary_path.write_text(
    json.dumps(
        summary,
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)


print()
print("=" * 78)
print("ARCHIVOS")
print("=" * 78)

print(
    parquet_path,
    f"{parquet_path.stat().st_size / 1024**2:.2f} MiB"
)

print(
    summary_path
)

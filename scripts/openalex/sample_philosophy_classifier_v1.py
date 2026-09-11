import ast
import time
from pathlib import Path
from urllib.parse import quote

import duckdb

from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile


REPO_ID = "Mearman/OpenAlex"
SAMPLE_SHARDS = 20

SOURCE_SCRIPT = Path(
    "scripts/openalex/sample_philosophy_concept_records.py"
)

OUTPUT = Path(
    "artifacts/openalex/"
    "philosophy-classifier-v1.parquet"
)


# ------------------------------------------------------------
# Disciplinas/contextos.
#
# NO significan "no filosofía".
# Sirven para medir si una disciplina empírica domina
# claramente sobre la señal filosófica.
# ------------------------------------------------------------

DOMAIN_KEYWORDS = {
    "physics",
    "medicine",
    "psychology",
    "biology",
    "chemistry",
    "computer-science",
    "materials-science",
    "engineering",
    "mathematics",
    "education",
    "political-science",
    "sociology",
    "law",
    "economics",
    "business",
    "neuroscience",
    "psychiatry",
    "linguistics",
    "religion",
    "history",
}


# ------------------------------------------------------------
# Recuperar conceptos ancla actuales
# ------------------------------------------------------------

tree = ast.parse(
    SOURCE_SCRIPT.read_text(
        encoding="utf-8"
    )
)

sets = {}

for node in tree.body:

    if not isinstance(
        node,
        ast.Assign
    ):
        continue

    for target in node.targets:

        if (
            isinstance(
                target,
                ast.Name
            )
            and target.id in {
                "STRONG_NAMES",
                "BROAD_NAMES",
            }
        ):

            sets[target.id] = (
                ast.literal_eval(
                    node.value
                )
            )


strong_names = (
    sets["STRONG_NAMES"]
    -
    sets["BROAD_NAMES"]
)


# ------------------------------------------------------------
# Infraestructura
# ------------------------------------------------------------

api = HfApi()

con = duckdb.connect(
    "/tmp/openalex-keyword-evidence.duckdb"
)

con.execute(
    "INSTALL httpfs"
)

con.execute(
    "LOAD httpfs"
)

con.execute(
    "SET threads = 4"
)

con.execute(
    "SET preserve_insertion_order = false"
)


for sql in [
    "SET http_retries = 3",
    "SET http_timeout = 60000",
]:

    try:
        con.execute(sql)

    except Exception:
        pass


def discover(path):

    return [
        entry
        for entry
        in api.list_repo_tree(
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


def relation(entry):

    value = remote_url(
        entry
    ).replace(
        "'",
        "''"
    )

    return (
        f"read_parquet('{value}')"
    )


def relation_many(entries):

    values = ", ".join(
        "'"
        +
        remote_url(
            entry
        ).replace(
            "'",
            "''"
        )
        +
        "'"

        for entry in entries
    )

    return (
        f"read_parquet([{values}])"
    )


def basename(entry):

    return Path(
        entry.path
    ).name


def spread(values, count):

    values = sorted(
        values
    )

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
            indexes.append(
                index
            )

    return [
        values[index]
        for index in indexes
    ]


# ------------------------------------------------------------
# Resolver nuestros 52 concept IDs
# ------------------------------------------------------------

concept_main_files = discover(
    "data/concepts/main"
)

concept_main = relation_many(
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
        strong_names
    )
)


concept_rows = con.execute(
    f"""
    SELECT
        concept_id,
        display_name

    FROM {concept_main}

    WHERE
        lower(display_name)
        IN ({names_sql})
    """
).fetchall()


concept_names = {
    int(concept_id):
        display_name

    for concept_id, display_name
    in concept_rows
}


concept_ids_sql = ", ".join(
    str(value)

    for value in sorted(
        concept_names
    )
)


domain_sql = ", ".join(
    "'"
    +
    value.replace(
        "'",
        "''"
    )
    +
    "'"

    for value in sorted(
        DOMAIN_KEYWORDS
    )
)


print("=" * 78)
print("OPENALEX PHILOSOPHY CLASSIFIER V1")
print("=" * 78)

print(
    "Conceptos ancla:",
    len(concept_names)
)

print(
    "Disciplinas de contexto:",
    len(DOMAIN_KEYWORDS)
)


# ------------------------------------------------------------
# Alinear concepts + keywords + main
# ------------------------------------------------------------

concept_files = discover(
    "data/works/concepts"
)

keyword_files = discover(
    "data/works/keywords"
)

main_files = discover(
    "data/works/main"
)


concept_by_key = {
    basename(entry):
        entry

    for entry in concept_files
}


keyword_by_key = {
    basename(entry):
        entry

    for entry in keyword_files
}


main_by_key = {
    basename(entry):
        entry

    for entry in main_files
}


aligned = sorted(
    set(concept_by_key)
    &
    set(keyword_by_key)
    &
    set(main_by_key)
)


selected = spread(
    aligned,
    SAMPLE_SHARDS
)


print()
print("=" * 78)
print("SHARDS")
print("=" * 78)

print(
    "concepts:",
    f"{len(concept_files):,}"
)

print(
    "keywords:",
    f"{len(keyword_files):,}"
)

print(
    "main:",
    f"{len(main_files):,}"
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
# Tablas
# ------------------------------------------------------------

con.execute(
    """
    CREATE TABLE candidate_keywords (
        work_id BIGINT,
        keyword_id VARCHAR,
        score DOUBLE
    )
    """
)


con.execute(
    """
    CREATE TABLE audit (
        work_id BIGINT,

        primary_concept_id BIGINT,
        concept_score DOUBLE,
        philosophy_concept_count BIGINT,

        keyword_count BIGINT,

        philosophy_keyword_score DOUBLE,
        philosophy_family_score DOUBLE,
        philosophy_family_count BIGINT,

        humanities_score DOUBLE,

        top_keyword_id VARCHAR,
        top_keyword_score DOUBLE,

        top_domain_keyword_id VARCHAR,
        top_domain_keyword_score DOUBLE,

        title VARCHAR,
        publication_year BIGINT,
        language VARCHAR,
        type VARCHAR
    )
    """
)


start = time.time()


for number, shard_key in enumerate(
    selected,
    start=1
):

    concepts = relation(
        concept_by_key[
            shard_key
        ]
    )

    keywords = relation(
        keyword_by_key[
            shard_key
        ]
    )

    main = relation(
        main_by_key[
            shard_key
        ]
    )


    con.execute(
        "DROP TABLE IF EXISTS shard_candidates"
    )


    con.execute(
        f"""
        CREATE TEMP TABLE shard_candidates AS

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
            )
                AS title,

            m.publication_year,
            m.language,
            m.type

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


    candidate_count = con.execute(
        """
        SELECT count(*)
        FROM shard_candidates
        """
    ).fetchone()[0]


    if candidate_count == 0:

        print(
            f"[{number:2}/{len(selected):2}] "
            "candidatos=0"
        )

        continue


    con.execute(
        "DROP TABLE IF EXISTS shard_keywords"
    )


    con.execute(
        f"""
        CREATE TEMP TABLE shard_keywords AS

        SELECT
            k.work_id,
            k.keyword_id,
            k.score

        FROM {keywords} k

        JOIN shard_candidates c
            ON c.work_id =
               k.work_id
        """
    )


    con.execute(
        """
        INSERT INTO candidate_keywords

        SELECT *
        FROM shard_keywords
        """
    )


    con.execute(
        "DROP TABLE IF EXISTS shard_keyword_stats"
    )


    con.execute(
        f"""
        CREATE TEMP TABLE shard_keyword_stats AS

        SELECT
            work_id,

            count(*)
                AS keyword_count,


            max(score)
                FILTER (
                    WHERE
                        keyword_id =
                        'philosophy'
                )
                AS philosophy_keyword_score,


            max(score)
                FILTER (
                    WHERE
                        keyword_id LIKE
                        '%philosoph%'
                )
                AS philosophy_family_score,


            count(*)
                FILTER (
                    WHERE
                        keyword_id LIKE
                        '%philosoph%'
                )
                AS philosophy_family_count,


            max(score)
                FILTER (
                    WHERE
                        keyword_id =
                        'humanities'
                )
                AS humanities_score,


            arg_max(
                keyword_id,
                score
            )
                AS top_keyword_id,


            max(score)
                AS top_keyword_score,


            arg_max(
                keyword_id,
                score
            )
                FILTER (
                    WHERE
                        keyword_id
                        IN (
                            {domain_sql}
                        )
                )
                AS top_domain_keyword_id,


            max(score)
                FILTER (
                    WHERE
                        keyword_id
                        IN (
                            {domain_sql}
                        )
                )
                AS top_domain_keyword_score

        FROM shard_keywords

        GROUP BY
            work_id
        """
    )


    con.execute(
        """
        INSERT INTO audit

        SELECT
            c.work_id,

            c.primary_concept_id,
            c.concept_score,
            c.philosophy_concept_count,

            coalesce(
                k.keyword_count,
                0
            ),

            k.philosophy_keyword_score,
            k.philosophy_family_score,

            coalesce(
                k.philosophy_family_count,
                0
            ),

            k.humanities_score,

            k.top_keyword_id,
            k.top_keyword_score,

            k.top_domain_keyword_id,
            k.top_domain_keyword_score,

            c.title,
            c.publication_year,
            c.language,
            c.type

        FROM shard_candidates c

        LEFT JOIN shard_keyword_stats k
            ON k.work_id =
               c.work_id
        """
    )


    keyword_work_count = con.execute(
        """
        SELECT
            count(
                DISTINCT work_id
            )

        FROM shard_keywords
        """
    ).fetchone()[0]


    total = con.execute(
        """
        SELECT count(*)
        FROM audit
        """
    ).fetchone()[0]


    print(
        f"[{number:2}/{len(selected):2}] "
        f"candidatos={candidate_count:,} "
        f"con_keywords={keyword_work_count:,} "
        f"total={total:,} "
        f"tiempo={time.time() - start:.1f}s"
    )


# ------------------------------------------------------------
# Cobertura
# ------------------------------------------------------------

total = con.execute(
    """
    SELECT count(*)
    FROM audit
    """
).fetchone()[0]


coverage = con.execute(
    """
    SELECT

        count(*)
            FILTER (
                WHERE
                    keyword_count > 0
            ),

        count(*)
            FILTER (
                WHERE
                    philosophy_keyword_score
                    IS NOT NULL
            ),

        count(*)
            FILTER (
                WHERE
                    philosophy_family_score
                    IS NOT NULL
            ),

        count(*)
            FILTER (
                WHERE
                    philosophy_family_score
                    >= 0.30
            ),

        count(*)
            FILTER (
                WHERE
                    philosophy_family_score
                    >= 0.50
            ),

        count(*)
            FILTER (
                WHERE
                    top_domain_keyword_score
                    IS NOT NULL
            )

    FROM audit
    """
).fetchone()


print()
print("=" * 78)
print("COBERTURA KEYWORDS")
print("=" * 78)


labels = [
    (
        "Con keywords",
        coverage[0],
    ),
    (
        "Keyword exacta philosophy",
        coverage[1],
    ),
    (
        "Alguna keyword *philosoph*",
        coverage[2],
    ),
    (
        "*philosoph* >=0.30",
        coverage[3],
    ),
    (
        "*philosoph* >=0.50",
        coverage[4],
    ),
    (
        "Con disciplina de contexto",
        coverage[5],
    ),
]


for label, count in labels:

    print(
        f"{label:32} "
        f"{count:8,}  "
        f"{count / max(total, 1) * 100:5.1f}%"
    )


# ------------------------------------------------------------
# Keywords filosóficas reales
# ------------------------------------------------------------

print()
print("=" * 78)
print("TOP KEYWORDS *PHILOSOPH*")
print("=" * 78)


rows = con.execute(
    """
    SELECT
        keyword_id,
        count(*) AS n,
        avg(score) AS mean_score,
        max(score) AS max_score

    FROM candidate_keywords

    WHERE
        keyword_id LIKE
        '%philosoph%'

    GROUP BY
        keyword_id

    ORDER BY
        n DESC

    LIMIT 60
    """
).fetchall()


for row in rows:

    print(
        f"{row[0]:55} "
        f"n={int(row[1]):6,} "
        f"mean={float(row[2] or 0):.3f} "
        f"max={float(row[3] or 0):.3f}"
    )


# ------------------------------------------------------------
# Disciplinas dominantes
# ------------------------------------------------------------

print()
print("=" * 78)
print("TOP DISCIPLINAS DE CONTEXTO")
print("=" * 78)


rows = con.execute(
    f"""
    SELECT
        keyword_id,
        count(*) AS n,
        avg(score) AS mean_score,
        max(score) AS max_score

    FROM candidate_keywords

    WHERE
        keyword_id
        IN (
            {domain_sql}
        )

    GROUP BY
        keyword_id

    ORDER BY
        n DESC
    """
).fetchall()


for row in rows:

    print(
        f"{row[0]:25} "
        f"n={int(row[1]):6,} "
        f"mean={float(row[2] or 0):.3f} "
        f"max={float(row[3] or 0):.3f}"
    )


# ------------------------------------------------------------
# Ejemplos detallados
# ------------------------------------------------------------

ambiguous_names = {
    "Phenomenology (philosophy)",
    "Existentialism",
    "Philosophy of medicine",
    "Philosophy of biology",
    "Philosophy of computer science",
    "Philosophy of technology",
    "Environmental philosophy",
    "Applied philosophy",
    "Social philosophy",
}


ambiguous_ids = [
    concept_id

    for concept_id, name
    in concept_names.items()

    if name in ambiguous_names
]


ambiguous_sql = (
    ", ".join(
        str(value)
        for value in ambiguous_ids
    )
    or "-1"
)


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
            primary_concept_id,
            concept_score,
            philosophy_concept_count,

            philosophy_keyword_score,
            philosophy_family_score,

            top_domain_keyword_id,
            top_domain_keyword_score,

            publication_year,
            language,
            title

        FROM audit

        WHERE
            {where_sql}

        ORDER BY
            hash(work_id)

        LIMIT {limit}
        """
    ).fetchall()


    for row in rows:

        work_id = int(
            row[0]
        )

        concept = concept_names.get(
            int(row[1]),
            "?"
        )

        philosophy_exact = (
            "—"
            if row[4] is None
            else f"{row[4]:.3f}"
        )

        philosophy_family = (
            "—"
            if row[5] is None
            else f"{row[5]:.3f}"
        )

        domain_score = (
            "—"
            if row[7] is None
            else f"{row[7]:.3f}"
        )

        domain_name = (
            row[6]
            or "—"
        )

        title = " ".join(
            str(
                row[10]
                or "(sin título)"
            ).split()
        )


        print()

        print(
            f"concept={row[2]:.3f}  "
            f"n={row[3]}  "
            f"philosophy={philosophy_exact}  "
            f"family={philosophy_family}"
        )

        print(
            "DOMINIO:",
            domain_score,
            domain_name
        )

        print(
            "ANCLA:",
            concept
        )

        print(
            "TÍTULO:",
            title[:180]
        )


        keyword_rows = con.execute(
            """
            SELECT
                keyword_id,
                score

            FROM candidate_keywords

            WHERE
                work_id = ?

            ORDER BY
                score DESC,
                keyword_id

            LIMIT 10
            """,
            [
                work_id
            ]
        ).fetchall()


        print(
            "KEYWORDS:",
            " | ".join(
                f"{keyword_id}:{float(score or 0):.2f}"

                for keyword_id, score
                in keyword_rows
            )
        )


show_examples(
    f"""
    primary_concept_id
    IN (
        {ambiguous_sql}
    )

    AND
        concept_score >= 0.50
    """,
    "AMBIGUOS — PERFIL DE KEYWORDS"
)


show_examples(
    """
    top_domain_keyword_score >= 0.60

    AND
        coalesce(
            philosophy_family_score,
            0
        ) < 0.20
    """,
    "DOMINIO FUERTE + FILOSOFÍA KEYWORD DÉBIL"
)


show_examples(
    """
    philosophy_family_score >= 0.40
    """,
    "KEYWORD FILOSÓFICA FUERTE"
)


# ------------------------------------------------------------
# Clasificador filosófico v1
#
# Filosofía explícita en keywords tiene mucho más peso que
# el score aislado del concepto.
#
# EXCLUDE es deliberadamente muy conservador.
# ------------------------------------------------------------

HARD_PHYSICS_NOISE = {
    "physics",
    "particle-physics",
    "nuclear-physics",
    "high-energy-physics",
    "quantum-field-theory",
    "standard-model",
    "physics-beyond-the-standard-model",
    "large-hadron-collider",
    "higgs-boson",
    "quark",
    "top-quark",
    "bottom-quark",
    "neutrino",
    "hadron",
    "baryon",
    "supersymmetry",
    "technicolor",
    "quantum-chromodynamics",
    "particle",
    "collider",
}

HARD_MATERIAL_NOISE = {
    "materials-science",
    "polymer",
    "glass-transition",
    "chemical-physics",
}

hard_noise_sql = ", ".join(
    "'"
    +
    value.replace(
        "'",
        "''"
    )
    +
    "'"

    for value in sorted(
        HARD_PHYSICS_NOISE
        |
        HARD_MATERIAL_NOISE
    )
)


con.execute(
    """
    DROP TABLE IF EXISTS
    hard_noise
    """
)


con.execute(
    f"""
    CREATE TEMP TABLE hard_noise AS

    SELECT
        work_id,

        max(score)
            AS hard_noise_score,

        arg_max(
            keyword_id,
            score
        )
            AS hard_noise_keyword

    FROM candidate_keywords

    WHERE
        keyword_id
        IN (
            {hard_noise_sql}
        )

    GROUP BY
        work_id
    """
)


# Phenomenology es el principal caso de colisión:
# en OpenAlex mezcla fenomenología filosófica,
# metodología cualitativa y fenomenología de partículas.

PHENOMENOLOGY_ID = 84269361


con.execute(
    """
    DROP TABLE IF EXISTS
    classified
    """
)


con.execute(
    f"""
    CREATE TABLE classified AS

    SELECT
        a.*,

        n.hard_noise_score,
        n.hard_noise_keyword,


        CASE

            -- ------------------------------------------------
            -- EXCLUDE
            --
            -- Sólo un patrón que la muestra ha demostrado
            -- repetidamente como falso positivo:
            -- Phenomenology + física/materiales dominante
            -- sin corroboración filosófica independiente.
            -- ------------------------------------------------

            WHEN
                a.primary_concept_id =
                {PHENOMENOLOGY_ID}

                AND
                coalesce(
                    n.hard_noise_score,
                    0
                ) >= 0.55

                AND
                coalesce(
                    a.philosophy_family_score,
                    0
                ) < 0.20

                THEN
                'EXCLUDE'


            -- ------------------------------------------------
            -- CORE
            --
            -- Keyword filosófica fuerte.
            -- Esta es nuestra mejor corroboración independiente
            -- y tiene cobertura completa a nivel de keywords.
            -- ------------------------------------------------

            WHEN
                coalesce(
                    a.philosophy_family_score,
                    0
                ) >= 0.50

                THEN
                'CORE'


            -- Keyword filosófica moderada +
            -- otra señal conceptual.

            WHEN
                coalesce(
                    a.philosophy_family_score,
                    0
                ) >= 0.30

                AND
                (
                    a.philosophy_concept_count >= 2

                    OR
                    a.concept_score >= 0.50
                )

                THEN
                'CORE'


            -- ------------------------------------------------
            -- PROBABLE
            -- ------------------------------------------------

            WHEN
                coalesce(
                    a.philosophy_family_score,
                    0
                ) >= 0.30

                THEN
                'PROBABLE'


            WHEN
                a.philosophy_concept_count >= 2

                AND
                a.concept_score >= 0.40

                THEN
                'PROBABLE'


            -- ------------------------------------------------
            -- BORDERLINE
            --
            -- No destruir evidencia ambigua.
            -- Aquí quedarán interdisciplinarios y trabajos
            -- que después podremos revisar con abstract.
            -- ------------------------------------------------

            ELSE
                'BORDERLINE'

        END
            AS tier,


        CASE

            WHEN
                a.primary_concept_id =
                {PHENOMENOLOGY_ID}

                AND
                coalesce(
                    n.hard_noise_score,
                    0
                ) >= 0.55

                AND
                coalesce(
                    a.philosophy_family_score,
                    0
                ) < 0.20

                THEN
                'phenomenology-hard-science-noise'


            WHEN
                coalesce(
                    a.philosophy_family_score,
                    0
                ) >= 0.50

                THEN
                'strong-philosophy-keyword'


            WHEN
                coalesce(
                    a.philosophy_family_score,
                    0
                ) >= 0.30

                AND
                a.philosophy_concept_count >= 2

                THEN
                'keyword-plus-multiple-concepts'


            WHEN
                coalesce(
                    a.philosophy_family_score,
                    0
                ) >= 0.30

                AND
                a.concept_score >= 0.50

                THEN
                'keyword-plus-concept-score'


            WHEN
                coalesce(
                    a.philosophy_family_score,
                    0
                ) >= 0.30

                THEN
                'moderate-philosophy-keyword'


            WHEN
                a.philosophy_concept_count >= 2

                AND
                a.concept_score >= 0.40

                THEN
                'multiple-philosophy-concepts'


            ELSE
                'insufficient-corroboration'

        END
            AS tier_reason

    FROM audit a

    LEFT JOIN hard_noise n
        ON n.work_id =
           a.work_id
    """
)


# ------------------------------------------------------------
# Distribución
# ------------------------------------------------------------

print()
print("=" * 78)
print("CLASIFICADOR V1")
print("=" * 78)


tier_rows = con.execute(
    """
    SELECT
        tier,
        count(*) AS n

    FROM classified

    GROUP BY
        tier

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


total_classified = sum(
    int(row[1])
    for row in tier_rows
)


for tier, count in tier_rows:

    print(
        f"{tier:12} "
        f"{int(count):8,}  "
        f"{int(count) / max(total_classified, 1) * 100:5.1f}%"
    )


print()
print("=" * 78)
print("RAZONES")
print("=" * 78)


reason_rows = con.execute(
    """
    SELECT
        tier,
        tier_reason,
        count(*) AS n

    FROM classified

    GROUP BY
        tier,
        tier_reason

    ORDER BY
        tier,
        n DESC
    """
).fetchall()


for tier, reason, count in reason_rows:

    print(
        f"{tier:12} "
        f"{reason:38} "
        f"{int(count):7,}"
    )


# ------------------------------------------------------------
# Auditoría humana por tier
# ------------------------------------------------------------

def show_tier(
    tier,
    limit=30,
):

    print()
    print("=" * 78)
    print(
        f"MUESTRA {tier}"
    )
    print("=" * 78)


    rows = con.execute(
        """
        SELECT
            work_id,
            primary_concept_id,
            concept_score,
            philosophy_concept_count,

            philosophy_keyword_score,
            philosophy_family_score,

            top_domain_keyword_id,
            top_domain_keyword_score,

            hard_noise_keyword,
            hard_noise_score,

            tier_reason,

            publication_year,
            language,
            title

        FROM classified

        WHERE
            tier = ?

        ORDER BY
            hash(work_id)

        LIMIT ?
        """,
        [
            tier,
            limit,
        ]
    ).fetchall()


    for row in rows:

        work_id = int(
            row[0]
        )

        concept = concept_names.get(
            int(row[1]),
            "?"
        )

        family = (
            "—"
            if row[5] is None
            else f"{row[5]:.3f}"
        )

        domain = (
            "—"
            if row[7] is None
            else f"{row[7]:.3f}"
        )

        noise = (
            "—"
            if row[9] is None
            else f"{row[9]:.3f}"
        )

        title = " ".join(
            str(
                row[13]
                or "(sin título)"
            ).split()
        )


        print()

        print(
            f"concept={row[2]:.3f} "
            f"n={row[3]} "
            f"family={family}"
        )

        print(
            "ANCLA:",
            concept
        )

        print(
            "RAZÓN:",
            row[10]
        )

        print(
            "DOMINIO:",
            domain,
            row[6] or "—"
        )

        print(
            "RUIDO DURO:",
            noise,
            row[8] or "—"
        )

        print(
            "TÍTULO:",
            title[:190]
        )


        keywords = con.execute(
            """
            SELECT
                keyword_id,
                score

            FROM candidate_keywords

            WHERE
                work_id = ?

            ORDER BY
                score DESC,
                keyword_id

            LIMIT 12
            """,
            [
                work_id
            ]
        ).fetchall()


        print(
            "KEYWORDS:",
            " | ".join(
                f"{keyword_id}:{float(score or 0):.2f}"

                for keyword_id, score
                in keywords
            )
        )


for tier in [
    "CORE",
    "PROBABLE",
    "BORDERLINE",
    "EXCLUDE",
]:

    show_tier(
        tier
    )


# ------------------------------------------------------------
# Guardar
# ------------------------------------------------------------

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
        FROM classified
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
print("=" * 78)
print("FIN")
print("=" * 78)

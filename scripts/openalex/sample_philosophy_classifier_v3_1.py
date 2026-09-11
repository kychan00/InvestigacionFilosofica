import io
import json
import re
import runpy
import time
import unicodedata
from collections import defaultdict
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
    "philosophy-classifier-v3-1.parquet"
)


print("=" * 78)
print("OPENALEX PHILOSOPHY CLASSIFIER V3.1")
print("=" * 78)


# ============================================================
# Ejecutar V2 como base
# ============================================================

print()
print(
    "Ejecutando classifier V2 base..."
)

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


print(
    "✓ V2 listo"
)


# ============================================================
# Normalización
# ============================================================

def normalize(value):

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

    value = re.sub(
        r"<[^>]+>",
        " ",
        value
    )

    value = re.sub(
        r"\s+",
        " ",
        value
    )

    return value.strip()


def slugify(value):

    value = normalize(
        value
    )

    value = re.sub(
        r"\s*\([^)]*\)\s*",
        " ",
        value
    )

    value = value.replace(
        "&",
        " and "
    )

    value = re.sub(
        r"[^a-z0-9]+",
        "-",
        value
    )

    return value.strip(
        "-"
    )


def anchor_text(value):

    value = normalize(
        value
    )

    value = re.sub(
        r"\s*\([^)]*\)\s*",
        " ",
        value
    )

    value = re.sub(
        r"\s+",
        " ",
        value
    )

    return value.strip()


# ============================================================
# Conceptos con colisiones/interdisciplinariedad demostrada
# ============================================================

AMBIGUOUS_NAMES = {
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


LEXICAL_COLLISION_NAMES = {
    "Phenomenology (philosophy)",
    "Existentialism",
}


# ============================================================
# Ontología local
# ============================================================

ontology = json.loads(
    PHILOSOPHY_MAP.read_text(
        encoding="utf-8"
    )
)


# ------------------------------------------------------------
# Filósofos del mapa + suplemento conservador.
#
# No crean EXCLUDE.
# Sólo son evidencia positiva.
# ------------------------------------------------------------

philosopher_aliases = {}


for philosopher in ontology.get(
    "philosophers",
    []
):

    canonical = philosopher.get(
        "name",
        ""
    )

    values = {
        canonical,
        *philosopher.get(
            "aliases",
            []
        ),
    }

    for value in values:

        term = normalize(
            value
        )

        if term:

            philosopher_aliases[
                term
            ] = canonical


EXTRA_PHILOSOPHERS = {
    "Socrates",
    "Baruch Spinoza",
    "Gottfried Wilhelm Leibniz",
    "John Locke",
    "Jean-Jacques Rousseau",
    "Søren Kierkegaard",
    "Jean-Paul Sartre",
    "Simone de Beauvoir",
    "Michel Foucault",
    "Jacques Derrida",
    "Gilles Deleuze",
    "Jürgen Habermas",
    "Karl Marx",
    "Alfred North Whitehead",
    "Maurice Merleau-Ponty",
    "Emmanuel Levinas",
    "Hans-Georg Gadamer",
    "Albert Camus",
    "Paul Ricoeur",
    "Charles Sanders Peirce",
    "Robert Brandom",
    "Antonio Gramsci",
    "Hannah Arendt",
    "Thomas Aquinas",
    "Augustine",
    "Henry Sidgwick",
    "Ernesto Laclau",
    "Jan Patočka",
    "Michel Henry",
    "Martin Buber",
}


for value in EXTRA_PHILOSOPHERS:

    normalized = normalize(
        value
    )

    philosopher_aliases[
        normalized
    ] = value


# Surnames distintivos.

for canonical in list(
    set(
        philosopher_aliases.values()
    )
):

    surname = normalize(
        canonical
    ).split()[-1]

    if len(surname) >= 4:

        philosopher_aliases.setdefault(
            surname,
            canonical
        )


def philosopher_hits(text):

    result = set()

    for alias, canonical in (
        philosopher_aliases.items()
    ):

        pattern = (
            r"(?<![a-z0-9])"
            +
            re.escape(
                alias
            )
            +
            r"(?![a-z0-9])"
        )

        if re.search(
            pattern,
            text
        ):

            result.add(
                canonical
            )

    return sorted(
        result
    )


# ============================================================
# Evidencia filosófica textual
#
# Son términos relativamente específicos.
#
# Phenomenology / existentialism NO aparecen aquí por sí solos,
# porque HF-17 demostró sus colisiones.
# ============================================================

STRONG_TEXT_TERMS = {
    "epistemolog": "epistemology",
    "metaphys": "metaphysics",
    "ontolog": "ontology",
    "hermeneut": "hermeneutics",
    "dialectical material": "dialectical materialism",
    "historical material": "historical materialism",
    "utilitarian": "utilitarianism",
    "deontolog": "deontology",
    "categorical imperative": "categorical imperative",
    "free will": "free will",
    "intentionalit": "intentionality",
    "transcendental ideal": "transcendental idealism",
    "normativ": "normativity",
    "virtue ethic": "virtue ethics",
    "social contract": "social contract",
    "critical theory": "critical theory",
    "theory of knowledge": "theory of knowledge",
    "pragmatism": "pragmatism",
    "empiricism": "empiricism",
    "rationalism": "rationalism",
    "idealism": "idealism",
    "stoicism": "stoicism",
    "confuc": "confucianism",
    "taoism": "taoism",
    "daoism": "daoism",
    "socratic": "socratic",
    "scholastic": "scholasticism",
    "ethic": "ethics",
    "ethik": "ethics",
    "ethique": "ethics",
    "aesthet": "aesthetics",
    "estetic": "aesthetics",
}


# ------------------------------------------------------------
# Frases que no deben contar como "texto filosófico explícito".
# ------------------------------------------------------------

GENERIC_PHILOSOPHY_NOISE = {
    "doctor of philosophy",
    "degree of doctor of philosophy",
    "doctorate of philosophy",
    "philosophy and social sciences",
    "philosophy social sciences",
    "philosophy and social science",
    "department of politics media and philosophy",
}


def remove_phrase(
    text,
    phrase,
):

    if not phrase:

        return text

    return re.sub(
        r"(?<![a-z0-9])"
        +
        re.escape(
            phrase
        )
        +
        r"(?![a-z0-9])",
        " ",
        text
    )


def cleaned_philosophy_text(
    text,
    concept_name,
):

    result = text

    anchor = anchor_text(
        concept_name
    )

    result = remove_phrase(
        result,
        anchor
    )

    for phrase in (
        GENERIC_PHILOSOPHY_NOISE
    ):

        result = result.replace(
            phrase,
            " "
        )

    result = re.sub(
        r"\bph\.?\s*d\.?\b",
        " ",
        result
    )

    result = re.sub(
        r"\bphd\b",
        " ",
        result
    )

    return re.sub(
        r"\s+",
        " ",
        result
    ).strip()


def strong_text_hits(
    text,
    concept_name,
):

    anchor = anchor_text(
        concept_name
    )

    result = set()

    for stem, label in (
        STRONG_TEXT_TERMS.items()
    ):

        # Si el propio concepto ancla ya es esta señal,
        # no la contamos otra vez.
        if (
            stem in anchor
            or
            label in anchor
        ):
            continue

        if stem in text:

            result.add(
                label
            )

    return sorted(
        result
    )


def has_explicit_philosophy(
    text,
    concept_name,
):

    text = cleaned_philosophy_text(
        text,
        concept_name
    )

    return (
        "philosoph" in text
        or
        "filosof" in text
    )


# ============================================================
# Keywords filosóficas NO duplicadas con el anchor.
#
# No incluimos ninguna keyword con "philosoph":
# eso ya está representado por nonduplicate_philosophy_score
# en V2.
# ============================================================

ONTOLOGY_KEYWORD_STEMS = {
    "epistemolog",
    "metaphys",
    "ontolog",
    "hermeneut",
    "dialectic",
    "utilitarian",
    "deontolog",
    "intentional",
    "normativ",
    "pragmat",
    "idealism",
    "stoic",
    "confuc",
    "taois",
    "daoism",
    "socratic",
    "scholastic",
}


ONTOLOGY_KEYWORD_EXACT = {
    "free-will",
    "categorical-imperative",
    "social-contract",
    "critical-theory",
    "historical-materialism",
    "dialectical-materialism",
    "transcendental-idealism",
    "theory-of-knowledge",
}


def is_ontology_keyword(
    keyword,
):

    if "philosoph" in keyword:
        return False

    if keyword in ONTOLOGY_KEYWORD_EXACT:
        return True

    return any(
        stem in keyword

        for stem
        in ONTOLOGY_KEYWORD_STEMS
    )


# ============================================================
# Roles documentales
# ============================================================

PARATEXT_TITLE_PATTERNS = {
    "publisher's announcement",
    "publishers announcement",
    "publisher announcement",
    "editorial board",
    "preface",
    "preface and acknowledgements",
    "preface and acknowledgement",
    "acknowledgements",
    "acknowledgments",
    "table of contents",
    "contents",
    "front matter",
    "notes on contributors",
    "errata",
    "erratum",
    "corrigendum",
    "correction",
    "retraction",
}


REVIEW_MARKERS = {
    "book review",
    "review of ",
    "buchbesprechungen",
    "book reviews",
}


LOW_QUALITY_MARKERS = {
    "click here to download",
    "downloads:",
    "rating:",
}


PHENOMENOLOGY_METHOD_MARKERS = {
    "phenomenological study",
    "phenomenological method",
    "phenomenological methodology",
    "phenomenological research",
    "phenomenology research pattern",
    "interpretative phenomenological analysis",
    "qualitative phenomenological",
    "transcendental phenomenological methodology",
    "method of qualitative research",
    "qualitative research method",
    "phenomenology as a research method",
    "phenomenology as research method",
}


EMPIRICAL_MARKERS = {
    "participants",
    "participant",
    "interviews",
    "interview",
    "survey",
    "sample",
    "study group",
    "qualitative research",
    "content analysis",
    "focus group",
    "patients",
    "patient",
    "students",
    "student",
    "teachers",
    "teacher",
}


CLINICAL_MARKERS = {
    "patient",
    "patients",
    "clinical",
    "psychotherapy",
    "therapy",
    "therapies",
    "psychiatric",
    "psychiatry",
    "psychological",
    "psychology",
    "anxiety",
    "ptsd",
    "palliative",
    "well-being",
    "mental health",
}


MEDICAL_EMPIRICAL_MARKERS = {
    "participants",
    "patients",
    "patient",
    "clinical",
    "qualitative study",
    "qualitative research",
    "interview",
    "survey",
    "obstetric",
    "dental",
    "oral health",
    "pregnancy",
}


def marker_count(
    text,
    markers,
):

    return sum(
        1

        for marker in markers

        if marker in text
    )


def document_role(
    title,
    abstract,
    concept_name,
    philosophers,
    title_hits,
    abstract_hits,
    explicit_philosophy,
    is_paratext,
):

    title_n = normalize(
        title
    )

    abstract_n = normalize(
        abstract
    )

    full = (
        title_n
        +
        " "
        +
        abstract_n
    ).strip()


    # --------------------------------------------------------
    # LOW QUALITY / spam-like document
    # --------------------------------------------------------

    low_quality_count = marker_count(
        full,
        LOW_QUALITY_MARKERS
    )

    if (
        "click here to download"
        in full
        or
        (
            low_quality_count >= 2
        )
    ):

        return "LOW_QUALITY"


    # --------------------------------------------------------
    # REVIEW
    # --------------------------------------------------------

    if any(
        marker in title_n

        for marker in REVIEW_MARKERS
    ):

        return "REVIEW"


    # --------------------------------------------------------
    # PARATEXT
    # --------------------------------------------------------

    if (
        title_n
        in PARATEXT_TITLE_PATTERNS
    ):

        return "PARATEXT"


    if (
        is_paratext
        and
        not abstract_n
    ):

        return "PARATEXT"


    # --------------------------------------------------------
    # EMPIRICAL_ADJACENT
    #
    # No significa "malo".
    # Significa que el uso del concepto parece metodológico,
    # clínico o empírico antes que filosófico.
    # --------------------------------------------------------

    text_signal_count = (
        len(
            title_hits
        )
        +
        len(
            abstract_hits
        )
    )


    if (
        concept_name ==
        "Phenomenology (philosophy)"
    ):

        method = any(
            marker in full

            for marker
            in PHENOMENOLOGY_METHOD_MARKERS
        )

        empirical = (
            marker_count(
                full,
                EMPIRICAL_MARKERS
            )
            >= 1
        )

        if (
            method
            and empirical
            and not philosophers
            and not explicit_philosophy
            and text_signal_count <= 1
        ):

            return "EMPIRICAL_ADJACENT"


    if (
        concept_name ==
        "Existentialism"
    ):

        if (
            marker_count(
                full,
                CLINICAL_MARKERS
            )
            >= 2
            and not philosophers
            and not explicit_philosophy
            and text_signal_count <= 1
        ):

            return "EMPIRICAL_ADJACENT"


    if (
        concept_name ==
        "Philosophy of medicine"
    ):

        if (
            marker_count(
                full,
                MEDICAL_EMPIRICAL_MARKERS
            )
            >= 2
            and not philosophers
            and not explicit_philosophy
            and text_signal_count <= 1
        ):

            return "EMPIRICAL_ADJACENT"


    return "SCHOLARLY"


# ============================================================
# Reconstruir abstracts sólo para:
#
#   PROBABLE
#   BORDERLINE
#   CORE con anchor ambiguo
#
# Y recuperar is_paratext para todos.
# ============================================================

abstract_files = discover(
    "data/works/abstracts"
)


abstract_by_key = {
    basename(entry):
        entry

    for entry in abstract_files
}


con.execute(
    """
    DROP TABLE IF EXISTS
    v3_main_flags
    """
)


con.execute(
    """
    CREATE TABLE v3_main_flags (
        work_id BIGINT,
        is_paratext BOOLEAN
    )
    """
)


con.execute(
    """
    DROP TABLE IF EXISTS
    v3_abstracts
    """
)


con.execute(
    """
    CREATE TABLE v3_abstracts (
        work_id BIGINT,
        abstract VARCHAR
    )
    """
)


ambiguous_ids = [
    concept_id

    for concept_id, name
    in concept_names.items()

    if name in AMBIGUOUS_NAMES
]


ambiguous_sql = (
    ", ".join(
        str(value)

        for value
        in sorted(
            ambiguous_ids
        )
    )
    or "-1"
)


context_start = time.time()


print()
print("=" * 78)
print("CONTEXT")
print("=" * 78)


for number, shard_key in enumerate(
    selected,
    start=1,
):

    main = relation(
        main_by_key[
            shard_key
        ]
    )


    con.execute(
        """
        DROP TABLE IF EXISTS
        v3_shard_all
        """
    )


    con.execute(
        f"""
        CREATE TEMP TABLE
        v3_shard_all AS

        SELECT
            c.work_id,

            coalesce(
                m.is_paratext,
                false
            )
                AS is_paratext

        FROM classified_v2 c

        JOIN {main} m
            ON m.work_id =
               c.work_id
        """
    )


    con.execute(
        """
        INSERT INTO v3_main_flags

        SELECT *
        FROM v3_shard_all
        """
    )


    con.execute(
        """
        DROP TABLE IF EXISTS
        v3_shard_targets
        """
    )


    con.execute(
        f"""
        CREATE TEMP TABLE
        v3_shard_targets AS

        SELECT
            c.work_id

        FROM classified_v2 c

        JOIN v3_shard_all f
            ON f.work_id =
               c.work_id

        WHERE

            c.tier IN (
                'PROBABLE',
                'BORDERLINE'
            )

            OR
            (
                c.tier =
                'CORE'

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
        FROM v3_shard_targets
        """
    ).fetchone()[0]


    abstract_count = 0


    if (
        target_count > 0
        and
        shard_key in abstract_by_key
    ):

        abstracts = relation(
            abstract_by_key[
                shard_key
            ]
        )


        con.execute(
            """
            DROP TABLE IF EXISTS
            v3_shard_abstracts
            """
        )


        con.execute(
            f"""
            CREATE TEMP TABLE
            v3_shard_abstracts AS

            WITH tokens AS (

                SELECT
                    a.work_id,
                    a.word,
                    pos

                FROM {abstracts} a

                JOIN v3_shard_targets t
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
            FROM v3_shard_abstracts
            """
        ).fetchone()[0]


        con.execute(
            """
            INSERT INTO v3_abstracts

            SELECT *
            FROM v3_shard_abstracts
            """
        )


    print(
        f"[{number:2}/{len(selected):2}] "
        f"targets={target_count:,} "
        f"abstracts={abstract_count:,} "
        f"tiempo="
        f"{time.time() - context_start:.1f}s"
    )


# ============================================================
# Cargar datos pequeños en memoria
# ============================================================

abstract_map = {
    int(work_id):
        abstract

    for work_id, abstract
    in con.execute(
        """
        SELECT
            work_id,
            abstract

        FROM v3_abstracts
        """
    ).fetchall()
}


paratext_map = {
    int(work_id):
        bool(
            is_paratext
        )

    for work_id, is_paratext
    in con.execute(
        """
        SELECT
            work_id,
            is_paratext

        FROM v3_main_flags
        """
    ).fetchall()
}


keywords_by_work = defaultdict(
    list
)


for work_id, keyword, score in (
    con.execute(
        """
        SELECT
            work_id,
            keyword_id,
            score

        FROM candidate_keywords
        """
    ).fetchall()
):

    keywords_by_work[
        int(
            work_id
        )
    ].append(
        (
            str(
                keyword
            ),
            float(
                score
                or 0
            ),
        )
    )


v2_rows = con.execute(
    """
    SELECT
        work_id,

        primary_concept_id,
        concept_score,
        philosophy_concept_count,

        generic_philosophy_score,
        secondary_philosophy_score,
        nonduplicate_philosophy_score,

        top_domain_keyword_id,
        top_domain_keyword_score,

        hard_noise_keyword,
        hard_noise_score,

        title,
        publication_year,
        language,
        type,

        tier,
        tier_reason

    FROM classified_v2
    """
).fetchall()


# ============================================================
# V3 scoring
# ============================================================

def ontology_keyword_evidence(
    work_id,
    concept_name,
):

    anchor_slug = slugify(
        concept_name
    )

    matches = []


    for keyword, score in (
        keywords_by_work.get(
            work_id,
            []
        )
    ):

        if keyword == anchor_slug:
            continue

        if not is_ontology_keyword(
            keyword
        ):
            continue

        matches.append(
            (
                keyword,
                score,
            )
        )


    if not matches:

        return (
            None,
            0.0,
            0,
        )


    matches.sort(
        key=lambda item:
            (
                -item[1],
                item[0],
            )
    )


    return (
        matches[0][0],
        matches[0][1],
        len(
            matches
        ),
    )


def evidence_score(
    *,
    v2_tier,
    concept_name,
    concept_score,
    concept_count,
    nonduplicate_score,
    ontology_keyword_score,
    title_philosophers,
    abstract_philosophers,
    explicit_philosophy,
    title_hits,
    abstract_hits,
):

    score = 0
    reasons = []


    # Prior muy ligero.
    #
    # V2 PROBABLE aporta sólo un punto;
    # nunca basta por sí mismo.

    if v2_tier == "PROBABLE":

        score += 1
        reasons.append(
            "v2-probable"
        )


    # Corroboración no duplicada de V2.

    if nonduplicate_score >= 0.50:

        score += 3
        reasons.append(
            "nondup>=.50"
        )

    elif nonduplicate_score >= 0.25:

        score += 2
        reasons.append(
            "nondup>=.25"
        )


    # Varios conceptos filosóficos.

    if concept_count >= 2:

        score += 1
        reasons.append(
            "multi-concept"
        )


    # Concepto fuerte por sí solo:
    # sólo fuera de las dos colisiones léxicas principales.

    if (
        concept_name
        not in LEXICAL_COLLISION_NAMES
        and
        concept_score >= 0.65
    ):

        score += 1
        reasons.append(
            "strong-anchor"
        )


    # Ontología keyword adicional:
    # epistemology, metaphysics, ethics, etc.
    #
    # Nunca es la keyword del anchor.

    if ontology_keyword_score >= 0.50:

        score += 2
        reasons.append(
            "ontology-keyword>=.50"
        )

    elif ontology_keyword_score >= 0.30:

        score += 1
        reasons.append(
            "ontology-keyword>=.30"
        )


    # Filósofos.
    #
    # Título: evidencia fuerte.
    # Abstract: evidencia auxiliar; evita que una mención
    # incidental a Camus/Deleuze/etc. cree CORE por sí sola.

    if title_philosophers:

        score += 3

        reasons.append(
            "philosopher-in-title"
        )

        if len(
            title_philosophers
        ) >= 2:

            score += 1

            reasons.append(
                "multiple-title-philosophers"
            )


    elif abstract_philosophers:

        score += 1

        reasons.append(
            "philosopher-in-abstract"
        )


    # Palabra philosophy/filosof... una vez eliminado:
    #
    # - el anchor
    # - Doctor of Philosophy
    # - philosophy and social sciences
    #
    # Es una señal pequeña, no decisiva.

    if explicit_philosophy:

        score += 1
        reasons.append(
            "explicit-philosophy-text"
        )


    # Título: señal más fuerte que abstract.

    if title_hits:

        score += 2
        reasons.append(
            "strong-title-term"
        )

        if len(
            title_hits
        ) >= 2:

            score += 1
            reasons.append(
                "multiple-title-terms"
            )


    # Abstract.

    if abstract_hits:

        score += 1
        reasons.append(
            "strong-abstract-term"
        )

        if len(
            abstract_hits
        ) >= 3:

            score += 1
            reasons.append(
                "multiple-abstract-terms"
            )


    return (
        score,
        reasons,
    )


# ============================================================
# Tabla V3
# ============================================================

con.execute(
    """
    DROP TABLE IF EXISTS
    classified_v3
    """
)


con.execute(
    """
    CREATE TABLE classified_v3 (
        work_id BIGINT,

        v2_tier VARCHAR,
        v2_reason VARCHAR,

        tier VARCHAR,
        tier_reason VARCHAR,

        document_role VARCHAR,
        evidence_score BIGINT,

        primary_concept_id BIGINT,
        concept_score DOUBLE,
        philosophy_concept_count BIGINT,

        generic_philosophy_score DOUBLE,
        secondary_philosophy_score DOUBLE,
        nonduplicate_philosophy_score DOUBLE,

        ontology_keyword_id VARCHAR,
        ontology_keyword_score DOUBLE,
        ontology_keyword_count BIGINT,

        philosopher_hits VARCHAR,

        explicit_philosophy_text BOOLEAN,

        strong_title_hits VARCHAR,
        strong_abstract_hits VARCHAR,

        is_paratext BOOLEAN,

        top_domain_keyword_id VARCHAR,
        top_domain_keyword_score DOUBLE,

        hard_noise_keyword VARCHAR,
        hard_noise_score DOUBLE,

        title VARCHAR,
        abstract VARCHAR,

        publication_year BIGINT,
        language VARCHAR,
        type VARCHAR
    )
    """
)


insert_rows = []


for row in v2_rows:

    (
        work_id,
        primary_concept_id,
        concept_score,
        concept_count,
        generic_score,
        secondary_score,
        nonduplicate_score,
        top_domain_keyword,
        top_domain_score,
        hard_noise_keyword,
        hard_noise_score,
        title,
        publication_year,
        language,
        work_type,
        v2_tier,
        v2_reason,
    ) = row


    work_id = int(
        work_id
    )

    primary_concept_id = int(
        primary_concept_id
    )

    concept_name = concept_names.get(
        primary_concept_id,
        "?"
    )


    concept_score = float(
        concept_score
        or 0
    )

    concept_count = int(
        concept_count
        or 0
    )

    generic_score_value = (
        None
        if generic_score is None
        else float(
            generic_score
        )
    )

    secondary_score_value = (
        None
        if secondary_score is None
        else float(
            secondary_score
        )
    )

    nonduplicate_score = float(
        nonduplicate_score
        or 0
    )


    abstract = abstract_map.get(
        work_id
    )

    is_paratext = paratext_map.get(
        work_id,
        False
    )


    title_n = normalize(
        title
    )

    abstract_n = normalize(
        abstract
    )

    full_n = (
        title_n
        +
        " "
        +
        abstract_n
    ).strip()


    title_philosophers = philosopher_hits(
        title_n
    )

    abstract_philosophers = philosopher_hits(
        abstract_n
    )

    philosophers = sorted(
        set(title_philosophers)
        |
        set(abstract_philosophers)
    )


    clean_title = cleaned_philosophy_text(
        title_n,
        concept_name
    )

    clean_abstract = cleaned_philosophy_text(
        abstract_n,
        concept_name
    )


    title_hits = strong_text_hits(
        clean_title,
        concept_name
    )

    abstract_hits = strong_text_hits(
        clean_abstract,
        concept_name
    )


    explicit_philosophy = (
        has_explicit_philosophy(
            full_n,
            concept_name
        )
    )


    (
        ontology_keyword_id,
        ontology_keyword_score,
        ontology_keyword_count,
    ) = ontology_keyword_evidence(
        work_id,
        concept_name
    )


    role = document_role(
        title,
        abstract,
        concept_name,
        philosophers,
        title_hits,
        abstract_hits,
        explicit_philosophy,
        is_paratext,
    )


    score, score_reasons = (
        evidence_score(
            v2_tier=v2_tier,
            concept_name=concept_name,
            concept_score=concept_score,
            concept_count=concept_count,
            nonduplicate_score=(
                nonduplicate_score
            ),
            ontology_keyword_score=(
                ontology_keyword_score
            ),
            title_philosophers=title_philosophers,
            abstract_philosophers=abstract_philosophers,
            explicit_philosophy=(
                explicit_philosophy
            ),
            title_hits=title_hits,
            abstract_hits=abstract_hits,
        )
    )


    # ========================================================
    # Tier V3
    # ========================================================

    if v2_tier == "EXCLUDE":

        tier = "EXCLUDE"

        reason = (
            "carry-v2-high-confidence-exclude"
        )


    elif (
        concept_name ==
        "Phenomenology (philosophy)"

        and
        nonduplicate_score < 0.20

        and
        not philosophers

        and
        not explicit_philosophy

        and
        not title_hits

        and
        not abstract_hits

        and
        (
            float(
                hard_noise_score
                or 0
            ) >= 0.35

            or

            (
                str(
                    top_domain_keyword
                    or ""
                )
                in {
                    "physics",
                    "chemistry",
                    "materials-science",
                    "mathematics",
                }

                and

                float(
                    top_domain_score
                    or 0
                ) >= 0.45
            )
        )
    ):

        tier = "EXCLUDE"

        reason = (
            "phenomenology-hard-science-v3-1"
        )


    elif role == "LOW_QUALITY":

        tier = "BORDERLINE"

        reason = (
            "low-quality-document"
        )


    elif role == "PARATEXT":

        if score >= 6:

            tier = "PROBABLE"

            reason = (
                "paratext-with-strong-philosophy"
            )

        else:

            tier = "BORDERLINE"

            reason = (
                "paratext"
            )


    elif role == "EMPIRICAL_ADJACENT":

        if score >= 6:

            tier = "PROBABLE"

            reason = (
                "empirical-adjacent-"
                "with-strong-philosophy"
            )

        else:

            tier = "BORDERLINE"

            reason = (
                "empirical-adjacent"
            )


    # CORE V2 no ambiguo:
    # no exigimos abstract para conservarlo.

    elif (
        v2_tier == "CORE"
        and
        concept_name
        not in AMBIGUOUS_NAMES
    ):

        tier = "CORE"

        reason = (
            "carry-v2-core-"
            "nonambiguous"
        )


    else:

        if score >= 6:

            tier = "CORE"

            reason = (
                "context-evidence>=6"
            )

        elif score >= 3:

            tier = "PROBABLE"

            reason = (
                "context-evidence>=3"
            )

        else:

            tier = "BORDERLINE"

            reason = (
                "context-evidence<3"
            )


    insert_rows.append(
        (
            work_id,

            v2_tier,
            v2_reason,

            tier,
            reason,

            role,
            score,

            primary_concept_id,
            concept_score,
            concept_count,

            generic_score_value,
            secondary_score_value,
            nonduplicate_score,

            ontology_keyword_id,
            ontology_keyword_score,
            ontology_keyword_count,

            ", ".join(
                philosophers
            ),

            explicit_philosophy,

            ", ".join(
                title_hits
            ),

            ", ".join(
                abstract_hits
            ),

            is_paratext,

            top_domain_keyword,
            top_domain_score,

            hard_noise_keyword,
            hard_noise_score,

            title,
            abstract,

            publication_year,
            language,
            work_type,
        )
    )


placeholders = ", ".join(
    "?"
    for _ in range(
        len(
            insert_rows[0]
        )
    )
)


con.executemany(
    f"""
    INSERT INTO classified_v3
    VALUES (
        {placeholders}
    )
    """,
    insert_rows
)


# ============================================================
# Distribución V3
# ============================================================

print()
print("=" * 78)
print("CLASIFICADOR V3.1")
print("=" * 78)


tier_rows = con.execute(
    """
    SELECT
        tier,
        count(*) AS n

    FROM classified_v3

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


total = sum(
    int(
        row[1]
    )
    for row in tier_rows
)


for tier, count in tier_rows:

    print(
        f"{tier:12} "
        f"{int(count):8,}  "
        f"{int(count) / max(total, 1) * 100:5.1f}%"
    )


# ============================================================
# Transiciones
# ============================================================

print()
print("=" * 78)
print("TRANSICIÓN V2 → V3.1")
print("=" * 78)


rows = con.execute(
    """
    SELECT
        v2_tier,
        tier,
        count(*) AS n

    FROM classified_v3

    GROUP BY
        v2_tier,
        tier

    ORDER BY
        v2_tier,
        n DESC
    """
).fetchall()


for old, new, count in rows:

    print(
        f"{old:12} "
        f"→ {new:12} "
        f"{int(count):7,}"
    )


# ============================================================
# Roles
# ============================================================

print()
print("=" * 78)
print("ROLES DOCUMENTALES")
print("=" * 78)


rows = con.execute(
    """
    SELECT
        document_role,
        count(*) AS n

    FROM classified_v3

    GROUP BY
        document_role

    ORDER BY
        n DESC
    """
).fetchall()


for role, count in rows:

    print(
        f"{role:22} "
        f"{int(count):8,}  "
        f"{int(count) / max(total, 1) * 100:5.1f}%"
    )


# ============================================================
# Razones
# ============================================================

print()
print("=" * 78)
print("RAZONES V3")
print("=" * 78)


rows = con.execute(
    """
    SELECT
        tier,
        tier_reason,
        count(*) AS n

    FROM classified_v3

    GROUP BY
        tier,
        tier_reason

    ORDER BY
        tier,
        n DESC
    """
).fetchall()


for tier, reason, count in rows:

    print(
        f"{tier:12} "
        f"{reason:46} "
        f"{int(count):7,}"
    )


# ============================================================
# Auditoría humana
# ============================================================

def show_examples(
    where_sql,
    label,
    limit=30,
):

    print()
    print("=" * 78)
    print(label)
    print("=" * 78)


    rows = con.execute(
        f"""
        SELECT
            primary_concept_id,

            v2_tier,
            tier,
            tier_reason,

            document_role,
            evidence_score,

            concept_score,
            philosophy_concept_count,

            nonduplicate_philosophy_score,

            ontology_keyword_id,
            ontology_keyword_score,

            philosopher_hits,

            explicit_philosophy_text,

            strong_title_hits,
            strong_abstract_hits,

            title,
            abstract

        FROM classified_v3

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
                row[0]
            ),
            "?"
        )

        ontology_kw = (
            "—"
            if row[9] is None
            else (
                f"{row[9]}:"
                f"{float(row[10] or 0):.3f}"
            )
        )

        title = " ".join(
            str(
                row[15]
                or "(sin título)"
            ).split()
        )

        abstract = " ".join(
            str(
                row[16]
                or "(sin abstract)"
            ).split()
        )


        print()

        print(
            f"{row[1]} → {row[2]}  "
            f"score={row[5]}  "
            f"role={row[4]}"
        )

        print(
            f"concept={float(row[6] or 0):.3f} "
            f"n={int(row[7] or 0)} "
            f"nondup={float(row[8] or 0):.3f}"
        )

        print(
            "ANCLA:",
            concept
        )

        print(
            "RAZÓN:",
            row[3]
        )

        print(
            "ONTOLOGY KW:",
            ontology_kw
        )

        print(
            "FILÓSOFOS:",
            row[11] or "—"
        )

        print(
            "EXPLICIT PHILOSOPHY:",
            bool(
                row[12]
            )
        )

        print(
            "TITLE HITS:",
            row[13] or "—"
        )

        print(
            "ABSTRACT HITS:",
            row[14] or "—"
        )

        print(
            "TÍTULO:",
            title[:220]
        )

        print(
            "ABSTRACT:",
            abstract[:650]
        )


# ------------------------------------------------------------
# Lo más importante:
# filosofía recuperada desde BORDERLINE.
# ------------------------------------------------------------

show_examples(
    """
    v2_tier = 'BORDERLINE'

    AND
        tier IN (
            'CORE',
            'PROBABLE'
        )
    """,
    "PROMOCIONES DESDE BORDERLINE",
    limit=45,
)


# ------------------------------------------------------------
# CORE ambiguos que V3 ya no considera CORE.
# ------------------------------------------------------------

show_examples(
    f"""
    v2_tier = 'CORE'

    AND
        primary_concept_id
        IN (
            {ambiguous_sql}
        )

    AND
        tier <> 'CORE'
    """,
    "CORE AMBIGUOS DEMOVIDOS",
    limit=40,
)


# ------------------------------------------------------------
# CORE ambiguos que sobreviven.
# ------------------------------------------------------------

show_examples(
    f"""
    tier = 'CORE'

    AND
        primary_concept_id
        IN (
            {ambiguous_sql}
        )
    """,
    "CORE AMBIGUOS V3",
    limit=35,
)


# ------------------------------------------------------------
# Fenomenología/metodología/medicina/terapia empírica.
# ------------------------------------------------------------

show_examples(
    """
    document_role =
    'EMPIRICAL_ADJACENT'
    """,
    "EMPIRICAL ADJACENT",
    limit=40,
)


# ------------------------------------------------------------
# Paratext y ruido documental.
# ------------------------------------------------------------

show_examples(
    """
    document_role
    IN (
        'PARATEXT',
        'LOW_QUALITY'
    )
    """,
    "PARATEXT / LOW QUALITY",
    limit=35,
)


# ------------------------------------------------------------
# Reseñas.
# ------------------------------------------------------------

show_examples(
    """
    document_role =
    'REVIEW'
    """,
    "REVIEWS",
    limit=25,
)


# ------------------------------------------------------------
# Exclusiones.
# ------------------------------------------------------------

show_examples(
    """
    tier =
    'EXCLUDE'
    """,
    "EXCLUDE V3",
    limit=35,
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
        FROM classified_v3
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
    "Tiempo contexto V3:",
    f"{time.time() - context_start:.1f}s"
)

print()
print("=" * 78)
print("FIN")
print("=" * 78)

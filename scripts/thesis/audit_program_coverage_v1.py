#!/usr/bin/env python3
"""Reproject thesis program coverage against the current authority registry.

This audit is intentionally narrower than a canonical rebuild:

- source-type and institution decisions are inherited from the canonical snapshot;
- program resolution is recomputed with the current AcademicProgramAuthority;
- admission is reprojected through the same deterministic gate semantics;
- date quality is recomputed with the current canonical normalizer;
- Program Curation Queue is rebuilt over the reprojected dimensions.

It allows a frozen full inventory to be audited after registry/date-policy changes
without recrawling RIUdeG or UDGVirtual.
"""

from __future__ import annotations

import argparse
import copy
import gzip
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import build_canonical_corpus_v1 as canonical
import build_program_curation_queue_v1 as curation


SCHEMA_VERSION = "thesis-program-coverage-audit-v1"


def read_json(path: Path) -> Any:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            return json.load(handle)
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def project_work_admission(
    work: dict[str, Any],
    registry: dict[str, Any],
) -> dict[str, Any]:
    """Reproject only registry-dependent admission decisions.

    Source-type rejection and external-institution exclusion are inherited from
    the frozen canonical snapshot. Institution confirmation is *not* inferred
    from program identity or provider membership.
    """

    original_status = work.get("admissionStatus")
    institution_ref = work.get("institutionRef")
    udg_ref = (registry.get("institution") or {}).get("id")
    program = canonical.resolve_program(work.get("programRaw"), registry)

    if original_status == "reject-source":
        status = "reject-source"
        code = "not-a-thesis"
    elif original_status == "exclude" and institution_ref != udg_ref:
        status = "exclude"
        code = "external-institution"
    elif institution_ref != udg_ref:
        status = "quarantine"
        code = "unresolved-institution"
    elif program.get("status") == "confirmed" and program.get("admissionState") == "include":
        status = "include"
        code = "confirmed-humanities-program"
    elif program.get("status") == "confirmed" and program.get("admissionState") == "review":
        status = "review"
        code = "program-review"
    elif program.get("status") == "confirmed" and program.get("admissionState") == "exclude":
        status = "exclude"
        code = "non-humanities-program"
    elif program.get("status") == "confirmed":
        status = "quarantine"
        code = "unsupported-program-admission-state"
    elif program.get("status") == "unknown":
        status = "quarantine"
        code = "unknown-program"
    else:
        status = "quarantine"
        code = "insufficient-program-metadata"

    return {
        "status": status,
        "explanationCode": code,
        "program": program,
        "institutionRef": institution_ref,
    }


def reproject_corpus(
    corpus: dict[str, Any],
    registry: dict[str, Any],
    *,
    reference_year: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    works: list[dict[str, Any]] = []
    original_admission = Counter()
    projected_admission = Counter()
    date_quality = Counter()
    program_state_works = Counter()
    program_refs = Counter()
    blocked = []
    program_dimensions: dict[str, dict[str, Counter[str]]] = defaultdict(
        lambda: {
            "admissionStatuses": Counter(),
            "programRefs": Counter(),
        }
    )

    for original in corpus.get("works", []):
        work = copy.deepcopy(original)
        original_admission[work.get("admissionStatus") or "unknown"] += 1

        projection = project_work_admission(work, registry)
        projected_admission[projection["status"]] += 1
        work["admissionStatus"] = projection["status"]
        work["admissionExplanationCodes"] = [projection["explanationCode"]]

        program = projection["program"]
        if program.get("status") == "confirmed":
            work["programRef"] = program.get("programRef")
            state = program.get("admissionState") or "unknown"
            program_state_works[state] += 1
            if program.get("programRef"):
                program_refs[program["programRef"]] += 1

            if state in {"include", "review"} and projection["status"] != state:
                blocked.append(
                    {
                        "workId": work.get("id"),
                        "title": work.get("title"),
                        "programRaw": work.get("programRaw"),
                        "programRef": program.get("programRef"),
                        "programAdmissionState": state,
                        "projectedAdmissionStatus": projection["status"],
                        "explanationCode": projection["explanationCode"],
                        "institutionRaw": work.get("institutionRaw"),
                        "institutionRef": work.get("institutionRef"),
                        "sourceRecordRefs": list(work.get("sourceRecordRefs") or []),
                        "persistentIdentifiers": list(
                            work.get("persistentIdentifiers") or []
                        ),
                    }
                )
        else:
            work["programRef"] = None
            if work.get("programRaw"):
                program_state_works["unresolved"] += 1
            else:
                program_state_works["missing"] += 1

        raw_date = (original.get("date") or {}).get("raw")
        current_date = canonical.date_info(
            raw_date,
            reference_year=reference_year,
        )
        work["date"] = current_date
        date_quality[current_date.get("quality") or "unknown"] += 1

        normalized_key = canonical.normalize_key(work.get("programRaw"))
        if normalized_key:
            dims = program_dimensions[normalized_key]
            dims["admissionStatuses"][projection["status"]] += 1
            if work.get("programRef"):
                dims["programRefs"][work["programRef"]] += 1

        works.append(work)

    projected = dict(corpus)
    projected["works"] = works
    projected["programAuthorityRevision"] = registry.get(
        "registryRevision",
        registry.get("schemaVersion"),
    )

    metrics = {
        "originalAdmission": dict(sorted(original_admission.items())),
        "projectedAdmission": dict(sorted(projected_admission.items())),
        "dateQuality": dict(sorted(date_quality.items())),
        "programStateWorks": dict(sorted(program_state_works.items())),
        "programRefWorks": dict(program_refs.most_common()),
        "gateBlockers": blocked,
        "gateBlockerCount": len(blocked),
        "programDimensions": program_dimensions,
    }
    return projected, metrics


def reproject_observed_authorities(
    observed: dict[str, Any],
    program_dimensions: dict[str, dict[str, Counter[str]]],
) -> dict[str, Any]:
    output = copy.deepcopy(observed)
    for row in output.get("programs", []):
        key = row.get("normalizedKey") or ""
        dims = program_dimensions.get(key)
        if not dims:
            row["admissionStatuses"] = {}
            row["programRefs"] = {}
            continue
        row["admissionStatuses"] = dict(
            dims["admissionStatuses"].most_common()
        )
        row["programRefs"] = dict(dims["programRefs"].most_common())
    return output


def authority_coverage(
    registry: dict[str, Any],
    program_ref_works: dict[str, int],
) -> dict[str, Any]:
    programs = list(registry.get("programs") or [])
    total_states = Counter()
    observed_states = Counter()
    unobserved = []

    for program in programs:
        state = program.get("admissionState") or "unknown"
        total_states[state] += 1
        count = int(program_ref_works.get(program.get("id"), 0))
        if count:
            observed_states[state] += 1
        else:
            unobserved.append(
                {
                    "programRef": program.get("id"),
                    "canonicalName": program.get("canonicalName"),
                    "admissionState": state,
                    "lifecycleState": program.get("lifecycleState"),
                }
            )

    return {
        "registryAuthorities": len(programs),
        "registryByAdmissionState": dict(sorted(total_states.items())),
        "observedAuthorities": sum(observed_states.values()),
        "observedByAdmissionState": dict(sorted(observed_states.items())),
        "unobservedAuthorities": unobserved,
    }


def aggregate_review_authorities(
    queue: dict[str, Any],
) -> list[dict[str, Any]]:
    aggregate: dict[str, dict[str, Any]] = {}

    for item in queue.get("items", []):
        if item.get("queueState") != "review":
            continue
        authority = item.get("authority") or {}
        key = authority.get("id") or item.get("normalizedKey")
        row = aggregate.setdefault(
            key,
            {
                "programRef": authority.get("id"),
                "canonicalName": authority.get("canonicalName"),
                "admissionState": authority.get("admissionState"),
                "observedGroups": 0,
                "works": 0,
                "normalizedKeys": [],
            },
        )
        row["observedGroups"] += 1
        row["works"] += int(item.get("count") or 0)
        row["normalizedKeys"].append(item.get("normalizedKey"))

    return sorted(
        aggregate.values(),
        key=lambda row: (-row["works"], row["canonicalName"] or ""),
    )


def top_queue_items(
    queue: dict[str, Any],
    *,
    state: str,
    limit: int,
) -> list[dict[str, Any]]:
    rows = []
    for item in queue.get("items", []):
        if item.get("queueState") != state:
            continue
        rows.append(
            {
                "rank": item.get("rank"),
                "normalizedKey": item.get("normalizedKey"),
                "count": item.get("count"),
                "curationLane": item.get("curationLane"),
                "priority": item.get("priority"),
                "observedUnits": item.get("observedUnits"),
                "observedYears": item.get("observedYears"),
                "variants": item.get("variants"),
                "evidenceNeeds": item.get("evidenceNeeds"),
            }
        )
        if len(rows) >= limit:
            break
    return rows


def build_audit(
    *,
    observed: dict[str, Any],
    corpus: dict[str, Any],
    registry: dict[str, Any],
    reference_year: int,
    top: int,
) -> dict[str, Any]:
    projected_corpus, projection = reproject_corpus(
        corpus,
        registry,
        reference_year=reference_year,
    )
    projected_observed = reproject_observed_authorities(
        observed,
        projection["programDimensions"],
    )

    queue = curation.build_queue(
        projected_observed,
        projected_corpus,
        registry,
    )

    authority = authority_coverage(
        registry,
        projection["programRefWorks"],
    )

    gate_blockers = sorted(
        projection["gateBlockers"],
        key=lambda row: (
            row.get("programAdmissionState") or "",
            row.get("programRef") or "",
            row.get("title") or "",
        ),
    )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "projectionMode": (
            "freeze-source-type-and-institution;"
            "reproject-program-authority-date-quality-and-curation"
        ),
        "inputCorpusRevision": corpus.get("buildRevision"),
        "inputProgramAuthorityRevision": corpus.get(
            "programAuthorityRevision"
        ),
        "programAuthorityRevision": registry.get(
            "registryRevision",
            registry.get("schemaVersion"),
        ),
        "referenceYear": reference_year,
        "metrics": {
            "works": len(projected_corpus.get("works", [])),
            "originalAdmission": projection["originalAdmission"],
            "projectedAdmission": projection["projectedAdmission"],
            "dateQuality": projection["dateQuality"],
            "programStateWorks": projection["programStateWorks"],
            "gateBlockerCount": projection["gateBlockerCount"],
            "authorityCoverage": authority,
            "programQueue": queue.get("metrics"),
        },
        "gateBlockers": gate_blockers,
        "reviewAuthorities": aggregate_review_authorities(queue),
        "topUnresolved": top_queue_items(
            queue,
            state="unresolved",
            limit=max(top, 0),
        ),
        "topReviewGroups": top_queue_items(
            queue,
            state="review",
            limit=max(top, 0),
        ),
    }


def markdown_summary(audit: dict[str, Any]) -> str:
    metrics = audit["metrics"]
    admissions = metrics["projectedAdmission"]
    authority = metrics["authorityCoverage"]
    queue = metrics["programQueue"]

    lines = [
        "# Thesis Humanities Program Coverage Audit V1",
        "",
        "Auditoría de cobertura sobre un inventario congelado. "
        "**No cambia admisión ni autoridad.**",
        "",
        f"- registry: `{audit['programAuthorityRevision']}`",
        f"- obras: {metrics['works']}",
        (
            "- admisión proyectada: "
            + json.dumps(admissions, ensure_ascii=False, sort_keys=True)
        ),
        (
            "- calidad de fecha: "
            + json.dumps(
                metrics["dateQuality"],
                ensure_ascii=False,
                sort_keys=True,
            )
        ),
        (
            "- autoridades observadas: "
            f"{authority['observedAuthorities']} / "
            f"{authority['registryAuthorities']}"
        ),
        (
            "- grupos en cola: "
            f"{queue['queueItems']} de "
            f"{queue['observedProgramGroups']} observados"
        ),
        f"- gate blockers: {metrics['gateBlockerCount']}",
        "",
        "## Diferencia crítica",
        "",
        "Un programa resuelto como INCLUDE no implica que la obra entre al corpus. "
        "La institución otorgante debe estar confirmada de forma independiente.",
        "",
        "## Gate blockers",
        "",
        "| Programa | Estado programa | Estado obra | Razón | Título |",
        "|---|---|---|---|---|",
    ]

    for item in audit.get("gateBlockers", []):
        title = str(item.get("title") or "—").replace("|", "\\|")
        program = str(item.get("programRaw") or "—").replace("|", "\\|")
        lines.append(
            "| {program} | {program_state} | {work_state} | {code} | {title} |".format(
                program=program,
                program_state=item.get("programAdmissionState") or "—",
                work_state=item.get("projectedAdmissionStatus") or "—",
                code=item.get("explanationCode") or "—",
                title=title,
            )
        )

    lines.extend(
        [
            "",
            "## REVIEW por autoridad",
            "",
            "| Autoridad | Grupos observados | Tesis |",
            "|---|---:|---:|",
        ]
    )
    for row in audit.get("reviewAuthorities", []):
        name = str(row.get("canonicalName") or row.get("programRef") or "—")
        lines.append(
            f"| {name.replace('|', '\\|')} | "
            f"{row['observedGroups']} | {row['works']} |"
        )

    lines.extend(
        [
            "",
            "## Top unresolved",
            "",
            "| # | Carril | Banda | Score | Programa observado | Tesis | Unidad principal |",
            "|---:|---|:---:|---:|---|---:|---|",
        ]
    )

    for item in audit.get("topUnresolved", []):
        priority = item.get("priority") or {}
        units = list((item.get("observedUnits") or {}).items())
        unit = f"{units[0][0]} ({units[0][1]})" if units else "—"
        label = next(
            iter((item.get("variants") or {}).keys()),
            item.get("normalizedKey") or "—",
        )
        lines.append(
            "| {rank} | {lane} | {band} | {score:.3f} | {label} | {count} | {unit} |".format(
                rank=item.get("rank") or "",
                lane=item.get("curationLane") or "—",
                band=priority.get("band") or "—",
                score=float(priority.get("score") or 0),
                label=str(label).replace("|", "\\|"),
                count=item.get("count") or 0,
                unit=unit.replace("|", "\\|"),
            )
        )

    lines.extend(
        [
            "",
            "## Regla",
            "",
            "Esta auditoría sólo mide cobertura y prioriza revisión. "
            "No transforma score, unidad académica, provider o coincidencia "
            "temática en una decisión disciplinaria.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--observed-authorities", required=True)
    parser.add_argument("--canonical-corpus", required=True)
    parser.add_argument(
        "--registry",
        default=str(canonical.DEFAULT_REGISTRY),
    )
    parser.add_argument(
        "--output-dir",
        default="artifacts/thesis-program-coverage",
    )
    parser.add_argument("--reference-year", type=int, default=2026)
    parser.add_argument("--top", type=int, default=30)
    args = parser.parse_args()

    observed = read_json(Path(args.observed_authorities))
    corpus = read_json(Path(args.canonical_corpus))
    registry = canonical.load_program_registry(args.registry)

    audit = build_audit(
        observed=observed,
        corpus=corpus,
        registry=registry,
        reference_year=args.reference_year,
        top=args.top,
    )

    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / "program-coverage-audit.json", audit)
    (output / "program-coverage-audit.md").write_text(
        markdown_summary(audit),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "schemaVersion": audit["schemaVersion"],
                "programAuthorityRevision": audit[
                    "programAuthorityRevision"
                ],
                "metrics": audit["metrics"],
                "gateBlockers": audit["gateBlockers"],
                "topUnresolved": audit["topUnresolved"][:10],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

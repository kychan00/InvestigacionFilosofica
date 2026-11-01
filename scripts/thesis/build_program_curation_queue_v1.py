#!/usr/bin/env python3
"""Build a deterministic curation queue for observed UdeG thesis programs.

This tool prioritizes *human review*. It never changes Humanities admission,
never mutates the AcademicProgramAuthority registry, and never promotes an
unresolved program based on lexical/organizational signals.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
import re

from collections import Counter
from pathlib import Path
from typing import Any

import build_canonical_corpus_v1 as canonical


SCHEMA_VERSION = "thesis-program-curation-queue-v1"

HUMANITIES_NAME_SIGNALS: tuple[tuple[str, int], ...] = (
    ("humanidades", 24),
    ("filosofia", 22),
    ("bioetica", 20),
    ("historia", 18),
    ("literatura", 18),
    ("literario", 18),
    ("letras", 18),
    ("linguistica", 18),
    ("antropologia", 18),
    ("geografia", 16),
    ("mesoamericano", 16),
    ("mesoamericanos", 16),
    ("lengua", 13),
    ("idiomas", 12),
    ("ingles", 10),
    ("frances", 10),
    ("aleman", 10),
    ("escritura", 14),
    ("patrimonio", 10),
    ("arte", 8),
    ("cultura", 8),
    ("cultural", 8),
    ("hermeneutica", 16),
    ("arqueologia", 14),
    ("etnografia", 14),
)

UNIT_PRIORITY_WEIGHTS: dict[str, int] = {
    "CUCSH": 18,
    "CUTONALA": 7,
    "CUAAD": 5,
    "SUV": 3,
}


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


def phrase_present(normalized_key: str, phrase: str) -> bool:
    phrase_key = canonical.normalize_key(phrase)
    if not normalized_key or not phrase_key:
        return False
    return bool(
        re.search(
            rf"(?:^| ){re.escape(phrase_key)}(?: |$)",
            normalized_key,
        )
    )


def level_hint(normalized_key: str) -> str:
    prefixes = (
        ("licenciatura ", "licenciatura"),
        ("maestria ", "maestria"),
        ("doctorado ", "doctorado"),
        ("especialidad ", "especialidad"),
        ("tecnico superior ", "tecnico-superior"),
    )
    for prefix, value in prefixes:
        if normalized_key.startswith(prefix):
            return value
    return "unknown"


def build_authority_lookup(
    registry: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    return canonical.build_program_index(registry)


def aggregate_work_dimensions(
    corpus: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    aggregate: dict[str, dict[str, Any]] = {}

    for work in corpus.get("works", []):
        normalized_key = canonical.normalize_key(work.get("programRaw"))
        if not normalized_key:
            continue

        item = aggregate.setdefault(
            normalized_key,
            {
                "units": Counter(),
                "years": [],
                "thesisTypes": Counter(),
                "admissionStatuses": Counter(),
                "works": 0,
            },
        )

        item["works"] += 1

        unit = canonical.clean_text(work.get("academicUnitRaw"))
        if unit:
            item["units"][unit] += 1

        date = work.get("date") or {}
        value = canonical.clean_text(date.get("value"))
        quality = date.get("quality")
        if (
            quality == "valid"
            and value
            and len(value) >= 4
            and value[:4].isdigit()
        ):
            year = int(value[:4])
            if 1800 <= year <= 2100:
                item["years"].append(year)

        thesis_type = canonical.clean_text(work.get("thesisTypeRaw"))
        if thesis_type:
            item["thesisTypes"][thesis_type] += 1

        item["admissionStatuses"][
            work.get("admissionStatus") or "unknown"
        ] += 1

    return aggregate


def authority_for_key(
    normalized_key: str,
    authority_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    return authority_lookup.get(normalized_key)


def queue_state(authority: dict[str, Any] | None) -> str:
    if authority is None:
        return "unresolved"
    state = authority.get("admissionState")
    if state == "review":
        return "review"
    return "resolved"


def name_signals(normalized_key: str) -> list[dict[str, Any]]:
    signals = []
    seen: set[str] = set()
    for phrase, weight in HUMANITIES_NAME_SIGNALS:
        phrase_key = canonical.normalize_key(phrase)
        if phrase_key in seen:
            continue
        if phrase_present(normalized_key, phrase_key):
            seen.add(phrase_key)
            signals.append(
                {
                    "signal": phrase_key,
                    "weight": weight,
                }
            )
    return signals


def unit_signals(units: Counter[str]) -> list[dict[str, Any]]:
    output = []
    for raw_unit, count in units.most_common():
        key = canonical.normalize_key(raw_unit).upper().replace(" ", "")
        for canonical_unit, weight in UNIT_PRIORITY_WEIGHTS.items():
            if canonical_unit in key:
                output.append(
                    {
                        "unit": raw_unit,
                        "matchedUnit": canonical_unit,
                        "count": count,
                        "weight": weight,
                    }
                )
                break
    return output


def priority_for_item(
    *,
    count: int,
    variants: dict[str, int],
    normalized_key: str,
    units: Counter[str],
    years: list[int],
    state: str,
    authority: dict[str, Any] | None,
) -> dict[str, Any]:
    reasons: list[str] = []

    frequency_points = min(34.0, math.log10(count + 1) * 13.0)
    if count >= 50:
        reasons.append("high-frequency")
    elif count >= 10:
        reasons.append("medium-frequency")

    lexical = name_signals(normalized_key)
    lexical_points = min(28, sum(item["weight"] for item in lexical))
    if lexical:
        reasons.append("humanities-name-signal")

    unit_matches = unit_signals(units)
    unit_points = min(20, sum(item["weight"] for item in unit_matches))
    if unit_matches:
        reasons.append("priority-unit-observed")

    review_points = 25 if state == "review" else 0
    if state == "review":
        reasons.append("existing-review-decision")

    variant_points = 4 if len(variants) > 1 else 0
    if variant_points:
        reasons.append("multiple-source-variants")

    historical_points = 0
    if years and min(years) < 2010:
        historical_points = 5
        reasons.append("historical-observations")

    lineage_points = 0
    if authority and (
        authority.get("possibleSuccessorRef")
        or authority.get("lifecycleState") == "historical"
    ):
        lineage_points = 8
        reasons.append("lineage-review-needed")

    score = round(
        min(
            100.0,
            frequency_points
            + lexical_points
            + unit_points
            + review_points
            + variant_points
            + historical_points
            + lineage_points,
        ),
        3,
    )

    if state == "review" or score >= 60:
        band = "A"
    elif score >= 45:
        band = "B"
    elif score >= 28:
        band = "C"
    else:
        band = "D"

    return {
        "score": score,
        "band": band,
        "reasons": reasons,
        "components": {
            "frequency": round(frequency_points, 3),
            "nameSignals": lexical_points,
            "unitSignals": unit_points,
            "reviewState": review_points,
            "variantComplexity": variant_points,
            "historicalSpan": historical_points,
            "lineage": lineage_points,
        },
        "nameSignals": lexical,
        "unitSignals": unit_matches,
    }


def curation_lane(
    *,
    state: str,
    priority: dict[str, Any],
    count: int,
) -> str:
    if state == "review":
        return "scope-review"
    if priority.get("nameSignals"):
        return "humanities-candidate"
    if priority.get("unitSignals"):
        return "unit-triage"
    if count >= 50:
        return "high-impact-triage"
    return "backlog"


LANE_ORDER = {
    "scope-review": 0,
    "humanities-candidate": 1,
    "unit-triage": 2,
    "high-impact-triage": 3,
    "backlog": 4,
}


def evidence_needs(
    *,
    state: str,
    authority: dict[str, Any] | None,
    years: list[int],
) -> list[str]:
    needs: list[str] = []

    if state == "review":
        needs.append("scope-decision")
        if authority and (
            authority.get("possibleSuccessorRef")
            or authority.get("lifecycleState") == "historical"
        ):
            needs.append("lineage-evidence")
        return needs

    needs.extend(
        [
            "official-program-evidence",
            "academic-unit-evidence",
        ]
    )

    if years and min(years) < 2010:
        needs.append("historical-dictamen-or-archive")

    return needs


def build_queue(
    observed: dict[str, Any],
    corpus: dict[str, Any],
    registry: dict[str, Any],
    *,
    include_resolved: bool = False,
) -> dict[str, Any]:
    dimensions = aggregate_work_dimensions(corpus)
    authority_lookup = build_authority_lookup(registry)

    items: list[dict[str, Any]] = []
    all_state_counts: Counter[str] = Counter()
    all_work_counts: Counter[str] = Counter()

    for row in observed.get("programs", []):
        normalized_key = row.get("normalizedKey") or ""
        authority = authority_for_key(normalized_key, authority_lookup)
        state = queue_state(authority)
        all_state_counts[state] += 1
        all_work_counts[state] += int(row.get("count") or 0)

        if state == "resolved" and not include_resolved:
            continue

        extra = dimensions.get(
            normalized_key,
            {
                "units": Counter(),
                "years": [],
                "thesisTypes": Counter(),
                "admissionStatuses": Counter(),
                "works": 0,
            },
        )

        years = sorted(extra["years"])
        priority = priority_for_item(
            count=int(row.get("count") or 0),
            variants=dict(row.get("variants") or {}),
            normalized_key=normalized_key,
            units=extra["units"],
            years=years,
            state=state,
            authority=authority,
        )

        lane = curation_lane(
            state=state,
            priority=priority,
            count=int(row.get("count") or 0),
        )

        item = {
            "normalizedKey": normalized_key,
            "count": int(row.get("count") or 0),
            "variants": dict(row.get("variants") or {}),
            "providers": dict(row.get("providers") or {}),
            "currentObservedAdmissionStatuses": dict(
                row.get("admissionStatuses") or {}
            ),
            "currentProgramRefs": dict(row.get("programRefs") or {}),
            "queueState": state,
            "curationLane": lane,
            "authority": (
                {
                    "id": authority.get("id"),
                    "canonicalName": authority.get("canonicalName"),
                    "admissionState": authority.get("admissionState"),
                    "lifecycleState": authority.get("lifecycleState"),
                    "possibleSuccessorRef": authority.get("possibleSuccessorRef"),
                    "evidence": authority.get("evidence") or [],
                }
                if authority
                else None
            ),
            "levelHint": level_hint(normalized_key),
            "observedUnits": dict(extra["units"].most_common()),
            "observedYears": {
                "min": min(years) if years else None,
                "max": max(years) if years else None,
                "validObservations": len(years),
            },
            "thesisTypes": dict(extra["thesisTypes"].most_common()),
            "priority": priority,
            "evidenceNeeds": evidence_needs(
                state=state,
                authority=authority,
                years=years,
            ),
            "decisionConstraint": (
                "priority-does-not-change-admission"
            ),
        }
        items.append(item)

    items.sort(
        key=lambda item: (
            LANE_ORDER[item["curationLane"]],
            -item["priority"]["score"],
            -item["count"],
            item["normalizedKey"],
        )
    )

    for rank, item in enumerate(items, start=1):
        item["rank"] = rank

    band_counts = Counter(item["priority"]["band"] for item in items)
    queue_state_counts = Counter(item["queueState"] for item in items)
    lane_counts = Counter(item["curationLane"] for item in items)

    return {
        "schemaVersion": SCHEMA_VERSION,
        "programAuthorityRevision": registry.get(
            "registryRevision",
            registry.get("schemaVersion"),
        ),
        "inventoryBaseline": registry.get("inventoryBaseline"),
        "metrics": {
            "observedProgramGroups": len(observed.get("programs", [])),
            "queueItems": len(items),
            "queueStateCounts": dict(queue_state_counts),
            "priorityBands": dict(sorted(band_counts.items())),
            "curationLanes": dict(
                sorted(
                    lane_counts.items(),
                    key=lambda pair: LANE_ORDER[pair[0]],
                )
            ),
            "allProgramStates": dict(all_state_counts),
            "worksByProgramState": dict(all_work_counts),
            "worksRepresentedInQueue": sum(item["count"] for item in items),
        },
        "items": items,
    }


def write_csv(path: Path, queue: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = [
        "rank",
        "priorityBand",
        "priorityScore",
        "queueState",
        "curationLane",
        "normalizedKey",
        "count",
        "levelHint",
        "authorityId",
        "authorityName",
        "authorityAdmissionState",
        "yearMin",
        "yearMax",
        "observedUnits",
        "variants",
        "nameSignals",
        "reasons",
        "evidenceNeeds",
    ]

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()

        for item in queue.get("items", []):
            authority = item.get("authority") or {}
            writer.writerow(
                {
                    "rank": item["rank"],
                    "priorityBand": item["priority"]["band"],
                    "priorityScore": item["priority"]["score"],
                    "queueState": item["queueState"],
                    "curationLane": item["curationLane"],
                    "normalizedKey": item["normalizedKey"],
                    "count": item["count"],
                    "levelHint": item["levelHint"],
                    "authorityId": authority.get("id") or "",
                    "authorityName": authority.get("canonicalName") or "",
                    "authorityAdmissionState": (
                        authority.get("admissionState") or ""
                    ),
                    "yearMin": item["observedYears"]["min"] or "",
                    "yearMax": item["observedYears"]["max"] or "",
                    "observedUnits": json.dumps(
                        item["observedUnits"],
                        ensure_ascii=False,
                        sort_keys=True,
                    ),
                    "variants": json.dumps(
                        item["variants"],
                        ensure_ascii=False,
                        sort_keys=True,
                    ),
                    "nameSignals": ";".join(
                        signal["signal"]
                        for signal in item["priority"]["nameSignals"]
                    ),
                    "reasons": ";".join(item["priority"]["reasons"]),
                    "evidenceNeeds": ";".join(item["evidenceNeeds"]),
                }
            )


def markdown_summary(
    queue: dict[str, Any],
    *,
    top: int,
) -> str:
    metrics = queue["metrics"]
    lines = [
        "# Thesis Program Curation Queue V1",
        "",
        "Esta cola prioriza revisión humana. **No decide admisión.**",
        "",
        f"- grupos observados: {metrics['observedProgramGroups']}",
        f"- items en cola: {metrics['queueItems']}",
        (
            "- revisión/resolución: "
            + json.dumps(
                metrics["queueStateCounts"],
                ensure_ascii=False,
                sort_keys=True,
            )
        ),
        (
            "- bandas: "
            + json.dumps(
                metrics["priorityBands"],
                ensure_ascii=False,
                sort_keys=True,
            )
        ),
        "",
        f"## Top {min(top, len(queue['items']))}",
        "",
        "| # | Carril | Banda | Score | Estado | Programa observado | Tesis | Unidad principal | Años |",
        "|---:|---|:---:|---:|---|---|---:|---|---|",
    ]

    for item in queue["items"][:top]:
        units = list(item["observedUnits"].items())
        unit = (
            f"{units[0][0]} ({units[0][1]})"
            if units
            else "—"
        )
        years = item["observedYears"]
        span = (
            f"{years['min']}–{years['max']}"
            if years["min"] is not None
            else "—"
        )
        label = (
            (item.get("authority") or {}).get("canonicalName")
            or next(iter(item["variants"]), item["normalizedKey"])
        )
        label = str(label).replace("|", "\\|")

        lines.append(
            "| {rank} | {lane} | {band} | {score:.3f} | {state} | {label} | "
            "{count} | {unit} | {span} |".format(
                rank=item["rank"],
                lane=item["curationLane"],
                band=item["priority"]["band"],
                score=item["priority"]["score"],
                state=item["queueState"],
                label=label,
                count=item["count"],
                unit=unit.replace("|", "\\|"),
                span=span,
            )
        )

    lines.extend(
        [
            "",
            "## Regla",
            "",
            "La puntuación sólo ordena qué revisar primero. "
            "Ningún score, señal lexical o unidad académica puede cambiar "
            "INCLUDE/REVIEW/EXCLUDE sin una decisión explícita en "
            "AcademicProgramAuthority.",
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
        default="artifacts/thesis-program-curation",
    )
    parser.add_argument("--top", type=int, default=50)
    parser.add_argument("--include-resolved", action="store_true")
    args = parser.parse_args()

    observed = read_json(Path(args.observed_authorities))
    corpus = read_json(Path(args.canonical_corpus))
    registry = canonical.load_program_registry(args.registry)

    queue = build_queue(
        observed,
        corpus,
        registry,
        include_resolved=args.include_resolved,
    )

    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / "program-curation-queue.json", queue)
    write_csv(output / "program-curation-queue.csv", queue)
    (output / "program-curation-queue.md").write_text(
        markdown_summary(queue, top=max(args.top, 0)),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "schemaVersion": queue["schemaVersion"],
                "programAuthorityRevision": queue[
                    "programAuthorityRevision"
                ],
                "metrics": queue["metrics"],
                "top": [
                    {
                        "rank": item["rank"],
                        "band": item["priority"]["band"],
                        "score": item["priority"]["score"],
                        "state": item["queueState"],
                        "lane": item["curationLane"],
                        "program": item["normalizedKey"],
                        "count": item["count"],
                    }
                    for item in queue["items"][:10]
                ],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Validate T2DA post-Aleph institutional corroboration without over-promoting bibliography citations."""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
import urllib.parse
from pathlib import Path
from typing import Any

SCHEMA = "thesis-mef-post-aleph-corroboration-t2da-v1"
PROGRAM_REF = "program:udg:mae-estudios-filosoficos"
FORBIDDEN_URL = re.compile(r"(?i)(?:file:|sandbox:|/bitstream/|/download(?:/|$)|\.pdf(?:$|[?#]))")


def norm(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text.casefold())
    return " ".join(text.split())


def public_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or FORBIDDEN_URL.search(url):
        raise ValueError("T2DA evidence must be a public reference page, not local/full-text/download material")


def walk_urls(value: Any) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in {"url", "handle", "bibliographyEvidenceUrl"} and child:
                public_url(str(child))
            walk_urls(child)
    elif isinstance(value, list):
        for child in value:
            walk_urls(child)


def validate(data: dict[str, Any], t2cy: dict[str, Any], t2cz: dict[str, Any]) -> dict[str, Any]:
    if data.get("schemaVersion") != SCHEMA:
        raise ValueError("Unsupported T2DA schema")
    if data.get("programRef") != PROGRAM_REF:
        raise ValueError("Wrong programme authority")

    required_policy = {
        "referenceOnly": True,
        "publicProjectionRequested": False,
        "canonicalAdmissionMutation": False,
        "programAuthorityMutation": False,
        "automaticIdentityMerge": False,
        "institutionalBibliographyCitationDoesNotEqualWorkLevelRecord": True,
        "masterThesisCitationDoesNotDetermineProgram": True,
        "sourceContainerHandleCannotBecomeThesisIdentifier": True,
        "derivedPublicationDoesNotEqualThesis": True,
        "inCourseThesisExcludedFromCompletedCounts": True,
        "isbnDiscrepancyMustBePreserved": True,
    }
    if data.get("policy") != required_policy:
        raise ValueError("Unsafe or incomplete T2DA policy")

    walk_urls(data)

    source = data.get("sourceObject") or {}
    container = source.get("institutionalContainer") or {}
    if container.get("role") != "institutional-container-only" or container.get("type") != "Libro":
        raise ValueError("RIUdeG handle must remain a book-container identity")
    if container.get("filesAssociated") is not False:
        raise ValueError("T2DA source object must preserve the no-files RIUdeG observation")
    text_witness = source.get("publicTextWitness") or {}
    if text_witness.get("role") != "public-text-witness-not-institutional":
        raise ValueError("Public text witness must never be labeled institutional")

    isbn = source.get("isbnDiscrepancy") or {}
    if isbn.get("present") is not True:
        raise ValueError("ISBN discrepancy must be preserved")
    if isbn.get("adjudication") != "preserve-source-values-no-silent-correction":
        raise ValueError("ISBN discrepancy cannot be silently corrected")
    if isbn.get("riudgValue") == isbn.get("officialEditorialValue"):
        raise ValueError("Observed RIUdeG/editorial ISBN discrepancy disappeared")
    if isbn.get("officialEditorialValue") != isbn.get("isbnAuthorityValue"):
        raise ValueError("Official editorial and ISBN authority values should remain explicitly aligned")

    t2cy_rows = {
        norm(row.get("sourceAuthor")): row
        for row in (t2cy.get("records") or [])
        if norm(row.get("sourceAuthor"))
    }
    if len(t2cy_rows) != 11:
        raise ValueError("T2DA expects frozen T2CY 11-record input")
    if (t2cz.get("metrics") or {}).get("institutionalWorkIdentitiesConfirmed") != 0:
        raise ValueError("T2DA baseline assumes T2CZ confirmed zero institutional work identities")

    overlaps = data.get("t2cyCorroborations") or []
    exact_matches = 0
    title_variants = 0
    authority_resolved = 0
    overlap_names: set[str] = set()
    for row in overlaps:
        key = norm(row.get("sourceAuthor"))
        if key not in t2cy_rows or key in overlap_names:
            raise ValueError("T2DA T2CY corroboration missing from source ledger or duplicated")
        overlap_names.add(key)
        source_row = t2cy_rows[key]
        if row.get("mefProgramConfirmedByT2CY") is not True:
            raise ValueError("T2CY overlaps must retain explicit MEF programme evidence from T2CY")
        if row.get("bibliographyCitationType") != "Tesis de maestría":
            raise ValueError("Institutional bibliography overlap must be explicitly cited as a master thesis")
        if row.get("bibliographyInstitution") != "Universidad de Guadalajara":
            raise ValueError("Institutional bibliography overlap must cite Universidad de Guadalajara")
        if row.get("institutionalBibliographyCorroborated") is not True:
            raise ValueError("Overlap must retain bibliography corroboration")
        if row.get("institutionalWorkIdentityConfirmed") is not False:
            raise ValueError("Bibliography citation cannot become a work-level institutional record")
        if row.get("thesisSpecificHandle") is not None or row.get("alephSystemNumber") is not None:
            raise ValueError("T2DA cannot invent thesis-specific institutional identifiers")
        if row.get("physicalHoldingConfirmed") is not False:
            raise ValueError("T2DA cannot infer physical holdings")
        variant = row.get("titleVariantReview")
        if variant is True:
            title_variants += 1
            if norm(row.get("t2cyTitle")) == norm(row.get("bibliographyTitle")):
                raise ValueError("Title-variant review requires distinct source forms")
        elif variant is False:
            exact_matches += 1
            if norm(row.get("t2cyTitle")) != norm(row.get("bibliographyTitle")):
                raise ValueError("Non-variant bibliography title must match T2CY after normalization")
        else:
            raise ValueError("titleVariantReview must be boolean")

        if row.get("authorAuthorityResolved"):
            authority_resolved += 1
            if row.get("sourceAuthor") != "Rómulo Daza y García":
                raise ValueError("Only the explicitly adjudicated Rómulo authority may be resolved in T2DA")
            evidence = row.get("authorAuthorityEvidence") or []
            if not any(item.get("kind") == "official-udg-authority-profile" for item in evidence):
                raise ValueError("Resolved author authority requires official UdeG authority evidence")
            if row.get("resolvedCanonicalName") != "Rómulo Ramírez Daza y García":
                raise ValueError("Unexpected Rómulo canonical authority")

    discovered = data.get("discoveredMasterThesisCitations") or []
    new_names: set[str] = set()
    program_counts = {
        "institutional": 0,
        "noninstitutional": 0,
        "outside": 0,
        "unresolved": 0,
    }
    for row in discovered:
        key = norm(row.get("author"))
        if not key or key in new_names or key in t2cy_rows:
            raise ValueError("New master-thesis discovery must be unique and outside T2CY")
        new_names.add(key)
        if row.get("overlapsT2CY") is not False:
            raise ValueError("New master-thesis discovery cannot claim T2CY overlap")
        if row.get("citationType") != "Tesis de maestría" or row.get("institution") != "Universidad de Guadalajara":
            raise ValueError("New discovery must be an explicit UdeG master-thesis citation")
        if row.get("institutionalWorkIdentityConfirmed") is not False:
            raise ValueError("Bibliography citation is not a thesis-specific institutional work identity")

        adjudication = row.get("programAdjudication")
        institutional = row.get("mefProgramInstitutionallyConfirmed")
        candidate = row.get("mefProgramCandidate")
        decision = row.get("decision")
        if adjudication == "mef-institutionally-corroborated":
            program_counts["institutional"] += 1
            if institutional is not True or candidate is not True or decision != "new-mef-thesis-cross-source-corroborated":
                raise ValueError("Institutional MEF corroboration flags are inconsistent")
            if not any(str(item.get("kind") or "").startswith("official-udg-") for item in row.get("programEvidence") or []):
                raise ValueError("Institutional MEF corroboration requires official UdeG programme evidence")
        elif adjudication == "mef-author-controlled-corroboration":
            program_counts["noninstitutional"] += 1
            if institutional is not False or candidate is not True:
                raise ValueError("Author-controlled MEF claim cannot be institutionalized")
        elif adjudication == "outside-mef-confirmed":
            program_counts["outside"] += 1
            if institutional is not False or candidate is not False or decision != "exclude-from-mef-program":
                raise ValueError("Outside-MEF adjudication cannot remain an MEF candidate")
        elif adjudication == "program-unresolved":
            program_counts["unresolved"] += 1
            if institutional is not False or candidate is not False:
                raise ValueError("Unresolved programme cannot be counted as MEF")
        else:
            raise ValueError(f"Unsupported program adjudication: {adjudication}")

    excluded = data.get("excludedInCourse") or []
    for row in excluded:
        if norm(row.get("statusInSource")) != "en curso" or row.get("decision") != "exclude-not-completed":
            raise ValueError("Only explicitly in-course theses may enter the T2DA incomplete exclusion list")

    external = data.get("externalInstitutionalWorkCorroborations") or []
    for row in external:
        if norm(row.get("t2cySourceAuthor")) not in t2cy_rows:
            raise ValueError("External institutional work corroboration must map to T2CY")
        if row.get("decision") != "external-institutional-degree-work-corroborated":
            raise ValueError("Unsupported external corroboration decision")
        if row.get("institutionalWorkIdentityConfirmed") is not False:
            raise ValueError("External academic profile does not create a UdeG work-level identifier")
        if row.get("spellingVariantReview") is not True:
            raise ValueError("Marcela source spelling difference must be preserved")

    coverage = data.get("coverage") or {}
    expected = {
        "t2cyInputRecords": 11,
        "t2czInstitutionalWorkIdentitiesConfirmed": 0,
        "t2cyInstitutionalBibliographyOverlaps": len(overlaps),
        "t2cyExactBibliographyTitleMatches": exact_matches,
        "t2cyTitleVariantReviews": title_variants,
        "authorAuthoritiesResolved": authority_resolved,
        "discoveredCompletedMasterThesisCitations": len(discovered),
        "newMefCandidatesInstitutionalProgramConfirmed": program_counts["institutional"],
        "newMefCandidatesNoninstitutionalProgramCorroboration": program_counts["noninstitutional"],
        "newOutsideMefConfirmed": program_counts["outside"],
        "newProgramUnresolved": program_counts["unresolved"],
        "inCourseMasterThesesExcluded": len(excluded),
        "externalInstitutionalDegreeWorkCorroborations": len(external),
        "thesisSpecificInstitutionalIdentifiersAdded": 0,
        "institutionalWorkIdentitiesConfirmed": 0,
        "physicalHoldingsConfirmed": 0,
        "publicRecordsAdded": 0,
    }
    if coverage != expected:
        raise ValueError(f"Coverage mismatch: expected {expected}, got {coverage}")

    return {
        "sourceHandle": container.get("handle"),
        "isbnDiscrepancyPreserved": True,
        **expected,
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--t2cy", required=True, type=Path)
    p.add_argument("--t2cz", required=True, type=Path)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    t2cy = json.loads(args.t2cy.read_text(encoding="utf-8"))
    t2cz = json.loads(args.t2cz.read_text(encoding="utf-8"))
    print(json.dumps(validate(data, t2cy, t2cz), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

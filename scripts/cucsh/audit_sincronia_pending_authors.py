#!/usr/bin/env python3
"""Offline, evidence-preserving review queue for missing Sincronía authors.

This audit never changes articles or guesses missing authors. A failed or
unverified original URL must never be interpreted as a usable access link.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path



def classify_work_identity_review(row):
    """Flag suspicious historical index labels without treating them as facts.

    A potential author label is NOT sufficient bibliographic evidence to
    overwrite a title or assign an author. All flags require manual review.
    """
    title = str(row.get("title") or "").strip()
    issue = row.get("issueNumber")
    url = str((row.get("urls") or {}).get("canonical") or "").lower()
    basename = url.rsplit("/", 1)[-1].split("?", 1)[0]

    if not re.search(r"\w", title, flags=re.UNICODE):
        return "malformed_or_punctuation_only_title"
    if issue == 46 and (
        (basename == "creditos.html" and title == "Editorial Board/Consejo Editorial")
        or (basename == "info.htm" and title == "Further information for contributors.")
    ):
        return "possible_editorial_navigation_not_article"
    if issue == 8 and basename == "bio.html" and title == "Dante Medina":
        return "possible_biography_not_article"
    if issue == 7:
        if title.casefold() == "introducción":
            return "generic_index_heading_needs_source"
        if basename in {
            "bedregal.htm", "revilla.htm", "velia.htm", "saavedra.htm",
            "quiroga.htm", "selum.htm",
        }:
            return "person_name_entry_needs_article_identity"
    if issue in {12, 13, 14, 15, 16, 18, 46, 50}:
        # Early indexes often used surname, given-name where the article
        # title should be. Require a short phrase and no colon or semicolon.
        # A 2008 multi-author label is also a possible index transposition.
        looks_like_name_label = (
            len(title) <= 90
            and bool(re.fullmatch(r"[^,:;]{2,45},\s*[^:;]{2,100}", title))
        )
        multi_name_label = (
            issue == 46 and ";" in title and title.count(",") >= 2
        )
        if looks_like_name_label or multi_name_label:
            return "possible_author_name_transcribed_as_title"
    return None


def exact_editorial_navigation_records(records):
    """Classify only two unmistakable non-article legacy navigation pages.

    Never remove them from the source archive or assume any similarly
    named work in another issue is a navigational page. Status remains
    provisional metadata until historical content is independently checked.
    """
    candidates = {
        "cucsh:sincronia-legacy:91f36da6674c93b19145": (
            "Editorial Board/Consejo Editorial", "creditos.html",
            "editorial_board_navigation",
        ),
        "cucsh:sincronia-legacy:a2763a903fcca568e32a": (
            "Further information for contributors.", "info.htm",
            "contributor_instructions_navigation",
        ),
    }
    result = []
    for record in records:
        match = candidates.get(record.get("id"))
        if not match or record.get("journal") != "Sincronía":
            continue
        title, filename, kind = match
        url = (record.get("urls") or {}).get("canonical") or ""
        if (record.get("issueNumber") != 46
                or record.get("year") != 2008
                or record.get("title") != title
                or not url.lower().endswith("/" + filename)):
            continue
        result.append({
            "id": record["id"],
            "issueNumber": record["issueNumber"],
            "originalTitle": title,
            "originalUrl": url,
            "classification": kind,
            "status": "high_confidence_non_article_navigation",
            "accessStatus": (record.get("legacyAccessStatus") or {}).get("status"),
            "preservationPolicy": (
                "Retain historical record, original URL, availability and "
                "index label. Do not treat as an academic article or invent "
                "an author; any public UI filtering requires a separate review."
            ),
        })
    return sorted(result, key=lambda row: row["id"])


def exact_biographical_non_article_records(records):
    """Recognize only the directly archived Dante Medina biography, no guessed roles.

    The 1998 Wayback page at the exact indexed URL describes his birthplace,
    education and bibliography and links to the separate ana.html hypertext;
    it is not a new peer-reviewed research article needing an author byline.
    Source records, URLs and access status are never modified here.
    """
    target = "cucsh:sincronia-legacy:a9b2551729fe0893d5e3"
    original = "http://fuentes.csh.udg.mx/CUCSH/Sincronia/dante/bio.html"
    archival_evidence = (
        "https://web.archive.org/web/19980211205946/"
        "http://fuentes.csh.udg.mx:80/CUCSH/Sincronia/dante/bio.html"
    )
    result = []
    for row in records:
        if not (
            row.get("id") == target
            and row.get("journal") == "Sincronía"
            and row.get("issueNumber") == 8
            and row.get("year") == 1998
            and row.get("title") == "Dante Medina"
            and (row.get("urls") or {}).get("canonical") == original
            and not row.get("authors")
            and (row.get("legacyAccessStatus") or {}).get("status")
            == "original-page-unavailable"
        ):
            continue
        result.append({
            "id": target,
            "issueNumber": 8,
            "originalTitle": row["title"],
            "originalUrl": original,
            "classification": "author_biographical_profile_not_scholarly_work",
            "status": "directly_verified_original_archived_biography",
            "sourceCapture": archival_evidence,
            "originalAvailabilityPreserved": True,
            "preservationPolicy": (
                "Retain the original biography record, URL and authorless "
                "state; do not assign Dante Medina as author of his own "
                "biography without a source byline, and do not count this "
                "profile as an uncredited research article."
            ),
        })
    return result


def exact_campos_identity_conflicts(pending):
    """Expose the 2000-vs-2001 /campos.htm identity problem without attribution."""
    original = "http://sincronia.cucsh.udg.mx/campos.htm"
    target = "cucsh:sincronia-legacy:d578e8ef399dde877feb"
    result = []
    for row in pending:
        if not (
            row.get("id") == target
            and row.get("journal") == "Sincronía"
            and row.get("issueNumber") == 15
            and row.get("year") == 2000
            and row.get("title") == "de Campos,Jorge Lucio"
            and (row.get("urls") or {}).get("canonical") == original
            and not row.get("authors")
        ):
            continue
        result.append({
            "id": target,
            "indexedTitle": row["title"],
            "indexedIssue": 15,
            "indexedYear": 2000,
            "originalUrl": original,
            "professionalBibliographyUrl": (
                "https://www.escavador.com/sobre/764869/jorge-lucio-de-campos"
            ),
            "bibliographyConfirmsOtherSincronia2000Works": True,
            "separateDeleuzeEssayLaterCitation": {
                "bibliographyDocument": (
                    "https://tede2.pucsp.br/bitstream/handle/7665/1/"
                    "Ana%20Maria%20Moliterno%20Pena.pdf"
                ),
                "documentYear": 2007,
                "citedWork": (
                    "Deleuze e o Impulso Alegórico: "
                    "A Arte como o 'Outro' da Filosofia"
                ),
                "citedHistoricalUrl": (
                    "http://sincronia.cucsh.udg.mx/campos2.htm"
                ),
                "status": "independent_later_citation_not_original_2000_identity",
                "caution": (
                    "A 2007 master's bibliography cites a distinct Campos "
                    "essay at /campos2.htm. It does not identify the 2000 "
                    "/campos.htm entry or establish which publication "
                    "occupied either URL in 2000. Preserve the open case."
                ),
            },
            "laterArchivedSameUrl": (
                "https://web.archive.org/web/20020607092529/"
                "http://sincronia.cucsh.udg.mx:80/campos.htm"
            ),
            "laterPageInternalIssueYear": 2001,
            "laterPageTitle": "UMA SITUAÇÃO DE PALAVRAS",
            "laterPageSubtitle": "Entrevista a Floriano Martins",
            "status": "original_2000_work_identity_unverified",
            "requiredEvidence": (
                "The later reuse of /campos.htm shows a 2001 interview, "
                "while the frozen source record points to issue 15 (2000). "
                "A professional bibliography confirms several distinct "
                "Jorge Lúcio de Campos works in Sincronía in 2000. "
                "Do not equate them, silently move the issue/year, or "
                "assign interviewer/interviewee roles without a matched "
                "original 2000 publication or issue-level citation."
            ),
        })
    return result


def unresolved_issue50_work_identity(records):
    """Surface ambiguity without conflating two works by one author."""
    target = "cucsh:sincronia-legacy:8eded0eac6e2a217ade1"
    sin50 = [
        row for row in records
        if row.get("journal") == "Sincronía" and row.get("issueNumber") == 50
    ]
    snapshot = [{
        "id": row.get("id"),
        "indexedTitle": row.get("title"),
        "indexedAuthors": [
            a.get("name") for a in (row.get("authors") or [])
            if isinstance(a, dict)
        ],
        "originalUrl": (row.get("urls") or {}).get("canonical"),
    } for row in sin50]
    candidates = []
    for row in sin50:
        url = (row.get("urls") or {}).get("canonical") or ""
        if (
            row.get("id") == target
            and row.get("year") == 2009
            and row.get("title") == "Korstanje, Maximiliano E."
            and not row.get("authors")
            and url.lower().endswith("/korstanjespring09.htm")
        ):
            candidates.append({
                "id": target,
                "indexLabel": row["title"],
                "originalUrl": url,
                "sourceIssueUrl": "https://dialnet.unirioja.es/ejemplar/251077",
                "possibleWorks": [
                    {
                        "title": ("Las fobias, Compilador Jorge Saurí. "
                                  "Buenos Aires, Ediciones Nueva Visión. "
                                  "(1986). ISBN 950-602-058-2: Una reseña"),
                        "bibliographyUrl": (
                            "https://dialnet.unirioja.es/servlet/articulo?codigo=3296660"
                        ),
                        "kind": "bibliographic_review",
                    },
                    {
                        "title": "La delincuencia hoy: el doble valor de la represión",
                        "bibliographyUrl": (
                            "https://dialnet.unirioja.es/servlet/articulo?codigo=3296668"
                        ),
                        "kind": "article",
                    },
                ],
                "status": "unresolved_original_url_to_article_mapping",
                "requiredEvidence": (
                    "An original issue-50 table-of-contents link, web archive "
                    "capture of korstanjespring09.htm or independent citation "
                    "explicitly joining that exact URL to one title. "
                    "A shared author and issue alone cannot decide which."
                ),
            })
    return {"issue50WorkSnapshot": snapshot,
            "unresolvedIssue50UrlMappings": candidates}


def documented_bibliographic_conflicts(pending):
    """Report independently documented provenance conflicts; NEVER patch data.

    The source and catalogue agree on an original article filename, but
    disagree on its issue and year. This is a research lead, not permission
    to replace the journal's original index entry.
    """
    results = []
    for row in pending:
        original_url = (row.get("urls") or {}).get("canonical") or ""
        if not (
            row.get("id") == "cucsh:sincronia-legacy:53c3bea7bff8e9572369"
            and row.get("title") == "Reyes, Giovanni E."
            and row.get("issueNumber") == 12
            and row.get("year") == 1999
            and original_url.endswith("/reyes4.htm")
        ):
            continue
        results.append({
            "id": row["id"],
            "originalUrlAsIndexed": original_url,
            "indexedIssue": row["issueNumber"],
            "indexedYear": row["year"],
            "indexedTitle": row["title"],
            "alternativeWorkTitle": (
                "Four main theories of development: modernization, "
                "dependency, world-systems, and globalization"
            ),
            "alternativeAuthors": ["Giovanni Efraín Reyes Ortíz"],
            "externalCitedIssue": 21,
            "externalCitedYear": 2001,
            "externalBibliographyUrl": (
                "https://repository.urosario.edu.co/handle/10336/27750"
            ),
            "externalRecordDetailsUrl": (
                "https://redcol.minciencias.gov.co/Record/"
                "EDOCUR2_d1b56980606f7282399f02fe43ee1f1c/Details"
            ),
            "status": "unresolved_issue_and_year_conflict",
            "requiredAction": (
                "Review an original issue-level table of contents or a "
                "preserved original article before modifying issue, year, "
                "title or authors. The institutional record is evidence, "
                "not an automatic override of the archived journal index."
            ),
        })
    return results


def audit_pending_authors(records):
    sincronia = [row for row in records if row.get("journal") == "Sincronía"]
    pending = [row for row in sincronia if not row.get("authors")]
    by_source = Counter()
    by_issue = Counter()
    by_availability = Counter()
    queue = []
    identity_queue = []
    identity_flags = Counter()

    for row in pending:
        source = row.get("legacyMetadataSource") or "original"
        availability = (row.get("legacyAccessStatus") or {}).get("status") or "not_verified"
        issue = row.get("issueNumber")
        by_source[source] += 1
        by_issue[str(issue) if issue is not None else "unknown"] += 1
        by_availability[availability] += 1

        urls = row.get("urls") or {}
        evidence_urls = []
        for field in (
            "legacyAuthorEvidence",
            "legacyTitleEncodingEvidence",
            "legacyCompletenessEvidence",
        ):
            evidence = row.get(field) or {}
            if isinstance(evidence, dict):
                for key in ("sourceUrl", "sourceArticleUrl", "sourceIssueUrl"):
                    url = evidence.get(key)
                    if isinstance(url, str) and url.startswith(("https://", "http://")):
                        if url not in evidence_urls:
                            evidence_urls.append(url)
        for key in ("reference",):
            url = urls.get(key)
            if isinstance(url, str) and url.startswith(("https://", "http://")):
                if url not in evidence_urls:
                    evidence_urls.append(url)

        # Evidence URLs are references for manual verification, not certified
        # working full-text links. Never upgrade source availability by inference.
        priority = (
            "inspect_bibliographic_evidence"
            if evidence_urls else
            "seek_independent_bibliography"
        )
        identity_reason = classify_work_identity_review(row)
        if identity_reason:
            identity_flags[identity_reason] += 1
            identity_queue.append({
                "id": row.get("id"),
                "issueNumber": issue,
                "titleAsIndexed": row.get("title"),
                "originalUrl": urls.get("canonical"),
                "sourceAvailability": availability,
                "reviewReason": identity_reason,
                "recommendation": (
                    "Find independent article-level table of contents or "
                    "bibliographic citation before changing title, authorship "
                    "or record type. Preserve this original index entry."
                ),
            })
        queue.append({
            "id": row.get("id"),
            "issueNumber": issue,
            "year": row.get("year"),
            "title": row.get("title"),
            "metadataSource": source,
            "sourceAvailability": availability,
            "originalUrl": urls.get("canonical"),
            "evidenceUrlsForManualReview": evidence_urls,
            "reviewPriority": priority,
            "possibleWorkIdentityIssue": identity_reason,
        })

    queue.sort(key=lambda item: (
        item["reviewPriority"] != "inspect_bibliographic_evidence",
        item["issueNumber"] if isinstance(item["issueNumber"], int) else 999,
        str(item["id"] or ""),
    ))
    conflicts = documented_bibliographic_conflicts(pending)
    editorial_navigation = exact_editorial_navigation_records(sincronia)
    biographical_non_articles = exact_biographical_non_article_records(sincronia)
    non_article_ids = {r["id"] for r in editorial_navigation + biographical_non_articles}
    pending_non_article_count = sum(r.get("id") in non_article_ids for r in pending)
    campos_conflicts = exact_campos_identity_conflicts(pending)
    issue50_review = unresolved_issue50_work_identity(sincronia)
    title_encoding_remaining = sum(
        "\ufffd" in str(row.get("title") or "") for row in sincronia
    )
    return {
        "scope": "All available Sincronía issues",
        "status": "manual_evidence_review_required" if pending else "complete",
        "totalSincroniaRecords": len(sincronia),
        "highConfidenceEditorialNavigationCount": len(editorial_navigation),
        "highConfidenceEditorialNavigationRecords": editorial_navigation,
        "highConfidenceBiographicalNonArticleCount": len(biographical_non_articles),
        "highConfidenceBiographicalNonArticleRecords": biographical_non_articles,
        "highConfidenceNonArticleCount": len(non_article_ids),
        "highConfidenceNonArticleRecords": (
            editorial_navigation + biographical_non_articles
        ),
        "pendingNonArticleRecordsNoBylineRequired": pending_non_article_count,
        "pendingAuthorshipCasesExcludingVerifiedNonArticles": (
            len(pending) - pending_non_article_count
        ),
        "unresolvedOriginalWorkIdentityConflicts": campos_conflicts,
        "unresolvedOriginalWorkIdentityConflictCount": len(campos_conflicts),
        "articleCandidatesExcludingEditorialNavigation": (
            len(sincronia) - len(editorial_navigation)
        ),
        "authorlessArticleCandidatesExcludingEditorialNavigation": (
            len(pending) - sum(
                any(r["id"] == row.get("id") for r in editorial_navigation)
                for row in pending
            )
        ),
        "issue50WorkSnapshot": issue50_review["issue50WorkSnapshot"],
        "unresolvedIssue50UrlMappings": (
            issue50_review["unresolvedIssue50UrlMappings"]
        ),
        "pendingAuthorRecords": len(pending),
        "titlesWithUnicodeReplacementCharacter": title_encoding_remaining,
        "pendingBySource": dict(sorted(by_source.items())),
        "pendingByIssue": dict(sorted(by_issue.items(), key=lambda x: (
            int(x[0]) if x[0].isdigit() else 999
        ))),
        "pendingByOriginalAvailability": dict(sorted(by_availability.items())),
        "records": queue,
        "bibliographicConflictCount": len(conflicts),
        "bibliographicConflicts": conflicts,
        "suspectedWorkIdentityRecords": sorted(
            identity_queue,
            key=lambda item: (
                item["issueNumber"] if isinstance(item["issueNumber"], int) else 999,
                item["id"] or "",
            ),
        ),
        "suspectedWorkIdentityByType": dict(sorted(identity_flags.items())),
        "suspectedWorkIdentityCount": len(identity_queue),
        "policy": (
            "Never guess an author, delete an incomplete article, or treat "
            "an unavailable historical page as an accessible full text. "
            "Reference URLs are evidence to review, not verified live links."
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    report = audit_pending_authors(data["records"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        "SINCRONIA_PENDING_AUTHOR_AUDIT",
        f"total={report['totalSincroniaRecords']}",
        f"pending={report['pendingAuthorRecords']}",
        f"damaged_titles={report['titlesWithUnicodeReplacementCharacter']}",
        f"evidence_first={sum(x['reviewPriority'] == 'inspect_bibliographic_evidence' for x in report['records'])}",
    )
    print("PENDING_BY_SOURCE", report["pendingBySource"])
    print("SUSPECTED_WORK_IDENTITY", report["suspectedWorkIdentityCount"])
    print("IDENTITY_REVIEW_BY_TYPE", report["suspectedWorkIdentityByType"])
    print("PENDING_BY_ORIGINAL_AVAILABILITY", report["pendingByOriginalAvailability"])
    print("BIBLIOGRAPHIC_CONFLICTS", report["bibliographicConflictCount"])
    print("HIGH_CONFIDENCE_EDITORIAL_NAVIGATION", report["highConfidenceEditorialNavigationCount"])
    print("HIGH_CONFIDENCE_BIOGRAPHY_NON_ARTICLE", report["highConfidenceBiographicalNonArticleCount"])
    print("AUTHORS_ACTUALLY_REQUIRING_EVIDENCE", report["pendingAuthorshipCasesExcludingVerifiedNonArticles"])
    print("UNRESOLVED_ORIGINAL_WORK_IDENTITIES", report["unresolvedOriginalWorkIdentityConflictCount"])
    print("SINCRONIA_ARTICLE_CANDIDATES_EXCLUDING_NAVIGATION", report["articleCandidatesExcludingEditorialNavigation"])
    print("PENDING_AUTHOR_ARTICLE_CANDIDATES", report["authorlessArticleCandidatesExcludingEditorialNavigation"])
    print("UNRESOLVED_ISSUE_50_MAPPINGS", len(report["unresolvedIssue50UrlMappings"]))


if __name__ == "__main__":
    main()

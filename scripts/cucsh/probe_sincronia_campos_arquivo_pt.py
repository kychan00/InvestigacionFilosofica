#!/usr/bin/env python3
"""Read-only independent archival research of the unresolved 2000 Campos record.

Arquivo.pt is a second archive, not a source-of-truth for article identity.
No external result may modify journal records or transfer a title between URLs.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

CDX = "https://arquivo.pt/wayback/cdx"
SEARCH = "https://arquivo.pt/textsearch"
CANDIDATE_URLS = (
    "http://sincronia.cucsh.udg.mx/campos.htm",
    "http://sincronia.cucsh.udg.mx/campos2.htm",
    "http://fuentes.csh.udg.mx/CUCSH/Sincronia/campos.htm",
    "http://fuentes.csh.udg.mx/CUCSH/Sincronia/campos2.htm",
)
QUERIES = (
    '"Deleuze e o impulso alegórico"',
    '"A educação e o fascínio tecnológico"',
    '"Jorge Lucio de Campos" Sincronía',
)

def get_text(url, timeout=10):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; HistoricalBibliographyAudit/1.0)", "Accept": "application/json"})
    with urlopen(request, timeout=timeout) as response:
        return response.read(500000).decode("utf-8", errors="replace")

def parse_cdx_json_lines(text):
    """Arquivo.pt returns newline-delimited JSON, unlike Wayback's array."""
    captures = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        value = json.loads(line)
        if isinstance(value, list):
            captures.extend(v for v in value if isinstance(v, dict))
        elif isinstance(value, dict):
            captures.append(value)
    return captures

def safe_capture(row):
    """Only preserve provenance, not arbitrary copied page text."""
    if not isinstance(row, dict):
        return None
    timestamp = str(row.get("timestamp") or row.get("captureDate") or "")
    original = str(row.get("original") or row.get("url") or "")
    return {"timestamp": timestamp[:14], "url": original[:300],
            "status": str(row.get("status") or row.get("statuscode") or "")[:20],
            "digest": str(row.get("digest") or "")[:120]}

def extract_search_results(text):
    obj = json.loads(text)
    rows = obj.get("responseItems") or obj.get("results") or []
    if not isinstance(rows, list):
        return []
    return [{"title": str(x.get("title") or "")[:260],
             "originalUrl": str(x.get("originalURL") or x.get("originalUrl") or "")[:350],
             "archiveUrl": str(x.get("linkToArchive") or "")[:350],
             "captureTimestamp": str(x.get("tstamp") or x.get("timestamp") or "")[:35]}
            for x in rows[:15] if isinstance(x, dict)]

def probe(endpoint, params, *, fetcher=get_text, parser=None):
    url = endpoint + "?" + urlencode(params)
    try:
        body = fetcher(url)
        entries = parser(body) if parser else json.loads(body)
        return {"requestUrl": url, "status": "query_completed", "results": entries}
    except (Exception) as exc:
        # A network/archive failure is not negative evidence about publication.
        return {"requestUrl": url, "status": "archive_access_failed",
                "errorType": type(exc).__name__, "results": []}

def report(*, fetcher=get_text):
    url_results = []
    for url in CANDIDATE_URLS:
        cdx = probe(CDX, {"url": url, "output": "json", "from": "1999", "to": "2010", "limit": 50},
                    fetcher=fetcher, parser=parse_cdx_json_lines)
        cdx["results"] = [c for c in (safe_capture(x) for x in cdx["results"][:40]) if c]
        history = probe(SEARCH, {"versionHistory": url, "from": "1999", "to": "2010",
                                 "maxItems": 20}, fetcher=fetcher, parser=extract_search_results)
        url_results.append({"originalUrl": url, "cdx": cdx, "versionHistory": history})
    text_results = []
    for q in QUERIES:
        item = probe(SEARCH, {"q": q, "maxItems": 15, "from": "1999", "to": "2010"},
                     fetcher=fetcher, parser=extract_search_results)
        text_results.append({"query": q, **item})
    return {
        "purpose": "Independent Portuguese web archive for year-2000 Sincronía Jorge Lucio de Campos",
        "archive": "Arquivo.pt (https://arquivo.pt)",
        "canonicalUnresolvedUrl": CANDIDATE_URLS[0],
        "knownOriginalIssue": 15,
        "knownOriginalYear": 2000,
        "knownIssueSeason": "Summer, June-September 2000",
        "originalWorkIdentityVerified": False,
        "authorAssignments": 0,
        "corpusModified": False,
        "identityGuard": ("Archive snapshots of a reused path after 2000, citations of "
                          "/campos2.htm, a matching filename at a different host, and "
                          "search hits without source chronology never establish which "
                          "publication occupied the 2000 /campos.htm original."),
        "urlChecks": url_results, "fullTextChecks": text_results,
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    out = report()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for r in out["urlChecks"]:
        print("ARQUIVO_URL", r["originalUrl"],
              "cdx=", r["cdx"]["status"], "captures=", len(r["cdx"]["results"]),
              "versions=", len(r["versionHistory"]["results"]))
        for c in r["cdx"]["results"][:8]:
            print("ARQUIVO_CAPTURE", c["timestamp"], c["url"], c["status"])
    for r in out["fullTextChecks"]:
        print("ARQUIVO_SEARCH", r["query"], r["status"], len(r["results"]))
        for c in r["results"][:4]:
            print("ARQUIVO_HIT", c["title"], c["originalUrl"], c["captureTimestamp"])
    print("ARQUIVO_AUDIT_NO_ATTRIBUTION", out["authorAssignments"], out["corpusModified"])

if __name__ == "__main__":
    main()

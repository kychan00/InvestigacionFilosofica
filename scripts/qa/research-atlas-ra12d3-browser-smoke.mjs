import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();

  await page.goto(
    "http://127.0.0.1:4173/",
    {
      waitUntil: "domcontentloaded",
      timeout: 30000
    }
  );

  const report = await page.evaluate(async () => {
    const [
      { ResearchAtlasLiveSession },
      { buildResearchAtlasViewModel }
    ] = await Promise.all([
      import("/src/core/research-atlas-live.js"),
      import("/src/core/research-atlas-view.js")
    ]);

    const result = ({
      id,
      title,
      doi = null,
      provider
    }) => ({
      id,
      title,
      abstract:
        "Freedom autonomy moral law rational agency practical reason.",
      authors: [],
      year: 2020,
      type: "article",
      language: "en",
      doi,
      isbn: [],
      topics: [],
      providers: [provider],
      sourceRecords: [{
        provider,
        sourceId: id,
        query: "freedom autonomy"
      }],
      matchedQueries: [{
        query: "freedom autonomy",
        weight: 1,
        type: "original"
      }],
      urls: {},
      institutionalLinks: []
    });

    const results = [
      result({
        id: "openalex-W4388864320",
        title: "Freedom autonomy moral law",
        provider: "OpenAlex Philosophy"
      }),
      result({
        id: "crossref-10.12795/ambitos.2019.i43.10",
        title: "Freedom autonomy and practical reason",
        doi: "10.12795/ambitos.2019.i43.10",
        provider: "Crossref"
      }),
      result({
        id: "ia-fixture-no-vector",
        title: "Moral freedom and autonomy",
        provider: "Internet Archive"
      })
    ];

    const response = {
      query: "freedom autonomy",
      parsed: {},
      expansions: [],
      results,
      errors: [],
      stats: {
        appearances: results.length,
        unique: results.length,
        merged: 0,
        providers: {
          "OpenAlex Philosophy": 1,
          Crossref: 1,
          "Internet Archive": 1
        }
      }
    };

    const session =
      new ResearchAtlasLiveSession({
        philosophyMap: {
          philosophers: [],
          concepts: [],
          works: [],
          areas: []
        },
        enableQwenTopology: true,
        searchPhilosophyImpl:
          async () => structuredClone(response),
        enrichAuthorsImpl:
          async value => value
      });

    const event =
      await session.runFederated(
        "freedom autonomy"
      );

    const semantic =
      event.snapshot.edges.filter(
        edge =>
          edge.type ===
            "semantic-neighbor"
      );

    const lexical =
      event.snapshot.edges.filter(
        edge =>
          edge.type ===
            "lexical-neighbor"
      );

    if (semantic.length !== 1) {
      throw new Error(
        "expected-one-live-semantic-edge"
      );
    }

    if (!lexical.length) {
      throw new Error(
        "expected-ra11-fallback-edge"
      );
    }

    const view =
      buildResearchAtlasViewModel(
        event.snapshot,
        event.layout
      );

    const visual =
      view.edges.find(
        edge =>
          edge.type ===
            "semantic-neighbor"
      );

    if (
      visual?.visualType !==
        "semantic" ||
      !Number.isFinite(
        visual.semanticScore
      )
    ) {
      throw new Error(
        "semantic-edge-not-visible-in-view-model"
      );
    }

    const qwen =
      event.snapshot
        .diagnostics
        .qwenSemantic;

    if (
      qwen.vectorsVerified !== 2 ||
      qwen.v4Vectors !== 1 ||
      qwen.overlayVectors !== 1 ||
      qwen.unavailableWorks !== 1 ||
      qwen.semanticEdgesAdded !== 1 ||
      qwen.lexicalFallbackPairs !== 2
    ) {
      throw new Error(
        "unexpected-live-qwen-diagnostics"
      );
    }

    if (
      event.snapshot
        .session
        .sourceRevisions
        .qwenTopology !==
      "2026-11-09.ra12-d3-v1"
    ) {
      throw new Error(
        "missing-qwen-topology-revision"
      );
    }

    return {
      status: "pass",
      origin: location.origin,
      semanticEdges:
        semantic.length,
      lexicalEdges:
        lexical.length,
      semanticScore:
        visual.semanticScore,
      qwen,
      sourceRevisions:
        event.snapshot
          .session
          .sourceRevisions,
      viewSemantic: {
        visualType:
          visual.visualType,
        label:
          visual.label,
        semanticScore:
          visual.semanticScore
      },
      productionFlagExpected: true,
      rankingChanged: false,
      searchResponseChanged: false,
      liveOpenAlexQueried: false
    };
  });

  process.stdout.write(
    JSON.stringify(
      report,
      null,
      2
    ) + "\n"
  );
} finally {
  await browser.close();
}

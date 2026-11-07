import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {
  performance
} from "node:perf_hooks";

import {
  ResearchAtlasLiveSession
} from "../../src/core/research-atlas-live.js";


const CONFIG_URL =
  new URL(
    "../../benchmark/research-atlas/v8/product-gate-config.json",
    import.meta.url
  );

const OUTPUT_ROOT =
  new URL(
    "../../artifacts/research-atlas-ra8/",
    import.meta.url
  );

const config =
  JSON.parse(
    await readFile(
      CONFIG_URL,
      "utf8"
    )
  );


const philosophyMap = {
  philosophers: [],
  concepts: [],
  works: [],
  areas: []
};


const titleFamilies = [
  [
    "Freedom and autonomy in Kant",
    "Moral freedom and autonomy after Kant",
    "Autonomy and practical reason in Kantian ethics",
    "Freedom, law and self-legislation in Kant",
    "Kant on autonomy and moral obligation"
  ],
  [
    "Aura and reproducibility in Walter Benjamin",
    "Aesthetics after mechanical reproduction",
    "Benjamin on art, aura and modernity",
    "Image, memory and experience in Benjamin",
    "Aesthetic politics and technological reproduction"
  ],
  [
    "Logic and ontology in Quine",
    "Ontological commitment and logical form",
    "Quine on quantification and ontology",
    "Reference, logic and ontological commitment",
    "Naturalism, logic and ontology after Quine"
  ],
  [
    "Phenomenology of embodiment and lived experience",
    "Body, perception and phenomenological method",
    "Embodiment and subjectivity in phenomenology",
    "Perception, world and lived body",
    "Phenomenological approaches to bodily experience"
  ],
  [
    "Language, meaning and philosophical analysis",
    "Meaning, use and linguistic practice",
    "Analytic philosophy of language and reference",
    "Language games, rules and meaning",
    "Reference and meaning in contemporary philosophy"
  ]
];


function makeResult(
  index,
  query
) {
  const family =
    titleFamilies[
      index %
      titleFamilies.length
    ];

  const title =
    family[
      Math.floor(
        index /
        titleFamilies.length
      ) %
      family.length
    ] +
    (
      index >=
        titleFamilies.length *
        family.length
        ? " " +
          String(index + 1)
        : ""
    );

  const id =
    "openalex-W" +
    String(
      100000 +
      index
    );

  return {
    id,
    title,
    authors: [
      {
        name:
          "Research Author " +
          String(
            index %
              12 +
            1
          )
      }
    ],
    year:
      1980 +
      (
        index %
        45
      ),
    type:
      "article",
    language:
      index %
        4 ===
        0
        ? "es"
        : "en",
    doi:
      index %
        3 ===
        0
        ? "10.5555/ra8." +
          String(index)
        : null,
    isbn: [],
    topics: [],
    providers: [
      "OpenAlex Philosophy"
    ],
    sourceRecords: [
      {
        provider:
          "OpenAlex Philosophy",
        sourceId:
          id,
        query,
        rank:
          index +
          1
      }
    ],
    matchedQueries: [
      {
        query,
        weight:
          1,
        type:
          "original"
      }
    ],
    urls: {},
    institutionalLinks: []
  };
}


function makeResponse(
  query,
  resultCount
) {
  const results =
    Array.from(
      {
        length:
          resultCount
      },
      (
        _,
        index
      ) =>
        makeResult(
          index,
          query
        )
    );

  return {
    query,
    parsed: {},
    expansions: [
      {
        query,
        weight:
          1,
        type:
          "original"
      }
    ],
    results,
    errors: [],
    stats: {
      appearances:
        results.length,
      unique:
        results.length,
      merged:
        0,
      providers: {
        "OpenAlex Philosophy":
          results.length
      }
    },
    pagination: {
      batch:
        1
    }
  };
}


function percentile(
  values,
  fraction
) {
  const sorted =
    [...values].sort(
      (a,b) =>
        a -
        b
    );

  const index =
    Math.min(
      sorted.length -
        1,
      Math.max(
        0,
        Math.ceil(
          sorted.length *
          fraction
        ) -
        1
      )
    );

  return sorted[
    index
  ];
}


async function runCase(
  spec
) {
  const response =
    makeResponse(
      spec.query,
      spec.resultCount
    );

  const samples = [];
  let finalEvent =
    null;

  for (
    let sample = 0;
    sample <
      config.samplesPerCase;
    sample += 1
  ) {
    const session =
      new ResearchAtlasLiveSession({
        philosophyMap,
        searchPhilosophyImpl:
          async () =>
            structuredClone(
              response
            ),
        enrichAuthorsImpl:
          async value =>
            value
      });

    const started =
      performance.now();

    finalEvent =
      await session.runFederated(
        spec.query,
        {
          depth:
            Math.min(
              20,
              spec.resultCount
            )
        }
      );

    samples.push(
      performance.now() -
        started
    );
  }

  const snapshotBytes =
    Buffer.byteLength(
      JSON.stringify(
        finalEvent.snapshot
      )
    );

  const lexicalEdges =
    finalEvent
      .snapshot
      .edges
      .filter(
        edge =>
          edge.type ===
          "lexical-neighbor"
      )
      .length;

  return {
    id:
      spec.id,
    query:
      spec.query,
    resultCount:
      spec.resultCount,
    samples:
      samples.length,
    p50Ms:
      percentile(
        samples,
        0.50
      ),
    p95Ms:
      percentile(
        samples,
        0.95
      ),
    maximumMs:
      Math.max(
        ...samples
      ),
    snapshotBytes,
    nodes:
      finalEvent
        .snapshot
        .nodes
        .length,
    edges:
      finalEvent
        .snapshot
        .edges
        .length,
    lexicalEdges,
    event:
      finalEvent
  };
}


await mkdir(
  OUTPUT_ROOT,
  {
    recursive:
      true
  }
);


const cases = [];

for (
  const spec of
  config.cases
) {
  cases.push(
    await runCase(
      spec
    )
  );
}


const failures = [];

for (
  const result of
  cases
) {
  const threshold =
    config
      .thresholds
      .coreP95Ms[
        result.id
      ];

  if (
    Number.isFinite(
      threshold
    ) &&
    result.p95Ms >
      threshold
  ) {
    failures.push(
      result.id +
      ": p95 " +
      result.p95Ms
        .toFixed(2) +
      "ms > " +
      threshold +
      "ms"
    );
  }
}


const large =
  cases.find(
    item =>
      item.id ===
      "large"
  );

assert.ok(
  large,
  "large case is required"
);


if (
  large.snapshotBytes >
    config
      .thresholds
      .serializedSnapshotBytes
      .large
) {
  failures.push(
    "large snapshot " +
    large.snapshotBytes +
    " bytes > " +
    config
      .thresholds
      .serializedSnapshotBytes
      .large
  );
}


if (
  large.lexicalEdges >
    config
      .thresholds
      .lexicalEdges
      .largeMax
) {
  failures.push(
    "large lexical edges " +
    large.lexicalEdges +
    " > " +
    config
      .thresholds
      .lexicalEdges
      .largeMax
  );
}


const fixture = {
  schemaVersion:
    "research-atlas-product-gate-fixture-v1",
  revision:
    config.revision,
  response:
    large.event
      .response,
  snapshot:
    large.event
      .snapshot,
  layout:
    large.event
      .layout
};


await writeFile(
  new URL(
    "product-gate-fixture.json",
    OUTPUT_ROOT
  ),
  JSON.stringify(
    fixture,
    null,
    2
  ) +
  "\n"
);


const report = {
  schemaVersion:
    "research-atlas-product-gate-report-v1",
  revision:
    config.revision,
  generatedAt:
    new Date()
      .toISOString(),
  samplesPerCase:
    config.samplesPerCase,
  thresholds:
    config.thresholds,
  cases:
    cases.map(
      ({
        event,
        ...result
      }) =>
        result
    ),
  status:
    failures.length
      ? "FAIL"
      : "PASS",
  failures
};


await writeFile(
  new URL(
    "core-report.json",
    OUTPUT_ROOT
  ),
  JSON.stringify(
    report,
    null,
    2
  ) +
  "\n"
);


process.stdout.write(
  JSON.stringify(
    report,
    null,
    2
  ) +
  "\n"
);


if (
  failures.length
) {
  process.exitCode =
    1;
}

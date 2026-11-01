import {mkdir, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {
  buildAuthorityGraph
} from "../../src/core/author-authority-build-pipeline.js";
import {
  currentAuthorProfileToAuthorityCandidate,
  indexedWorkTargetMention,
  workToSourceRecords
} from "../../src/core/author-authority-adapters.js";
import {
  getCuratedAuthorBibliography
} from "../../src/core/curated-author-bibliography.js";

function dedupeById(items) {
  return [...new Map(items.map(item => [item.id, item])).values()];
}

const outputPath = resolve(
  process.argv[2] || "artifacts/author-authority/fixture-v1.json"
);

const curated = getCuratedAuthorBibliography({
  displayName: "Dinora Hernández López",
  orcid: "0000-0001-7335-1790"
});

if (!curated.works.length) {
  throw new Error("Curated Dinora bibliography is unavailable");
}

const candidate = currentAuthorProfileToAuthorityCandidate({
  displayName: "Dinora Hernández López",
  sourceDisplayName: "Dinora Hernández López",
  aliases: [
    "Dinora Hernández",
    "Dra Dinora Hernández",
    "Dra. Dinora Hernández"
  ],
  orcid: "0000-0001-7335-1790"
});

// Deliberate homonym guard. It is synthetic and exists only to prove that
// an exact name cannot override an incompatible ORCID.
const decoy = currentAuthorProfileToAuthorityCandidate({
  displayName: "Dinora Hernández López",
  aliases: ["Dinora Hernández"],
  orcid: "0000-0002-0000-0000"
});
decoy.id = "candidate:fixture:homonym-guard";

const mentions = curated.works.map(indexedWorkTargetMention);
const sourceRecords = dedupeById(
  curated.works.flatMap(work => workToSourceRecords(work))
);
const goldExpectations = Object.fromEntries(
  mentions.map(mention => [
    mention.id,
    {
      candidateRef: candidate.id,
      status: "confirmed"
    }
  ])
);

const graph = buildAuthorityGraph({
  candidates: [candidate, decoy],
  mentions,
  sourceRecords,
  algorithmVersion: "identity-v1",
  datasetRevision: "curated-author-bibliography-v1",
  buildRevision: "authority-fixture-v1",
  goldExpectations
});

if (graph.buildMetrics.gold?.falseMergeCount !== 0) {
  throw new Error(
    "Authority fixture contains false merges: " +
    graph.buildMetrics.gold.falseMergeCount
  );
}

if (graph.authorities.length !== 1) {
  throw new Error(
    "Authority fixture expected exactly one promoted real authority"
  );
}

await mkdir(dirname(outputPath), {recursive: true});
await writeFile(
  outputPath,
  JSON.stringify(graph, null, 2) + "\n",
  "utf8"
);

console.log(JSON.stringify({
  output: outputPath,
  works: curated.works.length,
  mentions: graph.buildMetrics.mentionsSeen,
  authorities: graph.buildMetrics.authoritiesTotal,
  confirmed: graph.buildMetrics.decisionsByStatus.confirmed,
  falseMerges: graph.buildMetrics.gold?.falseMergeCount ?? null
}, null, 2));

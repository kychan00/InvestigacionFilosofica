
import {
  resolvedSnapshotIdentityToAuthorityCandidate,
  workToSourceRecords,
  workToAuthorMentions
} from "./author-authority-adapters.js";

import {
  buildAuthorityGraph,
  validateAuthorityGraph
} from "./author-authority-build-pipeline.js";

import {
  AUTHOR_INDEX_RUNTIME_REVISION
} from "./remote-author-resolution.js";


export const RESEARCH_ATLAS_RUNTIME_AUTHORITY_REVISION =
  "2026-11-07.ra10-runtime-authority-v1";


function array(value) {
  return Array.isArray(value)
    ? value
    : value == null
      ? []
      : [value];
}


function normalizeOpenAlexAuthorId(value) {
  return String(value || "")
    .match(
      /(?:openalex\.org\/A|^A?)(\d+)$/i
    )?.[1] || null;
}


function normalizeOrcid(value) {
  const normalized =
    String(value || "")
      .replace(
        /^https?:\/\/orcid\.org\//i,
        ""
      )
      .trim()
      .toUpperCase();

  return /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/
    .test(normalized)
      ? normalized
      : null;
}


function uniqueStrings(values = []) {
  return [
    ...new Set(
      array(values)
        .map(value =>
          String(value || "")
            .trim()
        )
        .filter(Boolean)
    )
  ].sort();
}


function authorObservation(author = {}) {
  const openAlexId =
    normalizeOpenAlexAuthorId(
      author.id ||
      author.openalexId ||
      author.openAlexId
    );

  const orcid =
    normalizeOrcid(
      author.orcid ||
      author.o
    );

  const name =
    String(
      author.name ||
      author.displayName ||
      author.sourceDisplayName ||
      ""
    ).trim();

  return {
    openAlexId,
    orcid,
    name,
    raw:
      author
  };
}


function createUnionFind(size) {
  const parent =
    Array.from(
      {
        length:
          size
      },
      (
        _,
        index
      ) =>
        index
    );

  function find(index) {
    let current =
      index;

    while (
      parent[current] !==
      current
    ) {
      current =
        parent[current];
    }

    while (
      parent[index] !==
      current
    ) {
      const next =
        parent[index];

      parent[index] =
        current;

      index =
        next;
    }

    return current;
  }

  function union(
    left,
    right
  ) {
    const a =
      find(left);

    const b =
      find(right);

    if (
      a ===
      b
    ) {
      return;
    }

    parent[
      Math.max(
        a,
        b
      )
    ] =
      Math.min(
        a,
        b
      );
  }

  return {
    find,
    union
  };
}


function groupedCandidates(
  observations
) {
  const deterministic =
    observations.filter(
      item =>
        item.openAlexId ||
        item.orcid
    );

  if (
    !deterministic.length
  ) {
    return {
      candidates: [],
      conflicts: []
    };
  }

  const unionFind =
    createUnionFind(
      deterministic.length
    );

  const byOpenAlex =
    new Map();

  const byOrcid =
    new Map();

  deterministic.forEach(
    (
      item,
      index
    ) => {
      if (
        item.openAlexId
      ) {
        const previous =
          byOpenAlex.get(
            item.openAlexId
          );

        if (
          previous !==
          undefined
        ) {
          unionFind.union(
            previous,
            index
          );
        } else {
          byOpenAlex.set(
            item.openAlexId,
            index
          );
        }
      }

      if (
        item.orcid
      ) {
        const previous =
          byOrcid.get(
            item.orcid
          );

        if (
          previous !==
          undefined
        ) {
          unionFind.union(
            previous,
            index
          );
        } else {
          byOrcid.set(
            item.orcid,
            index
          );
        }
      }
    }
  );

  const groups =
    new Map();

  deterministic.forEach(
    (
      item,
      index
    ) => {
      const root =
        unionFind.find(
          index
        );

      const values =
        groups.get(root) ||
        [];

      values.push(item);
      groups.set(
        root,
        values
      );
    }
  );

  const candidates = [];
  const conflicts = [];

  for (
    const values of
    groups.values()
  ) {
    const openAlexIds =
      uniqueStrings(
        values.map(
          item =>
            item.openAlexId
        )
      );

    const orcids =
      uniqueStrings(
        values.map(
          item =>
            item.orcid
        )
      );

    const names =
      uniqueStrings(
        values.map(
          item =>
            item.name
        )
      );

    if (
      orcids.length >
      1
    ) {
      conflicts.push({
        kind:
          "openalex-author-orcid-conflict",
        openAlexIds,
        orcids,
        names
      });

      continue;
    }

    const displayName =
      names[0] ||
      (
        openAlexIds[0]
          ? "A" +
            openAlexIds[0]
          : "Autor"
      );

    const candidate =
      resolvedSnapshotIdentityToAuthorityCandidate({
        id:
          openAlexIds[0]
            ? "https://openalex.org/A" +
              openAlexIds[0]
            : null,
        linkedAuthorIds:
          openAlexIds
            .slice(1)
            .map(
              id =>
                "https://openalex.org/A" +
                id
            ),
        displayName,
        aliases:
          names,
        orcid:
          orcids[0] ||
          null
      });

    candidates.push(
      candidate
    );
  }

  candidates.sort(
    (
      left,
      right
    ) =>
      String(
        left.id
      ).localeCompare(
        String(
          right.id
        )
      )
  );

  return {
    candidates,
    conflicts
  };
}


export function buildResearchAtlasRuntimeAuthorityGraph(
  searchResponse,
  {
    datasetRevision =
      AUTHOR_INDEX_RUNTIME_REVISION,
    buildRevision =
      RESEARCH_ATLAS_RUNTIME_AUTHORITY_REVISION
  } = {}
) {
  const results =
    array(
      searchResponse?.results
    );

  const observations =
    results.flatMap(
      result =>
        array(
          result?.authors
        ).map(
          author =>
            authorObservation(
              author
            )
        )
    );

  const {
    candidates,
    conflicts
  } =
    groupedCandidates(
      observations
    );

  const sourceRecords = [];
  const mentions = [];

  for (
    const result of
    results
  ) {
    const records =
      workToSourceRecords(
        result,
        {
          providerRevision:
            datasetRevision
        }
      );

    const primary =
      records[0];

    if (
      !primary
    ) {
      continue;
    }

    sourceRecords.push(
      primary
    );

    mentions.push(
      ...workToAuthorMentions(
        result,
        {
          sourceRecord:
            primary
        }
      )
    );
  }

  const graph =
    buildAuthorityGraph({
      candidates,
      mentions,
      sourceRecords,
      algorithmVersion:
        "identity-v1",
      datasetRevision,
      buildRevision
    });

  graph.runtimeDiagnostics = {
    revision:
      RESEARCH_ATLAS_RUNTIME_AUTHORITY_REVISION,
    authorIndexRevision:
      datasetRevision,
    observedAuthors:
      observations.length,
    deterministicAuthorObservations:
      observations.filter(
        item =>
          item.openAlexId ||
          item.orcid
      ).length,
    candidates:
      candidates.length,
    confirmedAuthorities:
      graph.authorities.length,
    conflicts
  };

  validateAuthorityGraph(
    graph
  );

  return graph;
}

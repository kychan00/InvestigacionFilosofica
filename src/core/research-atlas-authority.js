import {
  creatorToAuthorMention
} from "./author-authority-adapters.js";

import {
  authorityIdentifiers
} from "./author-authority-resolution.js";

import {
  resultIdentityKey
} from "./merge-results.js";

import {
  RESEARCH_ATLAS_NODE_TYPES,
  RESEARCH_ATLAS_EDGE_TYPES,
  RESEARCH_ATLAS_EVIDENCE_CLASSES,
  RESEARCH_ATLAS_EDGE_STATUS,
  assertResearchAtlasSnapshot
} from "./research-atlas-contract.js";


export const RESEARCH_ATLAS_AUTHORITY_REVISION =
  "2026-11-07.ra3-v1";


const DETERMINISTIC_IDENTIFIER_SCHEMES =
  new Set([
    "orcid",
    "openalex-author",
    "wikidata"
  ]);


function array(value) {
  return Array.isArray(value)
    ? value
    : value == null
      ? []
      : [value];
}


function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function stableObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [
        key,
        stableObject(value[key])
      ])
  );
}


function stableJson(value) {
  return JSON.stringify(
    stableObject(value)
  );
}


function fnv1a64(value) {
  let hash =
    0xcbf29ce484222325n;

  const prime =
    0x100000001b3n;

  for (
    const byte of
    new TextEncoder().encode(
      String(value || "")
    )
  ) {
    hash ^= BigInt(byte);

    hash =
      BigInt.asUintN(
        64,
        hash * prime
      );
  }

  return hash
    .toString(16)
    .padStart(16, "0");
}


function stableId(prefix, value) {
  return (
    prefix +
    ":" +
    fnv1a64(value)
  );
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


function authorityMap(graph = {}) {
  return new Map(
    array(
      graph.authorities
    ).map(authority => [
      String(
        authority?.id || ""
      ),
      authority
    ])
      .filter(
        ([id]) =>
          Boolean(id)
      )
  );
}


function mentionLinkMap(graph = {}) {
  return new Map(
    array(
      graph.mentionAuthorityLinks
    ).map(link => [
      String(
        link?.mentionRef || ""
      ),
      String(
        link?.authorityRef || ""
      )
    ])
      .filter(
        ([mentionRef, authorityRef]) =>
          Boolean(
            mentionRef &&
            authorityRef
          )
      )
  );
}


function identifierRegistry(
  graph = {}
) {
  return new Map(
    Object.entries(
      graph.identifierRegistry ||
      {}
    ).map(
      ([key, value]) => [
        String(key),
        String(value)
      ]
    )
  );
}


function identifierKey(
  identifier = {}
) {
  const scheme =
    String(
      identifier?.scheme || ""
    )
      .trim()
      .toLowerCase();

  const value =
    String(
      identifier?.normalizedValue ??
      identifier?.value ??
      identifier?.rawValue ??
      ""
    ).trim();

  if (
    !scheme ||
    !value ||
    !DETERMINISTIC_IDENTIFIER_SCHEMES
      .has(scheme)
  ) {
    return null;
  }

  return (
    scheme +
    ":" +
    value
  );
}


function resolveMention(
  mention,
  graph,
  indices
) {
  const direct =
    indices.mentionLinks
      .get(
        mention.id
      );

  if (direct) {
    const authority =
      indices.authorities
        .get(direct);

    if (!authority) {
      throw new TypeError(
        "Authority mention link points to unknown authority: " +
        direct
      );
    }

    return {
      status:
        "confirmed",
      authorityRef:
        direct,
      authority,
      method:
        "existing-mention-link",
      identifierKeys: []
    };
  }

  const keys =
    authorityIdentifiers(
      mention
    )
      .map(identifierKey)
      .filter(Boolean);

  const resolved =
    uniqueStrings(
      keys.map(key =>
        indices.registry
          .get(key)
      )
    );

  if (
    resolved.length >
    1
  ) {
    return {
      status:
        "ambiguous",
      authorityRef:
        null,
      authority:
        null,
      method:
        "identifier-conflict",
      identifierKeys:
        uniqueStrings(
          keys
        ),
      conflictingAuthorityRefs:
        resolved
    };
  }

  if (
    resolved.length ===
    1
  ) {
    const authorityRef =
      resolved[0];

    const authority =
      indices.authorities
        .get(
          authorityRef
        );

    if (!authority) {
      throw new TypeError(
        "Identifier registry points to unknown authority: " +
        authorityRef
      );
    }

    return {
      status:
        "confirmed",
      authorityRef,
      authority,
      method:
        "deterministic-identifier-registry",
      identifierKeys:
        uniqueStrings(
          keys.filter(
            key =>
              indices.registry
                .get(key) ===
              authorityRef
          )
        )
    };
  }

  return {
    status:
      "unresolved",
    authorityRef:
      null,
    authority:
      null,
    method:
      "no-deterministic-authority-link",
    identifierKeys:
      uniqueStrings(
        keys
      )
  };
}


function authorityNodeId(
  authorityRef
) {
  return stableId(
    "person",
    authorityRef
  );
}


function authorityPersonNode(
  authority
) {
  return {
    id:
      authorityNodeId(
        authority.id
      ),
    nodeType:
      RESEARCH_ATLAS_NODE_TYPES
        .AUTHORITY_PERSON,
    authorityRef:
      authority.id,
    displayName:
      String(
        authority.canonicalName ||
        authority.displayName ||
        "Autor"
      ).trim(),
    resolutionState:
      "confirmed",
    names:
      structuredClone(
        authority.names ||
        []
      ),
    externalIdentifiers:
      structuredClone(
        authority.externalIdentifiers ||
        []
      ),
    affiliations:
      structuredClone(
        authority.affiliations ||
        []
      ),
    authorityRevision:
      authority.lastEvaluatedInRevision ||
      null
  };
}


function syntheticMentionSourceRef(
  workIdentity
) {
  return stableId(
    "source:research-atlas-author",
    workIdentity
  );
}


function resultAuthorMentions(
  result,
  workNode
) {
  const creators =
    array(
      result?.authors
    )
      .filter(author =>
        Boolean(
          author?.name ||
          author?.displayName ||
          author?.rawCreator
        )
      );

  if (!creators.length) {
    return [];
  }

  const sourceRef =
    workNode
      .sourceRecordRefs?.[0] ||
    syntheticMentionSourceRef(
      workNode.identity.key
    );

  return creators.map(
    (creator, position) => {
      const mention =
        creatorToAuthorMention(
          creator,
          {
            sourceRecordRef:
              sourceRef,
            position,
            fallbackRole:
              "author"
          }
        );

      return {
        ...mention,
        atlasSourceRecordRefs:
          workNode
            .sourceRecordRefs
            ?.length
            ? [
                ...workNode
                  .sourceRecordRefs
              ]
            : [
                sourceRef
              ]
      };
    }
  );
}


function authorMentionNode(
  mention,
  resolution
) {
  return {
    id:
      stableId(
        "author-mention-node",
        mention.id
      ),
    nodeType:
      RESEARCH_ATLAS_NODE_TYPES
        .AUTHOR_MENTION,
    mentionRef:
      mention.id,
    rawName:
      mention.rawValue,
    normalizedName:
      mention.normalizedValue,
    resolutionState:
      resolution.status ===
        "ambiguous"
        ? "ambiguous"
        : "unresolved",
    sourceRecordRefs:
      uniqueStrings(
        mention
          .atlasSourceRecordRefs ||
        [
          mention
            .sourceRecordRef
        ]
      ),
    candidateAuthorityRefs:
      uniqueStrings(
        resolution
          .conflictingAuthorityRefs ||
        []
      ),
    embeddedIdentifiers:
      structuredClone(
        mention
          .embeddedIdentifiers ||
        []
      ),
    rawRole:
      mention.rawRole ||
      null,
    normalizedRoleCandidate:
      mention.normalizedRoleCandidate ||
      "unknown"
  };
}


function contributionEvidence(
  {
    authorityRef,
    role,
    sourceRecordRefs,
    source,
    resolutionMethod,
    identifierKeys = [],
    workMapAuthorIds = [],
    workMapPositions = []
  }
) {
  return {
    id:
      stableId(
        "evidence:contribution",
        stableJson({
          authorityRef,
          role,
          source,
          sourceRecordRefs:
            uniqueStrings(
              sourceRecordRefs
            ),
          resolutionMethod,
          identifierKeys:
            uniqueStrings(
              identifierKeys
            ),
          workMapAuthorIds:
            uniqueStrings(
              workMapAuthorIds
            ),
          workMapPositions:
            uniqueStrings(
              workMapPositions
            )
        })
      ),
    class:
      RESEARCH_ATLAS_EVIDENCE_CLASSES
        .FACTUAL,
    source,
    payload: {
      role,
      authorityRef,
      sourceRecordRefs:
        uniqueStrings(
          sourceRecordRefs
        ),
      resolutionMethod,
      identifierKeys:
        uniqueStrings(
          identifierKeys
        ),
      workMapAuthorIds:
        uniqueStrings(
          workMapAuthorIds
        ),
      workMapPositions:
        uniqueStrings(
          workMapPositions
        )
    }
  };
}


function unresolvedMentionEvidence(
  mention,
  resolution
) {
  return {
    id:
      stableId(
        "evidence:author-mention",
        stableJson({
          mentionRef:
            mention.id,
          sourceRecordRefs:
            uniqueStrings(
              mention
                .atlasSourceRecordRefs ||
              [
                mention
                  .sourceRecordRef
              ]
            ),
          method:
            resolution.method
        })
      ),
    class:
      RESEARCH_ATLAS_EVIDENCE_CLASSES
        .PROVISIONAL,
    source:
      "author-authority-resolution",
    payload: {
      sourceRecordRefs:
        uniqueStrings(
          mention
            .atlasSourceRecordRefs ||
          [
            mention
              .sourceRecordRef
          ]
        ),
      rawRole:
        mention.rawRole ||
        mention
          .normalizedRoleCandidate ||
        "author",
      resolutionMethod:
        resolution.method,
      conflictingAuthorityRefs:
        uniqueStrings(
          resolution
            .conflictingAuthorityRefs ||
          []
        ),
      identifierKeys:
        uniqueStrings(
          resolution
            .identifierKeys ||
          []
        )
    }
  };
}


function contributionKey(
  authorityRef,
  workRef
) {
  return (
    authorityRef +
    "|" +
    workRef
  );
}


function ensureContribution(
  state,
  {
    authority,
    workNode,
    evidence
  }
) {
  const person =
    authorityPersonNode(
      authority
    );

  state.personNodes
    .set(
      person.authorityRef,
      person
    );

  state.evidence
    .set(
      evidence.id,
      evidence
    );

  const key =
    contributionKey(
      authority.id,
      workNode.id
    );

  const previous =
    state.contributions
      .get(key);

  if (!previous) {
    state.contributions
      .set(
        key,
        {
          id:
            stableId(
              "edge:contribution",
              key
            ),
          type:
            RESEARCH_ATLAS_EDGE_TYPES
              .CONTRIBUTION,
          fromRef:
            person.id,
          toRef:
            workNode.id,
          status:
            RESEARCH_ATLAS_EDGE_STATUS
              .CONFIRMED,
          evidenceRefs: [
            evidence.id
          ]
        }
      );

    return;
  }

  previous.evidenceRefs =
    uniqueStrings([
      ...previous
        .evidenceRefs,
      evidence.id
    ]);
}


function workMapRows(
  authorityWorkMap
) {
  if (
    authorityWorkMap instanceof
    Map
  ) {
    return [
      ...authorityWorkMap
        .values()
    ];
  }

  if (
    Array.isArray(
      authorityWorkMap
    )
  ) {
    return authorityWorkMap;
  }

  if (
    Array.isArray(
      authorityWorkMap
        ?.rows
    )
  ) {
    return authorityWorkMap
      .rows;
  }

  if (
    isPlainObject(
      authorityWorkMap
    )
  ) {
    return Object.values(
      authorityWorkMap
    )
      .filter(
        value =>
          isPlainObject(
            value
          ) &&
          value.w
      );
  }

  return [];
}


function workMapIndex(
  authorityWorkMap
) {
  const map =
    new Map();

  for (
    const row of
    workMapRows(
      authorityWorkMap
    )
  ) {
    const key =
      String(
        row?.w || ""
      ).trim();

    if (!key) {
      continue;
    }

    if (map.has(key)) {
      throw new TypeError(
        "Duplicate authority-work-map identity: " +
        key
      );
    }

    map.set(
      key,
      row
    );
  }

  return map;
}


function openAlexWorkIdentities(
  result
) {
  const values = [
    result?.openalexId,
    result?.openalex_id,
    result?.id,
    result?.urls?.canonical,
    ...array(
      result?.sourceRecords
    ).flatMap(record => [
      record?.sourceId,
      record?.openalexId
    ])
  ];

  const output =
    new Set();

  for (const value of values) {
    const match =
      String(
        value || ""
      )
        .match(
          /(?:^|openalex\.org\/|openalex[-:/])W?(\d+)/i
        );

    if (!match) {
      continue;
    }

    output.add(
      "openalex:W" +
      match[1]
    );
  }

  return [
    ...output
  ].sort();
}


function matchingWorkMapRow(
  result,
  index
) {
  for (
    const key of
    openAlexWorkIdentities(
      result
    )
  ) {
    if (
      index.has(key)
    ) {
      return index.get(key);
    }
  }

  return null;
}


function sourceRefsForWork(
  workNode
) {
  const refs =
    uniqueStrings(
      workNode
        .sourceRecordRefs ||
      []
    );

  return refs.length
    ? refs
    : [
        syntheticMentionSourceRef(
          workNode.identity.key
        )
      ];
}


function ingestWorkMap(
  state,
  {
    row,
    workNode,
    indices
  }
) {
  if (!row) {
    return;
  }

  state.metrics
    .workMapRowsMatched +=
    1;

  state.metrics
    .unresolvedAuthorityObservations +=
    Math.max(
      0,
      Number(
        row.u || 0
      ) || 0
    );

  for (
    const item of
    array(
      row.a
    )
  ) {
    const authorityRef =
      String(
        item?.r || ""
      ).trim();

    if (!authorityRef) {
      continue;
    }

    const authority =
      indices.authorities
        .get(
          authorityRef
        );

    if (!authority) {
      throw new TypeError(
        "Authority Work Map points to unknown AuthorityPerson: " +
        authorityRef
      );
    }

    const evidence =
      contributionEvidence({
        authorityRef,
        role:
          "author",
        sourceRecordRefs:
          sourceRefsForWork(
            workNode
          ),
        source:
          "authority-work-map-v1",
        resolutionMethod:
          "confirmed-authority-work-map",
        workMapAuthorIds:
          item.i ||
          [],
        workMapPositions:
          item.p ||
          []
      });

    ensureContribution(
      state,
      {
        authority,
        workNode,
        evidence
      }
    );

    state.metrics
      .workMapConfirmedContributions +=
      1;
  }
}


function ingestResultMentions(
  state,
  {
    result,
    workNode,
    graph,
    indices
  }
) {
  for (
    const mention of
    resultAuthorMentions(
      result,
      workNode
    )
  ) {
    state.metrics
      .structuredMentions +=
      1;

    const resolution =
      resolveMention(
        mention,
        graph,
        indices
      );

    if (
      resolution.status ===
      "confirmed"
    ) {
      const role =
        mention
          .normalizedRoleCandidate &&
        mention
          .normalizedRoleCandidate !==
            "unknown"
          ? mention
              .normalizedRoleCandidate
          : "author";

      const evidence =
        contributionEvidence({
          authorityRef:
            resolution
              .authorityRef,
          role,
          sourceRecordRefs:
            sourceRefsForWork(
              workNode
            ),
          source:
            "author-authority-graph-v1",
          resolutionMethod:
            resolution.method,
          identifierKeys:
            resolution
              .identifierKeys ||
            []
        });

      ensureContribution(
        state,
        {
          authority:
            resolution
              .authority,
          workNode,
          evidence
        }
      );

      state.metrics
        .resolvedMentions +=
        1;

      continue;
    }

    const node =
      authorMentionNode(
        mention,
        resolution
      );

    const evidence =
      unresolvedMentionEvidence(
        mention,
        resolution
      );

    const edge = {
      id:
        stableId(
          "edge:author-mention",
          node.id +
          "|" +
          workNode.id
        ),
      type:
        RESEARCH_ATLAS_EDGE_TYPES
          .AUTHOR_MENTION,
      fromRef:
        node.id,
      toRef:
        workNode.id,
      status:
        RESEARCH_ATLAS_EDGE_STATUS
          .PROVISIONAL,
      evidenceRefs: [
        evidence.id
      ]
    };

    state.mentionNodes
      .set(
        node.mentionRef,
        node
      );

    state.evidence
      .set(
        evidence.id,
        evidence
      );

    state.mentionEdges
      .set(
        edge.id,
        edge
      );

    state.metrics
      .unresolvedMentions +=
      1;

    if (
      resolution.status ===
      "ambiguous"
    ) {
      state.metrics
        .ambiguousMentions +=
        1;
    }
  }
}


function deriveSameAuthorEdges(
  state
) {
  const worksByAuthority =
    new Map();

  for (
    const edge of
    state.contributions
      .values()
  ) {
    const person =
      [
        ...state.personNodes
          .values()
      ].find(
        node =>
          node.id ===
          edge.fromRef
      );

    if (!person) {
      continue;
    }

    if (
      !worksByAuthority
        .has(
          person.authorityRef
        )
    ) {
      worksByAuthority
        .set(
          person.authorityRef,
          new Set()
        );
    }

    worksByAuthority
      .get(
        person.authorityRef
      )
      .add(
        edge.toRef
      );
  }

  const pairs =
    new Map();

  for (
    const [
      authorityRef,
      workRefs
    ] of worksByAuthority
  ) {
    const refs =
      [
        ...workRefs
      ].sort();

    for (
      let left = 0;
      left < refs.length;
      left += 1
    ) {
      for (
        let right =
          left + 1;
        right <
          refs.length;
        right += 1
      ) {
        const pairKey =
          refs[left] +
          "|" +
          refs[right];

        if (
          !pairs.has(
            pairKey
          )
        ) {
          pairs.set(
            pairKey,
            {
              fromRef:
                refs[left],
              toRef:
                refs[right],
              authorityRefs:
                new Set()
            }
          );
        }

        pairs.get(
          pairKey
        ).authorityRefs
          .add(
            authorityRef
          );
      }
    }
  }

  for (
    const [
      pairKey,
      item
    ] of pairs
  ) {
    const authorityRefs =
      [
        ...item
          .authorityRefs
      ].sort();

    const evidence = {
      id:
        stableId(
          "evidence:same-author",
          stableJson({
            pairKey,
            authorityRefs
          })
        ),
      class:
        RESEARCH_ATLAS_EVIDENCE_CLASSES
          .DERIVED,
      source:
        "research-atlas-ra3",
      payload: {
        authorityRefs
      }
    };

    const edge = {
      id:
        stableId(
          "edge:same-author",
          pairKey
        ),
      type:
        RESEARCH_ATLAS_EDGE_TYPES
          .SAME_AUTHOR,
      fromRef:
        item.fromRef,
      toRef:
        item.toRef,
      status:
        RESEARCH_ATLAS_EDGE_STATUS
          .DERIVED,
      evidenceRefs: [
        evidence.id
      ]
    };

    state.evidence
      .set(
        evidence.id,
        evidence
      );

    state.sameAuthorEdges
      .set(
        edge.id,
        edge
      );
  }
}


function deriveCoauthorEdges(
  state
) {
  const authoritiesByWork =
    new Map();

  for (
    const edge of
    state.contributions
      .values()
  ) {
    const person =
      [
        ...state.personNodes
          .values()
      ].find(
        node =>
          node.id ===
          edge.fromRef
      );

    if (!person) {
      continue;
    }

    if (
      !authoritiesByWork
        .has(
          edge.toRef
        )
    ) {
      authoritiesByWork
        .set(
          edge.toRef,
          new Set()
        );
    }

    authoritiesByWork
      .get(
        edge.toRef
      )
      .add(
        person.authorityRef
      );
  }

  const pairs =
    new Map();

  for (
    const [
      workRef,
      authorityRefs
    ] of authoritiesByWork
  ) {
    const refs =
      [
        ...authorityRefs
      ].sort();

    for (
      let left = 0;
      left < refs.length;
      left += 1
    ) {
      for (
        let right =
          left + 1;
        right <
          refs.length;
        right += 1
      ) {
        const pairKey =
          refs[left] +
          "|" +
          refs[right];

        if (
          !pairs.has(
            pairKey
          )
        ) {
          pairs.set(
            pairKey,
            {
              authorityRefs: [
                refs[left],
                refs[right]
              ],
              supportWorkRefs:
                new Set()
            }
          );
        }

        pairs.get(
          pairKey
        ).supportWorkRefs
          .add(
            workRef
          );
      }
    }
  }

  for (
    const [
      pairKey,
      item
    ] of pairs
  ) {
    const [
      leftAuthority,
      rightAuthority
    ] =
      item.authorityRefs;

    const leftPerson =
      state.personNodes
        .get(
          leftAuthority
        );

    const rightPerson =
      state.personNodes
        .get(
          rightAuthority
        );

    if (
      !leftPerson ||
      !rightPerson
    ) {
      continue;
    }

    const supportWorkRefs =
      [
        ...item
          .supportWorkRefs
      ].sort();

    const evidence = {
      id:
        stableId(
          "evidence:coauthor",
          stableJson({
            pairKey,
            supportWorkRefs
          })
        ),
      class:
        RESEARCH_ATLAS_EVIDENCE_CLASSES
          .DERIVED,
      source:
        "research-atlas-ra3",
      payload: {
        supportWorkRefs
      }
    };

    const edge = {
      id:
        stableId(
          "edge:coauthor",
          pairKey
        ),
      type:
        RESEARCH_ATLAS_EDGE_TYPES
          .COAUTHOR,
      fromRef:
        leftPerson.id,
      toRef:
        rightPerson.id,
      status:
        RESEARCH_ATLAS_EDGE_STATUS
          .DERIVED,
      evidenceRefs: [
        evidence.id
      ]
    };

    state.evidence
      .set(
        evidence.id,
        evidence
      );

    state.coauthorEdges
      .set(
        edge.id,
        edge
      );
  }
}


function canonicalSort(
  values
) {
  return [
    ...values
  ].sort(
    (left, right) =>
      String(
        left.id || ""
      ).localeCompare(
        String(
          right.id || ""
        )
      )
  );
}


function updateDiagnostics(
  snapshot,
  state
) {
  const nodes =
    snapshot.nodes;

  return {
    ...snapshot.diagnostics,
    directHits:
      nodes.filter(
        node =>
          node.nodeType ===
            RESEARCH_ATLAS_NODE_TYPES
              .WORK &&
          node.discovery
            ?.directHit ===
              true
      ).length,
    expandedWorks:
      nodes.filter(
        node =>
          node.nodeType ===
            RESEARCH_ATLAS_NODE_TYPES
              .WORK &&
          node.discovery
            ?.directHit ===
              false
      ).length,
    authorityPersons:
      nodes.filter(
        node =>
          node.nodeType ===
            RESEARCH_ATLAS_NODE_TYPES
              .AUTHORITY_PERSON
      ).length,
    unresolvedMentions:
      nodes.filter(
        node =>
          node.nodeType ===
            RESEARCH_ATLAS_NODE_TYPES
              .AUTHOR_MENTION
      ).length,
    authority: {
      revision:
        RESEARCH_ATLAS_AUTHORITY_REVISION,
      graphBuildRevision:
        state.graphBuildRevision,
      workMapBuildRevision:
        state.workMapBuildRevision,
      structuredMentions:
        state.metrics
          .structuredMentions,
      resolvedMentions:
        state.metrics
          .resolvedMentions,
      ambiguousMentions:
        state.metrics
          .ambiguousMentions,
      unresolvedMentions:
        state.metrics
          .unresolvedMentions,
      workMapRowsMatched:
        state.metrics
          .workMapRowsMatched,
      workMapConfirmedContributions:
        state.metrics
          .workMapConfirmedContributions,
      unresolvedAuthorityObservations:
        state.metrics
          .unresolvedAuthorityObservations,
      confirmedContributionEdges:
        state.contributions
          .size,
      sameAuthorEdges:
        state.sameAuthorEdges
          .size,
      coauthorEdges:
        state.coauthorEdges
          .size
    }
  };
}


export function enrichResearchAtlasWithAuthority(
  snapshot,
  searchResponse,
  {
    authorityGraph = null,
    authorityWorkMap = null,
    authorityWorkMapRevision = null
  } = {}
) {
  if (
    !authorityGraph &&
    !authorityWorkMap
  ) {
    return snapshot;
  }

  if (
    !isPlainObject(
      authorityGraph
    )
  ) {
    throw new TypeError(
      "RA3 requires authorityGraph when authority enrichment is enabled"
    );
  }

  const indices = {
    authorities:
      authorityMap(
        authorityGraph
      ),
    mentionLinks:
      mentionLinkMap(
        authorityGraph
      ),
    registry:
      identifierRegistry(
        authorityGraph
      )
  };

  const mapIndex =
    workMapIndex(
      authorityWorkMap
    );

  const workNodes =
    new Map(
      snapshot.nodes
        .filter(
          node =>
            node.nodeType ===
            RESEARCH_ATLAS_NODE_TYPES
              .WORK
        )
        .map(node => [
          node.identity.key,
          node
        ])
    );

  const state = {
    graphBuildRevision:
      authorityGraph
        .buildRevision ||
      authorityGraph
        .datasetRevision ||
      null,
    workMapBuildRevision:
      authorityWorkMapRevision ||
      authorityWorkMap
        ?.buildRevision ||
      authorityWorkMap
        ?.manifest?.buildRevision ||
      null,
    personNodes:
      new Map(),
    mentionNodes:
      new Map(),
    evidence:
      new Map(),
    contributions:
      new Map(),
    mentionEdges:
      new Map(),
    sameAuthorEdges:
      new Map(),
    coauthorEdges:
      new Map(),
    metrics: {
      structuredMentions: 0,
      resolvedMentions: 0,
      ambiguousMentions: 0,
      unresolvedMentions: 0,
      workMapRowsMatched: 0,
      workMapConfirmedContributions: 0,
      unresolvedAuthorityObservations: 0
    }
  };

  for (
    const result of
    array(
      searchResponse
        ?.results
    )
  ) {
    const identity =
      resultIdentityKey(
        result
      );

    const workNode =
      workNodes.get(
        identity
      );

    if (!workNode) {
      throw new TypeError(
        "RA3 could not locate WorkNode for search result: " +
        identity
      );
    }

    const row =
      matchingWorkMapRow(
        result,
        mapIndex
      );

    ingestWorkMap(
      state,
      {
        row,
        workNode,
        indices
      }
    );

    ingestResultMentions(
      state,
      {
        result,
        workNode,
        graph:
          authorityGraph,
        indices
      }
    );
  }

  deriveSameAuthorEdges(
    state
  );

  deriveCoauthorEdges(
    state
  );

  const enriched = {
    ...structuredClone(
      snapshot
    ),
    nodes:
      canonicalSort([
        ...snapshot.nodes,
        ...state.personNodes
          .values(),
        ...state.mentionNodes
          .values()
      ]),
    edges:
      canonicalSort([
        ...snapshot.edges,
        ...state.contributions
          .values(),
        ...state.mentionEdges
          .values(),
        ...state.sameAuthorEdges
          .values(),
        ...state.coauthorEdges
          .values()
      ]),
    evidence:
      canonicalSort([
        ...snapshot.evidence,
        ...state.evidence
          .values()
      ])
  };

  enriched.diagnostics =
    updateDiagnostics(
      enriched,
      state
    );

  return assertResearchAtlasSnapshot(
    enriched
  );
}

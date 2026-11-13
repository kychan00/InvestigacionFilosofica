import {
  normalizeAuthorName
} from "./remote-author-resolution.js";

import {
  resultIdentityKey
} from "./merge-results.js";


export const RESEARCH_ATLAS_IDENTITY_REVISION =
  "2026-11-13.ra13a-orcid-identity-v1";


function array(value) {
  return Array.isArray(value)
    ? value
    : value == null
      ? []
      : [value];
}


function normalizeOrcid(value) {
  const match =
    String(value || "")
      .trim()
      .match(
        /(?:https?:\/\/(?:www\.)?orcid\.org\/)?(\d{4}-\d{4}-\d{4}-[\dX]{4})\/?$/i
      );

  return match?.[1]
    ?.toUpperCase() ||
    null;
}


function openAlexAuthorId(value) {
  return String(value || "")
    .trim()
    .match(
      /(?:^|openalex\.org\/)A?(\d+)$/i
    )?.[1] ||
    null;
}


function normalizedName(value) {
  return normalizeAuthorName(
    String(value || "").trim()
  );
}


function uniqueStrings(values = []) {
  const seen =
    new Set();

  return values
    .map(value =>
      String(value || "").trim()
    )
    .filter(Boolean)
    .filter(value => {
      const key =
        value.toLocaleLowerCase("und");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}


function canonicalName(values = []) {
  const counts =
    new Map();

  for (const value of values) {
    const clean =
      String(value || "").trim();

    const key =
      normalizedName(clean);

    if (!key) {
      continue;
    }

    const current =
      counts.get(key) || {
        count: 0,
        variants:
          new Set()
      };

    current.count += 1;
    current.variants
      .add(clean);

    counts.set(
      key,
      current
    );
  }

  const ranked =
    [...counts.entries()]
      .map(([key, value]) => {
        const variants =
          [...value.variants]
            .sort((left, right) =>
              right.split(/\s+/).length -
                left.split(/\s+/).length ||
              right.length -
                left.length ||
              left.localeCompare(
                right,
                "es"
              )
            );

        return {
          key,
          count:
            value.count,
          display:
            variants[0]
        };
      })
      .sort((left, right) =>
        right.count -
          left.count ||
        right.key.split(" ").length -
          left.key.split(" ").length ||
        right.display.length -
          left.display.length ||
        left.display.localeCompare(
          right.display,
          "es"
        )
      );

  return ranked[0]?.display ||
    "Autor identificado";
}


function institutionName(value) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  return String(
    value?.institution ||
    value?.organization ||
    value?.name ||
    value?.value ||
    ""
  ).trim() || null;
}


function authorIdentifiers(author = {}) {
  const identifiers = [];

  const orcid =
    normalizeOrcid(
      author.orcid ||
      author.o ||
      author.id
    );

  if (orcid) {
    identifiers.push({
      scheme: "orcid",
      value: orcid
    });
  }

  const openalex =
    openAlexAuthorId(
      author.openalexId ||
      author.openalex_id ||
      author.id
    );

  if (openalex) {
    identifiers.push({
      scheme: "openalex-author",
      value: openalex
    });
  }

  return identifiers;
}


function resultProfileInstitutions(
  result,
  orcid
) {
  const expected =
    normalizeOrcid(orcid);

  const profile =
    normalizeOrcid(
      result?.orcidSearch?.profile
    );

  if (
    !expected ||
    !profile ||
    expected !== profile
  ) {
    return [];
  }

  return uniqueStrings(
    array(
      result?.orcidSearch
        ?.institutions
    )
  );
}


function authorAffiliations(
  author,
  result,
  orcid
) {
  const explicit =
    array(
      author?.affiliations
    )
      .map(
        institutionName
      )
      .filter(Boolean);

  return uniqueStrings([
    ...explicit,
    ...resultProfileInstitutions(
      result,
      orcid
    )
  ]);
}


function observation(
  author,
  result,
  resultIndex,
  authorIndex
) {
  const name =
    String(
      author?.name ||
      author?.displayName ||
      author?.sourceDisplayName ||
      ""
    ).trim();

  if (!name) {
    return null;
  }

  const identifiers =
    authorIdentifiers(
      author
    );

  const orcid =
    identifiers.find(
      item =>
        item.scheme === "orcid"
    )?.value ||
    null;

  return {
    name,
    resultIndex,
    authorIndex,
    workIdentity:
      resultIdentityKey(
        result
      ),
    providers:
      uniqueStrings(
        result?.providers || []
      ),
    identifiers,
    orcid,
    affiliations:
      authorAffiliations(
        author,
        result,
        orcid
      )
  };
}


function observationsFromResponse(
  searchResponse
) {
  const output = [];

  for (
    let resultIndex = 0;
    resultIndex <
      (searchResponse?.results || [])
        .length;
    resultIndex += 1
  ) {
    const result =
      searchResponse.results[
        resultIndex
      ];

    for (
      let authorIndex = 0;
      authorIndex <
        (result?.authors || [])
          .length;
      authorIndex += 1
    ) {
      const value =
        observation(
          result.authors[
            authorIndex
          ],
          result,
          resultIndex,
          authorIndex
        );

      if (value) {
        output.push(value);
      }
    }
  }

  return output;
}


function openAlexOrcidLinks(
  observations
) {
  const map =
    new Map();

  for (const item of observations) {
    const orcid =
      item.identifiers.find(
        identifier =>
          identifier.scheme ===
            "orcid"
      )?.value;

    const openalex =
      item.identifiers.find(
        identifier =>
          identifier.scheme ===
            "openalex-author"
      )?.value;

    if (!orcid || !openalex) {
      continue;
    }

    if (!map.has(openalex)) {
      map.set(
        openalex,
        new Set()
      );
    }

    map.get(openalex)
      .add(orcid);
  }

  return map;
}


function authorityKeyFor(
  item,
  links,
  conflictingOpenAlex
) {
  const orcid =
    item.identifiers.find(
      identifier =>
        identifier.scheme ===
          "orcid"
    )?.value ||
    null;

  const openalex =
    item.identifiers.find(
      identifier =>
        identifier.scheme ===
          "openalex-author"
    )?.value ||
    null;

  if (orcid) {
    return {
      kind: "orcid",
      value: orcid
    };
  }

  if (
    openalex &&
    !conflictingOpenAlex.has(
      openalex
    )
  ) {
    const linked =
      [...(
        links.get(openalex) ||
        []
      )];

    if (linked.length === 1) {
      return {
        kind: "orcid",
        value: linked[0]
      };
    }

    return {
      kind: "openalex-author",
      value: openalex
    };
  }

  return null;
}


function authorityId(key) {
  return (
    "authority:" +
    key.kind +
    ":" +
    key.value
  );
}


function identifierObject(
  scheme,
  value
) {
  return {
    scheme,
    rawValue:
      scheme === "orcid"
        ? "https://orcid.org/" +
          value
        : "https://openalex.org/A" +
          value,
    normalizedValue:
      value,
    status:
      "asserted",
    source:
      scheme === "orcid"
        ? "ORCID / SearchResponse"
        : "OpenAlex Philosophy / SearchResponse"
  };
}


function affiliationObject(
  institution,
  sources
) {
  return {
    institution,
    status:
      "asserted",
    sources:
      uniqueStrings(
        sources
      )
  };
}


function sortIdentifiers(
  identifiers
) {
  return [...identifiers]
    .sort((left, right) =>
      (
        left.scheme === "orcid"
          ? 0
          : 1
      ) -
        (
          right.scheme === "orcid"
            ? 0
            : 1
        ) ||
      left.normalizedValue
        .localeCompare(
          right.normalizedValue
        )
    );
}


export function buildResearchAtlasIdentityAuthorityGraph(
  searchResponse
) {
  const observations =
    observationsFromResponse(
      searchResponse
    );

  const links =
    openAlexOrcidLinks(
      observations
    );

  const conflictingOpenAlex =
    new Set(
      [...links.entries()]
        .filter(([, values]) =>
          values.size > 1
        )
        .map(([openalex]) =>
          openalex
        )
    );

  const groups =
    new Map();

  let unresolvedWithoutIdentifier =
    0;

  let unresolvedConflicts =
    0;

  for (const item of observations) {
    const key =
      authorityKeyFor(
        item,
        links,
        conflictingOpenAlex
      );

    if (!key) {
      if (
        item.identifiers
          .some(identifier =>
            identifier.scheme ===
              "openalex-author" &&
            conflictingOpenAlex.has(
              identifier.value
            )
          )
      ) {
        unresolvedConflicts += 1;
      } else {
        unresolvedWithoutIdentifier += 1;
      }

      continue;
    }

    const id =
      authorityId(key);

    if (!groups.has(id)) {
      groups.set(
        id,
        {
          id,
          key,
          names: [],
          identifiers:
            new Map(),
          affiliations:
            new Map(),
          providers:
            new Set(),
          workRefs:
            new Set()
        }
      );
    }

    const group =
      groups.get(id);

    group.names.push(
      item.name
    );

    group.workRefs
      .add(
        item.workIdentity
      );

    for (
      const provider of
      item.providers
    ) {
      group.providers
        .add(provider);
    }

    for (
      const identifier of
      item.identifiers
    ) {
      if (
        identifier.scheme ===
          "openalex-author" &&
        conflictingOpenAlex.has(
          identifier.value
        )
      ) {
        continue;
      }

      const registryKey =
        identifier.scheme +
        ":" +
        identifier.value;

      group.identifiers
        .set(
          registryKey,
          identifierObject(
            identifier.scheme,
            identifier.value
          )
        );
    }

    if (
      key.kind === "orcid"
    ) {
      const registryKey =
        "orcid:" +
        key.value;

      group.identifiers
        .set(
          registryKey,
          identifierObject(
            "orcid",
            key.value
          )
        );
    }

    for (
      const institution of
      item.affiliations
    ) {
      const normalized =
        normalizedName(
          institution
        );

      if (!normalized) {
        continue;
      }

      const current =
        group.affiliations
          .get(normalized) || {
            institution,
            sources:
              new Set()
          };

      for (
        const provider of
        item.providers
      ) {
        current.sources
          .add(provider);
      }

      if (item.orcid) {
        current.sources
          .add("ORCID");
      }

      group.affiliations
        .set(
          normalized,
          current
        );
    }
  }

  const authorities =
    [...groups.values()]
      .map(group => {
        const name =
          canonicalName(
            group.names
          );

        const aliases =
          uniqueStrings(
            group.names
          )
            .sort((left, right) =>
              normalizedName(left)
                .localeCompare(
                  normalizedName(
                    right
                  )
                )
            );

        return {
          id:
            group.id,
          canonicalName:
            name,
          resolutionState:
            "confirmed",
          externalIdentifiers:
            sortIdentifiers([
              ...group.identifiers
                .values()
            ]),
          names:
            aliases.map(value => ({
              value,
              type:
                normalizedName(value) ===
                normalizedName(name)
                  ? "canonical"
                  : "alias"
            })),
          affiliations:
            [...group.affiliations
              .values()]
              .map(item =>
                affiliationObject(
                  item.institution,
                  [...item.sources]
                )
              )
              .sort((left, right) =>
                normalizedName(
                  left.institution
                ).localeCompare(
                  normalizedName(
                    right.institution
                  )
                )
              ),
          sourceProviders:
            [...group.providers]
              .sort(),
          knownWorkRefs:
            [...group.workRefs]
              .sort(),
          lastEvaluatedInRevision:
            RESEARCH_ATLAS_IDENTITY_REVISION
        };
      })
      .sort((left, right) =>
        left.id.localeCompare(
          right.id
        )
      );

  const identifierRegistry = {};

  for (const authority of authorities) {
    for (
      const identifier of
      authority.externalIdentifiers
    ) {
      identifierRegistry[
        identifier.scheme +
        ":" +
        identifier.normalizedValue
      ] =
        authority.id;
    }
  }

  const orcidAuthorities =
    authorities.filter(authority =>
      authority.externalIdentifiers
        .some(identifier =>
          identifier.scheme ===
            "orcid"
        )
    ).length;

  const affiliations =
    authorities.reduce(
      (sum, authority) =>
        sum +
        authority.affiliations
          .length,
      0
    );

  return {
    authorityGraph: {
      schemaVersion:
        "author-authority-graph-v1",
      buildRevision:
        RESEARCH_ATLAS_IDENTITY_REVISION,
      datasetRevision:
        "query-scoped-search-response",
      authorities,
      mentions: [],
      sourceRecords: [],
      mentionAuthorityLinks: [],
      identifierRegistry,
      candidateRegistry: {},
      decisionLedger: {
        decisions: []
      },
      buildMetrics: {
        observations:
          observations.length,
        authorities:
          authorities.length,
        orcidAuthorities,
        openAlexOnlyAuthorities:
          authorities.length -
          orcidAuthorities,
        affiliations,
        unresolvedWithoutIdentifier,
        unresolvedConflicts,
        conflictingOpenAlexIds:
          [...conflictingOpenAlex]
            .sort()
      }
    },
    diagnostics: {
      revision:
        RESEARCH_ATLAS_IDENTITY_REVISION,
      observations:
        observations.length,
      authorities:
        authorities.length,
      orcidAuthorities,
      openAlexOnlyAuthorities:
        authorities.length -
        orcidAuthorities,
      affiliations,
      unresolvedWithoutIdentifier,
      unresolvedConflicts,
      conflictingOpenAlexIds:
        [...conflictingOpenAlex]
          .sort()
    }
  };
}

import {
  looksLikeAuthorQuery,
  normalizeAuthorName,
  resolveRemoteAuthors
} from "./remote-author-resolution.js?v=20261113-orcid-author-resolution-v1";

import {
  resolveFederatedAuthor
} from "./crossref-author-fallback.js?v=20261113-orcid-author-resolution-v1";

import {
  normalizedAuthorOrcid
} from "./author-provenance.js?v=20261112-author-orcid-v1";


export const SEARCH_AUTHOR_IDENTITY_REVISION =
  "2026-11-13.strict-orcid-author-v1";


function authorLikeCapitalization(value) {
  const words = String(value || "")
    .trim()
    .split(/s+/)
    .filter(Boolean);

  if (words.length < 2) {
    return false;
  }

  const capitalized = words.filter(word =>
    /^[A-ZÁÉÍÓÚÜÑ]/u.test(word)
  ).length;

  return capitalized / words.length >= 0.66;
}


function likelyNamedPersonQuery(
  query,
  primary
) {
  if (!looksLikeAuthorQuery(query)) {
    return false;
  }

  if (
    [
      "resolved",
      "ambiguous",
      "multiple"
    ].includes(primary?.status)
  ) {
    return true;
  }

  const tokens =
    normalizeAuthorName(query)
      .split(" ")
      .filter(Boolean);

  return (
    tokens.length >= 3 ||
    authorLikeCapitalization(query)
  );
}


function exactFederatedIdentity(
  federated
) {
  return Boolean(
    federated?.status === "resolved" &&
    (federated.works || []).some(work =>
      work?.authorIdentity?.exact === true
    )
  );
}


function identityAliases(
  ...values
) {
  const seen = new Set();
  const output = [];

  for (const value of values.flat()) {
    const clean =
      String(value || "").trim();

    const key =
      normalizeAuthorName(clean);

    if (!clean || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(clean);
  }

  return output;
}


function strictResult(
  resolution,
  {
    evidence = null,
    federated = null
  } = {}
) {
  return {
    ...resolution,
    identitySearchStrict:
      true,
    identityEvidence:
      evidence ||
      resolution?.identityEvidence ||
      null,
    federatedIdentity:
      federated
        ? {
            status:
              federated.status,
            resolution:
              federated.resolution ||
              null,
            orcid:
              normalizedAuthorOrcid(
                federated.author?.orcid
              ),
            sources:
              federated.author
                ?.catalogSources ||
              []
          }
        : resolution?.federatedIdentity ||
          null
  };
}


export async function resolveSearchAuthorIdentity(
  query,
  {
    signal,
    canonicalNames = [],
    remoteImpl =
      resolveRemoteAuthors,
    federatedImpl =
      resolveFederatedAuthor,
    federatedOptions = {}
  } = {}
) {
  const primary =
    await remoteImpl(
      query,
      {
        signal,
        canonicalNames
      }
    );

  if (
    primary?.status ===
      "multiple"
  ) {
    return strictResult(
      primary,
      {
        evidence:
          "multiple-author-resolution"
      }
    );
  }

  const primaryOrcid =
    normalizedAuthorOrcid(
      primary?.author?.orcid
    );

  if (
    primary?.status ===
      "resolved" &&
    primaryOrcid
  ) {
    return strictResult(
      primary,
      {
        evidence:
          "resolved-author-orcid"
      }
    );
  }

  if (
    !likelyNamedPersonQuery(
      query,
      primary
    )
  ) {
    return {
      ...primary,
      identitySearchStrict:
        false
    };
  }

  let federated = null;

  try {
    federated =
      await federatedImpl(
        query,
        {
          signal,
          limit:
            80,
          ...federatedOptions
        }
      );
  } catch (error) {
    if (
      signal?.aborted ||
      error?.name ===
        "AbortError"
    ) {
      throw error;
    }
  }

  const federatedOrcid =
    normalizedAuthorOrcid(
      federated?.author?.orcid
    );

  const federatedExact =
    exactFederatedIdentity(
      federated
    );

  if (
    federated?.status ===
      "resolved" &&
    federatedOrcid &&
    federatedExact
  ) {
    if (
      primary?.status ===
        "resolved"
    ) {
      return strictResult(
        {
          ...primary,
          author: {
            ...primary.author,
            orcid:
              "https://orcid.org/" +
              federatedOrcid,
            aliases:
              identityAliases(
                primary.author?.aliases ||
                  [],
                federated.author?.aliases ||
                  [],
                primary.author
                  ?.displayName,
                federated.author
                  ?.displayName,
                query
              )
          },
          works:
            (
              primary.works ||
              []
            ).length
              ? primary.works
              : federated.works ||
                []
        },
        {
          evidence:
            "federated-exact-orcid",
          federated
        }
      );
    }

    return strictResult(
      federated,
      {
        evidence:
          "federated-exact-orcid",
        federated
      }
    );
  }

  if (
    primary?.status ===
      "resolved"
  ) {
    return strictResult(
      primary,
      {
        evidence:
          "resolved-author-no-orcid",
        federated
      }
    );
  }

  if (
    primary?.status ===
      "ambiguous"
  ) {
    return strictResult(
      primary,
      {
        evidence:
          "ambiguous-author",
        federated
      }
    );
  }

  if (
    federated?.status ===
      "resolved"
  ) {
    return strictResult(
      federated,
      {
        evidence:
          federatedExact
            ? "federated-exact-name"
            : "federated-author",
        federated
      }
    );
  }

  return {
    ...primary,
    identitySearchStrict:
      false,
    federatedIdentity:
      federated
        ? {
            status:
              federated.status,
            resolution:
              federated.resolution ||
              null,
            orcid:
              federatedOrcid,
            sources:
              federated.author
                ?.catalogSources ||
              []
          }
        : null
  };
}

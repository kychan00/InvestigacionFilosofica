import {
  assertRelatedWorkEdge
} from "./related-work-contract.js";


export const RELATED_WORK_INDEX_SCHEMA_VERSION =
  "related-work-index-v1";


export function compactNeighborToRelatedWorkEdge(
  seed,
  neighbor
) {
  const seedIdentity =
    String(seed?.s || "");

  const seedVectorId =
    Number(seed?.v);

  const targetIdentity =
    String(neighbor?.t || "");

  const targetVectorId =
    Number(neighbor?.v);

  const relationTypes =
    Array.isArray(
      neighbor?.r
    )
      ? [...neighbor.r]
      : [];

  const compactEvidence =
    (
      neighbor?.e &&
      typeof neighbor.e === "object" &&
      !Array.isArray(neighbor.e)
    )
      ? neighbor.e
      : {};

  const evidence = [];
  const reasons = [];
  const signals = {};


  if (
    relationTypes.includes(
      "semantic-affinity"
    )
  ) {
    const semanticScore =
      Number(
        compactEvidence.semanticScore ??
        neighbor?.s
      );

    const observedVectorId =
      Number(
        neighbor?.o ??
        targetVectorId
      );

    const semanticEvidenceId =
      `semantic:${seedVectorId}:${targetVectorId}`;

    evidence.push({
      id:
        semanticEvidenceId,

      class:
        "semantic",

      strength:
        semanticScore >= 0.8
          ? "strong"
          : "supporting",

      source:
        "qwen3-browser-static-v4",

      semanticScore,

      observedVectorId
    });

    reasons.push({
      code:
        "semantic-affinity",

      relationType:
        "semantic-affinity",

      evidenceRefs: [
        semanticEvidenceId
      ]
    });

    signals.semantic =
      semanticScore;
  }


  if (
    relationTypes.includes(
      "shared-topic"
    )
  ) {
    const topicIds =
      Array.isArray(
        compactEvidence.topicIds
      )
        ? compactEvidence.topicIds
        : [];

    const topicEvidenceId =
      `topic:${seedVectorId}:${targetVectorId}`;

    evidence.push({
      id:
        topicEvidenceId,

      class:
        "contextual",

      strength:
        "supporting",

      source:
        "openalex-philosophy-metadata",

      topicIds
    });

    reasons.push({
      code:
        "shared-topic",

      relationType:
        "shared-topic",

      evidenceRefs: [
        topicEvidenceId
      ]
    });

    signals.topic =
      1;
  }


  if (
    relationTypes.includes(
      "same-author"
    )
  ) {
    const authorityRefs =
      Array.isArray(
        compactEvidence.authorityRefs
      )
        ? compactEvidence.authorityRefs
        : [];

    const authorEvidenceId =
      `author:${seedVectorId}:${targetVectorId}`;

    evidence.push({
      id:
        authorEvidenceId,

      class:
        "bibliographic",

      strength:
        "strong",

      source:
        "author-authority-graph-v1",

      structuredIdentity:
        true,

      authorityRefs
    });

    reasons.push({
      code:
        "same-author",

      relationType:
        "same-author",

      evidenceRefs: [
        authorEvidenceId
      ]
    });

    signals.author =
      1;
  }


  if (
    relationTypes.includes(
      "shared-coauthor"
    )
  ) {
    const sharedAuthorityRefs =
      Array.isArray(
        compactEvidence.sharedAuthorityRefs
      )
        ? compactEvidence.sharedAuthorityRefs
        : [];

    const coauthorEvidenceId =
      `coauthor:${seedVectorId}:${targetVectorId}`;

    evidence.push({
      id:
        coauthorEvidenceId,

      class:
        "bibliographic",

      strength:
        "strong",

      source:
        "author-authority-graph-v1",

      structuredIdentity:
        true,

      sharedAuthorityRefs
    });

    reasons.push({
      code:
        "shared-coauthor",

      relationType:
        "shared-coauthor",

      evidenceRefs: [
        coauthorEvidenceId
      ]
    });

    signals.coauthor =
      1;
  }


  const edge = {
    schemaVersion:
      "related-work-v1",

    id:
      `rw:${seedVectorId}:${targetVectorId}`,

    seed: {
      identity:
        seedIdentity
    },

    target: {
      identity:
        targetIdentity
    },

    relationTypes,

    signals,

    evidence,
    reasons,

    identity: {
      sameIntellectualWork:
        false
    }
  };


  return assertRelatedWorkEdge(
    edge
  );
}

export function validateCompactRelatedWorkSeed(
  seed
) {
  const errors = [];

  if (
    !seed ||
    typeof seed !== "object" ||
    Array.isArray(seed)
  ) {
    return {
      ok:
        false,

      errors: [
        "seed:not-object"
      ]
    };
  }

  if (
    !String(seed.s || "")
      .trim()
  ) {
    errors.push(
      "seed:identity-required"
    );
  }

  if (
    !Number.isInteger(
      Number(seed.v)
    ) ||
    Number(seed.v) < 0
  ) {
    errors.push(
      "seed:vector-id-invalid"
    );
  }


  const neighbors =
    Array.isArray(seed.n)
      ? seed.n
      : null;

  if (!neighbors) {
    errors.push(
      "seed:neighbors-required"
    );

    return {
      ok:
        false,

      errors
    };
  }


  const seen =
    new Set();

  for (
    const neighbor of
    neighbors
  ) {
    const target =
      String(
        neighbor?.t ||
        ""
      );

    if (!target) {
      errors.push(
        "neighbor:identity-required"
      );

      continue;
    }

    if (
      target ===
      seed.s
    ) {
      errors.push(
        "neighbor:self-forbidden"
      );
    }

    if (
      seen.has(target)
    ) {
      errors.push(
        "neighbor:duplicate:" +
        target
      );
    }

    seen.add(target);

    const targetVectorId =
      Number(
        neighbor?.v
      );

    if (
      !Number.isInteger(
        targetVectorId
      ) ||
      targetVectorId < 0
    ) {
      errors.push(
        "neighbor:vector-id-invalid"
      );
    }

    const observedVectorId =
      Number(
        neighbor?.o ??
        neighbor?.v
      );

    if (
      !Number.isInteger(
        observedVectorId
      ) ||
      observedVectorId < 0
    ) {
      errors.push(
        "neighbor:observed-vector-id-invalid"
      );
    }

    try {
      compactNeighborToRelatedWorkEdge(
        seed,
        neighbor
      );
    } catch (error) {
      errors.push(
        "neighbor:contract:" +
        (
          error instanceof Error
            ? error.message
            : String(error)
        )
      );
    }
  }


  return {
    ok:
      errors.length === 0,

    errors
  };
}


export async function relationShardNumber(
  identity,
  {
    shardCount = 256,
    cryptoImpl =
      globalThis.crypto
  } = {}
) {
  if (
    !Number.isInteger(shardCount) ||
    shardCount < 1 ||
    shardCount > 256
  ) {
    throw new RangeError(
      "shardCount must be between 1 and 256"
    );
  }

  const text =
    String(identity || "");

  if (!text) {
    throw new TypeError(
      "identity is required"
    );
  }

  if (
    !cryptoImpl?.subtle
  ) {
    throw new Error(
      "Web Crypto is required for relation shard routing"
    );
  }

  const digest =
    await cryptoImpl.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        text
      )
    );

  return (
    new Uint8Array(
      digest
    )[0] %
    shardCount
  );
}


export async function relationShardPath(
  identity,
  options = {}
) {
  const shard =
    await relationShardNumber(
      identity,
      options
    );

  return (
    "shards/shard-" +
    shard
      .toString(16)
      .padStart(2, "0") +
    ".jsonl.gz"
  );
}

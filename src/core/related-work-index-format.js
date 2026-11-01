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

  const semanticScore =
    Number(
      neighbor?.e?.semanticScore ??
      neighbor?.s ??
      0
    );

  const semanticEvidenceId =
    `semantic:${seedVectorId}:${targetVectorId}`;

  const evidence = [
    {
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

      semanticScore
    }
  ];


  const reasons = [
    {
      code:
        "semantic-affinity",

      relationType:
        "semantic-affinity",

      evidenceRefs: [
        semanticEvidenceId
      ]
    }
  ];


  const topicIds =
    Array.isArray(
      neighbor?.e?.topicIds
    )
      ? neighbor.e.topicIds
      : [];


  if (
    neighbor?.r?.includes(
      "shared-topic"
    ) &&
    topicIds.length
  ) {
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

    relationTypes:
      Array.isArray(neighbor?.r)
        ? [...neighbor.r]
        : [
            "semantic-affinity"
          ],

    signals: {
      semantic:
        semanticScore,

      ...(
        neighbor?.r?.includes(
          "shared-topic"
        )
          ? {
              topic:
                1
            }
          : {}
      )
    },

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

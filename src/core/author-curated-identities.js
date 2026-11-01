import {
  normalizeAuthorName
} from "./remote-author-resolution.js";

/*
 * Small, explicit authority layer for identities that have been verified
 * against institutional/bibliographic sources. This is intentionally
 * conservative: it never infers a second surname from token overlap.
 */
const CURATED_AUTHOR_IDENTITIES = [
  {
    canonicalName: "Dinora Hernández López",
    orcid: "0000-0001-7335-1790",
    aliases: [
      "Dinora Hernández López",
      "Dinora Hernandez Lopez",
      "Dinora Hernández",
      "Dinora Hernandez",
      "Dra Dinora Hernández",
      "Dra. Dinora Hernández"
    ],
    evidence: [
      "Universidad de Guadalajara · CUCSH",
      "ORCID 0000-0001-7335-1790"
    ]
  }
];

function key(value) {
  return normalizeAuthorName(value);
}

export function findCuratedAuthorIdentity(value) {
  const requested = key(value);
  if (!requested) return null;

  const identity = CURATED_AUTHOR_IDENTITIES.find(item =>
    item.aliases.some(alias => key(alias) === requested)
  );

  return identity
    ? {
        ...identity,
        aliases: [...identity.aliases],
        evidence: [...identity.evidence]
      }
    : null;
}

export function curatedAuthorIdentities() {
  return CURATED_AUTHOR_IDENTITIES.map(item => ({
    ...item,
    aliases: [...item.aliases],
    evidence: [...item.evidence]
  }));
}

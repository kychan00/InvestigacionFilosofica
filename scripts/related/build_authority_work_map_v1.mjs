import {
  appendFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve, join} from "node:path";
import {fileURLToPath} from "node:url";


export const AUTHORITY_WORK_MAP_SCHEMA_VERSION =
  "authority-work-map-v1";

export const DEFAULT_AUTHORITY_WORK_MAP_SHARDS =
  256;


function parseArgs(argv) {
  const output = {};

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const value = argv[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key =
      value.slice(2);

    const next =
      argv[index + 1];

    if (
      next &&
      !next.startsWith("--")
    ) {
      output[key] = next;
      index += 1;
    } else {
      output[key] = true;
    }
  }

  return output;
}


async function readJson(path) {
  return JSON.parse(
    await readFile(
      path,
      "utf8"
    )
  );
}


function parseJsonLines(text) {
  return String(text || "")
    .split("\n")
    .map(
      line =>
        line.trim()
    )
    .filter(Boolean)
    .map(
      line =>
        JSON.parse(line)
    );
}


async function sha256File(path) {
  const hash =
    createHash("sha256");

  const buffer =
    await readFile(path);

  hash.update(buffer);

  return hash.digest("hex");
}


function sha256Text(value) {
  return createHash("sha256")
    .update(
      String(value),
      "utf8"
    )
    .digest();
}


function numericSort(
  left,
  right
) {
  const a =
    BigInt(String(left));

  const b =
    BigInt(String(right));

  return a < b
    ? -1
    : a > b
      ? 1
      : 0;
}


function positionRank(value) {
  return ({
    first: 0,
    middle: 1,
    last: 2
  })[
    String(value || "")
      .toLowerCase()
  ] ?? 3;
}


export function normalizeOpenAlexAuthorId(
  value
) {
  return (
    String(value || "")
      .trim()
      .match(
        /(?:^|openalex\.org\/)A?(\d+)$/i
      )?.[1] ||
    null
  );
}


export function normalizeOpenAlexWorkId(
  value
) {
  return (
    String(value || "")
      .trim()
      .match(
        /(?:^|openalex\.org\/)W?(\d+)$/i
      )?.[1] ||
    null
  );
}


export function openAlexWorkIdentity(
  value
) {
  const id =
    normalizeOpenAlexWorkId(
      value
    );

  return id
    ? "openalex:W" + id
    : null;
}


export function authorityWorkShard(
  workIdentity,
  shardCount =
    DEFAULT_AUTHORITY_WORK_MAP_SHARDS
) {
  if (
    !Number.isInteger(
      shardCount
    ) ||
    shardCount < 1 ||
    shardCount > 256
  ) {
    throw new RangeError(
      "shardCount must be between 1 and 256"
    );
  }

  const digest =
    sha256Text(
      workIdentity
    );

  return (
    digest[0] %
    shardCount
  );
}


function compactAuthorityAuthors(
  authors,
  identifierRegistry
) {
  const byAuthority =
    new Map();

  let unresolved = 0;

  for (
    const author of
    Array.isArray(authors)
      ? authors
      : []
  ) {
    const authorId =
      normalizeOpenAlexAuthorId(
        author?.id
      );

    const authorityRef =
      authorId
        ? identifierRegistry[
            "openalex-author:" +
            authorId
          ]
        : null;

    if (!authorityRef) {
      unresolved += 1;
      continue;
    }

    const current =
      byAuthority.get(
        authorityRef
      ) || {
        r:
          authorityRef,
        p:
          new Set(),
        i:
          new Set(),
        c:
          false
      };

    if (author?.p) {
      current.p.add(
        String(author.p)
      );
    }

    current.i.add(
      authorId
    );

    current.c =
      current.c ||
      Boolean(
        author?.r
      );

    byAuthority.set(
      authorityRef,
      current
    );
  }

  const resolved =
    [...byAuthority.values()]
      .map(
        item => ({
          r:
            item.r,

          p:
            [...item.p]
              .sort(
                (left, right) =>
                  positionRank(left) -
                    positionRank(right) ||
                  left.localeCompare(
                    right
                  )
              ),

          i:
            [...item.i]
              .sort(
                numericSort
              ),

          c:
            item.c
        })
      )
      .sort(
        (left, right) =>
          left.r.localeCompare(
            right.r
          )
      );

  return {
    resolved,
    unresolved
  };
}


export function authorityWorkRow(
  sourceRow,
  identifierRegistry
) {
  const identity =
    openAlexWorkIdentity(
      sourceRow?.wid
    );

  if (!identity) {
    throw new TypeError(
      "work-authors row has invalid OpenAlex work id"
    );
  }

  const authors =
    Array.isArray(
      sourceRow?.a
    )
      ? sourceRow.a
      : [];

  const {
    resolved,
    unresolved
  } =
    compactAuthorityAuthors(
      authors,
      identifierRegistry
    );

  return {
    w:
      identity,

    n:
      authors.length,

    u:
      unresolved,

    a:
      resolved
  };
}


function sourceFiles(
  manifest
) {
  return (
    manifest?.files
      ?.work_authors ||
    manifest?.files
      ?.["work-authors"] ||
    []
  );
}


async function verifySourceFile(
  root,
  record
) {
  const path =
    join(
      root,
      record.path
    );

  const info =
    await stat(path);

  if (
    record.size_bytes != null &&
    Number(
      record.size_bytes
    ) !==
      info.size
  ) {
    throw new Error(
      "author-index source size mismatch: " +
      record.path
    );
  }

  if (
    record.sha256 &&
    (
      await sha256File(path)
    ) !==
      record.sha256
  ) {
    throw new Error(
      "author-index source hash mismatch: " +
      record.path
    );
  }

  return path;
}


function shardName(
  shard
) {
  return (
    "shard-" +
    shard
      .toString(16)
      .padStart(
        2,
        "0"
      ) +
    ".jsonl"
  );
}


async function flushBuffer(
  buffers,
  staging,
  shard
) {
  const rows =
    buffers.get(
      shard
    );

  if (!rows?.length) {
    return;
  }

  await appendFile(
    join(
      staging,
      shardName(shard)
    ),
    rows.join("\n") +
      "\n",
    "utf8"
  );

  buffers.set(
    shard,
    []
  );
}


async function appendStagingRow(
  buffers,
  staging,
  shard,
  row,
  flushSize
) {
  const rows =
    buffers.get(
      shard
    ) || [];

  rows.push(
    JSON.stringify(
      row
    )
  );

  buffers.set(
    shard,
    rows
  );

  if (
    rows.length >=
    flushSize
  ) {
    await flushBuffer(
      buffers,
      staging,
      shard
    );
  }
}


async function readStagingRows(
  path
) {
  try {
    return parseJsonLines(
      await readFile(
        path,
        "utf8"
      )
    );
  } catch (error) {
    if (
      error?.code ===
      "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}


export async function buildAuthorityWorkMap({
  authorIndexRoot,
  authorityRoot,
  outputRoot,
  shardCount =
    DEFAULT_AUTHORITY_WORK_MAP_SHARDS,
  buildRevision =
    process.env.GITHUB_SHA ||
    "local-authority-work-map-v1",
  flushSize = 1000
} = {}) {
  if (!authorIndexRoot) {
    throw new TypeError(
      "authorIndexRoot is required"
    );
  }

  if (!authorityRoot) {
    throw new TypeError(
      "authorityRoot is required"
    );
  }

  if (!outputRoot) {
    throw new TypeError(
      "outputRoot is required"
    );
  }

  if (
    !Number.isInteger(
      shardCount
    ) ||
    shardCount < 1 ||
    shardCount > 256
  ) {
    throw new RangeError(
      "shardCount must be between 1 and 256"
    );
  }

  const inputRoot =
    resolve(
      authorIndexRoot
    );

  const graphRoot =
    resolve(
      authorityRoot
    );

  const destination =
    resolve(
      outputRoot
    );

  const inputManifestPath =
    join(
      inputRoot,
      "manifest.json"
    );

  const authorityManifestPath =
    join(
      graphRoot,
      "manifest.json"
    );

  const registryPath =
    join(
      graphRoot,
      "registry.json"
    );

  const [
    inputManifest,
    authorityManifest,
    registry
  ] =
    await Promise.all([
      readJson(
        inputManifestPath
      ),
      readJson(
        authorityManifestPath
      ),
      readJson(
        registryPath
      )
    ]);

  if (
    inputManifest
      ?.schema_version !==
      "remote-author-index-manifest-v1"
  ) {
    throw new Error(
      "Unsupported author-index manifest"
    );
  }

  if (
    authorityManifest
      ?.schemaVersion !==
      "author-authority-batch-manifest-v1"
  ) {
    throw new Error(
      "Unsupported authority batch manifest"
    );
  }

  if (
    registry
      ?.schemaVersion !==
      "author-authority-registry-v1"
  ) {
    throw new Error(
      "Unsupported authority registry"
    );
  }

  const declaredRegistry =
    authorityManifest
      ?.files
      ?.registry;

  if (
    declaredRegistry
      ?.sha256 &&
    (
      await sha256File(
        registryPath
      )
    ) !==
      declaredRegistry.sha256
  ) {
    throw new Error(
      "Authority registry hash mismatch"
    );
  }

  await rm(
    destination,
    {
      recursive:
        true,
      force:
        true
    }
  );

  await mkdir(
    join(
      destination,
      "shards"
    ),
    {
      recursive:
        true
    }
  );

  const staging =
    join(
      destination,
      ".staging"
    );

  await mkdir(
    staging,
    {
      recursive:
        true
    }
  );

  const buffers =
    new Map();

  const counts = {
    worksSeen:
      0,
    worksMapped:
      0,
    worksWithoutConfirmedAuthority:
      0,
    rawAuthorMentions:
      0,
    confirmedAuthorityMentions:
      0,
    unresolvedAuthorMentions:
      0,
    collapsedAuthorityMentions:
      0
  };

  const files =
    sourceFiles(
      inputManifest
    );

  if (!files.length) {
    throw new Error(
      "author-index manifest has no work-authors files"
    );
  }

  for (
    const record of
    files
  ) {
    const path =
      await verifySourceFile(
        inputRoot,
        record
      );

    const rows =
      parseJsonLines(
        await readFile(
          path,
          "utf8"
        )
      );

    for (
      const sourceRow of
      rows
    ) {
      const row =
        authorityWorkRow(
          sourceRow,
          registry
            .identifierRegistry ||
            {}
        );

      counts.worksSeen +=
        1;

      counts.rawAuthorMentions +=
        row.n;

      counts.unresolvedAuthorMentions +=
        row.u;

      counts.confirmedAuthorityMentions +=
        row.a.length;

      counts.collapsedAuthorityMentions +=
        Math.max(
          0,
          row.n -
            row.u -
            row.a.length
        );

      if (!row.a.length) {
        counts.worksWithoutConfirmedAuthority +=
          1;
        continue;
      }

      counts.worksMapped +=
        1;

      const shard =
        authorityWorkShard(
          row.w,
          shardCount
        );

      await appendStagingRow(
        buffers,
        staging,
        shard,
        row,
        flushSize
      );
    }
  }

  for (
    const shard of
    buffers.keys()
  ) {
    await flushBuffer(
      buffers,
      staging,
      shard
    );
  }

  const shardFiles = [];

  for (
    let shard = 0;
    shard < shardCount;
    shard += 1
  ) {
    const stagingPath =
      join(
        staging,
        shardName(shard)
      );

    const rows =
      await readStagingRows(
        stagingPath
      );

    rows.sort(
      (left, right) =>
        left.w.localeCompare(
          right.w
        )
    );

    for (
      let index = 1;
      index < rows.length;
      index += 1
    ) {
      if (
        rows[index - 1].w ===
        rows[index].w
      ) {
        throw new Error(
          "Duplicate work identity in authority work map: " +
          rows[index].w
        );
      }
    }

    const path =
      join(
        destination,
        "shards",
        shardName(shard)
      );

    await writeFile(
      path,
      rows
        .map(
          row =>
            JSON.stringify(
              row
            )
        )
        .join("\n") +
        (
          rows.length
            ? "\n"
            : ""
        ),
      "utf8"
    );

    const info =
      await stat(path);

    shardFiles.push({
      shard,
      path:
        "shards/" +
        shardName(shard),
      rows:
        rows.length,
      sizeBytes:
        info.size,
      sha256:
        await sha256File(
          path
        )
    });
  }

  await rm(
    staging,
    {
      recursive:
        true,
      force:
        true
    }
  );

  const manifest = {
    schemaVersion:
      AUTHORITY_WORK_MAP_SCHEMA_VERSION,

    buildRevision,

    source: {
      authorIndex: {
        manifestSha256:
          await sha256File(
            inputManifestPath
          ),

        version:
          inputManifest
            .version ||
          null,

        source:
          inputManifest
            .source ||
          null
      },

      authorityGraph: {
        manifestSha256:
          await sha256File(
            authorityManifestPath
          ),

        registrySha256:
          await sha256File(
            registryPath
          ),

        buildRevision:
          authorityManifest
            .buildRevision ||
          registry
            .buildRevision ||
          null,

        datasetRevision:
          authorityManifest
            .datasetRevision ||
          registry
            .datasetRevision ||
          null
      }
    },

    partition: {
      method:
        "sha256-first-byte-mod-shard-count",

      shardCount
    },

    counts,

    files: {
      shards:
        shardFiles
    }
  };

  const manifestPath =
    join(
      destination,
      "manifest.json"
    );

  await writeFile(
    manifestPath,
    JSON.stringify(
      manifest,
      null,
      2
    ) +
      "\n",
    "utf8"
  );

  return {
    outputRoot:
      destination,

    manifest,

    manifestSha256:
      await sha256File(
        manifestPath
      )
  };
}


async function main() {
  const args =
    parseArgs(
      process.argv.slice(2)
    );

  const result =
    await buildAuthorityWorkMap({
      authorIndexRoot:
        args["author-index"],

      authorityRoot:
        args.authority,

      outputRoot:
        args.output ||
        "artifacts/authority-work-map-v1",

      shardCount:
        Number(
          args.shards ||
          DEFAULT_AUTHORITY_WORK_MAP_SHARDS
        ),

      buildRevision:
        args["build-revision"] ||
        process.env.GITHUB_SHA ||
        "local-authority-work-map-v1"
    });

  console.log(
    JSON.stringify({
      outputRoot:
        result.outputRoot,

      manifestSha256:
        result.manifestSha256,

      counts:
        result.manifest
          .counts,

      shardFiles:
        result.manifest
          .files
          .shards
          .length
    }, null, 2)
  );
}


const isMain =
  process.argv[1] &&
  resolve(
    process.argv[1]
  ) ===
    fileURLToPath(
      import.meta.url
    );

if (isMain) {
  main().catch(
    error => {
      console.error(
        error
      );

      process.exitCode =
        1;
    }
  );
}

import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {
  dirname,
  resolve
} from "node:path";

import {
  evaluateResearchAtlasEnrichmentReadiness
} from "../../src/core/research-atlas-enrichment-readiness.js";


function parseArgs(
  argv
) {
  const output = {};

  for (
    let index = 0;
    index <
      argv.length;
    index += 1
  ) {
    const value =
      argv[index];

    if (
      !value.startsWith(
        "--"
      )
    ) {
      continue;
    }

    const key =
      value.slice(2);

    const next =
      argv[
        index +
        1
      ];

    if (
      next &&
      !next.startsWith(
        "--"
      )
    ) {
      output[key] =
        next;
      index += 1;
    } else {
      output[key] =
        true;
    }
  }

  return output;
}


const args =
  parseArgs(
    process.argv.slice(
      2
    )
  );

const configPath =
  resolve(
    String(
      args.config ||
      "benchmark/research-atlas/v10/enrichment-readiness.json"
    )
  );

const outputPath =
  resolve(
    String(
      args.output ||
      "artifacts/research-atlas-ra10/readiness-report.json"
    )
  );

const config =
  JSON.parse(
    await readFile(
      configPath,
      "utf8"
    )
  );

const report =
  evaluateResearchAtlasEnrichmentReadiness(
    config
  );

await mkdir(
  dirname(
    outputPath
  ),
  {
    recursive:
      true
  }
);

await writeFile(
  outputPath,
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

if (!report.valid) {
  process.exitCode =
    1;
}

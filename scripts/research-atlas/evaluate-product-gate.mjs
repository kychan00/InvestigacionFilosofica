import {
  readFile,
  writeFile
} from "node:fs/promises";


const core =
  JSON.parse(
    await readFile(
      "artifacts/research-atlas-ra8/core-report.json",
      "utf8"
    )
  );

const browser =
  JSON.parse(
    await readFile(
      "artifacts/research-atlas-ra8/browser-report.json",
      "utf8"
    )
  );


const failures = [
  ...(
    core.failures ||
    []
  )
];


if (
  browser.status !==
  "PASS"
) {
  failures.push(
    "browser product gate failed"
  );
}


const status =
  failures.length
    ? "FAIL"
    : "PASS";


const verdict = {
  schemaVersion:
    "research-atlas-product-verdict-v1",
  revision:
    core.revision,
  generatedAt:
    new Date()
      .toISOString(),
  status,
  eligibleForMainSearchIntegration:
    status ===
    "PASS",
  core: {
    status:
      core.status,
    cases:
      core.cases
  },
  browser: {
    status:
      browser.status,
    measurements:
      browser.measurements
  },
  failures,
  nextStep:
    status ===
    "PASS"
      ? "RA9 may integrate Resultados ⇄ Atlas behind a reversible product toggle."
      : "Keep Research Atlas experimental and address the failing gate before main-search integration."
};


await writeFile(
  "artifacts/research-atlas-ra8/product-verdict.json",
  JSON.stringify(
    verdict,
    null,
    2
  ) +
  "\n"
);


process.stdout.write(
  JSON.stringify(
    verdict,
    null,
    2
  ) +
  "\n"
);


if (
  status !==
  "PASS"
) {
  process.exitCode =
    1;
}

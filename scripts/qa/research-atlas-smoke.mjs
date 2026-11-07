import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {
  chromium
} from "playwright";


const BASE =
  process.env
    .RESEARCH_ATLAS_BASE_URL ||
  "http://127.0.0.1:4173/";

const config =
  JSON.parse(
    await readFile(
      new URL(
        "../../benchmark/research-atlas/v8/product-gate-config.json",
        import.meta.url
      ),
      "utf8"
    )
  );

const thresholds =
  config.thresholds.browser;

await mkdir(
  "artifacts/research-atlas-ra8",
  {
    recursive:
      true
  }
);

const browser =
  await chromium.launch({
    headless:
      true,
    args: [
      "--no-sandbox"
    ]
  });


const measurements = [];


try {
  for (
    const [
      name,
      width,
      height
    ] of [
      [
        "phone-320",
        320,
        844
      ],
      [
        "phone-390",
        390,
        844
      ],
      [
        "tablet",
        768,
        1024
      ],
      [
        "desktop",
        1440,
        920
      ]
    ]
  ) {
    const context =
      await browser
        .newContext({
          viewport: {
            width,
            height
          },
          deviceScaleFactor:
            1,
          isMobile:
            width <
            800,
          hasTouch:
            width <
            800
        });

    const page =
      await context
        .newPage();

    await page.route(
      "**/*",
      route => {
        const url =
          route.request()
            .url();

        if (
          url.startsWith(
            BASE
          )
        ) {
          route.continue();
          return;
        }

        route.abort();
      }
    );

    const started =
      Date.now();

    await page.goto(
      new URL(
        "research-atlas.html?benchmark=1",
        BASE
      ).href,
      {
        waitUntil:
          "domcontentloaded"
      }
    );

    await page.waitForFunction(
      () =>
        document
          .documentElement
          .dataset
          .raBenchmark ===
          "ready"
    );

    await page.waitForFunction(
      () =>
        document
          .querySelector(
            "#ra-direct-count"
          )
          ?.textContent ===
          "50"
    );

    await page.waitForTimeout(
      100
    );

    const elapsed =
      Date.now() -
      started;

    const geometry =
      await page.evaluate(
        () => {
          const rect =
            selector => {
              const element =
                document.querySelector(
                  selector
                );

              if (!element) {
                return null;
              }

              const box =
                element
                  .getBoundingClientRect();

              return {
                left:
                  box.left,
                right:
                  box.right,
                top:
                  box.top,
                bottom:
                  box.bottom,
                width:
                  box.width,
                height:
                  box.height
              };
            };

          return {
            viewport:
              innerWidth,
            scrollWidth:
              document
                .documentElement
                .scrollWidth,
            stage:
              rect(
                "#ra-stage"
              ),
            canvas:
              rect(
                "#ra-canvas"
              ),
            liveQuery:
              rect(
                "#ra-live-query"
              ),
            submit:
              rect(
                "#ra-live-submit"
              ),
            cancel:
              rect(
                "#ra-live-cancel"
              ),
            filter:
              rect(
                "#ra-query"
              ),
            fit:
              rect(
                "#ra-fit"
              ),
            listCount:
              document
                .querySelectorAll(
                  "#ra-node-list button"
                )
                .length,
            directCount:
              document
                .querySelector(
                  "#ra-direct-count"
                )
                ?.textContent,
            benchmarkRenderMs:
              Number(
                document
                  .documentElement
                  .dataset
                  .raBenchmarkRenderMs
              ),
            controlsDisabled:
              [
                ...document
                  .querySelectorAll(
                    "#ra-live-search-form input, #ra-live-search-form select, #ra-live-search-form button"
                  )
              ].every(
                element =>
                  element.disabled
              )
          };
        }
      );

    assert.ok(
      geometry.scrollWidth <=
        geometry.viewport +
        thresholds
          .maximumHorizontalOverflowPx,
      name +
      " horizontal overflow: " +
      JSON.stringify(
        geometry
      )
    );

    assert.ok(
      geometry.stage
        .width >=
        thresholds
          .minimumStageWidthPx,
      name +
      " stage too narrow: " +
      JSON.stringify(
        geometry.stage
      )
    );

    assert.ok(
      geometry.canvas
        .width >=
        thresholds
          .minimumStageWidthPx,
      name +
      " canvas too narrow"
    );

    assert.equal(
      geometry.directCount,
      "50"
    );

    assert.ok(
      geometry.listCount >=
        50,
      name +
      " accessible list lost work nodes"
    );

    assert.equal(
      geometry.controlsDisabled,
      true,
      "benchmark mode must not start live searches"
    );

    assert.ok(
      elapsed <=
        thresholds
          .timeToRenderedAtlasMs,
      name +
      " time-to-render " +
      elapsed +
      "ms exceeds " +
      thresholds
        .timeToRenderedAtlasMs +
      "ms"
    );

    for (
      const key of [
        "liveQuery",
        "submit",
        "cancel",
        "filter",
        "fit"
      ]
    ) {
      const box =
        geometry[key];

      assert.ok(
        box.left >=
          -2 &&
        box.right <=
          geometry.viewport +
          2,
        name +
        " clipped " +
        key +
        ": " +
        JSON.stringify(
          box
        )
      );
    }

    for (
      const key of [
        "submit",
        "cancel",
        "fit"
      ]
    ) {
      assert.ok(
        geometry[key]
          .height >=
          thresholds
            .minimumTapTargetPx,
        name +
        " tap target too small: " +
        key
      );
    }

    await page.locator(
      "#ra-query"
    ).fill(
      "Quine"
    );

    await page.waitForTimeout(
      30
    );

    const filtered =
      Number(
        await page
          .locator(
            "#ra-match-count"
          )
          .innerText()
      );

    assert.ok(
      filtered >
        0 &&
      filtered <
        geometry.listCount,
      name +
      " filter did not reduce visible nodes"
    );

    await page.locator(
      "#ra-query"
    ).fill(
      ""
    );

    const firstNode =
      page.locator(
        "#ra-node-list button"
      ).first();

    await firstNode.click();

    await page.waitForFunction(
      () =>
        document
          .querySelector(
            "#ra-detail"
          )
          ?.textContent
          ?.includes(
            "¿Por qué está aquí?"
          )
    );

    const beforeZoom =
      await page.locator(
        "#ra-zoom-readout"
      ).innerText();

    await page.locator(
      "#ra-zoom-in"
    ).click();

    await page.waitForTimeout(
      30
    );

    const afterZoom =
      await page.locator(
        "#ra-zoom-readout"
      ).innerText();

    assert.notEqual(
      afterZoom,
      beforeZoom
    );

    await page.locator(
      '[data-theme-choice="light"]'
    ).click();

    assert.equal(
      await page
        .locator("html")
        .getAttribute(
          "data-theme"
        ),
      "light"
    );

    await page.screenshot({
      path:
        "artifacts/research-atlas-ra8/" +
        name +
        "-light.png",
      fullPage:
        true,
      animations:
        "disabled"
    });

    await page.locator(
      '[data-theme-choice="dark"]'
    ).click();

    assert.equal(
      await page
        .locator("html")
        .getAttribute(
          "data-theme"
        ),
      "dark"
    );

    await page.screenshot({
      path:
        "artifacts/research-atlas-ra8/" +
        name +
        "-dark.png",
      fullPage:
        true,
      animations:
        "disabled"
    });

    measurements.push({
      name,
      width,
      height,
      elapsedMs:
        elapsed,
      benchmarkRenderMs:
        geometry
          .benchmarkRenderMs,
      scrollWidth:
        geometry.scrollWidth,
      stageWidth:
        geometry.stage
          .width,
      accessibleNodes:
        geometry.listCount,
      filteredNodes:
        filtered
    });

    await context.close();

    process.stdout.write(
      "Research Atlas RA8 PASS: " +
      name +
      " " +
      width +
      "x" +
      height +
      "\n"
    );
  }
} finally {
  await browser.close();
}


const report = {
  schemaVersion:
    "research-atlas-browser-product-gate-report-v1",
  revision:
    config.revision,
  thresholds,
  measurements,
  status:
    "PASS"
};


await writeFile(
  "artifacts/research-atlas-ra8/browser-report.json",
  JSON.stringify(
    report,
    null,
    2
  ) +
  "\n"
);

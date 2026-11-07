import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const BASE =
  process.env.RESEARCH_ATLAS_BASE_URL ||
  "http://127.0.0.1:4173/";

await mkdir(
  "artifacts/research-atlas-controlled-demo",
  {recursive: true}
);

const browser =
  await chromium.launch({
    headless: true,
    args: ["--no-sandbox"]
  });

try {
  for (const [name, width, height] of [
    ["phone", 390, 844],
    ["tablet", 768, 1024],
    ["desktop", 1440, 920]
  ]) {
    const browserContext =
      await browser.newContext({
        viewport: {width, height},
        deviceScaleFactor: 1,
        isMobile: width < 800,
        hasTouch: width < 800
      });

    const page =
      await browserContext.newPage();

    const externalRequests = [];

    page.on(
      "request",
      request => {
        const url =
          request.url();

        if (
          !url.startsWith(
            BASE
          )
        ) {
          externalRequests.push(
            url
          );
        }
      }
    );

    await page.route(
      "**/*",
      route => {
        const url =
          route.request().url();

        if (
          url.startsWith(
            BASE
          )
        ) {
          route.continue();
        } else {
          route.abort();
        }
      }
    );

    await page.goto(
      BASE +
      "research-atlas.html?demo=authority-related",
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
          .raControlledDemo ===
        "ready"
    );

    assert.equal(
      externalRequests.length,
      0,
      name +
      " controlled demo must not make external requests"
    );

    assert.match(
      await page
        .locator(
          ".ra-experimental-note"
        )
        .innerText(),
      /Demo controlado · no producción/
    );

    assert.match(
      await page
        .locator(
          "#ra-status"
        )
        .innerText(),
      /cero consultas externas/
    );

    assert.equal(
      await page
        .locator(
          "#ra-direct-count"
        )
        .innerText(),
      "3"
    );

    assert.equal(
      await page
        .locator(
          "#ra-expanded-count"
        )
        .innerText(),
      "2"
    );

    const nodeCount =
      Number(
        await page
          .locator(
            "#ra-node-count"
          )
          .innerText()
      );

    const edgeCount =
      Number(
        await page
          .locator(
            "#ra-edge-count"
          )
          .innerText()
      );

    assert.ok(
      nodeCount >= 10
    );

    assert.ok(
      edgeCount >= 10
    );

    const pageText =
      await page
        .locator(
          "#ra-node-list"
        )
        .innerText();

    assert.match(
      pageText,
      /Ana Pérez/
    );

    assert.match(
      pageText,
      /José Martínez/
    );

    assert.match(
      pageText,
      /Autonomy after Kant/
    );

    const geometry =
      await page.evaluate(
        () => ({
          viewport:
            innerWidth,
          scrollWidth:
            document.documentElement
              .scrollWidth,
          stage:
            (() => {
              const box =
                document
                  .querySelector(
                    "#ra-stage"
                  )
                  .getBoundingClientRect();

              return {
                left:
                  box.left,
                right:
                  box.right,
                width:
                  box.width,
                height:
                  box.height
              };
            })()
        })
      );

    assert.ok(
      geometry.scrollWidth <=
        geometry.viewport +
        2,
      name +
      " overflow: " +
      JSON.stringify(
        geometry
      )
    );

    assert.ok(
      geometry.stage.left >=
        -2 &&
      geometry.stage.right <=
        geometry.viewport +
        2
    );

    await page
      .locator(
        "#ra-node-list button"
      )
      .filter({
        hasText:
          "Ana Pérez"
      })
      .first()
      .click();

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

    await page.screenshot({
      path:
        "artifacts/research-atlas-controlled-demo/" +
        name +
        ".png",
      fullPage: true,
      animations: "disabled"
    });

    await browserContext.close();

    process.stdout.write(
      "Controlled demo PASS: " +
      name +
      "\n"
    );
  }
} finally {
  await browser.close();
}

import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const BASE =
  process.env.RESEARCH_ATLAS_BASE_URL ||
  "http://127.0.0.1:4173/";

function makeResponse(count = 20) {
  const families = [
    "Freedom and autonomy in Kant",
    "Moral freedom and autonomy after Kant",
    "Logic and ontology in Quine",
    "Ontological commitment and logical form",
    "Aura and reproducibility in Walter Benjamin"
  ];

  const results = Array.from({length: count}, (_, index) => {
    const id = "openalex-W" + String(700000 + index);
    return {
      id,
      title: families[index % families.length] + " " + String(index + 1),
      authors: [{
        id:
          "https://openalex.org/A" +
          String(
            800000 +
            index % 7
          ),
        name:
          "Atlas Author " +
          String(
            index % 7 + 1
          )
      }],
      year: 1990 + index % 30,
      type: "article",
      language: index % 3 === 0 ? "es" : "en",
      doi: null,
      isbn: [],
      topics: [],
      providers: ["OpenAlex Philosophy"],
      sourceRecords: [{
        provider: "OpenAlex Philosophy",
        sourceId: id,
        query: "libertad en Kant",
        rank: index + 1
      }],
      matchedQueries: [{
        query: "libertad en Kant",
        weight: 1,
        type: "original"
      }],
      urls: {},
      institutionalLinks: []
    };
  });

  return {
    query: "libertad en Kant",
    parsed: {},
    expansions: [{
      query: "libertad en Kant",
      weight: 1,
      type: "original"
    }],
    results,
    errors: [],
    stats: {
      appearances: count,
      unique: count,
      merged: 0,
      providers: {"OpenAlex Philosophy": count}
    }
  };
}

await mkdir("artifacts/research-atlas-ra9", {recursive: true});
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"]
});

try {
  for (const [name, width, height] of [
    ["phone", 390, 844],
    ["tablet", 768, 1024],
    ["desktop", 1440, 920]
  ]) {
    const context = await browser.newContext({
      viewport: {width, height},
      deviceScaleFactor: 1,
      isMobile: width < 800,
      hasTouch: width < 800
    });

    const page = await context.newPage();
    const externalRequests = [];
    const allRequests = [];

    page.on("request", request => {
      const url = request.url();
      allRequests.push(url);
      if (!url.startsWith(BASE)) externalRequests.push(url);
    });

    await page.route("**/*", route => {
      const url = route.request().url();
      if (url.startsWith(BASE)) {
        route.continue();
      } else {
        route.abort();
      }
    });

    await page.goto(BASE, {waitUntil: "domcontentloaded"});
    await page.waitForTimeout(250);
    externalRequests.length = 0;

    await page.evaluate(response => {
      document.querySelector("#research-workspace")?.classList.remove("hidden");
      window.dispatchEvent(new CustomEvent("research-atlas:reset", {
        detail: {query: response.query}
      }));
      window.dispatchEvent(new CustomEvent("research-atlas:search-response", {
        detail: {
          response,
          phase: "complete",
          searchMode: "traditional"
        }
      }));
    }, makeResponse(20));

    await page.waitForFunction(() =>
      document.querySelector("#research-atlas-count")?.textContent === "20"
    );

    await page.waitForFunction(() =>
      /autores confirmados/.test(
        document.querySelector("#research-atlas-sync-status")?.textContent || ""
      )
    );

    assert.match(
      await page.locator("#research-atlas-sync-status").innerText(),
      /7 autores confirmados/
    );

    assert.equal(
      await page.locator("#research-view-results").getAttribute("aria-selected"),
      "true"
    );
    assert.equal(
      await page.locator("#research-atlas-panel").evaluate(el => el.classList.contains("hidden")),
      true
    );

    const beforeToggleRequests = externalRequests.length;
    allRequests.length = 0;

    await page.locator("#research-view-atlas").click();
    await page.waitForTimeout(80);

    assert.equal(
      await page.locator("#research-view-atlas").getAttribute("aria-selected"),
      "true"
    );
    assert.equal(
      await page.locator("#research-results-panel").evaluate(el => el.classList.contains("hidden")),
      true
    );
    assert.equal(
      await page.locator("#research-atlas-panel").evaluate(el => el.classList.contains("hidden")),
      false
    );

    assert.equal(
      externalRequests.length,
      beforeToggleRequests,
      "opening Atlas must not create additional external network requests"
    );

    assert.equal(
      allRequests.length,
      0,
      "opening Atlas must not create additional network requests after enrichment settled"
    );

    const geometry = await page.evaluate(() => {
      const rect = selector => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          width: box.width,
          height: box.height
        };
      };
      return {
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        switcher: rect("#research-view-switch"),
        panel: rect("#research-atlas-panel"),
        stage: rect("#research-atlas-stage"),
        canvas: rect("#research-atlas-canvas"),
        listCount: document.querySelectorAll("#research-atlas-list button").length
      };
    });

    assert.ok(
      geometry.scrollWidth <= geometry.viewport + 2,
      name + " horizontal overflow: " + JSON.stringify(geometry)
    );
    for (const key of ["switcher", "panel", "stage", "canvas"]) {
      assert.ok(
        geometry[key].left >= -2 &&
        geometry[key].right <= geometry.viewport + 2,
        name + " clipped " + key + ": " + JSON.stringify(geometry[key])
      );
    }
    assert.ok(geometry.stage.width >= 250);
    assert.ok(geometry.listCount >= 20);

    await page.locator("#research-atlas-filter").fill("Quine");
    await page.waitForTimeout(30);
    const filteredCount = await page.locator("#research-atlas-list button").count();
    assert.ok(filteredCount > 0 && filteredCount < geometry.listCount);

    await page.locator("#research-atlas-filter").fill("");

    const beforeMainFilter = await page.locator("#research-atlas-list button").count();

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("research-atlas:filter-results", {
        detail: {
          visibleIdentityKeys: [
            "openalex:w700000",
            "openalex:w700001",
            "openalex:w700002",
            "openalex:w700003",
            "openalex:w700004"
          ],
          visibleCount: 5,
          totalCount: 20
        }
      }));
    });

    await page.waitForTimeout(30);

    const afterMainFilter = await page.locator("#research-atlas-list button").count();

    assert.ok(
      afterMainFilter > 0 && afterMainFilter < beforeMainFilter,
      name + " main filters must reduce Atlas visibility without a new search"
    );

    assert.match(
      await page.locator("#research-atlas-sync-status").innerText(),
      /5 de 20 obras visibles/
    );

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("research-atlas:filter-results", {
        detail: {
          visibleIdentityKeys: Array.from({length: 20}, (_, index) =>
            "openalex:w" + String(700000 + index)
          ),
          visibleCount: 20,
          totalCount: 20
        }
      }));
    });

    await page.waitForTimeout(30);

    await page.locator("#research-atlas-list button").first().click();
    await page.waitForFunction(() =>
      document.querySelector("#research-atlas-detail")?.textContent?.includes("¿Por qué está aquí?")
    );

    const beforeZoom = await page.locator("#research-atlas-zoom").innerText();
    await page.locator("#research-atlas-zoom-in").click();
    await page.waitForTimeout(30);
    const afterZoom = await page.locator("#research-atlas-zoom").innerText();
    assert.notEqual(afterZoom, beforeZoom);

    await page.locator("#research-view-results").click();
    assert.equal(
      await page.locator("#research-view-results").getAttribute("aria-selected"),
      "true"
    );

    await page.locator("#research-view-atlas").click();
    await page.evaluate(() => document.body.classList.add("author-view"));
    await page.waitForTimeout(30);
    assert.equal(
      await page.locator("#research-view-results").getAttribute("aria-selected"),
      "true"
    );
    await page.evaluate(() => document.body.classList.remove("author-view"));

    await page.screenshot({
      path: "artifacts/research-atlas-ra10/" + name + ".png",
      fullPage: true,
      animations: "disabled"
    });

    await context.close();
    process.stdout.write("RA10 Authority Atlas PASS: " + name + "\n");
  }
} finally {
  await browser.close();
}

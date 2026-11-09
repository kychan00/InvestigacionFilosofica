import { chromium } from "playwright";

const BASE =
  "https://kychan00.github.io/InvestigacionFilosofica/";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"]
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__atlasResponses = [];
    window.addEventListener(
      "research-atlas:search-response",
      event => {
        try {
          window.__atlasResponses.push(
            structuredClone(event.detail)
          );
        } catch {
          window.__atlasResponses.push(
            JSON.parse(JSON.stringify(event.detail))
          );
        }
      }
    );
  });

  await page.goto(BASE, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await page.locator("#search-input").fill("Dinora Hernández");
  await page.locator("#search-form button[type=submit]").click();

  await page.waitForFunction(() => {
    const responses = window.__atlasResponses || [];
    return responses.some(item => item?.phase === "complete");
  }, null, {
    timeout: 180000,
    polling: 500
  });

  const report = await page.evaluate(() => {
    const all = window.__atlasResponses || [];
    const complete = [...all]
      .reverse()
      .find(item => item?.phase === "complete");

    const response = complete?.response || {};
    const resolution = response.authorResolution || null;

    return {
      query: response.query,
      searchMode: complete?.searchMode || null,
      parsed: response.parsed || null,
      authorResolution: resolution,
      resultCount: response.results?.length || 0,
      resultAuthors: (response.results || [])
        .slice(0, 30)
        .map(result => ({
          id: result.id,
          title: result.title,
          authors: (result.authors || []).map(author => ({
            id: author?.id || null,
            name: author?.name || author || null,
            orcid: author?.orcid || null
          }))
        }))
    };
  });

  const normalized = value =>
    String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  const queryName = normalized("Dinora Hernández");

  const matches = report.resultAuthors
    .filter(item =>
      item.authors.some(author =>
        normalized(author.name) === queryName
      )
    );

  console.log(JSON.stringify({
    status: "pass",
    ...report,
    exactAuthorNameMatches: matches.length,
    matchedWorks: matches
  }, null, 2));

  await context.close();
} finally {
  await browser.close();
}

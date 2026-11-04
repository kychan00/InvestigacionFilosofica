/** Browser smoke for new thesis demo (mock 566-record index, no PDF). */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const records = Array.from({ length: 566 }, (_, index) => ({
  id: `thesis:work:demo-${String(index).padStart(5, "0")}`,
  title: index % 2
    ? "Historia cultural y humanidades en la Universidad de Guadalajara"
    : "Fenomenología y lenguaje en la investigación filosófica",
  authors: [index % 2 ? "Juan López" : "María Hernández"],
  directors: ["Ángel Torres"],
  year: 2026 - (index % 15),
  dateQuality: "valid",
  program: index % 2 ? "Maestría en Historia" : "Licenciatura en Filosofía",
  programRef: index % 2 ? "program:udg:historia" : "program:udg:filosofia",
  degree: index % 2 ? "maestria" : "licenciatura",
  unit: "CUCSH",
  abstractExcerpt: "Resumen institucional breve; la tesis se consulta en RIUdeG.",
  keywords: [index % 2 ? "historia" : "fenomenología"],
  sourceUrl: `https://hdl.handle.net/20.500.12104/${84204 + index}`,
  handle: `20.500.12104/${84204 + index}`,
}));

const payload = {
  schemaVersion: "thesis-demo-index-v1",
  sourceRelease: "thesis-effective-corpus-v2",
  totalIncluded: records.length,
  totalCanonical: 27580,
  referenceOnly: true,
  records,
};

const philosophyRecords = Array.from({ length: 18 }, (_, index) => ({
  id: index < 7 ? `thesis:work:ph-${String(index).padStart(5, "0")}` : `philosophy:reference:${String(index).padStart(5, "0")}`,
  canonicalWorkId: index < 7 ? `thesis:work:ph-${String(index).padStart(5, "0")}` : null,
  title: index < 9 ? `Tesis de programa filosófico ${index}` : index < 15 ? `Cruce filosófico sobre Ricoeur y tecnología ${index}` : index === 15 ? "Curaduría manual de Filosofía" : `Referencia filosófica en revisión ${index}`,
  authors: [`Autora Filosófica ${index}`],
  directors: [],
  year: 2025 - index,
  dateQuality: "valid",
  program: index < 6 ? "Licenciatura en Filosofía" : index < 9 ? "Maestría en Estudios Filosóficos" : "Maestría en Tecnologías para el Aprendizaje",
  programRef: index < 6 ? "program:udg:lic-filosofia" : index < 9 ? "program:udg:mae-estudios-filosoficos" : null,
  degree: index < 6 ? "licenciatura" : "maestria",
  unit: index < 9 ? "CUCSH" : "CUCEA",
  abstractExcerpt: "",
  keywords: [],
  sourceUrl: `https://hdl.handle.net/20.500.12104/${95000 + index}`,
  handle: `20.500.12104/${95000 + index}`,
  philosophyStatus: index >= 16 ? "review" : "include",
  philosophyRole: index < 9 ? "program-core" : index < 15 ? "philosophical-content" : index === 15 ? "curated-manual-classification" : "program-core-candidate",
  classificationSource: index >= 16 ? "secondary-discovery" : "human-curation",
  philosophyEvidence: "Evidencia filosófica explícita para la fixture de navegador.",
  validationTier: "fixture",
  sourceKind: "fixture",
  sourceLabel: "Repositorio institucional UdeG",
  evidenceUrls: [],
}));

const philosophyPayload = {
  schemaVersion: "thesis-philosophy-public-index-v1",
  revision: "2026-11-04.t2ci-v1",
  sourceRelease: "thesis-effective-corpus-v2",
  referenceOnly: true,
  canonicalAdmissionMutation: false,
  preserveActualProgram: true,
  doctoralPolicy: { exactDoctorateProgramPresent: false },
  documentedPhilosophyPrograms: [
    { programRef: "program:udg:lic-filosofia", name: "Licenciatura en Filosofía", records: 6, include: 5, review: 1 },
    { programRef: "program:udg:mae-estudios-filosoficos", name: "Maestría en Estudios Filosóficos", records: 3, include: 2, review: 1 },
    { programRef: "program:udg:mae-filosofia-historica", name: "Maestría en Filosofía", records: 2, include: 2, review: 0 },
  ],
  metrics: {
    records: 18,
    byStatus: { include: 16, review: 2 },
    byRole: { "program-core": 9, "philosophical-content": 6, "curated-manual-classification": 1, "program-core-candidate": 2 },
    actualProgramsRepresented: 10,
  },
  actualProgramsRepresented: ["Licenciatura en Filosofía", "Maestría en Estudios Filosóficos", "Maestría en Filosofía", "Maestría en Tecnologías para el Aprendizaje"],
  records: philosophyRecords,
};

await mkdir("artifacts/thesis-demo-ui", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});

try {
  for (const [name, width, height] of [
    ["phone", 390, 844],
    ["tablet", 820, 1180],
    ["desktop", 1440, 900],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.route("**/data/theses/demo-v1/index.json", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    }));
    await page.route("**/data/theses/philosophy-v1/index.json", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(philosophyPayload),
    }));
    await page.goto(new URL("tesis.html", BASE).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() =>
      document.querySelector("#thesis-total")?.textContent === "566"
    );
    assert.equal(await page.locator(".td-result").count(), 12);
    assert.match(await page.locator("#thesis-summary").innerText(), /566/);
    assert.equal(await page.locator("#thesis-canonical-total").innerText(), "27,580");
    const initialWidth = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(initialWidth.scroll <= initialWidth.viewport + 2,
      `${name} horizontal overflow: ${JSON.stringify(initialWidth)}`);

    await page.locator("#thesis-query").fill("fenomenologia");
    assert.equal(await page.locator("#thesis-count").innerText(), "283");
    await page.locator("#thesis-query").fill("");
    await page.locator("#thesis-program").selectOption("Maestría en Historia");
    assert.equal(await page.locator("#thesis-count").innerText(), "283");
    await page.locator("#thesis-clear").click();
    assert.equal(await page.locator("#thesis-count").innerText(), "566");

    await page.locator('[data-thesis-scope="philosophy"]').click();
    await page.waitForFunction(() => document.querySelector("#thesis-count")?.textContent === "18");
    assert.equal(await page.locator(".td-program-card").count(), 3);
    assert.match(await page.locator("#thesis-scope-tag").innerText(), /16 INCLUDE · 2 REVIEW/);
    assert.equal(await page.locator("#thesis-total-label").innerText(), "Referencias filosóficas");
    await page.locator("#thesis-philosophy-role").selectOption("philosophical-content");
    assert.equal(await page.locator("#thesis-count").innerText(), "6");
    await page.locator("#thesis-philosophy-role").selectOption("review");
    assert.equal(await page.locator("#thesis-count").innerText(), "2");
    assert.equal(await page.locator(".td-result-review").count(), 2);
    await page.locator("#thesis-clear").click();
    assert.equal(await page.locator("#thesis-count").innerText(), "18");

    await page.locator(".td-result details summary").first().click();
    assert.equal(await page.locator(".td-result details[open]").count(), 1);
    const href = await page.locator(".td-primary-action[href]").first().getAttribute("href");
    assert.match(href, /^https:\/\/hdl\.handle\.net\//);
    assert.doesNotMatch(href, /\.pdf(?:\?|$)/i);

    await page.locator('[data-theme-choice="light"]').click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    await page.screenshot({ path: `artifacts/thesis-demo-ui/${name}-light.png`, fullPage: true });
    await page.locator('[data-theme-choice="dark"]').click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    const measured = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(measured.scroll <= measured.viewport + 2,
      `${name} dark overflow: ${JSON.stringify(measured)}`);
    await page.screenshot({ path: `artifacts/thesis-demo-ui/${name}-dark.png`, fullPage: true });
    await context.close();
    console.log(`Thesis demo UI PASS: ${name}, ${width} x ${height}`);
  }
} finally {
  await browser.close();
}

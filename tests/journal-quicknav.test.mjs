import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const journals = [
  { slug: "protrepsis", page: "protrepsis", explorer: "pro" },
  { slug: "sincronia", page: "sincronia", explorer: "sn" },
  { slug: "quadripartita", page: "quadripartita-ratio", explorer: "qr" }
];

for (const { slug, page, explorer } of journals) {
  test(slug + ": la barra aparece en archivo y ficha institucional", async () => {
    for (const suffix of ["", "-institucional"]) {
      const html = await readFile(`revistas/udg/${page}${suffix}.html`, "utf8");
      assert.match(html, /css\/journal-quicknav\.css\?v=/);
      assert.match(html, /js\/journal-quicknav\.js\?v=/);
      assert.match(html, /class="site-mobile-toolbar"/);
    }
  });

  test(slug + ": los accesos directos tienen destinos existentes", async () => {
    const archive = await readFile(`revistas/udg/${page}.html`, "utf8");
    const profile = await readFile(`revistas/udg/${page}-institucional.html`, "utf8");

    for (const id of [
      "inicio", "journal-archive-panel", "journal-atlas-panel",
      "journal-insights-panel",
      `${explorer}-explorer-topics`,
      `${explorer}-explorer-issues`,
      `${explorer}-explorer-filters`
    ]) {
      assert.ok(archive.includes(`id="${id}"`), `${slug}: no existe #${id} en el archivo`);
    }
    for (const id of ["inicio", "historia", "equipo", "contacto", "fuentes"]) {
      assert.ok(profile.includes(`id="${id}"`), `${slug}: no existe #${id} en la ficha`);
    }
    for (const view of ["archive", "atlas", "insights"]) {
      assert.ok(archive.includes(`data-journal-view="${view}"`));
    }
    for (const mode of ["topics", "issues", "filters"]) {
      assert.ok(archive.includes(`data-${explorer}-explorer-tab="${mode}"`));
    }
  });
}

test("componente común conserva vínculos locales y controles accesibles", async () => {
  const js = await readFile("js/journal-quicknav.js", "utf8");
  const css = await readFile("css/journal-quicknav.css", "utf8");
  const controller = await readFile("js/journal-page.js", "utf8");

  assert.match(js, /Navegación rápida de /);
  assert.match(js, /aria-label="Cambiar de revista"/);
  assert.match(js, /data-quicknav-id/);
  assert.match(js, /journal\.profile/);
  assert.match(js, /journal\.page/);
  assert.match(js, /history\.pushState/);
  assert.match(js, /addEventListener\("popstate"/);
  assert.match(js, /journal-atlas-panel/);
  assert.match(js, /\?\.click\(\)/);
  assert.match(js, /prefers-reduced-motion/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /position: sticky/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(controller, /if \(view === "atlas" && state\.records\.length\) buildAtlas\(\)/);
  assert.match(controller, /if \(state\.view === "atlas"\) buildAtlas\(\)/);
});

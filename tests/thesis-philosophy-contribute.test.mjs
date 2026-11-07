import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../tesis.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../js/thesis-demo.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/thesis-demo.css", import.meta.url), "utf8");

test("Philosophy contribution panel is present and hidden outside Philosophy scope", () => {
  assert.match(
    html,
    /<section id="philosophy-contribute"[^>]*hidden>/,
  );
  assert.match(
    js,
    /const philosophyContribute = document\.querySelector\("#philosophy-contribute"\);/,
  );
  assert.match(
    js,
    /philosophyContribute\.hidden = !udgPhilosophy;/,
  );
});

test("graduate routes point only to official UdeG surfaces", () => {
  const required = [
    "https://www.riudg.udg.mx/info/publicar.jsp",
    "https://www.riudg.udg.mx/info/acercaRIUdeG.jsp",
    "https://bibliotecas.udg.mx/Red-de-Bibliotecas/Centros-Universitarios-Tematicos/CUCSH/Biblioteca-Central-Dr-Manuel-RodrIguez-Lapuente",
    "https://www.cucsh.udg.mx/directorio/nalliely-hernandez-cornejo-0",
  ];
  for (const url of required) assert.ok(html.includes(url), url);
  assert.match(html, /bibliotecadigital@redudg\.udg\.mx/);
  assert.match(html, /rodolfog@csh\.udg\.mx/);
  assert.match(html, /nalliely\.hernandez@academicos\.udg\.mx/);
});

test("protest note preserves absence-vs-nonexistence distinction", () => {
  assert.match(html, /NOTA DE PROTESTA BIBLIOGRÁFICA/);
  assert.match(html, /No confundimos ausencia digital con inexistencia\./);
  assert.match(html, /problema de preservación, catalogación y acceso/);
  assert.match(html, /no atribuye la carencia a una persona o dependencia concreta/);
});

test("contribution panel is reference-only and does not invite uploads to this site", () => {
  assert.match(html, /Este buscador no recibe ni aloja tesis\./);
  assert.doesNotMatch(html, /<input[^>]+type="file"/i);
  assert.doesNotMatch(html, /<form[^>]+upload/i);
});

test("T2DE panel has responsive styles", () => {
  assert.match(css, /\.td-philosophy-contribute\s*\{/);
  assert.match(css, /\.td-contact-grid\s*\{/);
  assert.match(css, /\.td-protest-note\s*\{/);
  assert.match(css, /grid-template-columns:\s*repeat\(3,/);
});

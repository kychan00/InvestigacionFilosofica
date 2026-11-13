import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  journalArticleAbstract,
  journalArticleSheet,
  journalArticleSourceUrl,
  safeJournalExternalUrl
} from "../js/journal-atlas-article-sheet.js";

const article = {
  title: "Lenguaje, verdad y razón",
  journal: "Protrepsis",
  year: 2011,
  date: "2011-05-09",
  doi: "10.32870/prot.i1.11",
  authors: [{name:"Ana Gutiérrez"}, {name:"Luis Pérez"}],
  language: "es",
  abstract: "Una investigación acerca de la verdad y el lenguaje.\n\nLa conclusión invita al diálogo.",
  subjects: ["Verdad", "Lenguaje"],
  urls: { canonical: "http://protrepsis.cucsh.udg.mx/index.php/prot/article/view/11" }
};

test("el abstract completo está visible, documentado y conserva párrafos", () => {
  const html = journalArticleAbstract(article);
  assert.match(html, /RESUMEN \/ ABSTRACT/);
  assert.match(html, /Una investigación acerca de la verdad y el lenguaje/);
  assert.match(html, /La conclusión invita al diálogo/);
  assert.equal((html.match(/<p>/g) || []).length, 2);
  assert.doesNotMatch(html, /<details/);
});

test("no se inventa un abstract cuando el registro no lo tiene", () => {
  assert.match(journalArticleAbstract({abstract: null}), /No hay resumen registrado/);
  assert.match(journalArticleAbstract({abstract: "   "}), /No hay resumen registrado/);
  assert.doesNotMatch(journalArticleAbstract({abstract: null}), /Generado por|inferido/i);
});

test("la ficha desplegable muestra datos bibliográficos y vínculo al artículo", () => {
  const html = journalArticleSheet(article,{label:"Núm. 1"},"Epistemología");
  for(const field of [
    "Ver ficha del artículo", "FICHA BIBLIOGRÁFICA", "Lenguaje, verdad y razón",
    "Ana Gutiérrez", "Luis Pérez", "Protrepsis", "Núm. 1", "2011-05-09",
    "10.32870/prot.i1.11", "Idioma", "es", "Verdad · Lenguaje", "Epistemología",
    "Leer artículo en la fuente original"
  ]) assert.ok(html.includes(field),"Missing information: "+field);
  assert.match(html, /<details class="atlas-article-sheet" data-article-sheet>/);
  assert.match(html, /<summary class="atlas-article-sheet-toggle">/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /http:\/\/protrepsis\.cucsh\.udg\.mx\/index\.php\/prot\/article\/view\/11/);
});

test("DOI fallback funciona y un artículo sin enlace no inventa destino", () => {
  assert.equal(journalArticleSourceUrl({ doi:"10.1234/example" }),"https://doi.org/10.1234/example");
  const without=journalArticleSheet({ title:"Artículo sin URL" },{label:"Número sin identificar"});
  assert.match(without,/El registro no proporciona un enlace directo/);
  assert.doesNotMatch(without, /class="atlas-article-sheet-open"/);
  assert.match(without,/No indicado/);
});

test("datos no confiables quedan escapados, y URL peligrosas son rechazadas", () => {
  const dangerous = {
    title: "<img src=x onerror=alert(1)>",
    journal: "<script>evade()</script>",
    abstract: "<script>alert(1)</script> & 'concepto'",
    subjects: ["<b>tema</b>"],
    authors: [{name:'A "quoted"'}],
    urls: {canonical:"javascript:alert(1)",doi:"data:text/html,x"}
  };
  const abstract=journalArticleAbstract(dangerous);
  const sheet=journalArticleSheet(dangerous,{label:"<iframe>"},'<script>x</script>');
  assert.doesNotMatch(abstract, /<script>/);
  assert.doesNotMatch(sheet, /<script>|<img|<iframe/);
  assert.match(abstract,/&lt;script&gt;/);
  assert.match(sheet,/&lt;img/);
  assert.match(sheet,/&lt;iframe&gt;/);
  assert.match(sheet,/&lt;script&gt;/);
  assert.equal(journalArticleSourceUrl(dangerous),"");
  assert.equal(safeJournalExternalUrl("javascript:alert(1)"),"");
  assert.equal(safeJournalExternalUrl("data:text/html,foo"),"");
  assert.equal(safeJournalExternalUrl("https://revista.udg.mx/a"),"https://revista.udg.mx/a");
});

test("los tres Atlas comparten módulo, CSS y invalidación de caché", async () => {
  const atlas = await readFile("js/journal-atlas.js","utf8");
  const script = await readFile("js/journal-page.js","utf8");
  const style = await readFile("css/journal-atlas-sheet.css","utf8");

  assert.match(atlas,/journalArticleAbstract\(record\)/);
  assert.match(atlas,/journalArticleSheet\(record, node\.issue, node\.category\)/);
  assert.match(atlas,/data-related-sheet/);
  assert.match(atlas,/sheet\.open = true/);
  assert.match(script,/journal-atlas\.js\?v=20261113-atlas-sheet-v1/);
  assert.match(style,/atlas-abstract-body/);
  assert.match(style,/atlas-article-sheet-toggle/);
  assert.match(style,/prefers-reduced-motion: reduce/);
  assert.match(style,/body\[data-journal="protrepsis"\]/);
  assert.match(style,/body\[data-journal="quadripartita"\]/);
  for (const name of ["protrepsis","sincronia","quadripartita-ratio"]) {
    const html=await readFile("revistas/udg/"+name+".html","utf8");
    assert.match(html,/journal-atlas-sheet\.css\?v=20261113-atlas-sheet-v1/);
    assert.match(html,/journal-page\.js\?v=20261113-[a-z0-9-]+/);
  }
});

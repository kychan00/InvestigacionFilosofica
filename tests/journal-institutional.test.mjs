import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const profiles = [
  {
    slug: "protrepsis", file: "protrepsis-institucional.html",
    expected: ["Jorge Grajeda Velázquez", "director.protrepsis@academicos.udg.mx",
      "2007-9273", "Latindex", "Diego A. Ramírez García", "Comité Científico Asesor", "31 personas"]
  },
  {
    slug: "sincronia", file: "sincronia-institucional.html",
    expected: ["Francisco Javier Ponce Martínez", "Raúl E. Rodríguez Monsiváis",
      "Nicolás Medina García", "revista.sincronia@academicos.udg.mx",
      "1562-384X", "Consejo editorial"]
  },
  {
    slug: "quadripartita-ratio", file: "quadripartita-ratio-institucional.html",
    expected: ["Fabián Bernache Maldonado", "Joaquín Galindo",
      "quadripartita.ratio@administrativos.udg.mx", "2448-6485",
      "Comité editorial", "Comité científico", "Castañeda", "Casteñeda"]
  }
];

for (const { slug, file, expected } of profiles) {
  const html = await readFile("revistas/udg/" + file, "utf8");
  test("ficha documental " + slug + ": HTML autocontenido y navegación real", async () => {
    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /lang="es"/);
    assert.match(html, /<main class="ji ji--/);
    assert.match(html, /journal-institutional\.css\?v=/);
    assert.match(html, /journal-institutional\.js\?v=/);
    assert.match(html, /mobile-site-menu\.js\?v=/);
    assert.match(html, /id="historia"/);
    assert.match(html, /id="equipo"/);
    assert.match(html, /id="contacto"/);
    assert.match(html, /id="fuentes"/);
    assert.match(html, /mailto:/);
    assert.match(html, /Fuentes y/);
    assert.match(html, /ficha de investigación y divulgación/i);
    assert.match(html, /no representa el sitio oficial/i);
    assert.match(html, new RegExp('href="' + slug + '\\.html"'));
    for (const name of expected) {
      assert.ok(html.includes(name), slug + " missing grounded metadata: " + name);
    }
    const original = await readFile("revistas/udg/" + slug + ".html", "utf8");
    assert.ok(original.includes(file), "archive must link to its editorial profile");
  });
}

test("enlaces institucionales presentes en la navegación global", async () => {
  const js = await readFile("js/mobile-site-menu.js", "utf8");
  for (const { file } of profiles) {
    assert.ok(js.includes('revistas/udg/' + file), "missing navigation entry " + file);
  }
});

test("dirección editorial de Protrepsis no inventa responsables", async () => {
  const html = await readFile("revistas/udg/protrepsis-institucional.html", "utf8");
  assert.match(html, /Quienes hacen/i);
  assert.match(html, /Equipo editorial/i);
  assert.match(html, /Consejo Editorial/);
  assert.match(html, /Comité Científico Asesor/);
  assert.match(html, /responsabilidad científica/i);
  assert.match(html, /http:\/\/protrepsis\.cucsh\.udg\.mx\/index\.php\/prot\/about\/editorialTeam/);
  assert.doesNotMatch(html, /cuando el portal editorial publique un directorio comprobable/i);
  assert.doesNotMatch(html, /no permite transcribir con fiabilidad todos los nombres/i);
  assert.match(html, /2011/);
  assert.match(html, /2012/);
});

test("Protrepsis publica 70 personas con nombres, roles, afiliaciones y tres fuentes distintas", async () => {
  const html = await readFile("revistas/udg/protrepsis-institucional.html", "utf8");
  assert.equal((html.match(/class="person"/g) || []).length, 69);
  assert.match(html, /Jorge Grajeda Velázquez/);
  assert.match(html, /Director editorial y responsable científico/);
  const team = [
    "Diego A. Ramírez García", "Erika Gómez Díaz", "Ana Sofía Vázquez Jiménez",
    "Fernanda Berenice González Zúñiga", "Alan Mehdi González López",
    "Diana Lizbeth Pichardo Muela", "Gabriella Passamonte",
    "Martha Elena Gutiérrez Franco", "Alejandra Apodaca Aguirre",
    "Alejandro Flores Tino (Alex FT)"
  ];
  for (const name of team) assert.ok(html.includes(name), "Missing editor: " + name);
  for (const name of [
    "León Olivé [+]", "Victoria Camps Cervera", "Mónica B. Cragnolini",
    "María Elizabeth de los Rios Uriarte", "Jordi Magnet Colomer",
    "Ianina Moretti Basso", "Héctor Sevilla Godínez"
  ]) assert.ok(html.includes(name), "Missing council member: " + name);
  assert.match(html, /31 integrantes en la nómina/);
  assert.match(html, /28 integrantes en la nómina/);
  assert.match(html, /navigationMenu\/view\/ConsejoEditorial/);
  assert.match(html, /navigationMenu\/view\/ComiteCientificoAsesor/);
  assert.match(html, /info\.protrepsis@academicos\.udg\.mx/);
  assert.match(html, /3819-3300/);
  assert.doesNotMatch(html, /situs toto|slot gacor|badak178|toto 4d/i);
});

test("Quadripartita enlaza sus comités verificables", async () => {
  const html = await readFile("revistas/udg/quadripartita-ratio-institucional.html", "utf8");
  assert.match(html, /QR\/comiteeditorial/);
  assert.match(html, /QR\/comitecientifico/);
  assert.match(html, /QR\/comitedictaminador/);
});

test("identidad de papel con legibilidad responsive y sin motion obligatorio", async () => {
  const css = await readFile("css/journal-institutional.css", "utf8");
  const js = await readFile("js/journal-institutional.js", "utf8");
  assert.match(css, /--paper:#f3eee4/);
  assert.match(css, /Cormorant Garamond/);
  assert.match(css, /IBM Plex Sans/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

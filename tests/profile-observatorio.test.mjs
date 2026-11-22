import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("el selector ofrece cuatro estilos completos sin alterar el predeterminado", async () => {
  const html = await read("../perfil.html");
  for (const shell of ["default", "territory", "marginalia", "observatory"]) {
    assert.match(html, new RegExp(`name="profileShell" value="${shell}"`));
    assert.match(html, new RegExp(`data-shell-sample="${shell}"`));
  }
  assert.match(html, /data-profile-shell="default"/);
  assert.match(html, /<strong>Observatorio<\/strong>/);
  assert.match(html, /profile-observatorio\.css\?v=20261122-observatorio-v1/);
  assert.ok(
    html.indexOf("profile-observatorio.css") > html.indexOf("profile.css"),
    "los estilos del nuevo tema deben cargarse después del CSS base"
  );
});

test("Observatorio se aplica en vivo y persiste sin sobrescribir el color propio", async () => {
  const source = await read("../js/profile.js");
  const data = await read("../js/user-data.js");
  assert.match(source, /PROFILE_SHELLS = new Set\(\["default", "territory", "marginalia", "observatory"\]\)/);
  assert.match(source, /else if \(shell === "observatory"\)/);
  assert.match(source, /applyProfileAccent\("#c4a06b"\)/);
  assert.match(source, /if:profile-shell:\$\{uid\}/);
  assert.match(source, /updateUserProfileShell\(uid, shell\)/);
  assert.equal((data.match(/\["default", "territory", "marginalia", "observatory"\]/g) || []).length, 2);
  assert.match(source, /currentProfile\?\.accentColor/);
});

test("el cuarto cascarón cubre navegación, módulos, modales y acceso móvil", async () => {
  const css = await read("../css/profile-observatorio.css");
  const shell = '.profile-page[data-profile-shell="observatory"]';
  for (const selector of [
    ".profile-cover-art", ".profile-cover-body", ".profile-nav",
    ".profile-pin", ".project-card", ".library-card", ".author-card",
    ".project-work-card", ".profile-settings-preview", ".profile-shell-option",
    ".profile-dialog"
  ]) {
    assert.ok(css.includes(shell + " " + selector) ||
      css.includes(shell + " :is(") && css.includes(selector),
      `falta diseño para ${selector}`);
  }
  assert.match(css, /html\[data-theme="dark"\] \.profile-page\[data-profile-shell="observatory"\]/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /animation:\s*infinite/);
});

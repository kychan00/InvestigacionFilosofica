import assert from "node:assert/strict";
import test from "node:test";
import {
  CORPUS_SHELL_DEFAULT, CORPUS_SHELL_IDS, normalizeCorpusShell,
  isCorpusAppearanceRoute, corpusShellAccountKey, resolveCorpusShell
} from "../js/corpus-appearance-policy.js";

test("los cuatro estilos tienen IDs estables y fallbacks seguros", () => {
  assert.deepEqual([...CORPUS_SHELL_IDS],
    ["default", "territory", "marginalia", "observatory"]);
  for (const id of CORPUS_SHELL_IDS) assert.equal(normalizeCorpusShell(id), id);
  for (const bad of ["invalid", null, "Observatory", undefined])
    assert.equal(normalizeCorpusShell(bad), CORPUS_SHELL_DEFAULT);
});

test("solo el buscador principal califica en raíz y GitHub Pages", () => {
  for (const [path, base] of [
    ["/", "/"], ["/index.html", "/"],
    ["/InvestigacionFilosofica/", "/InvestigacionFilosofica/"],
    ["/InvestigacionFilosofica", "/InvestigacionFilosofica/"],
    ["/InvestigacionFilosofica/index.html", "/InvestigacionFilosofica"]
  ]) assert.equal(isCorpusAppearanceRoute(path, base), true, path);

  for (const path of [
    "/tesis.html", "/atlas.html", "/articulos.html",
    "/filosofia-latinoamericana.html", "/research-atlas.html",
    "/revistas/udg/protrepsis.html",
    "/revistas/udg/sincronia.html",
    "/revistas/udg/quadripartita.html", "/index.html/otra"
  ]) assert.equal(isCorpusAppearanceRoute(path), false, path);
  assert.equal(isCorpusAppearanceRoute(
    "/InvestigacionFilosofica/tesis.html", "/InvestigacionFilosofica/"), false);
  assert.equal(isCorpusAppearanceRoute(
    "/InvestigacionFilosoficaExtra/", "/InvestigacionFilosofica/"), false);
  assert.equal(isCorpusAppearanceRoute("/index.html", "no-es-root"), false);
});

test("sin sesión verificada/UID no se accede al almacenamiento", () => {
  let reads = 0;
  const readPreference = () => { reads += 1; return "observatory"; };
  for (const params of [
    { pathname: "/index.html", uid: "alice", verified: false },
    { pathname: "/index.html", uid: "", verified: true },
    { pathname: "/tesis.html", uid: "alice", verified: true },
    { pathname: "/revistas/udg/protrepsis.html", uid: "alice", verified: true }
  ]) assert.equal(resolveCorpusShell({ ...params, readPreference }), "default");
  assert.equal(reads, 0);
  assert.equal(resolveCorpusShell({
    pathname: "/index.html", verified: true, uid: "alice", readPreference
  }), "observatory");
  assert.equal(reads, 1);
});

test("la caché distingue cuentas y falla cerrado ante storage bloqueado", () => {
  const values = new Map([
    [corpusShellAccountKey("alice"), "territory"],
    [corpusShellAccountKey("bob"), "marginalia"]
  ]);
  const choose = uid => resolveCorpusShell({
    pathname: "/", uid, verified: true,
    readPreference: key => values.get(key)
  });
  assert.equal(choose("alice"), "territory");
  assert.equal(choose("bob"), "marginalia");
  assert.equal(choose("charlie"), "default");
  assert.equal(corpusShellAccountKey(""), null);
  assert.equal(resolveCorpusShell({
    pathname: "/", uid: "alice", verified: true,
    readPreference() { throw new Error("storage denied"); }
  }), "default");
  assert.equal(resolveCorpusShell({
    pathname: "/", uid: "alice", verified: true,
    readPreference: () => "__proto__"
  }), "default");
});

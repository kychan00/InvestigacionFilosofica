import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCorpusAppearanceController } from "../js/corpus-appearance-runtime.js";

const fixtures = () => {
  const values = new Map([
    ["if:profile-shell:alice", "territory"],
    ["if:profile-shell:bob", "observatory"]
  ]);
  const applied = [];
  const controller = createCorpusAppearanceController({
    pathname: "/InvestigacionFilosofica/index.html",
    basePath: "/InvestigacionFilosofica/",
    readPreference: key => values.get(key),
    writePreference: (key, shell) => values.set(key, shell),
    readRemoteProfile: async uid => ({
      profileShell: uid === "alice" ? "marginalia" : "observatory"
    }),
    applyShell: shell => applied.push(shell)
  });
  return { controller, values, applied };
};

test("la sesión verificada recupera caché primero y después Firestore", async () => {
  const { controller, values, applied } = fixtures();
  assert.equal(await controller.enterUser({ uid: "alice", emailVerified: true }), "marginalia");
  assert.deepEqual(applied, ["territory", "marginalia"]);
  assert.equal(values.get("if:profile-shell:alice"), "marginalia");
  assert.equal(controller.shell, "marginalia");
});

test("no mezcla preferencias al alternar usuarios o cerrar sesión", async () => {
  const { controller, applied } = fixtures();
  await controller.enterUser({ uid: "alice", emailVerified: true });
  await controller.enterUser({ uid: "bob", emailVerified: true });
  assert.equal(controller.activeUid, "bob");
  assert.equal(controller.shell, "observatory");
  await controller.leaveUser();
  assert.equal(controller.activeUid, "");
  assert.equal(controller.shell, "default");
  assert.equal(applied.at(-1), "default");
  assert.equal(controller.storageChanged("if:profile-shell:alice", "territory"), false);
});

test("el hint por sí solo y las rutas excluidas no leen Firestore", async () => {
  let reads = 0;
  const make = pathname => createCorpusAppearanceController({
    pathname,
    basePath: "/InvestigacionFilosofica/",
    readPreference: () => "territory",
    readRemoteProfile: async () => {
      reads += 1;
      return { profileShell: "marginalia" };
    }
  });
  const a = make("/InvestigacionFilosofica/index.html");
  await a.enterUser({ uid: "alice", emailVerified: false });
  assert.equal(a.shell, "default");
  const excluded = make("/InvestigacionFilosofica/tesis.html");
  await excluded.enterUser({ uid: "alice", emailVerified: true });
  assert.equal(excluded.shell, "default");
  assert.equal(reads, 0);
});

test("un cambio de cuenta invalida la lectura remota antigua", async () => {
  let answerAlice;
  const firstRead = new Promise(resolve => { answerAlice = resolve; });
  const applied = [];
  const c = createCorpusAppearanceController({
    pathname: "/",
    readPreference: key => key.endsWith("alice") ? "territory" : "observatory",
    readRemoteProfile: uid => uid === "alice"
      ? firstRead : Promise.resolve({ profileShell: "observatory" }),
    applyShell: shell => applied.push(shell)
  });
  const pending = c.enterUser({ uid: "alice", emailVerified: true });
  await c.enterUser({ uid: "bob", emailVerified: true });
  answerAlice({ profileShell: "marginalia" });
  await pending;
  assert.equal(c.activeUid, "bob");
  assert.equal(c.shell, "observatory");
  assert.deepEqual(applied, ["territory", "observatory"]);
});

test("el cambio desde otra pestaña prevalece sobre una lectura lenta", async () => {
  let resolveRemote;
  const pendingRead = new Promise(resolve => { resolveRemote = resolve; });
  const applied = [];
  const c = createCorpusAppearanceController({
    pathname: "/",
    readPreference: () => "territory",
    readRemoteProfile: () => pendingRead,
    applyShell: shell => applied.push(shell)
  });
  const pending = c.enterUser({ uid: "alice", emailVerified: true });
  assert.equal(c.storageChanged("if:profile-shell:bob", "marginalia"), false);
  assert.equal(c.storageChanged("if:profile-shell:alice", "observatory"), true);
  resolveRemote({ profileShell: "marginalia" });
  await pending;
  assert.deepEqual(applied, ["territory", "observatory"]);
  assert.equal(c.shell, "observatory");
});

test("sin conexión mantiene el último tema confirmado y storage bloqueado no rompe", async () => {
  const errors = [];
  const applied = [];
  const c = createCorpusAppearanceController({
    pathname: "/",
    readPreference: () => { throw new Error("private mode"); },
    writePreference: () => { throw new Error("private mode"); },
    readRemoteProfile: async () => { throw new Error("offline"); },
    applyShell: shell => applied.push(shell),
    onError: error => errors.push(error.message)
  });
  await c.enterUser({ uid: "alice", emailVerified: true });
  assert.equal(c.shell, "default");
  assert.deepEqual(applied, ["default"]);
  assert.deepEqual(errors, ["offline"]);
});

test("solo index incluye la capa CSS y el módulo de apariencia", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../css/corpus-appearance.css", import.meta.url), "utf8");
  const boot = await readFile(new URL("../js/corpus-appearance.js", import.meta.url), "utf8");

  assert.match(html, /data-corpus-shell="default"/);
  assert.match(html, /css\/corpus-appearance\.css\?v=20261122-corpus-appearance-phase1/);
  assert.match(html, /js\/corpus-appearance\.js\?v=20261122-corpus-appearance-phase1/);
  assert.match(boot, /hasVerifiedAuthHint\(\)/);
  assert.match(boot, /onAuthStateChanged\(auth/);
  assert.match(boot, /root\.dataset\.corpusShell = shell/);
  assert.match(boot, /window\.addEventListener\("load"/);
  assert.match(boot, /readRemoteProfile/);
  assert.match(css, /body:not\(\.author-view\)/);
  for (const id of ["territory", "marginalia", "observatory"]) {
    for (const mode of ["light", "dark"]) {
      assert.ok(css.includes('data-theme="' + mode + '"][data-corpus-shell="' + id + '"]'));
    }
  }
  assert.doesNotMatch(css, /data-corpus-shell="default"\]\s*\{/);
  for (const path of [
    "../tesis.html", "../articulos.html", "../filosofia-latinoamericana.html",
    "../research-atlas.html", "../perfil.html"
  ]) {
    const other = await readFile(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(other, /corpus-appearance(?:\.css|\.js)/);
  }
});

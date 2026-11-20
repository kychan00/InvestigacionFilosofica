import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Firestore private research rules require verified ownership", () => {
  const rules = read("firestore.rules");

  assert.match(rules, /request\.auth\.uid\s*==\s*userId/);
  assert.match(rules, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(rules, /match \/users\/\{userId\}/);
  assert.doesNotMatch(rules, /allow\s+(?:read|write|read, write):\s*if\s*true/);
});

test("manual works are explicitly separated from the public corpus", () => {
  const profile = read("js/profile.js");
  const data = read("js/user-data.js");
  const page = read("perfil.html");

  assert.match(profile, /origin:\s*"private-user-entry"/);
  assert.match(profile, /privateOnly:\s*true/);
  assert.match(data, /origin\s*=\s*"public-engine"/);
  assert.match(page, /no se publica/i);
  assert.match(page, /no entra al corpus/i);
});

test("account surface contains required authentication flows", () => {
  const account = read("js/account-menu.js");

  assert.match(account, /createUserWithEmailAndPassword/);
  assert.match(account, /signInWithEmailAndPassword/);
  assert.match(account, /GoogleAuthProvider/);
  assert.match(account, /signInWithPopup/);
  assert.match(account, /sendEmailVerification/);
  assert.match(account, /sendPasswordResetEmail/);
  assert.match(account, />Login</);
  assert.match(account, />Registro</);
});

test("public search emits private save actions without importing Firestore", () => {
  const app = read("js/app.js");

  assert.match(app, /data-save-work-id/);
  assert.match(app, /data-save-author/);
  assert.match(app, /research-library:save-work/);
  assert.match(app, /research-library:save-author/);
  assert.doesNotMatch(
    app,
    /firebase-firestore\.js|from "\.\/firebase-client\.js"/
  );
});

test("profile workspace supports projects, subprojects and a private atlas", () => {
  const profile = read("js/profile.js");
  const page = read("perfil.html");

  assert.match(profile, /createProject/);
  assert.match(profile, /createSubproject/);
  assert.match(profile, /data-project-work-subproject/);
  assert.match(profile, /drawProjectAtlas/);
  assert.match(page, /id="project-atlas"/);
  assert.match(page, /Agregar trabajo que no existe en el motor/);
});

test("normalized work identifiers survive library to project moves", () => {
  const data = read("js/user-data.js");

  assert.match(data, /existingNormalizedId/);
  assert.match(data, /\["public-engine", "private-user-entry"\]/);
  assert.match(data, /for \(const childCollection of \["subprojects", "works"\]\)/);
});

test("new browser modules parse as JavaScript", () => {
  const files = [
    "js/firebase-config.js",
    "js/firebase-client.js",
    "js/user-data.js",
    "js/account-menu.js",
    "js/profile.js"
  ];

  for (const file of files) {
    const result = spawnSync(
      process.execPath,
      ["--check", join(root, file)],
      { encoding: "utf8" }
    );

    assert.equal(
      result.status,
      0,
      `${file} failed syntax check:\n${result.stderr || result.stdout}`
    );
  }
});

test("account menu is mounted from the shared theme module", () => {
  const theme = read("js/theme.js");
  assert.match(theme, /^import "\.\/account-menu\.js";/);
});

test("Firebase browser SDK version is pinned consistently", () => {
  for (const file of [
    "js/firebase-client.js",
    "js/user-data.js",
    "js/account-menu.js",
    "js/profile.js"
  ]) {
    assert.match(read(file), /firebasejs\/13\.3\.0\//);
  }
});

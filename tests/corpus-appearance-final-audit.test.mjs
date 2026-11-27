import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CORPUS_SHELL_IDS,
  isCorpusAppearanceRoute
} from "../js/corpus-appearance-policy.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const THEMES = ["territory", "marginalia", "observatory"];
const MODES = ["light", "dark"];

function hexVariables(css, selector) {
  const first = css.indexOf(selector + " {");
  assert.ok(first >= 0, "Missing selector " + selector);
  const end = css.indexOf("\n}", first);
  assert.ok(end > first, "Missing closing rule " + selector);
  return Object.fromEntries(
    [...css.slice(first, end).matchAll(/^\s*(--[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/gm)]
      .map(([, key, hex]) => [key, hex])
  );
}

function luminance(hex) {
  const normalized = hex.slice(1).match(/.{2}/g).map(n => parseInt(n, 16) / 255);
  const [r, g, b] = normalized.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
}

function contrast(a, b) {
  assert.match(a, /^#[0-9a-f]{6}$/i);
  assert.match(b, /^#[0-9a-f]{6}$/i);
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

function readable(pair, object, minimum = 4.5) {
  const [foreground, background] = pair;
  assert.ok(object[foreground], "Missing " + foreground);
  assert.ok(object[background], "Missing " + background);
  assert.ok(
    contrast(object[foreground], object[background]) >= minimum,
    foreground + " over " + background + " lacks " + minimum + ":1 contrast"
  );
}

test("auditoría: color y contraste WCAG AA de todas las pantallas principales", async () => {
  const [heroCSS, recordCSS, authorCSS] = await Promise.all([
    read("css/corpus-appearance.css"),
    read("css/corpus-appearance-records.css"),
    read("css/corpus-appearance-author-atlas.css")
  ]);

  for (const mode of MODES) for (const shell of THEMES) {
    const base = 'html[data-theme="' + mode + '"][data-corpus-shell="' + shell + '"]';
    const hero = hexVariables(heroCSS, base);
    const record = hexVariables(recordCSS, base + " #record-modal");
    const author = hexVariables(authorCSS, base);
    const details = mode + "/" + shell;

    for (const pair of [
      ["--corpus-ink", "--corpus-page"],
      ["--corpus-muted", "--corpus-page"],
      ["--corpus-on-accent", "--corpus-accent"]
    ]) readable(pair, hero, 4.5);

    for (const pair of [
      ["--rf-text", "--rf-panel"],
      ["--rf-text-soft", "--rf-surface"],
      ["--rf-text-soft", "--rf-surface-inset"],
      ["--rf-text-muted", "--rf-panel"],
      ["--rf-link", "--rf-surface-inset"],
      ["--rf-on-accent", "--rf-accent"],
      ["--rf-on-accent", "--rf-accent-hover"],
      ["--rf-button-text", "--rf-button"],
      ["--rf-button-text", "--rf-button-hover"]
    ]) readable(pair, record, 4.5);

    for (const pair of [
      ["--corpus-author-label", "--corpus-author-card"],
      ["--corpus-atlas-muted", "--corpus-author-card"],
      ["--corpus-atlas-muted", "--corpus-author-muted"]
    ]) readable(pair, author, 4.5);

    readable(["--corpus-atlas-blue", "--corpus-author-muted"], author, 3);
    assert.ok(hero["--corpus-accent"] && record["--rf-accent"] && author["--corpus-author-action"], details);
  }
});

test("auditoría: el estilo mantiene propiedad por UID y no se filtra a invitados", async () => {
  const [bridge, controller, profile, data, authHint] = await Promise.all([
    read("js/corpus-appearance.js"),
    read("js/corpus-appearance-runtime.js"),
    read("js/profile.js"),
    read("js/user-data.js"),
    read("js/auth-session-hint.js")
  ]);

  assert.deepEqual(CORPUS_SHELL_IDS, ["default", "territory", "marginalia", "observatory"]);
  assert.match(bridge, /hasVerifiedAuthHint\(\)/);
  assert.match(bridge, /onAuthStateChanged\(auth/);
  assert.match(bridge, /persistenceReady/);
  assert.match(bridge, /research-auth-hint-change/);
  assert.match(bridge, /window\.addEventListener\("storage"/);
  assert.match(bridge, /root\.dataset\.corpusShell = "default"/);
  assert.match(controller, /user\?\.emailVerified === true/);
  assert.match(controller, /corpusShellAccountKey\(uid\)/);
  assert.match(controller, /current !== revision \|\| activeUid !== uid/);
  assert.match(profile, /updateUserProfileShell\(uid, shell\)/);
  assert.match(profile, /rememberProfileShell\(uid, shell\)/);
  assert.match(profile, /profileShellSaveQueue/);
  assert.match(data, /profileShell:\s*normalized/);
  assert.match(authHint, /AUTH_HINT_MAX_AGE/);
});

test("auditoría: una sola página federada carga las cuatro capas visuales", async () => {
  const index = await read("index.html");
  const links = [
    "css/corpus-appearance.css",
    "css/corpus-appearance-results.css",
    "css/corpus-appearance-records.css",
    "css/corpus-appearance-author-atlas.css"
  ];
  let previous = -1;
  for (const link of links) {
    const at = index.indexOf(link);
    assert.ok(at > previous, "Visual layers must load in order: " + link);
    assert.equal(index.split(link).length - 1, 1, "Only one link per layer: " + link);
    previous = at;
  }

  assert.match(index, /data-corpus-shell="default"/);
  assert.match(index, /role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(index, /id="research-atlas-canvas"/);
  assert.match(index, /id="author-identity"/);
  assert.match(index, /id="record-modal"/);

  const base = "/InvestigacionFilosofica/";
  assert.equal(isCorpusAppearanceRoute(base, base), true);
  assert.equal(isCorpusAppearanceRoute(base + "index.html", base), true);
  for (const page of [
    "tesis.html", "atlas.html", "articulos.html", "filosofia-latinoamericana.html",
    "research-atlas.html", "perfil.html", "revistas/udg/protrepsis.html",
    "revistas/udg/sincronia.html", "revistas/udg/quadripartita-ratio.html"
  ]) {
    assert.equal(isCorpusAppearanceRoute(base + page, base), false, page);
    const external = await read(page);
    for (const link of links) {
      assert.doesNotMatch(external, new RegExp(link.replace(/\./g, "\\.")), page);
    }
  }
});

test("auditoría: scroll, zoom y accesibilidad conservan sus contratos", async () => {
  const [results, record, atlas, atlasCSS, timeline, author, head, navigation] = await Promise.all([
    read("css/corpus-appearance-results.css"),
    read("css/corpus-appearance-records.css"),
    read("js/research-atlas-embed.js"),
    read("css/research-atlas-embed.css"),
    read("css/author-timeline.css"),
    read("css/corpus-appearance-author-atlas.css"),
    read("js/app.js"),
    read("js/research-atlas-navigation.js")
  ]);

  // New styles are color/typography only. Existing JS remains the owner of
  // results ordering, scroll, bookmark widgets and atlas topology.
  const rules = [results, record, author].join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(rules,
    /(?:^|[;{]\s*)(?:display|position|inset|top|right|bottom|left|width|height|min-width|min-height|max-width|max-height|grid-template(?:-columns|-rows)?|grid-column|grid-row|overflow(?:-x|-y)?|transform|margin|padding|z-index|scroll-behavior|touch-action|pointer-events)\s*:/m);
  assert.match(atlasCSS, /touch-action: none/);
  assert.match(timeline, /scroll-snap-type: x proximity/);
  assert.match(timeline, /overflow-x: auto/);
  assert.match(atlas, /attributeFilter: \["data-theme", "data-corpus-shell"\]/);
  assert.match(atlas, /function draw\(/);
  assert.match(atlas, /function zoomAt\(/);
  assert.match(atlas, /navigation = bindResearchAtlasNavigation\(\{/);
  assert.match(navigation, /canvas\.addEventListener\("pointerdown"/);
  assert.match(navigation, /canvas\.addEventListener\("wheel"/);
  assert.match(navigation, /canvas\.addEventListener\("pointercancel"/);
  assert.match(head, /research-library:save-work/);
  assert.match(record, /:focus-visible/);
  assert.match(author, /@media \(forced-colors: active\)/);
});

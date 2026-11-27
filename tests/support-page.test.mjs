import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const page = read("apoyar.html");
const about = read("acerca.html");
const menu = read("js/mobile-site-menu.js");
const css = read("css/support.css");
const destination = "https://link.mercadopago.com.mx/cristianpelayo";
test("support is voluntary, public, and has a direct owner-provided payment link", () => {
  assert.ok(page.includes(destination));
  assert.ok(about.includes(destination));
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /No se emiten comprobantes de donativos deducibles/);
  assert.match(page, /no condicionan el acceso/);
  assert.match(page, /no representa oficialmente/);
  assert.match(page, /no un desglose de gastos ya realizados/);
  assert.doesNotMatch(page, /<form|<iframe|<input/i);
});
test("shared navigation and About link to the dedicated page", () => {
  assert.ok(menu.includes('label: "Apoyar el proyecto"'));
  assert.ok(menu.includes('href: siteHref("apoyar.html")'));
  assert.ok(menu.includes('"?origen=menu"'));
  assert.ok(about.includes('href="./apoyar.html?origen=acerca"'));
  assert.ok(page.includes('href="./apoyar.html" class="is-active" aria-current="page"'));
});
test("support presentation is isolated and responsive", () => {
  assert.match(css, /\.support-page \.support-hero/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.equal((css.match(/\{/g)||[]).length, (css.match(/\}/g)||[]).length);
});

import { supportSource, validSupportEvent, logSupportEvent } from "../js/support-analytics.js";
test("analytics restricts all recorded values to a fixed event and source list", () => {
  assert.equal(supportSource("menu"), "menu");
  assert.equal(supportSource("acerca"), "acerca");
  assert.equal(supportSource("personal@example.org"), "directo");
  assert.equal(validSupportEvent("entry_click", "directo"), false);
  assert.equal(validSupportEvent("page_view", "menu"), true);
  assert.equal(validSupportEvent("checkout_click", "acerca"), true);
  assert.equal(validSupportEvent("payment_received", "menu"), false);
  assert.equal(validSupportEvent("page_view", "arbitrary"), false);
  assert.ok(page.includes('data-support-event="checkout_click"'));
  assert.ok(about.includes('data-support-event="entry_click"'));
  assert.ok(menu.includes('link.dataset.supportEvent = "entry_click"'));
});
test("analytics sends no visitor or payment data and never obstructs navigation", async () => {
  const calls = [];
  const opts = {config:{supabaseUrl:"https://test.invalid",publishableKey:"sb_publishable_test"},privacy:{},
    fetcher:async (...args)=>{calls.push(args);return {ok:true};}};
  assert.equal(await logSupportEvent("checkout_click","menu",opts),true);
  assert.equal(calls.length,1);
  const [url,request]=calls[0];
  assert.equal(url,"https://test.invalid/rest/v1/rpc/log_support_event");
  assert.deepEqual(JSON.parse(request.body),{p_event_type:"checkout_click",p_source:"menu"});
  assert.equal(request.credentials,"omit");
  assert.equal(request.referrerPolicy,"no-referrer");
  assert.equal(request.keepalive,true);
  assert.equal(await logSupportEvent("page_view","menu",{...opts,privacy:{globalPrivacyControl:true}}),false);
  assert.equal(await logSupportEvent("page_view","menu",{...opts,privacy:{doNotTrack:"1"}}),false);
  assert.equal(await logSupportEvent("page_view","directo",{...opts,fetcher:async()=>{throw new Error("offline");}}),false);
  assert.equal(await logSupportEvent("payment_received","menu",opts),false);
  assert.equal(calls.length,1);
});

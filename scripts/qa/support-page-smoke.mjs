import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.MOBILE_UI_BASE_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
const paymentUrl = "https://link.mercadopago.com.mx/cristianpelayo";
await mkdir("artifacts/support-page", {recursive:true});
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({viewport:{width,height:900}, deviceScaleFactor:1});
      await page.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
      await page.addInitScript(value => localStorage.setItem("investigacion-filosofica-theme",value), theme);
      try {
        await page.goto(new URL("apoyar.html?origen=menu",base).href,{waitUntil:"domcontentloaded"});
        await page.locator(".support-payment").waitFor({state:"visible"});
        await page.locator(".site-menu-support").waitFor({state:"attached"});
        assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
        assert.equal(await page.locator(".support-pay-link").getAttribute("href"),paymentUrl);
        assert.equal(await page.locator(".support-pay-link").getAttribute("target"),"_blank");
        const geometry = await page.evaluate(() => ({
          window: document.documentElement.clientWidth,
          width: document.documentElement.scrollWidth,
          target: document.querySelector(".support-pay-link").getBoundingClientRect().height
        }));
        assert.ok(geometry.width <= geometry.window + 2, `overflow ${width}/${theme}: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.target >= 44);
        const faq = page.locator(".support-faq details").first();
        await faq.locator("summary").click();
        assert.equal(await faq.getAttribute("open"),"");
        const toggle=width<=820?page.locator(".site-menu-toggle"):page.locator(".site-desktop-menu-toggle");
        await toggle.click();
        const drawer = page.locator("#site-mobile-menu");
        const menu = drawer.locator(".site-menu-support");
        // The drawer transitions from visibility:hidden to visible. Wait for
        // the actual open state and visibility rather than sampling mid-frame.
        await page.waitForFunction(() => {
          const panel = document.querySelector("#site-mobile-menu");
          return panel?.classList.contains("is-open") &&
            panel.getAttribute("aria-hidden") === "false" && !panel.inert;
        }, null, {timeout:5000});
        await drawer.waitFor({state:"visible",timeout:5000});
        await menu.waitFor({state:"visible",timeout:5000});
        assert.equal(await toggle.getAttribute("aria-expanded"),"true");
        assert.equal(await menu.getAttribute("aria-current"),"page");
        await menu.scrollIntoViewIfNeeded();
        // Trial click also checks stability and pointer hit testing without
        // following the payment-support navigation or sending an event.
        await menu.click({trial:true,timeout:5000});
        assert.ok(await menu.isVisible(), `support menu not visible at ${width}/${theme}`);
        assert.equal(await menu.getAttribute("href"),new URL("apoyar.html?origen=menu",base).href);
        await page.keyboard.press("Escape");
        await drawer.waitFor({state:"hidden",timeout:5000});
        assert.equal(await toggle.getAttribute("aria-expanded"),"false");
        await page.screenshot({path:`artifacts/support-page/support-${width}-${theme}.png`,fullPage:true,animations:"disabled"});
      } finally {await page.close();}
    }
  }
  const page = await browser.newPage({viewport:{width:390,height:844}});
  try {
    await page.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await page.goto(new URL("acerca.html",base).href,{waitUntil:"domcontentloaded"});
    await page.locator(".about-support-more").click();
    await page.waitForURL("**/apoyar.html?origen=acerca");
    assert.equal(await page.locator(".support-pay-link").getAttribute("href"),paymentUrl);
  } finally { await page.close(); }
  const analyticsPage = await browser.newPage({viewport:{width:390,height:844}});
  try {
    const events = [];
    await analyticsPage.addInitScript(() => {
      Object.defineProperty(navigator,"globalPrivacyControl",{get:()=>false});
      Object.defineProperty(navigator,"doNotTrack",{get:()=>null});
    });
    await analyticsPage.route("**/*", async route => {
      if (route.request().url().endsWith("/rest/v1/rpc/log_support_event")) {
        const headers = {
          "access-control-allow-origin":"*",
          "access-control-allow-methods":"POST, OPTIONS",
          "access-control-allow-headers":"apikey, content-type"
        };
        if (route.request().method()==="OPTIONS") return route.fulfill({status:204,headers});
        assert.equal(route.request().method(),"POST");
        events.push(route.request().postDataJSON());
        return route.fulfill({status:204,headers});
      }
      return route.request().url().startsWith(base) ? route.continue() : route.abort();
    });
    await analyticsPage.goto(new URL("acerca.html",base).href,{waitUntil:"domcontentloaded"});
    await analyticsPage.locator(".site-menu-support").waitFor({state:"attached"});
    await analyticsPage.locator(".about-support-more").click();
    await analyticsPage.waitForURL("**/apoyar.html?origen=acerca");
    await analyticsPage.locator(".site-menu-support").waitFor({state:"attached"});
    await analyticsPage.locator(".support-pay-link").evaluate(link => {
      link.addEventListener("click",event=>event.preventDefault(),{once:true});
      link.click();
    });
    for (let attempt = 0; events.length < 3 && attempt < 50; attempt++) {
      await analyticsPage.waitForTimeout(100);
    }
    assert.deepEqual(events.map(e=>e.p_event_type).sort(),["checkout_click","entry_click","page_view"]);
    assert.ok(events.every(e=>e.p_source==="acerca" && Object.keys(e).length===2));
  } finally { await analyticsPage.close(); }
} finally { await browser.close(); }
console.log("Support page: 10 viewport/theme combinations and About navigation verified.");

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
        const menu = page.locator(".site-menu-support");
        assert.equal(await menu.getAttribute("aria-current"),"page");
        await menu.scrollIntoViewIfNeeded();
        assert.ok(await menu.isVisible());
        assert.equal(await menu.getAttribute("href"),new URL("apoyar.html?origen=menu",base).href);
        await page.keyboard.press("Escape");
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
} finally { await browser.close(); }
console.log("Support page: 10 viewport/theme combinations and About navigation verified.");

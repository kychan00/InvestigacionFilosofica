import assert from "node:assert/strict";

// Exercise actual browser input rather than dispatching synthetic DOM events.
export async function checkAtlasNavigation({ page, context, canvasSelector, zoomSelector, detailSelector, touch }) {
  const canvas = page.locator(canvasSelector);
  const zoom = page.locator(zoomSelector);
  await canvas.scrollIntoViewIfNeeded();
  const point = await canvas.evaluate(el => {
    const r = el.getBoundingClientRect();
    const left = Math.max(0, r.left), right = Math.min(innerWidth, r.right);
    const top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
    return { x: (left + right) / 2, y: (top + bottom) / 2, width: right - left };
  });
  assert.ok(point.width >= 150, "Canvas must have room for a pinch");
  const before = parseInt(await zoom.innerText(), 10);
  const detail = await page.locator(detailSelector).innerText();
  const increase = before < 400;
  if (touch) {
    const cdp = await context.newCDPSession(page);
    const fingers = distance => [-1, 1].map((sign, i) => ({
      x: Math.round(point.x + sign * distance), y: Math.round(point.y), id: i + 1
    }));
    try {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: fingers(increase ? 22 : 55) });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: fingers(increase ? 55 : 22) });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
      await cdp.detach();
    }
  } else {
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, increase ? -120 : 120);
  }
  await page.waitForFunction(({ selector, before, increase }) => {
    const current = parseInt(document.querySelector(selector)?.textContent, 10);
    return increase ? current > before : current < before;
  }, { selector: zoomSelector, before, increase });
  assert.equal(await page.locator(detailSelector).innerText(), detail, "Zoom must not select another node");
  assert.equal(await canvas.evaluate(el => el.classList.contains("is-dragging")), false);
}

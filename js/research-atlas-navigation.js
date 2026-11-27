// Shared camera navigation for both research atlas renderers.
export function bindResearchAtlasNavigation({
  canvas, view, metrics, draw, hitTest, select, hover, enabled = () => true,
  minZoom = 0.5, maxZoom = 8
}) {
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  const position = event => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const pair = () => {
    const [a, b] = pointers.values();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  };
  const world = (point, m) => ({
    x: view.x + (point.x - m.width / 2) / (m.base * view.zoom),
    y: view.y + (point.y - m.height / 2) / (m.base * view.zoom)
  });
  function anchor(point, target, zoom, m) {
    view.zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
    view.x = target.x - (point.x - m.width / 2) / (m.base * view.zoom);
    view.y = target.y - (point.y - m.height / 2) / (m.base * view.zoom);
    draw();
  }
  function beginPinch() {
    const p = pair();
    pinch = { distance: p.distance, zoom: view.zoom, target: world(p, metrics()) };
    drag = null;
  }
  function beginDrag(id, point, moved = false) {
    drag = { id, start: point, last: point, moved };
    pinch = null;
  }
  function clearHover() {
    hover(null);
  }
  function reset() {
    const ids = [...pointers.keys()];
    pointers.clear();
    drag = pinch = null;
    canvas.classList.remove("is-dragging");
    for (const id of ids) {
      if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
    }
    clearHover();
  }

  canvas.style.touchAction = "none";
  canvas.addEventListener("wheel", event => {
    if (!enabled()) return;
    event.preventDefault();
    if (!event.deltaY || pointers.size) return;
    const m = metrics();
    const point = position(event);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? m.height : 1;
    const delta = Math.max(-240, Math.min(240, event.deltaY * unit));
    anchor(point, world(point, m), view.zoom * Math.exp(-delta * 0.002), m);
  }, { passive: false });

  canvas.addEventListener("pointerdown", event => {
    if (!enabled() || event.button !== 0 || pointers.has(event.pointerId)) return;
    if (pointers.size && (event.pointerType !== "touch" ||
        [...pointers.values()].some(p => p.type !== "touch"))) return;
    const point = { ...position(event), type: event.pointerType };
    pointers.set(event.pointerId, point);
    canvas.setPointerCapture?.(event.pointerId);
    if (pointers.size === 1) beginDrag(event.pointerId, point);
    if (pointers.size === 2) beginPinch();
    canvas.classList.add("is-dragging");
    clearHover();
    draw();
  });

  canvas.addEventListener("pointermove", event => {
    if (!enabled()) { if (pointers.size) reset(); return; }
    if (!pointers.has(event.pointerId)) {
      if (!pointers.size && event.pointerType !== "touch") {
        hover(hitTest(event.clientX, event.clientY), event);
        draw();
      }
      return;
    }
    const point = { ...position(event), type: event.pointerType };
    pointers.set(event.pointerId, point);
    const m = metrics();
    if (pinch && pointers.size >= 2) {
      const p = pair();
      anchor(p, pinch.target, pinch.zoom * p.distance / pinch.distance, m);
    } else if (drag?.id === event.pointerId) {
      if (!drag.moved && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) <= 4) return;
      drag.moved = true;
      view.x -= (point.x - drag.last.x) / (m.base * view.zoom);
      view.y -= (point.y - drag.last.y) / (m.base * view.zoom);
      drag.last = point;
      draw();
    }
  });

  function finish(event, cancelled) {
    if (!pointers.has(event.pointerId)) return;
    const tap = !cancelled && enabled() && pointers.size === 1 &&
      drag?.id === event.pointerId && !drag.moved &&
      Math.hypot(position(event).x - drag.start.x, position(event).y - drag.start.y) <= 4;
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (pointers.size >= 2) beginPinch();
    else if (pointers.size === 1) {
      const [id, point] = pointers.entries().next().value;
      beginDrag(id, point, true); // Never interpret the remainder of a pinch as a tap.
    } else {
      drag = pinch = null;
      canvas.classList.remove("is-dragging");
    }
    if (tap) {
      const node = hitTest(event.clientX, event.clientY);
      if (node) select(node.id);
    }
    draw();
  }
  canvas.addEventListener("pointerup", event => finish(event, false));
  canvas.addEventListener("pointercancel", event => finish(event, true));
  canvas.addEventListener("lostpointercapture", event => finish(event, true));
  canvas.addEventListener("pointerleave", () => {
    if (!pointers.size) { clearHover(); draw(); }
  });
  return { reset };
}

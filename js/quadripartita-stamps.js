/* Quadripartita Ratio — original bibliographic stamp compositions.
 * Purely decorative; preserves the existing filters, metadata, links and
 * journal card DOM semantics, and never fetches external media or data.
 */
const root = document.body;
const grid = document.querySelector("#journal-card-grid");
const SVG_NS = "http://www.w3.org/2000/svg";

function numberSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeEngraving(seed, variant) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 480 270");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("qr-engraved-svg");
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("fill", "none");
  group.setAttribute("stroke", "currentColor");
  group.setAttribute("stroke-width", "1.12");
  group.setAttribute("stroke-linecap", "round");
  group.setAttribute("stroke-linejoin", "round");

  const appendPath = (d, opacity = 1, width = 1) => {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("stroke-width", String(width));
    p.setAttribute("opacity", String(opacity));
    group.append(p);
  };

  // Each stamp receives a distinct field of engraved contour lines.
  const phase = (seed % 217) / 37;
  for (let layer = 0; layer < 55; layer += 1) {
    const coords = [];
    for (let x = -15; x <= 500; x += 6) {
      const hill =
        Math.sin(x / (43 + variant * 7) + phase + layer * 0.115) * (15 + variant * 5) +
        Math.sin(x / (15 + variant * 3) + phase * 0.31 + layer * 0.072) * 7;
      const y = 60 + layer * 3.14 + hill + 0.00056 * Math.pow(x - 240, 2);
      coords.push((coords.length ? "L" : "M") + x + " " + y.toFixed(1));
    }
    appendPath(coords.join(" "), 0.63, layer % 5 === 0 ? 1.05 : 0.62);
  }

  // Four independent variations inspired by diagrams of logic, rather than
  // copying the stamp artwork in the visual reference.
  if (variant === 0) {
    for (let ring = 18; ring <= 80; ring += 10) {
      appendPath("M" + (240 - ring) + " 124 a" + ring + " " + ring +
        " 0 1 0 " + (2 * ring) + " 0 a" + ring + " " + ring + " 0 1 0 " + (-2 * ring) + " 0", .68, .9);
    }
    appendPath("M240 43V205 M160 124H320 M185 69L295 179 M185 179L295 69", .9, 1.6);
  } else if (variant === 1) {
    for (let i = 0; i < 11; i++) {
      const x = 140 + i * 19;
      appendPath("M" + x + " 72 L" + (x + 7) + " 72 L" + (x + 7) + " 185 L" + x + " 185", .74, 1.12);
    }
    appendPath("M116 69 L236 20 L356 69 Z M119 186 H356 M111 199 H364", 1, 1.55);
    for (let i = 0; i < 24; i++) appendPath("M" + (125 + i * 10) + " 62 l7 -4", .63, .75);
  } else if (variant === 2) {
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      const x1 = 240 + 95 * Math.cos(a), y1 = 130 + 72 * Math.sin(a);
      const x2 = 240 + 36 * Math.cos(a * 2), y2 = 130 + 30 * Math.sin(a * 2);
      appendPath("M" + x1.toFixed(1) + " " + y1.toFixed(1) + "L" +
        x2.toFixed(1) + " " + y2.toFixed(1), .74, 1.05);
    }
    appendPath("M147 130 a93 72 0 1 0 186 0 a93 72 0 1 0 -186 0", .9, 1.7);
    for (let r = 18; r < 80; r += 13) appendPath("M" + (240-r) + " 130 a" + r + " " + (r*.77).toFixed(1) + " 0 0 0 " + r*2 + " 0", .55, .85);
  } else {
    for (let i = 0; i < 15; i++) {
      const start = 115 + i * 13, ending = 365 - i * 12;
      appendPath("M" + start + " 206 Q240 " + (15 + i * 4) + " " + ending + " 205", .83, .96);
    }
    appendPath("M113 207L240 42L370 207 M240 42V213 M123 208H362", 1, 1.6);
  }

  // Tiny engraved dots create a consistent halftone-style print texture.
  for (let i = 0; i < 56; i++) {
    const x = 12 + ((i * 73 + seed % 41) % 460);
    const y = 16 + ((i * 97 + seed % 37) % 243);
    appendPath("M" + x + " " + y + "h.8", .45, .8);
  }
  svg.append(group);
  return svg;
}

function decorateCard(card) {
  if (card.dataset.qrStampReady === "true") return;
  const body = card.querySelector(".journal-card-body");
  if (!body) return;
  const year = card.querySelector(".pin-year")?.textContent?.trim() || "s/f";
  const issue = card.querySelector(".pin-issue")?.textContent?.trim() || "Número editorial";
  const title = card.querySelector("h3")?.textContent || "";
  const seed = numberSeed(title + issue);
  const variant = seed % 4;

  const paper = document.createElement("div");
  paper.className = "qr-stamp-paper";

  const topper = document.createElement("div");
  topper.className = "qr-stamp-topline";
  const logo = document.createElement("span");
  logo.className = "qr-stamp-label";
  logo.textContent = "QUADRIPARTITA / RATIO";
  const number = document.createElement("span");
  number.className = "qr-stamp-number";
  number.textContent = issue.replace(/^Núm\.\s*/i, "Nº ");
  topper.append(logo, number);

  const drawing = document.createElement("div");
  drawing.className = "qr-stamp-engraving";
  drawing.append(makeEngraving(seed, variant));

  const caption = document.createElement("div");
  caption.className = "qr-stamp-footline";
  const captionLeft = document.createElement("span");
  captionLeft.textContent = "ARGUMENTUM · UDEG";
  const captionRight = document.createElement("span");
  captionRight.textContent = "MÉXICO / " + year;
  caption.append(captionLeft, captionRight);

  const plate = document.createElement("div");
  plate.className = "qr-stamp-plate";
  plate.append(topper, drawing, caption);
  paper.append(plate, body);
  card.replaceChildren(paper);
  card.classList.add("qr-stamp-card");
  card.dataset.qrStampReady = "true";
}

if (root?.dataset.journal === "quadripartita" && grid) {
  const decorateAll = () => {
    for (const card of grid.querySelectorAll(":scope > .journal-card")) decorateCard(card);
  };
  const observer = new MutationObserver(decorateAll);
  observer.observe(grid, { childList: true });
  decorateAll();
}

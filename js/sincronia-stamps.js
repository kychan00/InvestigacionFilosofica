/* Sincronía — procedural academic stamp cards.
 * Decorative only: it reuses the existing journal card nodes, links, bylines,
 * metadata buttons and event listeners. No remote media, no inferred metadata.
 */
const root = document.body;
const grid = document.querySelector("#journal-card-grid");
const SVG_NS = "http://www.w3.org/2000/svg";

function numberSeed(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function svgElement(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function makeArchiveDrawing(seed, variant) {
  const svg = svgElement("svg", {
    viewBox: "0 0 520 230",
    preserveAspectRatio: "xMidYMid slice",
    "aria-hidden": "true",
    focusable: "false"
  });
  svg.classList.add("sn-stamp-svg");

  const lines = svgElement("g", {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });
  const path = (d, opacity = 1, width = 1.2) => {
    const p = svgElement("path", {d, opacity, "stroke-width": width});
    lines.append(p);
  };
  const circle = (cx, cy, r, opacity = 1, width = 1.2) => {
    lines.append(svgElement("circle", {cx, cy, r, opacity, "stroke-width": width}));
  };

  const phase = (seed % 151) / 21;

  if (variant === 0) {
    // Intersecting waves: synchronization without pretending to encode content.
    for (let row = 0; row < 8; row += 1) {
      const points = [];
      for (let x = -10; x <= 530; x += 8) {
        const y = 36 + row * 23 +
          Math.sin(x / (28 + row * 2) + phase + row * .42) * (12 + row * 1.7);
        points.push((points.length ? "L" : "M") + x + " " + y.toFixed(1));
      }
      path(points.join(" "), .72, row % 3 === 0 ? 1.8 : .9);
    }
    path("M56 27V205 M463 27V205 M56 116H463", .44, .8);
  } else if (variant === 1) {
    // Citation constellation.
    const nodes = Array.from({length: 13}, (_, i) => ({
      x: 55 + ((i * 83 + seed % 71) % 410),
      y: 36 + ((i * 57 + seed % 43) % 155)
    }));
    nodes.forEach((node, i) => {
      const next = nodes[(i * 5 + 3) % nodes.length];
      path("M" + node.x + " " + node.y + "L" + next.x + " " + next.y, .42, .75);
    });
    nodes.forEach((node, i) => circle(node.x, node.y, i % 4 === 0 ? 8 : 4.2, .9, i % 4 === 0 ? 1.7 : 1));
    circle(260, 115, 96, .34, .7);
  } else if (variant === 2) {
    // Phase rings and axes.
    for (let r = 24; r <= 96; r += 14) circle(260, 115, r, .56, r % 28 === 0 ? 1.4 : .8);
    for (let i = 0; i < 12; i += 1) {
      const a = i * Math.PI / 6 + phase * .05;
      const x = 260 + Math.cos(a) * 105;
      const y = 115 + Math.sin(a) * 105;
      path("M260 115L" + x.toFixed(1) + " " + y.toFixed(1), .42, .8);
    }
    path("M116 115H404 M260 18V212", .8, 1.35);
  } else if (variant === 3) {
    // Archive shelves and repeated volumes.
    path("M65 190H455 M65 67H455", .88, 1.5);
    for (let i = 0; i < 14; i += 1) {
      const w = 14 + ((seed + i * 17) % 19);
      const h = 72 + ((seed + i * 29) % 72);
      const x = 75 + i * 26;
      path("M" + x + " 190V" + (190-h) + "H" + (x+w) + "V190", .72, i % 4 === 0 ? 1.7 : 1);
      if (i % 3 === 0) path("M" + (x+4) + " " + (185-h) + "H" + (x+w-4), .6, .8);
    }
  } else if (variant === 4) {
    // A non-geographic research landscape: peaks + measurement grid.
    for (let y = 45; y < 205; y += 24) path("M55 " + y + "H465", .22, .7);
    for (let x = 70; x < 470; x += 40) path("M" + x + " 30V205", .18, .7);
    path("M40 188L102 132L142 158L207 68L251 120L302 91L365 145L432 55L486 188", .94, 2);
    path("M40 198H486", .7, 1.2);
    circle(207, 68, 8, .88, 1.6);
    circle(432, 55, 8, .88, 1.6);
  } else {
    // Reading / annotation matrix.
    for (let row = 0; row < 5; row += 1) {
      const y = 45 + row * 34;
      const width = 300 - ((seed + row * 37) % 115);
      path("M84 " + y + "H" + (84 + width), .82, row === 0 ? 2.3 : 1.1);
      path("M" + (400 - row * 8) + " " + (y-9) + "l22 9 -22 9", .52, 1);
    }
    circle(427, 116, 45, .62, 1.2);
    path("M407 116l14 14 30-35", .94, 2.4);
  }

  // Light halftone registration marks make the field feel printed.
  for (let i = 0; i < 36; i += 1) {
    const x = 20 + ((i * 79 + seed % 53) % 485);
    const y = 18 + ((i * 43 + seed % 31) % 195);
    path("M" + x + " " + y + "h.8", .32, .9);
  }

  svg.append(lines);
  return svg;
}

function issueNumberFromLabel(label) {
  const match = String(label || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function decorateCard(card) {
  if (card.dataset.snStampReady === "true") return;
  const body = card.querySelector(".journal-card-body");
  if (!body) return;

  const title = card.querySelector("h3")?.textContent?.trim() || "Sin título";
  const year = card.querySelector(".pin-year")?.textContent?.trim() || "s/f";
  const issueLabel = card.querySelector(".pin-issue")?.textContent?.trim() || "Número s/f";
  const serial = card.querySelector(".journal-card-rail strong")?.textContent?.trim() || "—";
  const seed = numberSeed(title + "|" + issueLabel + "|" + year);
  const issueNumber = issueNumberFromLabel(issueLabel);
  const variant = (issueNumber ?? seed) % 6;
  const palette = (issueNumber ?? seed) % 5;

  card.dataset.snVariant = String(variant);
  card.dataset.snPalette = String(palette);

  const frame = document.createElement("div");
  frame.className = "sn-stamp-frame";
  const paper = document.createElement("div");
  paper.className = "sn-stamp-paper";

  const plate = document.createElement("div");
  plate.className = "sn-stamp-plate";

  const top = document.createElement("div");
  top.className = "sn-stamp-top";
  const label = document.createElement("span");
  label.textContent = "SINCRONÍA / ARCHIVO ACADÉMICO";
  const issue = document.createElement("strong");
  issue.className = "sn-stamp-issue";
  issue.textContent = issueLabel.replace(/^Núm\.\s*/i, "Nº ");
  top.append(label, issue);

  const visual = document.createElement("div");
  visual.className = "sn-stamp-visual";
  visual.append(makeArchiveDrawing(seed, variant));

  const bottom = document.createElement("div");
  bottom.className = "sn-stamp-bottom";
  const left = document.createElement("span");
  left.textContent = "UDEG · CUCSH · MÉXICO";
  const center = document.createElement("strong");
  center.textContent = year;
  const right = document.createElement("span");
  right.className = "sn-stamp-serial";
  right.textContent = "REG. " + serial;
  bottom.append(left, center, right);

  plate.append(top, visual, bottom);
  paper.append(plate, body);
  frame.append(paper);
  card.replaceChildren(frame);
  card.classList.add("sn-stamp-card");
  card.dataset.snStampReady = "true";
}

if (root?.dataset.journal === "sincronia" && grid) {
  const decorateAll = () => {
    for (const card of grid.querySelectorAll(":scope > .journal-card")) {
      decorateCard(card);
    }
  };
  const observer = new MutationObserver(decorateAll);
  observer.observe(grid, {childList: true});
  decorateAll();
}

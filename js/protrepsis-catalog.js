/* Protrepsis: small original philosophical engravings for archival folios.
 * Progressive enhancement: all titles, sources, filters, DOI, links, authors
 * and Atlas work unchanged if this script does not run.
 */
const grid = document.querySelector("#journal-card-grid");
const SVG = "http://www.w3.org/2000/svg";

function hashText(str) {
  let n = 2166136261;
  for (const c of String(str)) {
    n ^= c.charCodeAt(0);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}

function createEngraving(seed, variant) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 500 180");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  // Five original screen-print palettes, tied to stable article identity.
  // Color is decorative and does not imply any editorial classification.
  const paints = [
    ["#f9e8b8", "#b54c36", "#355a70"],
    ["#e7b85f", "#2e507b", "#f3e9ca"],
    ["#f4d19a", "#28655f", "#fce8cf"],
    ["#e8d59c", "#b65e49", "#2d5671"],
    ["#e7d2aa", "#af694e", "#23435e"]
  ];
  const [paper, pigment, contrast] = paints[variant];
  const paint = document.createElementNS(SVG, "g");
  paint.setAttribute("stroke", "none");
  const ink = (tag, attributes) => {
    const element = document.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, String(value));
    }
    paint.append(element);
  };
  // Large irregular print blocks are deliberately different from
  // Quadripartita's perforated postal stamps.
  ink("circle", {cx: 398, cy: 44, r: 82, fill: paper, opacity: .84});
  ink("path", {
    d: "M-18 170 Q96 91 180 124 T364 120 T522 65 L522 190 H-18 Z",
    fill: contrast, opacity: .18
  });
  ink("path", {
    d: "M-14 4 L145 -16 L120 192 L-14 192 Z",
    fill: pigment, opacity: .16
  });
  if (variant === 0) {
    ink("path",{d:"M124 166 V80 L248 25 L372 80 V166 Z",fill:paper,opacity:.78});
    ink("circle",{cx:249,cy:64,r:25,fill:pigment,opacity:.52});
  } else if (variant === 1) {
    ink("circle",{cx:248,cy:95,r:82,fill:paper,opacity:.85});
    ink("circle",{cx:248,cy:95,r:48,fill:pigment,opacity:.21});
  } else if (variant === 2) {
    ink("path",{d:"M202 180 Q158 82 242 21 Q335 67 287 180 Z",fill:paper,opacity:.68});
    ink("path",{d:"M214 168 Q178 73 242 32 Q299 86 272 167 Z",fill:pigment,opacity:.13});
  } else if (variant === 3) {
    ink("path",{d:"M215 37 H282 Q276 63 294 94 Q311 142 281 161 Q249 175 217 161 Q188 140 206 94 Q225 62 215 37 Z",fill:paper,opacity:.87});
    ink("path",{d:"M206 100 Q255 74 296 100 V133 Q249 111 208 136 Z",fill:pigment,opacity:.25});
  } else {
    ink("circle",{cx:249,cy:91,r:80,fill:paper,opacity:.81});
    ink("path",{d:"M130 20 L249 91 L370 20 V37 L249 111 L130 37 Z",fill:pigment,opacity:.35});
  }

  const g = document.createElementNS(SVG, "g");
  g.setAttribute("stroke", "currentColor");
  g.setAttribute("stroke-linecap", "round");
  g.setAttribute("stroke-linejoin", "round");
  g.setAttribute("fill", "none");

  function draw(d, weight = 1.1, opacity = .78) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    path.setAttribute("stroke-width", weight);
    path.setAttribute("opacity", opacity);
    g.append(path);
  }
  function ellipse(x, y, rx, ry, weight = 1) {
    draw("M" + (x-rx) + " " + y + "a" + rx + " " + ry + " 0 1 0 " +
      (rx*2) + " 0a" + rx + " " + ry + " 0 1 0 " + (-rx*2) + " 0", weight, .75);
  }

  // A common topographical print field makes every folio part of the
  // same editorial collection, without copying anyone else's artwork.
  for (let i = 0; i < 21; i++) {
    let d = "";
    for (let x = -8; x <= 520; x += 12) {
      const y = 65 + i*5.4 + 9*Math.sin(x/(43+variant*9)+i*.21+(seed%31)/11) +
        7*Math.sin(x/23+i*.27);
      d += (d ? "L" : "M") + x + " " + y.toFixed(1);
    }
    draw(d, i % 6 === 0 ? 1.45 : .78, .27);
  }

  if (variant === 0) {
    // The ancient stoa: critical thought as a public conversation.
    draw("M130 78L248 26L368 78ZM139 86H365M145 151H362M135 161H371",2.2,.85);
    for(let i=0;i<6;i++) {
      const x=149+i*37;
      draw("M"+x+" 85v63m6 -63v63m-10 -66h19m-19 69h19",1.45);
      for(let j=0;j<3;j++)draw("M"+(x+1+j*2)+" 93v49",.5,.52);
    }
  } else if (variant === 1) {
    // Celestial instruments as a metaphor of philosophical orientation.
    ellipse(248,95,75,75,1.8);
    ellipse(248,95,59,59,1);
    ellipse(248,95,39,39,1.2);
    draw("M248 17V173M170 95H328M192 40L305 150M305 40L191 150",1.35,.82);
    draw("M248 32L268 95L248 158L227 95Z",1.8,.86);
    for(let i=0;i<16;i++) {
      const a=i*Math.PI/8;
      const x1=248+75*Math.cos(a),y1=95+75*Math.sin(a);
      const x2=248+87*Math.cos(a),y2=95+87*Math.sin(a);
      draw("M"+x1.toFixed(1)+" "+y1.toFixed(1)+"L"+x2.toFixed(1)+" "+y2.toFixed(1),.65);
    }
  } else if (variant === 2) {
    // Botanical collection: observation, memory, interpretation.
    draw("M241 172Q248 121 244 24",2.6,.93);
    for(let i=0;i<10;i++){
      const y=38+i*12,side=i%2?1:-1,tipX=244+side*(75-(i%3)*11);
      const tipY=y-30+(i%3)*4;
      draw("M244 "+y+"Q"+(244+side*45)+" "+(y-36)+" "+tipX+" "+tipY+
        "Q"+(244+side*38)+" "+(y+12)+" 244 "+y,1.35,.85);
      draw("M244 "+y+"L"+tipX+" "+tipY,.65,.6);
    }
    draw("M202 163Q246 170 282 163 M203 171H284",1.4);
  } else if (variant === 3) {
    // Amphora with an ancient geometrical register.
    draw("M211 36Q210 47 221 61Q209 77 204 96Q194 138 217 157Q250 168 283 157Q307 135 297 98Q291 76 279 62Q290 46 286 36Z",1.85,.89);
    draw("M210 43Q172 38 176 80Q180 105 207 106 M286 43Q324 38 320 80Q316 105 295 106",1.6);
    draw("M213 55H284M212 68H288M208 121H295M209 133H292M215 150H284",1.1);
    for(let i=0;i<8;i++)draw("M"+(221+i*8)+" 86l8 20l-8 14",.8,.75);
    draw("M198 162H304",1.5);
  } else {
    // The dialogue: four paths converging and departing.
    for(let i=0;i<11;i++) {
      const t=i*8;
      draw("M"+(130+t)+" 153Q249 "+(8+t*.26)+" "+(370-t)+" 153",.9,.7);
      draw("M"+(130+t)+" 31Q249 "+(169-t*.27)+" "+(370-t)+" 31",.8,.6);
    }
    draw("M249 10V170M112 91H387M249 13L270 91L249 166L227 91Z",1.7);
    ellipse(249,91,26,26,1.1);
  }

  // Engraved star/register marks, deterministic per document.
  for (let i=0;i<48;i++) {
    const x=14+((i*71+(seed%43))%472);
    const y=12+((i*97+(seed%17))%156);
    draw("M"+x+" "+y+"h"+(i%7===0?3:.9),.55,.35);
  }
  svg.append(paint, g);
  return svg;
}

function decorate(card) {
  if(card.dataset.proCatalogReady === "true") return;
  const body=card.querySelector(".journal-card-body");
  const title=card.querySelector("h3")?.textContent || "";
  if(!body) return;
  const year=card.querySelector(".pin-year")?.textContent?.trim() || "s/f";
  const issue=card.querySelector(".pin-issue")?.textContent?.trim() || "Edición";
  const serial=card.querySelector(".journal-card-rail strong")?.textContent?.trim() || "—";
  const seed=hashText(title+"|"+issue);
  const variant=seed%5;

  const overline=document.createElement("div");
  overline.className="pro-catalog-overline";
  const overlineA=document.createElement("span");
  overlineA.textContent="ARCHIVO / PROTREPSIS";
  const overlineB=document.createElement("span");
  overlineB.textContent="FICHA "+serial;
  overline.append(overlineA,overlineB);

  // The palette is a reproducible presentation detail, not scholarly metadata.
  card.dataset.proPalette=String(variant);
  const art=document.createElement("div");
  art.className="pro-catalog-art";
  art.setAttribute("aria-hidden","true");
  art.append(createEngraving(seed,variant));
  const signature=document.createElement("span");
  signature.className="pro-catalog-signature";
  signature.textContent="Π · "+year+" / "+issue;
  art.append(signature);
  const plate=document.createElement("span");
  plate.className="pro-catalog-plate-index";
  plate.textContent="LÁMINA "+String(variant+1).padStart(2,"0")+" / PROTREPSIS";
  art.append(plate);

  body.prepend(overline,art);
  card.dataset.proCatalogReady="true";
  card.classList.add("pro-catalog-card");
}

// Only observe newly rendered cards; changing a card's children cannot
// retrigger the grid's childList observer.
if (document.body?.dataset.journal==="protrepsis" && grid) {
  function decorateAll() {
    grid.querySelectorAll(":scope > .journal-card").forEach(decorate);
  }
  const observer=new MutationObserver(decorateAll);
  observer.observe(grid,{childList:true});
  decorateAll();
}

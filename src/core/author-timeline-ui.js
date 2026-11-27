import { intellectualHistory } from "./author-intellectual-history.js?v=20261127-v5";
import { buildIntellectualHistoryPanel } from "./author-intellectual-history-ui.js?v=20261127-v7";
import { latinAmericanDossierHref } from "./latin-american-history-bridge.js?v=20261127-v6";
import { buildAuthorTimeline } from "./author-timeline.js?v=20261127-historical-v1";
import { authorHistoricalContext, historicalTimelineSlice, TIMELINE_BATCH } from "./author-historical-periods.js?v=20261127-historical-v4";
import {
  authorOrcidUrl,
  normalizedAuthorOrcid,
  authorWorkSources,
  workHasAuthorOrcidEvidence
} from "./author-provenance.js";

function el(tag, className = "", label = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (label) element.textContent = label;
  return element;
}

function button(text, className, handler) {
  const element = el("button", className, text);
  element.type = "button";
  element.addEventListener("click", handler);
  return element;
}

function stat(value, label) {
  const block = el("div", "author-timeline-stat");
  block.append(
    el("strong", "", Number(value || 0).toLocaleString("es-MX")),
    el("span", "", label)
  );
  return block;
}

function renderTimeline(root, works, state, options) {
  const { onOpenWork, loading, authorOrcid, author } = options;
  const verifiedHistory = intellectualHistory(author);
  const regionalContexts={
    latin:{region:"latin",label:"Contexto de la filosofía latinoamericana",motif:"republic"},
    china:{region:"china",label:"Tradición filosófica china",motif:"china"},
    "roman-africa":{region:"roman-africa",label:"Antigüedad tardía · África romana",motif:"ancient"},
    islamicate:{region:"islamicate",label:"Tradición filosófica del mundo islámico",motif:"islamicate"},
    "jewish-mediterranean":{region:"jewish-mediterranean",label:"Tradición filosófica judía mediterránea",motif:"jewish-mediterranean"},
    india:{region:"india",label:"Tradición filosófica budista india",motif:"india"}
  };
  const context=regionalContexts[verifiedHistory?.region]||authorHistoricalContext(author);
  const orcidUrl = authorOrcidUrl(authorOrcid);
  const model = buildAuthorTimeline(works, state.unit);

  root.replaceChildren();
  root.className = "author-timeline";
  root.setAttribute("aria-label", "Línea de tiempo de las obras del autor");

  const heading = el("div", "author-timeline-heading");
  const text = el("div");
  text.append(
    el("span", "author-section-kicker", "Archivo cronológico"),
    el("h2", "", "Trayectoria bibliográfica"),
    el(
      "p",
      "",
      "Explore las obras recuperadas en orden cronológico. Las fechas pueden corresponder a ediciones posteriores."
    )
  );

  const modes = el("div", "author-timeline-modes");
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", "Agrupar por año o mes");
  for (const [value, label] of [["year", "Por año"], ["month", "Por mes"]]) {
    const active = state.unit === value;
    const control = button(label, active ? "is-active" : "", () => {
      if (state.unit === value) return;
      state.unit = value;
      state.timelineLimit = TIMELINE_BATCH;
      renderTimeline(root, works, state, options);
      root.querySelector(".author-timeline-modes .is-active")?.focus();
    });
    control.setAttribute("aria-pressed", String(active));
    modes.append(control);
  }

  if (orcidUrl) {
    const link = el("a", "author-timeline-orcid",
      "ORCID · " + normalizedAuthorOrcid(authorOrcid));
    link.href = orcidUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "Identificador del autor; no acredita por sí solo cada publicación";
    text.append(link);
  }
  heading.append(text, modes);
  root.append(heading);

  const biography=buildIntellectualHistoryPanel(author,state,{archiveHref:latinAmericanDossierHref(author)});
  if(biography)root.append(biography);

  const coverage = el("div", "author-timeline-coverage");
  coverage.setAttribute("role", "status");
  coverage.append(
    stat(model.total, "obras recuperadas"),
    stat(model.dated, "con año identificado"),
    stat(model.monthsKnown, "con mes confirmado"),
    stat(new Set(works.flatMap(authorWorkSources)).size, "fuentes bibliográficas")
  );
  if (loading) {
    coverage.append(el(
      "div",
      "author-timeline-loading",
      "El índice sigue incorporando obras a esta cronología…"
    ));
  }
  root.append(coverage);

  if (state.unit === "month" && model.monthsKnown === 0 && model.total) {
    root.append(el(
      "p",
      "author-timeline-precision",
      "Este índice sólo proporciona años. Las obras sin mes se identifican expresamente como «Mes no registrado», sin inventar fechas."
    ));
  }

  if (!model.groups.length) {
    root.append(el(
      "p",
      "author-timeline-empty",
      "No hay obras disponibles para construir la cronología."
    ));
    return;
  }

  const limit=state.timelineLimit || TIMELINE_BATCH;
  const sections=historicalTimelineSlice(model,context,limit);
  if(context.label){
    const banner=el("div","author-timeline-context");
    banner.dataset.motif=context.motif;
    banner.append(motif(context.motif),el("span","",context.label));
    root.append(banner);
  }
  const track=el("div","author-timeline-historical-track");
  track.dataset.region=context.region;
  let shown=0;
  for(const section of sections){
    const block=el("section","author-timeline-era");
    block.dataset.motif=section.motif;
    const header=el("div","author-timeline-era-header");
    const label=el("div","author-timeline-era-copy");
    label.append(el("h3","",section.label));
    const illustration=motif(section.motif);
    header.append(illustration,label);
    block.append(header);
    const list=el("div","author-timeline-nodes");
    for(const entry of section.entries){
    const work = entry.work;
    const control = button(
      "",
      "author-timeline-work",
      () => onOpenWork(entry.index)
    );
    control.title = "Abrir ficha de " + (work.title || "Sin título");

    const marker = el("span", "author-timeline-node");
    marker.setAttribute("aria-hidden", "true");

    const copy = el("span", "author-timeline-work-copy");
    copy.append(
      el("span", "author-timeline-entry-date", entry.dateLabel),
      el("span", "author-timeline-work-name", work.title || "Sin título"),
      el("span", "author-timeline-work-type", work.type || "Obra")
    );

    const sources = authorWorkSources(work);
    const provenance = el("span", "author-timeline-provenance");
    if (sources.length > 1) {
      provenance.append(el("span", "author-timeline-multi-source",
        "Varias fuentes · " + sources.length));
    }
    sources.forEach(source => provenance.append(
      el("span", "author-timeline-provider", source)
    ));
    if (orcidUrl) {
      const verified = workHasAuthorOrcidEvidence(work, authorOrcid);
      const listed = work.orcidRecord === true ||
        sources.includes("ORCID");
      const tag = el("span", "author-timeline-orcid-context" +
        (verified ? " is-evidenced" : ""),
        listed ? "Registrada en ORCID"
          : verified ? "ORCID en metadatos" : "ORCID del autor");
      tag.title = listed
        ? "Obra presente en la bibliografía pública del investigador en ORCID."
        : verified
          ? "El identificador ORCID está presente en metadatos bibliográficos."
          : "El ORCID corresponde al perfil, no acredita por sí solo esta obra.";
      provenance.append(tag);
    }
    copy.append(provenance);

    const arrow = el("span", "author-timeline-arrow", "↗");
    arrow.setAttribute("aria-hidden", "true");

    control.append(marker, copy, arrow);

      control.dataset.timelinePosition=String(shown++);
      list.append(control);
    }
    block.append(list);
    track.append(block);
  }
  root.append(track);
  const count=el("p","author-timeline-progress",shown.toLocaleString("es-MX")+" de "+model.total.toLocaleString("es-MX")+" obras");
  count.setAttribute("role","status");
  root.append(count);
  if(shown<model.total)root.append(button("Mostrar más obras · "+Math.min(TIMELINE_BATCH,model.total-shown),"author-timeline-more",()=>{
    state.timelineLimit=limit+TIMELINE_BATCH;
    renderTimeline(root,works,state,options);
    root.querySelector('[data-timeline-position="'+shown+'"]')?.focus();
  }));
  if(shown>TIMELINE_BATCH)root.append(button("Mostrar menos","author-timeline-more author-timeline-less",()=>{
    state.timelineLimit=TIMELINE_BATCH;
    renderTimeline(root,works,state,options);
    root.querySelector(".author-timeline-more")?.focus();
  }));
  root.append(el("p","author-timeline-method","El archivo puede ser parcial respecto de toda la producción del autor."));
}

function motif(name){
  const paths={
    ancient:"M3 9 16 3 29 9H3M5 12H27M7 13V25M13 13V25M19 13V25M25 13V25M4 26H28M2 29H30",
    medieval:"M5 28V14L16 3 27 14V28M10 28V17Q16 7 22 17V28M2 28H30",
    renaissance:"M3 27H29M5 25V14Q16 2 27 14V25M11 25V15Q16 9 21 15V25",
    modern:"M5 26H27M10 26V17L19 8M16 5 23 12M15 6 18 3 25 10 22 13M12 16Q23 16 23 25M6 20H17",
    precolonial:"M2 28H30V24H26V19H22V14H19V9H13V14H10V19H6V24H2Z M14 14H18V28",
    colonial:"M3 28V14H29V28M10 28V8L16 3 22 8V28M14 28V19H18V28M5 18H8M24 18H27",
    republic:"M3 27Q10 21 16 26Q22 21 29 27V7Q22 3 16 8Q10 3 3 7ZM16 8V26M7 11L12 13M20 13L25 11",
    nineteenth:"M3 28H29M5 25H27M8 25V10H24V25M4 10H28L16 3ZM11 12V23M16 12V23M21 12V23M4 28V30M28 28V30",
    contemporary:"M4 4H28V24H4ZM10 28H22M16 24V28M8 9H24M8 13H20M8 17H23",
    china:"M4 7H28M7 10H25M9 12V24M23 12V24M4 26H28M13 12V24M19 12V24M3 7Q8 7 11 3H21Q24 7 29 7",
    islamicate:"M3 29H29M6 28V16Q6 9 16 3Q26 9 26 16V28M11 28V19Q11 13 16 9Q21 13 21 19V28M3 28H29",
    "jewish-mediterranean":"M4 5Q9 2 16 8Q23 2 28 5V26Q23 23 16 29Q9 23 4 26ZM16 8V29M8 11L12 13M20 13L24 11",
    india:"M3 26H29M6 23H26M8 20Q8 10 16 9Q24 10 24 20ZM16 4V9M12 7H20M5 29H27",
    archive:"M7 3H21L26 8V29H7ZM21 3V8H26M11 13H22M11 18H22M11 23H19"
  };
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox","0 0 32 32");
  svg.setAttribute("aria-hidden","true");
  svg.setAttribute("focusable","false");
  svg.classList.add("author-timeline-motif");
  const path=document.createElementNS(svg.namespaceURI,"path");
  path.setAttribute("d",paths[name]||paths.archive);
  path.setAttribute("fill","none");
  path.setAttribute("stroke","currentColor");
  path.setAttribute("stroke-width","1.5");
  path.setAttribute("stroke-linejoin","round");
  path.setAttribute("stroke-linecap","round");
  svg.append(path);
  return svg;
}

export function mountAuthorTimeline(
  root,
  works,
  state,
  { onOpenWork = () => {}, loading = false, authorOrcid = null, author = null } = {}
) {
  if (!root) return;
  renderTimeline(root, works, state, { onOpenWork, loading, authorOrcid, author });
}

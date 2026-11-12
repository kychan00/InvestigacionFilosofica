import { buildAuthorTimeline } from "./author-timeline.js";
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
  const { onOpenWork, loading, authorOrcid } = options;
  const orcidUrl = authorOrcidUrl(authorOrcid);
  const model = buildAuthorTimeline(works, state.unit);
  const selected = model.groups.find(group =>
    group.key === state.selectedKey
  ) || model.groups[0] || null;

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
      "Recorra la producción recuperada del autor a través del tiempo y abra cada obra desde su propio hito."
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
      state.selectedKey = null;
      state.visibleLimit = 60;
      renderTimeline(root, works, state, options);
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

  root.append(el("div", "author-timeline-track-label", "Recorrido temporal"));

  const periods = el("div", "author-timeline-periods");
  periods.setAttribute("aria-label", "Periodos de publicación");
  let activePeriod = null;

  for (const group of model.groups) {
    const active = selected && group.key === selected.key;
    const control = button(
      "",
      "author-timeline-period" + (active ? " is-active" : ""),
      () => {
        state.selectedKey = group.key;
        state.visibleLimit = 60;
        renderTimeline(root, works, state, options);
      }
    );
    control.setAttribute("aria-pressed", String(Boolean(active)));
    if (active) {
      control.setAttribute("aria-current", "true");
      activePeriod = control;
    }

    const marker = el("span", "author-timeline-marker");
    marker.setAttribute("aria-hidden", "true");
    const meta = el("span", "author-timeline-period-meta");
    meta.append(
      el("strong", "author-timeline-count", String(group.count)),
      el("small", "", group.count === 1 ? "obra" : "obras")
    );

    control.append(
      marker,
      el("span", "author-timeline-date", group.label),
      meta
    );
    periods.append(control);
  }

  root.append(periods);

  const detail = el("div", "author-timeline-detail");
  const detailHeading = el("div", "author-timeline-detail-heading");
  const headingCopy = el("div", "author-timeline-detail-heading-copy");
  headingCopy.append(
    el("span", "author-timeline-detail-eyebrow", "Periodo seleccionado"),
    el("h3", "", selected.label)
  );
  detailHeading.append(
    headingCopy,
    el(
      "span",
      "",
      selected.count.toLocaleString("es-MX") +
        (selected.count === 1 ? " obra" : " obras")
    )
  );
  detail.append(detailHeading);

  const list = el("div", "author-timeline-nodes");
  const visible = selected.nodes.slice(0, state.visibleLimit || 60);

  visible.forEach((entry, position) => {
    const work = entry.work;
    const control = button(
      "",
      "author-timeline-work",
      () => onOpenWork(entry.index)
    );
    control.title = "Abrir ficha de " + (work.title || "Sin título");

    const marker = el("span", "author-timeline-node");
    marker.setAttribute("aria-hidden", "true");

    const ordinal = String(position + 1).padStart(
      visible.length >= 100 ? 3 : 2,
      "0"
    );
    const index = el("span", "author-timeline-work-index", ordinal);
    index.setAttribute("aria-hidden", "true");

    const copy = el("span", "author-timeline-work-copy");
    copy.append(
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
      const tag = el("span", "author-timeline-orcid-context" +
        (verified ? " is-evidenced" : ""),
        verified ? "ORCID en metadatos" : "ORCID del autor");
      tag.title = verified
        ? "La obra contiene el ORCID del autor en sus metadatos."
        : "Identificador del perfil; esta obra no tiene atribución individual confirmada por ORCID.";
      provenance.append(tag);
    }
    copy.append(provenance);

    const arrow = el("span", "author-timeline-arrow", "↗");
    arrow.setAttribute("aria-hidden", "true");

    control.append(marker, index, copy, arrow);
    list.append(control);
  });

  detail.append(list);

  const remainder = selected.count - visible.length;
  if (remainder > 0) {
    detail.append(button(
      "Mostrar más obras (" + remainder.toLocaleString("es-MX") +
        " restantes)",
      "author-timeline-more",
      () => {
        state.visibleLimit = (state.visibleLimit || 60) + 60;
        renderTimeline(root, works, state, options);
      }
    ));
  }

  root.append(
    detail,
    el(
      "p",
      "author-timeline-method",
      "Cronología construida únicamente con las fechas declaradas en los metadatos recuperados. El archivo puede ser parcial respecto de toda la producción del autor."
    )
  );

  if (activePeriod && state.selectedKey) {
    requestAnimationFrame(() => {
      activePeriod.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "nearest",
        inline: "center"
      });
    });
  }
}

export function mountAuthorTimeline(
  root,
  works,
  state,
  { onOpenWork = () => {}, loading = false, authorOrcid = null } = {}
) {
  if (!root) return;
  renderTimeline(root, works, state, { onOpenWork, loading, authorOrcid });
}

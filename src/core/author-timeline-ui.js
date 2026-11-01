import { buildAuthorTimeline } from "./author-timeline.js";

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

export function mountAuthorTimeline(
  root,
  works,
  state,
  { onOpenWork = () => {}, loading = false } = {}
) {
  if (!root) return;
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
    el("h2", "", "Línea de tiempo de las obras"),
    el("p", "", "Seleccione un periodo y abra la ficha desde cada nodo.")
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
      mountAuthorTimeline(root, works, state, {onOpenWork, loading});
    });
    control.setAttribute("aria-pressed", String(active));
    modes.append(control);
  }
  heading.append(text, modes);
  root.append(heading);

  const summary = el(
    "p",
    "author-timeline-coverage",
    model.total.toLocaleString("es-MX") + " obras recuperadas · " +
    model.dated.toLocaleString("es-MX") + " con año · " +
    model.monthsKnown.toLocaleString("es-MX") + " con mes confirmado" +
    (loading ? " · Cargando más obras del índice…" : "")
  );
  summary.setAttribute("role", "status");
  root.append(summary);

  if (state.unit === "month" && model.monthsKnown === 0 && model.total) {
    root.append(el(
      "p", "author-timeline-precision",
      "Este índice sólo proporciona años. Las obras sin mes se identifican " +
      "expresamente como «Mes no registrado», sin inventar fechas."
    ));
  }

  if (!model.groups.length) {
    root.append(el("p", "author-timeline-empty",
      "No hay obras disponibles para construir la cronología."));
    return;
  }

  const periods = el("div", "author-timeline-periods");
  periods.setAttribute("aria-label", "Periodos de publicación");
  for (const group of model.groups) {
    const active = selected && group.key === selected.key;
    const control = button("", "author-timeline-period" +
      (active ? " is-active" : ""), () => {
      state.selectedKey = group.key;
      state.visibleLimit = 60;
      mountAuthorTimeline(root, works, state, {onOpenWork, loading});
    });
    control.setAttribute("aria-pressed", String(Boolean(active)));
    control.append(
      el("span", "author-timeline-marker"),
      el("span", "author-timeline-date", group.label),
      el("strong", "author-timeline-count", String(group.count)),
      el("small", "", group.count === 1 ? "obra" : "obras")
    );
    control.querySelector(".author-timeline-marker")
      .setAttribute("aria-hidden", "true");
    periods.append(control);
  }
  root.append(periods);

  const detail = el("div", "author-timeline-detail");
  const title = el("div", "author-timeline-detail-heading");
  title.append(
    el("h3", "", selected.label),
    el("span", "", selected.count.toLocaleString("es-MX") +
      (selected.count === 1 ? " obra" : " obras"))
  );
  detail.append(title);

  const list = el("div", "author-timeline-nodes");
  const visible = selected.nodes.slice(0, state.visibleLimit || 60);
  for (const entry of visible) {
    const work = entry.work;
    const control = button("", "author-timeline-work",
      () => onOpenWork(entry.index));
    control.title = "Abrir ficha de " + (work.title || "Sin título");
    const marker = el("span", "author-timeline-node");
    marker.setAttribute("aria-hidden", "true");
    const label = el("span", "author-timeline-work-name",
      work.title || "Sin título");
    const type = el("span", "author-timeline-work-type",
      work.type || "Obra");
    const arrow = el("span", "author-timeline-arrow", "↗");
    arrow.setAttribute("aria-hidden", "true");
    control.append(marker, label, type, arrow);
    list.append(control);
  }
  detail.append(list);
  const remainder = selected.count - visible.length;
  if (remainder > 0) {
    detail.append(button(
      "Mostrar más nodos (" + remainder.toLocaleString("es-MX") +
        " restantes)", "author-timeline-more", () => {
        state.visibleLimit = (state.visibleLimit || 60) + 60;
        mountAuthorTimeline(root, works, state, {onOpenWork, loading});
      }
    ));
  }
  root.append(detail, el(
    "p", "author-timeline-method",
    "Cronología basada en metadatos de las obras recuperadas. " +
    "El archivo puede ser parcial respecto de toda la producción del autor."
  ));
}

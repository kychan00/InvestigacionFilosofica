/* Navegación editorial móvil compartida: tres revistas, archivo y ficha institucional.
 * Usa las pestañas y exploradores existentes; no altera filtros ni metadatos.
 */
(() => {
  const journals = {
    protrepsis: { name: "Protrepsis", page: "protrepsis.html", profile: "protrepsis-institucional.html", explorer: "pro" },
    sincronia: { name: "Sincronía", page: "sincronia.html", profile: "sincronia-institucional.html", explorer: "sn" },
    quadripartita: { name: "Quadripartita Ratio", page: "quadripartita-ratio.html", profile: "quadripartita-ratio-institucional.html", explorer: "qr" }
  };

  const journalId = document.body.dataset.journal
    || Object.keys(journals).find(id => document.querySelector(".ji--" + id));
  const journal = journals[journalId];
  const toolbar = document.querySelector(".site-mobile-toolbar");
  if (!journal || !toolbar) return;

  const institutional = location.pathname.endsWith("-institucional.html");
  document.body.dataset.journalQuicknav = journalId;

  const entries = [
    { label: "Inicio", id: "inicio", page: "archive" },
    { label: "Artículos", id: "journal-archive-panel", page: "archive" },
    { label: "Atlas", id: "journal-atlas-panel", page: "archive" },
    { label: "Categorías", id: journal.explorer + "-explorer-topics", page: "archive" },
    { label: "Números", id: journal.explorer + "-explorer-issues", page: "archive" },
    { label: "Filtros", id: journal.explorer + "-explorer-filters", page: "archive" },
    { label: "Autorías", id: "journal-insights-panel", page: "archive" },
    { label: "Historia", id: "historia", page: "profile" },
    { label: "Equipo", id: "equipo", page: "profile" },
    { label: "Contacto", id: "contacto", page: "profile" },
    { label: "Fuentes", id: "fuentes", page: "profile" }
  ];

  const localPage = institutional ? "profile" : "archive";
  const hrefFor = entry => (entry.page === localPage ? "" : (entry.page === "profile" ? journal.profile : journal.page)) + "#" + entry.id;

  const nav = document.createElement("nav");
  nav.className = "journal-quicknav";
  nav.setAttribute("aria-label", "Navegación rápida de " + journal.name);
  nav.innerHTML = `
    <div class="journal-quicknav-heading">
      <span class="journal-quicknav-overline">REVISTA / NAVEGACIÓN</span>
      <label class="journal-quicknav-picker">
        <span class="journal-quicknav-picker-label">Cambiar revista</span>
        <select aria-label="Cambiar de revista">
          ${Object.entries(journals).map(([id, info]) =>
            `<option value="${info.page}" ${id === journalId ? "selected" : ""}>${info.name}</option>`
          ).join("")}
        </select>
      </label>
      <span class="journal-quicknav-hint" aria-hidden="true">Deslice →</span>
    </div>
    <div class="journal-quicknav-tray">
      <div class="journal-quicknav-links" aria-label="Destinos de la revista">
        ${entries.map(entry => `<a href="${hrefFor(entry)}" data-quicknav-id="${entry.id}">${entry.label}</a>`).join("")}
      </div>
      <button class="journal-quicknav-more" type="button" aria-label="Ver más secciones" title="Desplazar enlaces">→</button>
    </div>
  `;
  toolbar.insertAdjacentElement("afterend", nav);

  const links = [...nav.querySelectorAll("[data-quicknav-id]")];
  const tray = nav.querySelector(".journal-quicknav-links");
  const more = nav.querySelector(".journal-quicknav-more");
  const picker = nav.querySelector("select");

  picker.addEventListener("change", () => {
    const destination = Object.values(journals).find(info => info.page === picker.value);
    if (destination) location.assign(destination.page);
  });

  function syncTray() {
    const remaining = tray.scrollWidth - tray.clientWidth;
    const atEnd = tray.scrollLeft >= remaining - 3;
    const isScrollable = remaining > 5;
    more.hidden = !isScrollable;
    more.textContent = atEnd ? "←" : "→";
    more.setAttribute("aria-label", atEnd ? "Ver secciones anteriores" : "Ver más secciones");
    more.dataset.direction = atEnd ? "back" : "forward";
  }
  more.addEventListener("click", () => {
    tray.scrollBy({ left: (more.dataset.direction === "back" ? -1 : 1) * Math.max(180, tray.clientWidth * .72), behavior: "smooth" });
  });
  tray.addEventListener("scroll", syncTray, { passive: true });
  addEventListener("resize", syncTray, { passive: true });
  requestAnimationFrame(syncTray);

  function setCurrent(id) {
    for (const link of links) {
      const current = link.dataset.quicknavId === id;
      link.classList.toggle("is-current", current);
      if (current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }

  function scrollToSection(target) {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const toolbarHeight = toolbar.getBoundingClientRect().height;
    const quicknavHeight = nav.getBoundingClientRect().height;
    const y = target.id === "inicio"
      ? 0
      : Math.max(0, window.scrollY + target.getBoundingClientRect().top - toolbarHeight - quicknavHeight - 12);
    window.scrollTo({ top: y, behavior: reducedMotion ? "instant" : "smooth" });
  }

  function navigateHash(hash) {
    const id = decodeURIComponent((hash || "").replace(/^#/, ""));
    const entry = entries.find(item => item.id === id && item.page === localPage);
    if (!entry) {
      if (!hash && !institutional) setCurrent("inicio");
      return;
    }

    if (!institutional) {
      const view = id === "journal-atlas-panel" ? "atlas"
        : id === "journal-insights-panel" ? "insights" : "archive";
      document.querySelector('[data-journal-view="' + view + '"]')?.click();

      if (id.startsWith(journal.explorer + "-explorer-")) {
        const mode = id.slice((journal.explorer + "-explorer-").length);
        document.querySelector('[data-' + journal.explorer + '-explorer-tab="' + mode + '"]')?.click();
      }
    }

    setCurrent(id);
    const target = document.getElementById(id);
    if (target) requestAnimationFrame(() => requestAnimationFrame(() => scrollToSection(target)));
  }

  for (const link of links) {
    const entry = entries.find(item => item.id === link.dataset.quicknavId);
    if (entry.page !== localPage) continue;
    link.addEventListener("click", event => {
      event.preventDefault();
      const hash = "#" + entry.id;
      if (location.hash !== hash) history.pushState(null, "", hash);
      navigateHash(hash);
    });
  }

  addEventListener("popstate", () => navigateHash(location.hash));
  addEventListener("hashchange", () => navigateHash(location.hash));
  if (location.hash) navigateHash(location.hash);
  else if (!institutional) setCurrent("inicio");
})();

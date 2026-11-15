/* Quadripartita Ratio — compact, accessible postal archive explorer.
 * Only one navigation panel is shown at once. Article and taxonomy data,
 * selections, filters and Atlas are owned by the existing journal controller.
 */
const explorer = document.querySelector('body[data-journal="quadripartita"] .qr-explorer');

if (explorer) {
  const tabs = [...explorer.querySelectorAll("[data-qr-explorer-tab]")];
  const panels = [...explorer.querySelectorAll("[data-qr-explorer-panel]")];
  const scrollArea = explorer.querySelector(".qr-explorer-panels");
  const filterToggle = explorer.querySelector("#journal-filter-toggle");

  function activate(name, { focus = false } = {}) {
    const selected = tabs.find(tab => tab.dataset.qrExplorerTab === name);
    if (!selected) return;

    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }

    for (const panel of panels) {
      panel.hidden = panel.dataset.qrExplorerPanel !== name;
    }
    if (scrollArea) scrollArea.scrollTop = 0;

    // On mobile the shared journal controller initially collapses its form.
    // Selecting "Filtros" must reveal the inputs with a single tap.
    if (name === "filters" && filterToggle?.getAttribute("aria-expanded") === "false") {
      filterToggle.click();
    }
    if (focus) selected.focus({ preventScroll: true });
  }

  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => activate(tab.dataset.qrExplorerTab));
    tab.addEventListener("keydown", event => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;

      event.preventDefault();
      activate(tabs[next].dataset.qrExplorerTab, { focus: true });
    });
  }

  activate("topics");
}

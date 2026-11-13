/* Protrepsis archive explorer · accessible panels rather than a tall sidebar.
   This module never changes article data, topic filters, issue selection or Atlas state.
 */
const explorer = document.querySelector('body[data-journal="protrepsis"] .pro-explorer');

if (explorer) {
  const tabs = [...explorer.querySelectorAll("[data-pro-explorer-tab]")];
  const panels = [...explorer.querySelectorAll("[data-pro-explorer-panel]")];
  const filterToggle = explorer.querySelector("#journal-filter-toggle");

  function activate(name, { focus = false } = {}) {
    const selected = tabs.find(tab => tab.dataset.proExplorerTab === name);
    if (!selected) return;

    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.proExplorerPanel !== name;
      if (!panel.hidden) panel.scrollTop = 0;
    }

    // The legacy filter form collapses automatically on mobile. Opening
    // the Filtros tab reveals the actual inputs in one interaction.
    if (name === "filters" && filterToggle?.getAttribute("aria-expanded") === "false") {
      filterToggle.click();
    }
    if (focus) selected.focus({ preventScroll: true });
  }

  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => activate(tab.dataset.proExplorerTab));
    tab.addEventListener("keydown", event => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next].dataset.proExplorerTab, { focus: true });
    });
  }
  activate("topics");
}

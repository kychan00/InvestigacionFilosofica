const MOBILE_MENU_BREAKPOINT = 820;
const STORAGE_KEY = "investigacion-filosofica-theme";
const SITE_ROOT = new URL("../", import.meta.url);
const siteHref = path => new URL(path, SITE_ROOT).href;

const MENU_ICONS = {
  search: [
    '<circle cx="10.5" cy="10.5" r="5.5"></circle>',
    '<path d="M14.7 14.7 20 20"></path>'
  ],
  thesis: [
    '<path d="M6 3.5h9l3 3V20.5H6z"></path>',
    '<path d="M15 3.5v3h3"></path>',
    '<path d="M9 11h6M9 14h6M9 17h4"></path>'
  ],
  atlas: [
    '<circle cx="6" cy="7" r="2"></circle>',
    '<circle cx="18" cy="6" r="2"></circle>',
    '<circle cx="12" cy="18" r="2"></circle>',
    '<path d="M7.8 7.8 10.5 16M16.2 7.4 13.3 16.2M8 7h8"></path>'
  ],
  results: [
    '<path d="M8 6h11M8 12h11M8 18h11"></path>',
    '<circle cx="4.5" cy="6" r="1"></circle>',
    '<circle cx="4.5" cy="12" r="1"></circle>',
    '<circle cx="4.5" cy="18" r="1"></circle>'
  ],
  sources: [
    '<ellipse cx="12" cy="5.5" rx="7" ry="3"></ellipse>',
    '<path d="M5 5.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"></path>',
    '<path d="M5 11.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"></path>'
  ],
  articles: [
    '<path d="M4.5 5.5h6.5c1.7 0 3 1.3 3 3v11H7.5c-1.7 0-3-1.3-3-3z"></path>',
    '<path d="M19.5 5.5H14c-1.7 0-3 1.3-3 3v11h5.5c1.7 0 3-1.3 3-3z"></path>'
  ],
  archive: [
    '<path d="M4 7h16v13H4z"></path>',
    '<path d="M3 4h18v3H3zM9 11h6"></path>'
  ],
  university: [
    '<path d="m3 9 9-5 9 5"></path>',
    '<path d="M5 10h14M6.5 10v8M10 10v8M14 10v8M17.5 10v8M4 20h16"></path>'
  ],
  journal: [
    '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"></path>',
    '<path d="M8 4v16M11 8h4M11 11h4"></path>'
  ],
  info: [
    '<circle cx="12" cy="12" r="9"></circle>',
    '<path d="M12 10.5v6M12 7.5h.01"></path>'
  ]
};

function createMenuIcon(name) {
  const wrapper = createElement("span", "site-menu-link-icon");
  wrapper.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("focusable", "false");

  for (const markup of MENU_ICONS[name] || MENU_ICONS.articles) {
    const template = document.createElement("template");
    template.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + markup + '</svg>';
    const node = template.content.firstElementChild.firstElementChild;
    svg.append(node);
  }

  wrapper.append(svg);
  return wrapper;
}

const menuItems = [
  {
    index: "01",
    label: "Investigación",
    icon: "search",
    detail: "Motor federado de búsqueda",
    href: siteHref("")
  },
  {
    index: "02",
    label: "Tesis",
    icon: "thesis",
    detail: "Archivo universitario",
    href: siteHref("tesis.html")
  },
  {
    index: "03",
    label: "Atlas",
    icon: "atlas",
    detail: "Cartografía de investigaciones",
    href: siteHref("atlas.html")
  },
  {
    index: "04",
    label: "Resultados",
    icon: "results",
    detail: "Lista de la búsqueda actual",
    href: siteHref("#results")
  },
  {
    index: "05",
    label: "Fuentes",
    icon: "sources",
    detail: "Procedencia y cobertura",
    href: siteHref("#fuentes")
  },
  {
    index: "06",
    label: "Artículos",
    icon: "articles",
    detail: "Revistas por universidad",
    children: [
      {
        label: "Todos los artículos",
        icon: "archive",
        detail: "Explorar el archivo de revistas",
        href: siteHref("articulos.html")
      },
      {
        label: "UdeG",
        icon: "university",
        detail: "Universidad de Guadalajara",
        children: [
          {
            label: "Panorama UdeG",
            icon: "university",
            detail: "Revistas incorporadas",
            href: siteHref("articulos.html#udg")
          },
          {
            label: "Protrepsis",
            icon: "journal",
            detail: "CUCSH · Filosofía",
            href: siteHref("revistas/udg/protrepsis.html")
          },
          {
            label: "Protrepsis · equipo editorial",
            icon: "info",
            detail: "Historia, personas y contacto",
            href: siteHref("revistas/udg/protrepsis-institucional.html")
          },
          {
            label: "Sincronía",
            icon: "journal",
            detail: "CUCSH · Humanidades",
            href: siteHref("revistas/udg/sincronia.html")
          },
          {
            label: "Sincronía · equipo editorial",
            icon: "info",
            detail: "Historia, personas y contacto",
            href: siteHref("revistas/udg/sincronia-institucional.html")
          },
          {
            label: "Quadripartita Ratio",
            icon: "journal",
            detail: "CUCSH · Filosofía",
            href: siteHref("revistas/udg/quadripartita-ratio.html")
          },
          {
            label: "Quadripartita · equipo editorial",
            icon: "info",
            detail: "Historia, personas y contacto",
            href: siteHref("revistas/udg/quadripartita-ratio-institucional.html")
          }
        ]
      }
    ]
  },
  {
    index: "07",
    label: "Acerca de",
    icon: "info",
    detail: "Proyecto, método y cifras",
    href: siteHref("acerca.html")
  }
];

const toolbar = document.querySelector(".site-mobile-toolbar");

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

const backdrop = createElement("button", "site-menu-backdrop");
backdrop.type = "button";
backdrop.setAttribute("aria-label", "Cerrar menú");
backdrop.tabIndex = -1;

const drawer = createElement("aside", "site-menu-drawer");
drawer.id = "site-mobile-menu";
drawer.setAttribute("aria-hidden", "true");
drawer.setAttribute("aria-label", "Menú principal");
drawer.inert = true;

const head = createElement("div", "site-menu-drawer-head");
const headCopy = createElement("div");
headCopy.append(
  createElement("span", "site-menu-kicker", "Φ / NAVEGACIÓN"),
  createElement("h2", "site-menu-title", "Investigación Filosófica")
);

const closeButton = createElement("button", "site-menu-close", "×");
closeButton.type = "button";
closeButton.setAttribute("aria-label", "Cerrar menú");
head.append(headCopy, closeButton);

const nav = createElement("nav", "site-menu-links");
nav.setAttribute("aria-label", "Secciones de Investigación Filosófica");

let disclosureCounter = 0;

function makeLink(item, level) {
  const link = createElement("a", "site-menu-link");
  link.href = item.href;
  link.dataset.siteMenuHref = item.href;
  link.dataset.menuLevel = String(level);

  const leading = createElement("span", "site-menu-link-leading");
  leading.append(
    createMenuIcon(item.icon),
    createElement(
      "span",
      "site-menu-link-index",
      item.index || (level === 1 ? "·" : "—")
    )
  );
  const copy = createElement("span", "site-menu-link-copy");
  copy.append(
    createElement("strong", "", item.label),
    createElement("small", "", item.detail || "")
  );
  const arrow = createElement("span", "site-menu-link-arrow", "→");
  arrow.setAttribute("aria-hidden", "true");

  link.append(leading, copy, arrow);
  return link;
}

function makeBranch(item, level) {
  const branch = createElement("div", "site-menu-branch");
  branch.dataset.menuLevel = String(level);

  const button = createElement("button", "site-menu-branch-toggle");
  button.type = "button";
  button.setAttribute("aria-expanded", "false");

  const panelId = "site-menu-branch-" + (++disclosureCounter);
  button.setAttribute("aria-controls", panelId);

  const leading = createElement("span", "site-menu-link-leading");
  leading.append(
    createMenuIcon(item.icon),
    createElement(
      "span",
      "site-menu-link-index",
      item.index || (level === 1 ? "·" : "—")
    )
  );
  const copy = createElement("span", "site-menu-link-copy");
  copy.append(
    createElement("strong", "", item.label),
    createElement("small", "", item.detail || "")
  );
  const symbol = createElement("span", "site-menu-disclosure-symbol", "+");
  symbol.setAttribute("aria-hidden", "true");

  button.append(leading, copy, symbol);

  const children = createElement("div", "site-menu-children");
  children.id = panelId;
  children.hidden = true;

  for (const child of item.children || []) {
    children.append(renderItem(child, level + 1));
  }

  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!open));
    symbol.textContent = open ? "+" : "−";
    children.hidden = open;
  });

  branch.append(button, children);
  return branch;
}

function renderItem(item, level = 1) {
  return item.children?.length
    ? makeBranch(item, level)
    : makeLink(item, level);
}

for (const item of menuItems) {
  nav.append(renderItem(item));
}

const footer = createElement("div", "site-menu-footer");
footer.append(createElement("span", "site-menu-footer-label", "Apariencia"));

const themeGroup = createElement("div", "site-menu-theme");
themeGroup.setAttribute("role", "group");
themeGroup.setAttribute("aria-label", "Apariencia");

for (const theme of ["light", "dark"]) {
  const button = createElement(
    "button",
    "",
    theme === "light" ? "Claro" : "Oscuro"
  );
  button.type = "button";
  button.dataset.siteTheme = theme;
  button.setAttribute("aria-pressed", "false");
  themeGroup.append(button);
}

footer.append(themeGroup);
drawer.append(head, nav, footer);
document.body.append(backdrop, drawer);

const desktopRail = createElement("div", "site-desktop-rail");
const desktopToggle = createElement("button", "site-desktop-menu-toggle");
desktopToggle.type = "button";
desktopToggle.setAttribute("aria-label", "Abrir navegación");
desktopToggle.setAttribute("aria-expanded", "false");
desktopToggle.setAttribute("aria-controls", drawer.id);

const railLines = createElement("span", "site-desktop-menu-lines");
railLines.setAttribute("aria-hidden", "true");
railLines.append(createElement("i"), createElement("i"), createElement("i"));

const railLabel = createElement("span", "site-desktop-menu-label", "Secciones");
desktopToggle.append(railLines, railLabel);
desktopRail.append(desktopToggle);
document.body.append(desktopRail);

if (toolbar) {
  document.body.classList.add("has-site-mobile-toolbar");
}

const mobileToggle = toolbar?.querySelector(".site-menu-toggle");
const links = [...drawer.querySelectorAll(".site-menu-link")];
const themeButtons = [...drawer.querySelectorAll("[data-site-theme]")];

let previousFocus = null;

function currentTheme() {
  return document.documentElement.dataset.theme === "light"
    ? "light"
    : "dark";
}

function syncThemeControls() {
  const theme = currentTheme();

  for (const button of themeButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.siteTheme === theme)
    );
  }
}

function applyTheme(theme) {
  const value = theme === "light" ? "light" : "dark";
  const root = document.documentElement;

  root.dataset.theme = value;
  root.style.colorScheme = value;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.content = value === "dark" ? "#161616" : "#f4f4f4";
  }

  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // La elección visual sigue funcionando sin almacenamiento local.
  }

  for (const button of document.querySelectorAll("[data-theme-choice]")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeChoice === value)
    );
  }

  syncThemeControls();

  window.dispatchEvent(
    new CustomEvent("philosophythemechange", {
      detail: { theme: value }
    })
  );
}

function normalizeComparableHref(href) {
  try {
    const url = new URL(href, window.location.href);
    return {
      pathname: url.pathname.replace(/\/index\.html$/, "/"),
      search: url.search,
      hash: url.hash
    };
  } catch {
    return { pathname: "", search: "", hash: "" };
  }
}

function markCurrentLink() {
  const current = {
    pathname: window.location.pathname.replace(/\/index\.html$/, "/"),
    search: window.location.search,
    hash: window.location.hash
  };

  let firstCurrent = null;

  for (const link of links) {
    const target = normalizeComparableHref(link.dataset.siteMenuHref || "");
    const samePath = target.pathname === current.pathname;
    const sameSearch = !target.search || target.search === current.search;
    const sameHash = !target.hash || target.hash === current.hash;
    const isCurrent = samePath && sameSearch && sameHash;

    link.classList.toggle("is-current", isCurrent);

    if (isCurrent && !firstCurrent) {
      firstCurrent = link;
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }

  if (firstCurrent) {
    let parent = firstCurrent.parentElement;
    while (parent && parent !== drawer) {
      if (parent.classList?.contains("site-menu-children")) {
        parent.hidden = false;
        const toggle = parent.previousElementSibling;
        if (toggle?.classList.contains("site-menu-branch-toggle")) {
          toggle.setAttribute("aria-expanded", "true");
          const symbol = toggle.querySelector(".site-menu-disclosure-symbol");
          if (symbol) symbol.textContent = "−";
        }
      }
      parent = parent.parentElement;
    }
  }
}

function focusableElements() {
  return [
    ...drawer.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ].filter(element => !element.closest("[hidden]"));
}

function syncToggleState(open) {
  for (const toggle of [mobileToggle, desktopToggle]) {
    toggle?.setAttribute("aria-expanded", String(open));
    toggle?.setAttribute(
      "aria-label",
      open ? "Cerrar navegación" : "Abrir navegación"
    );
  }
}

function openMenu() {
  previousFocus = document.activeElement;

  drawer.classList.add("is-open");
  backdrop.classList.add("is-open");
  document.body.classList.add("site-menu-open");

  drawer.setAttribute("aria-hidden", "false");
  drawer.inert = false;
  syncToggleState(true);

  requestAnimationFrame(() => closeButton.focus());
}

function closeMenu({ restoreFocus = true } = {}) {
  drawer.classList.remove("is-open");
  backdrop.classList.remove("is-open");
  document.body.classList.remove("site-menu-open");

  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;
  syncToggleState(false);

  if (restoreFocus && previousFocus instanceof HTMLElement) {
    previousFocus.focus();
  }
}

function toggleMenu() {
  drawer.classList.contains("is-open")
    ? closeMenu()
    : openMenu();
}

mobileToggle?.addEventListener("click", toggleMenu);
desktopToggle.addEventListener("click", toggleMenu);
closeButton.addEventListener("click", () => closeMenu());
backdrop.addEventListener("click", () => closeMenu());

for (const link of links) {
  link.addEventListener("click", () => {
    closeMenu({ restoreFocus: false });
  });
}

for (const button of themeButtons) {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.siteTheme);
  });
}

document.addEventListener("keydown", event => {
  if (!drawer.classList.contains("is-open")) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu();
    return;
  }

  if (event.key !== "Tab") return;

  const focusable = focusableElements();
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

window.addEventListener("hashchange", markCurrentLink);
window.addEventListener("popstate", markCurrentLink);
window.addEventListener("philosophythemechange", syncThemeControls);

markCurrentLink();
syncThemeControls();

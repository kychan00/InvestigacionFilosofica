const MOBILE_MENU_BREAKPOINT =
  820;

const STORAGE_KEY =
  "investigacion-filosofica-theme";

const nav =
  document.querySelector(
    ".philo-nav, .td-nav, .ta-nav, .about-nav"
  );

if (nav) {
  const menuItems = [
    {
      index: "01",
      label: "Investigación",
      detail: "Motor federado de búsqueda",
      href: "./"
    },
    {
      index: "02",
      label: "Tesis",
      detail: "Archivo universitario",
      href: "./tesis.html"
    },
    {
      index: "03",
      label: "Atlas",
      detail: "Cartografía de investigaciones",
      href: "./atlas.html"
    },
    {
      index: "04",
      label: "Resultados",
      detail: "Volver a la lista de búsqueda",
      href: "./#results"
    },
    {
      index: "05",
      label: "Filtros",
      detail: "Ajustar la investigación",
      href: "./#filters"
    },
    {
      index: "06",
      label: "Fuentes",
      detail: "Procedencia y cobertura",
      href: "./#fuentes"
    },
    {
      index: "07",
      label: "Acerca de",
      detail: "Proyecto, método y cifras",
      href: "./acerca.html"
    },
    {
      index: "08",
      label: "Licencia MIT",
      detail: "Código abierto y procedencia",
      href: "./acerca.html#licencia"
    }
  ];

  const toggle =
    document.createElement(
      "button"
    );

  toggle.type =
    "button";

  toggle.className =
    "site-menu-toggle";

  toggle.setAttribute(
    "aria-label",
    "Abrir menú"
  );

  toggle.setAttribute(
    "aria-expanded",
    "false"
  );

  toggle.setAttribute(
    "aria-controls",
    "site-mobile-menu"
  );

  toggle.innerHTML =
    '<span class="site-menu-toggle-lines" aria-hidden="true"><i></i><i></i><i></i></span>';

  nav.append(
    toggle
  );

  const backdrop =
    document.createElement(
      "button"
    );

  backdrop.type =
    "button";

  backdrop.className =
    "site-menu-backdrop";

  backdrop.setAttribute(
    "aria-label",
    "Cerrar menú"
  );

  backdrop.tabIndex =
    -1;

  const drawer =
    document.createElement(
      "aside"
    );

  drawer.id =
    "site-mobile-menu";

  drawer.className =
    "site-menu-drawer";

  drawer.setAttribute(
    "aria-hidden",
    "true"
  );

  drawer.setAttribute(
    "aria-label",
    "Menú principal"
  );

  drawer.innerHTML =
    `
      <div class="site-menu-drawer-head">
        <div>
          <span class="site-menu-kicker">Φ / NAVEGACIÓN</span>
          <h2 class="site-menu-title">Investigación Filosófica</h2>
        </div>

        <button
          type="button"
          class="site-menu-close"
          aria-label="Cerrar menú"
        >
          ×
        </button>
      </div>

      <nav class="site-menu-links" aria-label="Menú móvil">
        ${menuItems
          .map(
            item => `
              <a
                class="site-menu-link"
                href="${item.href}"
                data-site-menu-href="${item.href}"
              >
                <span class="site-menu-link-index">
                  ${item.index}
                </span>

                <span class="site-menu-link-copy">
                  <strong>${item.label}</strong>
                  <small>${item.detail}</small>
                </span>

                <span class="site-menu-link-arrow" aria-hidden="true">
                  →
                </span>
              </a>
            `
          )
          .join("")}
      </nav>

      <div class="site-menu-footer">
        <span class="site-menu-footer-label">Apariencia</span>

        <div class="site-menu-theme" role="group" aria-label="Apariencia">
          <button type="button" data-site-theme="light" aria-pressed="false">
            Claro
          </button>

          <button type="button" data-site-theme="dark" aria-pressed="false">
            Oscuro
          </button>
        </div>
      </div>
    `;

  document.body.append(
    backdrop,
    drawer
  );

  const closeButton =
    drawer.querySelector(
      ".site-menu-close"
    );

  const links =
    [
      ...drawer.querySelectorAll(
        ".site-menu-link"
      )
    ];

  const themeButtons =
    [
      ...drawer.querySelectorAll(
        "[data-site-theme]"
      )
    ];

  let previousFocus =
    null;

  function currentTheme() {
    return (
      document.documentElement
        .dataset.theme ===
        "light"
        ? "light"
        : "dark"
    );
  }

  function syncThemeControls() {
    const theme =
      currentTheme();

    for (
      const button of
      themeButtons
    ) {
      button.setAttribute(
        "aria-pressed",
        String(
          button.dataset
            .siteTheme ===
            theme
        )
      );
    }
  }

  function applyTheme(
    theme
  ) {
    const value =
      theme === "light"
        ? "light"
        : "dark";

    document.documentElement
      .dataset.theme =
      value;

    document.documentElement
      .style.colorScheme =
      value;

    const themeMeta =
      document.querySelector(
        'meta[name="theme-color"]'
      );

    if (themeMeta) {
      themeMeta.content =
        value === "dark"
          ? "#161616"
          : "#f4f4f4";
    }

    try {
      localStorage.setItem(
        STORAGE_KEY,
        value
      );
    } catch {
      // The visual choice still works without storage.
    }

    for (
      const button of
      document.querySelectorAll(
        "[data-theme-choice]"
      )
    ) {
      button.setAttribute(
        "aria-pressed",
        String(
          button.dataset
            .themeChoice ===
            value
        )
      );
    }

    syncThemeControls();

    window.dispatchEvent(
      new CustomEvent(
        "philosophythemechange",
        {
          detail: {
            theme: value
          }
        }
      )
    );
  }

  function markCurrentLink() {
    const path =
      window.location.pathname;

    for (
      const link of
      links
    ) {
      const href =
        link.dataset
          .siteMenuHref ||
        "";

      const isCurrent =
        (
          href === "./" &&
          (
            path.endsWith("/") ||
            path.endsWith(
              "/index.html"
            )
          )
        ) ||
        (
          href.includes(
            "tesis.html"
          ) &&
          path.endsWith(
            "/tesis.html"
          )
        ) ||
        (
          href.includes(
            "atlas.html"
          ) &&
          path.endsWith(
            "/atlas.html"
          )
        ) ||
        (
          href === "./acerca.html" &&
          path.endsWith(
            "/acerca.html"
          )
        );

      link.classList.toggle(
        "is-current",
        isCurrent
      );

      if (isCurrent) {
        link.setAttribute(
          "aria-current",
          "page"
        );
      } else {
        link.removeAttribute(
          "aria-current"
        );
      }
    }
  }

  function focusableElements() {
    return [
      ...drawer.querySelectorAll(
        'a[href], button:not([disabled])'
      )
    ];
  }

  function openMenu() {
    previousFocus =
      document.activeElement;

    drawer.classList.add(
      "is-open"
    );

    backdrop.classList.add(
      "is-open"
    );

    document.body.classList.add(
      "site-menu-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "false"
    );

    toggle.setAttribute(
      "aria-expanded",
      "true"
    );

    toggle.setAttribute(
      "aria-label",
      "Cerrar menú"
    );

    requestAnimationFrame(
      () => {
        closeButton?.focus();
      }
    );
  }

  function closeMenu({
    restoreFocus = true
  } = {}) {
    drawer.classList.remove(
      "is-open"
    );

    backdrop.classList.remove(
      "is-open"
    );

    document.body.classList.remove(
      "site-menu-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "true"
    );

    toggle.setAttribute(
      "aria-expanded",
      "false"
    );

    toggle.setAttribute(
      "aria-label",
      "Abrir menú"
    );

    if (
      restoreFocus &&
      previousFocus instanceof
        HTMLElement
    ) {
      previousFocus.focus();
    }
  }

  toggle.addEventListener(
    "click",
    () => {
      if (
        drawer.classList.contains(
          "is-open"
        )
      ) {
        closeMenu();
      } else {
        openMenu();
      }
    }
  );

  closeButton?.addEventListener(
    "click",
    () => {
      closeMenu();
    }
  );

  backdrop.addEventListener(
    "click",
    () => {
      closeMenu();
    }
  );

  for (
    const link of
    links
  ) {
    link.addEventListener(
      "click",
      () => {
        closeMenu({
          restoreFocus: false
        });
      }
    );
  }

  for (
    const button of
    themeButtons
  ) {
    button.addEventListener(
      "click",
      () => {
        applyTheme(
          button.dataset.siteTheme
        );
      }
    );
  }

  document.addEventListener(
    "keydown",
    event => {
      if (
        !drawer.classList.contains(
          "is-open"
        )
      ) {
        return;
      }

      if (
        event.key ===
        "Escape"
      ) {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (
        event.key !==
        "Tab"
      ) {
        return;
      }

      const focusable =
        focusableElements();

      if (
        !focusable.length
      ) {
        return;
      }

      const first =
        focusable[0];

      const last =
        focusable[
          focusable.length - 1
        ];

      if (
        event.shiftKey &&
        document.activeElement ===
          first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement ===
          last
      ) {
        event.preventDefault();
        first.focus();
      }
    }
  );

  window.matchMedia(
    `(min-width: ${MOBILE_MENU_BREAKPOINT + 1}px)`
  ).addEventListener(
    "change",
    event => {
      if (event.matches) {
        closeMenu({
          restoreFocus: false
        });
      }
    }
  );

  window.addEventListener(
    "philosophythemechange",
    syncThemeControls
  );

  markCurrentLink();
  syncThemeControls();
}

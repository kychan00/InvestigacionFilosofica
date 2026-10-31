const STORAGE_KEY =
  "investigacion-filosofica-theme";

const root =
  document.documentElement;

const themeMeta =
  document.querySelector(
    'meta[name="theme-color"]'
  );

const buttons =
  [...document.querySelectorAll(
    "[data-theme-choice]"
  )];


function normalizedTheme(
  value
) {
  return value === "light"
    ? "light"
    : "dark";
}


function updateControls(
  theme
) {
  for (const button of buttons) {
    const isActive =
      button.dataset.themeChoice ===
      theme;

    button.setAttribute(
      "aria-pressed",
      String(isActive)
    );
  }
}


function applyTheme(
  value,
  {
    persist = false
  } = {}
) {
  const theme =
    normalizedTheme(value);

  root.dataset.theme =
    theme;

  root.style.colorScheme =
    theme;

  if (themeMeta) {
    themeMeta.content =
      theme === "dark"
        ? "#161616"
        : "#f4f4f4";
  }

  updateControls(theme);

  if (persist) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        theme
      );
    } catch {
      // The visual choice still works when storage is unavailable.
    }
  }

  window.dispatchEvent(
    new CustomEvent(
      "philosophythemechange",
      {
        detail: {
          theme
        }
      }
    )
  );
}


for (const button of buttons) {
  button.addEventListener(
    "click",
    () => {
      applyTheme(
        button.dataset.themeChoice,
        {
          persist: true
        }
      );
    }
  );
}


applyTheme(
  root.dataset.theme
);


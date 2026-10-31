import assert from "node:assert/strict";
import {
  readFile
} from "node:fs/promises";
import test from "node:test";


test(
  "ofrece Día y Oscuro antes de cargar la aplicación",
  async () => {
    const html =
      await readFile(
        new URL(
          "../index.html",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      html,
      /data-theme-choice="light"/u
    );

    assert.match(
      html,
      /data-theme-choice="dark"/u
    );

    assert.match(
      html,
      /localStorage\.getItem\(key\)/u
    );

    assert.match(
      html,
      /prefers-color-scheme: dark/u
    );

    assert.match(
      html,
      /theme\.css\?v=20261031-day-night-v4/u
    );

    assert.match(
      html,
      /theme\.js\?v=20261031-day-night-v1/u
    );
  }
);


test(
  "persiste una preferencia explícita y sincroniza accesibilidad",
  async () => {
    const source =
      await readFile(
        new URL(
          "../js/theme.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /localStorage\.setItem/u
    );

    assert.match(
      source,
      /aria-pressed/u
    );

    assert.match(
      source,
      /root\.style\.colorScheme/u
    );

    assert.match(
      source,
      /philosophythemechange/u
    );
  }
);


test(
  "ambos temas cubren superficies y conservan controles móviles táctiles",
  async () => {
    const css =
      await readFile(
        new URL(
          "../css/theme.css",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      css,
      /html\[data-theme="light"\]/u
    );

    assert.match(
      css,
      /html\[data-theme="dark"\]/u
    );

    assert.match(
      css,
      /\.research-workspace,[\s\S]*\.result-card,[\s\S]*\.record-modal-panel/u
    );

    assert.match(
      css,
      /\.theme-switch button\s*\{[\s\S]*min-height:\s*40px/u
    );

    assert.match(
      css,
      /@media \(max-width: 620px\)[\s\S]*\.theme-switch/u
    );

    assert.match(
      css,
      /\.result-card\s*\{[\s\S]*border-left-color:\s*var\(--pg-blue\)\s*!important/u
    );
  }
);


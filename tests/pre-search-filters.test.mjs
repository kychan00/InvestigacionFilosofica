import assert from "node:assert/strict";
import {
  readFile
} from "node:fs/promises";
import test from "node:test";


test(
  "los filtros esenciales existen antes de buscar y la fuente permanece fija",
  async () => {
    const html =
      await readFile(
        new URL(
          "../index.html",
          import.meta.url
        ),
        "utf8"
      );

    const filtersPosition =
      html.indexOf(
        'id="filters"'
      );

    const workspacePosition =
      html.indexOf(
        'id="research-workspace"'
      );

    assert.ok(
      filtersPosition > 0
    );

    assert.ok(
      filtersPosition <
        workspacePosition
    );

    for (const id of [
      "filter-year-from",
      "filter-year-to",
      "filter-language",
      "filter-type",
      "filter-sort",
      "filter-reset"
    ]) {
      assert.match(
        html,
        new RegExp(
          `id="${id}"`,
          "u"
        )
      );
    }

    assert.doesNotMatch(
      html,
      /id="filter-provider"/u
    );

    assert.match(
      html,
      /las fuentes académicas permanecen activas/u
    );
  }
);


test(
  "la selección inicial filtra lotes progresivos y viaja al API semántico",
  async () => {
    const app =
      await readFile(
        new URL(
          "../js/app.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      app,
      /function buildSemanticSearchFilters\(\)/u
    );

    assert.match(
      app,
      /filters:\s*semanticFilters/u
    );

    assert.match(
      app,
      /currentFilteredResults\s*=\s*filterAndSortResults\(\s*response\.results/u
    );

    assert.match(
      app,
      /El año inicial no puede ser posterior al año final/u
    );
  }
);


test(
  "la consola de filtros conserva retícula y controles táctiles responsive",
  async () => {
    const [
      desktop,
      mobile
    ] = await Promise.all([
      readFile(
        new URL(
          "../css/philosophical-grid.css",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../css/mobile-layout.css",
          import.meta.url
        ),
        "utf8"
      )
    ]);

    assert.match(
      desktop,
      /\.search-filter-grid\s*\{[\s\S]*grid-template-columns:/u
    );

    assert.match(
      mobile,
      /\.search-filter-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/u
    );

    assert.match(
      mobile,
      /\.search-filter-grid :is\(select, input\)[\s\S]*min-height:\s*48px/u
    );

    assert.match(
      mobile,
      /\.search-filters #filter-reset\s*\{[\s\S]*min-height:\s*44px/u
    );
  }
);

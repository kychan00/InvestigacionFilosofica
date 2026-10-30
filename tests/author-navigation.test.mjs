import assert from "node:assert/strict";
import test from "node:test";

import {
  isMobileAuthorNavigation,
  openAuthorDestination,
  shouldHandleAuthorLinkClick
} from "../src/core/author-navigation.js";


test(
  "detecta móvil por hint o por puntero táctil en viewport compacto",
  () => {
    assert.equal(
      isMobileAuthorNavigation({
        mobileHint: true,
        coarsePointer: false,
        compactViewport: false
      }),
      true
    );
    assert.equal(
      isMobileAuthorNavigation({
        mobileHint: false,
        coarsePointer: true,
        compactViewport: true
      }),
      true
    );
    assert.equal(
      isMobileAuthorNavigation({
        mobileHint: false,
        coarsePointer: false,
        compactViewport: true
      }),
      false
    );
  }
);


test(
  "abre un contexto nuevo y elimina la referencia opener",
  () => {
    const context = { opener: "source" };
    let navigated = false;
    const outcome = openAuthorDestination(
      "https://example.test/author",
      {
        openImpl: (url, target) => {
          assert.equal(
            url,
            "https://example.test/author"
          );
          assert.equal(target, "_blank");
          return context;
        },
        navigateImpl: () => {
          navigated = true;
        }
      }
    );

    assert.equal(outcome, "new-context");
    assert.equal(context.opener, null);
    assert.equal(navigated, false);
  }
);


test(
  "si el webview bloquea pestañas navega en el contexto actual",
  () => {
    let destination = null;
    const outcome = openAuthorDestination(
      "https://example.test/author",
      {
        openImpl: () => null,
        navigateImpl: url => {
          destination = url;
        }
      }
    );

    assert.equal(outcome, "same-context");
    assert.equal(
      destination,
      "https://example.test/author"
    );
  }
);


test(
  "sólo intercepta un toque primario móvil sin modificadores",
  () => {
    const mobile = {
      mobileHint: true,
      coarsePointer: true,
      compactViewport: true
    };

    assert.equal(
      shouldHandleAuthorLinkClick(
        {
          button: 0,
          defaultPrevented: false,
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false
        },
        mobile
      ),
      true
    );
    assert.equal(
      shouldHandleAuthorLinkClick(
        {
          button: 0,
          defaultPrevented: false,
          metaKey: false,
          ctrlKey: true,
          shiftKey: false,
          altKey: false
        },
        mobile
      ),
      false
    );
    assert.equal(
      shouldHandleAuthorLinkClick(
        {
          button: 0,
          defaultPrevented: false
        },
        {
          mobileHint: false,
          coarsePointer: false,
          compactViewport: false
        }
      ),
      false
    );
  }
);

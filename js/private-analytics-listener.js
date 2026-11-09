import {
  logAuthorEvent,
  logSearchQuery
} from "./private-analytics.js?v=20261108-v2";

function activeSearchMode() {
  const selected =
    document.querySelector(
      '[data-search-mode].is-active, [data-search-mode][aria-pressed="true"]'
    )?.dataset?.searchMode || "unknown";

  return selected === "semantic"
    ? "semantic"
    : selected === "federated" || selected === "traditional"
      ? "federated"
      : "unknown";
}

function authorFromHref(href, fallbackName = "") {
  try {
    const url = new URL(
      href,
      window.location.href
    );

    return {
      name:
        url.searchParams.get("author") ||
        String(fallbackName || "").trim(),
      id:
        url.searchParams.get("authorId"),
      orcid:
        url.searchParams.get("authorOrcid")
    };
  } catch {
    return {
      name: String(fallbackName || "").trim(),
      id: null,
      orcid: null
    };
  }
}

function bindSearchHistory() {
  const form =
    document.querySelector("#search-form");
  const input =
    document.querySelector("#search-input");

  if (!form || !input) {
    return;
  }

  form.addEventListener(
    "submit",
    () => {
      const query =
        String(input.value || "").trim();

      if (!query) {
        return;
      }

      void logSearchQuery(
        query,
        {
          mode: activeSearchMode()
        }
      );
    },
    true
  );
}

function bindAuthorHistory() {
  document.addEventListener(
    "click",
    event => {
      const link =
        event.target?.closest?.(
          "a.author-work-link, a.author-coauthor-link"
        );

      if (link) {
        const author =
          authorFromHref(
            link.href,
            link.textContent
          );

        if (author.name) {
          void logAuthorEvent(
            author,
            {
              eventType: "clicked",
              source:
                link.classList.contains(
                  "author-coauthor-link"
                )
                  ? "coauthor-link"
                  : "author-link"
            }
          );
        }
      }

      const candidate =
        event.target?.closest?.(
          "button.author-candidate"
        );

      if (candidate) {
        const name =
          candidate.querySelector("span")
            ?.textContent?.trim() ||
          candidate.textContent?.trim() ||
          "";

        if (name) {
          void logAuthorEvent(
            {
              name,
              id:
                candidate.dataset.authorId ||
                null,
              orcid: null
            },
            {
              eventType: "clicked",
              source: "author-candidate"
            }
          );
        }
      }
    },
    true
  );
}

function logAuthorViewFromUrl() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  if (
    params.get("view") !== "author"
  ) {
    return;
  }

  const name =
    String(
      params.get("author") || ""
    ).trim();

  if (!name) {
    return;
  }

  void logAuthorEvent(
    {
      name,
      id:
        params.get("authorId"),
      orcid:
        params.get("authorOrcid")
    },
    {
      eventType: "searched",
      source: "author-view"
    }
  );
}

bindSearchHistory();
bindAuthorHistory();
logAuthorViewFromUrl();

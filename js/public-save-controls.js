import {
  hasVerifiedAuthHint
} from "./auth-session-hint.js";

function bookmarkIcon() {
  return `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path class="save-bookmark-shape" d="M6.75 4.5h10.5v15l-5.25-3.6-5.25 3.6z"></path>
    </svg>
  `;
}

function createSaveButton(kind, payload, {
  label = kind === "author" ? "Guardar autor" : "Guardar en biblioteca",
  className = ""
} = {}) {
  if (!hasVerifiedAuthHint() || !payload) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = [
    kind === "author" ? "author-save-button" : "research-save-button",
    className
  ].filter(Boolean).join(" ");
  button.dataset.saveIcon = "";
  button.dataset.privateSave = kind;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = bookmarkIcon();

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    window.dispatchEvent(
      new CustomEvent(
        kind === "author"
          ? "research-library:save-author"
          : "research-library:save-work",
        {
          detail: kind === "author"
            ? { author: payload, trigger: button }
            : { work: payload, trigger: button }
        }
      )
    );
  });

  return button;
}

export function createWorkSaveButton(work, options) {
  return createSaveButton("work", work, options);
}

export function createAuthorSaveButton(author, options) {
  return createSaveButton("author", author, options);
}

export {
  hasVerifiedAuthHint
};

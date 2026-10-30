export function isMobileAuthorNavigation(
  environment = {}
) {
  const mobileHint =
    environment.mobileHint ??
    globalThis.navigator
      ?.userAgentData
      ?.mobile;
  const coarsePointer =
    environment.coarsePointer ??
    globalThis.matchMedia
      ?.("(pointer: coarse)")
      ?.matches;
  const compactViewport =
    environment.compactViewport ??
    globalThis.matchMedia
      ?.("(max-width: 1024px)")
      ?.matches;

  return (
    mobileHint === true ||
    (
      coarsePointer === true &&
      compactViewport === true
    )
  );
}


export function openAuthorDestination(
  url,
  options = {}
) {
  const destination = String(url || "");

  if (!destination) {
    return "ignored";
  }

  const openImpl =
    options.openImpl ||
    globalThis.open?.bind(globalThis);
  const navigateImpl =
    options.navigateImpl ||
    (value => globalThis.location?.assign(value));
  let opened = null;

  try {
    opened = openImpl?.(
      destination,
      "_blank"
    ) || null;
  } catch {
    opened = null;
  }

  if (opened) {
    try {
      opened.opener = null;
    } catch {
      // Algunos webviews no exponen la referencia del contexto nuevo.
    }

    return "new-context";
  }

  navigateImpl(destination);
  return "same-context";
}


export function shouldHandleAuthorLinkClick(
  event,
  environment = {}
) {
  return Boolean(
    isMobileAuthorNavigation(environment) &&
    event?.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

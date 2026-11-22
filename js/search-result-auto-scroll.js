/**
 * Reveals the first real search card once per explicitly submitted search.
 * Progressive searches replace the result DOM many times; scrolling must
 * neither target loading skeletons nor repeat on every partial response.
 */
export function createSearchResultAutoScroll({
  results,
  scheduleFrame = callback => window.requestAnimationFrame(callback),
  reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
}) {
  let pending = false;
  let searchVersion = 0;
  let scheduledVersion = -1;

  function arm() {
    searchVersion += 1;
    pending = true;
  }

  function reveal() {
    if (!pending || !results.querySelector("article.result-card")) return;

    const version = searchVersion;
    if (scheduledVersion === version) return;
    scheduledVersion = version;

    scheduleFrame(() => {
      if (scheduledVersion === version) scheduledVersion = -1;
      if (!pending || version !== searchVersion) return;

      // The first partial set may have been replaced before the next frame.
      const firstCard = results.querySelector("article.result-card");
      if (!firstCard) return;

      pending = false;
      firstCard.scrollIntoView({
        block: "start",
        behavior: reducedMotion() ? "auto" : "smooth"
      });
    });
  }

  return { arm, reveal };
}

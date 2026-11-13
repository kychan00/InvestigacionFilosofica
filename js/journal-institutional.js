/* Progressive enhancement only. All editorial copy remains visible without JS. */
const profile = document.querySelector(".ji");

if (profile) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveals = [...profile.querySelectorAll("[data-reveal]")];

  if (!reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.09 });

    for (const node of reveals) {
      if (node.getBoundingClientRect().top < window.innerHeight) {
        node.classList.add("is-visible");
      } else {
        node.classList.add("is-reveal-ready");
        observer.observe(node);
      }
    }
  }

  const links = [...profile.querySelectorAll('.nav-links a[href^="#"]')];
  for (const link of links) {
    link.addEventListener("click", () => {
      for (const other of links) {
        other.removeAttribute("aria-current");
      }
      link.setAttribute("aria-current", "location");
    });
  }
}

const page = document.querySelector(".dx-page");
const root = document.documentElement;
const themeMeta = document.querySelector('meta[name="theme-color"]');
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const THEME_KEY = "investigacion-filosofica-theme";

function activateByKeyboard(node, callback) {
  node.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    callback();
  });
}

function setTheme(theme) {
  const value = theme === "dark" ? "dark" : "light";
  root.dataset.theme = value;
  root.style.colorScheme = value;
  if (themeMeta) themeMeta.content = value === "dark" ? "#171a18" : "#1c2d22";
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch {}
}

document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
  setTheme(root.dataset.theme === "dark" ? "light" : "dark");
});

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.scrollTarget);
    target?.scrollIntoView({
      behavior: reducedMotion.matches ? "auto" : "smooth",
      block: "start"
    });
  });
});

const revealNodes = [...document.querySelectorAll("[data-reveal]")];
if (reducedMotion.matches) {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
} else {
  revealNodes.forEach((node) => node.classList.add("is-reveal-ready"));
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  revealNodes.forEach((node) => revealObserver.observe(node));
}

const engineData = {
  position: {
    index: "01 / 04",
    title: "Posición",
    copy:
      "Alguien afirma algo: propone una definición, una hipótesis o una tesis. La investigación necesita algo suficientemente claro como para poder ser cuestionado.",
    question:
      "Pregunta para decir en voz alta: “¿Qué estoy sosteniendo exactamente?”"
  },
  opposition: {
    index: "02 / 04",
    title: "Oposición",
    copy:
      "Otra posición, una pregunta crítica o un contraejemplo obliga a mostrar supuestos, límites y consecuencias que la tesis inicial podía dejar ocultos.",
    question:
      "Pregunta para decir en voz alta: “¿Qué tendría que responder alguien que no acepta mi tesis?”"
  },
  examination: {
    index: "03 / 04",
    title: "Examen",
    copy:
      "Se comparan razones, consecuencias, objeciones y compromisos. El desacuerdo deja de ser ruido y se convierte en procedimiento de investigación.",
    question:
      "Pregunta para decir en voz alta: “¿Mis razones sobreviven a la mejor objeción disponible?”"
  },
  revision: {
    index: "04 / 04",
    title: "Revisión",
    copy:
      "Después del examen, una tesis puede mantenerse, corregirse, distinguirse mejor o abandonarse. La conclusión no queda blindada contra nuevas críticas.",
    question:
      "Pregunta para decir en voz alta: “¿Qué cambió en mi posición después de la crítica?”"
  }
};

const engineMap = document.querySelector("[data-engine-map]");
const engineIndex = document.querySelector("[data-engine-index]");
const engineTitle = document.querySelector("[data-engine-title]");
const engineCopy = document.querySelector("[data-engine-copy]");
const engineQuestion = document.querySelector("[data-engine-question]");
const engineNodes = [...document.querySelectorAll("[data-engine-node]")];

function selectEngineStep(key) {
  const data = engineData[key];
  if (!data) return;

  engineMap?.setAttribute("data-engine-map", key);
  engineNodes.forEach((node) => {
    node.classList.toggle("is-active", node.dataset.engineNode === key);
  });

  if (engineIndex) engineIndex.textContent = data.index;
  if (engineTitle) engineTitle.textContent = data.title;
  if (engineCopy) engineCopy.textContent = data.copy;
  if (engineQuestion) engineQuestion.textContent = data.question;
}

engineNodes.forEach((node) => {
  const choose = () => selectEngineStep(node.dataset.engineNode);
  node.addEventListener("click", choose);
  activateByKeyboard(node, choose);
});

document.querySelectorAll("[data-hero-bubble]").forEach((bubble) => {
  const choose = () => {
    document.querySelectorAll("[data-hero-bubble]").forEach((item) => item.classList.remove("is-active"));
    bubble.classList.add("is-active");
    selectEngineStep(bubble.dataset.heroBubble === "opposition" ? "opposition" : "position");
    window.setTimeout(() => bubble.classList.remove("is-active"), 1200);
  };

  bubble.addEventListener("click", choose);
  activateByKeyboard(bubble, choose);
});

const timelineButtons = [...document.querySelectorAll("[data-timeline-target]")];
const eraNodes = [...document.querySelectorAll("[data-era]")];

function selectTimeline(id, { scroll = false } = {}) {
  timelineButtons.forEach((button) => {
    const selected = button.dataset.timelineTarget === id;
    button.setAttribute("aria-selected", String(selected));
  });

  if (scroll) {
    document.getElementById(id)?.scrollIntoView({
      behavior: reducedMotion.matches ? "auto" : "smooth",
      block: "start"
    });
  }
}

timelineButtons.forEach((button, index) => {
  button.addEventListener("click", () => selectTimeline(button.dataset.timelineTarget, { scroll: true }));
  button.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = Math.min(timelineButtons.length - 1, Math.max(0, index + offset));
    const next = timelineButtons[nextIndex];
    next.focus();
    selectTimeline(next.dataset.timelineTarget, { scroll: true });
  });
});

const eraObserver = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visible?.target?.dataset?.era) {
      selectTimeline(visible.target.dataset.era);
    }
  },
  { threshold: [0.25, 0.5, 0.7], rootMargin: "-12% 0px -52% 0px" }
);
eraNodes.forEach((node) => eraObserver.observe(node));

const ideaData = {
  socrates: {
    title: "Sócrates y Platón",
    copy:
      "La investigación no arranca con una respuesta definitiva. Empieza cuando una definición es interrogada y aparecen sus límites. La refutación no es el final: abre una nueva búsqueda.",
    board: "¿Qué es X? → respuesta → objeción → corrección"
  },
  aristoteles: {
    title: "Aristóteles",
    copy:
      "Aristóteles separa demostración y dialéctica. Cuando no hay necesidad deductiva, todavía podemos comparar posiciones plausibles mediante razones y objeciones.",
    board: "tesis A ↔ tesis B · ¿cuál resiste mejor?"
  },
  kant: {
    title: "Kant",
    copy:
      "La dialéctica sirve como diagnóstico. Dos argumentos enfrentados pueden mostrar no una síntesis, sino que la razón intenta ir más allá de aquello que puede conocer legítimamente.",
    board: "tesis ↔ antítesis → antinomia → límite"
  },
  "hegel-marx": {
    title: "Hegel y Marx",
    copy:
      "La contradicción cambia de lugar. Hegel la convierte en motor del desarrollo; Marx la reinterpreta desde condiciones materiales, antagonismos y conflicto histórico.",
    board: "oposición real → conflicto → transformación"
  }
};

const drawer = document.querySelector("[data-idea-drawer]");
const drawerTitle = document.querySelector("[data-idea-title]");
const drawerCopy = document.querySelector("[data-idea-copy]");
const drawerBoard = document.querySelector("[data-idea-board]");
const drawerClose = document.querySelector("[data-idea-close]");
const drawerBackdrop = document.querySelector("[data-idea-backdrop]");
let previousFocus = null;

function openIdea(key) {
  const data = ideaData[key];
  if (!data || !page || !drawer) return;

  previousFocus = document.activeElement;
  drawerTitle.textContent = data.title;
  drawerCopy.textContent = data.copy;
  drawerBoard.textContent = data.board;
  page.classList.add("is-drawer-open");
  drawer.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => drawerClose?.focus());
}

function closeIdea({ restore = true } = {}) {
  if (!page || !drawer) return;
  page.classList.remove("is-drawer-open");
  drawer.setAttribute("aria-hidden", "true");

  if (restore && previousFocus instanceof HTMLElement) {
    previousFocus.focus();
  }
}

document.querySelectorAll("[data-idea-open]").forEach((button) => {
  button.addEventListener("click", () => openIdea(button.dataset.ideaOpen));
});
drawerClose?.addEventListener("click", () => closeIdea());
drawerBackdrop?.addEventListener("click", () => closeIdea());

const discussionData = {
  confrontacion: {
    index: "01 / 04",
    title: "Confrontación",
    copy:
      "Se identifica exactamente en qué consiste el desacuerdo: alguien sostiene una tesis y otra persona no la acepta.",
    board: "A: p · B: “no acepto p”"
  },
  apertura: {
    index: "02 / 04",
    title: "Apertura",
    copy:
      "Se acuerdan puntos de partida, reglas, roles y compromisos. Sin un terreno común, la discusión crítica no puede avanzar.",
    board: "¿qué aceptamos? · ¿quién defiende? · ¿qué reglas?"
  },
  argumentacion: {
    index: "03 / 04",
    title: "Argumentación",
    copy:
      "La tesis ofrece razones y recibe objeciones. El protagonista puede aclarar, conceder, distinguir, corregir o responder.",
    board: "p porque r₁, r₂… ↔ objeciones"
  },
  conclusion: {
    index: "04 / 04",
    title: "Conclusión",
    copy:
      "Se decide qué ocurrió racionalmente: la tesis fue defendida, retirada, corregida o la controversia permanece abierta.",
    board: "mantener · corregir · abandonar · seguir abierto"
  }
};

const discussionNodes = [...document.querySelectorAll("[data-discussion-stage]")];
const discussionIndex = document.querySelector("[data-discussion-index]");
const discussionTitle = document.querySelector("[data-discussion-title]");
const discussionCopy = document.querySelector("[data-discussion-copy]");
const discussionBoard = document.querySelector("[data-discussion-board]");

function selectDiscussionStage(key) {
  const data = discussionData[key];
  if (!data) return;

  discussionNodes.forEach((node) => {
    node.classList.toggle("is-active", node.dataset.discussionStage === key);
  });

  discussionIndex.textContent = data.index;
  discussionTitle.textContent = data.title;
  discussionCopy.textContent = data.copy;
  discussionBoard.textContent = data.board;
}

discussionNodes.forEach((node) => {
  const choose = () => selectDiscussionStage(node.dataset.discussionStage);
  node.addEventListener("click", choose);
  activateByKeyboard(node, choose);
});
selectDiscussionStage("confrontacion");

const antimonyButtons = [...document.querySelectorAll("[data-antimony]")];
antimonyButtons.forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    const next = button.getAttribute("aria-pressed") !== "true";
    antimonyButtons.forEach((item) => {
      item.classList.remove("is-active");
      item.setAttribute("aria-pressed", "false");
    });
    if (next) {
      button.classList.add("is-active");
      button.setAttribute("aria-pressed", "true");
    }
  });
});

document.querySelectorAll("[data-final-step]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-final-step]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
  });
});

const presentationScenes = [
  { id: "nucleo", label: "Núcleo" },
  { id: "recorrido", label: "Recorrido histórico" },
  { id: "actualidad", label: "Actualidad" },
  { id: "cierre", label: "Cierre" }
];

const presentationToggle = document.querySelector("[data-presentation-toggle]");
const presentationExit = document.querySelector("[data-presentation-exit]");
const presentationPrev = document.querySelector("[data-present-prev]");
const presentationNext = document.querySelector("[data-present-next]");
const presentationStatus = document.querySelector("[data-present-status]");
let presentationIndex = 0;

function syncPresentationStatus() {
  const scene = presentationScenes[presentationIndex];
  if (!scene || !presentationStatus) return;
  presentationStatus.textContent =
    `${String(presentationIndex + 1).padStart(2, "0")} / ${String(presentationScenes.length).padStart(2, "0")} · ${scene.label}`;
}

function goPresentation(index) {
  presentationIndex = Math.min(presentationScenes.length - 1, Math.max(0, index));
  syncPresentationStatus();
  document.getElementById(presentationScenes[presentationIndex].id)?.scrollIntoView({
    behavior: reducedMotion.matches ? "auto" : "smooth",
    block: "start"
  });
}

function setPresentationMode(enabled) {
  if (!page || !presentationToggle) return;
  page.classList.toggle("is-presenting", enabled);
  presentationToggle.setAttribute("aria-pressed", String(enabled));
  presentationToggle.firstChild.textContent = enabled ? "Exponiendo " : "Exponer ";
  if (enabled) {
    const currentSceneIndex = presentationScenes.findIndex(({ id }) => {
      const node = document.getElementById(id);
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      return rect.top <= window.innerHeight * 0.42 && rect.bottom >= window.innerHeight * 0.42;
    });
    if (currentSceneIndex >= 0) presentationIndex = currentSceneIndex;
    syncPresentationStatus();
  }
}

presentationToggle?.addEventListener("click", () => {
  setPresentationMode(!page.classList.contains("is-presenting"));
});
presentationExit?.addEventListener("click", () => setPresentationMode(false));
presentationPrev?.addEventListener("click", () => goPresentation(presentationIndex - 1));
presentationNext?.addEventListener("click", () => goPresentation(presentationIndex + 1));

document.addEventListener("keydown", (event) => {
  if (page?.classList.contains("is-drawer-open")) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeIdea();
    }
    return;
  }

  if (!page?.classList.contains("is-presenting")) return;

  if (event.key === "Escape") {
    event.preventDefault();
    setPresentationMode(false);
  } else if (event.key === "ArrowRight" || event.key === "PageDown") {
    event.preventDefault();
    goPresentation(presentationIndex + 1);
  } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
    event.preventDefault();
    goPresentation(presentationIndex - 1);
  }
});

const presentationObserver = new IntersectionObserver(
  (entries) => {
    if (!page?.classList.contains("is-presenting")) return;
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;
    const index = presentationScenes.findIndex((scene) => scene.id === visible.target.id);
    if (index >= 0) {
      presentationIndex = index;
      syncPresentationStatus();
    }
  },
  { threshold: [0.35, 0.55], rootMargin: "-8% 0px -38% 0px" }
);

presentationScenes.forEach(({ id }) => {
  const node = document.getElementById(id);
  if (node) presentationObserver.observe(node);
});

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

const socraticData = [
  {
    key: "question",
    speaker: "SÓCRATES",
    speakerClass: "socrates",
    line: "¿Qué es X?",
    note: "1 · formular la pregunta",
    title: "Pregunta",
    caption: "La investigación comienza haciendo explícito qué se quiere definir."
  },
  {
    key: "answer",
    speaker: "INTERLOCUTOR",
    speakerClass: "interlocutor",
    line: "X es…",
    note: "2 · definición provisional",
    title: "Respuesta provisional",
    caption: "La primera respuesta no se toma como definitiva: se convierte en algo que puede ser examinado."
  },
  {
    key: "objection",
    speaker: "SÓCRATES",
    speakerClass: "socrates",
    line: "¿Y qué ocurre con este caso?",
    note: "3 · introducir la objeción",
    title: "Objeción",
    caption: "La respuesta se prueba mediante consecuencias, distinciones o contraejemplos."
  },
  {
    key: "revision",
    speaker: "INTERLOCUTOR",
    speakerClass: "interlocutor",
    line: "Entonces debo corregirlo.",
    note: "4 · reconocer y revisar",
    title: "Revisión",
    caption: "Reconocer el problema no cierra la investigación: obliga a reformular la posición."
  }
];

const socraticScene = document.querySelector("[data-socratic-scene]");
const socraticBubble = document.querySelector("[data-socratic-bubble]");
const socraticSpeaker = document.querySelector("[data-socratic-speaker]");
const socraticLine = document.querySelector("[data-socratic-line]");
const socraticNote = document.querySelector("[data-socratic-note]");
const socraticIndex = document.querySelector("[data-socratic-index]");
const socraticTitle = document.querySelector("[data-socratic-title]");
const socraticCaption = document.querySelector("[data-socratic-caption]");
const socraticPrev = document.querySelector("[data-socratic-prev]");
const socraticNext = document.querySelector("[data-socratic-next]");
let socraticStep = 0;

function selectSocraticStep(index) {
  socraticStep = (index + socraticData.length) % socraticData.length;
  const data = socraticData[socraticStep];
  if (!data || !socraticScene) return;

  socraticScene.dataset.socraticStep = data.key;
  socraticScene.className = socraticScene.className
    .replace(/\bis-step-[\w-]+\b/g, "")
    .replace(/\bis-speaker-[\w-]+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  socraticScene.classList.add(`is-step-${data.key}`, `is-speaker-${data.speakerClass}`);

  if (socraticSpeaker) socraticSpeaker.textContent = data.speaker;
  if (socraticLine) socraticLine.textContent = data.line;
  if (socraticNote) socraticNote.textContent = data.note;
  if (socraticIndex) socraticIndex.textContent = `${String(socraticStep + 1).padStart(2, "0")} / 04`;
  if (socraticTitle) socraticTitle.textContent = data.title;
  if (socraticCaption) socraticCaption.textContent = data.caption;
}

socraticPrev?.addEventListener("click", () => selectSocraticStep(socraticStep - 1));
socraticNext?.addEventListener("click", () => selectSocraticStep(socraticStep + 1));
if (socraticBubble) {
  const advanceSocratic = () => selectSocraticStep(socraticStep + 1);
  socraticBubble.addEventListener("click", advanceSocratic);
  activateByKeyboard(socraticBubble, advanceSocratic);
}
selectSocraticStep(0);

const kantScene = document.querySelector("[data-kant-scene]");
const kantControls = [...document.querySelectorAll("[data-kant-control]")];
const kantPaths = [...document.querySelectorAll("[data-kant-path]")];
const kantIndex = document.querySelector("[data-kant-index]");
const kantTitle = document.querySelector("[data-kant-title]");
const kantCaption = document.querySelector("[data-kant-caption]");
const kantVisited = new Set();

const kantData = {
  libertad: {
    index: "01 / 03",
    title: "Tesis · libertad",
    caption: "Recorra este lado como una posición racionalmente defendible. Todavía no hemos resuelto el conflicto."
  },
  determinismo: {
    index: "02 / 03",
    title: "Antítesis · determinismo",
    caption: "La posición contraria también puede construirse racionalmente. La tensión aparece entre dos pretensiones fuertes."
  },
  limit: {
    index: "03 / 03",
    title: "Antinomia · límite",
    caption: "El choque no obliga a fabricar una síntesis: puede mostrar que la razón está excediendo el ámbito de la experiencia."
  }
};

function syncKantLimitAvailability() {
  const limitButton = document.querySelector('[data-kant-control="limit"]');
  if (!limitButton) return;
  const ready = kantVisited.has("libertad") && kantVisited.has("determinismo");
  limitButton.disabled = !ready;
  limitButton.setAttribute(
    "title",
    ready ? "Revelar la antinomia" : "Recorra primero los dos senderos"
  );
}

function selectKantState(state) {
  if (!kantScene || !kantData[state]) return;
  if (state === "limit" && !(kantVisited.has("libertad") && kantVisited.has("determinismo"))) return;

  if (state !== "limit") kantVisited.add(state);
  kantScene.dataset.kantState = state;

  kantControls.forEach((button) => {
    const active = button.dataset.kantControl === state;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll("[data-antimony]").forEach((button) => {
    const active = button.dataset.antimony === state;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const data = kantData[state];
  if (kantIndex) kantIndex.textContent = data.index;
  if (kantTitle) kantTitle.textContent = data.title;
  if (kantCaption) kantCaption.textContent = data.caption;

  syncKantLimitAvailability();
}

kantControls.forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => selectKantState(button.dataset.kantControl));
});

kantPaths.forEach((path) => {
  const choose = () => selectKantState(path.dataset.kantPath);
  path.addEventListener("click", choose);
  activateByKeyboard(path, choose);
});
syncKantLimitAvailability();

const transformationData = [
  {
    key: "determination",
    title: "Determinación",
    caption: "Partimos de una forma que parece estable antes de mostrar la tensión que contiene."
  },
  {
    key: "opposition",
    title: "Oposición",
    caption: "La forma encuentra aquello que la contradice: la relación conflictiva pasa al primer plano."
  },
  {
    key: "sublation",
    title: "Superación",
    caption: "La oposición no se borra simplemente: el proceso desemboca en una nueva configuración."
  },
  {
    key: "material",
    title: "Giro material",
    caption: "Marx desplaza la explicación hacia individuos concretos, producción, relaciones sociales y antagonismos materiales."
  }
];

const transformationScene = document.querySelector("[data-transformation-scene]");
const transformationControls = [...document.querySelectorAll("[data-transformation-control]")];
const transformationIndex = document.querySelector("[data-transformation-index]");
const transformationTitle = document.querySelector("[data-transformation-title]");
const transformationCaption = document.querySelector("[data-transformation-caption]");
const transformationPrev = document.querySelector("[data-transformation-prev]");
const transformationNext = document.querySelector("[data-transformation-next]");
let transformationStep = 0;

function selectTransformationStep(value) {
  const index = typeof value === "number"
    ? (value + transformationData.length) % transformationData.length
    : transformationData.findIndex((item) => item.key === value);

  if (index < 0 || !transformationScene) return;
  transformationStep = index;
  const data = transformationData[index];

  transformationScene.dataset.transformationStep = data.key;
  transformationControls.forEach((button) => {
    const active = button.dataset.transformationControl === data.key;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (transformationIndex) transformationIndex.textContent = `${String(index + 1).padStart(2, "0")} / 04`;
  if (transformationTitle) transformationTitle.textContent = data.title;
  if (transformationCaption) transformationCaption.textContent = data.caption;
}

transformationControls.forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => selectTransformationStep(button.dataset.transformationControl));
});
transformationPrev?.addEventListener("click", () => selectTransformationStep(transformationStep - 1));
transformationNext?.addEventListener("click", () => selectTransformationStep(transformationStep + 1));
selectTransformationStep(0);

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
    board: "A: p · B: “no acepto p”",
    center1: "DIFERENCIA",
    center2: "DE OPINIÓN",
    note: "identificar el desacuerdo"
  },
  apertura: {
    index: "02 / 04",
    title: "Apertura",
    copy:
      "Se acuerdan puntos de partida, reglas, roles y compromisos. Sin un terreno común, la discusión crítica no puede avanzar.",
    board: "¿qué aceptamos? · ¿quién defiende? · ¿qué reglas?",
    center1: "PUNTOS",
    center2: "DE PARTIDA",
    note: "acordar el terreno común"
  },
  argumentacion: {
    index: "03 / 04",
    title: "Argumentación",
    copy:
      "La tesis ofrece razones y recibe objeciones. El protagonista puede aclarar, conceder, distinguir, corregir o responder.",
    board: "p porque r₁, r₂… ↔ objeciones",
    center1: "RAZONES",
    center2: "↔ OBJECIONES",
    note: "poner la tesis a prueba"
  },
  conclusion: {
    index: "04 / 04",
    title: "Conclusión",
    copy:
      "Se decide qué ocurrió racionalmente: la tesis fue defendida, retirada, corregida o la controversia permanece abierta.",
    board: "mantener · corregir · abandonar · seguir abierto",
    center1: "RESULTADO",
    center2: "CRÍTICO",
    note: "decidir qué cambió"
  }
};

const discussionOrder = ["confrontacion", "apertura", "argumentacion", "conclusion"];
const discussionNodes = [...document.querySelectorAll("[data-discussion-stage]")];
const discussionProgress = [...document.querySelectorAll("[data-discussion-progress]")];
const discussionEdges = [...document.querySelectorAll("[data-discussion-edge]")];
const discussionFigure = document.querySelector("[data-discussion-figure]");
const discussionIndex = document.querySelector("[data-discussion-index]");
const discussionTitle = document.querySelector("[data-discussion-title]");
const discussionCopy = document.querySelector("[data-discussion-copy]");
const discussionBoard = document.querySelector("[data-discussion-board]");
const discussionCenter1 = document.querySelector("[data-discussion-center-line1]");
const discussionCenter2 = document.querySelector("[data-discussion-center-line2]");
const discussionCenterNote = document.querySelector("[data-discussion-center-note]");
const discussionPrev = document.querySelector("[data-discussion-prev]");
const discussionNext = document.querySelector("[data-discussion-next]");
let discussionStep = 0;

function selectDiscussionStage(key) {
  const data = discussionData[key];
  const index = discussionOrder.indexOf(key);
  if (!data || index < 0) return;
  discussionStep = index;

  discussionFigure?.setAttribute("data-discussion-current", key);

  discussionNodes.forEach((node) => {
    node.classList.toggle("is-active", node.dataset.discussionStage === key);
  });

  discussionProgress.forEach((button) => {
    const active = button.dataset.discussionProgress === key;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  discussionEdges.forEach((edge) => {
    const edgeIndex = Number(edge.dataset.discussionEdge || 0);
    edge.classList.toggle("is-complete", edgeIndex < index + 1);
    edge.classList.toggle("is-current", edgeIndex === index + 1);
  });

  if (discussionIndex) discussionIndex.textContent = data.index;
  if (discussionTitle) discussionTitle.textContent = data.title;
  if (discussionCopy) discussionCopy.textContent = data.copy;
  if (discussionBoard) discussionBoard.textContent = data.board;
  if (discussionCenter1) discussionCenter1.textContent = data.center1;
  if (discussionCenter2) discussionCenter2.textContent = data.center2;
  if (discussionCenterNote) discussionCenterNote.textContent = data.note;
}

discussionNodes.forEach((node) => {
  const choose = () => selectDiscussionStage(node.dataset.discussionStage);
  node.addEventListener("click", choose);
  activateByKeyboard(node, choose);
});

discussionProgress.forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => selectDiscussionStage(button.dataset.discussionProgress));
});

discussionPrev?.addEventListener("click", () => {
  const index = (discussionStep - 1 + discussionOrder.length) % discussionOrder.length;
  selectDiscussionStage(discussionOrder[index]);
});

discussionNext?.addEventListener("click", () => {
  const index = (discussionStep + 1) % discussionOrder.length;
  selectDiscussionStage(discussionOrder[index]);
});

selectDiscussionStage("confrontacion");

const antimonyButtons = [...document.querySelectorAll("[data-antimony]")];
antimonyButtons.forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => selectKantState(button.dataset.antimony));
});

document.querySelectorAll("[data-final-step]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-final-step]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
  });
});

const presentationScenes = [
  { id: "nucleo", label: "Núcleo" },
  { id: "socrates", label: "Sócrates / Platón" },
  { id: "aristoteles", label: "Aristóteles" },
  { id: "kant", label: "Kant" },
  { id: "hegel-marx", label: "Hegel / Marx" },
  { id: "actualidad", label: "Pragmadialéctica" },
  { id: "cierre", label: "Cierre" }
];

const presentationToggle = document.querySelector("[data-presentation-toggle]");
const presentationExit = document.querySelector("[data-presentation-exit]");
const presentationPrev = document.querySelector("[data-present-prev]");
const presentationNext = document.querySelector("[data-present-next]");
const presentationStatus = document.querySelector("[data-present-status]");
let presentationIndex = 0;\nlet presentationNavigationLockUntil = 0;

function syncPresentationStatus() {
  const scene = presentationScenes[presentationIndex];
  if (!scene || !presentationStatus) return;
  presentationStatus.textContent =
    `${String(presentationIndex + 1).padStart(2, "0")} / ${String(presentationScenes.length).padStart(2, "0")} · ${scene.label}`;

  if (page?.classList.contains("is-presenting")) {
    document.dispatchEvent(new CustomEvent("dialectica:presentation-chapter", {
      detail: { index: presentationIndex, id: scene.id, label: scene.label }
    }));
  }
}

function goPresentation(index) {
  presentationIndex = Math.min(presentationScenes.length - 1, Math.max(0, index));
  presentationNavigationLockUntil = performance.now() + 1100;
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

document.addEventListener("dialectica:presentation-cinematic-chapter", (event) => {
  const id = event.detail?.id;
  const index = presentationScenes.findIndex((scene) => scene.id === id);
  if (index < 0 || index === presentationIndex) return;
  presentationNavigationLockUntil = performance.now() + 1100;
  presentationIndex = index;
  syncPresentationStatus();
});

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
    if (performance.now() < presentationNavigationLockUntil) return;
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

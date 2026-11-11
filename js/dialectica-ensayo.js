(() => {
  const page = document.querySelector('.dx-page');
  if (!page) return;

  const chapters = [
    {
      id: 'nucleo',
      short: 'Núcleo',
      seconds: 55,
      takeaway: 'La dialéctica vuelve investigable una posición porque la expone a oposición, examen y revisión.',
      say: 'Empiece distinguiendo método dialéctico de proceso dialéctico y no entre todavía en autores.',
      action: 'Espacio: posición → oposición → examen → revisión.',
      bridge: '“Con esta estructura mínima ya podemos ver cómo cada época cambia el oficio de la dialéctica.”',
      focus: '.dx-engine'
    },
    {
      id: 'socrates',
      short: 'Sócrates / Platón',
      seconds: 60,
      takeaway: 'La investigación comienza cuando una respuesta deja de ser obvia y puede ser interrogada.',
      say: 'No lea los cuatro pasos. Haga hablar al ágora y deje que la secuencia los muestre.',
      action: 'Espacio: pregunta → respuesta → objeción → revisión.',
      bridge: '“Pero no toda investigación puede terminar en una definición necesaria; ahí entra Aristóteles.”',
      focus: '.dx-socratic-scene'
    },
    {
      id: 'aristoteles',
      short: 'Aristóteles',
      seconds: 45,
      takeaway: 'La dialéctica trabaja con posiciones plausibles cuando no tenemos una demostración necesaria.',
      say: 'Use la bifurcación como imagen principal: un camino demuestra; el otro compara razones y objeciones.',
      action: 'Espacio: resalta demostración ↔ dialéctica.',
      bridge: '“Siglos después, Kant mostrará un problema distinto: a veces ambos caminos racionales chocan.”',
      focus: '.dx-era-aristoteles .dx-era-scene'
    },
    {
      id: 'kant',
      short: 'Kant',
      seconds: 70,
      takeaway: 'La contradicción puede diagnosticar un límite de la razón, no obligar a fabricar una síntesis.',
      say: 'Recorra los dos senderos antes de revelar la antinomia. El orden visual importa aquí.',
      action: 'Espacio: libertad → determinismo → antinomia.',
      bridge: '“Hegel no acepta que ese límite sea la última palabra y convierte la contradicción en movimiento.”',
      focus: '.dx-kant-scene'
    },
    {
      id: 'hegel-marx',
      short: 'Hegel → Marx',
      seconds: 80,
      takeaway: 'La oposición deja de ser sólo discursiva y pasa a explicar transformación de lo real y de la historia.',
      say: 'No diga “tesis-antítesis-síntesis”. Deje que el paisaje muestre determinación, oposición, superación y giro material.',
      action: 'Espacio: determinación → oposición → superación → giro material.',
      bridge: '“El siglo XX terminará recuperando otra vez la discusión entre interlocutores.”',
      focus: '.dx-transformation-scene'
    },
    {
      id: 'actualidad',
      short: 'Pragmadialéctica',
      seconds: 75,
      takeaway: 'La dialéctica contemporánea regula una controversia para intentar resolver racionalmente una diferencia de opinión.',
      say: 'Use la mesa como circuito. No lea las cuatro reglas pequeñas salvo que le pregunten.',
      action: 'Espacio: confrontación → apertura → argumentación → conclusión.',
      bridge: '“Así, después de tantos cambios, queda una estructura reconocible: afirmar, criticar, evaluar y revisar.”',
      focus: '.dx-roundtable'
    },
    {
      id: 'cierre',
      short: 'Cierre',
      seconds: 45,
      takeaway: 'La oposición se vuelve método cuando funciona como control crítico de lo que creemos saber.',
      say: 'Regrese a la fórmula inicial y cierre sin agregar nuevos autores ni conceptos.',
      action: 'Espacio: afirmación → crítica → evaluación → revisión.',
      bridge: '“La dialéctica no es una fórmula única: es una historia de cómo hacer productivo el desacuerdo.”',
      focus: '.dx-final-flow'
    }
  ].filter(item => document.getElementById(item.id));

  if (!chapters.length) return;

  const hud = document.createElement('aside');
  hud.className = 'dxr-rehearsal';
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML = `
    <header>
      <div>
        <span data-dxr-index>01 / 07</span>
        <strong data-dxr-title>Núcleo</strong>
      </div>
      <div class="dxr-clock">
        <span data-dxr-clock>00:00</span>
        <small data-dxr-target>/ 00:55</small>
      </div>
    </header>
    <section>
      <span>IDEA QUE DEBE QUEDAR</span>
      <p data-dxr-takeaway></p>
    </section>
    <section>
      <span>DIGA / HAGA</span>
      <p data-dxr-say></p>
      <strong data-dxr-action></strong>
    </section>
    <footer>
      <span>PUENTE AL SIGUIENTE</span>
      <p data-dxr-bridge></p>
    </footer>
  `;

  const chip = document.createElement('div');
  chip.className = 'dxr-chip';
  chip.setAttribute('aria-live', 'polite');
  chip.innerHTML = `
    <span data-dxr-chip-title>01 · Núcleo</span>
    <strong data-dxr-chip-action>Espacio: siguiente paso interno</strong>
    <small>R ensayo · F foco</small>
  `;

  page.append(hud, chip);

  const indexNode = hud.querySelector('[data-dxr-index]');
  const titleNode = hud.querySelector('[data-dxr-title]');
  const clockNode = hud.querySelector('[data-dxr-clock]');
  const targetNode = hud.querySelector('[data-dxr-target]');
  const takeawayNode = hud.querySelector('[data-dxr-takeaway]');
  const sayNode = hud.querySelector('[data-dxr-say]');
  const actionNode = hud.querySelector('[data-dxr-action]');
  const bridgeNode = hud.querySelector('[data-dxr-bridge]');
  const chipTitle = chip.querySelector('[data-dxr-chip-title]');
  const chipAction = chip.querySelector('[data-dxr-chip-action]');

  let activeIndex = 0;
  let rehearsalVisible = false;
  let focusEnabled = true;
  let chapterStartedAt = performance.now();
  let lastActiveId = null;
  const internalSteps = new Map();

  const pad = value => String(value).padStart(2, '0');
  const formatSeconds = total => `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;

  function isPresenting() {
    return page.classList.contains('is-presenting');
  }

  function currentChapter() {
    return chapters[activeIndex] || chapters[0];
  }

  function detectActiveChapter() {
    const railActive = document.querySelector('.dxp-chapter-rail [data-dxp-chapter].is-active');
    const id = railActive?.dataset?.dxpChapter;
    const index = chapters.findIndex(item => item.id === id);
    if (index >= 0) return index;

    const probe = innerHeight * .42;
    let best = 0;
    let distance = Infinity;
    chapters.forEach((chapter, indexValue) => {
      const node = document.getElementById(chapter.id);
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const local = Math.abs(rect.top - probe);
      if (local < distance) {
        distance = local;
        best = indexValue;
      }
    });
    return best;
  }

  function resetTimerIfNeeded(id) {
    if (id === lastActiveId) return;
    lastActiveId = id;
    chapterStartedAt = performance.now();
    internalSteps.set(id, 0);
  }

  function clearStageFocus() {
    document.querySelectorAll('.dxr-stage-focus, .dxr-stage-muted').forEach(node => {
      node.classList.remove('dxr-stage-focus', 'dxr-stage-muted');
    });
  }

  function applyStageFocus() {
    clearStageFocus();
    if (!isPresenting() || !focusEnabled) return;
    const chapter = currentChapter();
    const section = document.getElementById(chapter.id);
    const focus = document.querySelector(chapter.focus);
    if (!section || !focus) return;

    focus.classList.add('dxr-stage-focus');
    [...section.children].forEach(child => {
      if (child === focus || child.contains(focus) || focus.contains(child)) return;
      if (child.classList.contains('dx-section-heading')) return;
      child.classList.add('dxr-stage-muted');
    });
  }

  function render(index = detectActiveChapter()) {
    activeIndex = Math.max(0, Math.min(chapters.length - 1, index));
    const chapter = currentChapter();
    resetTimerIfNeeded(chapter.id);

    if (indexNode) indexNode.textContent = `${pad(activeIndex + 1)} / ${pad(chapters.length)}`;
    if (titleNode) titleNode.textContent = chapter.short;
    if (targetNode) targetNode.textContent = `/ ${formatSeconds(chapter.seconds)}`;
    if (takeawayNode) takeawayNode.textContent = chapter.takeaway;
    if (sayNode) sayNode.textContent = chapter.say;
    if (actionNode) actionNode.textContent = chapter.action;
    if (bridgeNode) bridgeNode.textContent = chapter.bridge;
    if (chipTitle) chipTitle.textContent = `${pad(activeIndex + 1)} · ${chapter.short}`;
    if (chipAction) chipAction.textContent = chapter.action;

    applyStageFocus();
  }

  function setRehearsal(visible) {
    rehearsalVisible = Boolean(visible);
    hud.classList.toggle('is-visible', rehearsalVisible && isPresenting());
    hud.setAttribute('aria-hidden', String(!(rehearsalVisible && isPresenting())));
    page.classList.toggle('dxr-rehearsal-on', rehearsalVisible && isPresenting());
  }

  function setFocus(enabled) {
    focusEnabled = Boolean(enabled);
    page.classList.toggle('dxr-focus-off', !focusEnabled);
    applyStageFocus();
  }

  function click(selector) {
    const node = document.querySelector(selector);
    if (!node) return false;
    node.click();
    return true;
  }

  function advanceNucleo() {
    const nodes = [...document.querySelectorAll('[data-engine-node]')];
    if (!nodes.length) return false;
    const key = 'nucleo';
    const next = ((internalSteps.get(key) || 0) + 1) % nodes.length;
    internalSteps.set(key, next);
    nodes[next].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }

  function advanceAristoteles() {
    const scene = document.querySelector('.dx-era-aristoteles .dx-era-scene');
    if (!scene) return false;
    scene.classList.toggle('dxr-compare-alt');
    return true;
  }

  function advanceKant() {
    const key = 'kant';
    const step = internalSteps.get(key) || 0;
    const selectors = [
      '[data-kant-control="libertad"]',
      '[data-kant-control="determinismo"]',
      '[data-kant-control="limit"]'
    ];
    const node = document.querySelector(selectors[Math.min(step, selectors.length - 1)]);
    if (!node || node.disabled) return false;
    node.click();
    internalSteps.set(key, (step + 1) % selectors.length);
    return true;
  }

  function advanceCierre() {
    const nodes = [...document.querySelectorAll('[data-final-step]')];
    if (!nodes.length) return false;
    const key = 'cierre';
    const step = internalSteps.get(key) || 0;
    nodes[step % nodes.length].click();
    internalSteps.set(key, (step + 1) % nodes.length);
    return true;
  }

  function advanceInternal() {
    const id = currentChapter().id;
    if (id === 'nucleo') return advanceNucleo();
    if (id === 'socrates') return click('[data-socratic-next]');
    if (id === 'aristoteles') return advanceAristoteles();
    if (id === 'kant') return advanceKant();
    if (id === 'hegel-marx') return click('[data-transformation-next]');
    if (id === 'actualidad') return click('[data-discussion-next]');
    if (id === 'cierre') return advanceCierre();
    return false;
  }

  document.addEventListener('keydown', event => {
    if (!isPresenting()) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;

    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      event.stopImmediatePropagation();
      setRehearsal(!rehearsalVisible);
      return;
    }

    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      event.stopImmediatePropagation();
      setFocus(!focusEnabled);
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      event.stopImmediatePropagation();
      advanceInternal();
    }
  }, true);

  function enterRehearsalShell() {
    page.classList.add('dxr-ready');
    render();
    chip.classList.add('is-visible');
    if (rehearsalVisible) setRehearsal(true);
  }

  function exitRehearsalShell() {
    page.classList.remove('dxr-ready');
    chip.classList.remove('is-visible');
    hud.classList.remove('is-visible');
    clearStageFocus();
  }

  let wasPresenting = isPresenting();
  const presentationObserver = new MutationObserver(() => {
    const nowPresenting = isPresenting();
    if (nowPresenting === wasPresenting) return;
    wasPresenting = nowPresenting;
    if (nowPresenting) enterRehearsalShell();
    else exitRehearsalShell();
  });
  presentationObserver.observe(page, { attributes: true, attributeFilter: ['class'] });

  if (wasPresenting) enterRehearsalShell();

  const railObserver = new MutationObserver(() => {
    if (!isPresenting()) return;
    render();
  });

  const bindRailObserver = () => {
    const rail = document.querySelector('.dxp-chapter-rail');
    if (rail) {
      railObserver.observe(rail, { attributes: true, subtree: true, attributeFilter: ['class'] });
      return true;
    }
    return false;
  };

  if (!bindRailObserver()) {
    const waitForRail = new MutationObserver(() => {
      if (!bindRailObserver()) return;
      waitForRail.disconnect();
    });
    waitForRail.observe(page, { childList: true, subtree: true });
  }

  window.setInterval(() => {
    if (!isPresenting() || !clockNode) return;
    const elapsed = Math.max(0, Math.floor((performance.now() - chapterStartedAt) / 1000));
    clockNode.textContent = formatSeconds(elapsed);
    hud.classList.toggle('is-over-time', elapsed > currentChapter().seconds);
  }, 500);

  render(0);
})();
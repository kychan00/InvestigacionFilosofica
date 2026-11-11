(() => {
  const page = document.querySelector('.dx-page');
  if (!page) return;

  const chapters = [
    {
      id: 'nucleo',
      short: 'Núcleo',
      title: 'El núcleo dialéctico',
      kicker: 'OPOSICIÓN COMO MÉTODO',
      deck: 'Una posición se vuelve investigable cuando puede recibir objeciones, mostrar sus razones y revisarse.',
      cue: 'Abra con la diferencia entre método dialéctico y proceso dialéctico.',
      board: 'posición → oposición → examen → revisión'
    },
    {
      id: 'socrates',
      short: 'Sócrates',
      title: 'Preguntar para investigar',
      kicker: 'SÓCRATES / PLATÓN',
      deck: 'La pregunta obliga a convertir una respuesta segura en una definición provisional que puede ser examinada.',
      cue: 'Haga avanzar el diálogo del ágora y deténgase en la objeción.',
      board: '¿Qué es X? → respuesta → objeción → corrección'
    },
    {
      id: 'aristoteles',
      short: 'Aristóteles',
      title: 'Discutir lo plausible',
      kicker: 'ARISTÓTELES',
      deck: 'Cuando no hay demostración necesaria, la dialéctica compara posiciones plausibles mediante razones y objeciones.',
      cue: 'Use la bifurcación: demostración de un lado; discusión racional de lo plausible del otro.',
      board: 'demostración ≠ dialéctica'
    },
    {
      id: 'kant',
      short: 'Kant',
      title: 'Encontrar el límite',
      kicker: 'KANT',
      deck: 'Dos rutas pueden defenderse racionalmente y, sin embargo, revelar que la razón está intentando ir más allá de la experiencia.',
      cue: 'Recorra ambos senderos antes de revelar la antinomia.',
      board: 'tesis ↔ antítesis → antinomia → límite'
    },
    {
      id: 'hegel-marx',
      short: 'Hegel/Marx',
      title: 'La contradicción cambia de lugar',
      kicker: 'HEGEL → MARX',
      deck: 'La oposición deja de ser sólo discursiva y pasa a utilizarse para pensar transformación de la realidad y de la historia.',
      cue: 'Avance los cuatro estados del paisaje y enfatice el giro hacia condiciones materiales.',
      board: 'oposición real → conflicto → transformación'
    },
    {
      id: 'actualidad',
      short: 'Actualidad',
      title: 'Volver a la discusión crítica',
      kicker: 'PRAGMADIALÉCTICA',
      deck: 'La dialéctica contemporánea vuelve a la interacción: una diferencia de opinión se somete a reglas, argumentos y evaluación.',
      cue: 'Use la mesa como circuito y haga progresar sus cuatro etapas.',
      board: 'confrontación → apertura → argumentación → conclusión'
    },
    {
      id: 'cierre',
      short: 'Cierre',
      title: 'Lo que permanece',
      kicker: 'SÍNTESIS DE LA EXPOSICIÓN',
      deck: 'La dialéctica vuelve productivo el desacuerdo cuando transforma la oposición en control crítico de lo que creemos saber.',
      cue: 'Cierre regresando a la fórmula inicial y remarque que no equivale a tesis-antítesis-síntesis.',
      board: 'afirmar → criticar → evaluar → revisar'
    }
  ].filter(chapter => document.getElementById(chapter.id));

  if (!chapters.length) return;

  const rail = document.createElement('nav');
  rail.className = 'dxp-chapter-rail';
  rail.setAttribute('aria-label', 'Capítulos de la exposición');
  rail.innerHTML = chapters.map((chapter, index) => `
    <button type="button" data-dxp-chapter="${chapter.id}" title="${chapter.short}">
      ${String(index + 1).padStart(2, '0')}<span>${chapter.short}</span>
    </button>
  `).join('');

  const progress = document.createElement('div');
  progress.className = 'dxp-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<i></i>';

  const card = document.createElement('section');
  card.className = 'dxp-chapter-card';
  card.setAttribute('aria-live', 'polite');
  card.innerHTML = `
    <div class="dxp-chapter-card-inner">
      <div class="dxp-chapter-card-index" data-dxp-card-index>01</div>
      <div class="dxp-chapter-card-copy">
        <span data-dxp-card-kicker></span>
        <h2 data-dxp-card-title></h2>
        <p data-dxp-card-deck></p>
      </div>
    </div>
  `;

  const note = document.createElement('aside');
  note.className = 'dxp-presenter-note';
  note.setAttribute('aria-hidden', 'true');
  note.innerHTML = `
    <span>NOTA DEL EXPOSITOR · N</span>
    <h3 data-dxp-note-title></h3>
    <p data-dxp-note-copy></p>
    <strong data-dxp-note-board></strong>
  `;

  const help = document.createElement('aside');
  help.className = 'dxp-presenter-help';
  help.setAttribute('aria-hidden', 'true');
  help.innerHTML = `
    <strong>ATAJOS DEL MODO EXPOSICIÓN</strong>
    <p>← → capítulo · Espacio paso interno · 1–7 salto directo · R ensayo · F foco · L lentes · N notas · P puntero · H ayuda · Esc salir</p>
  `;

  const pointer = document.createElement('div');
  pointer.className = 'dxp-pointer';
  pointer.setAttribute('aria-hidden', 'true');

  page.append(progress, rail, card, note, help, pointer);

  const cardIndex = card.querySelector('[data-dxp-card-index]');
  const cardKicker = card.querySelector('[data-dxp-card-kicker]');
  const cardTitle = card.querySelector('[data-dxp-card-title]');
  const cardDeck = card.querySelector('[data-dxp-card-deck]');
  const noteTitle = note.querySelector('[data-dxp-note-title]');
  const noteCopy = note.querySelector('[data-dxp-note-copy]');
  const noteBoard = note.querySelector('[data-dxp-note-board]');
  const progressBar = progress.querySelector('i');
  const railButtons = [...rail.querySelectorAll('[data-dxp-chapter]')];

  let activeIndex = 0;
  let cardTimer = null;
  let notesVisible = false;
  let helpVisible = false;
  let pointerVisible = false;

  function isPresenting() {
    return page.classList.contains('is-presenting');
  }

  function chapterNode(index) {
    return document.getElementById(chapters[index]?.id || '');
  }

  function applyFocus(index) {
    const activeId = chapters[index]?.id;
    document.querySelectorAll('[data-era], [data-scene]').forEach(node => {
      const matches = node.id === activeId || (activeId === 'nucleo' && node.id === 'nucleo');
      node.classList.toggle('dxp-in-focus', matches);
      node.classList.toggle('dxp-out-of-focus', !matches);
    });
  }

  function syncChrome(index) {
    activeIndex = Math.max(0, Math.min(chapters.length - 1, index));
    const chapter = chapters[activeIndex];
    const pct = ((activeIndex + 1) / chapters.length) * 100;

    railButtons.forEach(button => {
      const active = button.dataset.dxpChapter === chapter.id;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'step' : 'false');
    });

    if (progressBar) progressBar.style.width = `${pct}%`;
    if (noteTitle) noteTitle.textContent = chapter.short;
    if (noteCopy) noteCopy.textContent = chapter.cue;
    if (noteBoard) noteBoard.textContent = chapter.board;
    if (isPresenting()) applyFocus(activeIndex);
  }

  function showChapterCard(index) {
    const chapter = chapters[index];
    if (!chapter) return;

    if (cardTimer) window.clearTimeout(cardTimer);
    if (cardIndex) cardIndex.textContent = String(index + 1).padStart(2, '0');
    if (cardKicker) cardKicker.textContent = chapter.kicker;
    if (cardTitle) cardTitle.textContent = chapter.title;
    if (cardDeck) cardDeck.textContent = chapter.deck;

    card.classList.add('is-visible');
    cardTimer = window.setTimeout(() => card.classList.remove('is-visible'), 850);
  }

  function goTo(index, { announce = true } = {}) {
    const next = Math.max(0, Math.min(chapters.length - 1, index));
    const node = chapterNode(next);
    if (!node) return;

    syncChrome(next);
    if (announce && isPresenting()) showChapterCard(next);
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setNotes(visible) {
    notesVisible = Boolean(visible);
    note.classList.toggle('is-visible', notesVisible && isPresenting());
    note.setAttribute('aria-hidden', String(!(notesVisible && isPresenting())));
  }

  function setHelp(visible) {
    helpVisible = Boolean(visible);
    help.classList.toggle('is-visible', helpVisible && isPresenting());
    help.setAttribute('aria-hidden', String(!(helpVisible && isPresenting())));
  }

  function setPointer(visible) {
    pointerVisible = Boolean(visible);
    page.classList.toggle('dxp-pointer-on', pointerVisible && isPresenting());
  }

  function enterCinematicMode() {
    if (!isPresenting()) return;
    page.classList.add('dxp-cinematic');
    syncChrome(activeIndex);
    showChapterCard(activeIndex);
  }

  function exitCinematicMode() {
    page.classList.remove('dxp-cinematic', 'dxp-pointer-on');
    setNotes(false);
    setHelp(false);
    document.querySelectorAll('.dxp-in-focus, .dxp-out-of-focus').forEach(node => {
      node.classList.remove('dxp-in-focus', 'dxp-out-of-focus');
    });
  }

  railButtons.forEach((button, index) => {
    button.addEventListener('click', () => goTo(index));
  });

  document.addEventListener('mousemove', event => {
    if (!pointerVisible || !isPresenting()) return;
    pointer.style.left = `${event.clientX}px`;
    pointer.style.top = `${event.clientY}px`;
  });

  document.addEventListener('keydown', event => {
    if (!isPresenting()) return;

    if (/^[1-7]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (index < chapters.length) {
        event.preventDefault();
        goTo(index);
      }
      return;
    }

    if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      setNotes(!notesVisible);
      return;
    }

    if (event.key.toLowerCase() === 'h') {
      event.preventDefault();
      setHelp(!helpVisible);
      return;
    }

    if (event.key.toLowerCase() === 'p') {
      event.preventDefault();
      setPointer(!pointerVisible);
      return;
    }

    if (event.key === 'Escape') {
      exitCinematicMode();
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      event.stopImmediatePropagation();
      goTo(activeIndex + 1);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      event.stopImmediatePropagation();
      goTo(activeIndex - 1);
    }
  }, true);

  let wasPresenting = isPresenting();
  const presentingObserver = new MutationObserver(() => {
    const nowPresenting = isPresenting();
    if (nowPresenting === wasPresenting) return;
    wasPresenting = nowPresenting;

    if (nowPresenting) enterCinematicMode();
    else exitCinematicMode();
  });

  presentingObserver.observe(page, { attributes: true, attributeFilter: ['class'] });

  const sectionObserver = new IntersectionObserver(entries => {
    if (!isPresenting()) return;
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const index = chapters.findIndex(chapter => chapter.id === visible.target.id);
    if (index >= 0) syncChrome(index);
  }, { threshold: [0.35, 0.55], rootMargin: '-12% 0px -42% 0px' });

  chapters.forEach((chapter, index) => {
    const node = document.getElementById(chapter.id);
    if (!node) return;
    sectionObserver.observe(node);
    if (node.getBoundingClientRect().top <= innerHeight * .45) activeIndex = index;
  });

  syncChrome(activeIndex);
})();

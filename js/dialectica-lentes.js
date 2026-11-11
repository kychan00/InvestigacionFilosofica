(() => {
  const page = document.querySelector('.dx-page');
  if (!page) return;

  const toggleButtons = [...document.querySelectorAll('[data-lenses-toggle]')];
  const layer = document.querySelector('[data-lenses-layer]');

  function syncOpenState(enabled) {
    page.classList.toggle('is-lenses-open', enabled);
    toggleButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(enabled));
      button.setAttribute('aria-expanded', String(enabled));
      const label = button.querySelector('[data-lenses-toggle-label]');
      if (label) label.textContent = enabled ? 'Ocultar lentes' : 'Lentes';
    });
    layer?.setAttribute('aria-hidden', String(!enabled));
  }

  toggleButtons.forEach(button => {
    button.addEventListener('click', () => syncOpenState(!page.classList.contains('is-lenses-open')));
  });

  const lensData = {
    semantic: {
      index: '01 / 02',
      title: 'Problema semántico',
      copy: 'Pregunta qué significan las expresiones y cómo se relacionan lenguaje, conceptos y realidad. Atraviesa definiciones, esencias, ambigüedad, polisemia y la diferencia entre lenguaje natural y lenguaje formal.',
      question: 'Pregunta para exponer: “Antes de discutir si una tesis es verdadera, ¿estamos usando sus conceptos del mismo modo?”'
    },
    inferential: {
      index: '02 / 02',
      title: 'Problema inferencial',
      copy: 'Pregunta qué autoriza el paso de unas afirmaciones a otras: necesidad, plausibilidad, reglas de discusión, contexto o compromisos asumidos por los interlocutores.',
      question: 'Pregunta para exponer: “¿Por qué esta conclusión se sigue de estas razones, y con qué fuerza?”'
    }
  };

  const lensButtons = [...document.querySelectorAll('[data-lens]')];
  const lensIndex = document.querySelector('[data-lens-index]');
  const lensTitle = document.querySelector('[data-lens-title]');
  const lensCopy = document.querySelector('[data-lens-copy]');
  const lensQuestion = document.querySelector('[data-lens-question]');

  function selectLens(key) {
    const data = lensData[key];
    if (!data) return;
    lensButtons.forEach(button => {
      const active = button.dataset.lens === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (lensIndex) lensIndex.textContent = data.index;
    if (lensTitle) lensTitle.textContent = data.title;
    if (lensCopy) lensCopy.textContent = data.copy;
    if (lensQuestion) lensQuestion.textContent = data.question;
  }

  lensButtons.forEach(button => button.addEventListener('click', () => selectLens(button.dataset.lens)));
  selectLens('semantic');

  const insightData = {
    epistemology: {
      title: 'Dialéctica y epistemología',
      copy: 'Síntesis del recorrido del artículo: el lugar concedido a la controversia depende de la idea de conocimiento. Un ideal de certeza tiende a reducir el papel de la discusión; un enfoque falibilista puede convertir la crítica en parte del método.'
    },
    science: {
      title: 'Crítica y ciencia',
      copy: 'El texto permite entender la actividad científica como dialéctica en sentido crítico: hipótesis y explicaciones se corrigen o eliminan mediante objeciones, contraste y revisión. Esto no equivale a adoptar una metafísica hegeliana.'
    },
    levels: {
      title: 'Cuatro preguntas distintas',
      copy: 'Síntesis operativa para la exposición: semántica pregunta qué significa; lógica e inferencia preguntan por qué se sigue; retórica pregunta cómo se obtiene adhesión; dialéctica pregunta si una posición puede sostenerse frente a una oposición racional.'
    }
  };

  const insightButtons = [...document.querySelectorAll('[data-insight]')];
  const insightTitle = document.querySelector('[data-insight-title]');
  const insightCopy = document.querySelector('[data-insight-copy]');

  function selectInsight(key) {
    const data = insightData[key];
    if (!data) return;
    insightButtons.forEach(button => {
      const active = button.dataset.insight === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (insightTitle) insightTitle.textContent = data.title;
    if (insightCopy) insightCopy.textContent = data.copy;
  }

  insightButtons.forEach(button => button.addEventListener('click', () => selectInsight(button.dataset.insight)));
  selectInsight('epistemology');

  document.addEventListener('keydown', event => {
    if (event.key.toLowerCase() !== 'l') return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
    event.preventDefault();
    syncOpenState(!page.classList.contains('is-lenses-open'));
  });

  syncOpenState(false);
})();

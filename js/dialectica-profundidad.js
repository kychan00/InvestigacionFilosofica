(() => {
  const section = document.querySelector('[data-depth-section]');
  if (!section) return;

  const data = {
    estoicos: {
      index: '01 / 05',
      period: 'ANTIGÜEDAD HELENÍSTICA',
      title: 'Estoicos · del diálogo a la lógica de signos',
      thesis: 'La dialéctica se acerca a lo que hoy llamaríamos lógica: relaciones entre expresiones, significados e inferencias.',
      oral: 'Aquí conviene decir: la dialéctica deja de ser sólo una conversación y empieza a funcionar como teoría del lenguaje y del razonamiento.',
      board: 'signo → significado → inferencia',
      tags: ['dialéctica + retórica', 'semántica', 'inferencia']
    },
    medieval: {
      index: '02 / 05',
      period: 'EDAD MEDIA',
      title: 'Disputatio · investigar discutiendo a favor y en contra',
      thesis: 'La cuestión se organiza como problema: argumentos pro, argumentos contra y una determinación final.',
      oral: 'No es una pelea libre. Es una arquitectura de discusión con posiciones, objeciones y respuesta razonada.',
      board: 'quaestio → pro / contra → determinatio',
      tags: ['quaestio', 'pro / contra', 'enseñanza']
    },
    descartes: {
      index: '03 / 05',
      period: 'MODERNIDAD',
      title: 'Descartes · la razón se vuelve solitaria',
      thesis: 'La dialéctica escolar pierde prestigio frente a un método que busca certeza mediante intuición, deducción y duda.',
      oral: 'El interlocutor deja de ser necesario: el sujeto intenta garantizar por sí mismo el camino hacia la certeza.',
      board: 'discusión probable ✕ → certeza individual',
      tags: ['certeza', 'duda', 'sujeto']
    },
    lenguaje: {
      index: '04 / 05',
      period: 'SIGLO XX',
      title: 'Giro lingüístico · el significado depende del uso',
      thesis: 'La investigación vuelve a mirar el lenguaje real: contexto, actos de habla, implicaturas y diferencias pragmáticas.',
      oral: 'Dos expresiones pueden tener la misma forma lógica y producir efectos distintos por cómo se usan en una situación concreta.',
      board: 'forma lógica ≠ uso completo',
      tags: ['Wittgenstein', 'Austin / Searle', 'Grice']
    },
    argumentacion: {
      index: '05 / 05',
      period: 'ACTUALIDAD',
      title: 'Argumentación · lógica, retórica y dialéctica vuelven a separarse',
      thesis: 'La lógica pregunta si algo se sigue; la retórica mira la adhesión; la dialéctica regula la controversia crítica.',
      oral: 'Este punto prepara directamente la pragmadialéctica: ya no buscamos una teoría total del mundo, sino reglas para discutir racionalmente.',
      board: 'lógica / retórica / dialéctica',
      tags: ['Toulmin', 'Perelman', 'pragmadialéctica']
    }
  };

  const order = Object.keys(data);
  const buttons = [...section.querySelectorAll('[data-depth-target]')];
  const mapNodes = [...section.querySelectorAll('[data-depth-map-node]')];
  const scenes = [...section.querySelectorAll('[data-depth-scene]')];
  const indexNode = section.querySelector('[data-depth-index]');
  const periodNode = section.querySelector('[data-depth-period]');
  const titleNode = section.querySelector('[data-depth-title]');
  const thesisNode = section.querySelector('[data-depth-thesis]');
  const oralNode = section.querySelector('[data-depth-oral]');
  const boardNode = section.querySelector('[data-depth-board]');
  const tagsNode = section.querySelector('[data-depth-tags]');
  const prev = section.querySelector('[data-depth-prev]');
  const next = section.querySelector('[data-depth-next]');
  const toggle = section.querySelector('[data-depth-toggle]');
  const body = section.querySelector('[data-depth-body]');
  let current = 0;

  function activateByKeyboard(node, callback) {
    node.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      callback();
    });
  }

  function render(key) {
    const item = data[key];
    if (!item) return;
    current = order.indexOf(key);
    section.dataset.depthCurrent = key;

    buttons.forEach(button => {
      const active = button.dataset.depthTarget === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    mapNodes.forEach(node => {
      const active = node.dataset.depthMapNode === key;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-current', active ? 'step' : 'false');
    });

    scenes.forEach(scene => {
      const active = scene.dataset.depthScene === key;
      scene.classList.toggle('is-active', active);
      scene.setAttribute('aria-hidden', String(!active));
    });

    if (indexNode) indexNode.textContent = item.index;
    if (periodNode) periodNode.textContent = item.period;
    if (titleNode) titleNode.textContent = item.title;
    if (thesisNode) thesisNode.textContent = item.thesis;
    if (oralNode) oralNode.textContent = item.oral;
    if (boardNode) boardNode.textContent = item.board;
    if (tagsNode) tagsNode.innerHTML = item.tags.map(tag => `<span>${tag}</span>`).join('');
  }

  function step(offset) {
    const index = (current + offset + order.length) % order.length;
    render(order[index]);
  }

  buttons.forEach(button => button.addEventListener('click', () => render(button.dataset.depthTarget)));
  mapNodes.forEach(node => {
    const choose = () => render(node.dataset.depthMapNode);
    node.addEventListener('click', choose);
    activateByKeyboard(node, choose);
  });
  prev?.addEventListener('click', () => step(-1));
  next?.addEventListener('click', () => step(1));

  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    body?.classList.toggle('is-collapsed', !open);
    toggle.querySelector('span')?.replaceChildren(document.createTextNode(open ? '−' : '+'));
  });

  render(order[0]);
})();

import {
  ResearchAtlasLiveSession
} from "../src/core/research-atlas-live.js?v=20261113-ra13a-v1";

import {
  ResearchAtlasAssembler
} from "../src/core/research-atlas-assembler.js?v=20261113-ra13a-v1";

import {
  expandResearchAtlasWithRelatedWorks
} from "../src/core/research-atlas-related.js";

import {
  addResearchAtlasDocumentSimilarity
} from "../src/core/research-atlas-document-similarity.js";

import {
  buildResearchAtlasLayout
} from "../src/core/research-atlas-layout.js";

import {
  buildResearchAtlasViewModel,
  filterResearchAtlasViewModel,
  selectedResearchAtlasContext
} from "../src/core/research-atlas-view.js?v=20261113-ra13a-v1";


const canvas =
  document.querySelector("#ra-canvas");

const stage =
  document.querySelector("#ra-stage");

const context =
  canvas.getContext(
    "2d",
    {alpha: true}
  );

const liveSearchForm =
  document.querySelector("#ra-live-search-form");

const liveQuery =
  document.querySelector("#ra-live-query");

const liveMode =
  document.querySelector("#ra-live-mode");

const liveDepth =
  document.querySelector("#ra-live-depth");

const liveSubmit =
  document.querySelector("#ra-live-submit");

const liveCancel =
  document.querySelector("#ra-live-cancel");

const query =
  document.querySelector("#ra-query");

const matchCount =
  document.querySelector("#ra-match-count");

const reset =
  document.querySelector("#ra-reset");

const fit =
  document.querySelector("#ra-fit");

const status =
  document.querySelector("#ra-status");

const tooltip =
  document.querySelector("#ra-tooltip");

const detail =
  document.querySelector("#ra-detail");

const nodeList =
  document.querySelector("#ra-node-list");

const zoomIn =
  document.querySelector("#ra-zoom-in");

const zoomOut =
  document.querySelector("#ra-zoom-out");

const zoomReadout =
  document.querySelector("#ra-zoom-readout");

const nodeCount =
  document.querySelector("#ra-node-count");

const directCount =
  document.querySelector("#ra-direct-count");

const expandedCount =
  document.querySelector("#ra-expanded-count");

const edgeCount =
  document.querySelector("#ra-edge-count");

const edgeToggles =
  [
    ...document.querySelectorAll(
      "[data-ra-edge-toggle]"
    )
  ];


let liveSession = null;
let snapshot = null;
let layout = null;
let viewModel = null;
let filterState = null;
let selectedId = null;
let hoveredId = null;
let drag = null;
let raf = null;
let uiRunId = 0;

const view = {
  x: 0,
  y: 0,
  zoom: 1
};


function element(
  tag,
  className = "",
  text = null
) {
  const node =
    document.createElement(
      tag
    );

  if (className) {
    node.className =
      className;
  }

  if (text !== null) {
    node.textContent =
      String(text);
  }

  return node;
}


function themeColors() {
  const styles =
    getComputedStyle(
      document.documentElement
    );

  return {
    ink:
      styles.getPropertyValue(
        "--ra-ink"
      ).trim() ||
      "#f4f4f4",
    muted:
      styles.getPropertyValue(
        "--ra-muted"
      ).trim() ||
      "#c6c6c6",
    surface:
      styles.getPropertyValue(
        "--ra-surface"
      ).trim() ||
      "#161a1f",
    line:
      styles.getPropertyValue(
        "--ra-line"
      ).trim() ||
      "#525860",
    blue:
      styles.getPropertyValue(
        "--ra-blue"
      ).trim() ||
      "#0f62fe",
    cyan:
      styles.getPropertyValue(
        "--ra-cyan"
      ).trim() ||
      "#33b1ff",
    green:
      styles.getPropertyValue(
        "--ra-green"
      ).trim() ||
      "#42be65",
    purple:
      styles.getPropertyValue(
        "--ra-purple"
      ).trim() ||
      "#be95ff",
    yellow:
      styles.getPropertyValue(
        "--ra-yellow"
      ).trim() ||
      "#f1c21b"
  };
}


function canvasMetrics() {
  const rect =
    canvas.getBoundingClientRect();

  const dpr =
    Math.max(
      1,
      Math.min(
        2,
        window.devicePixelRatio ||
        1
      )
    );

  const width =
    Math.max(
      1,
      rect.width
    );

  const height =
    Math.max(
      1,
      rect.height
    );

  if (
    canvas.width !==
      Math.round(
        width *
        dpr
      ) ||
    canvas.height !==
      Math.round(
        height *
        dpr
      )
  ) {
    canvas.width =
      Math.round(
        width *
        dpr
      );

    canvas.height =
      Math.round(
        height *
        dpr
      );
  }

  return {
    width,
    height,
    dpr,
    base:
      Math.min(
        width,
        height
      ) *
      0.34
  };
}


function worldToScreen(
  node,
  metrics
) {
  return {
    x:
      metrics.width /
        2 +
      (
        node.x -
        view.x
      ) *
        metrics.base *
        view.zoom,
    y:
      metrics.height /
        2 +
      (
        node.y -
        view.y
      ) *
        metrics.base *
        view.zoom
  };
}


function screenToWorld(
  x,
  y,
  metrics
) {
  return {
    x:
      view.x +
      (
        x -
        metrics.width /
          2
      ) /
        (
          metrics.base *
          view.zoom
        ),
    y:
      view.y +
      (
        y -
        metrics.height /
          2
      ) /
        (
          metrics.base *
          view.zoom
        )
  };
}


function enabledEdgeTypes() {
  return edgeToggles
    .filter(toggle =>
      toggle.checked
    )
    .map(toggle =>
      toggle.dataset
        .raEdgeToggle
    );
}


function rebuildViewModel() {
  viewModel =
    buildResearchAtlasViewModel(
      snapshot,
      layout,
      {
        edgeTypes:
          enabledEdgeTypes()
      }
    );

  filterState =
    filterResearchAtlasViewModel(
      viewModel,
      query.value
    );

  updateStats();
  renderNodeList();
  renderDetail();
  requestDraw();
}


function updateStats() {
  nodeCount.textContent =
    viewModel.diagnostics.nodes
      .toLocaleString(
        "es-MX"
      );

  directCount.textContent =
    viewModel.diagnostics.directWorks
      .toLocaleString(
        "es-MX"
      );

  expandedCount.textContent =
    viewModel.diagnostics.expandedWorks
      .toLocaleString(
        "es-MX"
      );

  edgeCount.textContent =
    viewModel.diagnostics.edges
      .toLocaleString(
        "es-MX"
      );

  matchCount.textContent =
    filterState
      .visibleNodeIds
      .size
      .toLocaleString(
        "es-MX"
      );

  if (
    query.value.trim()
  ) {
    status.textContent =
      filterState
        .visibleNodeIds
        .size
        .toLocaleString(
          "es-MX"
        ) +
      " nodos visibles · el filtro no altera la topología";
  }
}


function requestDraw() {
  if (raf) {
    return;
  }

  raf =
    requestAnimationFrame(
      () => {
        raf = null;
        draw();
      }
    );
}


function selectedContext() {
  if (!selectedId) {
    return null;
  }

  return selectedResearchAtlasContext(
    viewModel,
    selectedId
  );
}


function selectedConnectedIds() {
  const current =
    selectedContext();

  return new Set(
    current
      ?.connectedNodes
      ?.map(node =>
        node.id
      ) ||
    []
  );
}


function visibleNode(
  nodeId
) {
  return filterState
    ?.visibleNodeIds
    ?.has(
      nodeId
    ) ??
    true;
}


function visibleEdge(
  edge
) {
  return (
    filterState
      ?.visibleEdgeIds
      ?.has(
        edge.id
      ) ??
      true
  );
}


function edgeStyle(
  edge,
  colors
) {
  if (
    edge.visualType ===
    "semantic"
  ) {
    return {
      color:
        colors.blue,
      alpha:
        0.28 +
        Math.max(
          0,
          Math.min(
            1,
            Number(
              edge.semanticScore ||
              0
            )
          )
        ) *
          0.38,
      width: 1.6,
      dash: []
    };
  }

  if (
    edge.visualType ===
    "lexical"
  ) {
    return {
      color:
        colors.cyan,
      alpha: 0.48,
      width: 1.05,
      dash: [2, 4]
    };
  }

  if (
    edge.visualType ===
    "related"
  ) {
    return {
      color:
        colors.purple,
      alpha: 0.5,
      width: 1.15,
      dash: [5, 5]
    };
  }

  if (
    edge.visualType ===
    "contribution"
  ) {
    return {
      color:
        colors.green,
      alpha: 0.62,
      width: 1.25,
      dash: []
    };
  }

  if (
    edge.visualType ===
    "provisional"
  ) {
    return {
      color:
        colors.yellow,
      alpha: 0.66,
      width: 1,
      dash: [3, 5]
    };
  }

  return {
    color:
      colors.line,
    alpha: 0.34,
    width: 1,
    dash: [2, 5]
  };
}


function drawEdges(
  metrics,
  colors,
  nodesById
) {
  const current =
    selectedContext();

  const selectedEdges =
    new Set(
      current
        ?.edges
        ?.map(edge =>
          edge.id
        ) ||
      []
    );

  for (
    const edge of
    viewModel.edges
  ) {
    if (
      !visibleEdge(
        edge
      )
    ) {
      continue;
    }

    const from =
      nodesById.get(
        edge.fromRef
      );

    const to =
      nodesById.get(
        edge.toRef
      );

    if (
      !from ||
      !to ||
      !visibleNode(
        from.id
      ) ||
      !visibleNode(
        to.id
      )
    ) {
      continue;
    }

    const origin =
      worldToScreen(
        from,
        metrics
      );

    const target =
      worldToScreen(
        to,
        metrics
      );

    const style =
      edgeStyle(
        edge,
        colors
      );

    context.save();

    context.globalAlpha =
      selectedId
        ? (
            selectedEdges.has(
              edge.id
            )
              ? Math.min(
                  1,
                  style.alpha +
                  0.3
                )
              : style.alpha *
                0.16
          )
        : style.alpha;

    context.strokeStyle =
      style.color;

    context.lineWidth =
      selectedEdges.has(
        edge.id
      )
        ? style.width *
          1.55
        : style.width;

    context.setLineDash(
      style.dash
    );

    context.beginPath();
    context.moveTo(
      origin.x,
      origin.y
    );
    context.lineTo(
      target.x,
      target.y
    );
    context.stroke();
    context.restore();
  }
}


function drawWorkNode(
  screen,
  node,
  {
    colors,
    selected,
    hovered,
    connected,
    visible
  }
) {
  const direct =
    node.kind ===
    "work-direct";

  const baseRadius =
    view.zoom >
      2.7
      ? 5.3
      : view.zoom >
          1.6
        ? 4.7
        : 4.1;

  const radius =
    selected
      ? baseRadius +
        4.2
      : hovered
        ? baseRadius +
          2.4
        : connected
          ? baseRadius +
            1.3
          : baseRadius;

  context.save();
  context.globalAlpha =
    visible
      ? selected ||
        connected
        ? 1
        : 0.9
      : 0.07;

  context.beginPath();
  context.arc(
    screen.x,
    screen.y,
    radius,
    0,
    Math.PI *
      2
  );

  if (direct) {
    context.fillStyle =
      colors.blue;
    context.fill();
  } else {
    context.fillStyle =
      colors.surface;
    context.fill();
    context.strokeStyle =
      colors.cyan;
    context.lineWidth =
      2;
    context.stroke();
  }

  if (
    selected ||
    hovered
  ) {
    context.beginPath();
    context.arc(
      screen.x,
      screen.y,
      radius +
        4.8,
      0,
      Math.PI *
        2
    );
    context.strokeStyle =
      colors.ink;
    context.lineWidth =
      selected
        ? 1.5
        : 1;
    context.globalAlpha =
      selected
        ? 0.8
        : 0.46;
    context.stroke();
  }

  context.restore();
}


function drawAuthorityNode(
  screen,
  node,
  {
    colors,
    selected,
    hovered,
    connected,
    visible
  }
) {
  const size =
    selected
      ? 8
      : hovered
        ? 7
        : connected
          ? 6.4
          : 5.5;

  context.save();

  context.globalAlpha =
    visible
      ? selected ||
        connected
        ? 1
        : 0.88
      : 0.07;

  context.translate(
    screen.x,
    screen.y
  );

  context.rotate(
    Math.PI /
      4
  );

  context.fillStyle =
    colors.green;

  context.fillRect(
    -size /
      2,
    -size /
      2,
    size,
    size
  );

  if (
    selected ||
    hovered
  ) {
    context.strokeStyle =
      colors.ink;
    context.lineWidth =
      1.3;
    context.strokeRect(
      -size /
        2 -
        3,
      -size /
        2 -
        3,
      size +
        6,
      size +
        6
    );
  }

  context.restore();
}


function drawMentionNode(
  screen,
  node,
  {
    colors,
    selected,
    hovered,
    connected,
    visible
  }
) {
  const radius =
    selected
      ? 7.2
      : hovered
        ? 6.3
        : connected
          ? 5.7
          : 4.9;

  context.save();

  context.globalAlpha =
    visible
      ? selected ||
        connected
        ? 1
        : 0.84
      : 0.07;

  context.setLineDash(
    [3, 3]
  );

  context.beginPath();
  context.arc(
    screen.x,
    screen.y,
    radius,
    0,
    Math.PI *
      2
  );

  context.strokeStyle =
    colors.yellow;

  context.lineWidth =
    1.5;

  context.stroke();

  context.restore();
}


function drawQueryNode(
  screen,
  node,
  {
    colors,
    selected,
    hovered,
    connected,
    visible
  }
) {
  const radius =
    selected ||
    hovered
      ? 10
      : 8;

  context.save();

  context.globalAlpha =
    visible
      ? 0.82
      : 0.07;

  context.beginPath();
  context.arc(
    screen.x,
    screen.y,
    radius,
    0,
    Math.PI *
      2
  );
  context.strokeStyle =
    colors.muted;
  context.lineWidth =
    1;
  context.stroke();

  context.beginPath();
  context.moveTo(
    screen.x -
      radius -
      4,
    screen.y
  );
  context.lineTo(
    screen.x +
      radius +
      4,
    screen.y
  );
  context.moveTo(
    screen.x,
    screen.y -
      radius -
      4
  );
  context.lineTo(
    screen.x,
    screen.y +
      radius +
      4
  );
  context.stroke();

  context.restore();
}


function draw() {
  if (
    !viewModel
  ) {
    return;
  }

  const metrics =
    canvasMetrics();

  const colors =
    themeColors();

  context.setTransform(
    metrics.dpr,
    0,
    0,
    metrics.dpr,
    0,
    0
  );

  context.clearRect(
    0,
    0,
    metrics.width,
    metrics.height
  );

  const nodesById =
    new Map(
      viewModel.nodes.map(
        node => [
          node.id,
          node
        ]
      )
    );

  drawEdges(
    metrics,
    colors,
    nodesById
  );

  const connected =
    selectedConnectedIds();

  for (
    const node of
    viewModel.nodes
  ) {
    const screen =
      worldToScreen(
        node,
        metrics
      );

    if (
      screen.x <
        -30 ||
      screen.x >
        metrics.width +
        30 ||
      screen.y <
        -30 ||
      screen.y >
        metrics.height +
        30
    ) {
      continue;
    }

    const state = {
      colors,
      selected:
        node.id ===
        selectedId,
      hovered:
        node.id ===
        hoveredId,
      connected:
        connected.has(
          node.id
        ),
      visible:
        visibleNode(
          node.id
        )
    };

    if (
      node.kind ===
        "work-direct" ||
      node.kind ===
        "work-expanded"
    ) {
      drawWorkNode(
        screen,
        node,
        state
      );
    } else if (
      node.kind ===
      "authority-person"
    ) {
      drawAuthorityNode(
        screen,
        node,
        state
      );
    } else if (
      node.kind ===
      "author-mention"
    ) {
      drawMentionNode(
        screen,
        node,
        state
      );
    } else {
      drawQueryNode(
        screen,
        node,
        state
      );
    }
  }

  zoomReadout.textContent =
    Math.round(
      view.zoom *
      100
    ) +
    "%";
}


function nodeHitRadius(
  node
) {
  if (
    node.kind ===
    "query"
  ) {
    return 16;
  }

  if (
    node.kind ===
    "authority-person"
  ) {
    return 12;
  }

  return 13;
}


function hitTest(
  clientX,
  clientY
) {
  const rect =
    canvas.getBoundingClientRect();

  const x =
    clientX -
    rect.left;

  const y =
    clientY -
    rect.top;

  const metrics =
    canvasMetrics();

  let winner =
    null;

  let best =
    Infinity;

  for (
    const node of
    viewModel.nodes
  ) {
    if (
      !visibleNode(
        node.id
      )
    ) {
      continue;
    }

    const screen =
      worldToScreen(
        node,
        metrics
      );

    const dx =
      screen.x -
      x;

    const dy =
      screen.y -
      y;

    const squared =
      dx *
        dx +
      dy *
        dy;

    const radius =
      nodeHitRadius(
        node
      );

    if (
      squared <
        radius *
          radius &&
      squared <
        best
    ) {
      winner =
        node;

      best =
        squared;
    }
  }

  return winner;
}


function setTooltip(
  node,
  event
) {
  if (!node) {
    tooltip.hidden =
      true;
    return;
  }

  tooltip.replaceChildren(
    element(
      "strong",
      "",
      node.label
    ),
    element(
      "span",
      "",
      node.subtitle
    )
  );

  tooltip.hidden =
    false;

  const rect =
    stage.getBoundingClientRect();

  const x =
    event.clientX -
    rect.left +
    14;

  const y =
    event.clientY -
    rect.top +
    14;

  tooltip.style.left =
    Math.min(
      rect.width -
        294,
      Math.max(
        8,
        x
      )
    ) +
    "px";

  tooltip.style.top =
    Math.min(
      rect.height -
        80,
      Math.max(
        8,
        y
      )
    ) +
    "px";
}


function kindLabel(kind) {
  const labels = {
    "work-direct":
      "OBRA / HIT DIRECTO",
    "work-expanded":
      "OBRA / EXPANSIÓN L1",
    "authority-person":
      "AUTOR / CONFIRMADO",
    "author-mention":
      "AUTOR / MENCIÓN PROVISIONAL",
    "query":
      "CONSULTA"
  };

  return labels[kind] ||
    kind;
}


function renderDetail() {
  const current =
    selectedContext();

  if (!current) {
    detail.innerHTML =
      '<div class="ra-detail-empty">' +
      '<span class="ra-detail-glyph" aria-hidden="true">◎</span>' +
      '<p class="ra-section-label">SELECCIONE UN NODO</p>' +
      '<h2>Pregunte por qué está aquí.</h2>' +
      '<p>La ficha distingue evidencia factual, relaciones derivadas y menciones provisionales.</p>' +
      '</div>';
    return;
  }

  const wrapper =
    element(
      "div",
      "ra-detail-selected"
    );

  const kicker =
    element(
      "div",
      "ra-detail-kicker"
    );

  kicker.append(
    element(
      "span",
      "",
      kindLabel(
        current.node.kind
      )
    ),
    element(
      "span",
      "",
      current.node
        .directHit ===
        true
        ? "DIRECTO"
        : current.node
              .directHit ===
              false
          ? "DESCUBIERTO"
          : "AUTORIDAD"
    )
  );

  wrapper.append(
    kicker,
    element(
      "h2",
      "",
      current.node.label
    ),
    element(
      "p",
      "",
      current.node.subtitle
    )
  );

  const meta =
    element(
      "div",
      "ra-detail-meta"
    );

  for (
    const [
      label,
      value
    ] of [
      [
        "Tipo",
        kindLabel(
          current.node.kind
        )
      ],
      [
        "Identidad",
        current.node
          .identity ||
        "No aplica"
      ],
      [
        "Spawn",
        current.node
          .spawn
          ?.method ||
        "No registrado"
      ],
      [
        "Relaciones visibles",
        current.edges.length
      ]
    ]
  ) {
    const box =
      element(
        "div"
      );

    box.append(
      element(
        "span",
        "",
        label
      ),
      element(
        "strong",
        "",
        value
      )
    );

    meta.append(
      box
    );
  }

  wrapper.append(
    meta
  );

  const why =
    element(
      "section",
      "ra-why"
    );

  why.append(
    element(
      "h3",
      "",
      "¿Por qué está aquí?"
    )
  );

  const list =
    element(
      "ul"
    );

  for (
    const reason of
    current.node.why
  ) {
    list.append(
      element(
        "li",
        "",
        reason
      )
    );
  }

  why.append(
    list
  );

  wrapper.append(
    why
  );

  const relations =
    element(
      "section",
      "ra-relations"
    );

  relations.append(
    element(
      "h3",
      "",
      "Relaciones visibles"
    )
  );

  const relationList =
    element(
      "div",
      "ra-relation-list"
    );

  for (
    const edge of
    current.edges
  ) {
    const otherRef =
      edge.fromRef ===
      current.node.id
        ? edge.toRef
        : edge.fromRef;

    const other =
      viewModel.nodes.find(
        node =>
          node.id ===
          otherRef
      );

    if (!other) {
      continue;
    }

    const item =
      element(
        "button",
        "ra-relation"
      );

    item.type =
      "button";

    item.append(
      element(
        "strong",
        "",
        other.label
      ),
      element(
        "span",
        "",
        edge.label
      )
    );

    item.addEventListener(
      "click",
      () =>
        selectNode(
          other.id,
          {
            center:
              true
          }
        )
    );

    relationList.append(
      item
    );
  }

  if (
    !relationList.children
      .length
  ) {
    relationList.append(
      element(
        "div",
        "ra-relation",
        "Sin relaciones visibles con las capas actuales."
      )
    );
  }

  relations.append(
    relationList
  );

  wrapper.append(
    relations
  );

  detail.replaceChildren(
    wrapper
  );
}


function renderNodeList() {
  nodeList.replaceChildren();

  const nodes =
    viewModel.nodes.filter(
      node =>
        node.kind !==
        "query" &&
        visibleNode(
          node.id
        )
    );

  for (
    const node of
    nodes
  ) {
    const button =
      element(
        "button"
      );

    button.type =
      "button";

    button.append(
      element(
        "strong",
        "",
        node.label
      ),
      element(
        "span",
        "",
        kindLabel(
          node.kind
        ) +
        (
          node.subtitle
            ? " · " +
              node.subtitle
            : ""
        )
      )
    );

    if (
      node.id ===
      selectedId
    ) {
      button.setAttribute(
        "aria-current",
        "true"
      );
    }

    button.addEventListener(
      "click",
      () =>
        selectNode(
          node.id,
          {
            center:
              true
          }
        )
    );

    nodeList.append(
      button
    );
  }

  if (!nodes.length) {
    nodeList.append(
      element(
        "span",
        "",
        "No hay nodos que coincidan con este filtro."
      )
    );
  }
}


function selectNode(
  id,
  {
    center =
      false
  } = {}
) {
  const node =
    viewModel.nodes.find(
      item =>
        item.id ===
        id
    );

  if (!node) {
    return;
  }

  selectedId =
    id;

  if (center) {
    view.x =
      node.x;
    view.y =
      node.y;
    view.zoom =
      Math.max(
        view.zoom,
        2.1
      );
  }

  renderDetail();
  renderNodeList();
  requestDraw();
}


function fitView() {
  if (!viewModel) {
    return;
  }

  const visible =
    viewModel.nodes.filter(
      node =>
        visibleNode(
          node.id
        )
    );

  if (!visible.length) {
    return;
  }

  const xs =
    visible.map(
      node =>
        node.x
    );

  const ys =
    visible.map(
      node =>
        node.y
    );

  const minX =
    Math.min(
      ...xs
    );

  const maxX =
    Math.max(
      ...xs
    );

  const minY =
    Math.min(
      ...ys
    );

  const maxY =
    Math.max(
      ...ys
    );

  view.x =
    (
      minX +
      maxX
    ) /
    2;

  view.y =
    (
      minY +
      maxY
    ) /
    2;

  const metrics =
    canvasMetrics();

  const spanX =
    Math.max(
      0.12,
      maxX -
      minX
    );

  const spanY =
    Math.max(
      0.12,
      maxY -
      minY
    );

  const zoomX =
    metrics.width *
    0.68 /
    (
      spanX *
      metrics.base
    );

  const zoomY =
    metrics.height *
    0.68 /
    (
      spanY *
      metrics.base
    );

  view.zoom =
    Math.max(
      0.65,
      Math.min(
        6,
        Math.min(
          zoomX,
          zoomY
        )
      )
    );

  requestDraw();
}


function zoomAt(
  factor,
  clientX = null,
  clientY = null
) {
  const metrics =
    canvasMetrics();

  const rect =
    canvas.getBoundingClientRect();

  const px =
    clientX == null
      ? metrics.width /
        2
      : clientX -
        rect.left;

  const py =
    clientY == null
      ? metrics.height /
        2
      : clientY -
        rect.top;

  const before =
    screenToWorld(
      px,
      py,
      metrics
    );

  const next =
    Math.max(
      0.55,
      Math.min(
        8,
        view.zoom *
        factor
      )
    );

  if (
    next ===
    view.zoom
  ) {
    return;
  }

  view.zoom =
    next;

  const after =
    screenToWorld(
      px,
      py,
      metrics
    );

  view.x +=
    before.x -
    after.x;

  view.y +=
    before.y -
    after.y;

  requestDraw();
}


function applyLiveUpdate(
  event
) {
  const hadView =
    Boolean(
      viewModel
    );

  snapshot =
    structuredClone(
      event.snapshot
    );

  layout =
    structuredClone(
      event.layout
    );

  if (
    selectedId &&
    !snapshot.nodes.some(
      node =>
        node.id ===
        selectedId
    )
  ) {
    selectedId =
      null;
  }

  rebuildViewModel();

  const count =
    event.response
      ?.stats
      ?.unique ??
    viewModel
      .diagnostics
      .directWorks;

  const provider =
    event.progress
      ?.provider;

  if (
    event.phase ===
    "partial"
  ) {
    status.textContent =
      count
        .toLocaleString(
          "es-MX"
        ) +
      " resultados canónicos" +
      (
        provider
          ? " · llegó " +
            provider
          : ""
      ) +
      " · Atlas actualizándose";
  } else if (
    event.fallback
  ) {
    status.textContent =
      count
        .toLocaleString(
          "es-MX"
        ) +
      " resultados · servicio semántico no disponible, respaldo federado";
  } else {
    const qwen =
      event.snapshot
        ?.diagnostics
        ?.qwenSemantic;

    status.textContent =
      qwen
        ? (
            count
              .toLocaleString(
                "es-MX"
              ) +
            " resultados · Atlas semántico · " +
            Number(
              qwen.semanticEdgesAdded ||
              0
            )
              .toLocaleString(
                "es-MX"
              ) +
            " conexiones semánticas · " +
            Number(
              qwen.vectorsVerified ||
              0
            )
              .toLocaleString(
                "es-MX"
              ) +
            " obras con vector"
          )
        : (
            count
              .toLocaleString(
                "es-MX"
              ) +
            " resultados · Atlas construido"
          );
  }

  if (!hadView) {
    window.setTimeout(
      fitView,
      40
    );
  }
}


function clearAtlas() {
  liveSession
    ?.cancel();

  uiRunId +=
    1;

  snapshot =
    null;

  layout =
    null;

  viewModel =
    null;

  filterState =
    null;

  selectedId =
    null;

  hoveredId =
    null;

  query.value =
    "";

  nodeList
    .replaceChildren();

  nodeCount.textContent =
    "—";

  directCount.textContent =
    "—";

  expandedCount.textContent =
    "—";

  edgeCount.textContent =
    "—";

  matchCount.textContent =
    "—";

  status.textContent =
    "Escriba una consulta para construir el Atlas…";

  detail.innerHTML =
    '<div class="ra-detail-empty">' +
    '<span class="ra-detail-glyph" aria-hidden="true">◎</span>' +
    '<p class="ra-section-label">SELECCIONE UN NODO</p>' +
    '<h2>Pregunte por qué está aquí.</h2>' +
    '<p>La ficha distingue evidencia factual, relaciones derivadas y menciones provisionales.</p>' +
    '</div>';

  const metrics =
    canvasMetrics();

  context.setTransform(
    metrics.dpr,
    0,
    0,
    metrics.dpr,
    0,
    0
  );

  context.clearRect(
    0,
    0,
    metrics.width,
    metrics.height
  );

  view.x =
    0;

  view.y =
    0;

  view.zoom =
    1;

  liveCancel.disabled =
    true;

  liveSubmit.disabled =
    false;
}


async function runLiveSearch() {
  const text =
    liveQuery.value
      .trim();

  if (
    !text ||
    !liveSession
  ) {
    return;
  }

  const run =
    ++uiRunId;

  selectedId =
    null;

  hoveredId =
    null;

  query.value =
    "";

  liveSubmit.disabled =
    true;

  liveCancel.disabled =
    false;

  status.textContent =
    liveMode.value ===
      "semantic"
      ? "Consultando servicio semántico y fuentes académicas…"
      : "Buscando en fuentes académicas…";

  const url =
    new URL(
      window.location.href
    );

  url.searchParams.set(
    "q",
    text
  );

  url.searchParams.set(
    "mode",
    liveMode.value
  );

  history.replaceState(
    null,
    "",
    url
  );

  try {
    await liveSession.run(
      text,
      {
        mode:
          liveMode.value,
        depth:
          Number(
            liveDepth.value
          ),
        limit:
          Number(
            liveDepth.value
          )
      }
    );
  } catch (error) {
    if (
      error?.name !==
      "AbortError" &&
      run ===
        uiRunId
    ) {
      console.error(
        error
      );

      status.textContent =
        "No fue posible completar esta búsqueda.";

      detail.innerHTML =
        '<div class="ra-detail-empty">' +
        '<p class="ra-section-label">BÚSQUEDA INCOMPLETA</p>' +
        '<h2>El Atlas no pudo construir esta sesión.</h2>' +
        '<p>La búsqueda principal no se modifica; puede intentar otra consulta.</p>' +
        '</div>';
    }
  } finally {
    if (
      run ===
      uiRunId
    ) {
      liveSubmit.disabled =
        false;

      liveCancel.disabled =
        true;
    }
  }
}


liveSearchForm.addEventListener(
  "submit",
  event => {
    event.preventDefault();
    void runLiveSearch();
  }
);


liveCancel.addEventListener(
  "click",
  () => {
    liveSession
      ?.cancel();

    uiRunId +=
      1;

    liveSubmit.disabled =
      false;

    liveCancel.disabled =
      true;

    status.textContent =
      viewModel
        ? "Búsqueda cancelada · se conserva el último snapshot recibido"
        : "Búsqueda cancelada";
  }
);


query.addEventListener(
  "input",
  () => {
    if (!viewModel) {
      return;
    }

    filterState =
      filterResearchAtlasViewModel(
        viewModel,
        query.value
      );

    updateStats();
    renderNodeList();
    requestDraw();
  }
);


for (
  const toggle of
  edgeToggles
) {
  toggle.addEventListener(
    "change",
    () => {
      if (viewModel) {
        rebuildViewModel();
      }
    }
  );
}


reset.addEventListener(
  "click",
  clearAtlas
);


fit.addEventListener(
  "click",
  fitView
);


zoomIn.addEventListener(
  "click",
  () =>
    zoomAt(
      1.18
    )
);


zoomOut.addEventListener(
  "click",
  () =>
    zoomAt(
      1 /
      1.18
    )
);


canvas.addEventListener(
  "wheel",
  event => {
    event.preventDefault();

    zoomAt(
      event.deltaY <
        0
        ? 1.13
        : 1 /
          1.13,
      event.clientX,
      event.clientY
    );
  },
  {
    passive:
      false
  }
);


canvas.addEventListener(
  "pointerdown",
  event => {
    canvas.setPointerCapture(
      event.pointerId
    );

    drag = {
      pointerId:
        event.pointerId,
      startX:
        event.clientX,
      startY:
        event.clientY,
      lastX:
        event.clientX,
      lastY:
        event.clientY,
      moved:
        false
    };

    canvas.classList.add(
      "is-dragging"
    );

    tooltip.hidden =
      true;
  }
);


canvas.addEventListener(
  "pointermove",
  event => {
    if (
      drag?.pointerId ===
      event.pointerId
    ) {
      const metrics =
        canvasMetrics();

      const dx =
        event.clientX -
        drag.lastX;

      const dy =
        event.clientY -
        drag.lastY;

      if (
        Math.hypot(
          event.clientX -
            drag.startX,
          event.clientY -
            drag.startY
        ) >
        4
      ) {
        drag.moved =
          true;
      }

      view.x -=
        dx /
        (
          metrics.base *
          view.zoom
        );

      view.y -=
        dy /
        (
          metrics.base *
          view.zoom
        );

      drag.lastX =
        event.clientX;

      drag.lastY =
        event.clientY;

      requestDraw();
      return;
    }

    const node =
      hitTest(
        event.clientX,
        event.clientY
      );

    hoveredId =
      node?.id ||
      null;

    setTooltip(
      node,
      event
    );

    requestDraw();
  }
);


canvas.addEventListener(
  "pointerleave",
  () => {
    if (!drag) {
      hoveredId =
        null;
      tooltip.hidden =
        true;
      requestDraw();
    }
  }
);


canvas.addEventListener(
  "pointerup",
  event => {
    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const moved =
      drag.moved;

    drag =
      null;

    canvas.classList.remove(
      "is-dragging"
    );

    if (!moved) {
      const node =
        hitTest(
          event.clientX,
          event.clientY
        );

      if (node) {
        selectNode(
          node.id
        );
      }
    }
  }
);


canvas.addEventListener(
  "pointercancel",
  () => {
    drag =
      null;
    canvas.classList.remove(
      "is-dragging"
    );
  }
);


window.addEventListener(
  "resize",
  requestDraw
);


new MutationObserver(
  requestDraw
).observe(
  document.documentElement,
  {
    attributes:
      true,
    attributeFilter: [
      "data-theme"
    ]
  }
);


async function loadControlledDemo() {
  const [
    authorityResponse,
    relatedResponse
  ] =
    await Promise.all([
      fetch(
        "./benchmark/research-atlas/v3/authority-fixture.json",
        {
          cache:
            "no-store"
        }
      ),
      fetch(
        "./benchmark/research-atlas/v4/related-work-fixture.json",
        {
          cache:
            "no-store"
        }
      )
    ]);

  if (
    !authorityResponse.ok ||
    !relatedResponse.ok
  ) {
    throw new Error(
      "No se pudieron cargar los fixtures controlados del demo."
    );
  }

  const authorityFixture =
    await authorityResponse.json();

  const relatedFixture =
    await relatedResponse.json();

  const assembler =
    new ResearchAtlasAssembler({
      filters: {},
      sourceRevisions: {
        openAlexPhilosophy:
          "fixture-openalex-ra3",
        crossref:
          "fixture-crossref-ra3",
        authorAuthority:
          authorityFixture
            .authorityGraph
            .buildRevision,
        authorityWorkMap:
          authorityFixture
            .authorityWorkMap
            .buildRevision,
        relatedWork:
          "fixture-related-ra4"
      },
      authorityGraph:
        authorityFixture
          .authorityGraph,
      authorityWorkMap:
        authorityFixture
          .authorityWorkMap
    });

  let demoSnapshot =
    assembler.ingest(
      authorityFixture
        .searchResponse
    );

  demoSnapshot =
    expandResearchAtlasWithRelatedWorks(
      demoSnapshot,
      relatedFixture
        .relatedResponses,
      {
        maxExpandedWorks:
          8,
        semanticModelId:
          "Qwen3-Embedding"
      }
    );

  demoSnapshot =
    addResearchAtlasDocumentSimilarity(
      demoSnapshot
    );

  const demoLayout =
    buildResearchAtlasLayout(
      demoSnapshot
    );

  liveQuery.value =
    authorityFixture
      .searchResponse
      .query;

  liveSearchForm
    .querySelectorAll(
      "input, select, button"
    )
    .forEach(
      control => {
        control.disabled =
          true;
      }
    );

  applyLiveUpdate({
    runId:
      "controlled-demo-ra10",
    phase:
      "complete",
    mode:
      "controlled-demo",
    fallback:
      false,
    progress:
      null,
    response:
      authorityFixture
        .searchResponse,
    snapshot:
      demoSnapshot,
    layout:
      demoLayout
  });

  document
    .documentElement
    .dataset
    .raControlledDemo =
      "ready";

  const note =
    document.querySelector(
      ".ra-experimental-note"
    );

  if (note) {
    note.classList.add(
      "is-controlled-demo"
    );

    note.replaceChildren(
      element(
        "strong",
        "",
        "Demo controlado · no producción"
      ),
      element(
        "span",
        "",
        "Usa fixtures versionados de RA3/RA4. Las personas confirmadas, coautorías y relaciones existen sólo dentro de este conjunto de prueba y no se presentan como autoridad pública."
      )
    );
  }

  const sourceNote =
    document.querySelector(
      ".ra-live-source-note"
    );

  if (sourceNote) {
    sourceNote.replaceChildren(
      element(
        "strong",
        "",
        "Datos controlados"
      ),
      element(
        "span",
        "",
        "Datos de prueba locales · autoría, menciones, relaciones semánticas y obras relacionadas · sin proveedores externos"
      )
    );
  }

  status.textContent =
    "Demo controlado · grafo generado localmente con fixtures RA3/RA4 · cero consultas externas";

  window.setTimeout(
    fitView,
    40
  );
}


async function boot() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  if (
    params.get(
      "demo"
    ) ===
    "authority-related"
  ) {
    await loadControlledDemo();
    return;
  }

  if (
    params.get(
      "benchmark"
    ) ===
    "1"
  ) {
    const started =
      performance.now();

    const fixtureResponse =
      await fetch(
        "./artifacts/research-atlas-ra8/product-gate-fixture.json",
        {
          cache:
            "no-store"
        }
      );

    if (
      !fixtureResponse.ok
    ) {
      throw new Error(
        "No se pudo cargar el fixture de benchmark RA8."
      );
    }

    const fixture =
      await fixtureResponse
        .json();

    liveQuery.value =
      fixture.response
        ?.query ||
      "benchmark RA8";

    liveSearchForm
      .querySelectorAll(
        "input, select, button"
      )
      .forEach(
        control => {
          control.disabled =
            true;
        }
      );

    applyLiveUpdate({
      runId:
        "benchmark-ra8",
      phase:
        "complete",
      mode:
        "benchmark",
      fallback:
        false,
      progress:
        null,
      response:
        fixture.response,
      snapshot:
        fixture.snapshot,
      layout:
        fixture.layout
    });

    document
      .documentElement
      .dataset
      .raBenchmark =
        "ready";

    document
      .documentElement
      .dataset
      .raBenchmarkRenderMs =
        (
          performance.now() -
          started
        )
          .toFixed(2);

    status.textContent =
      "RA8 benchmark · Atlas renderizado con fixture local determinista";

    window.setTimeout(
      fitView,
      40
    );

    return;
  }

  const response =
    await fetch(
      "./src/data/philosophy-map.json",
      {
        cache:
          "force-cache"
      }
    );

  if (!response.ok) {
    throw new Error(
      "No se pudo cargar philosophy-map.json."
    );
  }

  const philosophyMap =
    await response.json();

  liveSession =
    new ResearchAtlasLiveSession({
      philosophyMap,
      enableQwenTopology:
        true,
      onUpdate:
        applyLiveUpdate
    });

  const initialQuery =
    String(
      params.get("q") ||
      ""
    ).trim();

  const initialMode =
    params.get("mode") ===
      "semantic"
      ? "semantic"
      : "federated";

  liveMode.value =
    initialMode;

  if (initialQuery) {
    liveQuery.value =
      initialQuery;

    await runLiveSearch();
    return;
  }

  status.textContent =
    "Listo · escriba una consulta para construir el Atlas con resultados reales.";
}


boot().catch(
  error => {
    console.error(
      error
    );

    status.textContent =
      "No fue posible inicializar el Atlas de Investigación.";

    detail.innerHTML =
      '<div class="ra-detail-empty">' +
      '<p class="ra-section-label">ERROR DE INICIALIZACIÓN</p>' +
      '<h2>El Atlas no pudo cargar su contexto de búsqueda.</h2>' +
      '<p>La página principal de Investigación Filosófica no se ve afectada.</p>' +
      '</div>';
  }
);

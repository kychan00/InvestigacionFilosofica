import {
  ResearchAtlasLayoutEngine
} from "../src/core/research-atlas-layout.js";

import {
  buildResearchAtlasViewModel,
  filterResearchAtlasViewModel,
  selectedResearchAtlasContext
} from "../src/core/research-atlas-view.js";


const canvas =
  document.querySelector("#ra-canvas");

const stage =
  document.querySelector("#ra-stage");

const context =
  canvas.getContext(
    "2d",
    {alpha: true}
  );

const query =
  document.querySelector("#ra-query");

const matchCount =
  document.querySelector("#ra-match-count");

const simulate =
  document.querySelector("#ra-simulate");

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


const layoutEngine =
  new ResearchAtlasLayoutEngine({
    maxExistingDisplacement:
      0.18
  });


let fixture = null;
let snapshot = null;
let layout = null;
let viewModel = null;
let filterState = null;
let selectedId = null;
let hoveredId = null;
let drag = null;
let raf = null;
let simulated = false;

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

  const phase =
    simulated
      ? "snapshot expandido"
      : "snapshot inicial";

  status.textContent =
    query.value.trim()
      ? (
          filterState
            .visibleNodeIds
            .size
            .toLocaleString(
              "es-MX"
            ) +
          " nodos visibles · el filtro no altera la topología"
        )
      : (
          phase +
          " · " +
          viewModel
            .diagnostics
            .nodes
            .toLocaleString(
              "es-MX"
            ) +
          " nodos"
        );
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
        "div",
        "ra-relation"
      );

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


function applySnapshot(
  nextSnapshot,
  {
    preserveLayout =
      true
  } = {}
) {
  snapshot =
    structuredClone(
      nextSnapshot
    );

  layout =
    layoutEngine.layout(
      snapshot,
      preserveLayout
        ? {}
        : {
            previousLayout:
              null
          }
    );

  rebuildViewModel();
}


query.addEventListener(
  "input",
  () => {
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
    rebuildViewModel
  );
}


simulate.addEventListener(
  "click",
  () => {
    if (simulated) {
      return;
    }

    simulated =
      true;

    applySnapshot(
      fixture.expandedSnapshot,
      {
        preserveLayout:
          true
      }
    );

    simulate.disabled =
      true;

    simulate.textContent =
      "Nueva obra integrada";

    status.textContent =
      "Nueva obra integrada · posiciones previas preservadas dentro del límite RA5";

    window.setTimeout(
      fitView,
      60
    );
  }
);


reset.addEventListener(
  "click",
  () => {
    simulated =
      false;

    selectedId =
      null;

    hoveredId =
      null;

    query.value =
      "";

    layoutEngine.reset();

    applySnapshot(
      fixture.initialSnapshot,
      {
        preserveLayout:
          false
      }
    );

    simulate.disabled =
      false;

    simulate.textContent =
      "Simular nueva obra";

    fitView();
  }
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


async function boot() {
  const response =
    await fetch(
      "./benchmark/research-atlas/v5/layout-fixture.json",
      {
        cache:
          "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      "No se pudo cargar el fixture RA5."
    );
  }

  fixture =
    await response.json();

  applySnapshot(
    fixture.initialSnapshot,
    {
      preserveLayout:
        false
    }
  );

  window.setTimeout(
    fitView,
    40
  );
}


boot().catch(
  error => {
    console.error(
      error
    );

    status.textContent =
      "No fue posible cargar el experimento RA6.";

    detail.innerHTML =
      '<div class="ra-detail-empty">' +
      '<p class="ra-section-label">ERROR DE CARGA</p>' +
      '<h2>El renderer no recibió un snapshot válido.</h2>' +
      '<p>Revise el fixture y los contratos RA1–RA5.</p>' +
      '</div>';
  }
);

import React, {
  useEffect,
  useMemo
} from "react";

import {
  createRoot
} from "react-dom/client";

import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  Background,
  BackgroundVariant,
  Panel,
  useViewport
} from "@xyflow/react";


const h = React.createElement;

const REACT_FLOW_RENDERER_REVISION =
  "2026-11-09.react-flow-temporal-v1";

const SEMANTIC_SPAN = 1120;
const UNKNOWN_YEAR_GAP = 150;
const NODE_JITTER = 9;

const clamp = (value, minimum, maximum) =>
  Math.max(
    minimum,
    Math.min(
      maximum,
      value
    )
  );


function hashUnit(value, salt = "") {
  let hash = 2166136261;

  for (
    const char of
    String(salt) + "|" + String(value || "")
  ) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(
      hash,
      16777619
    );
  }

  return (
    (hash >>> 0) /
    0xffffffff
  );
}


function finiteYear(value) {
  const year = Number(value);

  return Number.isFinite(year) &&
    year >= -1200 &&
    year <= 2400
      ? year
      : null;
}


function formatYear(year) {
  if (!Number.isFinite(year)) {
    return "s. f.";
  }

  if (year < 0) {
    return (
      String(Math.abs(year)) +
      " a. C."
    );
  }

  return String(year);
}


function yearStepFor(span) {
  if (span > 900) return 4;
  if (span > 500) return 6;
  if (span > 300) return 9;
  if (span > 180) return 14;
  if (span > 90) return 18;
  return 24;
}


function tickStepFor(span) {
  const desired =
    Math.max(
      1,
      span / 10
    );

  for (
    const step of
    [
      1,
      2,
      5,
      10,
      20,
      25,
      50,
      100,
      200,
      500
    ]
  ) {
    if (
      step >= desired
    ) {
      return step;
    }
  }

  return 1000;
}


function median(values) {
  if (!values.length) return 0;

  const sorted =
    [...values]
      .sort(
        (left, right) =>
          left - right
      );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length %
      2 ===
    1
  ) {
    return sorted[middle];
  }

  return (
    sorted[middle - 1] +
    sorted[middle]
  ) / 2;
}


function flowNodeClass(
  node,
  selected
) {
  return [
    "research-atlas-rf-node",
    "is-" + node.kind,
    node.focusAuthorWork
      ? "is-focus-author"
      : "",
    selected
      ? "is-selected"
      : ""
  ]
    .filter(Boolean)
    .join(" ");
}


function ResearchNode({
  data,
  selected
}) {
  const node =
    data.node;

  const year =
    finiteYear(node.year);

  const caption =
    [
      year === null
        ? null
        : formatYear(year),
      node.focusAuthorWork
        ? "autor buscado"
        : null
    ]
      .filter(Boolean)
      .join(" · ");

  return h(
    "div",
    {
      className:
        flowNodeClass(
          node,
          selected
        ),
      title:
        [
          node.label,
          node.subtitle
        ]
          .filter(Boolean)
          .join(" · "),
      "aria-label":
        [
          node.label,
          year === null
            ? "sin fecha"
            : formatYear(year)
        ]
          .filter(Boolean)
          .join(", ")
    },
    h(
      Handle,
      {
        type: "target",
        position: Position.Left,
        className:
          "research-atlas-rf-handle"
      }
    ),
    h(
      "span",
      {
        className:
          "research-atlas-rf-halo",
        "aria-hidden": "true"
      }
    ),
    h(
      "span",
      {
        className:
          "research-atlas-rf-core",
        "aria-hidden": "true"
      }
    ),
    h(
      "span",
      {
        className:
          "research-atlas-rf-caption"
      },
      h(
        "strong",
        null,
        node.label
      ),
      caption
        ? h(
            "small",
            null,
            caption
          )
        : null
    ),
    h(
      Handle,
      {
        type: "source",
        position: Position.Right,
        className:
          "research-atlas-rf-handle"
      }
    )
  );
}


const nodeTypes = {
  research: ResearchNode
};


function edgeStyle(
  edge,
  {
    selectedId = null
  } = {}
) {
  const connected =
    Boolean(
      selectedId &&
      (
        edge.fromRef ===
          selectedId ||
        edge.toRef ===
          selectedId
      )
    );

  const dimmed =
    Boolean(
      selectedId &&
      !connected
    );

  const score =
    clamp(
      Number(
        edge.semanticScore ||
        0
      ),
      0,
      1
    );

  const base = {
    opacity:
      dimmed
        ? 0.1
        : connected
          ? 0.96
          : 0.68,
    strokeWidth:
      connected
        ? 2.8
        : 1.35,
    filter:
      "none"
  };

  if (
    edge.visualType ===
      "semantic"
  ) {
    return {
      ...base,
      stroke:
        "rgba(15, 98, 254, .88)",
      strokeWidth:
        connected
          ? 3.4
          : 1.7 +
            score * 1.35,
      filter:
        "drop-shadow(0 0 5px rgba(15, 98, 254, .46))"
    };
  }

  if (
    edge.visualType ===
      "lexical"
  ) {
    return {
      ...base,
      stroke:
        "rgba(51, 177, 255, .7)",
      strokeDasharray:
        "3 6"
    };
  }

  if (
    edge.visualType ===
      "related"
  ) {
    return {
      ...base,
      stroke:
        "rgba(138, 63, 252, .68)",
      strokeDasharray:
        "7 7"
    };
  }

  if (
    edge.visualType ===
      "contribution"
  ) {
    return {
      ...base,
      stroke:
        "rgba(66, 190, 101, .82)",
      strokeWidth:
        connected
          ? 3
          : 1.55,
      filter:
        "drop-shadow(0 0 4px rgba(66, 190, 101, .32))"
    };
  }

  if (
    edge.visualType ===
      "provisional"
  ) {
    return {
      ...base,
      stroke:
        "rgba(241, 194, 27, .82)",
      strokeDasharray:
        "4 7"
    };
  }

  return {
    ...base,
    stroke:
      "rgba(111, 111, 111, .45)",
    strokeDasharray:
      "3 7"
  };
}


function buildTicks({
  minimumYear,
  maximumYear,
  yearStep
}) {
  if (
    !Number.isFinite(
      minimumYear
    ) ||
    !Number.isFinite(
      maximumYear
    )
  ) {
    return [];
  }

  const span =
    Math.max(
      1,
      maximumYear -
      minimumYear
    );

  const step =
    tickStepFor(span);

  const start =
    Math.floor(
      minimumYear /
      step
    ) * step;

  const output = [];

  for (
    let year = start;
    year <=
      maximumYear +
        step;
    year += step
  ) {
    if (
      year <
        minimumYear -
          step
    ) {
      continue;
    }

    output.push({
      year,
      x:
        (
          year -
          minimumYear
        ) *
        yearStep
    });
  }

  return output;
}


function temporalize(
  viewModel,
  visibleNodeIds,
  visibleEdgeIds,
  selectedId
) {
  const visibleNodes =
    viewModel.nodes
      .filter(
        node =>
          visibleNodeIds.has(
            node.id
          )
      );

  const nodeIds =
    new Set(
      visibleNodes.map(
        node => node.id
      )
    );

  const visibleEdges =
    viewModel.edges
      .filter(
        edge =>
          visibleEdgeIds.has(
            edge.id
          ) &&
          nodeIds.has(
            edge.fromRef
          ) &&
          nodeIds.has(
            edge.toRef
          )
      );

  const workNodes =
    visibleNodes
      .filter(
        node =>
          node.kind ===
            "work-direct" ||
          node.kind ===
            "work-expanded"
      );

  const knownYears =
    workNodes
      .map(
        node =>
          finiteYear(
            node.year
          )
      )
      .filter(
        year =>
          year !== null
      );

  const minimumYear =
    knownYears.length
      ? Math.min(
          ...knownYears
        )
      : 0;

  const maximumYear =
    knownYears.length
      ? Math.max(
          ...knownYears
        )
      : 1;

  const yearSpan =
    Math.max(
      1,
      maximumYear -
      minimumYear
    );

  const yearStep =
    yearStepFor(
      yearSpan
    );

  const semanticValues =
    workNodes
      .map(
        node =>
          Number(node.y)
      )
      .filter(
        Number.isFinite
      );

  const semanticMinimum =
    semanticValues.length
      ? Math.min(
          ...semanticValues
        )
      : -1;

  const semanticMaximum =
    semanticValues.length
      ? Math.max(
          ...semanticValues
        )
      : 1;

  const semanticMidpoint =
    (
      semanticMinimum +
      semanticMaximum
    ) / 2;

  const semanticRange =
    Math.max(
      0.001,
      semanticMaximum -
      semanticMinimum
    );

  const unknownX =
    -UNKNOWN_YEAR_GAP;

  const positions =
    new Map();

  for (
    const node of
    workNodes
  ) {
    const year =
      finiteYear(
        node.year
      );

    const jitterX =
      (
        hashUnit(
          node.id,
          "temporal-x"
        ) -
        0.5
      ) *
      NODE_JITTER;

    const jitterY =
      (
        hashUnit(
          node.id,
          "semantic-y"
        ) -
        0.5
      ) *
      NODE_JITTER *
      1.6;

    positions.set(
      node.id,
      {
        x:
          year === null
            ? unknownX +
              jitterX
            : (
                year -
                minimumYear
              ) *
                yearStep +
              jitterX,
        y:
          (
            (
              Number(
                node.y
              ) -
              semanticMidpoint
            ) /
            semanticRange
          ) *
            SEMANTIC_SPAN +
          jitterY
      }
    );
  }

  const workPosition =
    id =>
      positions.get(id);

  const connectedWorkPositions =
    nodeId => {
      const output = [];

      for (
        const edge of
        visibleEdges
      ) {
        const otherId =
          edge.fromRef ===
            nodeId
            ? edge.toRef
            : edge.toRef ===
                nodeId
              ? edge.fromRef
              : null;

        if (!otherId) {
          continue;
        }

        const position =
          workPosition(
            otherId
          );

        if (position) {
          output.push(
            position
          );
        }
      }

      return output;
    };

  for (
    const node of
    visibleNodes
  ) {
    if (
      positions.has(
        node.id
      )
    ) {
      continue;
    }

    if (
      node.kind ===
        "query"
    ) {
      positions.set(
        node.id,
        {
          x:
            unknownX -
            170,
          y: 0
        }
      );
      continue;
    }

    const anchors =
      connectedWorkPositions(
        node.id
      );

    if (anchors.length) {
      positions.set(
        node.id,
        {
          x:
            median(
              anchors.map(
                item => item.x
              )
            ) +
            (
              hashUnit(
                node.id,
                "author-x"
              ) -
              0.5
            ) *
              60,
          y:
            median(
              anchors.map(
                item => item.y
              )
            ) +
            (
              hashUnit(
                node.id,
                "author-y"
              ) >
                0.5
                ? 68
                : -68
            )
        }
      );
    } else {
      positions.set(
        node.id,
        {
          x:
            unknownX -
            70,
          y:
            (
              hashUnit(
                node.id,
                "orphan-y"
              ) -
              0.5
            ) *
            SEMANTIC_SPAN
        }
      );
    }
  }

  const nodes =
    visibleNodes.map(
      node => {
        const position =
          positions.get(
            node.id
          ) || {
            x: 0,
            y: 0
          };

        return {
          id: node.id,
          type: "research",
          position,
          origin:
            [0.5, 0.5],
          draggable: false,
          selectable: true,
          selected:
            node.id ===
            selectedId,
          focusable: true,
          connectable: false,
          zIndex:
            node.id ===
              selectedId
              ? 12
              : node.focusAuthorWork
                ? 8
                : node.kind ===
                    "authority-person"
                  ? 6
                  : 4,
          data: {
            node
          },
          ariaLabel:
            node.label
        };
      }
    );

  const edges =
    visibleEdges.map(
      edge => {
        const style =
          edgeStyle(
            edge,
            {
              selectedId
            }
          );

        return {
          id: edge.id,
          source:
            edge.fromRef,
          target:
            edge.toRef,
          type: "straight",
          selectable: true,
          focusable: true,
          interactionWidth: 18,
          animated:
            Boolean(
              selectedId &&
              edge.visualType ===
                "semantic" &&
              (
                edge.fromRef ===
                  selectedId ||
                edge.toRef ===
                  selectedId
              )
            ),
          zIndex:
            edge.visualType ===
              "semantic"
              ? 3
              : 1,
          style,
          data: {
            edge
          },
          ariaLabel:
            edge.label
        };
      }
    );

  const ticks =
    buildTicks({
      minimumYear,
      maximumYear,
      yearStep
    });

  if (
    workNodes.some(
      node =>
        finiteYear(
          node.year
        ) === null
    )
  ) {
    ticks.unshift({
      year: null,
      x: unknownX
    });
  }

  return {
    nodes,
    edges,
    ticks,
    positions,
    minimumYear:
      knownYears.length
        ? minimumYear
        : null,
    maximumYear:
      knownYears.length
        ? maximumYear
        : null,
    semanticZero: 0
  };
}


function TemporalGrid({
  ticks,
  semanticZero
}) {
  const viewport =
    useViewport();

  const verticals =
    ticks.map(
      tick => {
        const left =
          tick.x *
            viewport.zoom +
          viewport.x;

        return h(
          "div",
          {
            key:
              "year-" +
              String(
                tick.year
              ),
            className:
              "research-atlas-rf-year-line",
            style: {
              left:
                String(left) +
                "px"
            }
          },
          h(
            "span",
            null,
            formatYear(
              tick.year
            )
          )
        );
      }
    );

  const horizontalTop =
    semanticZero *
      viewport.zoom +
    viewport.y;

  return h(
    "div",
    {
      className:
        "research-atlas-rf-grid",
      "aria-hidden": "true"
    },
    ...verticals,
    h(
      "div",
      {
        className:
          "research-atlas-rf-semantic-zero",
        style: {
          top:
            String(
              horizontalTop
            ) +
            "px"
        }
      }
    ),
    h(
      "span",
      {
        className:
          "research-atlas-rf-axis-y"
      },
      "TERRITORIO SEMÁNTICO"
    ),
    h(
      "span",
      {
        className:
          "research-atlas-rf-axis-x"
      },
      "AÑO →"
    )
  );
}


function AtlasFlow({
  payload,
  onSelect,
  onHover,
  onHoverLeave,
  onViewport,
  onApi,
  onLayout
}) {
  const temporal =
    useMemo(
      () =>
        temporalize(
          payload.viewModel,
          new Set(
            payload.visibleNodeIds
          ),
          new Set(
            payload.visibleEdgeIds
          ),
          payload.selectedId
        ),
      [
        payload.viewModel,
        payload.visibleNodeIds,
        payload.visibleEdgeIds,
        payload.selectedId
      ]
    );

  useEffect(
    () => {
      onLayout?.(
        temporal
      );
    },
    [
      temporal,
      onLayout
    ]
  );

  const rangeLabel =
    temporal.minimumYear ===
      null
      ? "Sin fechas verificables"
      : (
          formatYear(
            temporal.minimumYear
          ) +
          " — " +
          formatYear(
            temporal.maximumYear
          )
        );

  return h(
    ReactFlow,
    {
      nodes:
        temporal.nodes,
      edges:
        temporal.edges,
      nodeTypes,
      minZoom: 0.08,
      maxZoom: 4.5,
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: true,
      selectionOnDrag: false,
      panOnDrag: true,
      panOnScroll: false,
      zoomOnScroll: true,
      zoomOnPinch: true,
      zoomOnDoubleClick: false,
      preventScrolling: true,
      onlyRenderVisibleElements: false,
      fitView: true,
      fitViewOptions: {
        padding: 0.16,
        minZoom: 0.08,
        maxZoom: 1.35
      },
      nodeOrigin:
        [0.5, 0.5],
      onInit:
        api => {
          onApi?.(api);
          onViewport?.(
            api.getViewport()
          );
        },
      onMove:
        (
          _event,
          viewport
        ) =>
          onViewport?.(
            viewport
          ),
      onNodeClick:
        (
          _event,
          node
        ) =>
          onSelect?.(
            node.id
          ),
      onNodeMouseEnter:
        (
          event,
          node
        ) =>
          onHover?.(
            node.id,
            event.clientX,
            event.clientY
          ),
      onNodeMouseLeave:
        () =>
          onHoverLeave?.(),
      onPaneClick:
        () =>
          onHoverLeave?.(),
      fitView: false,
      attributionPosition:
        "bottom-left",
      className:
        "research-atlas-react-flow"
    },
    h(
      Background,
      {
        id:
          "research-atlas-flow-dots",
        variant:
          BackgroundVariant.Dots,
        gap: 24,
        size: 0.8,
        className:
          "research-atlas-rf-background"
      }
    ),
    h(
      TemporalGrid,
      {
        ticks:
          temporal.ticks,
        semanticZero:
          temporal.semanticZero
      }
    ),
    h(
      Panel,
      {
        position:
          "top-left",
        className:
          "research-atlas-rf-panel"
      },
      h(
        "strong",
        null,
        "PLANO TEMPORAL"
      ),
      h(
        "span",
        null,
        rangeLabel
      ),
      h(
        "small",
        null,
        "X = año · Y = estructura semántica Qwen/Atlas"
      )
    )
  );
}


export function createResearchAtlasFlowRenderer({
  element,
  onSelect = null,
  onHover = null,
  onHoverLeave = null,
  onViewport = null
} = {}) {
  if (!element) {
    throw new TypeError(
      "Research Atlas React Flow requires a mount element."
    );
  }

  const root =
    createRoot(
      element
    );

  let api = null;
  let payload = null;
  let positions =
    new Map();

  const render =
    () => {
      if (!payload) {
        root.render(
          null
        );
        return;
      }

      root.render(
        h(
          ReactFlowProvider,
          null,
          h(
            AtlasFlow,
            {
              payload,
              onSelect,
              onHover,
              onHoverLeave,
              onViewport,
              onApi:
                value => {
                  api = value;
                },
              onLayout:
                layout => {
                  positions =
                    layout.positions;
                }
            }
          )
        )
      );
    };

  return {
    revision:
      REACT_FLOW_RENDERER_REVISION,

    update(nextPayload) {
      payload =
        nextPayload;
      render();
    },

    clear() {
      payload = null;
      positions =
        new Map();
      render();
    },

    async fitView() {
      if (!api) return;

      await api.fitView({
        padding: 0.16,
        duration: 420,
        minZoom: 0.08,
        maxZoom: 1.35
      });
    },

    async zoomBy(factor) {
      if (!api) return;

      const current =
        api.getZoom();

      await api.zoomTo(
        clamp(
          current *
            factor,
          0.08,
          4.5
        ),
        {
          duration: 180
        }
      );
    },

    async centerNode(
      nodeId,
      {
        minimumZoom = 1.1
      } = {}
    ) {
      if (!api) return;

      const position =
        positions.get(
          nodeId
        );

      if (!position) {
        return;
      }

      await api.setCenter(
        position.x,
        position.y,
        {
          zoom:
            Math.max(
              minimumZoom,
              api.getZoom()
            ),
          duration: 360
        }
      );
    },

    getZoom() {
      return api
        ? api.getZoom()
        : null;
    },

    destroy() {
      root.unmount();
      api = null;
      payload = null;
      positions =
        new Map();
    }
  };
}

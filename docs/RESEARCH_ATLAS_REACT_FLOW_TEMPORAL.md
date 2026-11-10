# Research Atlas · React Flow temporal-semantic renderer

Revision: `2026-11-09.react-flow-temporal-v1`

## Goal

Replace only the **visual renderer** of “El territorio de esta búsqueda” with React Flow while preserving the current research pipeline:

```
SearchResponse
  → ResearchAtlasAssembler
  → RA12-D3 Qwen semantic topology
  → ResearchAtlasLayoutEngine
  → ResearchAtlasViewModel
  → React Flow temporal-semantic renderer
```

React Flow does not search, rank, deduplicate, infer authorship or create semantic evidence.

## Coordinate contract

### X = publication year

Work nodes with a verified numeric year are positioned proportionally on the horizontal axis.

- earlier work → left
- later work → right
- unknown date → dedicated `s. f.` lane

The scale is compressed for very large year spans, but remains monotonic and proportional inside each rendered search.

Small deterministic jitter prevents exact-year overlaps without changing the chronological ordering.

### Y = semantic geometry

The vertical coordinate preserves the relative Y geometry already produced by the Atlas layout engine.

It is visual structure, not a named philosophical dimension and not a causal/influence score.

The renderer labels it **Territorio semántico**, not “influence”, “importance”, “school”, or any stronger claim.

## Nodes

- direct work: blue glow
- expanded work: cyan outline/glow
- searched-author work: magenta glow
- confirmed authority: green diamond
- unresolved author mention: yellow dashed node
- query: neutral ring

The searched-author color remains a visual signal derived from the existing author-resolution/fallback contract. React Flow does not change bibliographic identity.

## Edges

React Flow receives the already-built visible edge set.

- semantic-neighbor: luminous blue, width modulated by Qwen cosine
- lexical-neighbor: cyan dashed
- related-work: purple dashed
- contribution: green
- author-mention: yellow dashed

Selecting a node dims unrelated edges and emphasizes connected semantic edges.

## Interaction

The existing page controls remain authoritative:

- **Centrar** → React Flow `fitView`
- + / − → React Flow zoom
- node click → existing detail panel
- filters → same visible-node/visible-edge sets
- “Ver ficha” / author / article / DOI links → unchanged
- “Cargar más resultados” → existing Qwen D3 topology handshake, then renderer update

Nodes are not draggable. Chronology is not user-editable.

## Browser integration

The site is still a static GitHub Pages application, so React is isolated to the Atlas.

Pinned browser dependencies:

- React 19.3.1
- React DOM 19.3.1
- `@xyflow/react` 12.12.1

The dependencies are loaded through the existing import map / CDN strategy.

If React Flow or its CDN cannot load, `research-atlas-embed.js` keeps the existing canvas renderer as a fallback.

## Visual system

The renderer adds:

- year grid and temporal labels
- semantic zero guide
- node glow
- edge glow
- glass / backdrop blur on status, captions and temporal legend
- reduced-motion fallback
- mobile-specific spacing

## Invariants

This phase must not:

- create a second search;
- query OpenAlex live;
- change ranking;
- change SearchResponse;
- reinterpret Qwen cosine;
- change RA12-D3 evidence;
- infer dates that are absent;
- move a work to a different year for visual convenience.

## QA

Required browser gates:

1. phone / tablet / desktop mount React Flow;
2. multiple year guides are visible;
3. later year guides render to the right of earlier ones;
4. searched-author nodes keep the magenta state;
5. node click still opens the existing detail panel;
6. + / − updates React Flow zoom;
7. filters reduce visible React Flow nodes without new search;
8. Hegel real-search smoke renders focus-author glow;
9. CDN requests are allowed only for the pinned React/XYFlow visualization dependencies; opening Atlas must not trigger additional provider searches.

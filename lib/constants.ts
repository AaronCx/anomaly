import type { FileType } from '@/lib/graph/types';

/* ════════════════════════════════════════════════════════════════════
   Canvas palette mirror — dark, synaptic graph UI.

   These hex values are the JS-side source of truth for the <canvas>
   renderer (ForceGraph), the Minimap, and any component that needs a
   color in JS. They MUST stay in sync with the CSS tokens in
   app/globals.css (@theme) so the canvas and the HTML chrome share one
   palette and there is no seam between them.
   ════════════════════════════════════════════════════════════════════ */

export const COLORS = {
  bg: '#0a0b11',
  bgElevated: '#0e1018',
  surface: '#14161f',
  surface2: '#191c27',
  surfaceHover: '#1f2330',
  border: '#232734',
  borderStrong: '#313749',
  text: '#e7e9f2',
  textMuted: '#9196ad',
  textFaint: '#626780',
  accent: '#6aa8ff',
  accentBright: '#9cc3ff',
  accentDeep: '#3f6fd6',
  selected: '#ffffff',
  edgeDefault: 'rgba(231, 233, 242, 0.15)',
  edgeHover: 'rgba(231, 233, 242, 0.42)',
} as const;

export const FILE_TYPE_COLORS: Record<FileType, string> = {
  component: '#6aa8ff',
  route: '#f76d6d',
  service: '#43d39e',
  utility: '#98a0b6',
  model: '#b88dff',
  test: '#ffaa5c',
  config: '#6b7387',
  unknown: '#7b8298',
} as const;

/* ── Edge colors — single source of truth ─────────────────────────────
   Shared by the canvas renderer (ForceGraph) AND the Legend swatches so
   they can never drift apart. Legend re-exports this as DEFAULT_EDGE_COLORS. */

export type EdgeColorKey = 'import' | 'export' | 'call';

export const EDGE_TYPE_COLORS: Record<EdgeColorKey, string> = {
  import: '#6aa8ff',
  export: '#b88dff',
  call: '#ffc24b',
} as const;

/* ── Canvas-only render tokens ────────────────────────────────────────
   Keeps the draw loop free of scattered hex literals. */

export const RENDER = {
  /** Architecture-rule violations: always red, always prominent. */
  edgeViolation: '#f76d6d',
  /** Node labels drawn on canvas. */
  label: 'rgba(231, 233, 242, 0.82)',
  /** Background color used behind labels for the cheap "halo" offset trick. */
  labelHalo: '#0a0b11',
  /** Concrete font stacks — canvas ctx.font cannot resolve CSS var(--font-*). */
  fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSans: "ui-sans-serif, system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif",
  /** Soft spherical highlight tint applied to node cores. */
  nodeCoreHighlight: 'rgba(255, 255, 255, 0.5)',
  cluster: {
    haloCoreAlpha: 0.1,
    haloMidAlpha: 0.04,
    labelAlpha: 0.42,
  },
  /** Churn heat ramp (history mode), palette-aligned. */
  heat: {
    hot: '#f76d6d',
    warm: '#ffaa5c',
    cool: '#ffc24b',
  },
  /** Agent-trace overlay accent (read/active/path). */
  trace: {
    path: '#22d3ee',
    active: '#22d3ee',
  },
  /** Synaptic connection rendering. Resting connections stay faint so the graph
   *  reads as clustered lobes rather than spaghetti; the focused neighbourhood
   *  lights up and "fires" signal pulses that travel along the active pathways. */
  synapse: {
    edgeRest: 0.14,  // base opacity for a resting connection
    edgeFocus: 0.85, // opacity for connections in the focused neighbourhood
    edgeDim: 0.035,  // opacity for everything outside the focus
    pulse: '#67e8f9', // bright signal colour that travels along active edges
    spark: '#a5f3fc', // brighter core of a signal pulse
  },
} as const;

/* ── Graph layout (neural lobe clustering) ────────────────────────────
   Files in the same directory cluster are pulled toward a shared anchor so
   each cluster forms a distinct lobe; lobes are arranged around the centre
   and connected by their cross-cluster edges. */

export const LAYOUT = {
  /** How strongly a node is pulled toward its cluster's anchor (tight lobes). */
  clusterStrength: 0.18,
  /** Base radius (px) of the ring the cluster anchors sit on; scaled by size. */
  clusterRingBase: 160,
  /** Weak global centring so the whole graph stays roughly centred. */
  centerStrength: 0.02,
  /** Per-node degree → radius boost (hubs grow); capped in code. */
  hubBoost: 0.55,
  /** Min connection count for a node to show its label at rest (hubs only). */
  hubLabelDegree: 5,
} as const;

/* ── Physics / force simulation ───────────────────────── */

export const PHYSICS = {
  charge: -150,
  linkDistance: 80,
  collisionPadding: 5,
  alphaDecay: 0.005,   // Very slow cooldown — graph breathes and floats
  alphaMin: 0.01,      // Never fully stops — keeps gentle movement
  velocityDecay: 0.55, // Moderate damping — nodes drift gently
  centerStrength: 0.03,
} as const;

/* ── Node sizing ──────────────────────────────────────── */

export const NODE = {
  minRadius: 4,
  maxRadius: 20,
  labelThreshold: 0.6, // zoom level at which labels appear
} as const;

/* ── Demo repos available on the landing page ─────────── */

export const DEMOS = [
  { name: 'anomaly', label: 'Anomaly' },
  { name: 'agentforge', label: 'AgentForge' },
  { name: 'lastgate', label: 'LastGate' },
] as const;

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { GraphData, GraphNode, GraphEdge, FileType, Cluster } from '@/lib/graph/types';
import { FILE_TYPE_COLORS, COLORS, EDGE_TYPE_COLORS, RENDER, PHYSICS, NODE, LAYOUT } from '@/lib/constants';
import type { EdgeColorKey } from '@/lib/constants';

/* ── Simulation node/link with mutable D3 fields ─────────── */

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  fx?: number | null;
  fy?: number | null;
  _phase: number;
  /** Index of the directory cluster this node belongs to (its lobe). */
  _cluster: number;
  /** Connection count (import + call). Hubs are larger and brighter. */
  _degree: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
  weight: number;
  type?: string;
  violation?: GraphEdge['violation'];
}

export interface ForceGraphProps {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  hoveredNodeId?: string | null;
  selectedNodeId?: string | null;
  filters?: Set<FileType>;
  searchHighlight?: string | null;
  showLabels?: boolean;
  showMinimap?: boolean;
  nodeColors?: Record<FileType, string>;
  edgeColors?: Record<string, string>;
  visibleEdgeTypes?: Set<string>;
  /** When true, render churn heat (warm glow on frequently-changed nodes). */
  historyMode?: boolean;
  /** Per-file churn heat in [0, 1], keyed by file path. Used when historyMode. */
  churn?: Map<string, number> | null;
  /** When true, render the agent-trace overlay (active/read/modified tints + path). */
  traceMode?: boolean;
  /** Node id touched on the current trace step (pulses). Used when traceMode. */
  traceActiveId?: string | null;
  /** Node ids read so far in the trace. Tinted blue. Used when traceMode. */
  traceReadIds?: Set<string> | null;
  /** Node ids modified/created so far. Tinted amber/green. Used when traceMode. */
  traceModifiedIds?: Set<string> | null;
  /** Node ids deleted so far. Dimmed/red. Used when traceMode. */
  traceDeletedIds?: Set<string> | null;
  /** Traversal hops (source→target node ids) to highlight. Used when traceMode. */
  tracePath?: { source: string; target: string }[] | null;
  /**
   * Emits the currently-visible region in WORLD coordinates whenever the view
   * transform changes (throttled). Used to drive the Minimap viewport lens.
   */
  onViewportChange?: (rect: { x: number; y: number; width: number; height: number }) => void;
}

/* ── Helpers ─────────────────────────────────────────────── */

function nodeRadius(loc: number): number {
  return Math.max(NODE.minRadius, Math.min(NODE.maxRadius, Math.sqrt(loc) * 0.8));
}

function hexToRGBA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getConnected(nodeId: string, links: SimLink[]): Set<string> {
  const connected = new Set<string>();
  for (const l of links) {
    const s = typeof l.source === 'string' ? l.source : l.source.id;
    const t = typeof l.target === 'string' ? l.target : l.target.id;
    if (s === nodeId) connected.add(t);
    if (t === nodeId) connected.add(s);
  }
  connected.add(nodeId);
  return connected;
}

/* ── Component ───────────────────────────────────────────── */

export default function ForceGraph({
  data,
  onNodeClick,
  onNodeDoubleClick,
  onNodeHover,
  hoveredNodeId: externalHoveredId,
  nodeColors: customNodeColors,
  edgeColors: customEdgeColors,
  visibleEdgeTypes,
  selectedNodeId,
  filters,
  searchHighlight,
  showLabels: forceShowLabels,
  historyMode,
  churn,
  traceMode,
  traceActiveId,
  traceReadIds,
  traceModifiedIds,
  traceDeletedIds,
  tracePath,
  onViewportChange,
}: ForceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const clustersRef = useRef<Cluster[]>([]);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const hoveredRef = useRef<string | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);
  const pulseRef = useRef<number>(0);
  const [internalHovered, setInternalHovered] = useState<string | null>(null);

  const hoveredId = externalHoveredId ?? internalHovered;

  // Refs for callbacks used in the stable setup effect
  const onNodeClickRef = useRef(onNodeClick);
  const onNodeDoubleClickRef = useRef(onNodeDoubleClick);
  const onNodeHoverRef = useRef(onNodeHover);
  const onViewportChangeRef = useRef(onViewportChange);
  const hitTestRef = useRef<((mx: number, my: number) => SimNode | null) | null>(null);
  // Throttle bookkeeping for viewport emission (avoid 60fps React re-render storms).
  const lastViewportEmitRef = useRef<{ t: number; rect: { x: number; y: number; width: number; height: number } }>(
    { t: 0, rect: { x: 0, y: 0, width: 0, height: 0 } },
  );
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
  useEffect(() => { onNodeDoubleClickRef.current = onNodeDoubleClick; }, [onNodeDoubleClick]);
  useEffect(() => { onNodeHoverRef.current = onNodeHover; }, [onNodeHover]);
  useEffect(() => { onViewportChangeRef.current = onViewportChange; }, [onViewportChange]);

  /* ── Viewport emission (world coords, throttled ~120ms) ── */

  const emitViewport = useCallback((force = false) => {
    const cb = onViewportChangeRef.current;
    const canvas = canvasRef.current;
    if (!cb || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const t = transformRef.current;
    const rect = {
      x: -t.x / t.k,
      y: -t.y / t.k,
      width: w / t.k,
      height: h / t.k,
    };
    const now = performance.now();
    const last = lastViewportEmitRef.current;
    // Throttle to ~once per 120ms; skip if effectively unchanged.
    if (!force && now - last.t < 120) return;
    const r = last.rect;
    if (
      !force &&
      Math.abs(r.x - rect.x) < 0.5 &&
      Math.abs(r.y - rect.y) < 0.5 &&
      Math.abs(r.width - rect.width) < 0.5 &&
      Math.abs(r.height - rect.height) < 0.5
    ) {
      return;
    }
    lastViewportEmitRef.current = { t: now, rect };
    cb(rect);
  }, []);

  const emitViewportRef = useRef(emitViewport);
  useEffect(() => { emitViewportRef.current = emitViewport; }, [emitViewport]);

  /* ── Build / rebuild simulation ──────────────────────── */

  const buildSimulation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    // Scale physics to produce consistent visual density across all graph sizes
    const nodeCount = data.nodes.length;
    const physicsEdgeCount = data.edges.filter((e) => e.type !== 'export').length;
    const edgeDensity = nodeCount > 0 ? physicsEdgeCount / nodeCount : 0;

    // Strong repulsion scaled by density — heavier graphs get pushed apart more
    const chargeStrength = (-400 - (edgeDensity * edgeDensity * 80) - (Math.sqrt(nodeCount) * 12)) * 0.9;
    const linkDist = (140 + (edgeDensity * 30)) * 0.9;
    const linkStrength = Math.min(0.1, 0.15 / Math.max(edgeDensity, 1)) * 1.1;
    const collisionPad = (20 + edgeDensity * 6) * 0.9;

    // ── Cluster lobes ───────────────────────────────────────────────
    // Map every node to its directory cluster and lay the clusters out on a
    // ring around the centre, so each cluster condenses into a distinct lobe
    // (ganglion) connected to the others — instead of one centred hairball.
    clustersRef.current = data.clusters;
    const clusterIndex = new Map<string, number>();
    data.clusters.forEach((c, ci) => {
      for (const id of c.nodeIds) clusterIndex.set(id, ci);
    });
    const clusterCount = Math.max(1, data.clusters.length);
    const ringRadius = LAYOUT.clusterRingBase * Math.sqrt(clusterCount) + Math.sqrt(nodeCount) * 6;
    const anchors = data.clusters.map((_, ci) => {
      const a = (ci / clusterCount) * Math.PI * 2 - Math.PI / 2;
      return { x: width / 2 + Math.cos(a) * ringRadius, y: height / 2 + Math.sin(a) * ringRadius };
    });
    const anchorFor = (n: SimNode) => anchors[n._cluster] ?? { x: width / 2, y: height / 2 };

    // ── Degree (import + call connections) for hub sizing ───────────
    const degree = new Map<string, number>();
    for (const e of data.edges) {
      if (e.type === 'export') continue; // reverse-duplicate of an import
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }

    // Build nodes. Seed positions near the node's cluster anchor so the layout
    // settles into lobes quickly instead of unwinding from the centre.
    const nodes: SimNode[] = data.nodes.map((n, i) => {
      const ci = clusterIndex.get(n.id) ?? 0;
      const a = (ci / clusterCount) * Math.PI * 2 - Math.PI / 2;
      const ax = width / 2 + Math.cos(a) * ringRadius;
      const ay = height / 2 + Math.sin(a) * ringRadius;
      const deg = degree.get(n.id) ?? 0;
      // Hubs grow with connection count, clamped so they stay readable.
      const base = nodeRadius(n.loc);
      const radius = Math.min(NODE.maxRadius * 1.6, base * (1 + LAYOUT.hubBoost * Math.log2(1 + deg) * 0.25));
      return {
        ...n,
        x: n.x ?? ax + (Math.random() - 0.5) * 80,
        y: n.y ?? ay + (Math.random() - 0.5) * 80,
        vx: 0,
        vy: 0,
        radius,
        _phase: i * 2.39996, // Golden angle offset for unique drift per node
        _cluster: ci,
        _degree: deg,
      };
    });
    nodesRef.current = nodes;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // All edges for rendering
    const allLinks: SimLink[] = data.edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
        type: e.type,
        violation: e.violation,
      }));
    linksRef.current = allLinks;

    // Only import + call edges drive the physics (export edges are visual-only,
    // they're the reverse of imports and would double the pull force)
    const physicsLinks = allLinks.filter((l) => l.type !== 'export');

    // Stop previous simulation
    if (simRef.current) simRef.current.stop();

    // Tick counter for smooth sine-wave drift
    let tickCount = 0;

    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(physicsLinks)
          .id((d) => d.id)
          .distance(linkDist)
          .strength(linkStrength),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(chargeStrength).distanceMax(400))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(LAYOUT.centerStrength))
      .force(
        'collision',
        d3.forceCollide<SimNode>().radius((d) => d.radius + collisionPad).strength(1),
      )
      // Cluster gravity: pull each node toward its lobe's anchor on the ring.
      .force('clusterX', d3.forceX<SimNode>((d) => anchorFor(d).x).strength(LAYOUT.clusterStrength))
      .force('clusterY', d3.forceY<SimNode>((d) => anchorFor(d).y).strength(LAYOUT.clusterStrength))
      .alphaDecay(PHYSICS.alphaDecay)
      .alphaMin(PHYSICS.alphaMin)
      .velocityDecay(PHYSICS.velocityDecay)
      .on('tick', () => {
        tickCount++;
        // Smooth sine-wave drift — each node orbits gently at its own phase
        // This creates a floating feel, not vibration
        const t = tickCount * 0.008; // Slow time progression
        for (const node of nodes) {
          if (!node.fx && !node.fy) {
            const phase = (node as SimNode & { _phase: number })._phase;
            node.vx! += Math.sin(t + phase) * 0.02;
            node.vy! += Math.cos(t + phase * 1.3) * 0.02;
          }
        }
      });

    // Gently reheat so the drift never fully stops
    const reheatInterval = setInterval(() => {
      if (sim.alpha() < 0.03) {
        sim.alpha(0.03).restart();
      }
    }, 5000);

    simRef.current = sim;

    return () => {
      clearInterval(reheatInterval);
      sim.stop();
    };
  }, [data]);

  /* ── Canvas rendering loop ───────────────────────────── */

  const drawRef = useRef<() => void>(() => {});

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const t = transformRef.current;
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const clusters = clustersRef.current;
    const hovered = hoveredRef.current;
    const k = t.k; // zoom scale

    pulseRef.current += 0.04;

    // Whether a node is visible given filters
    const isVisible = (n: SimNode) => {
      if (!filters || filters.size === 0) return true;
      return filters.has(n.fileType);
    };

    // Focus = the hovered node, or the selected node when nothing is hovered.
    // The focused neighbourhood lights up and fires signal pulses; everything
    // else dims to context — this is what keeps large graphs legible.
    const focusId = hovered ?? selectedNodeId ?? null;
    const connectedSet = focusId ? getConnected(focusId, links) : null;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    // Apply zoom transform
    ctx.translate(t.x, t.y);
    ctx.scale(k, k);

    /* ── Cluster halos ─────────────────────────────────── */
    if (k < 1.2) {
      for (const cluster of clusters) {
        const clusterNodes = nodes.filter((n) => cluster.nodeIds.includes(n.id) && isVisible(n));
        if (clusterNodes.length < 2) continue;

        const cx = clusterNodes.reduce((s, n) => s + n.x, 0) / clusterNodes.length;
        const cy = clusterNodes.reduce((s, n) => s + n.y, 0) / clusterNodes.length;

        let maxDist = 0;
        for (const n of clusterNodes) {
          const dist = Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2);
          if (dist > maxDist) maxDist = dist;
        }

        const radius = maxDist + 48;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, hexToRGBA(cluster.color, RENDER.cluster.haloCoreAlpha));
        gradient.addColorStop(0.6, hexToRGBA(cluster.color, RENDER.cluster.haloMidAlpha));
        gradient.addColorStop(1, hexToRGBA(cluster.color, 0));

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Cluster label when zoomed out
        if (k < 0.8) {
          ctx.font = `${14 / k}px ${RENDER.fontSans}`;
          ctx.fillStyle = hexToRGBA(cluster.color, RENDER.cluster.labelAlpha);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cluster.label, cx, cy - radius * 0.3);
        }
      }
    }

    /* ── Edges (synaptic connections) ──────────────────── */
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Connections in the focused neighbourhood are collected so signal pulses
    // can be drawn travelling along them after the static edges are laid down.
    const focusEdges: { s: SimNode; t2: SimNode }[] = [];
    for (const link of links) {
      // Skip edge types that are toggled off
      if (visibleEdgeTypes && link.type && !visibleEdgeTypes.has(link.type)) continue;

      const s = link.source as SimNode;
      const t2 = link.target as SimNode;
      if (!isVisible(s) && !isVisible(t2)) continue;

      const bothVisible = isVisible(s) && isVisible(t2);
      const sId = s.id;
      const tId = t2.id;

      // Is this connection part of the focused neighbourhood (a firing synapse)?
      const isFocusEdge =
        !!focusId && connectedSet!.has(sId) && connectedSet!.has(tId) && (sId === focusId || tId === focusId);
      if (isFocusEdge) focusEdges.push({ s, t2 });

      // Resting connections stay faint so the graph reads as clustered lobes;
      // the focused neighbourhood lights up and everything else recedes.
      let opacity = RENDER.synapse.edgeRest * (1 + (link.weight || 1) * 0.12);
      let lineWidth = Math.min(1.6, 0.6 + (link.weight || 1) * 0.22);
      if (focusId) {
        if (isFocusEdge) {
          opacity = RENDER.synapse.edgeFocus;
          lineWidth = Math.max(lineWidth, 1.8);
        } else {
          opacity = RENDER.synapse.edgeDim;
          lineWidth = 0.4;
        }
      }

      const edgeType = (link as SimLink & { type?: string }).type;
      const isCallEdge = edgeType === 'call';
      const isExportEdge = edgeType === 'export';
      const isViolation = !!(link as SimLink & { violation?: unknown }).violation;

      if (isViolation) {
        ctx.setLineDash([]); // Violations render solid + red, always prominent
      } else if (isCallEdge) {
        ctx.setLineDash([6, 4]); // Dashed for function calls
      } else if (isExportEdge) {
        ctx.setLineDash([2, 3]); // Dotted for exports
      } else if (!bothVisible) {
        ctx.setLineDash([4, 4]);
        opacity *= 0.3;
      } else {
        ctx.setLineDash([]);
      }

      if (isViolation) opacity = Math.max(opacity, 0.85); // keep violations visible

      // Quadratic bezier with slight curve
      const mx = (s.x + t2.x) / 2;
      const my = (s.y + t2.y) / 2;
      const dx = t2.x - s.x;
      const dy = t2.y - s.y;
      const offset = Math.min(20, Math.sqrt(dx * dx + dy * dy) * 0.1);
      const cpx = mx - dy * offset / Math.sqrt(dx * dx + dy * dy + 1);
      const cpy = my + dx * offset / Math.sqrt(dx * dx + dy * dy + 1);

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(cpx, cpy, t2.x, t2.y);
      // Use custom edge colors if provided, otherwise defaults.
      // Architecture-rule violations always render red and a touch thicker.
      const eType: EdgeColorKey = isCallEdge ? 'call' : isExportEdge ? 'export' : 'import';
      const edgeHex = isViolation
        ? RENDER.edgeViolation
        : customEdgeColors?.[eType] || EDGE_TYPE_COLORS[eType];
      ctx.strokeStyle = hexToRGBA(edgeHex, opacity);
      ctx.lineWidth = isViolation ? lineWidth + 1 : lineWidth;
      ctx.stroke();

      // Direction arrow — only on focused (firing) connections, to declutter.
      if (isFocusEdge && k > 0.5) {
        const tt = 0.7;
        const ax = (1 - tt) * (1 - tt) * s.x + 2 * (1 - tt) * tt * cpx + tt * tt * t2.x;
        const ay = (1 - tt) * (1 - tt) * s.y + 2 * (1 - tt) * tt * cpy + tt * tt * t2.y;
        const tax = 2 * (1 - tt) * (cpx - s.x) + 2 * tt * (t2.x - cpx);
        const tay = 2 * (1 - tt) * (cpy - s.y) + 2 * tt * (t2.y - cpy);
        const angle = Math.atan2(tay, tax);
        const arrowSize = 4;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(
          ax - arrowSize * Math.cos(angle - Math.PI / 6),
          ay - arrowSize * Math.sin(angle - Math.PI / 6),
        );
        ctx.moveTo(ax, ay);
        ctx.lineTo(
          ax - arrowSize * Math.cos(angle + Math.PI / 6),
          ay - arrowSize * Math.sin(angle + Math.PI / 6),
        );
        // Arrowhead reads in the edge's own color, a touch brighter than the line.
        ctx.strokeStyle = hexToRGBA(edgeHex, Math.min(opacity * 1.5, 0.95));
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    /* ── Trace traversal path ──────────────────────────── */
    // In trace mode, draw a bright animated path between consecutively-touched
    // files so you can follow the agent's route through the codebase.
    if (traceMode && tracePath && tracePath.length > 0) {
      const nodeById = new Map(nodes.map((n) => [n.id, n]));
      const dash = (pulseRef.current * 6) % 16;
      tracePath.forEach((hop, i) => {
        const s = nodeById.get(hop.source);
        const t2 = nodeById.get(hop.target);
        if (!s || !t2) return;
        // The most recent hops glow brighter; older ones fade back.
        const recency = (i + 1) / tracePath.length;
        const opacity = 0.25 + 0.55 * recency;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = -dash;
        ctx.strokeStyle = hexToRGBA(RENDER.trace.path, opacity);
        ctx.lineWidth = 1.5 + 1.5 * recency;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      });
    }

    /* ── Signal pulses (synaptic firing) ───────────────── */
    // A small glowing dot travels along active connections. When a node is
    // focused its whole neighbourhood fires; otherwise a few ambient sparks
    // wander the network so it always feels alive.
    {
      const drawPulse = (s: SimNode, t2: SimNode, frac: number, alpha: number, size: number) => {
        const dx = t2.x - s.x;
        const dy = t2.y - s.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;
        const offset = Math.min(20, len * 0.1);
        const inv = 1 / (len + 1);
        const mx = (s.x + t2.x) / 2;
        const my = (s.y + t2.y) / 2;
        const cpx = mx - dy * offset * inv;
        const cpy = my + dx * offset * inv;
        const omf = 1 - frac;
        const px = omf * omf * s.x + 2 * omf * frac * cpx + frac * frac * t2.x;
        const py = omf * omf * s.y + 2 * omf * frac * cpy + frac * frac * t2.y;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, size);
        grad.addColorStop(0, hexToRGBA(RENDER.synapse.spark, alpha));
        grad.addColorStop(0.5, hexToRGBA(RENDER.synapse.pulse, alpha * 0.6));
        grad.addColorStop(1, hexToRGBA(RENDER.synapse.pulse, 0));
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      };

      const speed = 0.18;
      if (focusEdges.length > 0) {
        focusEdges.forEach((e, i) => {
          const f = (pulseRef.current * speed + (i * 0.137) % 1) % 1;
          drawPulse(e.s, e.t2, f, 0.9, 3.5);
          drawPulse(e.s, e.t2, (f + 0.5) % 1, 0.35, 2.5);
        });
      } else if (!traceMode && k > 0.35) {
        // Ambient life: a small rotating subset of connections sparks faintly.
        const count = Math.min(18, links.length);
        const base = Math.floor(pulseRef.current * 0.25);
        for (let i = 0; i < count; i++) {
          const link = links[(i * 53 + base) % links.length];
          if (!link) continue;
          if (visibleEdgeTypes && link.type && !visibleEdgeTypes.has(link.type)) continue;
          const s = link.source as SimNode;
          const t2 = link.target as SimNode;
          if (!isVisible(s) || !isVisible(t2)) continue;
          const f = (pulseRef.current * speed * 0.7 + (i * 0.31) % 1) % 1;
          drawPulse(s, t2, f, 0.4, 2.6);
        }
      }
    }

    /* ── Nodes ─────────────────────────────────────────── */
    for (const node of nodes) {
      const visible = isVisible(node);
      if (!visible && !focusId) continue;

      const r = node.radius;

      // Skip tiny nodes when zoomed out
      if (r * k < 1.5 && node.id !== hovered && node.id !== selectedNodeId) continue;

      const color = (customNodeColors?.[node.fileType]) || FILE_TYPE_COLORS[node.fileType] || FILE_TYPE_COLORS.unknown;
      let alpha = visible ? 1 : 0.1;

      if (focusId && node.id !== focusId && !connectedSet!.has(node.id)) {
        alpha *= 0.22;
      }

      // Churn heat: in history mode, frequently-changed files glow hot. The
      // warm halo is drawn under the node and scales with the file's heat.
      const heat = historyMode && churn ? (churn.get(node.filePath) ?? 0) : 0;
      if (heat > 0) {
        const pulse = 0.85 + 0.15 * Math.sin(pulseRef.current + node._phase);
        const heatRadius = r * (2.2 + heat * 2.4) * pulse;
        const heatGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, heatRadius);
        // Hot files trend orange→red; cooler ones stay amber.
        const heatHex = heat > 0.66 ? RENDER.heat.hot : heat > 0.33 ? RENDER.heat.warm : RENDER.heat.cool;
        heatGrad.addColorStop(0, hexToRGBA(heatHex, 0.5 * heat * alpha));
        heatGrad.addColorStop(0.5, hexToRGBA(heatHex, 0.22 * heat * alpha));
        heatGrad.addColorStop(1, hexToRGBA(heatHex, 0));
        ctx.beginPath();
        ctx.arc(node.x, node.y, heatRadius, 0, Math.PI * 2);
        ctx.fillStyle = heatGrad;
        ctx.fill();
      }

      // Agent-trace tints: read = blue, modified/created = amber, deleted = red,
      // active step = pulsing ring. Tint overrides the file-type color so the
      // agent's footprint reads clearly; untouched nodes are dimmed back.
      let traceColor: string | null = null;
      if (traceMode) {
        const isActive = traceActiveId === node.id;
        const isModified = traceModifiedIds?.has(node.id);
        const isRead = traceReadIds?.has(node.id);
        const isDeleted = traceDeletedIds?.has(node.id);
        if (isDeleted) traceColor = RENDER.heat.hot;
        else if (isModified) traceColor = RENDER.heat.warm;
        else if (isRead) traceColor = COLORS.accent;
        const touched = isActive || isModified || isRead || isDeleted;
        // Dim everything the agent hasn't touched yet so the route stands out.
        if (!touched && node.id !== selectedNodeId) alpha *= 0.18;

        if (isActive) {
          const pulse = 0.4 + 0.4 * Math.sin(pulseRef.current * 1.6);
          const ringR = r * 2 + 6 + 4 * Math.sin(pulseRef.current * 1.6);
          ctx.beginPath();
          ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = hexToRGBA(RENDER.trace.active, pulse);
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }

      const isSelected = node.id === selectedNodeId;
      const isHovered = node.id === hovered;

      // Glow gradient — tighter falloff (~0.45 mid) for a crisper read.
      // Hover/selected push a wider, brighter halo so the focus is unmistakable.
      const glowColor = traceColor ?? color;
      const glowRadius = isSelected ? r * 3.2 : isHovered ? r * 2.8 : r * 1.8;
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);

      if (isSelected) {
        gradient.addColorStop(0, hexToRGBA(COLORS.selected, alpha));
        gradient.addColorStop(0.3, hexToRGBA(color, 0.8 * alpha));
        gradient.addColorStop(1, hexToRGBA(color, 0));
      } else if (isHovered) {
        gradient.addColorStop(0, hexToRGBA(COLORS.selected, 0.9 * alpha));
        gradient.addColorStop(0.45, hexToRGBA(color, 0.7 * alpha));
        gradient.addColorStop(1, hexToRGBA(color, 0));
      } else {
        gradient.addColorStop(0, hexToRGBA(glowColor, alpha));
        gradient.addColorStop(0.45, hexToRGBA(glowColor, 0.32 * alpha));
        gradient.addColorStop(1, hexToRGBA(glowColor, 0));
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Solid core
      const coreColor = isSelected
        ? hexToRGBA(COLORS.selected, alpha)
        : isHovered
          ? hexToRGBA(COLORS.selected, 0.9 * alpha)
          : hexToRGBA(glowColor, alpha);
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = coreColor;
      ctx.fill();

      // Soft spherical highlight (offset up-left) for a 3D pebble feel.
      // Only for nodes big enough on screen — tiny/distant nodes keep the flat
      // fill for perf and to avoid muddy sub-pixel gradients.
      if (r * k > 3 && !isSelected && !isHovered) {
        const hlR = r * 0.9;
        const hlx = node.x - r * 0.3;
        const hly = node.y - r * 0.3;
        const hlGrad = ctx.createRadialGradient(hlx, hly, 0, hlx, hly, hlR);
        // RENDER.nodeCoreHighlight is an rgba() string with its own alpha; node
        // dimming is applied via globalAlpha so it composes correctly.
        hlGrad.addColorStop(0, RENDER.nodeCoreHighlight);
        hlGrad.addColorStop(1, hexToRGBA(glowColor, 0));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = hlGrad;
        ctx.fill();
        ctx.restore();
      }

      // Hover: thin crisp rim. Selected: crisp 2px accent/white ring further out
      // so the selection always reads as the single brightest thing on screen.
      if (isHovered && !isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRGBA(COLORS.selected, 0.9 * alpha);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRGBA(COLORS.accentBright, alpha);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Search highlight pulse
      if (searchHighlight && node.id === searchHighlight) {
        const pulseAlpha = 0.3 + 0.3 * Math.sin(pulseRef.current);
        const pulseRadius = r * 2 + 6 * Math.sin(pulseRef.current);
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRGBA(COLORS.accentBright, pulseAlpha);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Labels — at rest only hubs (and only when zoomed in a little) get a
      // label so large graphs stay readable; the focused neighbourhood and the
      // hovered/selected node are always labelled. The "Toggle labels" control
      // (forceShowLabels) still reveals everything.
      const inFocus = !!focusId && !!connectedSet?.has(node.id);
      const showLabel =
        forceShowLabels ||
        isHovered ||
        isSelected ||
        inFocus ||
        (!focusId && node._degree >= LAYOUT.hubLabelDegree && k > 0.75);
      if (showLabel && visible) {
        ctx.font = `11px ${RENDER.fontMono}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const lx = node.x;
        const ly = node.y + r + 4;
        // Cheap legibility halo: draw the label in the bg color at 1px offsets
        // first (no shadowBlur — too expensive in the rAF loop), then the label.
        ctx.fillStyle = RENDER.labelHalo;
        ctx.fillText(node.label, lx - 1, ly);
        ctx.fillText(node.label, lx + 1, ly);
        ctx.fillText(node.label, lx, ly - 1);
        ctx.fillText(node.label, lx, ly + 1);
        ctx.fillStyle = RENDER.label;
        ctx.fillText(node.label, lx, ly);
      }
    }

    ctx.restore();

    // Publish the visible region (world coords) for the minimap lens. Throttled
    // internally to ~120ms so this rAF loop never floods React with updates.
    emitViewportRef.current();

    animFrameRef.current = requestAnimationFrame(drawRef.current);
  }, [selectedNodeId, filters, searchHighlight, forceShowLabels, customNodeColors, customEdgeColors, visibleEdgeTypes, historyMode, churn, traceMode, traceActiveId, traceReadIds, traceModifiedIds, traceDeletedIds, tracePath]);
  useEffect(() => { drawRef.current = draw; }, [draw]);

  /* ── Hit testing ─────────────────────────────────────── */

  const hitTest = useCallback(
    (mx: number, my: number): SimNode | null => {
      const t = transformRef.current;
      const x = (mx - t.x) / t.k;
      const y = (my - t.y) / t.k;

      let closest: SimNode | null = null;
      let closestDist = Infinity;

      for (const node of nodesRef.current) {
        const dx = node.x - x;
        const dy = node.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = Math.max(node.radius, 8);
        if (dist < hitRadius && dist < closestDist) {
          closest = node;
          closestDist = dist;
        }
      }

      return closest;
    },
    [],
  );

  hitTestRef.current = hitTest;

  /* ── Setup canvas, zoom, drag ────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    buildSimulation();

    const sel = d3.select(canvas);

    let dragNode: SimNode | null = null;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let didMove = false;

    // d3.zoom ONLY for scroll-wheel zoom — no mouse/pointer pan
    const zoomBehavior = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 10])
      .filter((event: Event) => event.type === 'wheel')
      .on('zoom', (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        transformRef.current = event.transform;
      });
    sel.call(zoomBehavior);

    /* ── External view-control events (from GraphControls / Minimap) ──── */

    const canvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      return { w: canvas.width / dpr, h: canvas.height / dpr };
    };

    // Fit-all-nodes transform (bounding-box based) — reused by 'fit' and
    // emitted once after the initial layout settles.
    const computeFitTransform = (): d3.ZoomTransform | null => {
      const ns = nodesRef.current;
      if (ns.length === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of ns) {
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
      }
      const { w, h } = canvasSize();
      const padding = 80;
      const gw = maxX - minX;
      const gh = maxY - minY;
      const scale = Math.min(
        Math.max(
          gw > 0 && gh > 0 ? Math.min((w - padding * 2) / gw, (h - padding * 2) / gh) : 1,
          0.1,
        ),
        10,
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return d3.zoomIdentity.translate(w / 2 - cx * scale, h / 2 - cy * scale).scale(scale);
    };

    const handleZoomEvent = (e: Event) => {
      const dir = (e as CustomEvent<{ direction?: 'in' | 'out' | 'fit' }>).detail?.direction;
      if (!dir) return;
      if (dir === 'fit') {
        const fit = computeFitTransform();
        if (fit) sel.transition().duration(400).call(zoomBehavior.transform, fit);
        return;
      }
      const { w, h } = canvasSize();
      const t = transformRef.current;
      const newK = Math.min(Math.max(dir === 'in' ? t.k * 1.3 : t.k / 1.3, 0.1), 10);
      // Keep the view centered on the canvas center while zooming.
      const cx = w / 2;
      const cy = h / 2;
      const tx = cx - (cx - t.x) * (newK / t.k);
      const ty = cy - (cy - t.y) * (newK / t.k);
      sel.call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(newK));
    };

    const handlePanToEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ x?: number; y?: number }>).detail;
      if (!detail || typeof detail.x !== 'number' || typeof detail.y !== 'number') return;
      const { w, h } = canvasSize();
      const k = transformRef.current.k;
      const target = d3.zoomIdentity.translate(w / 2 - detail.x * k, h / 2 - detail.y * k).scale(k);
      sel.transition().duration(400).call(zoomBehavior.transform, target);
    };

    window.addEventListener('anomaly:zoom', handleZoomEvent);
    window.addEventListener('anomaly:panTo', handlePanToEvent);

    // All mouse/touch interaction handled manually — no d3.zoom conflict

    const handleMouseDown = (e: MouseEvent) => {
      didMove = false;
      const node = hitTestRef.current?.(e.offsetX, e.offsetY);
      if (node) {
        dragNode = node;
        dragNode.fx = dragNode.x;
        dragNode.fy = dragNode.y;
        simRef.current?.alphaTarget(0.1).restart();
        canvas.style.cursor = 'grabbing';
      } else {
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.offsetX, y: e.offsetY };

      if (dragNode) {
        didMove = true;
        const t = transformRef.current;
        dragNode.fx = (e.offsetX - t.x) / t.k;
        dragNode.fy = (e.offsetY - t.y) / t.k;
        return;
      }

      if (isPanning) {
        didMove = true;
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        panStart = { x: e.clientX, y: e.clientY };
        const t = transformRef.current;
        transformRef.current = d3.zoomIdentity
          .translate(t.x + dx, t.y + dy)
          .scale(t.k);
        sel.call(zoomBehavior.transform, transformRef.current);
        return;
      }

      // Hover detection only when not dragging/panning
      const node = hitTestRef.current?.(e.offsetX, e.offsetY);
      const newId = node?.id ?? null;
      if (newId !== hoveredRef.current) {
        hoveredRef.current = newId;
        setInternalHovered(newId);
        if (onNodeHoverRef.current) onNodeHoverRef.current(node ?? null);
      }
      canvas.style.cursor = node ? 'pointer' : 'default';
    };

    const handleMouseUp = () => {
      if (dragNode) {
        const clickedNode = dragNode;
        dragNode.fx = null;
        dragNode.fy = null;
        dragNode = null;
        simRef.current?.alphaTarget(0);
        if (!didMove && onNodeClickRef.current) onNodeClickRef.current(clickedNode);
        canvas.style.cursor = 'pointer';
        return;
      }
      if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'default';
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      const node = hitTestRef.current?.(e.offsetX, e.offsetY);
      if (node && onNodeDoubleClickRef.current) {
        onNodeDoubleClickRef.current(node);
        e.preventDefault();
      }
    };

    // Touch: pan, pinch-zoom, tap-to-select, drag nodes
    let touchStartNode: SimNode | null = null;
    let touchMoved = false;
    let touchPanStart = { x: 0, y: 0 };
    let touchDragNode: SimNode | null = null;
    let lastPinchDist = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch zoom start — record initial distance
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
        return;
      }
      if (e.touches.length !== 1) return;
      touchMoved = false;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      touchPanStart = { x: touch.clientX, y: touch.clientY };

      const node = hitTestRef.current?.(x, y) ?? null;
      touchStartNode = node;
      if (node) {
        // Start dragging this node
        touchDragNode = node;
        touchDragNode.fx = touchDragNode.x;
        touchDragNode.fy = touchDragNode.y;
        simRef.current?.alphaTarget(0.1).restart();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastPinchDist > 0) {
          const scaleDelta = dist / lastPinchDist;
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const t = transformRef.current;
          const newK = Math.min(Math.max(t.k * scaleDelta, 0.1), 10);
          // Zoom centered on pinch midpoint
          const tx = midX - (midX - t.x) * (newK / t.k);
          const ty = midY - (midY - t.y) * (newK / t.k);
          transformRef.current = d3.zoomIdentity.translate(tx, ty).scale(newK);
          sel.call(zoomBehavior.transform, transformRef.current);
        }
        lastPinchDist = dist;
        touchMoved = true;
        return;
      }
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - touchPanStart.x;
      const dy = touch.clientY - touchPanStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) touchMoved = true;

      if (touchDragNode) {
        // Drag the node
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const t = transformRef.current;
        touchDragNode.fx = (x - t.x) / t.k;
        touchDragNode.fy = (y - t.y) / t.k;
      } else if (touchMoved) {
        // Pan the canvas
        const t = transformRef.current;
        transformRef.current = d3.zoomIdentity
          .translate(t.x + dx, t.y + dy)
          .scale(t.k);
        sel.call(zoomBehavior.transform, transformRef.current);
        touchPanStart = { x: touch.clientX, y: touch.clientY };
      }
    };

    const handleTouchEnd = () => {
      if (touchDragNode) {
        touchDragNode.fx = null;
        touchDragNode.fy = null;
        simRef.current?.alphaTarget(0);
        // Tap on node (no movement) = click
        if (!touchMoved && onNodeClickRef.current) {
          onNodeClickRef.current(touchDragNode);
        }
        touchDragNode = null;
      } else if (!touchMoved && touchStartNode && onNodeClickRef.current) {
        onNodeClickRef.current(touchStartNode);
      }
      touchStartNode = null;
      lastPinchDist = 0;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('dblclick', handleDblClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault(); // Prevent browser scroll/zoom
      handleTouchMove(e);
    }, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    animFrameRef.current = requestAnimationFrame(draw);

    // Adaptive density-based zoom — target consistent visual spacing regardless of graph size
    let hasFitted = false;
    const TARGET_SCREEN_SPACING = 45; // px between nearest neighbors on screen

    const fitCheck = setInterval(() => {
      if (hasFitted) return;
      const sim = simRef.current;
      if (!sim || sim.alpha() > 0.1) return;
      hasFitted = true;
      clearInterval(fitCheck);

      const nodes = nodesRef.current;
      if (nodes.length < 2) return;

      // Compute average nearest-neighbor distance in graph space
      let totalNearestDist = 0;
      let count = 0;
      for (let i = 0; i < nodes.length; i++) {
        let nearest = Infinity;
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearest) nearest = dist;
        }
        if (nearest < Infinity) {
          totalNearestDist += nearest;
          count++;
        }
      }
      const avgNearestDist = count > 0 ? totalNearestDist / count : 100;

      // Also compute bounding box to ensure all nodes are visible
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
      }

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const padding = 80;
      const gw = maxX - minX;
      const gh = maxY - minY;

      // Two zoom candidates: density-based and fit-all-nodes
      const densityScale = TARGET_SCREEN_SPACING / avgNearestDist;
      const fitScale = gw > 0 && gh > 0
        ? Math.min((w - padding * 2) / gw, (h - padding * 2) / gh)
        : 1;

      // Use the SMALLER of the two — ensures all nodes visible AND good density
      const scale = Math.min(Math.max(Math.min(densityScale, fitScale), 0.1), 1.8);

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const tx = w / 2 - cx * scale;
      const ty = h / 2 - cy * scale;

      transformRef.current = d3.zoomIdentity.translate(tx, ty).scale(scale);
      sel.call(zoomBehavior.transform, transformRef.current);
      // Emit the viewport once after the initial fit so the minimap lens is
      // correct immediately (bypasses the throttle).
      emitViewportRef.current(true);
    }, 300);

    return () => {
      clearInterval(fitCheck);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('anomaly:zoom', handleZoomEvent);
      window.removeEventListener('anomaly:panTo', handlePanToEvent);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('dblclick', handleDblClick);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animFrameRef.current);
      simRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally stable: rebuild only on data change, not on render state
  }, [buildSimulation]);

  // Sync external hovered
  useEffect(() => {
    hoveredRef.current = hoveredId ?? null;
  }, [hoveredId]);

  /* ── Expose zoom-to-node for external use ─────────── */

  useEffect(() => {
    if (!searchHighlight) return;
    const node = nodesRef.current.find((n) => n.id === searchHighlight);
    if (!node || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const sel = d3.select(canvas);
    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>().scaleExtent([0.1, 10]);
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    sel.transition().duration(800).call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(w / 2 - node.x * 2, h / 2 - node.y * 2).scale(2),
    );
  }, [searchHighlight]);

  // Node clicks handled by mouseup in the main effect above

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-dvh w-dvw"
      style={{ touchAction: 'none', cursor: 'default' }}
    />
  );
}

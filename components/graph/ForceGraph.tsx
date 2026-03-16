'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { GraphData, GraphNode, GraphEdge, FileType, Cluster } from '@/lib/graph/types';
import { FILE_TYPE_COLORS, COLORS, PHYSICS, NODE } from '@/lib/constants';

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
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
  weight: number;
  type?: string;
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
  selectedNodeId,
  filters,
  searchHighlight,
  showLabels: forceShowLabels,
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
  const hitTestRef = useRef<((mx: number, my: number) => SimNode | null) | null>(null);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
  useEffect(() => { onNodeDoubleClickRef.current = onNodeDoubleClick; }, [onNodeDoubleClick]);
  useEffect(() => { onNodeHoverRef.current = onNodeHover; }, [onNodeHover]);

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

    // Build nodes
    const spread = 0.5;
    const nodes: SimNode[] = data.nodes.map((n, i) => ({
      ...n,
      x: n.x ?? width / 2 + (Math.random() - 0.5) * width * spread,
      y: n.y ?? height / 2 + (Math.random() - 0.5) * height * spread,
      vx: 0,
      vy: 0,
      radius: nodeRadius(n.loc),
      _phase: i * 2.39996, // Golden angle offset for unique drift per node
    }));
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
      }));
    linksRef.current = allLinks;

    // Only import + call edges drive the physics (export edges are visual-only,
    // they're the reverse of imports and would double the pull force)
    const physicsLinks = allLinks.filter((l) => l.type !== 'export');
    clustersRef.current = data.clusters;

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
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.5))
      .force(
        'collision',
        d3.forceCollide<SimNode>().radius((d) => d.radius + collisionPad).strength(1),
      )
      .force('x', d3.forceX<SimNode>(width / 2).strength(0.01))
      .force('y', d3.forceY<SimNode>(height / 2).strength(0.01))
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
            node.vx! += Math.sin(t + phase) * 0.04;
            node.vy! += Math.cos(t + phase * 1.3) * 0.04;
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

  // eslint-disable-next-line react-hooks/rules-of-hooks -- draw function stored in ref for animation loop
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

    // Connected set for hover highlighting
    const connectedSet = hovered ? getConnected(hovered, links) : null;

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

        const radius = maxDist + 40;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, hexToRGBA(cluster.color, 0.06));
        gradient.addColorStop(1, hexToRGBA(cluster.color, 0));

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Cluster label when zoomed out
        if (k < 0.8) {
          ctx.font = `${14 / k}px var(--font-sans), sans-serif`;
          ctx.fillStyle = hexToRGBA(cluster.color, 0.3);
          ctx.textAlign = 'center';
          ctx.fillText(cluster.label, cx, cy - radius * 0.3);
        }
      }
    }

    /* ── Edges ─────────────────────────────────────────── */
    for (const link of links) {
      const s = link.source as SimNode;
      const t2 = link.target as SimNode;
      if (!isVisible(s) && !isVisible(t2)) continue;

      const bothVisible = isVisible(s) && isVisible(t2);

      // Scale opacity by edge weight (more imports = brighter)
      let opacity = Math.min(0.5, 0.25 + (link.weight || 1) * 0.08);
      let lineWidth = Math.min(2, 0.8 + (link.weight || 1) * 0.3);

      if (hovered) {
        const sId = s.id;
        const tId = t2.id;
        if (connectedSet!.has(sId) && connectedSet!.has(tId) && (sId === hovered || tId === hovered)) {
          opacity = 0.7;
          lineWidth = 2.5;
        } else {
          opacity = 0.06;
          lineWidth = 0.3;
        }
      }

      const edgeType = (link as SimLink & { type?: string }).type;
      const isCallEdge = edgeType === 'call';
      const isExportEdge = edgeType === 'export';

      if (isCallEdge) {
        ctx.setLineDash([6, 4]); // Dashed for function calls
      } else if (isExportEdge) {
        ctx.setLineDash([2, 3]); // Dotted for exports
      } else if (!bothVisible) {
        ctx.setLineDash([4, 4]);
        opacity *= 0.3;
      } else {
        ctx.setLineDash([]);
      }

      // Scale opacity by weight
      opacity = Math.min(opacity * (1 + link.weight * 0.15), 0.6);

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
      ctx.strokeStyle = isCallEdge
        ? `rgba(251, 191, 36, ${opacity})`   // Amber for function calls
        : isExportEdge
          ? `rgba(167, 139, 250, ${opacity})` // Purple for exports
          : `rgba(96, 165, 250, ${opacity})`;  // Blue for imports
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Arrow indicator at 70% along the curve
      if (k > 0.6 && lineWidth > 0.5) {
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
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    /* ── Nodes ─────────────────────────────────────────── */
    for (const node of nodes) {
      const visible = isVisible(node);
      if (!visible && !hovered) continue;

      const r = node.radius;

      // Skip tiny nodes when zoomed out
      if (r * k < 1.5 && node.id !== hovered && node.id !== selectedNodeId) continue;

      const color = FILE_TYPE_COLORS[node.fileType] || FILE_TYPE_COLORS.unknown;
      let alpha = visible ? 1 : 0.1;

      if (hovered && node.id !== hovered && !connectedSet!.has(node.id)) {
        alpha *= 0.3;
      }

      // Glow gradient
      const glowRadius = node.id === hovered ? r * 2.5 : node.id === selectedNodeId ? r * 3 : r * 1.8;
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);

      if (node.id === selectedNodeId) {
        gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        gradient.addColorStop(0.3, hexToRGBA(color, 0.8 * alpha));
        gradient.addColorStop(1, hexToRGBA(color, 0));
      } else if (node.id === hovered) {
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.9 * alpha})`);
        gradient.addColorStop(0.4, hexToRGBA(color, 0.7 * alpha));
        gradient.addColorStop(1, hexToRGBA(color, 0));
      } else {
        gradient.addColorStop(0, hexToRGBA(color, alpha));
        gradient.addColorStop(0.6, hexToRGBA(color, 0.3 * alpha));
        gradient.addColorStop(1, hexToRGBA(color, 0));
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Solid core
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = node.id === selectedNodeId
        ? `rgba(255, 255, 255, ${alpha})`
        : node.id === hovered
          ? `rgba(255, 255, 255, ${0.9 * alpha})`
          : hexToRGBA(color, alpha);
      ctx.fill();

      // Search highlight pulse
      if (searchHighlight && node.id === searchHighlight) {
        const pulseAlpha = 0.3 + 0.3 * Math.sin(pulseRef.current);
        const pulseRadius = r * 2 + 6 * Math.sin(pulseRef.current);
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Labels
      const showLabel = forceShowLabels || k > 0.7 || node.id === hovered || node.id === selectedNodeId;
      if (showLabel && visible) {
        ctx.font = `11px var(--font-mono), 'JetBrains Mono', monospace`;
        ctx.fillStyle = `rgba(228, 228, 239, 0.7)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, node.x, node.y + r + 4);
      }
    }

    ctx.restore();

    animFrameRef.current = requestAnimationFrame(drawRef.current);
  }, [hoveredId, selectedNodeId, filters, searchHighlight, forceShowLabels]);
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

    // Touch: tap-to-select
    let touchStartNode: SimNode | null = null;
    let touchMoved = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchMoved = false;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      touchStartNode = hitTestRef.current?.(touch.clientX - rect.left, touch.clientY - rect.top) ?? null;
    };
    const handleTouchMove = () => { touchMoved = true; };
    const handleTouchEnd = () => {
      if (touchStartNode && !touchMoved && onNodeClickRef.current) onNodeClickRef.current(touchStartNode);
      touchStartNode = null;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('dblclick', handleDblClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
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
    }, 300);

    return () => {
      clearInterval(fitCheck);
      window.removeEventListener('resize', resizeCanvas);
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

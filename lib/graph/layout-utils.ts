import * as d3 from 'd3';
import type { GraphEdge, GraphNode } from '@/lib/graph/types';
import { PHYSICS, NODE } from '@/lib/constants';

/**
 * D3 simulation node — extends GraphNode with required simulation fields.
 */
export interface SimNode extends GraphNode, d3.SimulationNodeDatum {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

/**
 * D3 simulation link — uses SimNode references.
 */
export interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
  weight: number;
}

/**
 * Calculate the visual radius for a node based on its LOC.
 * Uses a square-root scale clamped between min and max radius.
 */
export function nodeRadius(loc: number): number {
  const scale = Math.sqrt(loc) * 0.5;
  return Math.max(NODE.minRadius, Math.min(NODE.maxRadius, scale));
}

/**
 * Create and configure a D3 force simulation for the graph layout.
 */
export function createSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): d3.Simulation<SimNode, SimLink> {
  // Prepare simulation nodes with radius and initial positions
  const simNodes: SimNode[] = nodes.map((n) => ({
    ...n,
    x: n.x ?? width / 2 + (Math.random() - 0.5) * width * 0.5,
    y: n.y ?? height / 2 + (Math.random() - 0.5) * height * 0.5,
    vx: n.vx ?? 0,
    vy: n.vy ?? 0,
    radius: n.radius ?? nodeRadius(n.loc),
  }));

  // Prepare simulation links
  const simLinks: SimLink[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
    weight: e.weight,
  }));

  const simulation = d3
    .forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      d3
        .forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(PHYSICS.linkDistance)
        .strength((link) => {
          // Stronger links for higher-weight edges
          const w = (link as SimLink).weight;
          return Math.min(1, 0.2 + w * 0.1);
        }),
    )
    .force(
      'charge',
      d3.forceManyBody<SimNode>().strength(PHYSICS.charge),
    )
    .force(
      'center',
      d3.forceCenter<SimNode>(width / 2, height / 2).strength(PHYSICS.centerStrength),
    )
    .force(
      'collision',
      d3
        .forceCollide<SimNode>()
        .radius((d) => d.radius + PHYSICS.collisionPadding),
    )
    .alphaDecay(PHYSICS.alphaDecay)
    .velocityDecay(PHYSICS.velocityDecay);

  return simulation;
}

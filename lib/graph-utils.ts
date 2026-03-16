import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'RL' | 'BT'
  nodeWidth?: number
  nodeHeight?: number
  rankSep?: number
  nodeSep?: number
}

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    direction = 'LR',
    nodeWidth = 280,
    nodeHeight = 120,
    rankSep = 80,
    nodeSep = 40,
  } = options

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, ranksep: rankSep, nodesep: nodeSep })

  nodes.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

export function buildSwimlaneLayout(
  nodes: Node[],
  edges: Edge[],
  layerOrder: string[]
): { nodes: Node[]; edges: Edge[] } {
  const LANE_WIDTH = 300
  const NODE_HEIGHT = 120
  const V_GAP = 30
  const H_OFFSET = 50

  const lanes = new Map<string, Node[]>()
  layerOrder.forEach((layer) => lanes.set(layer, []))

  nodes.forEach((node) => {
    const layer = (node.data as Record<string, string>).layer || 'unknown'
    const lane = lanes.get(layer) || lanes.get('unknown')!
    lane.push(node)
  })

  const layoutedNodes: Node[] = []
  let laneIndex = 0

  layerOrder.forEach((layer) => {
    const laneNodes = lanes.get(layer) || []
    laneNodes.forEach((node, i) => {
      layoutedNodes.push({
        ...node,
        position: {
          x: laneIndex * LANE_WIDTH + H_OFFSET,
          y: i * (NODE_HEIGHT + V_GAP) + 60,
        },
      })
    })
    if (laneNodes.length > 0) laneIndex++
  })

  return { nodes: layoutedNodes, edges }
}

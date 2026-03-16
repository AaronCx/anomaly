'use client'

import { useMemo, useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { FunctionNode, FunctionGraph } from '@/lib/types'
import {
  getLayerColor,
  getEdgeColor,
  CARD_BG,
  CARD_BORDER,
  TEXT_DIM,
  DEAD_CODE_COLOR,
  DEAD_CODE_OPACITY,
  ACCENT,
} from '@/lib/color-schemes'
import { applyDagreLayout } from '@/lib/graph-utils'
import NodeCard, { type NodeCardData } from './NodeCard'
import EdgeAnimated from './EdgeAnimated'
import DepthSlider from './DepthSlider'

interface CallGraphProps {
  functionGraph: FunctionGraph
  centralNodeId?: string
  onNodeClick: (nodeId: string, filePath: string, lineNumber: number) => void
  onAnnotationRefresh?: (nodeId: string) => void
}

const nodeTypes = { nodeCard: NodeCard }
const edgeTypes = { edgeAnimated: EdgeAnimated }

export default function CallGraph({
  functionGraph,
  centralNodeId,
  onNodeClick,
  onAnnotationRefresh,
}: CallGraphProps) {
  const [depth, setDepth] = useState(3)
  const [pathSelection, setPathSelection] = useState<string[]>([])

  // Prune graph based on depth from central node
  const prunedGraph = useMemo(() => {
    if (!centralNodeId) return functionGraph

    const adjacency = new Map<string, Set<string>>()
    functionGraph.edges.forEach((e) => {
      if (!adjacency.has(e.source)) adjacency.set(e.source, new Set())
      if (!adjacency.has(e.target)) adjacency.set(e.target, new Set())
      adjacency.get(e.source)!.add(e.target)
      adjacency.get(e.target)!.add(e.source)
    })

    const visited = new Set<string>()
    const queue: [string, number][] = [[centralNodeId, 0]]
    visited.add(centralNodeId)

    while (queue.length > 0) {
      const [nodeId, d] = queue.shift()!
      if (d >= depth) continue
      const neighbors = adjacency.get(nodeId)
      if (!neighbors) continue
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push([neighbor, d + 1])
        }
      }
    }

    return {
      nodes: functionGraph.nodes.filter((n) => visited.has(n.id)),
      edges: functionGraph.edges.filter(
        (e) => visited.has(e.source) && visited.has(e.target)
      ),
    }
  }, [functionGraph, centralNodeId, depth])

  // Detect dead code (0 incoming edges)
  const incomingCount = useMemo(() => {
    const counts = new Map<string, number>()
    prunedGraph.nodes.forEach((n) => counts.set(n.id, 0))
    prunedGraph.edges.forEach((e) => {
      counts.set(e.target, (counts.get(e.target) || 0) + 1)
    })
    return counts
  }, [prunedGraph])

  // Compute shortest path between two selected nodes
  const highlightedPath = useMemo(() => {
    if (pathSelection.length !== 2) return new Set<string>()

    const [start, end] = pathSelection
    const adjacency = new Map<string, string[]>()
    prunedGraph.edges.forEach((e) => {
      if (!adjacency.has(e.source)) adjacency.set(e.source, [])
      adjacency.get(e.source)!.push(e.target)
    })

    const prev = new Map<string, string | null>()
    const visited = new Set<string>()
    const queue: string[] = [start]
    visited.add(start)
    prev.set(start, null)

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current === end) break
      for (const neighbor of adjacency.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          prev.set(neighbor, current)
          queue.push(neighbor)
        }
      }
    }

    const path = new Set<string>()
    let cur: string | null | undefined = end
    while (cur != null) {
      path.add(cur)
      cur = prev.get(cur)
    }
    return path.has(start) ? path : new Set<string>()
  }, [pathSelection, prunedGraph])

  const handleNodeClick = useCallback(
    (nodeId: string, filePath: string, lineNumber: number) => {
      onNodeClick(nodeId, filePath, lineNumber)

      // Path selection: shift-click to add second node
      setPathSelection((prev) => {
        if (prev.length === 0) return [nodeId]
        if (prev.length === 1 && prev[0] !== nodeId) return [prev[0], nodeId]
        return [nodeId]
      })
    },
    [onNodeClick]
  )

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    const rfNodes: Node<NodeCardData>[] = prunedGraph.nodes.map((fn) => {
      const incoming = incomingCount.get(fn.id) || 0
      const isDeadCode = incoming === 0 && fn.id !== centralNodeId
      const isOnPath = highlightedPath.has(fn.id)

      return {
        id: fn.id,
        type: 'nodeCard' as const,
        position: { x: 0, y: 0 },
        data: {
          name: fn.name,
          filePath: fn.filePath,
          lineNumber: fn.lineNumber,
          layer: fn.layer,
          params: fn.params,
          returnType: fn.returnType,
          annotation: fn.annotation,
          annotationLoading: fn.annotationLoading,
          isDeadCode,
          isExported: fn.isExported,
          onNodeClick: handleNodeClick,
          onAnnotationRefresh,
        },
        style: {
          opacity: isDeadCode ? DEAD_CODE_OPACITY : 1,
          ...(fn.id === centralNodeId
            ? { boxShadow: `0 0 24px ${ACCENT}60` }
            : {}),
          ...(isOnPath
            ? { boxShadow: `0 0 16px ${ACCENT}40` }
            : {}),
        },
      }
    })

    const rfEdges: Edge[] = prunedGraph.edges.map((e) => {
      const targetNode = prunedGraph.nodes.find((n) => n.id === e.target)
      const isOnPath =
        highlightedPath.has(e.source) && highlightedPath.has(e.target)

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'edgeAnimated' as const,
        data: {
          color: isOnPath
            ? ACCENT
            : targetNode
            ? getEdgeColor(targetNode.layer)
            : undefined,
        },
        style: isOnPath ? { strokeWidth: 3 } : undefined,
      }
    })

    return applyDagreLayout(rfNodes, rfEdges, {
      direction: 'TB',
      rankSep: 100,
      nodeSep: 50,
    })
  }, [prunedGraph, centralNodeId, incomingCount, highlightedPath, handleNodeClick, onAnnotationRefresh])

  return (
    <div className="relative flex h-full w-full flex-col">
      <div
        className="flex items-center gap-4 px-4 py-3"
        style={{ borderBottom: `1px solid ${CARD_BORDER}` }}
      >
        <DepthSlider depth={depth} onDepthChange={setDepth} />
        {pathSelection.length > 0 && (
          <button
            onClick={() => setPathSelection([])}
            className="rounded px-2 py-1 text-[10px] transition-colors hover:bg-white/5"
            style={{ color: TEXT_DIM, border: `1px solid ${CARD_BORDER}` }}
          >
            Clear path ({pathSelection.length}/2 selected)
          </button>
        )}
      </div>

      <div className="flex-1">
        {layoutNodes.length > 0 ? (
          <ReactFlow
            nodes={layoutNodes}
            edges={layoutEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ background: '#0a0a0f' }}
          >
            <Background color={CARD_BORDER} gap={32} size={1} />
            <Controls
              style={{
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 8,
              }}
            />
            <MiniMap
              style={{
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 8,
              }}
              nodeColor={(node) => {
                const data = node.data as NodeCardData
                return getLayerColor(data.layer)
              }}
              maskColor={`${CARD_BG}cc`}
            />
          </ReactFlow>
        ) : (
          <div
            className="flex h-full items-center justify-center"
            style={{ color: TEXT_DIM }}
          >
            <p className="text-sm">Select a function to view its call graph</p>
          </div>
        )}
      </div>
    </div>
  )
}

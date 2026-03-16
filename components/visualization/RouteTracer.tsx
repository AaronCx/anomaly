'use client'

import { useMemo, useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { RouteNode, RouteTrace, NodeLayer } from '@/lib/types'
import { getLayerColor, getEdgeColor, CARD_BORDER, TEXT_DIM, ACCENT, CARD_BG } from '@/lib/color-schemes'
import { buildSwimlaneLayout } from '@/lib/graph-utils'
import NodeCard, { type NodeCardData } from './NodeCard'
import EdgeAnimated from './EdgeAnimated'

interface RouteTracerProps {
  analysisId: string
  routes: RouteNode[]
  trace: RouteTrace | null
  isTraceLoading: boolean
  onRouteSelect: (routePath: string) => void
  onNodeClick: (nodeId: string, filePath: string, lineNumber: number) => void
}

const LANE_ORDER: NodeLayer[] = ['route', 'middleware', 'controller', 'service', 'data']

const nodeTypes = { nodeCard: NodeCard }
const edgeTypes = { edgeAnimated: EdgeAnimated }

export default function RouteTracer({
  routes,
  trace,
  isTraceLoading,
  onRouteSelect,
  onNodeClick,
}: RouteTracerProps) {
  const [selectedRoute, setSelectedRoute] = useState<string>('')

  const handleRouteChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value
      setSelectedRoute(val)
      if (val) onRouteSelect(val)
    },
    [onRouteSelect]
  )

  const { layoutNodes, layoutEdges } = useMemo(() => {
    if (!trace) return { layoutNodes: [], layoutEdges: [] }

    const rfNodes: Node<NodeCardData>[] = trace.chain.map((fn) => ({
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
        isDeadCode: fn.isDeadCode,
        isExported: fn.isExported,
        onNodeClick,
      },
    }))

    const rfEdges: Edge[] = trace.edges.map((e) => {
      const targetNode = trace.chain.find((n) => n.id === e.target)
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'edgeAnimated' as const,
        data: {
          color: targetNode ? getEdgeColor(targetNode.layer) : undefined,
        },
      }
    })

    const result = buildSwimlaneLayout(rfNodes, rfEdges, LANE_ORDER)
    return { layoutNodes: result.nodes, layoutEdges: result.edges }
  }, [trace, onNodeClick])

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Route selector */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
        <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: TEXT_DIM }}>
          Route
        </label>
        <select
          value={selectedRoute}
          onChange={handleRouteChange}
          className="rounded-md px-3 py-1.5 font-mono text-xs outline-none"
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            color: selectedRoute ? '#e2e8f0' : TEXT_DIM,
            fontFamily: 'var(--font-jetbrains)',
          }}
        >
          <option value="">Select a route...</option>
          {routes.map((r) => (
            <option key={r.id} value={r.path}>
              {r.method} {r.path}
            </option>
          ))}
        </select>
        {isTraceLoading && (
          <div className="flex items-center gap-2" style={{ color: TEXT_DIM }}>
            <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
            <span className="text-[10px]">Tracing...</span>
          </div>
        )}
      </div>

      {/* Swimlane labels */}
      {trace && (
        <div className="flex px-4 py-2" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
          {LANE_ORDER.map((lane) => (
            <div
              key={lane}
              className="flex-1 text-center text-[10px] font-bold uppercase tracking-widest"
              style={{ color: getLayerColor(lane) }}
            >
              {lane}
            </div>
          ))}
        </div>
      )}

      {/* Flow canvas */}
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
              style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8 }}
            />
          </ReactFlow>
        ) : (
          <div className="flex h-full items-center justify-center" style={{ color: TEXT_DIM }}>
            <p className="text-sm">
              {selectedRoute ? 'No trace data available' : 'Select a route to trace its flow'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

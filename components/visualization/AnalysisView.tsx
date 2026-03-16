'use client'

import { useState, useMemo, useCallback } from 'react'
import type {
  AnalysisResult,
  VisualizationMode,
  FunctionGraph,
  RouteTrace,
} from '@/lib/types'
import { useRouteTrace } from '@/hooks/useRouteTrace'
import { useGraphInteraction } from '@/hooks/useGraphInteraction'
import ViewSwitcher from './ViewSwitcher'
import SearchBar, { type SearchItem } from './SearchBar'
import RouteTracer from './RouteTracer'
import ModuleMap from './ModuleMap'
import CallGraph from './CallGraph'
import CodePanel from './CodePanel'
import { TEXT_DIM, CARD_BORDER } from '@/lib/color-schemes'

interface AnalysisViewProps {
  analysis: AnalysisResult
}

export default function AnalysisView({ analysis }: AnalysisViewProps) {
  const [mode, setMode] = useState<VisualizationMode>('route-tracer')
  const [selectedRoutePath, setSelectedRoutePath] = useState<string | null>(null)
  const [selectedFileForGraph, setSelectedFileForGraph] = useState<string | null>(null)

  const {
    selectedNodeId,
    codePanelOpen,
    selectedFilePath,
    selectedLineNumber,
    selectNode,
    closeCodePanel,
  } = useGraphInteraction()

  const { trace, isLoading: isTraceLoading } = useRouteTrace(
    analysis.id,
    selectedRoutePath
  )

  // Build function graph from the selected file's functions
  const functionGraph: FunctionGraph = useMemo(() => {
    if (!selectedFileForGraph) {
      // Show all functions from all files
      const allFunctions = analysis.files.flatMap((f) => f.functions)
      const allEdges = analysis.modules.edges.filter((e) => e.type === 'call')
      return { nodes: allFunctions, edges: allEdges }
    }

    const file = analysis.files.find((f) => f.filePath === selectedFileForGraph)
    if (!file) return { nodes: [], edges: [] }

    const fnIds = new Set(file.functions.map((f) => f.id))
    const relevantEdges = analysis.modules.edges.filter(
      (e) => fnIds.has(e.source) || fnIds.has(e.target)
    )
    // Include connected functions from other files
    const connectedIds = new Set<string>()
    relevantEdges.forEach((e) => {
      connectedIds.add(e.source)
      connectedIds.add(e.target)
    })
    const allFunctions = analysis.files.flatMap((f) => f.functions)
    const nodes = allFunctions.filter((f) => connectedIds.has(f.id))

    return { nodes, edges: relevantEdges }
  }, [analysis, selectedFileForGraph])

  // Build search items
  const searchItems: SearchItem[] = useMemo(() => {
    const items: SearchItem[] = []

    analysis.files.forEach((f) => {
      items.push({
        id: f.id,
        label: f.filePath.split('/').pop() || f.filePath,
        sublabel: f.filePath,
        type: 'file',
      })

      f.functions.forEach((fn) => {
        items.push({
          id: fn.id,
          label: fn.name,
          sublabel: `${f.filePath}:${fn.lineNumber}`,
          type: 'function',
        })
      })
    })

    return items
  }, [analysis])

  const handleSearchSelect = useCallback(
    (item: SearchItem) => {
      if (item.type === 'file') {
        setMode('module-map')
        // highlight in module map
      } else {
        const fn = analysis.files
          .flatMap((f) => f.functions)
          .find((f) => f.id === item.id)
        if (fn) {
          selectNode(fn.id, fn.filePath, fn.lineNumber)
          setMode('call-graph')
        }
      }
    },
    [analysis, selectNode]
  )

  const handleFileClick = useCallback((filePath: string) => {
    setSelectedFileForGraph(filePath)
    setMode('call-graph')
  }, [])

  const handleNodeClick = useCallback(
    (nodeId: string, filePath: string, lineNumber: number) => {
      selectNode(nodeId, filePath, lineNumber)
    },
    [selectNode]
  )

  return (
    <div className="flex h-screen w-full flex-col" style={{ background: '#0a0a0f' }}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-4 px-4 py-3"
        style={{ borderBottom: `1px solid ${CARD_BORDER}` }}
      >
        <div className="flex items-center gap-4">
          <ViewSwitcher activeMode={mode} onModeChange={setMode} />
          <div className="hidden text-xs sm:block" style={{ color: TEXT_DIM }}>
            {analysis.owner}/{analysis.repo}
            <span className="ml-2 opacity-50">{analysis.branch}</span>
          </div>
        </div>
        <SearchBar items={searchItems} onSelect={handleSearchSelect} />
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
        {mode === 'route-tracer' && (
          <RouteTracer
            analysisId={analysis.id}
            routes={analysis.routes}
            trace={trace}
            isTraceLoading={isTraceLoading}
            onRouteSelect={setSelectedRoutePath}
            onNodeClick={handleNodeClick}
          />
        )}

        {mode === 'module-map' && (
          <ModuleMap
            moduleGraph={analysis.modules}
            onFileClick={handleFileClick}
            onNodeClick={handleNodeClick}
          />
        )}

        {mode === 'call-graph' && (
          <CallGraph
            functionGraph={functionGraph}
            centralNodeId={selectedNodeId ?? undefined}
            onNodeClick={handleNodeClick}
          />
        )}
      </div>

      {/* Code Panel */}
      <CodePanel
        filePath={selectedFilePath}
        lineNumber={selectedLineNumber}
        isOpen={codePanelOpen}
        onClose={closeCodePanel}
      />
    </div>
  )
}

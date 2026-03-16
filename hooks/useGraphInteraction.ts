'use client'

import { useState, useCallback } from 'react'

interface UseGraphInteractionReturn {
  selectedNodeId: string | null
  hoveredNodeId: string | null
  codePanelOpen: boolean
  selectedFilePath: string | null
  selectedLineNumber: number | null
  selectNode: (nodeId: string, filePath: string, lineNumber: number) => void
  hoverNode: (nodeId: string | null) => void
  openCodePanel: (filePath: string, lineNumber: number) => void
  closeCodePanel: () => void
  clearSelection: () => void
}

export function useGraphInteraction(): UseGraphInteractionReturn {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [codePanelOpen, setCodePanelOpen] = useState(false)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [selectedLineNumber, setSelectedLineNumber] = useState<number | null>(null)

  const selectNode = useCallback(
    (nodeId: string, filePath: string, lineNumber: number) => {
      setSelectedNodeId(nodeId)
      setSelectedFilePath(filePath)
      setSelectedLineNumber(lineNumber)
      setCodePanelOpen(true)
    },
    []
  )

  const hoverNode = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId)
  }, [])

  const openCodePanel = useCallback((filePath: string, lineNumber: number) => {
    setSelectedFilePath(filePath)
    setSelectedLineNumber(lineNumber)
    setCodePanelOpen(true)
  }, [])

  const closeCodePanel = useCallback(() => {
    setCodePanelOpen(false)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null)
    setHoveredNodeId(null)
    setCodePanelOpen(false)
    setSelectedFilePath(null)
    setSelectedLineNumber(null)
  }, [])

  return {
    selectedNodeId,
    hoveredNodeId,
    codePanelOpen,
    selectedFilePath,
    selectedLineNumber,
    selectNode,
    hoverNode,
    openCodePanel,
    closeCodePanel,
    clearSelection,
  }
}

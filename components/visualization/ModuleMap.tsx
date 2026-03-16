'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import type { FileNode, GraphEdge, Cluster, ModuleGraph } from '@/lib/types'
import {
  getFileTypeColor,
  CARD_BG,
  CARD_BORDER,
  TEXT_PRIMARY,
  TEXT_DIM,
  BG_COLOR,
} from '@/lib/color-schemes'

interface ModuleMapProps {
  moduleGraph: ModuleGraph
  onFileClick: (filePath: string) => void
  onNodeClick: (nodeId: string, filePath: string, lineNumber: number) => void
  highlightNodeId?: string | null
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  filePath: string
  language: string
  loc: number
  complexity: number
  fileType: string
  imports: string[]
  exports: string[]
  annotation?: string
  cluster?: string
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string
  type: string
}

export default function ModuleMap({
  moduleGraph,
  onFileClick,
  onNodeClick,
  highlightNodeId,
}: ModuleMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    node: SimNode
  } | null>(null)

  const buildSimulation = useCallback(() => {
    const svg = d3.select(svgRef.current)
    if (!svgRef.current || !containerRef.current) return

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    const nodes: SimNode[] = moduleGraph.nodes.map((f) => {
      const cluster = moduleGraph.clusters.find((c) => c.files.includes(f.id))
      return {
        id: f.id,
        filePath: f.filePath,
        language: f.language,
        loc: f.loc,
        complexity: f.complexity,
        fileType: f.fileType,
        imports: f.imports,
        exports: f.exports,
        annotation: f.annotation,
        cluster: cluster?.id,
      }
    })

    const nodeMap = new Map(nodes.map((n) => [n.id, n]))

    const links: SimLink[] = moduleGraph.edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
      }))

    const defs = svg.append('defs')
    defs
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', `${TEXT_DIM}60`)

    const g = svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })

    svg.call(zoom as unknown as (selection: d3.Selection<SVGSVGElement | null, unknown, null, undefined>) => void)

    // Cluster labels
    const clusterGroups = d3.group(nodes, (n) => n.cluster)
    const clusterLabels = g
      .selectAll('.cluster-label')
      .data(moduleGraph.clusters)
      .enter()
      .append('text')
      .attr('class', 'cluster-label')
      .text((d) => d.label)
      .attr('fill', (d) => d.color + '80')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--font-jetbrains)')
      .attr('text-anchor', 'middle')

    const link = g
      .selectAll('.link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', `${TEXT_DIM}30`)
      .attr('stroke-width', 0.5)
      .attr('marker-end', 'url(#arrowhead)')

    const nodeRadius = (d: SimNode) =>
      Math.max(4, Math.min(20, Math.sqrt(d.loc * (d.complexity || 1)) / 4))

    const node = g
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('r', nodeRadius)
      .attr('fill', (d) => getFileTypeColor(d.fileType as import('@/lib/types').FileType))
      .attr('stroke', (d) =>
        d.id === highlightNodeId
          ? '#fff'
          : getFileTypeColor(d.fileType as import('@/lib/types').FileType) + '40'
      )
      .attr('stroke-width', (d) => (d.id === highlightNodeId ? 2 : 1))
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        onFileClick(d.filePath)
        onNodeClick(d.id, d.filePath, 1)
      })
      .on('mouseenter', (event, d) => {
        const [x, y] = d3.pointer(event, containerRef.current)
        setTooltip({ x, y, node: d })
        d3.select(event.currentTarget as SVGCircleElement)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .style('filter', `drop-shadow(0 0 8px ${getFileTypeColor(d.fileType as import('@/lib/types').FileType)})`)
      })
      .on('mouseleave', (event, d) => {
        setTooltip(null)
        d3.select(event.currentTarget as SVGCircleElement)
          .attr('stroke', getFileTypeColor(d.fileType as import('@/lib/types').FileType) + '40')
          .attr('stroke-width', 1)
          .style('filter', 'none')
      })
      .call(
        d3.drag<SVGCircleElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3.forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(80)
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 4))
      .on('tick', () => {
        link
          .attr('x1', (d) => ((d.source as SimNode).x ?? 0))
          .attr('y1', (d) => ((d.source as SimNode).y ?? 0))
          .attr('x2', (d) => ((d.target as SimNode).x ?? 0))
          .attr('y2', (d) => ((d.target as SimNode).y ?? 0))

        node
          .attr('cx', (d) => d.x ?? 0)
          .attr('cy', (d) => d.y ?? 0)

        // Update cluster label positions
        clusterLabels.each(function (cluster) {
          const clusterNodes = nodes.filter((n) => n.cluster === cluster.id)
          if (clusterNodes.length === 0) return
          const cx = d3.mean(clusterNodes, (n) => n.x) ?? 0
          const cy = (d3.min(clusterNodes, (n) => n.y) ?? 0) - 20
          d3.select(this).attr('x', cx).attr('y', cy)
        })
      })

    return () => {
      simulation.stop()
    }
  }, [moduleGraph, highlightNodeId, onFileClick, onNodeClick])

  useEffect(() => {
    const cleanup = buildSimulation()
    return cleanup
  }, [buildSimulation])

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg ref={svgRef} className="h-full w-full" />

      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 max-w-xs rounded-lg p-3 shadow-lg"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 12,
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
          }}
        >
          <div
            className="font-mono text-xs font-bold truncate"
            style={{ color: TEXT_PRIMARY, fontFamily: 'var(--font-jetbrains)' }}
          >
            {tooltip.node.filePath.split('/').pop()}
          </div>
          <div
            className="mt-0.5 font-mono text-[10px] truncate"
            style={{ color: TEXT_DIM, fontFamily: 'var(--font-jetbrains)' }}
          >
            {tooltip.node.filePath}
          </div>
          <div className="mt-2 flex gap-3 text-[10px]" style={{ color: TEXT_DIM }}>
            <span>{tooltip.node.loc} LOC</span>
            <span>{tooltip.node.imports.length} imports</span>
            <span>{tooltip.node.exports.length} exports</span>
          </div>
          {tooltip.node.annotation && (
            <p className="mt-2 text-[10px] leading-relaxed" style={{ color: TEXT_PRIMARY }}>
              {tooltip.node.annotation}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

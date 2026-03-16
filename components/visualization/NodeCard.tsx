'use client'

import { memo, useState } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_DIM, getLayerColor } from '@/lib/color-schemes'
import type { NodeLayer } from '@/lib/types'
import AnnotationBadge from './AnnotationBadge'

export type NodeCardData = {
  name: string
  filePath: string
  lineNumber: number
  layer: NodeLayer
  params?: string[]
  returnType?: string
  annotation?: string
  annotationLoading?: boolean
  isDeadCode?: boolean
  isExported?: boolean
  onNodeClick?: (nodeId: string, filePath: string, lineNumber: number) => void
  onAnnotationRefresh?: (nodeId: string) => void
}

type NodeCardNode = Node<NodeCardData, 'nodeCard'>

function NodeCardComponent({ id, data }: NodeProps<NodeCardNode>) {
  const [hovered, setHovered] = useState(false)
  const layerColor = getLayerColor(data.layer)

  const handleClick = () => {
    data.onNodeClick?.(id, data.filePath, data.lineNumber)
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer rounded-lg transition-all duration-200"
      style={{
        background: CARD_BG,
        border: `1px solid ${hovered ? layerColor : CARD_BORDER}`,
        borderLeft: `3px solid ${layerColor}`,
        boxShadow: hovered ? `0 0 20px ${layerColor}30` : 'none',
        padding: '10px 12px',
        minWidth: 200,
        maxWidth: 280,
        opacity: data.isDeadCode ? 0.4 : 1,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: layerColor,
          border: 'none',
          width: 6,
          height: 6,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: layerColor,
          border: 'none',
          width: 6,
          height: 6,
        }}
      />

      <div className="flex flex-col gap-1">
        <div
          className="font-mono text-xs font-bold truncate"
          style={{ color: TEXT_PRIMARY, fontFamily: 'var(--font-jetbrains)' }}
        >
          {data.name}
          {data.isExported && (
            <span className="ml-1 text-[9px] opacity-50">export</span>
          )}
        </div>

        <div
          className="font-mono text-[10px] truncate"
          style={{ color: TEXT_DIM, fontFamily: 'var(--font-jetbrains)' }}
        >
          {data.filePath}:{data.lineNumber}
        </div>

        {hovered && data.params && data.params.length > 0 && (
          <div
            className="mt-1 font-mono text-[10px]"
            style={{ color: TEXT_DIM, fontFamily: 'var(--font-jetbrains)' }}
          >
            ({data.params.join(', ')})
            {data.returnType && (
              <span style={{ color: layerColor }}> : {data.returnType}</span>
            )}
          </div>
        )}

        <div className="mt-1">
          <AnnotationBadge
            annotation={data.annotation}
            isLoading={data.annotationLoading}
            onRefresh={
              data.onAnnotationRefresh
                ? () => data.onAnnotationRefresh!(id)
                : undefined
            }
          />
        </div>
      </div>

      {data.isDeadCode && (
        <div
          className="absolute -top-1 -right-1 h-2 w-2 rounded-full"
          style={{ background: '#ef4444' }}
        />
      )}
    </div>
  )
}

const NodeCard = memo(NodeCardComponent)
export default NodeCard

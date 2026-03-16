'use client'

import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps, type Edge } from '@xyflow/react'

export type EdgeAnimatedData = {
  targetLayer?: string
  color?: string
}

type AnimatedEdge = Edge<EdgeAnimatedData, 'edgeAnimated'>

function EdgeAnimatedComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<AnimatedEdge>) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  })

  const color = data?.color || '#3b82f680'

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: 1.5,
          filter: `drop-shadow(0 0 4px ${color})`,
        }}
      />
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinecap="round"
        style={{
          animation: 'dash-flow 1s linear infinite',
        }}
      />
      <style>{`
        @keyframes dash-flow {
          to {
            stroke-dashoffset: -10;
          }
        }
      `}</style>
    </>
  )
}

const EdgeAnimated = memo(EdgeAnimatedComponent)
export default EdgeAnimated

'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ACCENT, TEXT_DIM, TEXT_PRIMARY, CARD_BG, CARD_BORDER } from '@/lib/color-schemes'

interface AnnotationBadgeProps {
  annotation?: string
  isLoading?: boolean
  onRefresh?: () => void
}

export default function AnnotationBadge({
  annotation,
  isLoading,
  onRefresh,
}: AnnotationBadgeProps) {
  const [expanded, setExpanded] = useState(false)

  if (!annotation && !isLoading) return null

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setExpanded(!expanded)
        }}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors"
        style={{
          background: isLoading ? 'transparent' : `${ACCENT}20`,
          color: isLoading ? TEXT_DIM : ACCENT,
          border: `1px solid ${isLoading ? CARD_BORDER : ACCENT}40`,
        }}
      >
        {isLoading ? (
          <span className="shimmer-text inline-block w-16 h-3 rounded" />
        ) : (
          <span className="max-w-[120px] truncate">{annotation}</span>
        )}
      </button>

      {expanded && annotation && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md p-3 text-xs shadow-lg"
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            color: TEXT_PRIMARY,
          }}
        >
          <p className="leading-relaxed">{annotation}</p>
          {onRefresh && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRefresh()
              }}
              className="mt-2 flex items-center gap-1 text-[10px] transition-colors hover:opacity-80"
              style={{ color: TEXT_DIM }}
            >
              <RefreshCw size={10} />
              Regenerate
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .shimmer-text {
          background: linear-gradient(
            90deg,
            ${CARD_BORDER} 25%,
            ${TEXT_DIM}40 50%,
            ${CARD_BORDER} 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

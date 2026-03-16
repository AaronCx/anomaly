'use client'

import { GitBranch, Grid3X3, Network } from 'lucide-react'
import { CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_DIM, ACCENT } from '@/lib/color-schemes'
import type { VisualizationMode } from '@/lib/types'

interface ViewSwitcherProps {
  activeMode: VisualizationMode
  onModeChange: (mode: VisualizationMode) => void
}

const modes: { key: VisualizationMode; label: string; icon: typeof GitBranch }[] = [
  { key: 'route-tracer', label: 'Route Tracer', icon: GitBranch },
  { key: 'module-map', label: 'Module Map', icon: Grid3X3 },
  { key: 'call-graph', label: 'Call Graph', icon: Network },
]

export default function ViewSwitcher({ activeMode, onModeChange }: ViewSwitcherProps) {
  return (
    <div
      className="inline-flex rounded-lg p-1"
      style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
    >
      {modes.map(({ key, label, icon: Icon }) => {
        const isActive = activeMode === key
        return (
          <button
            key={key}
            onClick={() => onModeChange(key)}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200"
            style={{
              background: isActive ? ACCENT : 'transparent',
              color: isActive ? '#fff' : TEXT_DIM,
              boxShadow: isActive ? `0 0 12px ${ACCENT}40` : 'none',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

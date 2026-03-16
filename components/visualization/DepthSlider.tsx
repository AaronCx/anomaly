'use client'

import { CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_DIM, ACCENT } from '@/lib/color-schemes'

interface DepthSliderProps {
  depth: number
  onDepthChange: (depth: number) => void
  min?: number
  max?: number
}

export default function DepthSlider({
  depth,
  onDepthChange,
  min = 1,
  max = 5,
}: DepthSliderProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: TEXT_DIM }}>
        Depth
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={depth}
        onChange={(e) => onDepthChange(parseInt(e.target.value, 10))}
        className="depth-slider h-1 flex-1 cursor-pointer appearance-none rounded-full"
        style={{ background: CARD_BORDER }}
      />
      <span
        className="min-w-[1.5rem] text-center font-mono text-xs font-bold"
        style={{ color: TEXT_PRIMARY, fontFamily: 'var(--font-jetbrains)' }}
      >
        {depth}
      </span>

      <style jsx>{`
        .depth-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${ACCENT};
          box-shadow: 0 0 8px ${ACCENT}60;
          cursor: pointer;
        }
        .depth-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${ACCENT};
          box-shadow: 0 0 8px ${ACCENT}60;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  )
}

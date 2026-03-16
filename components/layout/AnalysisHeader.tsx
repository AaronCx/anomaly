'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { VisualizationMode } from '@/lib/types'
import { CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_DIM, ACCENT } from '@/lib/color-schemes'

interface AnalysisHeaderProps {
  owner: string
  repo: string
  language?: string
  fileCount?: number
}

const TABS: { id: VisualizationMode; label: string }[] = [
  { id: 'route-tracer', label: 'Route Tracer' },
  { id: 'module-map', label: 'Module Map' },
  { id: 'call-graph', label: 'Call Graph' },
]

export default function AnalysisHeader({
  owner,
  repo,
  language,
  fileCount,
}: AnalysisHeaderProps) {
  const [activeTab, setActiveTab] = useState<VisualizationMode>('route-tracer')

  return (
    <div
      className="border-b"
      style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
    >
      {/* Breadcrumb + stats */}
      <div className="flex items-center justify-between px-6 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-sm transition-colors hover:text-text-primary"
            style={{ color: TEXT_DIM }}
          >
            anomaly
          </Link>
          <span style={{ color: TEXT_DIM }}>/</span>
          <span className="font-mono text-sm font-medium" style={{ color: TEXT_PRIMARY }}>
            {owner}
          </span>
          <span style={{ color: TEXT_DIM }}>/</span>
          <span className="font-mono text-sm font-medium" style={{ color: TEXT_PRIMARY }}>
            {repo}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm" style={{ color: TEXT_DIM }}>
          {language && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: ACCENT }}
              />
              {language}
            </span>
          )}
          {fileCount !== undefined && (
            <span>{fileCount} files</span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 px-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative cursor-pointer px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: activeTab === tab.id ? TEXT_PRIMARY : TEXT_DIM,
            }}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ backgroundColor: ACCENT }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import AnalysisView from '@/components/visualization/AnalysisView'
import { TEXT_DIM, ACCENT, CARD_BG, CARD_BORDER } from '@/lib/color-schemes'
import type { AnalysisResult } from '@/lib/types'
import { analyzeRepo } from '@/lib/api'

interface AnalysisViewWrapperProps {
  owner: string
  repo: string
  analysisId?: string
}

export default function AnalysisViewWrapper({
  owner,
  repo,
  analysisId,
}: AnalysisViewWrapperProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('Loading analysis...')

  useEffect(() => {
    // First try sessionStorage (data from the POST response)
    if (analysisId) {
      const cached = sessionStorage.getItem(`anomaly-analysis-${analysisId}`)
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as AnalysisResult
          if (parsed.status === 'complete' && parsed.modules) {
            setAnalysis(parsed)
            setIsLoading(false)
            return
          }
        } catch {
          // Invalid cache, fall through to re-analyze
        }
      }
    }

    // No cached data — run analysis fresh
    setStatusMessage('Analyzing repository...')
    analyzeRepo(`https://github.com/${owner}/${repo}`)
      .then((result) => {
        if (result.status === 'complete' || result.modules) {
          setAnalysis(result)
          // Cache for future visits
          if (result.id) {
            sessionStorage.setItem(`anomaly-analysis-${result.id}`, JSON.stringify(result))
          }
        } else {
          setError(result.status === 'error' ? 'Analysis failed' : 'Analysis incomplete')
        }
        setIsLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to analyze repository')
        setIsLoading(false)
      })
  }, [owner, repo, analysisId])

  if (error) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: '#0a0a0f' }}
      >
        <div
          className="rounded-lg px-6 py-4 text-center max-w-md"
          style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
        >
          <p className="text-sm font-medium text-red-400">Analysis failed</p>
          <p className="mt-1 text-xs" style={{ color: TEXT_DIM }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 rounded text-xs font-medium"
            style={{ background: ACCENT, color: '#fff' }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !analysis) {
    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-4"
        style={{ background: '#0a0a0f' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: `${ACCENT} transparent ${ACCENT}40 ${ACCENT}40` }}
          />
          <span className="text-sm font-medium" style={{ color: '#e2e8f0' }}>
            {statusMessage}
          </span>
        </div>
        <p className="text-xs" style={{ color: TEXT_DIM }}>
          This may take up to 30 seconds for large repos
        </p>
      </div>
    )
  }

  return <AnalysisView analysis={analysis} />
}

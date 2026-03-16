'use client'

import { useAnalysis } from '@/hooks/useAnalysis'
import AnalysisView from '@/components/visualization/AnalysisView'
import { TEXT_DIM, ACCENT, CARD_BG, CARD_BORDER } from '@/lib/color-schemes'

interface AnalysisViewWrapperProps {
  owner: string
  repo: string
  analysisId?: string
}

export default function AnalysisViewWrapper({
  owner,
  repo,
  analysisId: explicitId,
}: AnalysisViewWrapperProps) {
  const analysisId = explicitId || `${owner}/${repo}`
  const { analysis, progress, isLoading, error } = useAnalysis(analysisId)

  if (error) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: '#0a0a0f' }}
      >
        <div
          className="rounded-lg px-6 py-4 text-center"
          style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
        >
          <p className="text-sm font-medium text-red-400">Analysis failed</p>
          <p className="mt-1 text-xs" style={{ color: TEXT_DIM }}>
            {error}
          </p>
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
            {progress?.message || 'Loading analysis...'}
          </span>
        </div>
        {progress && (
          <div className="w-64">
            <div
              className="h-1 w-full overflow-hidden rounded-full"
              style={{ background: CARD_BORDER }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress.progress}%`,
                  background: ACCENT,
                  boxShadow: `0 0 8px ${ACCENT}60`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px]" style={{ color: TEXT_DIM }}>
              <span>{progress.status}</span>
              <span>{progress.progress}%</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return <AnalysisView analysis={analysis} />
}

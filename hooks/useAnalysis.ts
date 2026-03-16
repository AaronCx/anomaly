'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AnalysisResult, AnalysisProgress } from '@/lib/types'
import { getAnalysis, getAnalysisStatus } from '@/lib/api'

interface UseAnalysisReturn {
  analysis: AnalysisResult | null
  progress: AnalysisProgress | null
  isLoading: boolean
  error: string | null
}

export function useAnalysis(analysisId: string): UseAnalysisReturn {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [progress, setProgress] = useState<AnalysisProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const status = await getAnalysisStatus(analysisId)
      setProgress(status)

      if (status.status === 'complete') {
        const result = await getAnalysis(analysisId)
        setAnalysis(result)
        setIsLoading(false)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      } else if (status.status === 'error') {
        setError(status.message || 'Analysis failed')
        setIsLoading(false)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsLoading(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [analysisId])

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, 2000)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [poll])

  return { analysis, progress, isLoading, error }
}
